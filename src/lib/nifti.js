// NIfTI-1 single-file reader/writer. Header geometry never establishes template identity.
import {validateVolumeMetadata,validateLabelRows,MAX_LABEL_FILE_BYTES,MAX_LABEL_TEXT_CHARS,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,utf8ByteLength} from './workspace-limits.js';
export const MAX_NIFTI_VOXELS = 64_000_000;
export const MAX_NIFTI_FILE_BYTES = 128 * 1024 * 1024;
const MAX_DECODED_BYTES = MAX_NIFTI_VOXELS * 8 + 1024 * 1024;
const TYPES = {
  2: [Uint8Array, 'getUint8', 'setUint8', 1, 'uint8'],
  4: [Int16Array, 'getInt16', 'setInt16', 2, 'int16'],
  8: [Int32Array, 'getInt32', 'setInt32', 4, 'int32'],
  16: [Float32Array, 'getFloat32', 'setFloat32', 4, 'float32'],
  64: [Float64Array, 'getFloat64', 'setFloat64', 8, 'float64'],
  256: [Int8Array, 'getInt8', 'setInt8', 1, 'int8'],
  512: [Uint16Array, 'getUint16', 'setUint16', 2, 'uint16'],
  768: [Uint32Array, 'getUint32', 'setUint32', 4, 'uint32'],
};

function fail(code) { throw new Error(code); }
export function assertNiftiVoxelValue(value,kind){
  if(!Number.isFinite(value)||Math.abs(value)>1e30)fail('nifti-nonfinite-data');
  if(kind==='label'&&(!Number.isSafeInteger(value)||value<0))fail('nifti-invalid-labels');
  if(kind==='mask'&&value!==0&&value!==1)fail('nifti-not-binary');
  if(kind==='probability'&&(value<0||value>1))fail('nifti-probability-range');
}
function geometry(shape, affine) {
  if (shape?.length !== 3 || !shape.every(n => Number.isInteger(n) && n > 0 && n <= 32767)) fail('nifti-invalid-dimensions');
  const count = shape.reduce((a, b) => a * b, 1);
  if (count > MAX_NIFTI_VOXELS) fail('nifti-too-many-voxels');
  if (affine?.length !== 16 || !affine.every(Number.isFinite) || affine.slice(12).some((v, i) => v !== (i === 3 ? 1 : 0))) fail('nifti-invalid-affine');
  const a = affine;
  const det = a[0] * (a[5]*a[10]-a[6]*a[9]) - a[1]*(a[4]*a[10]-a[6]*a[8]) + a[2]*(a[4]*a[9]-a[5]*a[8]);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) fail('nifti-invalid-affine');
  for (let c = 0; c < 3; c++) {
    const scale = Math.hypot(a[c], a[4+c], a[8+c]);
    if (scale < 1e-6 || scale > 1e6) fail('nifti-invalid-affine');
  }
  for (const x of [0, shape[0]-1]) for (const y of [0, shape[1]-1]) for (const z of [0, shape[2]-1]) {
    for (let r = 0; r < 3; r++) if (Math.abs(a[r*4]*x+a[r*4+1]*y+a[r*4+2]*z+a[r*4+3]) > 1e7) fail('nifti-invalid-affine');
  }
  return count;
}

function decodeLimit(value,fallback,hardMaximum,code){
  if(value===undefined)return fallback;
  if(!Number.isSafeInteger(value)||value<0)fail(code);
  return Math.min(value,hardMaximum);
}

async function unpack(bytes, options) {
  if (bytes.byteLength > MAX_NIFTI_FILE_BYTES) fail('nifti-file-too-large');
  const maxInflatedBytes=decodeLimit(options.maxInflatedBytes,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,MAX_DECODED_BYTES,'inflated-budget');
  if (bytes[0] !== 31 || bytes[1] !== 139) {
    // Admit a complete header before considering the missing data of a virtual large file.
    if(bytes.length>=352)readHeader(bytes.subarray(0,352),options);
    if(bytes.byteLength>maxInflatedBytes)fail('inflated-budget');
    return bytes;
  }
  if (typeof DecompressionStream === 'undefined') fail('nifti-gzip-unavailable');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks = []; let length = 0,headerLength=0,admitted=false;
  const header=new Uint8Array(352);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if(!admitted){
        const take=Math.min(352-headerLength,value.byteLength);
        header.set(value.subarray(0,take),headerLength);headerLength+=take;
        if(headerLength===352){readHeader(header,options);admitted=true;}
      }
      if (length > maxInflatedBytes) fail('inflated-budget');
      chunks.push(value);
    }
  } catch (error) {
    try{await reader.cancel();}catch{/* Preserve the admission or decoding failure. */}
    if (error.message.startsWith('nifti-')||['decoded-budget','inflated-budget'].includes(error.message)) throw error;
    fail('nifti-invalid-gzip');
  }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function qform(view, little, factor) {
  const f = offset => view.getFloat32(offset, little);
  let b=f(256), c=f(260), d=f(264), norm=b*b+c*c+d*d;
  if (![b,c,d,norm].every(Number.isFinite) || norm > 1.0001) fail('nifti-invalid-qform');
  let a;
  if (norm > 1-1e-7) { const s=1/Math.sqrt(norm); b*=s; c*=s; d*=s; a=0; } else a=Math.sqrt(1-norm);
  const spacing=[f(80),f(84),f(88)];
  if (!spacing.every(value => Number.isFinite(value) && value > 0) || ![0,1,-1].includes(f(76))) fail('nifti-invalid-qform');
  const dx=spacing[0]*factor, dy=spacing[1]*factor, dz=spacing[2]*factor*(f(76)<0?-1:1);
  return [
    (a*a+b*b-c*c-d*d)*dx,2*(b*c-a*d)*dy,2*(b*d+a*c)*dz,f(268)*factor,
    2*(b*c+a*d)*dx,(a*a+c*c-b*b-d*d)*dy,2*(c*d-a*b)*dz,f(272)*factor,
    2*(b*d-a*c)*dx,2*(c*d+a*b)*dy,(a*a+d*d-c*c-b*b)*dz,f(276)*factor,
    0,0,0,1,
  ];
}

function readHeader(bytes,options){
  if (bytes.length < 352) fail('nifti-truncated-header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = view.getInt32(0, true) === 348;
  if (!little && view.getInt32(0, false) !== 348) fail('nifti-unsupported-header');
  if (String.fromCharCode(...bytes.slice(344,348)) !== 'n+1\0') fail('nifti-single-file-required');
  const i16 = offset => view.getInt16(offset,little), f32=offset=>view.getFloat32(offset,little);
  const ndim=i16(40);
  if (ndim !== 3) fail(ndim >= 4 ? 'nifti-4d-unsupported' : 'nifti-invalid-dimensions');
  const shape=[i16(42),i16(44),i16(46)];
  const type=TYPES[i16(70)];
  if (!type || i16(72)!==type[3]*8) fail('nifti-unsupported-datatype');
  const units=bytes[123]&7, factor=({1:1000,2:1,3:0.001})[units];
  if (!factor) fail('nifti-unknown-spatial-units');
  const qcode=i16(252), scode=i16(254);
  if (qcode<0 || scode<0 || (!qcode && !scode)) fail('nifti-missing-affine');
  const sa=scode>0 ? [...Array.from({length:12},(_,i)=>f32(280+i*4)*factor),0,0,0,1] : null;
  const qa=qcode>0 ? qform(view,little,factor) : null;
  if (qa) geometry(shape,qa);
  const affine=sa||qa, count=geometry(shape,affine);
  const offset=f32(108);
  if (!Number.isInteger(offset) || offset<352 || offset>1024*1024 || offset%16!==0) fail('nifti-invalid-offset');
  const slope=f32(112), intercept=f32(116);
  if (!Number.isFinite(slope) || (slope!==0 && !Number.isFinite(intercept))) fail('nifti-invalid-scaling');
  const scaled=slope!==0 && (slope!==1 || intercept!==0);
  const maxDecodedVoxelBytes=decodeLimit(options.maxDecodedVoxelBytes,MAX_WORKSPACE_RAW_PAYLOAD_BYTES-352,MAX_WORKSPACE_RAW_PAYLOAD_BYTES-352,'decoded-budget');
  if(count*(scaled?8:type[3])>maxDecodedVoxelBytes)fail('decoded-budget');
  const maxInflatedBytes=decodeLimit(options.maxInflatedBytes,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,MAX_DECODED_BYTES,'inflated-budget');
  if(offset+count*type[3]>maxInflatedBytes)fail('inflated-budget');
  return {little,shape,type,units,qcode,scode,sa,qa,affine,count,offset,slope,intercept,scaled};
}

export async function parseNifti(input, options = {}) {
  if (!(input instanceof ArrayBuffer) && !(input instanceof Uint8Array)) fail('nifti-invalid-input');
  const kind=({stat:'statistic',prob:'probability',labels:'label'})[options.kind]||options.kind||'label';
  if (!['label','mask','statistic','probability'].includes(kind)) fail('nifti-invalid-kind');
  const metadata=validateVolumeMetadata({...options,kind});
  const bytes = await unpack(input instanceof Uint8Array ? input : new Uint8Array(input),options);
  const {little,shape,type,units,qcode,scode,sa,qa,affine,count,offset,slope,intercept,scaled}=readHeader(bytes,options);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (offset+count*type[3]>bytes.length) fail('nifti-truncated-data');
  if (bytes[348]) {
    for (let at=352; at<offset;) {
      if (at+8>offset) fail('nifti-invalid-extension');
      const size=view.getInt32(at,little);
      if (size<16 || size%16 || at+size>offset) fail('nifti-invalid-extension');
      at+=size;
    }
  }
  const data = new (scaled ? Float64Array : type[0])(count);
  let min=Infinity,max=-Infinity,nonzero=0;
  for (let i=0;i<count;i++) {
    const raw=view[type[1]](offset+i*type[3],little), value=scaled?raw*slope+intercept:raw;
    assertNiftiVoxelValue(value,kind);
    data[i]=value; min=Math.min(min,value); max=Math.max(max,value); if(value!==0)nonzero++;
  }
  const conflict=!!(sa&&qa&&sa.some((v,i)=>Math.abs(v-qa[i])>1e-3));
  return { data, dataTypedArray:data, shape, affine, order:'x-fastest', dtype:scaled?'float64':type[4], space:metadata.space||'native-unverified', kind, name:metadata.name||'Imported NIfTI', canOverlayOnTarget:false, alignmentStatus:'unverified', metadata:{ format:'NIfTI-1', littleEndian:little, datatype:view.getInt16(70,little), qformCode:qcode, sformCode:scode, affineSource:sa?'sform':'qform', qformAffine:qa, sformAffine:sa, affineConflict:conflict, originalSpatialUnits:units, spatialUnits:'mm', scaling:{slope,intercept}, min,max,nonzero, description:new TextDecoder().decode(bytes.slice(148,228)).replace(/\0.*$/s,''), geometryDoesNotVerifySpace:true } };
}

/** Writes a 3D, little-endian .nii with mm units and the supplied affine as sform. */
export function exportNifti(volume,{kind=volume.kind}={}) {
  const affine=Array.isArray(volume.affine?.[0])?volume.affine.flat():volume.affine;
  const count=geometry(volume.shape,affine), data=volume.data||volume.dataTypedArray;
  if (data?.length!==count) fail('nifti-invalid-data-length');
  const entry=Object.entries(TYPES).find(([,type])=>data instanceof type[0]);
  if (!entry) fail('nifti-unsupported-datatype');
  const [code,type]=entry, bytes=new Uint8Array(352+count*type[3]), view=new DataView(bytes.buffer);
  view.setInt32(0,348,true); view.setInt16(40,3,true);
  for(let i=0;i<7;i++)view.setInt16(42+2*i,volume.shape[i]||1,true);
  view.setInt16(70,+code,true);view.setInt16(72,type[3]*8,true);view.setFloat32(76,1,true);
  for(let c=0;c<3;c++)view.setFloat32(80+4*c,Math.hypot(affine[c],affine[c+4],affine[c+8]),true);
  view.setFloat32(108,352,true);view.setFloat32(112,1,true);bytes[123]=2;
  // Code 2 means aligned coordinates; it intentionally does not claim verified MNI space.
  view.setInt16(254,2,true);
  for(let i=0;i<12;i++)view.setFloat32(280+i*4,affine[i],true);
  bytes.set(new TextEncoder().encode(String(volume.name||'ROI mask; reference details in companion CSV')).slice(0,79),148);
  bytes.set([110,43,49,0],344);
  const [nx,ny,nz]=volume.shape;
  for(let i=0;i<count;i++) {
    const index=volume.order==='z-fastest'?(i%nx*ny+Math.floor(i/nx)%ny)*nz+Math.floor(i/(nx*ny)):i;
    assertNiftiVoxelValue(data[index],kind);
    view[type[2]](352+i*type[3],data[index],true);
  }
  return bytes;
}

export function parseLabelTable(text, format='csv') {
  if(typeof text!=='string')fail('labels-invalid-table');
  if(utf8ByteLength(text)>MAX_LABEL_FILE_BYTES)fail('label-file-budget');
  let rows;
  if(format==='json') {
    const value=JSON.parse(text);
    rows=Array.isArray(value)?value:Object.entries(value).map(([id,label])=>({id,...(typeof label==='string'?{name:label}:label)}));
  } else {
    const records=[];let row=[],field='',quoted=false;
    text=text.replace(/^\uFEFF/,'');
    for(let i=0;i<=text.length;i++) {
      const ch=text[i];
      if(ch==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(!quoted&&(ch===','||ch==='\n'||ch===undefined)) {row.push(field.replace(/\r$/,''));field='';if(ch!==','){if(row.some(v=>v.trim()))records.push(row);row=[];}}
      else field+=ch;
    }
    if(quoted)fail('labels-invalid-table');
    const header=records.shift()?.map(v=>v.trim().toLowerCase())||[];
    if(!header.includes('id')||!header.includes('name'))fail('labels-invalid-table');
    rows=records.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]||''])));
  }
  return validateLabelRows(rows.map(row=>{
    if(typeof row?.name==='string'&&row.name.length>MAX_LABEL_TEXT_CHARS)fail('label-name-too-long');
    return {id:Number(row?.id),name:typeof row?.name==='string'?row.name.trim():row?.name,...(row?.zh!=null?{zh:row.zh}:{})};
  }));
}

// Preserved pinned-source PAM50 reader and cropping API.
const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const PAM50_TYPES = {
  2: { bytes: 1, ArrayType: Uint8Array, getter: 'getUint8' },
  4: { bytes: 2, ArrayType: Int16Array, getter: 'getInt16' },
  8: { bytes: 4, ArrayType: Int32Array, getter: 'getInt32' },
  16: { bytes: 4, ArrayType: Float32Array, getter: 'getFloat32' },
  64: { bytes: 8, ArrayType: Float64Array, getter: 'getFloat64' },
  256: { bytes: 1, ArrayType: Int8Array, getter: 'getInt8' },
  512: { bytes: 2, ArrayType: Uint16Array, getter: 'getUint16' },
  768: { bytes: 4, ArrayType: Uint32Array, getter: 'getUint32' },
};

/** Minimal, validated single-file NIfTI-1 reader for the pinned PAM50 sources.
 * Explicit sforms are required. A caller may supply documented mm units only
 * when a pinned source omits the spatial-units header (PAM50 level labels do).
 */
export function parseNifti1(buffer, { spatialUnitsIfMissing } = {}) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 352) throw new Error('nifti-header');
  const view = new DataView(buffer);
  const little = view.getInt32(0, true) === 348 ? true : view.getInt32(0, false) === 348 ? false : null;
  if (little == null || String.fromCharCode(view.getUint8(344), view.getUint8(345), view.getUint8(346)) !== 'n+1') throw new Error('nifti-header');
  const ndim = view.getInt16(40, little), shape = [0, 1, 2].map(axis => view.getInt16(42 + axis * 2, little));
  if (ndim < 3 || ndim > 7 || shape.some(n => n <= 0) || Array.from({ length: Math.max(0, ndim - 3) }, (_, axis) => view.getInt16(48 + axis * 2, little)).some(n => n !== 1)) throw new Error('nifti-dimensions');
  const count = shape.reduce((a, b) => a * b, 1);
  if (count > 50_000_000) throw new Error('nifti-too-large');
  const datatype = view.getInt16(70, little), type = PAM50_TYPES[datatype], bitpix = view.getInt16(72, little);
  if (!type || bitpix !== type.bytes * 8) throw new Error('nifti-datatype');
  const offset = view.getFloat32(108, little);
  if (!Number.isInteger(offset) || offset < 352 || offset + count * type.bytes > buffer.byteLength) throw new Error('nifti-data-length');
  const spatialUnitsCode = view.getUint8(123) & 7;
  if ((spatialUnitsCode !== 2 && !(spatialUnitsCode === 0 && spatialUnitsIfMissing === 'mm')) || view.getInt16(254, little) <= 0) throw new Error('nifti-explicit-mm-sform-required');
  const affine = Array.from({ length: 12 }, (_, i) => view.getFloat32(280 + i * 4, little)).concat([0, 0, 0, 1]);
  const determinant = affine[0] * (affine[5] * affine[10] - affine[6] * affine[9]) - affine[1] * (affine[4] * affine[10] - affine[6] * affine[8]) + affine[2] * (affine[4] * affine[9] - affine[5] * affine[8]);
  if (!affine.every(Number.isFinite) || Math.abs(determinant) < 1e-10) throw new Error('nifti-affine');
  const rawSlope = view.getFloat32(112, little), rawIntercept = view.getFloat32(116, little);
  const slope = Number.isFinite(rawSlope) && rawSlope !== 0 ? rawSlope : 1;
  const intercept = Number.isFinite(rawSlope) && rawSlope !== 0 && Number.isFinite(rawIntercept) ? rawIntercept : 0;
  let data;
  if ((little === HOST_LITTLE_ENDIAN || type.bytes === 1) && offset % type.bytes === 0) data = new type.ArrayType(buffer, offset, count);
  else {
    data = new type.ArrayType(count);
    for (let index = 0; index < count; index++) data[index] = view[type.getter](offset + index * type.bytes, little);
  }
  return { data, shape, affine, order: 'x-fastest', coordinateSystem: 'RAS', units: 'mm', unitsProvenance: spatialUnitsCode === 2 ? 'NIfTI header' : 'Explicit pinned-source metadata; source header units were unspecified', datatype, slope, intercept, voxelSizeMm: [0, 1, 2].map(axis => Math.hypot(affine[axis], affine[4 + axis], affine[8 + axis])) };
}

export function cropNiftiSelections(volume, descriptors) {
  const { data, shape, affine, slope, intercept } = volume, [nx, ny, nz] = shape;
  const records = descriptors.map(descriptor => ({ ...descriptor, low: [Infinity, Infinity, Infinity], high: [-Infinity, -Infinity, -Infinity], count: 0 }));
  const labelRecords = new Map(records.filter(record => record.selector === 'label').map(record => [record.labelValue, record]));
  const thresholdRecords = records.filter(record => record.selector === 'threshold');
  function include(record, index) {
    const x = index % nx, y = Math.floor(index / nx) % ny, z = Math.floor(index / (nx * ny));
    record.count++;
    record.low[0] = Math.min(record.low[0], x); record.high[0] = Math.max(record.high[0], x);
    record.low[1] = Math.min(record.low[1], y); record.high[1] = Math.max(record.high[1], y);
    record.low[2] = Math.min(record.low[2], z); record.high[2] = Math.max(record.high[2], z);
  }
  for (let index = 0; index < data.length; index++) {
    const value = data[index] * slope + intercept;
    if (!Number.isFinite(value)) continue;
    const label = labelRecords.get(value);
    if (label) include(label, index);
    for (const record of thresholdRecords) if (value >= (record.threshold ?? 0.5)) include(record, index);
  }
  return records.map(record => {
    if (!record.count) throw new Error(`nifti-empty-mask:${record.id}`);
    const low = record.low, cropShape = record.high.map((value, axis) => value - low[axis] + 1);
    const mask = new Uint8Array(cropShape.reduce((a, b) => a * b, 1));
    let at = 0;
    for (let z = low[2]; z <= record.high[2]; z++) for (let y = low[1]; y <= record.high[1]; y++) for (let x = low[0]; x <= record.high[0]; x++, at++) {
      const value = data[x + nx * (y + ny * z)] * slope + intercept;
      mask[at] = Number(Number.isFinite(value) && (record.selector === 'label' ? value === record.labelValue : value >= (record.threshold ?? 0.5)));
    }
    const croppedAffine = [...affine];
    for (let axis = 0; axis < 3; axis++) croppedAffine[axis * 4 + 3] += affine[axis * 4] * low[0] + affine[axis * 4 + 1] * low[1] + affine[axis * 4 + 2] * low[2];
    return { id: record.id, mask, sourceVoxels: record.count, grid: { shape: cropShape, affine: croppedAffine, order: 'x-fastest', space: 'PAM50 native straightened template' } };
  });
}

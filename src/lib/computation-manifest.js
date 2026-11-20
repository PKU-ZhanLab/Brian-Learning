import {APP_VERSION} from './app-version.js';
/** @typedef {import('./research-contracts.js').ComputationManifest} ComputationManifest */
/** @typedef {import('./research-contracts.js').AssetIdentity} AssetIdentity */
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const digest=value=>typeof value==='string'&&/^[a-f\d]{64}$/i.test(value);
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const ROI_ALGORITHM_VERSION='roi-shared-grid-v2';
export const ROI_APP_VERSION=APP_VERSION;

export function validateAssetIdentity(value) {
  if(!nonempty(value?.id)||!nonempty(value.version)||!digest(value.sha256)||(value.spaceId!==null&&!nonempty(value.spaceId)))throw Error('asset-identity-required');
  return {id:value.id,version:value.version,sha256:value.sha256.toLowerCase(),spaceId:value.spaceId};
}
export function validateGridSpec(value) {
  const affine=Array.isArray(value?.affine?.[0])?value.affine.flat():value?.affine;
  if(value?.shape?.length!==3||!value.shape.every(n=>Number.isSafeInteger(n)&&n>0)||affine?.length!==16||!affine.every(Number.isFinite)||!nonempty(value.space)||!['x-fastest','z-fastest'].includes(value.order))throw Error('manifest-grid-required');
  return {shape:[...value.shape],affine:[...affine],space:value.space,order:value.order};
}
export function validateTransformIdentity(value){
  if(!nonempty(value?.id)||!digest(value.sha256))throw Error('transform-identity-required');
  return {id:value.id,sha256:value.sha256.toLowerCase()};
}

/** SHA-256 of precisely the provided file bytes, with no decompression or JSON encoding. */
export async function makeAssetIdentity(bytes,metadata) {
  if(!(bytes instanceof Uint8Array))throw Error('asset-bytes-required');
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return freeze(validateAssetIdentity({...metadata,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')}));
}

/** @returns {ComputationManifest} */
export function makeComputationManifest(input) {
  if(!nonempty(input?.appVersion)||!nonempty(input.algorithmVersion)||!Array.isArray(input.inputs)||input.inputs.length<2||!Array.isArray(input.transforms))throw Error('computation-provenance-required');
  for(const field of ['sourceGrids','interpolation','thresholds','labelSets'])if(!Array.isArray(input[field])||input[field].length!==2)throw Error(`manifest-${field}-requires-A-B`);
  const inputs=input.inputs.map(validateAssetIdentity);
  if(inputs.slice(0,2).some(identity=>identity.spaceId===null))throw Error('comparison-space-required');
  const transforms=input.transforms.map(validateTransformIdentity);
  const sourceGrids=input.sourceGrids.map(validateGridSpec);
  if(sourceGrids.some((grid,i)=>grid.space!==inputs[i].spaceId))throw Error('source-grid-space-mismatch');
  const targetGrid=validateGridSpec(input.targetGrid);
  const interpolation=input.interpolation.map(value=>{if(!nonempty(value))throw Error('interpolation-required');return value;});
  const thresholds=input.thresholds.map(value=>{if(!['label','mask','probability','statistic'].includes(value?.kind)||!Number.isFinite(value.threshold)||value.threshold<0||!['positive','negative','absolute'].includes(value.tail)||(value.kind==='probability'&&value.threshold>1))throw Error('manifest-threshold-invalid');return {kind:value.kind,threshold:value.threshold,tail:value.tail};});
  const labelSets=input.labelSets.map((values,i)=>{if(!Array.isArray(values)||!values.every(n=>Number.isSafeInteger(n)&&n>0)||(thresholds[i].kind==='label'&&!values.length))throw Error('manifest-label-set-invalid');return [...new Set(values)].sort((a,b)=>a-b);});
  const dependencies=inputs.slice(2).filter((value,i,rows)=>rows.findIndex(row=>JSON.stringify(row)===JSON.stringify(value))===i).sort((a,b)=>a.id.localeCompare(b.id));
  return freeze({appVersion:input.appVersion,algorithmVersion:input.algorithmVersion,inputs:[...inputs.slice(0,2),...dependencies],transforms,sourceGrids,targetGrid,interpolation,thresholds,labelSets,...(input.spatialEvidence?{spatialEvidence:clone(input.spatialEvidence)}:{})});
}

/** Compare even incomplete historical manifests without upgrading missing facts. */
export function compareComputationManifest(saved,current) {
  const normalize=value=>{const copy=clone(value);if(Array.isArray(copy?.labelSets))copy.labelSets=copy.labelSets.map(set=>[...new Set(set)].sort((a,b)=>a-b));return copy;};
  const differences=[];
  const visit=(a,b,path)=>{
    if(Object.is(a,b))return;
    if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
      if(Array.isArray(a)&&a.length!==b.length)differences.push({path:`${path}.length`,saved:a.length,current:b.length});
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[key],b[key],path?`${path}.${key}`:key);
    }else differences.push({path,saved:a,current:b});
  };
  visit(normalize(saved),normalize(current),'');return {matches:differences.length===0,differences};
}

export function exportComparisonBundle(comparison,manifest=comparison?.manifest) {
  const checked=makeComputationManifest(manifest);
  if(comparison.manifest&&!compareComputationManifest(comparison.manifest,checked).matches)throw Error('result-manifest-mismatch');
  const payload={schema:'neuroatlas-computation-v1',manifest:checked,metrics:comparison.metrics,probabilityMetrics:comparison.probabilityMetrics??null,sampling:comparison.sampling};
  if(!payload.metrics||!payload.sampling)throw Error('comparison-result-required');
  const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
  return {json:JSON.stringify(payload,null,2),csv:'field,value\r\n'+Object.entries(payload).map(([key,value])=>`${cell(key)},${cell(JSON.stringify(value))}`).join('\r\n')+'\r\n'};
}

/** Derived payload is encoded explicitly, little endian; dtype is part of its ID. */
export function encodeDerivedVolume(volume) {
  const types={Uint8Array:['uint8',1,'setUint8'],Int8Array:['int8',1,'setInt8'],Uint16Array:['uint16',2,'setUint16'],Int16Array:['int16',2,'setInt16'],Uint32Array:['uint32',4,'setUint32'],Int32Array:['int32',4,'setInt32'],Float32Array:['float32',4,'setFloat32'],Float64Array:['float64',8,'setFloat64']};
  const spec=types[volume.data?.constructor?.name];if(!spec)throw Error('derived-dtype-required');
  const [dtype,width,set]=spec,bytes=new Uint8Array(volume.data.length*width),view=new DataView(bytes.buffer);
  for(let i=0;i<volume.data.length;i++)view[set](i*width,volume.data[i],true);
  return {bytes,dtype,byteOrder:'little-endian'};
}
export async function prepareLocalVolumeProvenance(volume,originalBytes,{id='local-nifti'}={}) {
  const spaceId=nonempty(volume.space)&&volume.space!=='native-unverified'?volume.space:null;
  const originalObserved=await makeAssetIdentity(originalBytes,{id,version:'observed-file-bytes',spaceId});
  const original=freeze({...originalObserved,version:`sha256:${originalObserved.sha256}`});
  const encoded=encodeDerivedVolume(volume),observed=await makeAssetIdentity(encoded.bytes,{id:`${id}:derived:${encoded.dtype}:little-endian`,version:'observed-derived-bytes',spaceId});
  const derived=freeze({...observed,version:`sha256:${observed.sha256}`});
  return {...volume,identity:derived,sourceIdentities:[original],sourceGrid:spaceId?validateGridSpec({...volume,order:volume.order||'x-fastest'}):null,transforms:[],encoding:{dtype:encoded.dtype,byteOrder:encoded.byteOrder,derivation:'nifti-decoded-v1'},identityVerification:'received-bytes',spatialEvidence:{space:spaceId,alignmentStatus:volume.alignmentStatus??'user-declared',source:volume.source??null,provenance:volume.provenance??null,limitations:['Local source/alignment declaration is not independent registration verification.']}};
}

/** Locks the exact operands before worker preflight. Caller must pass normalized selections. */
export function makeComparisonManifest(a,selectionA,b,selectionB,target,options={}) {
  const volumes=[a,b],selections=[selectionA,selectionB];
  if(volumes.some(volume=>volume.canOverlayOnTarget!==true||!volume.identity||!Array.isArray(volume.sourceIdentities)||!Array.isArray(volume.transforms)))throw Error('computation-provenance-required');
  for(const volume of volumes){
    if(volume.identity.spaceId!==volume.space||!volume.sourceGrid||JSON.stringify(validateGridSpec(volume.sourceGrid))!==JSON.stringify(validateGridSpec({...volume,order:volume.order||'x-fastest'})))throw Error('source-grid-identity-mismatch');
  }
  return makeComputationManifest({appVersion:options.appVersion||ROI_APP_VERSION,algorithmVersion:options.algorithmVersion||ROI_ALGORITHM_VERSION,inputs:[a.identity,b.identity,...a.sourceIdentities,...b.sourceIdentities],transforms:[...a.transforms,...b.transforms],sourceGrids:volumes.map(volume=>volume.sourceGrid||validateGridSpec({...volume,order:volume.order||'x-fastest'})),targetGrid:validateGridSpec({...target,order:target.order||'x-fastest'}),interpolation:selections.map(selection=>['label','mask'].includes(selection.kind)?'nearest-neighbour':'trilinear'),thresholds:selections.map(({kind,threshold,tail})=>({kind,threshold,tail})),labelSets:selections.map(selection=>selection.labels||[]),spatialEvidence:volumes.map(volume=>volume.spatialEvidence??{space:volume.space,alignmentStatus:volume.alignmentStatus,source:volume.source??null,provenance:volume.provenance??null})});
}
export async function prepareComparisonManifest(...args){
  const manifest=makeComparisonManifest(...args);
  await Promise.all([args[0],args[2]].map(async volume=>{
    const observed=await makeAssetIdentity(encodeDerivedVolume(volume).bytes,volume.identity);
    if(observed.sha256!==volume.identity.sha256)throw Error('calculation-volume-byte-digest-mismatch');
  }));
  return manifest;
}

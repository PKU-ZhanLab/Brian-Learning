import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parseNifti, exportNifti, parseLabelTable } from './nifti.js';
import { registerCustomVolume, getCustomVolume, listCustomVolumes, removeCustomVolume, subscribeCustomVolumes } from './custom-volumes.js';

const affine=[-2,0,0,90,0,2,0,-126,0,0,2,-72,0,0,0,1];
const source={shape:[3,2,2],affine,order:'x-fastest',data:Uint16Array.from([0,1,2,0,2,0,1,0,0,2,0,1])};
function edit(bytes, callback) {const copy=bytes.slice();callback(new DataView(copy.buffer));return copy;}
function bigEndian() {
  const bytes=exportNifti(source),old=new DataView(bytes.buffer),big=bytes.slice(),view=new DataView(big.buffer);
  for(const offset of [0])view.setInt32(offset,old.getInt32(offset,true),false);
  for(const offset of [40,42,44,46,48,50,52,54,70,72,252,254])view.setInt16(offset,old.getInt16(offset,true),false);
  for(const offset of [76,80,84,88,108,112,116,...Array.from({length:12},(_,i)=>280+i*4)])view.setFloat32(offset,old.getFloat32(offset,true),false);
  for(let i=0;i<source.data.length;i++)view.setUint16(352+i*2,source.data[i],false);
  return big;
}
test('NIfTI sform, endian decoding and gzip preserve voxel values and negative axes', async()=>{
  for(const bytes of [exportNifti(source),bigEndian(),gzipSync(bigEndian())]) {
    const result=await parseNifti(bytes,{name:'source',space:'MNI152NLin6Asym',kind:'label'});
    assert.deepEqual(result.affine,affine);assert.deepEqual(result.shape,source.shape);assert.deepEqual([...result.data],[...source.data]);
    assert.equal(result.canOverlayOnTarget,false);assert.equal(result.alignmentStatus,'unverified');assert.equal(result.metadata.geometryDoesNotVerifySpace,true);
  }
});
test('qform-only transforms honor rotation, qfac and translations',async()=>{
  const bytes=edit(exportNifti(source),v=>{v.setInt16(254,0,true);v.setInt16(252,1,true);v.setFloat32(264,1,true);v.setFloat32(76,-1,true);v.setFloat32(268,90,true);v.setFloat32(272,-126,true);v.setFloat32(276,-72,true);});
  const result=await parseNifti(bytes);
  assert.deepEqual(result.affine.map(n=>n||0),[-2,0,0,90,0,-2,0,-126,0,0,-2,-72,0,0,0,1]);assert.equal(result.metadata.affineSource,'qform');
});
test('qform spacing must be positive before handedness is applied',async()=>{
  for (const offset of [80,84,88]) for (const spacing of [-2,0,NaN,Infinity]) for (const qfac of [-1,1]) {
    const bytes=edit(exportNifti(source),v=>{v.setInt16(254,0,true);v.setInt16(252,1,true);v.setFloat32(76,qfac,true);v.setFloat32(offset,spacing,true);});
    await assert.rejects(parseNifti(bytes),/invalid-qform/);
  }
});
test('sform wins conflicting qform but records both and flags conflict',async()=>{
  const result=await parseNifti(edit(exportNifti(source),v=>{v.setInt16(252,1,true);v.setFloat32(268,100,true);}));
  assert.deepEqual(result.affine,affine);assert.equal(result.metadata.affineConflict,true);assert.equal(result.metadata.qformAffine[3],100);
});
test('metre and micron spatial units convert affine and offsets into mm',async()=>{
  for(const [unit,factor] of [[1,1000],[3,.001]]) {
    const bytes=edit(exportNifti(source),v=>{v.setUint8(123,unit);for(let i=0;i<12;i++)v.setFloat32(280+i*4,affine[i]/factor,true);});
    const result=await parseNifti(bytes);result.affine.forEach((n,i)=>assert.ok(Math.abs(n-affine[i])<.0001));
  }
});
test('scaling applies once; continuous negative data require continuous kind',async()=>{
  const bytes=edit(exportNifti(source),v=>{v.setFloat32(112,2,true);v.setFloat32(116,-1,true);});
  const result=await parseNifti(bytes,{kind:'statistic'});
  assert.deepEqual([...result.data],Array.from(source.data,n=>2*n-1));assert.equal(result.dtype,'float64');
  await assert.rejects(parseNifti(bytes),/invalid-labels/);
  const roundtrip=await parseNifti(exportNifti(result),{kind:'statistic'});assert.deepEqual(roundtrip.data,result.data);
});
test('invalid, unsafe and unsupported headers/data reject explicitly',async()=>{
  const cases=[
    [b=>b.slice(0,351),/truncated-header/], [b=>b.slice(0,-1),/truncated-data/],
    [b=>edit(b,v=>v.setInt32(0,540,true)),/unsupported-header/],
    [b=>edit(b,v=>v.setInt16(40,4,true)),/4d-unsupported/],
    [b=>edit(b,v=>v.setUint8(123,0)),/unknown-spatial-units/],
    [b=>edit(b,v=>v.setInt16(254,0,true)),/missing-affine/],
    [b=>edit(b,v=>v.setFloat32(280,0,true)),/invalid-affine/],
    [b=>edit(b,v=>v.setFloat32(280,Infinity,true)),/invalid-affine/],
    [b=>edit(b,v=>v.setInt16(70,32,true)),/unsupported-datatype/],
    [b=>edit(b,v=>v.setInt16(72,8,true)),/unsupported-datatype/],
    [b=>edit(b,v=>v.setFloat32(108,353,true)),/invalid-offset/],
    [b=>edit(b,v=>v.setFloat32(112,NaN,true)),/invalid-scaling/],
    [b=>edit(b,v=>{v.setInt16(42,1000,true);v.setInt16(44,1000,true);v.setInt16(46,1000,true);}),/too-many-voxels/],
    [b=>edit(b,v=>{v.setInt16(252,1,true);v.setFloat32(256,2,true);}),/invalid-qform/],
  ];
  for(const [mutate,error] of cases)await assert.rejects(parseNifti(mutate(exportNifti(source))),error);
  await assert.rejects(parseNifti(Uint8Array.of(31,139,0,0)),/invalid-gzip/);
  const float=exportNifti({...source,data:new Float32Array(12)});
  await assert.rejects(parseNifti(edit(float,v=>v.setFloat32(352,NaN,true)),{kind:'statistic'}),/nonfinite-data/);
  await assert.rejects(parseNifti(edit(float,v=>v.setFloat32(352,1.1,true)),{kind:'probability'}),/probability-range/);
  await assert.rejects(parseNifti(exportNifti(source),{kind:'mask'}),/not-binary/);
});
test('NIfTI export reorders z-fastest source and retains affine',async()=>{
  const xfast=source.data,[nx,ny,nz]=source.shape;
  const zfast=Uint16Array.from({length:xfast.length},(_,n)=>{const z=n%nz,y=Math.floor(n/nz)%ny,x=Math.floor(n/(nz*ny));return xfast[x+nx*(y+ny*z)];});
  const result=await parseNifti(exportNifti({...source,data:zfast,order:'z-fastest'}));
  assert.deepEqual(result.data,xfast);assert.deepEqual(result.affine,affine);
});
test('label names parse quoted CSV and JSON, rejecting duplicate IDs',()=>{
  assert.deepEqual(parseLabelTable('id,name,zh\r\n1,"Left, motor",左运动区\r\n2,"Area ""two""",二区'),[{id:1,name:'Left, motor',zh:'左运动区'},{id:2,name:'Area "two"',zh:'二区'}]);
  assert.deepEqual(parseLabelTable('{"1":"Motor"}','json'),[{id:1,name:'Motor'}]);
  assert.throws(()=>parseLabelTable('id,name\n1,a\n1,b'),/labels-invalid-table/);
});
test('custom registry notifies local subscribers, stores typed data and removes entries',async()=>{
  let notices=0;const unsubscribe=subscribeCustomVolumes(()=>notices++);
  const volume=await parseNifti(exportNifti(source));const id=registerCustomVolume(volume,{id:'custom-test',name:'Test'});
  assert.equal(getCustomVolume(id).name,'Test');assert.equal(getCustomVolume(id).data,volume.data);assert.ok(listCustomVolumes().some(v=>v.id===id));
  assert.equal(removeCustomVolume(id),true);assert.equal(getCustomVolume(id),null);assert.equal(notices,2);unsubscribe();
});

test('scaled decode admission precedes allocation',async()=>{
  for(const scaled of [false,true]){
    const header=edit(exportNifti(source).slice(0,352),v=>{
      for(const [offset,n] of [[42,400],[44,400],[46,400]])v.setInt16(offset,n,true);
      v.setInt16(70,scaled?2:64,true);v.setInt16(72,scaled?8:64,true);v.setFloat32(112,scaled?2:1,true);
    });
    let allocations=0;const Original=globalThis.Float64Array;
    globalThis.Float64Array=class extends Original {constructor(...args){allocations++;super(...args);}};
    try {await assert.rejects(parseNifti(header,{maxDecodedVoxelBytes:256*1024*1024-352}),/decoded-budget/);assert.equal(allocations,0);}
    finally {globalThis.Float64Array=Original;}
    await assert.rejects(parseNifti(gzipSync(header)),/decoded-budget/);
  }
});

test('gzip header admission cancels before the rest of an injected stream is read',async()=>{
  const header=edit(exportNifti(source).slice(0,352),v=>{v.setInt16(42,400,true);v.setInt16(44,400,true);v.setInt16(46,400,true);v.setFloat32(112,2,true);});
  const Original=globalThis.DecompressionStream;let reads=0,cancelled=false;
  globalThis.DecompressionStream=class {constructor(){return {readable:new ReadableStream({pull(controller){reads++;controller.enqueue(header);},cancel(){cancelled=true;}}),writable:new WritableStream()};}};
  try {await assert.rejects(parseNifti(Uint8Array.of(31,139)),/decoded-budget/);assert.equal(cancelled,true);assert.ok(reads<=2);}
  finally {globalThis.DecompressionStream=Original;}
});

test('inflated stream budget and metadata reject before decoding or registration',async()=>{
  await assert.rejects(parseNifti(gzipSync(exportNifti(source)),{maxInflatedBytes:352}),/inflated-budget/);
  await assert.rejects(parseNifti(exportNifti(source),{name:'x'.repeat(501)}),/name-too-long/);
  assert.throws(()=>parseLabelTable(`id,name\n1,${'x'.repeat(2001)}`),/label-name-too-long/);
  assert.throws(()=>parseLabelTable(`id,name\n1,${'x'.repeat(2000)} `),/label-name-too-long/);
  assert.throws(()=>parseLabelTable(' '.repeat(2*1024*1024+1)),/label-file-budget/);
  const json='[{"id":1,"name":"x"}]';
  assert.deepEqual(parseLabelTable(json+' '.repeat(2*1024*1024-json.length),'json'),[{id:1,name:'x'}]);
  assert.throws(()=>parseLabelTable(json+' '.repeat(2*1024*1024-json.length+1),'json'),/label-file-budget/);
});

test('inflated header admission stops a split stream before its data payload',async()=>{
  const Original=globalThis.DecompressionStream;let cancelled=false,payloadReads=0;
  const header=exportNifti(source).slice(0,352);
  globalThis.DecompressionStream=class {constructor(){let sent=false;return {readable:new ReadableStream({pull(controller){if(!sent){sent=true;controller.enqueue(header);}else{payloadReads++;controller.enqueue(Uint8Array.of(0));}},cancel(){cancelled=true;}},{highWaterMark:0}),writable:new WritableStream()};}};
  try{await assert.rejects(parseNifti(Uint8Array.of(31,139),{maxInflatedBytes:352}),/inflated-budget/);assert.equal(payloadReads,0);assert.equal(cancelled,true);}
  finally{globalThis.DecompressionStream=Original;}
});

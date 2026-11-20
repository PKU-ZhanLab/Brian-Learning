import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { makeAssetIdentity, makeComputationManifest, compareComputationManifest, exportComparisonBundle, prepareLocalVolumeProvenance, prepareComparisonManifest } from './computation-manifest.js';
import { compareROIs, serializableVolume, normalizeROISelection } from './roi.js';

const grid={shape:[2,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],space:'MNI152NLin6Asym',order:'x-fastest'};
const identity=n=>({id:`input-${n}`,version:'v1',sha256:String(n).repeat(64),spaceId:grid.space});
const fixture=()=>({appVersion:'4.1.0',algorithmVersion:'roi-v2',inputs:[identity(1),identity(2)],transforms:[{id:'warp',sha256:'a'.repeat(64)}],sourceGrids:[grid,grid],targetGrid:grid,interpolation:['nearest-neighbour','trilinear'],thresholds:[{kind:'label',threshold:0,tail:'positive'},{kind:'probability',threshold:.5,tail:'positive'}],labelSets:[[87,91,87],[]]});
function parseCSV(text){return text.trim().split('\r\n').map(row=>{const cells=[];let cell='',quoted=false;for(let i=0;i<row.length;i++){const c=row[i];if(c==='"'){if(quoted&&row[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(cell);cell='';}else cell+=c;}assert.equal(quoted,false);return [...cells,cell];});}

test('asset hashes are exact raw bytes; unknown space remains null',async()=>{
  const bytes=new Uint8Array([0,1,254,255]);
  const result=await makeAssetIdentity(bytes,{id:'file',version:'v1',spaceId:null});
  assert.equal(result.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(result.spaceId,null);
});
test('manifest rejects missing hashes/spaces/chains and freezes a defensive normalized copy',()=>{
  const source=fixture(),manifest=makeComputationManifest(source);source.inputs[0].version='changed';
  assert.equal(manifest.inputs[0].version,'v1');assert.ok(Object.isFrozen(manifest.inputs[0]));assert.deepEqual(manifest.labelSets,[[87,91],[]]);
  for(const mutate of [x=>delete x.inputs[0].sha256,x=>x.inputs[0].spaceId=null,x=>delete x.transforms,x=>x.sourceGrids.pop(),x=>delete x.sourceGrids[0].space]){const x=structuredClone(fixture());mutate(x);assert.throws(()=>makeComputationManifest(x));}
});
test('same name and URL cannot hide byte/version/space/transform/grid/threshold or operand changes',()=>{
  const saved=makeComputationManifest(fixture());
  for(const mutate of [x=>x.inputs[0].sha256='b'.repeat(64),x=>x.inputs[0].version='v2',x=>x.inputs[0].spaceId='other',x=>x.transforms[0].sha256='c'.repeat(64),x=>x.inputs.reverse(),x=>x.targetGrid.affine[3]=1,x=>x.thresholds[1].tail='absolute']){const current=structuredClone(saved);mutate(current);assert.equal(compareComputationManifest(saved,current).matches,false);}
  const reordered=structuredClone(saved);reordered.labelSets[0]=[91,87,91];assert.equal(compareComputationManifest(saved,reordered).matches,true);
});
test('JSON and CSV export preserve the exact manifest and every original metric including sampling',()=>{
  const manifest=makeComputationManifest(fixture());const result={metrics:{dice:2/3,aVoxels:7},probabilityMetrics:{massA:.123456789},sampling:{A:{lostLabelIds:[134],status:'empty-target'},B:{status:'retained'}}};
  const bundle=exportComparisonBundle(result,manifest),json=JSON.parse(bundle.json);
  assert.equal(json.schema,'neuroatlas-computation-v1');assert.deepEqual(json.manifest,manifest);assert.deepEqual(json.metrics,result.metrics);assert.deepEqual(json.sampling,result.sampling);
  const rows=parseCSV(bundle.csv).slice(1);
  for(const field of ['manifest','metrics','probabilityMetrics','sampling'])assert.deepEqual(JSON.parse(rows.find(([key])=>key===field)[1]),json[field]);
});
test('local original and explicitly little endian derived volume identities survive worker serialization and deterministic recompute',async()=>{
  const base={...grid,kind:'probability',dtype:'float32',data:Float32Array.from([.25,.75]),canOverlayOnTarget:true,alignmentStatus:'user-declared',custom:true};
  const a=await prepareLocalVolumeProvenance(base,new Uint8Array([31,139,8,42]),{id:'original.nii.gz'});
  assert.equal(a.identity.sha256,createHash('sha256').update(new Uint8Array(new Float32Array([.25,.75]).buffer)).digest('hex'));
  assert.notEqual(a.sourceIdentities[0].sha256,a.identity.sha256);
  const wire=structuredClone(serializableVolume(a));assert.deepEqual(wire.identity,a.identity);assert.deepEqual(wire.sourceIdentities,a.sourceIdentities);assert.deepEqual(wire.transforms,[]);assert.deepEqual(wire.sourceGrid,grid);
  const manifest=await prepareComparisonManifest(a,normalizeROISelection(a,{threshold:.5}),a,normalizeROISelection(a,{threshold:.25}),grid);
  const first=compareROIs(a,{threshold:.5},a,{threshold:.25},grid,{manifest});
  const second=compareROIs(wire,{threshold:.5},wire,{threshold:.25},grid,{manifest:structuredClone(manifest)});
  assert.deepEqual(second.manifest,manifest);assert.deepEqual(second.metrics,first.metrics);assert.deepEqual(second.probabilityMetrics,first.probabilityMetrics);
  assert.throws(()=>compareROIs(a,{threshold:.6},a,{threshold:.25},grid,{manifest}),/manifest-mismatch/);
  assert.throws(()=>compareROIs(a,{threshold:.5},a,{threshold:.25},grid,{manifest:{...manifest,algorithmVersion:'old-algorithm'}}),/manifest-mismatch/);
  a.data[0]=.5;
  await assert.rejects(prepareComparisonManifest(a,normalizeROISelection(a,{threshold:.5}),a,normalizeROISelection(a,{threshold:.25}),grid),/digest/);
});
test('actual loaded bytes receive verified identity; corruption cannot borrow the expected hash',async()=>{
  const original=globalThis.fetch;
  const {atlasResourceKey,retry}=await import('./atlas-resource.js');const keys=[];
  let corrupt=false,corruptTransform=false;
  globalThis.fetch=async url=>{
    const path=String(url).replace(/^.*?data\//,'');const bytes=fs.readFileSync(new URL(`../../public/data/${path}`,import.meta.url));
    if(path.endsWith('.json'))return {ok:true,json:async()=>JSON.parse(bytes)};
    const copied=Uint8Array.from(bytes);if(corrupt&&path==='dk-v2/dk68.bin')copied[0]^=1;
    if(corruptTransform&&path==='aal-v3/sources/colin27-to-fsl-dipy.npz')copied[0]^=1;
    return {ok:true,arrayBuffer:async()=>copied.buffer};
  };
  try{
    const {loadAtlas}=await import('./volume.js');const loaded=await loadAtlas('dk');
    assert.equal(loaded.identity.sha256,loaded.sha256);assert.equal(loaded.identityVerification,'received-bytes');assert.ok(loaded.sourceIdentities.length);assert.deepEqual(loaded.transforms,[]);
    keys.push(atlasResourceKey(loaded.identity));corrupt=true;
    const failedBytes=await retry(keys[0]);assert.equal(failedBytes.status,'error');assert.equal(failedBytes.value,null);assert.match(failedBytes.error,/hash|digest|byte/i);
    await assert.rejects(loadAtlas('dk'),/hash|digest|byte/i);
    const registered=await loadAtlas('aal3-registered');keys.push(atlasResourceKey(registered.identity));corruptTransform=true;
    const failedTransform=await retry(keys[1]);assert.equal(failedTransform.status,'error');assert.equal(failedTransform.value,null);assert.match(failedTransform.error,/digest/);
    await assert.rejects(loadAtlas('aal3-registered'),/digest/);
  }finally{corrupt=false;corruptTransform=false;for(const key of keys)assert.equal((await retry(key)).status,'ready');globalThis.fetch=original;}
});

test('project entries reuse the canonical asset grid and transform validators without a synthetic manifest',async()=>{
 const api=await import('./computation-manifest.js');assert.equal(typeof api.validateAssetIdentity,'function');assert.equal(typeof api.validateGridSpec,'function');assert.equal(typeof api.validateTransformIdentity,'function');assert.deepEqual(api.validateAssetIdentity(identity(1)),identity(1));assert.deepEqual(api.validateGridSpec(grid),grid);assert.deepEqual(api.validateTransformIdentity({id:'warp',sha256:'a'.repeat(64)}),{id:'warp',sha256:'a'.repeat(64)});assert.throws(()=>api.validateAssetIdentity({...identity(1),sha256:'bad'}),/asset-identity-required/);assert.throws(()=>api.validateGridSpec({...grid,order:'unknown'}),/manifest-grid-required/);
});

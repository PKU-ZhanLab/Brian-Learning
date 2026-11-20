import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAtlas, loadAtlasVersion, makeSliceCanvas, prepareVolume } from './volume.js';
import { makeAtlasRegionRef } from './atlas-identity.js';
import { createHash } from 'node:crypto';
import {prepareLocalVolumeProvenance} from './computation-manifest.js';
import {registerCustomVolume,removeCustomVolume} from './custom-volumes.js';
import {queryableAtlasVolume} from './query-state.js';

test('slice rendering overlays aligned atlas voxels and leaves unavailable space uncoloured', () => {
  const original = globalThis.document;
  let drawn;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}),
    putImageData: image => { drawn = image.data; },
  }) }) };
  try {
    const metadata = {shape:[1,1,1],affine:[2,0,0,0,0,2,0,20,0,0,2,20,0,0,0,1]};
    const t1 = prepareVolume(new Uint8Array([100]),metadata);
    const atlas = prepareVolume(new Uint8Array([1]),{...metadata,canOverlayOnTarget:true});
    makeSliceCanvas(t1,'z',20,{size:3,atlasVolume:atlas});
    const q=(1*3+1)*4;
    assert.notEqual(drawn[q],drawn[q+2],'a labelled voxel must have a visible atlas colour');
    assert.deepEqual([...drawn.slice(0,3)],[0,0,0],'background must not acquire an atlas label');
    makeSliceCanvas(t1,'z',20,{size:3,atlasVolume:{...atlas,canOverlayOnTarget:false}});
    assert.deepEqual([...drawn.slice(q,q+3)],[100,100,100],'unverified atlas space must not be overlaid');
    makeSliceCanvas(t1,'z',20,{size:3});
    assert.deepEqual([...drawn.slice(q,q+3)],[100,100,100],'MRI-only callers must retain grayscale');
  } finally { globalThis.document=original; }
});
test('imported sources use their verified asset identity without fabricating a source atlas release',async()=>{
  const local=await prepareLocalVolumeProvenance(prepareVolume(new Uint8Array([1]),{shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],space:'MNI152NLin6Asym',canOverlayOnTarget:true}),new Uint8Array([7]),{id:'custom-s3-source'});
  const id=registerCustomVolume(local,{id:'custom-s3-source'});
  const unknown=await prepareLocalVolumeProvenance(prepareVolume(new Uint8Array([2]),{shape:[1,1,1],affine:local.affine,space:'native-unverified',canOverlayOnTarget:true}),new Uint8Array([8]),{id:'custom-s3-unknown'});
  const unknownId=registerCustomVolume(unknown,{id:'custom-s3-unknown'});
  try{
    const loaded=await loadAtlas(id);
    assert.equal(loaded.atlasVersion,local.identity.version);assert.equal(loaded.spaceId,local.identity.spaceId);
    assert.deepEqual(loaded.identity,local.identity);assert.strictEqual(queryableAtlasVolume(loaded,id,local.identity),loaded);
    assert.equal(loaded.sampleRAS(0,0,0),1);
    const independent=await loadAtlas(unknownId);assert.equal(independent.spaceId,null);
    assert.deepEqual(independent.identity,unknown.identity);assert.equal(queryableAtlasVolume(independent,unknownId,unknown.identity),null);
  }finally{removeCustomVolume(id);removeCustomVolume(unknownId);}
});

test('atlas cache separates version, content digest and declared space while preserving source metadata', async () => {
  const original = globalThis.fetch;
  const source = { sourceUrl:'https://example.org/source-labels',sourceLocator:'labels.tsv:1; 8121; Temporal_Pole_Sup_L' };
  const metadata = { available:true,atlasId:'identity-fixture',atlasVersion:'v1',sha256:'a'.repeat(64),spaceId:'native-s1',space:'native-s1',spaceIdentitySource:{...source,spaceId:'native-s1'},data:'same-filename.bin',shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],dtype:'uint16',order:'x-fastest',labels:[{ id:8121,name:'Temporal_Pole_Sup_L',hemisphere:'L',tissue:'unknown',labelMetadataSource:source }] };
  const manifest = { atlases:{ 'identity-fixture':metadata,'identity-other':{...metadata,atlasId:'identity-other'} } };
  let downloads = 0;
  let bytes = new Uint16Array([8121]);
  const digest = () => createHash('sha256').update(new Uint8Array(bytes.buffer)).digest('hex');
  metadata.sha256 = manifest.atlases['identity-other'].sha256 = digest();
  globalThis.fetch = async url => String(url).endsWith('asset-identities.json') ? {ok:true,json:async()=>({assets:{}})} : String(url).endsWith('manifest.json')
    ? { ok:true,json:async () => manifest }
    : { ok:true,arrayBuffer:async () => { downloads++; return bytes.buffer; } };
  try {
    const first = await loadAtlas('identity-fixture');
    assert.equal(makeAtlasRegionRef('identity-fixture', first, 8121).labelId, 8121);
    assert.equal(first.atlasId, 'identity-fixture');
    assert.strictEqual(await loadAtlasVersion(first.identity),first);
    await assert.rejects(loadAtlasVersion({...first.identity,version:'unavailable-version'}),/identity|version/i);
    assert.strictEqual(await loadAtlas('identity-fixture'), first);
    assert.equal(downloads, 1);
    metadata.atlasVersion = 'v2';
    const nextVersion = await loadAtlas('identity-fixture');
    assert.notStrictEqual(nextVersion, first);
    assert.equal(first.atlasVersion, 'v1');
    const cancelled=new AbortController();cancelled.abort();
    await assert.rejects(loadAtlasVersion(nextVersion.identity,{signal:cancelled.signal}),/abort/i);
    bytes = new Uint16Array([8122]);
    metadata.sha256 = digest();
    const nextBytes = await loadAtlas('identity-fixture');
    assert.notStrictEqual(nextBytes, nextVersion);
    metadata.spaceId = metadata.space = 'registered-s1';
    const nextSpace = await loadAtlas('identity-fixture');
    assert.notStrictEqual(nextSpace, nextBytes);
    assert.equal(nextSpace.spaceId, 'registered-s1');
    manifest.atlases['identity-other'].sha256 = digest();
    assert.notStrictEqual(await loadAtlas('identity-other'), nextSpace);
    assert.equal(downloads, 5);
    assert.equal(first.sampleRAS(0,0,0), 8121);
    metadata.atlasVersion = 'corruption';
    bytes = new Uint16Array([8123]);
    await assert.rejects(loadAtlas('identity-fixture'), /digest/);
  } finally { globalThis.fetch = original; }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { beginQuery, invalidateQuery, acceptQueryResult, queryableAtlasVolume, queryDisplayState } from './query-state.js';

const context={atlasId:'aal',atlasVersion:'v1',coordinate:[-38.125,-20.5,54.75],method:'voxel',requestId:4};
const sourceAsset={id:'aal',version:'v1',sha256:'a'.repeat(64),spaceId:'native'};
const result={region:{atlasId:'aal',atlasVersion:'v1',labelId:8121,hemisphere:'L',spaceId:'native'},observedHemisphere:'L',sourceAsset,mapping:'voxel',spaceId:'native'};
test('begin and invalidate replace the previous result without rounding or retaining mutable inputs',()=>{
  const ready=acceptQueryResult(beginQuery(null,context),context,result);
  assert.equal(ready.status,'ready');
  const next=beginQuery(ready,{...context,requestId:5});
  assert.equal(next.result,null);assert.equal(next.error,null);
  assert.deepEqual(next.context.coordinate,[-38.125,-20.5,54.75]);
  assert.notStrictEqual(next.context.coordinate,context.coordinate);
  assert.deepEqual(invalidateQuery(ready,'coordinate changed'),{status:'idle',context:null,result:null,error:null});
});
test('late request, atlas, version, coordinate, method, source and space never replace the active query',()=>{
  const current=beginQuery(null,context);
  for(const change of [{requestId:3},{atlasId:'dk'},{atlasVersion:'v2'},{coordinate:[-38,-20.5,54.75]},{method:'surface'}])
    assert.strictEqual(acceptQueryResult(current,{...context,...change},result),current);
  for(const change of [{spaceId:'other'},{sourceAsset:{...sourceAsset,version:'v2'}},{sourceAsset:{...sourceAsset,spaceId:null}},{region:{...result.region,atlasId:'dk'}},{region:{...result.region,spaceId:'other'}}])
    assert.strictEqual(acceptQueryResult(current,context,{...result,...change}),current);
  assert.strictEqual(acceptQueryResult(invalidateQuery(current,'changed'),context,result).result,null);
});
test('background is an accepted empty region, never a nearby label',()=>{
  const ready=acceptQueryResult(beginQuery(null,context),context,{...result,region:null});
  assert.equal(ready.status,'ready');assert.equal(ready.result.region,null);
});
test('queryable volumes require the complete current identity and a known target space',()=>{
  const identity={id:'public/data/atlas.bin',version:'v1',sha256:'a'.repeat(64),spaceId:'MNI152NLin6Asym'};
  const volume={identity,atlasId:'aal',atlasVersion:'v1',spaceId:identity.spaceId,canOverlayOnTarget:true};
  assert.strictEqual(queryableAtlasVolume(volume,'aal',identity),volume);
  for(const change of [{id:'other'},{version:'v2'},{sha256:'b'.repeat(64)},{spaceId:'other'}])assert.equal(queryableAtlasVolume(volume,'aal',{...identity,...change}),null);
  assert.equal(queryableAtlasVolume(volume,'dk',identity),null);
  assert.equal(queryableAtlasVolume({...volume,canOverlayOnTarget:false},'aal',identity),null);
  const unknown={...identity,spaceId:'MNI-unspecified'};
  assert.equal(queryableAtlasVolume({...volume,spaceId:unknown.spaceId,identity:unknown},'aal',unknown),null);
});
test('an idle query with a ready volume cannot be displayed as loading or completed background',()=>{
  const ready=acceptQueryResult(beginQuery(null,context),context,result);
  const source={resourceStatus:'ready',hasVolume:true};
  const displayed=queryDisplayState(ready,source);
  assert.equal(displayed.status,'ready');assert.strictEqual(displayed.result,result);
  const idle=queryDisplayState(invalidateQuery(ready,'intentional clear'),source);
  assert.deepEqual(idle,{status:'idle',result:null});
  assert.deepEqual(queryDisplayState(null,source),idle);
  assert.deepEqual(queryDisplayState({...ready,result:null},source),idle);
  const background=acceptQueryResult(beginQuery(null,context),context,{...result,region:null,label:null});
  assert.equal(queryDisplayState(background,source).status,'ready');
  assert.equal(queryDisplayState(background,source).result.region,null);
});
test('query presentation keeps pending, failed and blocked source states distinct',()=>{
  assert.deepEqual(queryDisplayState(null,{resourceStatus:'loading',hasVolume:false}),{status:'loading',result:null});
  assert.deepEqual(queryDisplayState(null,{resourceStatus:'error',hasVolume:false}),{status:'error',result:null});
  assert.deepEqual(queryDisplayState(beginQuery(null,context),{resourceStatus:'ready',hasVolume:true}),{status:'loading',result:null});
  const ready=acceptQueryResult(beginQuery(null,context),context,result);
  assert.deepEqual(queryDisplayState(ready,{blocked:true,resourceStatus:'ready',hasVolume:true}),{status:'idle',result:null});
});

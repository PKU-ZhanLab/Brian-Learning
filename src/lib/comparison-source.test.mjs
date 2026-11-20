import test from 'node:test';
import assert from 'node:assert/strict';
import * as comparison from './comparison-link.js';

const identity={id:'custom-empty:derived:float32:little-endian',version:'v1',sha256:'a'.repeat(64),spaceId:null};
const source={identity};
const selection=()=>({assetId:'custom-empty',identity:null,labels:[],threshold:.5,tail:'positive',point:[0,0,0],camera:null});
const context=resetGeneration=>({epoch:0,key:'same-S3-resource',resetGeneration});

test('same-ID reset of an empty default selection changes the actual loading request key',()=>{
  const value=selection();
  assert.notEqual(comparison.comparisonSourceRequestKey(value,context(0)),comparison.comparisonSourceRequestKey(value,context(1)));
  assert.equal(comparison.comparisonSourceRequestKey(value,context(1)),comparison.comparisonSourceRequestKey({...value,identity},context(1)),'resolved identity alone must not reload');
});
test('same-ID empty-source reset reloads, retires the old request and accepts subsequent point edits',async()=>{
  let loads=0;const loader=comparison.createComparisonSourceLoader(async()=>{loads++;return source;});
  const first=await loader.run(selection());assert.equal(first.isCurrent(),true);
  loader.cancel();const reset=await loader.run(selection());assert.equal(loads,2);assert.equal(first.isCurrent(),false);assert.equal(reset.isCurrent(),true);
  const left={...selection(),identity:reset.volume.identity},right={...selection(),assetId:'another',identity:null};
  const state={left,right,linkCamera:false,linkCrosshair:false};
  assert.deepEqual(comparison.updateComparison(state,'left','point',[1.25,2.5,3.75],{left:reset.volume,right:null}).left.point,[1.25,2.5,3.75]);
});
test('explicit same-ID reset recovers saved identity mismatch with empty labels/default settings',async()=>{
  let loads=0;const loader=comparison.createComparisonSourceLoader(async()=>{loads++;return source;}),saved={...selection(),identity:{...identity,sha256:'b'.repeat(64)}};
  await assert.rejects(loader.run(saved),/comparison-source-identity-mismatch/);
  const reset=selection();assert.notEqual(comparison.comparisonSourceRequestKey(saved,context(0)),comparison.comparisonSourceRequestKey(reset,context(1)));
  const accepted=await loader.run(reset);assert.equal(loads,2);assert.equal(accepted.volume,source);assert.equal(accepted.isCurrent(),true);
});
test('cancelled or superseded same-ID loads cannot publish a late source',async()=>{
  const releases=[],loader=comparison.createComparisonSourceLoader(()=>new Promise(resolve=>releases.push(resolve)));
  const old=loader.run(selection());loader.cancel();const current=loader.run(selection());
  releases[1](source);const accepted=await current;releases[0](source);
  assert.equal(await old,null);assert.equal(accepted.isCurrent(),true);loader.cancel();assert.equal(accepted.isCurrent(),false);
});

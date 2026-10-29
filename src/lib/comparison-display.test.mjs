import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVolume,atlasLabelAt} from './volume.js';
import {prepareComparisonDisplay} from './comparison-display.js';

const affine=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const identity={id:'scalar-source',version:'v1',sha256:'a'.repeat(64),spaceId:null};
const volume=(kind,data)=>prepareVolume(Float32Array.from(data),{kind,shape:[data.length,1,1],affine,identity,space:'native-unverified'});

test('thresholded slice samplers and crosshair labels use membership for every statistical tail',()=>{
  const raw=volume('statistic',[-3,3,1]);
  for(const [tail,expected] of [['positive',[0,1,0]],['negative',[1,0,0]],['absolute',[1,1,0]]]){
    const display=prepareComparisonDisplay(raw,{threshold:3,tail});
    assert.deepEqual(expected.map((_,x)=>display.sampleRAS(x,0,0)),expected,tail);
    assert.deepEqual(expected.map((_,x)=>atlasLabelAt(display,[x,0,0])?.value??null),expected.map(v=>v||null),tail);
    assert.equal(atlasLabelAt(display,[2,0,0]),null,'excluded +1 must never be labelled or overlaid');
    assert.equal(display.sourceIdentity,raw.identity);
    assert.equal(display.identity,undefined,'membership bytes do not inherit the raw source digest');
  }
  assert.deepEqual([0,1,2].map(x=>raw.sampleRAS(x,0,0)),[-3,3,1]);
  assert.equal(raw.identity,identity);
});
test('probability and mask display samplers bind thresholded labels while retaining the raw source',()=>{
  for(const [kind,values,threshold,expected] of [['probability',[.25,.75,1],.75,[0,1,1]],['mask',[0,1,1],.5,[0,1,1]]]){
    const raw=volume(kind,values),display=prepareComparisonDisplay(raw,{threshold,tail:'positive'});
    assert.deepEqual(values.map((_,x)=>display.sampleRAS(x,0,0)),expected,kind);
    assert.deepEqual(values.map((_,x)=>atlasLabelAt(display,[x,0,0])?.value??null),expected.map(v=>v||null),kind);
    assert.deepEqual(values.map((_,x)=>raw.sampleRAS(x,0,0)),values);
  }
});
test('original integer label volumes retain their exact sampler and identity',()=>{
  const raw=volume('label',[7,42]);
  assert.equal(prepareComparisonDisplay(raw,{threshold:.5}),raw);
  assert.equal(atlasLabelAt(raw,[1,0,0]).value,42);
});

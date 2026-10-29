import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCoordinateInput, stepCoordinate, coordinateOutsideBounds, formatCoordinate, coordinateNavigationSpace, coordinateReferenceSpace, nextCoordinateOrigin} from './coordinate-input.js';

const options={spaceId:'MNI152NLin6Asym',convention:'RAS',maxPoints:1000};
test('decimal RAS input survives single and batch paste without rounding or clamping',()=>{
  assert.deepEqual(parseCoordinateInput('-38.25, -20.5, 54.1',options),{points:[[-38.25,-20.5,54.1]],errors:[]});
  assert.deepEqual(parseCoordinateInput('-38.25 -20.5 54.1\n1000, 2000, -3000',options).points,[[-38.25,-20.5,54.1],[1000,2000,-3000]]);
  assert.equal(coordinateOutsideBounds([1000,0,0],{x:[-100,100],y:[-140,100],z:[-80,120]}),true);
});
test('LPS explicitly converts both horizontal axes into internal RAS',()=>{
  assert.deepEqual(parseCoordinateInput('[10,20,30]',{...options,convention:'LPS'}),{points:[[-10,-20,30]],errors:[]});
  assert.deepEqual(parseCoordinateInput('[[10,20,30],[-10.25,2.5,0]]',{...options,convention:'LPS'}).points,[[-10,-20,30],[10.25,-2.5,0]]);
});
test('missing space, invalid convention, empty, incomplete and nonfinite values have field errors',()=>{
  assert.equal(parseCoordinateInput('1,2,3',{...options,spaceId:null}).errors[0].field,'spaceId');
  assert.equal(parseCoordinateInput('1,2,3',{...options,convention:'LAS'}).errors[0].field,'convention');
  for(const value of ['', '1,2', '1,,3', '1,2,3,4', '1,NaN,3', 'Infinity,2,3', '1,0x10,3', '[1,null,3]']) {
    const result=parseCoordinateInput(value,options);assert.deepEqual(result.points,[],value);assert.equal(result.errors[0].field,'coordinates',value);
  }
  const batch=parseCoordinateInput('1,2,3\n4,NaN,6',options);
  assert.deepEqual(batch.points,[]);assert.equal(batch.errors[0].line,2);
});
test('exactly 1000 points are accepted; 1001 gives an explicit field error and no partial navigation',()=>{
  assert.equal(parseCoordinateInput(Array(1000).fill('1,2,3').join('\n'),options).points.length,1000);
  const result=parseCoordinateInput(Array(1001).fill('1,2,3').join('\n'),options);
  assert.deepEqual(result.points,[]);assert.equal(result.errors[0].code,'too-many-points');assert.equal(result.errors[0].field,'coordinates');
});
test('axis steps preserve other decimal axes, reject invalid steps and never clamp',()=>{
  assert.deepEqual(stepCoordinate([-38.25,-20.5,54.1],0,.1),[-38.15,-20.5,54.1]);
  assert.deepEqual(stepCoordinate([100,0,0],0,1),[101,0,0]);
  assert.equal(stepCoordinate([.1234567890123456,0,0],0,1e-16)[0],.1234567890123456+1e-16);
  assert.throws(()=>stepCoordinate([1,2,3],0,NaN));
  assert.throws(()=>stepCoordinate([1,2,3],4,1));
});
test('copy text carries the exact reference, RAS convention and full decimal values',()=>{
  assert.equal(formatCoordinate([-38.25,-20.5,54.1],'Colin27 / MNI single-subject'),'Colin27 / MNI single-subject · RAS · -38.25, -20.5, 54.1 mm');
});
test('only the canonical reference enters the main context; a typed internal sentinel stays independent',()=>{
  assert.equal(coordinateNavigationSpace('MNI152NLin6Asym'),'brain');
  assert.equal(coordinateReferenceSpace('brain'),'MNI152NLin6Asym');
  assert.notEqual(coordinateNavigationSpace('brain'),'brain');
  assert.equal(coordinateReferenceSpace(coordinateNavigationSpace('brain')),'brain');
  assert.notEqual(coordinateNavigationSpace('brain'),coordinateNavigationSpace('independent:brain'));
  for(const reference of ['MNI','MNI unspecified','Colin27 / MNI single-subject','unknown','brain','independent:brain','independent:independent:brain',null]){
    assert.notEqual(coordinateNavigationSpace(reference),'brain');assert.equal(coordinateReferenceSpace(coordinateNavigationSpace(reference)),reference);
  }
});
test('new manual points release coordinate provenance without clearing an earlier private camera taint',()=>{
  const manual={kind:'manual',cameraSensitive:false,imported:false};
  const privateOrigin=nextCoordinateOrigin(manual,{kind:'private',cameraSensitive:false});assert.equal(privateOrigin.kind,'private');assert.equal(privateOrigin.cameraSensitive,true);
  const entered=nextCoordinateOrigin(privateOrigin,{kind:'manual',cameraSensitive:false,imported:false});assert.equal(entered.kind,'manual');assert.equal(entered.cameraSensitive,true);assert.equal(entered.imported,false);
  const stepped=nextCoordinateOrigin(privateOrigin,privateOrigin);assert.equal(stepped.kind,'private');assert.equal(stepped.cameraSensitive,true);
  const reset={...privateOrigin,cameraSensitive:false};assert.equal(nextCoordinateOrigin(reset,{kind:'manual'}).cameraSensitive,false);
});

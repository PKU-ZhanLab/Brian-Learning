import test from 'node:test';
import assert from 'node:assert/strict';
import {assignSelectionToOperand} from './selection-handoff.js';
const ref=(labelId,extra={})=>({atlasId:'aal3-registered',atlasVersion:'v1',spaceId:'MNI152NLin6Asym',hemisphere:'U',labelId,...extra});
test('two source labels replace only A and preserve every B field and shared setting',()=>{
  const previous={aAtlas:'dk',aLabels:[1],aThreshold:.3,aTail:'negative',bAtlas:'custom-stat',bLabels:[9],bRegionRefs:[],bThreshold:2.75,bTail:'absolute',resolutionMm:1,display:{mode:'B',opacityB:.27},computed:true,snapshot:'original'};
  const before=structuredClone(previous),next=assignSelectionToOperand(previous,{side:'A',regions:[ref(134),ref(133),ref(134)]});
  assert.deepEqual(next.aLabels,[134,133]);assert.deepEqual(next.aRegionRefs,[ref(134),ref(133)]);
  for(const key of ['bAtlas','bLabels','bRegionRefs','bThreshold','bTail','resolutionMm','display'])assert.deepEqual(next[key],before[key]);
  assert.equal(next.aThreshold,.3);assert.equal(next.aTail,'negative');assert.equal(next.snapshot,'none');assert.equal(next.computed,false);assert.deepEqual(previous,before);
});
test('a raw operand cannot silently combine atlases, versions or spaces',()=>{
  for(const extra of [{atlasId:'dk'},{atlasVersion:'v2'},{spaceId:'Colin27'}])assert.throws(()=>assignSelectionToOperand({}, {side:'B',regions:[ref(1),ref(2,extra)]}),/selection-source-mismatch/);
  assert.throws(()=>assignSelectionToOperand({}, {side:'C',regions:[ref(1)]}),/operand-side/);
  assert.throws(()=>assignSelectionToOperand({}, {side:'A',regions:[]}),/selection-empty/);
});
test('add uses complete identity and refuses a foreign or unresolved current collection',()=>{
  const previous={aAtlas:'aal3-registered',aLabels:[134],aRegionRefs:[ref(134)],bThreshold:9};
  assert.deepEqual(assignSelectionToOperand(previous,{side:'A',regions:[ref(133)],mode:'add'}).aLabels,[134,133]);
  assert.throws(()=>assignSelectionToOperand(previous,{side:'A',regions:[ref(133,{atlasVersion:'v2'})],mode:'add'}),/selection-source-mismatch/);
  assert.throws(()=>assignSelectionToOperand({...previous,aRegionRefs:[]},{side:'A',regions:[ref(133)],mode:'add'}),/selection-unresolved/);
  assert.throws(()=>assignSelectionToOperand({...previous,aAtlas:'dk'},{side:'A',regions:[ref(133)],mode:'add'}),/selection-unresolved/);
});

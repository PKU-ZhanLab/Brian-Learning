import test from 'node:test';
import assert from 'node:assert/strict';
import * as selection from './result-coordinate-selection.js';
import {migrateEvidence,getResultViewModel} from './evidence-schema.js';
import {resolveResultLayers} from './result-layers.js';
import {validateEvidence} from './evidence-workspace.js';
import {syntheticUnknownResultEvidence,syntheticMixedResultEvidence,syntheticResultLayers,preflightResultLayerProject} from '../../tests/fixtures/result-layer-fixtures.mjs';

const evidence=migrateEvidence({schema:'brain-evidence-v1',references:[{id:'paper',title:'Synthetic mixed-space paper',url:'https://example.org/a'}],results:[{id:'mixed-result',referenceId:'paper',finding:'Synthetic mixed-space finding',condition:'task',sample:'n=2',roiDefinition:'table',direction:'positive',annotator:'unknown',limitations:'synthetic',regionIds:[],curationStatus:'draft',modalities:['fmri'],sourceUrl:'https://example.org/a',coordinates:[{id:'native',space:'subject-native',x:90,y:10,z:20},{id:'mni-a',space:'MNI152NLin6Asym',x:1.25,y:2,z:3},{id:'mni-b',space:'MNI152NLin6Asym',x:8.5,y:9,z:10}].map(point=>({...point,status:'source-checked',label:point.id,sourceTable:'1',sourceRow:point.id,frameNote:'explicit synthetic frame',sourceUrl:'https://example.org/a'})),figures:[]}],relations:[]}).value;
const result=()=>getResultViewModel('mixed-result',evidence);

test('a marker after an initial native or unknown point selects its own visible frame and row',()=>{
 assert.equal(typeof selection.selectResultCoordinate,'function','exact coordinate selection exists');
 for(const firstSpace of ['subject-native','MNI-unspecified']){
  const local=structuredClone(evidence);local.locations[0].sourceSpaceId=firstSpace;assert.equal(validateEvidence(local).valid,true);
  const value=getResultViewModel('mixed-result',local),before=structuredClone(value);
  const selected=selection.selectResultCoordinate(value,'mni-a');
  assert.deepEqual(selected,{resultId:'mixed-result',coordinateId:'mni-a',space:'MNI152NLin6Asym'});
  assert.deepEqual(value.coordinates.filter(point=>point.space===selected.space).map(point=>point.id),['mni-a','mni-b']);
  assert.deepEqual(value,before,'selection does not change reported frames or scientific records');
 }
});

test('clicking a second marker in the same result replaces the selected row without changing its frame',()=>{
 assert.equal(typeof selection.selectResultCoordinate,'function','exact coordinate selection exists');
 const value=result(),first=selection.selectResultCoordinate(value,'mni-a'),second=selection.selectResultCoordinate(value,'mni-b');
 assert.equal(first.coordinateId,'mni-a');assert.equal(second.coordinateId,'mni-b');assert.equal(second.space,first.space);
 const reopened=selection.selectResultCoordinate(result(),second.coordinateId);assert.deepEqual(reopened,second,'source-paper return can reconstruct the selection from the transient coordinate ID');
});

test('defensive null selection never borrows another frame, while E2 correctly rejects a null Location source space',()=>{
 assert.equal(typeof selection.selectResultCoordinate,'function','exact coordinate selection exists');
 const local=structuredClone(evidence);local.locations[0].sourceSpaceId=null;
 assert.equal(validateEvidence(local).valid,false,'null is a defensive display edge, not an admissible Location frame');
 const value=getResultViewModel('mixed-result',local);value.coordinates=[value.coordinates[1],value.coordinates[0],value.coordinates[2]];
 assert.deepEqual(selection.selectResultCoordinate(value,'native'),{resultId:'mixed-result',coordinateId:'native',space:null});
});

test('an absent or foreign coordinate ID cannot select a stale point in a different result',()=>{
 assert.equal(typeof selection.selectResultCoordinate,'function','exact coordinate selection exists');
 assert.deepEqual(selection.selectResultCoordinate(result(),'foreign-point'),{resultId:'mixed-result',coordinateId:null,space:'subject-native'});
 assert.deepEqual(selection.selectResultCoordinate({id:'empty',coordinates:[]},'mni-a'),{resultId:'empty',coordinateId:null,space:null});
 assert.equal(selection.selectResultCoordinate(result()).coordinateId,null);
});

test('authored unknown and mixed-space browser fixtures pass evidence validation and normal transactional project admission',async()=>{
 for(const [projectId,local,layers] of [['unknown-fixture',syntheticUnknownResultEvidence(),[{...syntheticResultLayers()[0],spaceId:'MNI-unspecified'}]],['mixed-fixture',syntheticMixedResultEvidence(),[syntheticResultLayers()[0]]]]){
  const {stage}=await preflightResultLayerProject({projectId,evidence:local,view:{resultLayers:layers},volumes:[]});
  const model=getResultViewModel('private-result',stage.next.evidence);
  assert.equal(model.coordinates[0].space,'MNI-unspecified');
  const resolved=resolveResultLayers(stage.next.view.resultLayers,{evidence:stage.next.evidence});
  assert.equal(resolved.markers.length,projectId==='mixed-fixture'?2:0);
  if(projectId==='mixed-fixture')assert.equal(selection.selectResultCoordinate(model,'private-point-1').space,'MNI152NLin6Asym');
 }
});

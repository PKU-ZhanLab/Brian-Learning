import test from 'node:test';
import assert from 'node:assert/strict';
import * as controls from './result-layer-controls.js';
import {migrateEvidence,getResultViewModel} from './evidence-schema.js';
import {resolveResultLayers} from './result-layers.js';
import {validateViewState,encodeView,decodeView,serializeProject,parseProject} from './workspace-project.js';
import {stageProjectImport} from './workspace-session.js';

const evidence=migrateEvidence({schema:'brain-evidence-v1',references:[{id:'paper-a',title:'Paper A',url:'https://example.org/a'},{id:'paper-b',title:'Paper B',url:'https://example.org/b'}],results:[{id:'result-a',referenceId:'paper-a',finding:'Exact finding A',condition:'task',sample:'n=2',roiDefinition:'table',direction:'positive',annotator:'unknown',limitations:'synthetic',regionIds:[],curationStatus:'draft',modalities:['fmri'],sourceUrl:'https://example.org/a',coordinates:[{id:'peak-a',x:1.25,y:2,z:3,space:'MNI152NLin6Asym',status:'source-checked',label:'Peak A',sourceTable:'1',sourceRow:'1',frameNote:'explicit frame',sourceUrl:'https://example.org/a'}],figures:[]}],relations:[]}).value;
const layer=(layerId='layer-a')=>({layerId,resultId:'result-a',sourceReferenceId:'paper-a',coordinateIds:['peak-a'],spaceId:'MNI152NLin6Asym',visible:true,style:{}});
const view=()=>validateViewState({atlas:'aal3-registered',resultLayers:[layer(),layer('layer-second')],coordinate:[1.25,2,3],coordinateOrigin:{kind:'result',resultId:'result-a',sourceReferenceId:'paper-a',coordinateId:'peak-a',spaceId:'MNI152NLin6Asym',cameraSensitive:true,explorerSensitive:true},camera:{position:[1.25,2,99],target:[1.25,2,3],zoom:1},literature:{paperId:'paper-b'},roi:{computed:false,aLabels:[1],bLabels:[2]},atlasExplorer:{atlas:'aal',slices:{x:1.25,y:2,z:3}}});

test('layer controls change only authoritative layers after visiting another paper',()=>{
 assert.equal(typeof controls.editResultLayers,'function','layer actions are available');
 const before=view(),hidden=controls.editResultLayers(before,{type:'visibility',layerId:'layer-a',visible:false},{evidence});
 assert.equal(hidden.resultLayers[0].visible,false);assert.equal(hidden.resultLayers[1].visible,true);
 assert.deepEqual(resolveResultLayers(hidden.resultLayers,{evidence}).markers.map(m=>m.layerId),['layer-second']);
 const removed=controls.editResultLayers(hidden,{type:'remove',layerId:'layer-second'},{evidence});
 assert.deepEqual(removed.resultLayers.map(l=>l.layerId),['layer-a']);
 const cleared=controls.editResultLayers(removed,{type:'clear'},{evidence});assert.deepEqual(cleared.resultLayers,[]);
 for(const next of [hidden,removed,cleared])assert.deepEqual({...next,resultLayers:before.resultLayers},before,'atlas, paper, coordinates, ROI and both sensitivity flags survive');
 assert.equal(getResultViewModel(hidden.resultLayers[0].resultId,evidence).finding,'Exact finding A');
 assert.equal(before.resultLayers[0].visible,true,'actions never mutate the previous view');
});

test('clearing a private layer cannot release its coordinate, camera or explorer position into a public link',()=>{
 assert.equal(typeof controls.editResultLayers,'function','layer actions are available');
 const cleared=controls.editResultLayers(view(),{type:'clear'},{evidence});
 const {encoded,omitted}=encodeView(cleared,{evidence,publicReferenceIds:[]}),publicView=decodeView(encoded);
 assert.ok(omitted.includes('coordinate'));assert.equal(publicView.camera,null);assert.notDeepEqual(publicView.coordinate,cleared.coordinate);
 assert.doesNotMatch(JSON.stringify(publicView),/result-a|peak-a|paper-a/);
 assert.equal(cleared.coordinateOrigin.cameraSensitive,true);assert.equal(cleared.coordinateOrigin.explorerSensitive,true);
});

test('unknown/native layers remain independently readable and local layer edits round trip through W5/W6',async()=>{
 assert.equal(typeof controls.editResultLayers,'function','layer actions are available');
 const native=structuredClone(evidence);native.locations[0].sourceSpaceId='MNI-unspecified';
 const original={...view(),resultLayers:[{...layer(),spaceId:'MNI-unspecified'}]};
 const hidden=controls.editResultLayers(original,{type:'visibility',layerId:'layer-a',visible:false},{evidence:native});
 const shown=controls.editResultLayers(hidden,{type:'visibility',layerId:'layer-a',visible:true},{evidence:native});
 const resolved=resolveResultLayers(shown.resultLayers,{evidence:native});assert.deepEqual(resolved.markers,[]);assert.equal(resolved.unavailable[0].reason,'unavailable-space');
 const text=await serializeProject({projectId:'layers',view:shown,evidence:native,notes:[],volumes:[]}),restored=await parseProject(text);
 await stageProjectImport(text,{current:{projectId:'before-import',revision:0,view:validateViewState({}),evidence,volumes:[],notes:[],drafts:[]}});
 assert.deepEqual(restored.view.resultLayers,shown.resultLayers);assert.equal(getResultViewModel(restored.view.resultLayers[0].resultId,restored.evidence).finding,'Exact finding A');
});

test('invalid layer actions and inconsistent source references fail before changing the source view',()=>{
 assert.equal(typeof controls.editResultLayers,'function','layer actions are available');
 const before=view();
 assert.throws(()=>controls.editResultLayers(before,{type:'visibility',layerId:'layer-a',visible:'false'},{evidence}));
 assert.throws(()=>controls.editResultLayers(before,{type:'rename',layerId:'layer-a'},{evidence}));
 assert.throws(()=>controls.editResultLayers({...before,resultLayers:[{...layer(),sourceReferenceId:'paper-b'}]},{type:'visibility',layerId:'layer-a',visible:false},{evidence}),/source/);
 assert.equal(before.resultLayers.length,2);assert.equal(before.resultLayers[0].visible,true);
});

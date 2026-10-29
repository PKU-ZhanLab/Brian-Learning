import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateEvidence} from './evidence-schema.js';
import {validateResultLayers,resolveResultLayers,projectPublicResultLayers} from './result-layers.js';

export const evidenceFixture=(referenceId='paper',resultId='result',space='MNI152NLin6Asym')=>migrateEvidence({schema:'brain-evidence-v1',references:[{id:referenceId,title:'Synthetic paper',url:'https://example.org/paper'}],results:[{id:resultId,referenceId,finding:'Synthetic finding',condition:'task',sample:'n=2',roiDefinition:'table',direction:'positive',annotator:'unknown',modalities:['fmri'],regionIds:[],sourceUrl:'https://example.org/paper',curationStatus:'draft',limitations:'synthetic',coordinates:[[1,2,3],[-1,2,3]].map((xyz,i)=>({id:`${resultId}-point-${i}`,x:xyz[0],y:xyz[1],z:xyz[2],space,status:'source-checked',label:'peak',sourceTable:'1',sourceRow:String(i+1),frameNote:'explicit synthetic frame',sourceUrl:'https://example.org/paper'})),figures:[]}],relations:[]}).value;
export const layerFixture=(resultId='result',sourceReferenceId='paper')=>({layerId:'private-layer-name',resultId,coordinateIds:[`${resultId}-point-0`,`${resultId}-point-1`],sourceReferenceId,spaceId:'MNI152NLin6Asym',visible:true,style:{color:'#b85163',opacity:.6,size:2}});

test('stable coordinates resolve without copying points into the layer; hidden layers persist without markers',()=>{
 const evidence=evidenceFixture(),layer=layerFixture(),before=structuredClone(evidence);
 const resolved=resolveResultLayers([layer],{evidence});assert.deepEqual(resolved.markers.map(m=>m.position),[[1,2,3],[-1,2,3]]);assert.deepEqual(resolved.markers.map(m=>m.coordinateId),layer.coordinateIds);assert.deepEqual(resolved.layers,[layer]);assert.deepEqual(evidence,before);
 assert.equal(resolveResultLayers([{...layer,visible:false}],{evidence}).markers.length,0);
 const styled=resolveResultLayers([{...layer,style:{size:20,opacity:0,color:'#123456'}}],{evidence}).markers[0];assert.equal(styled.radiusMm,20);assert.equal(styled.opacity,0);assert.equal(styled.color,'#123456');
});
test('result, source, space, coordinate uniqueness and constrained style are admitted together',()=>{
 const evidence=evidenceFixture(),layer=layerFixture();
 for(const bad of [{...layer,coordinateIds:['missing']},{...layer,sourceReferenceId:'other'},{...layer,spaceId:'MNI-unspecified'},{...layer,coordinateIds:[layer.coordinateIds[0],layer.coordinateIds[0]]},{...layer,style:{color:'private text'}},{...layer,style:{opacity:2}},{...layer,style:{size:21}},{...layer,style:{note:'private'}}])assert.throws(()=>validateResultLayers([bad],{evidence}));
 assert.throws(()=>validateResultLayers([layer,layer],{evidence}));
});
test('unavailable space or unreviewed coordinate retains layer with a reason and no fabricated marker',()=>{
 const evidence=evidenceFixture('paper','result','MNI-unspecified'),layer={...layerFixture(),spaceId:'MNI-unspecified'};
 const result=resolveResultLayers([layer],{evidence});assert.deepEqual(result.layers,[layer]);assert.deepEqual(result.markers,[]);assert.match(result.unavailable[0].reason,/space/);
 const unreviewed=evidenceFixture();unreviewed.reviewEvents=[];const blocked=resolveResultLayers([layerFixture()],{evidence:unreviewed});assert.equal(blocked.markers.length,0);assert.match(blocked.unavailable[0].reason,/source/);
});
test('public projection authorizes content, not public paper or colliding IDs, and neutralizes layer identifiers',()=>{
 const publicResults=evidenceFixture(),layer=layerFixture(),options={publicReferenceIds:['paper'],publicResults};
 const shared=projectPublicResultLayers([layer],options);assert.equal(shared.layers[0].layerId,'public-layer-1');assert.deepEqual(shared.layers[0].coordinateIds,layer.coordinateIds);assert.deepEqual(shared.omitted,[]);
 const local=evidenceFixture('paper','private-result');assert.equal(projectPublicResultLayers([layerFixture('private-result')],{...options,evidence:local}).layers.length,0);
 const collision=evidenceFixture();collision.locations[0].xyz=[99,2,3];const result=projectPublicResultLayers([layer],{...options,evidence:collision});assert.deepEqual(result.layers,[]);assert.ok(result.omitted.includes('resultLayers'));
 const changedSource=evidenceFixture();changedSource.references[0].title='private paper replacement';assert.equal(projectPublicResultLayers([layer],{...options,evidence:changedSource}).layers.length,0);
 const locationCollision=evidenceFixture('paper','private-result');locationCollision.locations[0].id=layer.coordinateIds[0];locationCollision.results[0].locationIds[0]=layer.coordinateIds[0];assert.throws(()=>validateResultLayers([layer],{publicEvidence:publicResults,evidence:locationCollision}),/invalid-coordinate-reference/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceEditorState,updateEvidenceEditorField,prepareEvidenceEditorSubmission} from './evidence-editor.js';
import {curatedResults} from '../data/results.js';

const details={actorType:'ai',actorName:'Codex AI',date:'2026-10-29',scope:'Compared the changed finding and coordinate against Table 1'};
test('editor state distinguishes explicit source checks from inherited flags and requires fresh reviewer details',()=>{
  let state=createEvidenceEditorState(curatedResults[1]);
  assert.equal(state.draft.curationStatus,'source-checked');assert.equal(state.reviewIntent.result,false);assert.deepEqual(state.reviewDetails,{actorType:'unknown',actorName:'',date:'',scope:''});
  assert.equal(prepareEvidenceEditorSubmission('result',state).reviewIntent,null);
  state=updateEvidenceEditorField(state,'finding','Revised finding');
  state=updateEvidenceEditorField(state,'curationStatus','source-checked');
  assert.throws(()=>prepareEvidenceEditorSubmission('result',state),/reviewer|date|scope/i);
  state={...state,reviewDetails:details};
  const submission=prepareEvidenceEditorSubmission('result',state);
  assert.equal(submission.reviewIntent.result,true);assert.deepEqual(submission.reviewIntent.coordinateIds,[]);assert.equal(submission.reviewIntent.actorType,'ai');assert.equal(submission.reviewIntent.actorName,details.actorName);assert.equal(submission.reviewIntent.date,details.date);assert.equal(submission.reviewIntent.scope,details.scope);
});
test('coordinate changes revoke only their fresh intent and preserve an independent explicitly checked coordinate',()=>{
  let state=createEvidenceEditorState(curatedResults[0]),[first,second]=state.draft.coordinates;
  state=updateEvidenceEditorField(state,'coordinates',state.draft.coordinates,{coordinateCheckId:first.id,statusOnly:true});
  state=updateEvidenceEditorField(state,'coordinates',state.draft.coordinates,{coordinateCheckId:second.id,statusOnly:true});
  assert.deepEqual(state.reviewIntent.coordinateIds,[first.id,second.id]);
  state=updateEvidenceEditorField(state,'curationStatus','source-checked');
  state=updateEvidenceEditorField(state,'coordinates',state.draft.coordinates.map(c=>c.id===first.id?{...c,x:c.x+1,status:'draft'}:c));
  assert.equal(state.reviewIntent.result,false);assert.deepEqual(state.reviewIntent.coordinateIds,[second.id]);assert.equal(state.draft.curationStatus,'draft');
});

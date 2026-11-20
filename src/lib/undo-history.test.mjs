import test from 'node:test';
import assert from 'node:assert/strict';
import {applyUndoableAction,undoLast} from './undo-history.js';
import {emptyEvidence,migrateEvidence} from './evidence-schema.js';
import {createWorkspaceSession} from './workspace-session.js';
const evidence=migrateEvidence({schema:'brain-evidence-v1',references:[{id:'p',title:'Local paper',url:'https://example.org/p'}],results:[{id:'r',referenceId:'p',finding:'finding',condition:'task',sample:'n=1',roiDefinition:'ROI',direction:'positive',annotator:'unknown',modalities:['fmri'],regionIds:[],sourceUrl:'https://example.org/p',curationStatus:'draft',limitations:'legacy',coordinates:[{id:'c',x:1,y:2,z:3,space:'MNI-unspecified',status:'draft',label:'peak',sourceTable:'1',sourceRow:'1',frameNote:'unknown',sourceUrl:'https://example.org/p'}],figures:[]}],relations:[]}).value;
const layer={layerId:'l',resultId:'r',sourceReferenceId:'p',coordinateIds:['c'],spaceId:'MNI-unspecified',visible:true,style:{}};
const workspace=()=>({projectId:'A',revision:0,view:{resultLayers:[layer],literature:{paperId:'p',compared:['p'],showCompare:false}},notes:[],drafts:[],evidence:structuredClone(evidence),volumes:[],roiSnapshot:null,recomputedSnapshot:null});
test('one real canonical cascade undo restores v2 closure, active refs, exact artifact bytes and unrelated later notes',async()=>{
 const initial=workspace();initial.evidence.results.push({...structuredClone(initial.evidence.results[0]),id:'r2',locationIds:[],claimIds:[]});initial.evidence.relations=[{id:'rel',fromResultId:'r',toResultId:'r2',type:'complementary',rationale:'conditions',annotator:'AI',sourceUrl:'https://example.org/p'}];
 const session=createWorkspaceSession({storage:{setItem(){}},initial});const base=session.getSnapshot();
 const deleted=applyUndoableAction(base,{type:'delete-evidence',referenceIds:['p'],label:'Local paper'});assert.equal(deleted.state.evidence.results.length,0);assert.equal(deleted.state.evidence.relations.length,0);assert.deepEqual(deleted.state.view.resultLayers,[]);
 session.commit(await session.stage(deleted.state));await session.transact(s=>({...s,notes:[{id:'later',text:'preserve'}]}));
 const restored=undoLast(deleted.undoState,session.getSnapshot());session.commit(await session.stage(restored.state));
 assert.deepEqual(session.getSnapshot().evidence,base.evidence);assert.deepEqual(session.getSnapshot().view.resultLayers,[layer]);assert.equal(session.getSnapshot().notes[0].text,'preserve');assert.deepEqual(session.getSnapshot().evidence.sourceArtifacts,base.evidence.sourceArtifacts);
});
test('history is bounded to 20 session actions and scoped to current project, without volume binary copies',()=>{
 let current=workspace(),history;const binary=Uint8Array.of(3);current.volumes=[{id:'custom-v',data:binary}];
 for(let i=0;i<25;i++){const next=applyUndoableAction(current,{type:'change',patch:{notes:[...current.notes,{id:`n${i}`,text:`note ${i}`}]},label:`note ${i}`},{undoState:history,limit:20});current=next.state;history=next.undoState;}
 assert.equal(history.entries.length,20);assert.equal(JSON.stringify(history.entries).includes('custom-v'),false);assert.strictEqual(current.volumes[0].data,binary);
 assert.throws(()=>undoLast(history,{...current,projectId:'B'}),/undo-project-mismatch/);assert.equal(undoLast(history).state.notes.length,24);
});
test('undo preserves unrelated later records and refuses to overwrite later edits to the same record',()=>{
 const initial=workspace(),change=applyUndoableAction(initial,{type:'change',patch:{notes:[{id:'n',text:'first'}]},label:'note'});
 assert.throws(()=>undoLast(change.undoState,{...change.state,notes:[{id:'n',text:'edited later'}]}),/undo-conflict/);
 const restored=undoLast(change.undoState,{...change.state,notes:[...change.state.notes,{id:'other',text:'later'}]});assert.deepEqual(restored.state.notes,[{id:'other',text:'later'}]);
});
test('cascade undo restores three ordered result records and preserves later navigation choices',()=>{
 const initial=workspace();for(const id of ['r2','r3'])initial.evidence.results.push({...structuredClone(initial.evidence.results[0]),id,locationIds:[],claimIds:[]});
 const deleted=applyUndoableAction(initial,{type:'delete-evidence',referenceIds:['p'],label:'paper'});
 const later={...deleted.state,view:{...deleted.state.view,literature:{...deleted.state.view.literature,paperId:'later-paper'},coordinate:[9,8,7]}};
 const restored=undoLast(deleted.undoState,later);assert.deepEqual(restored.state.evidence.results,initial.evidence.results);assert.equal(restored.state.view.literature.paperId,'later-paper');assert.deepEqual(restored.state.view.coordinate,[9,8,7]);assert.deepEqual(restored.state.view.resultLayers,[layer]);
});
test('semantic queued note deletions do not resurrect a deleted note or erase an intervening addition',async()=>{
 const initial=workspace();initial.notes=[{id:'A',text:'A'},{id:'B',text:'B'}];const session=createWorkspaceSession({storage:{setItem(){}},initial});
 let release;const gate=new Promise(resolve=>{release=resolve;});const blocker=session.transact(async base=>{await gate;return base;});
 const deleteA={type:'delete-note',id:'A',label:'Delete A'},deleteB={type:'delete-note',id:'B',label:'Delete B'};
 const first=session.transact(base=>applyUndoableAction(base,deleteA).state);
 const intervening=session.transact(base=>({...base,notes:[...base.notes,{id:'C',text:'Added while deletes waited'}]}));
 const second=session.transact(base=>applyUndoableAction(base,deleteB).state);release();await Promise.all([blocker,first,intervening,second]);
 assert.deepEqual(session.getSnapshot().notes.map(n=>n.id),['C']);assert.equal(session.getSnapshot().notes[0].text,'Added while deletes waited');
});

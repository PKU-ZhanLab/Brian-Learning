import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDrafts,saveDraft,readDraft,createDraftManager,recoverDraftPayload} from './draft-store.js';
import {createWorkspaceSession,restoreWorkspaceInitial,WORKSPACE_STORAGE_KEY,stageProjectImport} from './workspace-session.js';
import {validateProjectDrafts,serializeProject,parseProject,encodeView,decodeView} from './workspace-project.js';
import {emptyEvidence} from './evidence-schema.js';
import {createEvidenceEditorState,prepareEvidenceEditorSubmission} from './evidence-editor.js';
const workspace=(projectId='A')=>({projectId,revision:0,view:{atlas:'dk'},notes:[],evidence:emptyEvidence(),drafts:[],volumes:[],roiSnapshot:null,recomputedSnapshot:null});
const draft=(extra={})=>({id:'draft-1',projectId:'A',kind:'result',recordId:'new-result-1',payload:{id:'new-result-1',finding:'半条结果',coordinates:[],curationStatus:'draft'},updatedAt:'2026-10-30T00:00:00.000Z',...extra});
function storage(){const data=new Map();return {fail:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.fail)throw Error('quota');data.set(k,v);},entries:()=>[...data.entries()]};}
test('canonical validator admits unfinished fields and enforces UTF8, count, total and project budgets',()=>{
 assert.deepEqual(validateDrafts([draft()]),validateProjectDrafts([draft()],'A'));
 assert.throws(()=>validateDrafts([draft({payload:{finding:'中'.repeat(17000)}})]),/draft-payload-budget/);
 assert.throws(()=>validateDrafts(Array.from({length:31},(_,i)=>draft({id:`d-${i}`,recordId:`r-${i}`}))),/draft-count/);
 assert.throws(()=>validateDrafts(Array.from({length:30},(_,i)=>draft({id:`d-${i}`,recordId:`r-${i}`,payload:{text:'a'.repeat(40000)}}))),/draft-json-budget/);
 assert.throws(()=>validateProjectDrafts([draft()],'B'),/invalid-draft/);
});
test('actual session saves recover identically across views, refresh and complete project while public link excludes drafts',async()=>{
 const store=storage(),session=createWorkspaceSession({storage:store,initial:workspace()});await saveDraft(draft(),session);
 await session.transact(base=>({...base,view:{...base.view,mode:'anatomy'}}));
 assert.deepEqual(readDraft('A','result','new-result-1',session),draft());assert.equal(readDraft('B','result','new-result-1',session),null);
 const restored=restoreWorkspaceInitial({storage:store,fallback:workspace()});assert.deepEqual(restored.drafts,[draft()]);
 assert.deepEqual((await parseProject(await serializeProject(session.getSnapshot()))).drafts,[draft()]);
 assert.equal(JSON.stringify(decodeView(encodeView({...session.getSnapshot().view,drafts:[draft()]}).encoded)).includes('半条结果'),false);
 assert.deepEqual(store.entries().map(([k])=>k),[WORKSPACE_STORAGE_KEY]);
});
test('quota and oversize preserve current editing, latest payload, previous durable bytes and dirty status; retry and clear succeed',async()=>{
 const store=storage(),session=createWorkspaceSession({storage:store,initial:workspace()}),manager=createDraftManager(session);
 manager.update(draft());await manager.flush();assert.equal(manager.getSnapshot().dirty,false);const bytes=store.getItem(WORKSPACE_STORAGE_KEY);
 store.fail=true;manager.update(draft({payload:{finding:'new unpersisted'}}));await assert.rejects(manager.flush(),/quota/);
 assert.equal(manager.getSnapshot().dirty,true);assert.equal(manager.getSnapshot().records[0].payload.finding,'new unpersisted');assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),bytes);
 store.fail=false;await manager.flush();assert.equal(manager.getSnapshot().dirty,false);
 manager.update(draft({payload:{finding:'中'.repeat(17000)}}));await assert.rejects(manager.flush(),/draft-payload-budget/);assert.equal(manager.getSnapshot().records[0].payload.finding.length,17000);
 await manager.discard('draft-1');assert.equal(manager.getSnapshot().dirty,false);assert.deepEqual(session.getSnapshot().drafts,[]);
});
test('rapid edits serialize with real workspace writes and saving evidence clears its draft atomically',async()=>{
 const session=createWorkspaceSession({storage:storage(),initial:workspace()}),manager=createDraftManager(session);
 manager.update(draft());const first=manager.flush();manager.update(draft({payload:{finding:'latest'}}));
 await Promise.all([first,session.transact(base=>({...base,notes:[{id:'n',text:'unrelated'}]})),manager.flush()]);
 assert.equal(session.getSnapshot().drafts[0].payload.finding,'latest');assert.equal(session.getSnapshot().notes[0].text,'unrelated');
 await manager.complete('draft-1',base=>({...base,notes:[...base.notes,{id:'saved',text:'completed'}]}));assert.equal(session.getSnapshot().drafts.length,0);assert.equal(manager.getSnapshot().dirty,false);
});
test('failed project import leaves pending editor; boundary reset isolates even same ID project replacement',async()=>{
 const session=createWorkspaceSession({storage:storage(),initial:workspace()}),manager=createDraftManager(session);manager.update(draft());
 assert.equal(manager.getSnapshot().records.length,1);await assert.rejects(stageProjectImport('{',{current:session.getSnapshot()}));assert.equal(manager.getSnapshot().records[0].payload.finding,'半条结果');manager.reset();assert.deepEqual(manager.getSnapshot().records,[]);
 await session.transact(()=>workspace('B'));assert.equal(manager.getSnapshot().records.length,0);await assert.rejects(saveDraft(draft(),session),/draft-project-mismatch/);
});
test('recovery never renews explicit E2 source check intent or reviewer details',()=>{
 const recovered=recoverDraftPayload(draft({payload:{id:'r',finding:'changed',curationStatus:'source-checked',checkedAt:'2026-10-29',coordinates:[{id:'c',status:'source-checked'}],reviewIntent:{result:true},reviewDetails:{actorName:'old'}}}));
 const state=createEvidenceEditorState(recovered);assert.equal(state.draft.curationStatus,'draft');assert.equal(state.draft.coordinates[0].status,'draft');assert.equal(prepareEvidenceEditorSubmission('result',state).reviewIntent,null);assert.equal('reviewIntent' in recovered,false);
});
test('save failure leaves the exact durable draft and editing payload; successful completion bypasses oversized autosave',async()=>{
 const store=storage(),session=createWorkspaceSession({storage:store,initial:workspace()}),manager=createDraftManager(session);manager.update(draft());await manager.flush();const before=session.getSnapshot(),bytes=store.getItem(WORKSPACE_STORAGE_KEY);
 manager.update(draft({payload:{finding:'new edits'}}));store.fail=true;
 await assert.rejects(manager.complete('draft-1',s=>({...s,notes:[{id:'saved',text:'formal'}]})),/quota/);assert.strictEqual(session.getSnapshot(),before);assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),bytes);assert.equal(manager.getSnapshot().records[0].payload.finding,'new edits');
 store.fail=false;manager.update(draft({payload:{finding:'中'.repeat(17000)}}));await manager.complete('draft-1',s=>({...s,notes:[{id:'saved',text:'formal'}]}));assert.equal(manager.getSnapshot().dirty,false);assert.equal(session.getSnapshot().drafts.length,0);
});
test('incomplete imported editor payloads recover stable identity and safe empty input fields',()=>{
 const recovered=recoverDraftPayload(draft({recordId:'remapped-new-id',payload:{finding:'half'}}));assert.equal(recovered.id,'remapped-new-id');assert.deepEqual(recovered.modalities,[]);assert.deepEqual(recovered.figures,[]);assert.deepEqual(recovered.regionIds,[]);
});
test('a delayed autosave cannot resurrect a draft after a successful discard or formal save',async()=>{
 const session=createWorkspaceSession({storage:storage(),initial:workspace()}),manager=createDraftManager(session);manager.update(draft());
 let release;const gate=new Promise(resolve=>{release=resolve;});const blocking=session.transact(async s=>{await gate;return s;});
 const clearing=manager.discard('draft-1'),lateAutosave=manager.flush();release();await Promise.all([blocking,clearing,lateAutosave]);assert.deepEqual(session.getSnapshot().drafts,[]);assert.equal(manager.getSnapshot().dirty,false);
});

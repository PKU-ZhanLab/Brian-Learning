import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceSession,stageWorkspaceChange,stageProjectImport,WORKSPACE_STORAGE_KEY,restoreWorkspaceInitial} from './workspace-session.js';
import {serializeProject as serializeWorkspaceProject} from './workspace-project.js';
import {listCustomVolumes,subscribeCustomVolumes} from './custom-volumes.js';
import {emptyEvidence,migrateEvidence} from './evidence-schema.js';

const volume=(id='custom-a',value=1)=>({id,name:id,data:Uint8Array.of(value),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],kind:'label',space:'native-unverified',labels:[]});
const makeWorkspace=(projectId='A',extra={})=>({projectId,revision:0,view:{atlas:'dk',camera:{position:[1,2,3],target:[0,0,0],zoom:1},resultLayers:[]},notes:[],evidence:emptyEvidence(),drafts:[],volumes:[],roiSnapshot:null,recomputedSnapshot:null,...extra});
function memoryStorage(){const data=new Map([['language','en'],['neuroatlas-saved-views','sentinel'],['draft-sentinel','untouched'],['brain-model.evidence.v1','original']]);return {fail:false,writes:0,getItem:key=>data.get(key)??null,setItem(key,value){if(this.fail)throw new DOMException('full','QuotaExceededError');this.writes++;data.set(key,value);},entries:()=>[...data.entries()]};}
const evidence=label=>migrateEvidence({schema:'brain-evidence-v1',references:[{id:'paper',title:label,url:'https://example.org/paper'}],results:[{id:'result',referenceId:'paper',finding:label,condition:'task',sample:'n=1',roiDefinition:'source ROI',direction:'positive',annotator:'unknown',modalities:['fmri'],regionIds:[],sourceUrl:'https://example.org/paper',curationStatus:'draft',limitations:'legacy',coordinates:[{id:'point',x:1,y:2,z:3,space:'MNI-unspecified',status:'draft',label:'peak',sourceTable:'1',sourceRow:'1',frameNote:'unknown template',sourceUrl:'https://example.org/paper'}],figures:[]}],relations:[]}).value;

test('all failed stages preserve every storage key, view identity and project assets',async()=>{
 const storage=memoryStorage(),session=createWorkspaceSession({storage,initial:makeWorkspace('A',{volumes:[volume()]})});
 session.commit(await stageWorkspaceChange(session.getSnapshot(),{current:session.getSnapshot()}));
 const before={entries:storage.entries(),snapshot:session.getSnapshot(),volumes:listCustomVolumes('A')};
 const current=before.snapshot;
 for(const next of [makeWorkspace('B',{view:{atlas:'custom-missing'}}),makeWorkspace('B',{evidence:{schema:'wrong'}}),makeWorkspace('B',{view:{resultLayers:[{layerId:'layer',resultId:'absent',coordinateIds:['bad'],sourceReferenceId:'missing',spaceId:null,visible:true,style:{}}]}})]){
   await assert.rejects(stageWorkspaceChange(next,{current}));
   assert.deepEqual(storage.entries(),before.entries);assert.strictEqual(session.getSnapshot(),before.snapshot);assert.deepEqual(listCustomVolumes('A'),before.volumes);
 }
 const broken=JSON.stringify({schema:'neuroatlas-project-v1',view:{atlas:'custom-missing'},notes:[],evidence:null,volumes:[]});
 await assert.rejects(stageProjectImport(broken,{current,mode:'open'}),/missing-asset/);
 assert.deepEqual(storage.entries(),before.entries);
});

test('quota failure is zero publication; successful commit publishes one coherent revision even with broken subscribers',async()=>{
 const storage=memoryStorage(),session=createWorkspaceSession({storage,initial:makeWorkspace()});const initial=session.getSnapshot();
 const stage=await stageWorkspaceChange({...initial,notes:[{id:'note',text:'new'}],volumes:[volume()]},{current:initial});
 const before=storage.entries();let notifications=0,volumeNotices=0;
 session.subscribe(()=>{throw Error('subscriber failure');});session.subscribe(()=>{notifications++;assert.equal(listCustomVolumes('A').length,1);assert.equal(session.getSnapshot().revision,1);});
 const unsubscribe=subscribeCustomVolumes(()=>{volumeNotices++;assert.equal(session.getSnapshot().revision,1);});
 storage.fail=true;assert.throws(()=>session.commit(stage),/full/);assert.strictEqual(session.getSnapshot(),initial);assert.deepEqual(storage.entries(),before);assert.equal(notifications,0);assert.equal(volumeNotices,0);
 storage.fail=false;session.commit(stage);assert.equal(storage.writes,1);assert.equal(notifications,1);assert.equal(volumeNotices,1);unsubscribe();
 assert.throws(()=>session.commit(stage),/stale-workspace/);
 const envelope=JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY));assert.equal(envelope.notes[0].text,'new');assert.ok(!('volumes' in envelope));assert.ok(!('roiSnapshot' in envelope));assert.equal(storage.getItem('brain-model.evidence.v1'),'original');
});

test('open replaces ownership and does not remap IDs against former project',async()=>{
 const storage=memoryStorage(),session=createWorkspaceSession({storage,initial:makeWorkspace('A',{volumes:[volume()]})});
 const current=session.getSnapshot();const text=await serializeWorkspaceProject(makeWorkspace('B'));
 const stage=await stageProjectImport(text,{current,mode:'open'});assert.deepEqual(stage.preview.removedAssetIds,['custom-a']);session.commit(stage);
 assert.equal(session.getSnapshot().projectId,'B');assert.deepEqual(listCustomVolumes('B'),[]);assert.deepEqual(listCustomVolumes('A'),[]);
 const exported=JSON.parse(await serializeWorkspaceProject(session.getSnapshot()));assert.deepEqual(exported.volumes,[]);assert.equal(exported.schema,'neuroatlas-project-v2');
});

test('merge keeps both colliding records and rewrites only incoming references by record kind',async()=>{
 const current=makeWorkspace('A',{volumes:[volume()],evidence:evidence('existing'),notes:[{id:'note',text:'existing'}]});
 const incoming=makeWorkspace('B',{volumes:[volume('custom-a',2)],evidence:evidence('incoming'),notes:[{id:'note',text:'incoming'}],view:{atlas:'custom-a',roi:{aAtlas:'custom-a',bAtlas:'dk'},resultLayers:[{layerId:'layer',resultId:'result',coordinateIds:['point'],sourceReferenceId:'paper',spaceId:'MNI-unspecified',visible:true,style:{}}]}});
 let n=0;const stage=await stageProjectImport(await serializeWorkspaceProject(incoming),{current,mode:'merge',makeId:(kind,id)=>`${kind==='volumes'?'custom-':''}remapped-${++n}`});
 assert.equal(stage.next.projectId,'A');assert.equal(stage.next.volumes.length,2);assert.equal(stage.next.evidence.references[0].title,'existing');assert.equal(stage.next.evidence.references[1].title,'incoming');assert.equal(stage.next.evidence.results[0].id,'result');
 const result=stage.next.evidence.results[1],layer=stage.next.view.resultLayers[0];assert.notEqual(result.id,'result');assert.equal(layer.resultId,result.id);assert.equal(layer.sourceReferenceId,result.referenceId);assert.deepEqual(layer.coordinateIds,result.locationIds);assert.equal(stage.next.evidence.locations[1].resultId,result.id);assert.equal(stage.next.notes[0].text,'existing');assert.equal(stage.next.notes[1].text,'incoming');
 assert.ok(stage.preview.collisions.some(c=>c.recordKind==='volumes'));assert.ok(stage.preview.collisions.some(c=>c.recordKind==='results'));assert.equal(current.evidence.results[0].id,'result');
});

test('identical content may reuse IDs but changed dependency forces dependent incoming record separation',async()=>{
 const current=makeWorkspace('A',{evidence:evidence('same')});const incoming=makeWorkspace('B',{evidence:evidence('same')});incoming.evidence.references[0].title='different';
 const stage=await stageProjectImport(await serializeWorkspaceProject(incoming),{current,mode:'merge'});
 assert.equal(stage.next.evidence.results.length,2);assert.notEqual(stage.next.evidence.results[1].referenceId,'paper');assert.equal(stage.next.evidence.locations.length,2);
 const reused=await stageProjectImport(await serializeWorkspaceProject(current),{current,mode:'merge'});assert.equal(reused.next.evidence.results.length,1);assert.equal(reused.preview.collisions.length,0);
});

test('stale concurrency, foreign stages and post-stage mutations cannot overwrite committed state',async()=>{
 const session=createWorkspaceSession({storage:memoryStorage(),initial:makeWorkspace()});const current=session.getSnapshot();
 const first=await stageWorkspaceChange({...current,notes:[{id:'one',text:'one'}]},{current});const second=await stageWorkspaceChange({...current,notes:[{id:'two',text:'two'}]},{current});session.commit(second);assert.throws(()=>session.commit(first),/stale-workspace/);assert.throws(()=>session.commit({...second}),/invalid-stage/);
 assert.throws(()=>{second.next.notes[0].text='tampered';},TypeError);assert.equal(session.getSnapshot().notes[0].text,'two');
});

test('drafts obey envelope bounds and old persistence is read without mutation',async()=>{
 const storage=memoryStorage();const base=makeWorkspace();
 await assert.rejects(stageWorkspaceChange({...base,drafts:[{id:'draft',projectId:'A',kind:'finding',recordId:null,payload:'x'.repeat(50001),updatedAt:'2026-10-29'}]},{current:base}),/draft/);
 storage.setItem('brain-model.evidence.v1',JSON.stringify({schema:'brain-evidence-v1',references:[],results:[],relations:[]}));const before=storage.entries();const restored=restoreWorkspaceInitial({storage,fallback:base,legacyNotesKey:'notes'});assert.deepEqual(storage.entries(),before);assert.equal(restored.evidence.schema,'brain-evidence-v2');
});

test('authoritative envelope ignores corrupt preserved legacy keys; corrupt legacy without an envelope is reported without writes',async()=>{
 const storage=memoryStorage(),base=makeWorkspace(),before=storage.entries();assert.throws(()=>restoreWorkspaceInitial({storage,fallback:base}),/JSON|Unexpected/);assert.deepEqual(storage.entries(),before);
 const session=createWorkspaceSession({storage,initial:base});session.commit(await stageWorkspaceChange(base,{current:session.getSnapshot()}));const committed=storage.entries();const restored=restoreWorkspaceInitial({storage,fallback:makeWorkspace('unused')});assert.equal(restored.projectId,'A');assert.deepEqual(storage.entries(),committed);assert.equal(storage.getItem('brain-model.evidence.v1'),'original');
});

test('staging does not freeze or mutate caller state and rejects duplicate note identities',async()=>{
 const current=makeWorkspace(),candidate=makeWorkspace('B',{view:{resultLayers:[]}});await stageWorkspaceChange(candidate,{current});assert.equal(Object.isFrozen(candidate.view.resultLayers),false);candidate.view.resultLayers.push('still editable');
 await assert.rejects(stageWorkspaceChange(makeWorkspace('B',{notes:[{id:'same',text:'one'},{id:'same',text:'two'}]}),{current}),/duplicate-note/);
});

test('reentrant subscriber commits cannot change the revision observed by peers',async()=>{
 const session=createWorkspaceSession({storage:memoryStorage(),initial:makeWorkspace()}),base=session.getSnapshot();
 const stage=await stageWorkspaceChange(base,{current:base});const nested=await stageWorkspaceChange(stage.next,{current:stage.next});let rejected=false,observed;
 session.subscribe(()=>{try{session.commit(nested);}catch(error){rejected=/commit-in-progress/.test(error.message);}});session.subscribe(()=>{observed=session.getSnapshot().revision;});session.commit(stage);assert.equal(rejected,true);assert.equal(observed,1);
});

test('merge remaps incoming draft owners and record links without rewriting draft prose or legacy originals',async()=>{
 const current=makeWorkspace('A',{evidence:evidence('existing')});const incoming=makeWorkspace('B',{evidence:evidence('incoming'),drafts:[{id:'draft',projectId:'B',kind:'result',recordId:'result',payload:{finding:'result is free text',referenceId:'paper'},updatedAt:'2026-10-29T00:00:00Z'}]});
 const stage=await stageProjectImport(await serializeWorkspaceProject(incoming),{current,mode:'merge'}),draft=stage.next.drafts[0];assert.equal(draft.projectId,'A');assert.equal(draft.recordId,stage.next.evidence.results[1].id);assert.equal(draft.payload.referenceId,stage.next.evidence.references[1].id);assert.equal(draft.payload.finding,'result is free text');assert.equal(stage.next.evidence.legacyImports.at(-1).results[0].id,'result');
});

test('saving notes or evidence with unchanged assets preserves the registry and running ROI consumers',async()=>{
 const storage=memoryStorage(),session=createWorkspaceSession({storage,initial:makeWorkspace('A',{volumes:[volume()]})});assert.equal(listCustomVolumes('A').length,1);
 let changed=0;const unsubscribe=subscribeCustomVolumes(()=>changed++),before=listCustomVolumes('A')[0];
 const base=session.getSnapshot();session.commit(await stageWorkspaceChange({...base,notes:[{id:'note',text:'annotation only'}]},{current:base}));assert.equal(changed,0);assert.strictEqual(listCustomVolumes('A')[0],before);unsubscribe();
});

test('malformed legacy note containers are reported before React sees them and never overwritten',()=>{
 const storage=memoryStorage();storage.setItem('brain-model.evidence.v1',JSON.stringify({schema:'brain-evidence-v1',references:[],results:[],relations:[]}));storage.setItem('legacy-notes',JSON.stringify({unexpected:'object'}));const before=storage.entries();
 assert.throws(()=>restoreWorkspaceInitial({storage,fallback:makeWorkspace(),legacyNotesKey:'legacy-notes'}),/Invalid project content/);assert.deepEqual(storage.entries(),before);
});

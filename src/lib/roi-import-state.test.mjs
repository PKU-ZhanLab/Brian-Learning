import test from 'node:test';
import assert from 'node:assert/strict';
import {newImportDraft,reduceImportDraft,prepareImportSummary,stageVolumeImport,createImportTaskHandoff} from './roi-import-state.js';
import {exportNifti} from './nifti.js';
import {createWorkspaceSession} from './workspace-session.js';
import {emptyEvidence} from './evidence-schema.js';

const bytes=value=>exportNifti({kind:'label',shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],data:Uint8Array.of(value)});
const file=(name='same.nii',value=1)=>{const data=bytes(value);return {name,size:data.byteLength,arrayBuffer:async()=>data.buffer};};
const table={name:'A.csv',size:19,text:async()=>'id,name\n1,A label'};
const change=(draft,type,value)=>reduceImportDraft(draft,{type,value});
function confirmed(token='A'){
 let draft=newImportDraft(token);draft=change(draft,'space-changed','MNI152NLin6Asym');draft=change(draft,'alignment-changed',true);draft=change(draft,'provenance-changed','A registration evidence');
 return reduceImportDraft(draft,{type:'label-file-changed',file:table});
}
function session(){const values=new Map();return createWorkspaceSession({storage:{setItem:(key,value)=>values.set(key,value)},initial:{projectId:'project-A',revision:0,view:{},volumes:[],notes:[],drafts:[],evidence:emptyEvidence()}});}

test('changing image resets alignment and table',()=>{
 const next=reduceImportDraft(confirmed(),{type:'file-changed',fileToken:'B'});
 assert.deepEqual(next,newImportDraft('B'));assert.equal(next.spaceId,'native-unverified');assert.equal(next.aligned,false);assert.equal(next.labelFile,null);assert.equal(next.provenance,'');assert.equal(next.kind,'label');
 assert.throws(()=>prepareImportSummary(next,{file:file('B.nii'),labelFile:table}),/stale-label-file/);
});
test('same filename is a new declaration',()=>{
 const first=file(),second=file('same.nii',2);assert.equal(first.name,second.name);
 const next=reduceImportDraft(confirmed('selection-1'),{type:'file-changed',fileToken:'selection-2'});
 assert.equal(next.fileToken,'selection-2');assert.equal(prepareImportSummary(next,{file:second}).alignmentStatus,'unverified');assert.equal(next.labelFile,null);
});
test('space changes revoke alignment; target confirmation requires current evidence',()=>{
 const other=change(confirmed(),'space-changed','MNI152NLin2009cAsym');assert.equal(other.aligned,false);
 assert.equal(prepareImportSummary(change(other,'alignment-changed',true),{file:file()}).alignmentStatus,'unverified');
 assert.throws(()=>prepareImportSummary(change(confirmed(),'provenance-changed','  '),{file:file()}),/provenanceRequired/);
});
test('summary uses shared metadata limits without truncating',()=>{
 const initial=newImportDraft('A');
 assert.throws(()=>prepareImportSummary({...initial,spaceId:'other',otherSpace:'x'.repeat(161)},{file:file()}),/space-too-long/);
 assert.throws(()=>prepareImportSummary({...initial,provenance:'x'.repeat(20001)},{file:file()}),/provenance-too-long/);
 assert.equal(prepareImportSummary({...initial,provenance:'x'.repeat(20000)},{file:file()}).provenance.length,20000);
});
test('stale import never registers after a late image read or declaration change',async()=>{
 for(const invalidate of ['file','declaration','project']){
  let release;const delayed=file();delayed.arrayBuffer=()=>new Promise(resolve=>{release=resolve;});const draft=confirmed();let latest=draft,project='A',registrationCalls=0;
  const pending=stageVolumeImport(draft,{file:delayed,isCurrent:()=>latest===draft&&project==='A',stage:async()=>{registrationCalls++;}});
  if(invalidate==='file')latest=reduceImportDraft(latest,{type:'file-changed',fileToken:'B'});
  else if(invalidate==='declaration')latest=change(latest,'provenance-changed','Corrected evidence');
  else project='B';release(bytes(1).buffer);
  await assert.rejects(pending,/stale-workspace/);assert.equal(registrationCalls,0,invalidate);
 }
});
test('host adapter retains the declaration guard through pending W2 admission',async()=>{
 let release,current=true,commits=0;const pending=stageVolumeImport(newImportDraft('A'),{file:file(),isCurrent:()=>current,stage:async(volume,summary,{isCurrent})=>{
  await new Promise(resolve=>{release=resolve;});isCurrent();commits++;return summary;
 }});
 while(!release)await new Promise(resolve=>setImmediate(resolve));current=false;release();await assert.rejects(pending,/stale-workspace/);assert.equal(commits,0);
});
test('aborted reads and mismatched table arguments never reach admission',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(stageVolumeImport(newImportDraft('A'),{file:file(),signal:controller.signal}),/import-cancelled/);
 assert.throws(()=>prepareImportSummary(confirmed(),{file:file(),labelFile:null}),/stale-label-file/);
});
test('late label read cannot apply an old table or publish into a new project',async()=>{
 let release;const delayed={...table,text:()=>new Promise(resolve=>{release=resolve;})};let draft=reduceImportDraft(newImportDraft('A'),{type:'label-file-changed',file:delayed}),current=true,calls=0;
 const pending=stageVolumeImport(draft,{file:file(),isCurrent:()=>current,stage:async()=>{calls++;}});
 while(!release)await new Promise(resolve=>setImmediate(resolve));current=false;release('id,name\n1,Old label');await assert.rejects(pending,/stale-workspace/);assert.equal(calls,0);
});
test('successful import stages actual declared bytes and table through W2 without publishing',async()=>{
 const workspace=session(),before=workspace.getSnapshot(),draft=confirmed();
 const stage=await stageVolumeImport(draft,{file:file(),current:before,isCurrent:()=>workspace.getSnapshot()===before});
 assert.equal(workspace.getSnapshot(),before);assert.equal(stage.next.volumes.length,1);const volume=stage.next.volumes[0];
 assert.deepEqual([...volume.data],[1]);assert.equal(volume.labels[0].name,'A label');assert.equal(volume.space,'MNI152NLin6Asym');assert.equal(volume.canOverlayOnTarget,true);assert.equal(volume.provenance,'A registration evidence');assert.ok(volume.identity.sha256);
 workspace.commit(stage);assert.equal(workspace.getSnapshot().volumes[0].source,'same.nii');
});
test('failed import keeps the current draft available for correction and retry',async()=>{
 const draft=confirmed(),before={...draft};await assert.rejects(stageVolumeImport(draft,{file:{...file(),arrayBuffer:async()=>new ArrayBuffer(2)},stage:()=>assert.fail('must not stage')}),/nifti-/);
 assert.deepEqual(draft,before);const result=await stageVolumeImport(draft,{file:file(),stage:async(volume,summary)=>({volume,summary})});assert.equal(result.summary.labelFileName,'A.csv');assert.equal(result.volume.labels[0].name,'A label');
});

function handoffHarness(){
 const frames=new Map();let id=0,opened=0,focused=0;
 const handoff=createImportTaskHandoff({schedule:callback=>{frames.set(++id,callback);return id;},cancel:handle=>frames.delete(handle)});
 return {handoff,frames,ready:()=>{opened++;focused++;},counts:()=>({opened,focused}),flush:()=>{const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback());}};
}
test('cold import task survives frames with no real input and consumes mount readiness once',()=>{
 const h=handoffHarness(),intent=h.handoff.begin('project:visit');
 h.flush();h.flush();assert.deepEqual(h.counts(),{opened:0,focused:0});
 h.handoff.whenReady(intent,'project:visit',h.ready);assert.deepEqual(h.counts(),{opened:0,focused:0});h.flush();
 assert.deepEqual(h.counts(),{opened:1,focused:1});h.handoff.whenReady(intent,'project:visit',h.ready);h.flush();assert.equal(h.counts().focused,1);
});
test('warm import readiness schedules focus after modal cleanup and consumes current task',async()=>{
 const h=handoffHarness(),intent=h.handoff.begin('project:visit');h.handoff.whenReady(intent,'project:visit',h.ready);
 let restoredOpener=false;queueMicrotask(()=>{restoredOpener=true;});assert.equal(h.counts().focused,0);await Promise.resolve();assert.equal(restoredOpener,true);h.flush();assert.equal(h.counts().focused,1);
});
test('leaving before lazy resolution or before its scheduled frame prevents late focus',()=>{
 for(const readyBeforeLeave of [false,true]){
  const h=handoffHarness(),intent=h.handoff.begin('project:visit');if(readyBeforeLeave)h.handoff.whenReady(intent,'project:visit',h.ready);
  h.handoff.cancel();h.handoff.whenReady(intent,'project:visit',h.ready);h.flush();assert.deepEqual(h.counts(),{opened:0,focused:0});
 }
});
test('new import visits and project scopes reject readiness from previous mounts',()=>{
 const h=handoffHarness(),old=h.handoff.begin('project-A:visit'),current=h.handoff.begin('project-B:visit');
 h.handoff.whenReady(old,'project-A:visit',h.ready);h.handoff.whenReady(current,'project-A:visit',h.ready);h.flush();assert.equal(h.counts().focused,0);
 h.handoff.whenReady(current,'project-B:visit',h.ready);h.flush();assert.equal(h.counts().focused,1);
});

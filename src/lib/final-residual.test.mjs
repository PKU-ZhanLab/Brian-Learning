import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLocalVolumeProvenance} from './computation-manifest.js';
import {replaceCustomVolumes,getCustomVolumeScope} from './custom-volumes.js';
import {loadAtlas,loadAtlasVersion} from './volume.js';
import {createComparisonSourceLoader} from './comparison-link.js';
import {stageProjectImport,stageWorkspaceChange,createWorkspaceSession} from './workspace-session.js';
import {serializeProject,validateViewState} from './workspace-project.js';
import {emptyEvidence} from './evidence-schema.js';
import {replaceNavigationEntry,pushNavigation,goBack} from './navigation-history.js';

const local=()=>prepareLocalVolumeProvenance({id:'custom-a',name:'same.nii',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],order:'x-fastest',kind:'label',space:'MNI152NLin6Asym',labels:[{id:1,name:'A label'}],alignmentStatus:'user-declared',canOverlayOnTarget:true,provenance:'A'},Uint8Array.of(1),{id:'same.nii'});
const publishB=a=>replaceCustomVolumes('B',[{...a,labels:[{id:1,name:'B label'}],provenance:'B'}]);

test('R1 warmed local continuations reject expired ownership with and without a signal',async()=>{
 const a=await local();
 for(const withSignal of [false,true])for(const byVersion of [false,true]){
  replaceCustomVolumes('A',[a]);await loadAtlas('custom-a');
  const options=withSignal?{signal:new AbortController().signal}:{};
  const pending=byVersion?loadAtlasVersion(a.identity,options):loadAtlas('custom-a',options);
  const rejected=assert.rejects(pending,/ownership expired/);
  queueMicrotask(()=>publishB(a));await rejected;
  assert.equal((await loadAtlas('custom-a')).labels[0].name,'B label');
 }
});

test('R1 actual comparison adapter rejects the warmed late-A witness',async()=>{
 const a=await local();replaceCustomVolumes('A',[a]);await loadAtlas('custom-a');
 const loader=createComparisonSourceLoader(loadAtlas),pending=loader.run({assetId:'custom-a',identity:a.identity});
 const rejected=assert.rejects(pending,/ownership expired/);queueMicrotask(()=>publishB(a));await rejected;
 const current=await loader.run({assetId:'custom-a',identity:a.identity});assert.equal(current.isCurrent(),true);assert.equal(current.volume.labels[0].name,'B label');
});

test('R1 adapter predicates retire at registry publication without another request or effect',async()=>{
 const a=await local();replaceCustomVolumes('A',[a]);
 const loader=createComparisonSourceLoader(loadAtlas),current=await loader.run({assetId:'custom-a',identity:a.identity});
 assert.equal(current.isCurrent(),true);const scope=getCustomVolumeScope('custom-a');
 publishB(a);assert.notDeepEqual(getCustomVolumeScope('custom-a'),scope);assert.equal(current.isCurrent(),false);
 // Ownership can also expire between the loader result and adapter continuation.
 replaceCustomVolumes('A',[a]);
 const delayed=createComparisonSourceLoader(async id=>{const volume=await loadAtlas(id);queueMicrotask(()=>publishB(a));return volume;});
 assert.equal(await delayed.run({assetId:'custom-a',identity:a.identity}),null);
});

test('R1 current cold/ready ownership and cancellation retain the canonical behavior',async()=>{
 const a=await local();replaceCustomVolumes('A',[a]);const cold=await loadAtlas('custom-a');
 assert.strictEqual(await loadAtlas('custom-a'),cold);assert.strictEqual(await loadAtlasVersion(a.identity,{signal:new AbortController().signal}),cold);
 const aborted=new AbortController();aborted.abort();await assert.rejects(loadAtlasVersion(a.identity,{signal:aborted.signal}),/abort/i);
 const controller=new AbortController(),pending=loadAtlas('custom-a',{signal:controller.signal});const rejected=assert.rejects(pending,/abort/i);queueMicrotask(()=>controller.abort());await rejected;
 const loader=createComparisonSourceLoader(loadAtlas),request=await loader.run({assetId:'custom-a',identity:a.identity});loader.cancel();assert.equal(request.isCurrent(),false);assert.strictEqual(await loadAtlas('custom-a'),cold);
 const cancelled=loader.run({assetId:'custom-a',identity:a.identity});loader.cancel();assert.equal(await cancelled,null);
 replaceCustomVolumes('A',[a]);const coldPending=loadAtlas('custom-a'),expired=assert.rejects(coldPending,/ownership expired/);queueMicrotask(()=>publishB(a));await expired;
});

test('R1 public ready-cache results remain current across local ownership replacement',async()=>{
 const a=await local(),original=globalThis.fetch;
 const metadata={available:true,atlasVersion:'v1',sha256:a.identity.sha256,spaceId:a.space,space:a.space,data:'residual-public.bin',shape:a.shape,affine:a.affine,dtype:'uint8',order:'x-fastest',labels:[{id:1,name:'Public label'}]};
 let downloads=0;
 globalThis.fetch=async url=>String(url).endsWith('asset-identities.json')?{ok:true,json:async()=>({assets:{}})}:String(url).endsWith('manifest.json')?{ok:true,json:async()=>({atlases:{'residual-public':metadata}})}:{ok:true,arrayBuffer:async()=>{downloads++;return Uint8Array.of(1).buffer;}};
 try{
  replaceCustomVolumes('A',[a]);const first=await loadAtlas('residual-public'),loader=createComparisonSourceLoader(loadAtlas);
  const pending=loader.run({assetId:'residual-public',identity:first.identity});queueMicrotask(()=>publishB(a));
  const result=await pending;assert.strictEqual(result.volume,first);assert.equal(result.isCurrent(),true);assert.strictEqual(await loadAtlasVersion(first.identity,{signal:new AbortController().signal}),first);assert.equal(downloads,1);
 }finally{globalThis.fetch=original;}
});

const project=(projectId,extra={})=>({projectId,revision:0,view:validateViewState({}),notes:[],drafts:[],evidence:emptyEvidence(),volumes:[],roiSnapshot:null,recomputedSnapshot:null,...extra});
const saved=id=>({id,status:'missing-provenance',metrics:{dice:.25}});
const view=(point,slot,id)=>validateViewState({mode:'roi',coordinate:point,roi:{snapshot:slot,snapshotId:id}});
const withoutHistory=value=>{const copy=structuredClone(value);delete copy.navigationHistory;return copy;};

test('R2 missing/empty incoming histories survive real checkpoint, push and back with both snapshot bindings',async()=>{
 for(const history of [undefined,{projectId:'B',entries:[],index:-1}]){
  const original={view:view([10,20,30],'original','original-A'),scroll:{reading:123,roi:55}};
  const current=project('A',{roiSnapshot:saved('original-A'),view:{...original.view,navigationHistory:{projectId:'A',entries:[original],index:0}}});
  const incoming=project('B',{recomputedSnapshot:saved('rerun-B'),view:{...view([99,98,97],'recomputed','rerun-B'),...(history?{navigationHistory:history}:{})}});
  const stage=await stageProjectImport(await serializeProject(incoming),{current,mode:'merge'}),merged=stage.next;
  const active=withoutHistory(merged.view),checkpointed=replaceNavigationEntry(merged.view.navigationHistory,{view:active,scroll:{roi:77}});
  assert.deepEqual(checkpointed.entries[0],original);assert.equal(checkpointed.index,1);assert.deepEqual(checkpointed.entries[1].view,active);
  const pushed=pushNavigation(checkpointed,{view:validateViewState({mode:'research'}),scroll:{reading:8}});
  const backB=goBack(pushed.history),backA=goBack(backB.history);assert.equal(backB.target.view.roi.snapshotId,'rerun-B');assert.deepEqual(backB.target.scroll,{roi:77});assert.deepEqual(backA.target,original);
  const revisited=await stageWorkspaceChange({...merged,view:{...backA.target.view,navigationHistory:backA.history}},{current:merged});assert.equal(revisited.next.roiSnapshot.id,'original-A');assert.equal(revisited.next.recomputedSnapshot.id,'rerun-B');
 }
});

test('R2 selected incoming visit is retained only when it represents the active view',async()=>{
 const original={view:validateViewState({coordinate:[1,2,3]}),scroll:{reading:123}},current=project('A',{view:{...original.view,navigationHistory:{projectId:'A',index:0,entries:[original]}}});
 const active=validateViewState({coordinate:[9,8,7]}),prior=validateViewState({coordinate:[7,8,9]});
 for(const selected of [active,prior]){
  const incoming=project('B',{view:{...active,navigationHistory:{projectId:'B',index:0,entries:[{view:selected,scroll:{reading:456}}]}}});
  const merged=(await stageProjectImport(await serializeProject(incoming),{current,mode:'merge'})).next;
  const h=merged.view.navigationHistory;assert.deepEqual(h.entries[0],original);
  assert.equal(h.entries.length,selected===active?2:3);assert.equal(h.index,h.entries.length-1);
  assert.deepEqual(h.entries[h.index].view,withoutHistory(merged.view));
  assert.deepEqual(h.entries[1].scroll,{reading:456});if(selected===active)assert.equal(h.index,1);
 }
});

test('R2 full history refuses a needed active visit atomically; 49 visits plus the new visit are admitted',async()=>{
 for(const count of [49,50])for(const empty of [false,true]){
  const entries=Array.from({length:count},(_,i)=>({view:validateViewState({coordinate:[i,0,0]}),scroll:{reading:i}}));
  const initial=project('A',{view:{...entries.at(-1).view,navigationHistory:{projectId:'A',index:count-1,entries}}});
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},session=createWorkspaceSession({storage,initial});
  session.commit(await stageWorkspaceChange(session.getSnapshot(),{current:session.getSnapshot()}));const base=session.getSnapshot(),before=[...data];
  const incoming=project('B',{view:{...validateViewState({coordinate:[99,98,97]}),...(empty?{navigationHistory:{projectId:'B',index:-1,entries:[]}}:{})}}),text=await serializeProject(incoming);
  if(count===50){await assert.rejects(stageProjectImport(text,{current:base,mode:'merge'}),/navigation history capacity.*Export/);assert.strictEqual(session.getSnapshot(),base);assert.deepEqual([...data],before);}
  else{const stage=await stageProjectImport(text,{current:base,mode:'merge'});assert.equal(stage.next.view.navigationHistory.entries.length,50);assert.equal(stage.next.view.navigationHistory.index,49);assert.deepEqual(stage.next.view.navigationHistory.entries.slice(0,49),entries);}
 }
});

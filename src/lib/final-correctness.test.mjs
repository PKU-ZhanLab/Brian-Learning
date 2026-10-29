import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLocalVolumeProvenance} from './computation-manifest.js';
import {serializeProject,parseProject,prepareProjectPayload,validateViewState,encodeView,decodeView} from './workspace-project.js';
import {createWorkspaceSession,stageWorkspaceChange,stageProjectImport,restoreWorkspaceInitial,downloadRecoveryArchive,acknowledgeRecoveryArchive,WORKSPACE_STORAGE_KEY} from './workspace-session.js';
import {emptyEvidence} from './evidence-schema.js';
import {buildEvidencePackage,getBuiltinEvidenceBundle,validateEvidencePackageClosure} from './evidence-package.js';
import {mergeEvidence} from './evidence-workspace.js';
import {verifySourceArtifact,sourceExcerptBytes,auditTranscription} from './source-artifact.js';
import {replaceCustomVolumes,listCustomVolumes,getCustomVolume} from './custom-volumes.js';
import {loadAtlas,atlasResourceKeyFor,loadAtlasVersion} from './volume.js';
import {getResourceState,subscribe} from './atlas-resource.js';
import {canLinkCoordinates} from './comparison-link.js';
import {makeAtlasRegionRef} from './atlas-identity.js';
import {planProjectExport,planRecoveryArchive} from './workspace-assets.js';
import {createDraftManager} from './draft-store.js';

const affine=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const project=(projectId='A',extra={})=>({projectId,revision:0,view:validateViewState({}),notes:[],drafts:[],evidence:emptyEvidence(),volumes:[],roiSnapshot:null,recomputedSnapshot:null,...extra});
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),entries:()=>[...data.entries()]};};
const local=async(extra={})=>prepareLocalVolumeProvenance({id:'custom-a',name:'same.nii',data:Uint8Array.of(1),shape:[1,1,1],affine,order:'x-fastest',kind:'label',space:'MNI152NLin6Asym',labels:[{id:1,name:'A label'}],alignmentStatus:'user-declared',canOverlayOnTarget:true,provenance:'A declared alignment',...extra},Uint8Array.of(1),{id:'same.nii'});

test('I1 same bytes remain independently owned; replacement retires the old ready value',async()=>{
 const a=await local();replaceCustomVolumes('A',[a,{...a,id:'custom-b',labels:[{id:1,name:'Second label'}]}]);
 const first=await loadAtlas('custom-a'),second=await loadAtlas('custom-b');
 assert.equal(first.id,'custom-a');assert.equal(second.id,'custom-b');assert.equal(second.labels[0].name,'Second label');assert.deepEqual(first.identity,second.identity);
 assert.notEqual(atlasResourceKeyFor(getCustomVolume('custom-a')),atlasResourceKeyFor(getCustomVolume('custom-b')));
 await assert.rejects(loadAtlasVersion(a.identity),/ambiguous/);
 const oldKey=atlasResourceKeyFor(getCustomVolume('custom-a'));
 let observedDuringRetirement;const stop=subscribe(oldKey,state=>{if(state.status==='error')observedDuringRetirement=getCustomVolume('custom-a')?.labels[0].name;});
 replaceCustomVolumes('B',[{...a,labels:[{id:1,name:'B label'}],provenance:'B provenance',spatialEvidence:{...a.spatialEvidence,provenance:'B provenance'}}]);
 stop();assert.equal(observedDuringRetirement,'B label');
 const next=await loadAtlas('custom-a');assert.notStrictEqual(next,first);assert.equal(next.labels[0].name,'B label');assert.equal(next.provenance,'B provenance');assert.equal(next.spatialEvidence.provenance,'B provenance');assert.equal(getResourceState(oldKey).value,null);
 // Same-project replacement also creates a new metadata lifetime.
 replaceCustomVolumes('B',[{...a,labels:[{id:1,name:'B revised'}]}]);assert.equal((await loadAtlas('custom-a')).labels[0].name,'B revised');
});

test('I1 late A resource completion cannot publish after B owns the same ID',async()=>{
 const a=await local({surfaceProjection:'synthetic-project-surface.json'}),original=globalThis.fetch;
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});
 globalThis.fetch=async()=>({ok:true,json:async()=>{entered();await new Promise(resolve=>{release=resolve;});return {atlases:{'custom-a':{sourceSha256:a.identity.sha256,hemispheres:{}}}};}});
 try{
  replaceCustomVolumes('A',[a]);const key=atlasResourceKeyFor(getCustomVolume('custom-a'));
  const pending=loadAtlas('custom-a');const rejected=assert.rejects(pending,/expired/);await started;
  const {surfaceProjection,...b}=a;replaceCustomVolumes('B',[{...b,labels:[{id:1,name:'B current'}]}]);
  const current=await loadAtlas('custom-a');release();await rejected;
  assert.equal(current.labels[0].name,'B current');assert.strictEqual(await loadAtlas('custom-a'),current);assert.equal(getResourceState(key).value,null);
 }finally{globalThis.fetch=original;}
});

test('I1 note commits keep unchanged custom resource lifetime',async()=>{
 const session=createWorkspaceSession({storage:storage(),initial:project('A',{volumes:[await local()]})});
 const before=await loadAtlas('custom-a'),key=atlasResourceKeyFor(getCustomVolume('custom-a'));
 await session.transact(base=>({...base,notes:[{id:'note',text:'annotation'}]}));
 assert.equal(atlasResourceKeyFor(getCustomVolume('custom-a')),key);assert.strictEqual(await loadAtlas('custom-a'),before);
});

test('I1 a local entry cannot shadow a verified public identity',async()=>{
 const a=await local(),publicMetadata={available:true,atlasVersion:'public-v1',sha256:a.identity.sha256,spaceId:a.space,space:a.space,data:'synthetic-public.bin',shape:a.shape,affine:a.affine,order:'x-fastest',dtype:'uint8',labels:[{id:1,name:'Public label'}]},original=globalThis.fetch;
 globalThis.fetch=async url=>String(url).endsWith('asset-identities.json')?{ok:true,json:async()=>({assets:{}})}:String(url).endsWith('manifest.json')?{ok:true,json:async()=>({atlases:{public:publicMetadata}})}:{ok:true,arrayBuffer:async()=>Uint8Array.of(1).buffer};
 try{
  replaceCustomVolumes('A',[]);const published=await loadAtlas('public');
  replaceCustomVolumes('B',[{...a,identity:published.identity,labels:[{id:1,name:'Private label'}]}]);
  assert.strictEqual(await loadAtlas('public'),published);assert.strictEqual(await loadAtlasVersion(published.identity),published);assert.equal((await loadAtlas('custom-a')).labels[0].name,'Private label');
 }finally{globalThis.fetch=original;}
});

const paper=()=>buildEvidencePackage({paperIds:['axelrod2015'],bundle:getBuiltinEvidenceBundle()});
const assertSources=bundle=>{for(const artifact of bundle.sourceArtifacts)assert.deepEqual(verifySourceArtifact(artifact,sourceExcerptBytes(artifact)),{valid:true,errors:[]});assert.equal(validateEvidencePackageClosure(bundle).valid,true);};
async function assertRefusedUnchanged(current,incoming,pattern){
 const store=storage(),session=createWorkspaceSession({storage:store,initial:current});
 session.commit(await stageWorkspaceChange(session.getSnapshot(),{current:session.getSnapshot()}));
 const before=session.getSnapshot(),bytes=store.entries(),assets=listCustomVolumes(before.projectId);
 await assert.rejects(stageProjectImport(await serializeProject(incoming),{current:before,mode:'merge'}),pattern);
 assert.strictEqual(session.getSnapshot(),before);assert.deepEqual(store.entries(),bytes);assert.deepEqual(listCustomVolumes(before.projectId),assets);
}

test('I2 immutable reference, result, location and artifact collisions refuse atomically',async()=>{
 const original=paper();assertSources(original);
 for(const kind of ['references','results','locations','sourceArtifacts']){
  const changed=structuredClone(original);
  if(kind==='references')changed.references[0].title='Different current title';
  if(kind==='results')changed.results[0].finding.en='Different current finding';
  if(kind==='locations')changed.locations[0].xyz[0]+=1;
  if(kind==='sourceArtifacts')changed.sourceArtifacts[0].note='Different artifact record';
  await assertRefusedUnchanged(project('A',{evidence:changed}),project('B',{evidence:original}),/Cannot merge immutable source bindings.*Export/);
 }
 assertSources(original);
});

test('I2 established aliases and source anchors survive independent merge/export',async()=>{
 const original=paper(),base={...emptyEvidence(),references:original.references.map(r=>({...r,id:'canonical-axelrod'}))};
 const incoming=mergeEvidence(base,original);assert.equal(incoming.referenceAliases.length,1);assertSources(incoming);
 const stage=await stageProjectImport(await serializeProject(project('B',{evidence:incoming})),{current:project(),mode:'merge'});
 assert.deepEqual(stage.next.evidence.sourceArtifacts,incoming.sourceArtifacts);assert.deepEqual(stage.next.evidence.referenceAliases,incoming.referenceAliases);assertSources(stage.next.evidence);
 const reopened=await parseProject(await serializeProject(stage.next));assertSources(reopened.evidence);
 assert.deepEqual(auditTranscription(reopened.evidence),auditTranscription(incoming));
 const identical=await stageProjectImport(await serializeProject(project('B',{evidence:incoming})),{current:stage.next,mode:'merge'});assert.deepEqual(identical.next.evidence.sourceArtifacts,incoming.sourceArtifacts);
});

test('I2 incompatible alias snapshots refuse without silently replacing history',async()=>{
 const original=paper(),base={...emptyEvidence(),references:original.references.map(r=>({...r,id:'canonical-axelrod'}))},aliased=mergeEvidence(base,original),other=structuredClone(aliased);
 other.referenceAliases[0].originalReference.title='Other historical title';
 await assertRefusedUnchanged(project('A',{evidence:aliased}),project('B',{evidence:other}),/Cannot merge historical reference aliases.*Export/);
});

test('I2 an established alias can losslessly follow a remapped canonical reference',async()=>{
 const original=paper(),aliased=mergeEvidence({...emptyEvidence(),references:original.references.map(r=>({...r,id:'canonical-axelrod'}))},original);
 const current=project('A',{evidence:{...emptyEvidence(),references:aliased.references.map(r=>({...r,title:'A separate current title'}))}});
 const stage=await stageProjectImport(await serializeProject(project('B',{evidence:aliased})),{current,mode:'merge',makeId:()=> 'canonical-incoming'});
 assert.equal(stage.next.evidence.referenceAliases[0].canonicalId,'canonical-incoming');assert.deepEqual(stage.next.evidence.referenceAliases[0].originalReference,aliased.referenceAliases[0].originalReference);assert.deepEqual(stage.next.evidence.sourceArtifacts,aliased.sourceArtifacts);
 const restored=await parseProject(await serializeProject(stage.next));assertSources(restored.evidence);
 const expected=auditTranscription(aliased);expected.coverage.fields=expected.coverage.fields.map(path=>path.replace('references/canonical-axelrod/','references/canonical-incoming/')).sort();assert.deepEqual(auditTranscription(restored.evidence),expected);
});

const snapshot=id=>({id,metrics:{dice:.25},status:'missing-provenance'});
test('I3 occupied original and recomputed slots refuse atomically',async()=>{
 for(const key of ['roiSnapshot','recomputedSnapshot'])await assertRefusedUnchanged(project('A',{[key]:snapshot('original-A')}),project('B',{[key]:snapshot('original-B'),view:validateViewState({roi:{snapshot:key==='roiSnapshot'?'original':'recomputed',snapshotId:'original-B'}})}),/Cannot merge occupied computation history.*Export/);
});
test('I3 identical histories and non-overlapping slots remain lossless',async()=>{
 const current=project('A',{roiSnapshot:snapshot('same'),view:validateViewState({roi:{snapshot:'original',snapshotId:'same'}})});
 const incoming=project('B',{roiSnapshot:snapshot('same'),recomputedSnapshot:snapshot('recomputed'),view:validateViewState({roi:{snapshot:'recomputed',snapshotId:'recomputed'}})});
 const stage=await stageProjectImport(await serializeProject(incoming),{current,mode:'merge'});
 assert.equal(stage.next.roiSnapshot.id,'same');assert.equal(stage.next.recomputedSnapshot.id,'recomputed');assert.equal(stage.next.view.roi.snapshotId,'recomputed');
 const reopened=await parseProject(await serializeProject(stage.next));assert.equal(reopened.roiSnapshot.id,'same');assert.equal(reopened.recomputedSnapshot.id,'recomputed');
});

test('I3 merged navigation retains both saved-history bindings',async()=>{
 const withHistory=(id,slot,snapshotId)=>validateViewState({roi:{snapshot:slot,snapshotId},navigationHistory:{projectId:id,index:0,entries:[{view:validateViewState({roi:{snapshot:slot,snapshotId}}),scroll:{roi:22}}]}});
 const current=project('A',{roiSnapshot:snapshot('original'),view:withHistory('A','original','original')});
 const incoming=project('B',{recomputedSnapshot:snapshot('rerun'),view:withHistory('B','recomputed','rerun')});
 const stage=await stageProjectImport(await serializeProject(incoming),{current,mode:'merge'});
 assert.deepEqual(stage.next.view.navigationHistory.entries.map(e=>e.view.roi.snapshotId),['original','rerun']);assert.equal(stage.next.view.navigationHistory.projectId,'A');
 const broken=project('C',{roiSnapshot:snapshot('original'),view:withHistory('C','original','other')});await assert.rejects(stageProjectImport(await serializeProject(broken),{current,mode:'merge'}),/Cannot merge.*history view/);
});

test('I3 merging beyond bounded navigation capacity refuses instead of pruning visits',async()=>{
 const history=(projectId,start)=>({projectId,index:29,entries:Array.from({length:30},(_,i)=>({view:validateViewState({coordinate:[start+i,0,0]}),scroll:{}}))});
 await assertRefusedUnchanged(project('A',{view:validateViewState({navigationHistory:history('A',0)})}),project('B',{view:validateViewState({navigationHistory:history('B',30)})}),/Cannot merge navigation history capacity.*Export/);
});

test('I4 persist, refresh, navigation, new notes and drafts save without session images',async()=>{
 const store=storage(),volume=await local(),view=validateViewState({atlas:'custom-a',roi:{aAtlas:'custom-a',bAtlas:'dk'},navigationHistory:{projectId:'A',index:1,entries:[{view:validateViewState({atlas:'dk'}),scroll:{}},{view:validateViewState({roi:{aAtlas:'custom-a',bAtlas:'dk'}}),scroll:{}}]}});
 const note={id:'historical',text:'Keep this annotation',regionRef:{atlasId:'custom-a',atlasVersion:'v1',labelId:1,hemisphere:'U',spaceId:'MNI152NLin6Asym'}};
 const original=project('A',{volumes:[volume],view,notes:[note],roiSnapshot:{...snapshot('original'),A:{atlasId:'custom-a'}}}),full=await serializeProject(original);
 const first=createWorkspaceSession({storage:store,initial:original});first.commit(await stageWorkspaceChange(first.getSnapshot(),{current:first.getSnapshot()}));const raw=store.getItem(WORKSPACE_STORAGE_KEY);
 const restored=restoreWorkspaceInitial({storage:store,fallback:project('unused')});assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),raw);assert.equal(restored.volumes.length,0);assert.equal(restored.view.atlas,'dk');assert.equal(restored.view.navigationHistory.entries.length,1);assert.deepEqual(restored.missingAssetIds,['custom-a']);assert.equal(restored.notes[0].text,note.text);assert.equal(restored.roiSnapshot.id,'original');assert.equal(restored.roiSnapshot.status,'missing-input');assert.equal(restored.startupRecovery.originalEnvelope,raw);
 const next=createWorkspaceSession({storage:store,initial:restored});await next.transact(base=>({...base,view:validateViewState({...base.view,mode:'research'}),notes:[...base.notes,{id:'new',text:'New work'}],drafts:[{id:'draft',projectId:'A',kind:'result',recordId:null,payload:{finding:'Draft'},updatedAt:'2026-10-30T00:00:00Z'}]}));
 const second=restoreWorkspaceInitial({storage:store,fallback:project()});assert.equal(second.notes.length,2);assert.equal(second.drafts.length,1);assert.equal(second.startupRecovery.originalEnvelope,raw);
 const merged=await stageProjectImport(await serializeProject(project('other')),{current:next.getSnapshot(),mode:'merge'});assert.equal(merged.next.startupRecovery.originalEnvelope,raw);
 const recovered=await stageProjectImport(full,{current:next.getSnapshot(),mode:'open'});assert.equal(recovered.next.volumes.length,1);assert.equal(recovered.next.view.atlas,'custom-a');assert.equal(recovered.next.roiSnapshot.id,'original');assert.deepEqual(recovered.next.missingAssetIds,[]);assert.equal(recovered.next.startupRecovery,undefined);
 // Recovery is startup-only; ordinary broken file imports remain strict.
 const broken=JSON.parse(full);broken.volumes=[];await assert.rejects(stageProjectImport(JSON.stringify(broken),{current:next.getSnapshot()}),/missing-asset/);
});

test('I5 project checks freshly earn derivative verification; flags do not confer spatial authority',async()=>{
 const original=await local(),text=await serializeProject(project('B',{volumes:[original]}));
 replaceCustomVolumes('fresh',[]);const restored=(await parseProject(text)).volumes[0];
 assert.equal(restored.identityVerification,'received-project-derived-bytes');assert.equal(restored.projectEntryObservation.originalSourceBytesEmbedded,false);assert.deepEqual(restored.projectEntryObservation.derivedIdentity,original.identity);assert.equal(canLinkCoordinates(restored,restored).allowed,true);
 for(const edit of [p=>{p.volumes[0].volumeProvenance.identity.sha256='0'.repeat(64);},p=>{p.volumes[0].volumeProvenance.sourceGrid.affine[3]=2;},p=>{p.volumes[0].niftiGzip=p.volumes[0].niftiGzip.slice(4);}]){const p=JSON.parse(text);edit(p);await assert.rejects(parseProject(JSON.stringify(p)));}
 const noEvidence=JSON.parse(text);noEvidence.volumes[0].identityVerification='received-bytes';noEvidence.volumes[0].volumeProvenance.spatialEvidence={};const no=(await parseProject(JSON.stringify(noEvidence))).volumes[0];assert.equal(canLinkCoordinates(no,no).allowed,false);
 const unproven=JSON.parse(text);unproven.volumes[0].metadata.alignmentStatus='unverified';unproven.volumes[0].metadata.canOverlayOnTarget=false;const un=(await parseProject(JSON.stringify(unproven))).volumes[0];assert.equal(canLinkCoordinates(un,un).allowed,false);
 const unknown=await local({space:'native-unverified',alignmentStatus:'unverified',canOverlayOnTarget:false});const u=(await parseProject(await serializeProject(project('U',{volumes:[unknown]})))).volumes[0];assert.equal(canLinkCoordinates(u,u).allowed,false);
 assert.throws(()=>makeAtlasRegionRef('custom-a',{...restored,atlasVersion:restored.identity.version},1),/source|provenance|dictionary/i);
});

async function recoveredWorkspace(note='retained private note'){
 const store=storage(),session=createWorkspaceSession({storage:store,initial:project('A',{volumes:[await local()],notes:[{id:'original-note',text:note}]})});
 session.commit(await stageWorkspaceChange(session.getSnapshot(),{current:session.getSnapshot()}));
 return restoreWorkspaceInitial({storage:store,fallback:project()});
}
test('I4 recovery envelopes remain portable but opaque and excluded from public/evidence projections',async()=>{
 const recovered=await recoveredWorkspace(),raw=recovered.startupRecovery.originalEnvelope;
 const prepared=await prepareProjectPayload(recovered),text=prepared.text,restored=await parseProject(text);assert.equal(prepared.usage.projectUtf8Bytes,Buffer.byteLength(text,'utf8'));assert.equal(restored.startupRecovery.originalEnvelope,raw);assert.deepEqual(restored.volumes,[]);
 const stage=await stageProjectImport(text,{current:project('other')});assert.equal(stage.next.startupRecovery.originalEnvelope,raw);
 const forged=JSON.parse(text);forged.view.atlas='custom-a';await assert.rejects(stageProjectImport(JSON.stringify(forged),{current:project('other')}),/missing-asset/);
 const encoded=encodeView({...restored.view,startupRecovery:restored.startupRecovery}),view=decodeView(encoded.encoded);assert.equal(JSON.stringify(view).includes('retained private note'),false);assert.equal(view.startupRecovery,undefined);
 assert.equal(JSON.stringify(buildEvidencePackage({paperIds:['axelrod2015'],bundle:getBuiltinEvidenceBundle(),startupRecovery:restored.startupRecovery})).includes('retained private note'),false);
 const withAssets={...restored,volumes:[await local({id:'custom-new'}),await local({id:'custom-other'})]};
 assert.throws(()=>planProjectExport(withAssets,{assetIds:['custom-new'],dependentPolicy:'detach'}),/recovery.*full project/i);
 assert.equal(planProjectExport(withAssets,{assetIds:['custom-new','custom-other'],dependentPolicy:'detach'}).workspace.startupRecovery.originalEnvelope,raw);
});
test('I4 distinct recovery originals cannot be silently merged; malformed and oversized records reject',async()=>{
 const current=await recoveredWorkspace('one'),incoming=await recoveredWorkspace('two');incoming.projectId='B';
 await assertRefusedUnchanged(current,incoming,/Cannot merge.*recovery.*Export/);
 const text=await serializeProject(current),p=JSON.parse(text);
 const invalid=[{...current.startupRecovery,originalEnvelope:'not JSON'},{...current.startupRecovery,unavailableAssetIds:['not-custom']},{...current.startupRecovery,originalEnvelope:JSON.stringify({schema:WORKSPACE_STORAGE_KEY,startupRecovery:{}})}];
 for(const startupRecovery of invalid){await assert.rejects(serializeProject({...current,startupRecovery}));await assert.rejects(parseProject(JSON.stringify({...p,startupRecovery})));}
 const oversized={...current.startupRecovery,originalEnvelope:'x'.repeat(32*1024*1024+1)};
 await assert.rejects(serializeProject({...current,startupRecovery:oversized}),/budget/);await assert.rejects(parseProject(JSON.stringify({...p,startupRecovery:oversized})),/budget/);
});

test('I4 archiving requires separate saved-file acknowledgement; failure and cancellation retain originals',async()=>{
 const recovered=await recoveredWorkspace(),store=storage(),session=createWorkspaceSession({storage:store,initial:recovered}),before=session.getSnapshot();
 const plan=planRecoveryArchive(before),stage=await stageWorkspaceChange(plan.next,{current:before,preview:plan.preview}),entries=store.entries();
 await assert.rejects(stageWorkspaceChange(plan.next,{current:before}),/recovery-archive-required/);
 assert.throws(()=>session.commit(stage),/acknowledgement-required/);
 await assert.rejects(downloadRecoveryArchive(stage,()=>{throw Error('download blocked');}),/download blocked/);
 assert.throws(()=>acknowledgeRecoveryArchive(stage),/download-required/);
 // Download requested, then picker cancelled or user has not acknowledged saving.
 await downloadRecoveryArchive(stage,text=>assert.equal(text,recovered.startupRecovery.originalEnvelope));
 assert.throws(()=>session.commit(stage),/acknowledgement-required/);assert.strictEqual(session.getSnapshot(),before);assert.deepEqual(store.entries(),entries);
 acknowledgeRecoveryArchive(stage);const write=store.setItem;store.setItem=()=>{throw Error('quota');};assert.throws(()=>session.commit(stage),/quota/);assert.strictEqual(session.getSnapshot(),before);assert.deepEqual(store.entries(),entries);
 store.setItem=write;session.commit(stage);assert.equal(session.getSnapshot().startupRecovery,undefined);assert.deepEqual(session.getSnapshot().notes,before.notes);assert.deepEqual(session.getSnapshot().missingAssetIds,before.missingAssetIds);
});

test('I4 a large valid old envelope has an explicit archive path to normal export/open and continued saves',async()=>{
 const retainedLength=8.5*1024*1024;
 const store=storage(),initial=project('A',{volumes:[await local()],notes:[{id:'retained',text:'Research remains'}],evidence:{...emptyEvidence(),legacyImports:[{schema:'brain-evidence-v1',text:'\\'.repeat(retainedLength)}]}});
 const old=createWorkspaceSession({storage:store,initial});old.commit(await stageWorkspaceChange(old.getSnapshot(),{current:old.getSnapshot()}));const original=store.getItem(WORKSPACE_STORAGE_KEY);
 assert.ok(Buffer.byteLength(original)<32*1024*1024);
 assert.ok(Buffer.byteLength(JSON.stringify({originalEnvelope:original}))>32*1024*1024);
 const recovered=restoreWorkspaceInitial({storage:store,fallback:project()}),session=createWorkspaceSession({storage:store,initial:recovered}),base=session.getSnapshot();
 assert.equal(base.startupRecovery.originalEnvelope,original);await assert.rejects(stageWorkspaceChange(base,{current:base}),/workspace-storage-budget/);assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),original);
 const manager=createDraftManager(session);manager.update({id:'pending',projectId:'A',kind:'result',recordId:null,payload:{finding:'Unsaved before archive'},updatedAt:'2026-10-30T00:00:00Z'});
 const plan=planRecoveryArchive(base),stage=await stageWorkspaceChange(plan.next,{current:base,preview:plan.preview});
 await downloadRecoveryArchive(stage,text=>assert.equal(text,original));acknowledgeRecoveryArchive(stage);session.commit(stage);assert.equal(manager.getSnapshot().dirty,true);await manager.flush();assert.equal(manager.getSnapshot().dirty,false);
 await session.transact(current=>({...current,view:validateViewState({...current.view,mode:'research'}),notes:[...current.notes,{id:'new',text:'Continue safely'}]}));
 const current=session.getSnapshot(),exportPlan=planProjectExport(current,{assetIds:[],dependentPolicy:'include'}),exported=await stageWorkspaceChange(exportPlan.workspace,{current,preview:exportPlan.preview});
 const parsed=await parseProject(exported.projectText),opened=await stageProjectImport(exported.projectText,{current:project('other')});
 assert.equal(parsed.startupRecovery,undefined);assert.equal(opened.next.notes.length,2);assert.equal(opened.next.drafts[0].payload.finding,'Unsaved before archive');assert.deepEqual(opened.next.missingAssetIds,['custom-a']);assert.equal(opened.next.evidence.legacyImports[0].text.length,retainedLength);
});

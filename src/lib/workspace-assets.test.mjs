import test from 'node:test';
import assert from 'node:assert/strict';
import {planAssetRemoval,planProjectExport,describeWorkspaceAssets} from './workspace-assets.js';
import {stageWorkspaceChange,createWorkspaceSession,mergeWorkspace} from './workspace-session.js';
import {serializeProject,parseProject} from './workspace-project.js';
import {emptyEvidence} from './evidence-schema.js';
import {prepareLocalVolumeProvenance} from './computation-manifest.js';
import {exportNifti} from './nifti.js';

const volume=id=>({id,name:id,kind:'label',space:'native-unverified',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],labels:[]});
const workspace=()=>({projectId:'B',revision:0,volumes:[volume('custom-a'),volume('custom-b')],notes:[{id:'note',text:'Keep this research',structureName:'',position:null,coordinateSpace:'',coordinateFrame:'',createdAt:'2026-10-29T00:00:00Z',regionRef:{atlasId:'custom-a',atlasVersion:'v1',spaceId:'native-a',labelId:1,hemisphere:'L'}}],evidence:emptyEvidence(),drafts:[],view:{atlas:'dk',roi:{aAtlas:'custom-a',aLabels:[1],aThreshold:.7,aTail:'absolute',bAtlas:'custom-b',bLabels:[2],bThreshold:.2,bTail:'negative',computed:true},atlasExplorer:{atlas:'custom-a',selected:[1]},atlasExplorerOpen:true},roiSnapshot:{id:'historical',dice:.42,counts:{A:5,B:7},descriptors:{A:{atlasId:'custom-a'},B:{atlasId:'custom-b'}},manifest:{inputs:[{id:'custom-a'},{id:'custom-b'}]}},recomputedSnapshot:null});

test('paired sources detach missing private assets and merge every source identity edge',async()=>{
 const before=workspace();before.view.roi.paired={open:true,linkCamera:false,linkCrosshair:true,left:{assetId:'custom-a',identity:{id:'custom-a',version:'v1',sha256:'a'.repeat(64),spaceId:null},point:[100.125,2,3],camera:null},right:{assetId:'custom-b',identity:null,point:[1,2,3],camera:null}};
 const detached=planAssetRemoval(before,'custom-a').next;
 assert.equal(detached.view.roi.paired.left.assetId,'');assert.equal(detached.view.roi.paired.left.identity,null);assert.equal(detached.view.roi.paired.right.assetId,'custom-b');
 const incoming=structuredClone(before);incoming.volumes[0].data=Uint8Array.of(2);
 const merged=mergeWorkspace(before,incoming,()=> 'custom-remapped').snapshot;
 assert.equal(merged.view.roi.paired.left.assetId,'custom-remapped');assert.equal(merged.view.roi.paired.left.identity.id,'custom-remapped');
});
test('paired canonical derived byte identities are not mistaken for catalog asset IDs',async()=>{
 const before=workspace();before.notes=[];before.roiSnapshot=null;
 before.volumes[0]=await prepareLocalVolumeProvenance({...before.volumes[0],order:'x-fastest'},exportNifti(before.volumes[0]),{id:'custom-a'});
 before.view.roi.paired={left:{assetId:'custom-a',identity:before.volumes[0].identity,point:[1.25,2,3]},right:{assetId:'custom-b',identity:null,point:[0,0,0]}};
 const staged=await stageWorkspaceChange(before,{current:workspace()});assert.equal(staged.next.view.roi.paired.left.identity.id,'custom-a:derived:uint8:little-endian');
});

test('only current project assets are exportable',()=>{
 const B=workspace();assert.throws(()=>planProjectExport(B,{assetIds:['custom-A-private'],dependentPolicy:'include'}),/foreign-asset/);
 B.volumes.push({...volume('custom-foreign'),projectId:'A'});assert.throws(()=>planProjectExport(B,{assetIds:['custom-foreign'],dependentPolicy:'detach'}),/foreign-asset/);
 assert.deepEqual(describeWorkspaceAssets(B).map(a=>a.id),['custom-a','custom-b']);
});

test('removal detaches references without deleting research or the other ROI side',async()=>{
 const before=workspace(),copy=structuredClone(before),removal=planAssetRemoval(before,'custom-a');
 assert.deepEqual(removal.next.notes,before.notes);assert.deepEqual(removal.next.evidence,before.evidence);
 assert.equal(removal.next.roiSnapshot.status,'missing-input');assert.equal(removal.next.roiSnapshot.dice,.42);
 assert.deepEqual(removal.next.roiSnapshot.counts,{A:5,B:7});assert.equal(removal.next.roiSnapshot.manifest.inputs[0].id,'custom-a');
 assert.equal(removal.next.view.roi.aAtlas,'');assert.deepEqual(removal.next.view.roi.aLabels,[]);assert.equal(removal.next.view.roi.computed,false);
 for(const key of ['bAtlas','bLabels','bThreshold','bTail'])assert.deepEqual(removal.next.view.roi[key],before.view.roi[key]);
 assert.equal(removal.next.view.atlasExplorerOpen,false);assert.ok(removal.dependentViewFields.includes('atlasExplorer'));
 assert.ok(removal.dependentResults.includes('roiSnapshot'));assert.deepEqual(before,copy);
 const staged=await stageWorkspaceChange(removal.next,{current:before});assert.equal(staged.next.roiSnapshot.status,'missing-input');
 assert.equal(staged.next.view.roi.aAtlas,'');
});

test('missing declarations admit history but never a live view or undeclared dangling reference',async()=>{
 const current=workspace(),removed=planAssetRemoval(current,'custom-a').next;
 await assert.rejects(stageWorkspaceChange({...removed,view:current.view},{current}),/missing-asset/);
 await assert.rejects(stageWorkspaceChange({...removed,missingAssetIds:[]},{current}),/missing-asset/);
 await assert.rejects(stageWorkspaceChange({...removed,roiSnapshot:{...removed.roiSnapshot,status:'matched'}},{current}),/missing-input-status/);
 const stage=await stageWorkspaceChange(removed,{current});const storage={setItem(){}};const session=createWorkspaceSession({storage,initial:current});
 const published=await stageWorkspaceChange(removed,{current:session.getSnapshot()});session.commit(published);assert.deepEqual(session.getSnapshot().missingAssetIds,['custom-a']);assert.deepEqual(stage.next.notes,current.notes);
});

test('merge collision maps cannot attach a missing historical identity to incoming or current bytes',async()=>{
 const original=workspace(),removed=planAssetRemoval(original,'custom-a').next,incoming={...workspace(),notes:[],view:{atlas:'dk'},roiSnapshot:null,volumes:[volume('custom-a')]};
 const makeId=()=> 'custom-separated';
 const forward=mergeWorkspace(removed,incoming,makeId);assert.deepEqual(forward.snapshot.missingAssetIds,['custom-a']);assert.ok(forward.snapshot.volumes.some(v=>v.id==='custom-separated'));assert.equal(forward.snapshot.notes[0].regionRef.atlasId,'custom-a');
 const reverse=mergeWorkspace(incoming,removed,makeId);assert.deepEqual(reverse.snapshot.missingAssetIds,['custom-separated']);assert.equal(reverse.snapshot.notes[0].regionRef.atlasId,'custom-separated');assert.equal(reverse.snapshot.roiSnapshot.manifest.inputs[0].id,'custom-separated');
 await stageWorkspaceChange(forward.snapshot,{current:removed});await stageWorkspaceChange(reverse.snapshot,{current:incoming});
});

test('selection export is explicit and pure with exact include closure and detach preview',()=>{
 const current=workspace(),before=structuredClone(current);
 const detached=planProjectExport(current,{assetIds:[],dependentPolicy:'detach'});
 assert.deepEqual(detached.workspace.volumes,[]);assert.deepEqual(detached.preview.includedAssetIds,[]);
 assert.ok(detached.preview.dependentViewFields.includes('roi.aAtlas'));assert.ok(detached.preview.dependentResults.includes('roiSnapshot'));
 assert.equal(detached.workspace.roiSnapshot.status,'missing-input');assert.equal(detached.workspace.roiSnapshot.dice,.42);
 const included=planProjectExport(current,{assetIds:[],dependentPolicy:'include'});
 assert.deepEqual(included.preview.includedAssetIds,['custom-a','custom-b']);assert.equal(included.workspace.roiSnapshot.dice,.42);
 assert.deepEqual(current,before);assert.throws(()=>planProjectExport(current,{assetIds:[],dependentPolicy:'guess'}),/invalid-dependent-policy/);
});

test('removing unused invalid metadata permits recovery export and quota failure preserves the original',async()=>{
 const current=workspace();current.roiSnapshot=null;current.notes=[];current.view={atlas:'dk'};current.volumes.push({...volume('custom-bad'),name:'x'.repeat(501)});
 await assert.rejects(stageWorkspaceChange(current,{current}),/name-too-long/);
 const removal=planAssetRemoval(current,'custom-bad');assert.deepEqual(removal.dependentResults,[]);assert.deepEqual(removal.dependentViewFields,[]);
 const stage=await stageWorkspaceChange(removal.next,{current});let fail=true,writes=0;const storage={setItem(){if(fail)throw Error('quota');writes++;}};
 const session=createWorkspaceSession({storage,initial:current});assert.throws(()=>session.commit(stage),/stale-workspace/);
 const atomicStage=await stageWorkspaceChange(removal.next,{current:session.getSnapshot()});assert.throws(()=>session.commit(atomicStage),/quota/);assert.equal(session.getSnapshot().volumes.length,3);
 fail=false;session.commit(atomicStage);assert.equal(writes,1);
 const exported=JSON.parse(await serializeProject(planProjectExport(session.getSnapshot(),{assetIds:['custom-b'],dependentPolicy:'detach'}).workspace));assert.deepEqual(exported.volumes.map(v=>v.id),['custom-b']);
});

test('detached historical note refs survive the sole project codec and session admission',async()=>{
 const current=workspace();current.roiSnapshot=null;
 const detached=planProjectExport(current,{assetIds:['custom-b'],dependentPolicy:'detach'}).workspace;
 const restored=await parseProject(await serializeProject(detached));assert.deepEqual(restored.notes,current.notes);
 const staged=await stageWorkspaceChange(restored,{current});assert.deepEqual(staged.next.notes,current.notes);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as feedback from './workspace-status.js';
import {getBuiltinEvidenceBundle} from './evidence-package.js';
import {buildEvidenceSearchIndex,searchEvidence} from './evidence-search.js';
import {encodeView,decodeView,validateViewState} from './workspace-project.js';
import {stageWorkspaceChange,createWorkspaceSession,WORKSPACE_STORAGE_KEY} from './workspace-session.js';
import {planProjectExport} from './workspace-assets.js';
import {createDraftManager} from './draft-store.js';
import {emptyEvidence} from './evidence-schema.js';
import {MAIN_MANIFEST_RESOURCE,getResourceState,ensureResource,retry,atlasResourceKey} from './atlas-resource.js';
import {loadAtlas,atlasIdentityFor} from './volume.js';

const workspace=()=>({projectId:'feedback-project',revision:0,view:{atlas:'dk'},notes:[],evidence:emptyEvidence(),drafts:[],volumes:[],roiSnapshot:{id:'legacy-result',manifest:null,metrics:{dice:.42}},recomputedSnapshot:null});
const draft=()=>({id:'draft-1',projectId:'feedback-project',kind:'paper',recordId:'paper-1',payload:{id:'paper-1',title:'Current private draft'},updatedAt:'2026-10-30T00:00:00.000Z'});
function storage(){const entries=new Map();return {fail:false,getItem:key=>entries.get(key)??null,setItem(key,value){if(this.fail)throw new DOMException('Native quota reached','QuotaExceededError');entries.set(key,value);}};}

test('structured counts use distinct result references, independently of bibliography and E3 matching/selected papers',()=>{
  const bundle=getBuiltinEvidenceBundle(),hits=searchEvidence(buildEvidenceSearchIndex(bundle),{query:'Bosco'});
  const counts=feedback.summarizeEvidenceCounts(bundle,{matching:hits,selected:[bundle.results[0].referenceId,bundle.results[0].referenceId,'absent']});
  assert.equal(counts.papers,3);assert.equal(counts.results,4);assert.equal(counts.coordinates,8);assert.equal(counts.bibliography,bundle.references.length);
  assert.equal(counts.selected,1);assert.equal(counts.matching.papers,hits.length);
  assert.equal(counts.matching.results,1);assert.equal(counts.matching.coordinates,2);
  const empty=feedback.summarizeEvidenceCounts(bundle,{matching:[],selected:[]});
  assert.deepEqual(empty.matching,{papers:0,structuredPapers:0,results:0,coordinates:0});assert.equal(empty.papers,3);
});

test('matching result-method counts consume E3 result IDs instead of including every result of each matched paper',()=>{
  const bundle=getBuiltinEvidenceBundle();
  // A synthetic method variation in the canonical bundle makes the sibling
  // result in the same paper ineligible without changing E3's input contract.
  bundle.results.find(row=>row.id==='axelrod2015-lffa').modalities=['MEG'];
  const hits=searchEvidence(buildEvidenceSearchIndex(bundle),{resultModality:'fMRI'});
  const counts=feedback.summarizeEvidenceCounts(bundle,{matching:hits});
  assert.equal(counts.matching.papers,1);assert.equal(counts.matching.results,1);assert.equal(counts.matching.coordinates,1);
});

test('full download size uses canonical staged UTF8 including saved computations; image bytes stay separately named',async()=>{
  const base={...workspace(),notes:[{id:'note-utf8',text:'保留完整研究现场'}]},plan=planProjectExport(base,{assetIds:[],dependentPolicy:'include'}),stage=await stageWorkspaceChange(plan.workspace,{current:base,preview:plan.preview});
  const size=feedback.describeProjectExport(stage);
  assert.equal(size.imageCount,0);assert.equal(size.imageBytes,0);assert.equal(size.projectBytes,Buffer.byteLength(stage.projectText));
  assert.ok(size.projectBytes>stage.projectText.length);assert.equal(JSON.parse(stage.projectText).roiSnapshot.metrics.dice,.42);
});

test('public omission feedback consumes projection codes, covers all categories and never includes private text or IDs',()=>{
  const input={coordinateSpace:'private patient reference',coordinate:[1,2,3],camera:{position:[1,2,3],target:[0,0,0]},coordinateOrigin:{kind:'private',explorerSensitive:true},literature:{paperId:'secret-reading',compared:['secret-reading']},atlasExplorer:{atlas:'dk',slicePoint:[7,8,9]},navigationContext:{query:'private query'}};
  const projection=encodeView(input),view=decodeView(projection.encoded);
  assert.equal(view.literature.paperId,null);
  for(const language of ['en','zh']){
    const message=feedback.describePublicLinkOmissions(projection.omitted,language);
    assert.doesNotMatch(message,/secret|patient|private query/);assert.match(message,language==='en'?/project file/:/项目文件/);
    assert.match(message,language==='en'?/reading/:/阅读/);assert.match(message,language==='en'?/position/:/位置/);
    assert.equal(feedback.describePublicLinkOmissions(['resultLayers:secret-layer'],language),feedback.describePublicLinkOmissions(['resultLayers:any-other-private-id'],language));
  }
});

test('native quota and draft-size failures remain actionable while actual manager preserves complete pending edits and prior bytes',async()=>{
  const store=storage(),session=createWorkspaceSession({storage:store,initial:workspace()}),manager=createDraftManager(session);
  manager.update(draft());await manager.flush();const before=store.getItem(WORKSPACE_STORAGE_KEY);
  store.fail=true;const pending={...draft(),payload:{title:'New private draft'}};manager.update(pending);await assert.rejects(manager.flush(),{name:'QuotaExceededError'});
  const message=feedback.normalizeWorkspaceError(manager.getSnapshot().error,'en');assert.match(message,/storage|space/i);assert.doesNotMatch(message,/QuotaExceededError/);
  assert.deepEqual(manager.getSnapshot().records,[pending]);assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),before);
  store.fail=false;const long={...draft(),payload:{title:'中'.repeat(17000)}};manager.update(long);await assert.rejects(manager.flush(),/draft-payload-budget/);
  assert.match(feedback.normalizeWorkspaceError(manager.getSnapshot().error,'en'),/draft.*long|draft.*large/i);assert.deepEqual(manager.getSnapshot().records,[long]);assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),before);
  manager.update(draft());await manager.flush();assert.equal(manager.getSnapshot().dirty,false);
  assert.doesNotMatch(feedback.normalizeWorkspaceError(new SyntaxError('Unexpected token x in JSON'),'en'),/Unexpected token/);
  assert.match(feedback.normalizeWorkspaceError('named-view-project-mismatch','en'),/another project/i);
});

test('first manifest failure uses shared retry with loading then ready while current drafts and saved computation survive',async()=>{
  const original=globalThis.fetch,store=storage(),session=createWorkspaceSession({storage:store,initial:workspace()}),manager=createDraftManager(session);manager.update(draft());
  let calls=0;globalThis.fetch=async()=>++calls===1?{ok:false,status:503}:{ok:true,json:async()=>({atlases:{}})};
  try{
    await ensureResource(MAIN_MANIFEST_RESOURCE);const failed=feedback.resourceFeedback(getResourceState(MAIN_MANIFEST_RESOURCE),'en');
    assert.equal(failed.phase,'error');assert.match(failed.message,/retry/i);assert.doesNotMatch(failed.message,/503|manifest:main/);
    const pending=retry(MAIN_MANIFEST_RESOURCE);assert.equal(feedback.resourceFeedback(getResourceState(MAIN_MANIFEST_RESOURCE),'en').phase,'loading');await pending;
    assert.equal(feedback.resourceFeedback(getResourceState(MAIN_MANIFEST_RESOURCE),'en').phase,'ready');assert.equal(calls,2);assert.equal(manager.getSnapshot().records[0].payload.title,'Current private draft');assert.equal(session.getSnapshot().roiSnapshot.metrics.dice,.42);
  }finally{globalThis.fetch=original;}
});

test('unresolved labels retain source and numeric identity without inventing a region name',()=>{
  const ref={atlasId:'custom-map',atlasVersion:'v1',spaceId:'unknown',labelId:42};
  assert.equal(feedback.selectionLabel(ref,null,'en'),'custom-map · 42');
  assert.equal(feedback.selectionLabel(ref,{name:'Known source label'},'zh'),'42 · Known source label');
  assert.equal(feedback.selectionLabel(ref,{42:{name:'Manifest dictionary label'}},'en'),'42 · Manifest dictionary label');
  assert.equal(feedback.selectionLabel(ref,[{id:42,name:'Manifest array label'}],'en'),'42 · Manifest array label');
});

test('a JSON storage budget is reported as a size failure, separately from actual JSON parse failures',()=>{
  assert.match(feedback.normalizeWorkspaceError('workspace-json-budget','en'),/size|exceeds|large/i);
  assert.doesNotMatch(feedback.normalizeWorkspaceError('workspace-json-budget','en'),/valid project JSON/);
  assert.match(feedback.normalizeWorkspaceError(new SyntaxError('Unexpected token'),'en'),/valid project JSON/);
});

test('one actual atlas resource fails and recovers through S3 without replacing session images, selections or pending drafts',async()=>{
  const original=globalThis.fetch,bytes=new Uint16Array([42]),sha256=createHash('sha256').update(new Uint8Array(bytes.buffer)).digest('hex');
  const metadata={available:true,atlasId:'x8-fixture',atlasVersion:'v1',sha256,spaceId:'native-x8',space:'native-x8',data:'x8-fixture.bin',shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],dtype:'uint16',order:'x-fastest',labels:[{id:42,name:'Source label'}]};
  const initial={...workspace(),view:{atlas:'dk',selectedIds:['precentral-l']},volumes:[{id:'custom-current',name:'Current image',kind:'label',space:'native-unverified',data:Uint8Array.of(7),shape:[1,1,1],affine:metadata.affine,labels:[]}]};
  const session=createWorkspaceSession({storage:storage(),initial}),manager=createDraftManager(session),before=session.getSnapshot();manager.update(draft());
  let attempts=0;
  globalThis.fetch=async url=>String(url).endsWith('asset-identities.json')?{ok:true,json:async()=>({assets:{}})}:String(url).endsWith('manifest.json')?{ok:true,json:async()=>({atlases:{'x8-fixture':metadata}})}:++attempts===1?{ok:false,status:503}:{ok:true,arrayBuffer:async()=>bytes.buffer};
  try{
    await retry(MAIN_MANIFEST_RESOURCE);
    await assert.rejects(loadAtlas('x8-fixture'));
    const key=atlasResourceKey(atlasIdentityFor(metadata));assert.equal(feedback.resourceFeedback(getResourceState(key),'en').phase,'error');
    await retry(key);const atlas=await loadAtlas('x8-fixture');assert.equal(atlas.sampleRAS(0,0,0),42);assert.equal(attempts,2);
    assert.strictEqual(session.getSnapshot(),before);assert.deepEqual(session.getSnapshot().view.selectedIds,['precentral-l']);assert.deepEqual([...session.getSnapshot().volumes[0].data],[7]);assert.deepEqual(manager.getSnapshot().records,[draft()]);
  }finally{globalThis.fetch=original;}
});

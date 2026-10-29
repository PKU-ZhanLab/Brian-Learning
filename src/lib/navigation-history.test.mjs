import test from 'node:test';
import assert from 'node:assert/strict';
import {pushNavigation,goBack,goForward,replaceNavigationEntry,validateNavigationHistory} from './navigation-history.js';
import {validateViewState,encodeView,decodeView,parseProject,serializeProject} from './workspace-project.js';
import {emptyEvidence} from './evidence-schema.js';
import {stageWorkspaceChange,mergeWorkspace,restoreWorkspaceInitial,WORKSPACE_STORAGE_KEY} from './workspace-session.js';
import {planAssetRemoval} from './workspace-assets.js';
import {assignSelectionToOperand} from './selection-handoff.js';
const ref={atlasId:'aal3-registered',atlasVersion:'v1',spaceId:'MNI152NLin6Asym',hemisphere:'U',labelId:134};
const entry=(mode,extra={})=>({view:{mode,coordinate:[1.125,-3.75,9.2],coordinateSpace:null,coordinateOrigin:{kind:'private',cameraSensitive:true,explorerSensitive:true,imported:false},atlasSelection:[ref],atlasSelectionQuery:{atlasId:ref.atlasId,atlasVersion:ref.atlasVersion,coordinate:[1.125,-3.75,9.2],method:'source',requestId:9},roi:{aAtlas:ref.atlasId,aLabels:[134,133],aRegionRefs:[ref],bAtlas:'dk',bLabels:[4],bThreshold:.33,bTail:'negative',snapshot:'original',computed:false},...extra},scroll:{roi:371,literature:0}});
test('independent structure, atlas detail and slice scrolls survive navigation and project serialization',async()=>{
  const current={...entry('anatomy'),scroll:{tree:173,atlas:219,atlasDetails:87,atlasSlices:360,atlasWorkspace:45,model:75,reading:22,left:0,windowY:53}};
  let history=pushNavigation({projectId:'p',entries:[],index:-1},current).history;
  history=pushNavigation(history,entry('research')).history;
  assert.deepEqual(goBack(history).target.scroll,current.scroll);
  const project=await parseProject(await serializeProject({projectId:'p',view:{navigationHistory:history},notes:[],evidence:emptyEvidence(),volumes:[]}));
  assert.deepEqual(goBack(project.view.navigationHistory).target.scroll,current.scroll);
  for(const value of [-1,Infinity,1e8+1])assert.throws(()=>pushNavigation(history,{...current,scroll:{atlasDetails:value}}),/history-scroll/);
  assert.throws(()=>pushNavigation(history,{...current,scroll:{unknown:1}}),/history-scroll/);
});
test('paper navigation restores the actual comparison, selection, unknown space and scroll without mutation',()=>{
  const comparison=entry('roi'),paper=entry('research',{literature:{paperId:'paper-a',compared:['paper-a','paper-b'],showCompare:true,query:'private text'}});
  let history=pushNavigation({projectId:'p',entries:[],index:-1},comparison).history;
  history=pushNavigation(history,paper).history;const before=structuredClone(history),back=goBack(history);
  assert.deepEqual(back.target,comparison);assert.deepEqual(goForward(back.history).target,paper);assert.deepEqual(history,before);
  comparison.view.roi.bThreshold=999;assert.equal(back.target.view.roi.bThreshold,.33);
});
test('history caps at 50, replaces the current location, and forks after back',()=>{
  let h={projectId:'p',entries:[],index:-1};for(let i=0;i<55;i++)h=pushNavigation(h,entry('roi',{selectedIds:[String(i)]}),{limit:50}).history;
  assert.equal(h.entries.length,50);h=goBack(h).history;h=replaceNavigationEntry(h,entry('roi',{selectedIds:['edited']}));assert.deepEqual(h.entries[h.index].view.selectedIds,['edited']);
  h=pushNavigation(h,entry('research')).history;assert.equal(goForward(h).target,null);
});
test('codec admits bounded nonrecursive history and strips it entirely from public URLs',()=>{
  const h=pushNavigation({projectId:'p',entries:[],index:-1},entry('research')).history;
  assert.deepEqual(validateViewState({navigationHistory:h}).navigationHistory.entries[0].view.coordinateSpace,null);
  const shared=encodeView({navigationHistory:h});assert.ok(shared.omitted.includes('navigationHistory'));assert.equal(decodeView(shared.encoded).navigationHistory,undefined);
  assert.throws(()=>validateViewState({navigationHistory:{...h,entries:[{...entry('roi'),view:{navigationHistory:h}}]}}),/recursive/);
  assert.throws(()=>validateNavigationHistory({...h,entries:Array(51).fill(entry('roi'))}),/history-limit/);
  assert.throws(()=>validateViewState({navigationHistory:h},{savedProjectId:'p',projectId:'foreign'}),/project-mismatch/);
});
test('imported histories receive imported location trust even if a file claims the current project identity',async()=>{
  const navigationHistory=pushNavigation({projectId:'p',entries:[],index:-1},entry('research')).history;
  const text=await serializeProject({projectId:'p',view:{navigationHistory},notes:[],evidence:emptyEvidence(),volumes:[]});
  const restored=await parseProject(text),origin=restored.view.navigationHistory.entries[0].view.coordinateOrigin;
  assert.deepEqual(origin,{kind:'private',cameraSensitive:true,explorerSensitive:true,imported:true});
});
const workspace=(projectId='p')=>({projectId,revision:0,view:validateViewState({}),evidence:emptyEvidence(),notes:[],drafts:[],volumes:[],roiSnapshot:null,recomputedSnapshot:null});
test('all nested layers and asset references pass existing session admission; failures preserve current workspace',async()=>{
  const current=workspace(),before=structuredClone(current);
  for(const patch of [{atlas:'custom-missing'},{resultLayers:[{layerId:'l',resultId:'missing-result',sourceReferenceId:'missing-paper',coordinateIds:['c'],spaceId:'MNI152NLin6Asym',visible:true,style:{}}]}]){
    const h=pushNavigation({projectId:'p',entries:[],index:-1},entry('research',patch)).history;
    await assert.rejects(stageWorkspaceChange({...current,view:{navigationHistory:h}},{current,knownEvidence:emptyEvidence()}));
  }
  const foreign=pushNavigation({projectId:'foreign',entries:[],index:-1},entry('roi')).history;
  await assert.rejects(stageWorkspaceChange({...current,view:{navigationHistory:foreign}},{current,knownEvidence:emptyEvidence()}),/project-mismatch/);
  assert.deepEqual(current,before);
});
test('asset removal prunes only unrestorable visits and exposes count in dependency preview',()=>{
  let h={projectId:'p',entries:[],index:-1};for(const patch of [{atlas:'dk'},{atlas:'custom-remove'},{atlas:'aal3-registered'}])h=pushNavigation(h,entry('anatomy',patch)).history;
  const current={...workspace(),volumes:[{id:'custom-remove'}],view:{navigationHistory:h}};
  const plan=planAssetRemoval(current,'custom-remove');
  assert.equal(plan.next.view.navigationHistory.entries.length,2);assert.equal(plan.next.view.navigationHistory.index,1);
  assert.ok(plan.dependentViewFields.includes('navigationHistory:1'));assert.equal(current.view.navigationHistory.entries.length,3);
});
test('merging retains validated imported history in the destination project, and URLs cannot inject it',()=>{
  const incoming=workspace('foreign');incoming.view.navigationHistory=pushNavigation({projectId:'foreign',entries:[],index:-1},entry('roi')).history;
  const result=mergeWorkspace(workspace(),incoming);assert.equal(result.snapshot.view.navigationHistory.projectId,'p');
  const encoded=btoa(JSON.stringify(incoming.view));assert.equal(decodeView(encoded).navigationHistory,undefined);
});
test('public projection omits ROI private inspection coordinates and snapshot identities',()=>{
  const shared=decodeView(encodeView({roi:{point:[11.75,22.1,33.2],snapshot:'original',snapshotId:'private-original-id'}}).encoded);
  assert.equal(shared.roi.point,undefined);assert.equal(shared.roi.snapshotId,undefined);
});
test('startup cannot restore history owned by another project or unknown nested layers',()=>{
  const current=workspace();
  for(const [projectId,patch]of [['foreign',{}],['p',{resultLayers:[{layerId:'l',resultId:'missing-result',sourceReferenceId:'missing-paper',coordinateIds:['c'],spaceId:'MNI152NLin6Asym',visible:true,style:{}}]}]]){
    const navigationHistory=pushNavigation({projectId,entries:[],index:-1},entry('research',patch)).history;
    const value={...current,schema:WORKSPACE_STORAGE_KEY,view:{navigationHistory}};
    const storage={getItem:key=>key===WORKSPACE_STORAGE_KEY?JSON.stringify(value):null};
    assert.throws(()=>restoreWorkspaceInitial({storage,fallback:current,knownEvidence:emptyEvidence()}));
  }
});
test('incoming history remaps singular result-coordinate identities without rewriting current history',()=>{
  const current=workspace(),incoming=workspace('foreign');
  for(const [target,label]of [[current,'current'],[incoming,'incoming']]){
    target.evidence.references=[{id:'paper',title:label}];target.evidence.results=[{id:'result',referenceId:'paper',finding:label}];target.evidence.locations=[{id:'point',resultId:'result',label}];
    target.view.navigationHistory=pushNavigation({projectId:target.projectId,entries:[],index:-1},entry('research',{coordinateOrigin:{kind:'result',resultId:'result',sourceReferenceId:'paper',coordinateId:'point',spaceId:'MNI152NLin6Asym',imported:true,cameraSensitive:true,explorerSensitive:true}})).history;
  }
  const before=structuredClone(current),merged=mergeWorkspace(current,incoming,(kind,id)=>`incoming-${kind}-${id}`);
  assert.deepEqual(merged.snapshot.view.navigationHistory.entries[0],before.view.navigationHistory.entries[0]);
  const selected=merged.snapshot.view.navigationHistory.entries[merged.snapshot.view.navigationHistory.index];
  assert.deepEqual(selected.view.coordinateOrigin,{kind:'result',resultId:'incoming-results-result',sourceReferenceId:'incoming-references-paper',coordinateId:'incoming-locations-point',spaceId:'MNI152NLin6Asym',imported:true,cameraSensitive:true,explorerSensitive:true});
  assert.deepEqual(current,before);
});
test('blank B survives the real view-adapter sequence: explorer navigation, full-set A handoff, history restore',()=>{
  const cleared={...entry('roi').view,roi:{...entry('roi').view.roi,bAtlas:'custom-stat',bLabels:[],bRegionRefs:[],bThreshold:'',bTail:'negative'}};
  // App captures via getWorkspaceView, normalizes the explorer target, hands off
  // one operand, then normalizes again at restore/staging. Every step uses W6.
  const captured=validateViewState(cleared);
  const explorer=validateViewState({...captured,atlasExplorerOpen:true,atlasExplorer:{atlas:ref.atlasId,selected:[133,134]}});
  let history=pushNavigation({projectId:'p',entries:[],index:-1},{view:captured,scroll:{left:50}}).history;
  history=pushNavigation(history,{view:explorer,scroll:{atlas:30}}).history;
  const roi=assignSelectionToOperand(explorer.roi,{side:'A',regions:[{...ref,labelId:133},ref]});
  const target=validateViewState({...explorer,mode:'roi',atlasExplorerOpen:false,roi});
  history=pushNavigation(history,{view:target,scroll:{}}).history;
  const persisted=validateViewState({...target,navigationHistory:history});
  for(const view of [captured,explorer,target,...persisted.navigationHistory.entries.map(visit=>visit.view),validateViewState(goBack(history).target.view)]){
    assert.equal(view.roi.bThreshold,'');assert.equal(view.roi.bTail,'negative');assert.equal(view.roi.bAtlas,'custom-stat');
    // ROICompare's existing missingThreshold gate must still receive its missing sentinel.
    assert.equal(view.roi.bThreshold==='',true);
  }
  assert.deepEqual(target.roi.aLabels,[133,134]);assert.equal(target.roi.computed,false);
});
test('W6 keeps an explicit missing threshold distinct from legacy absent threshold defaults',async()=>{
  const view=validateViewState({roi:{aThreshold:'',bThreshold:''}});
  assert.equal(view.roi.aThreshold,'');assert.equal(view.roi.bThreshold,'');
  const restored=await parseProject(await serializeProject({...workspace(),view}));
  assert.equal(restored.view.roi.aThreshold,'');assert.equal(restored.view.roi.bThreshold,'');
  const legacy=validateViewState({schema:'neuroatlas-view-v1',roi:{}});
  assert.equal(legacy.roi.aThreshold,0);assert.equal(legacy.roi.bThreshold,0);
  assert.equal(validateViewState({roi:{aThreshold:0,bThreshold:.75}}).roi.bThreshold,.75);
});

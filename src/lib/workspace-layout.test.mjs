import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLayout,requestComparison,replaceComparedPaper,comparisonReturnScroll,scheduleLayoutSave} from './workspace-layout.js';
import {validateViewState,encodeView,decodeView,serializeProject,parseProject,migrateProjectV1} from './workspace-project.js';
import {createWorkspaceSession,stageWorkspaceChange,WORKSPACE_STORAGE_KEY} from './workspace-session.js';

test('saved desktop widths fit a 390 px viewport without minimum columns',()=>{
  const value=normalizeLayout({mode:'research',preset:'evidence',panels:{modelWidth:1400,catalog:true}}, {width:390,height:844});
  assert.ok(value.panels.modelWidth<=390);
  assert.equal(value.panels.active,'evidence');
  assert.equal(value.panels.catalog,false);
  assert.deepEqual(normalizeLayout(value,{width:390}),value);
});
test('invalid and legacy layouts receive bounded task defaults',()=>{
  assert.equal(normalizeLayout({mode:'research'}).preset,'evidence');
  assert.equal(normalizeLayout({mode:'anatomy',preset:'compare'}).preset,'model');
  const value=normalizeLayout({mode:'research',preset:'wat',panels:{modelWidth:Infinity,active:'wat'}});
  assert.equal(value.preset,'evidence');assert.ok(Number.isFinite(value.panels.modelWidth));
});
test('fourth paper keeps all three until an explicit replacement',()=>{
  const before=['first','second','third'];
  assert.deepEqual(requestComparison(before,'fourth'),{paperIds:before,pendingPaperId:'fourth'});
  assert.deepEqual(before,['first','second','third']);
  assert.deepEqual(replaceComparedPaper(before,'second','fourth'),['first','fourth','third']);
  assert.deepEqual(replaceComparedPaper(before,'missing','fourth'),before);
  assert.deepEqual(requestComparison(before,'second').paperIds,['first','third']);
});
test('single view codec preserves layout and history layouts through round trips',()=>{
  const layout={preset:'evidence',panels:{modelWidth:480,catalog:true,active:'model'}};
  const view=validateViewState({mode:'research',layout,navigationHistory:{projectId:'p1',index:0,entries:[{view:{mode:'research',layout:{preset:'compare'}},scroll:{literature:222,matrixX:100}}]}});
  assert.equal(view.layout.panels.modelWidth,480);
  assert.equal(view.navigationHistory.entries[0].view.layout.preset,'compare');
  assert.equal(validateViewState(JSON.parse(JSON.stringify(view))).layout.panels.catalog,true);
  assert.equal(decodeView(encodeView(view).encoded).layout.panels.modelWidth,480);
});
test('full project files retain adjustable layout and legacy views migrate to task defaults',async()=>{
  const view={mode:'research',layout:{preset:'model',panels:{modelWidth:775,catalog:true,active:'model'}},literature:{compared:['one','two','three'],showCompare:false,paperId:'two'}};
  const restored=await parseProject(await serializeProject({projectId:'layout-project',view}));
  assert.equal(restored.view.layout.panels.modelWidth,775);
  assert.equal(restored.view.layout.preset,'model');
  assert.deepEqual(restored.view.literature.compared,['one','two','three']);
  assert.equal(restored.view.literature.paperId,'two');
  const migrated=migrateProjectV1({schema:'neuroatlas-project-v1',view:{mode:'research'},volumes:[],notes:[]});
  assert.equal(migrated.view.layout.preset,'evidence');
  assert.equal(migrated.roiSnapshot,null);
});

test('explicit comparison return borrows matching scroll without restoring prior membership or paper state',()=>{
  const literature={compared:['one','two','three'],query:'face',paperId:'one',showCompare:false};
  const scroll={literature:1465.454,detail:180,matrixX:240};
  const history={index:2,entries:[{view:{mode:'research',literature:{...literature,paperId:null,showCompare:true}},scroll},{view:{mode:'research',literature:{...literature,paperId:'one'}},scroll:{literature:100}},{view:{mode:'research',literature:{...literature,paperId:'two'}},scroll:{literature:200}}]};
  assert.deepEqual(comparisonReturnScroll(history,literature),scroll);
  const copied=comparisonReturnScroll(history,literature);copied.literature=0;
  assert.equal(history.entries[0].scroll.literature,1465.454);
  assert.deepEqual(comparisonReturnScroll(history,{...literature,compared:['one','two']}),{});
  assert.deepEqual(comparisonReturnScroll(history,{...literature,query:'edited filter'}),{});
  assert.equal(literature.paperId,'one');assert.deepEqual(literature.compared,['one','two','three']);
});

test('debounced layout save reads the latest render into the real workspace transaction',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const initial={projectId:'layout-latest',revision:0,view:validateViewState({mode:'research'}),notes:[],volumes:[]};
  const session=createWorkspaceSession({storage,initial});
  let epoch=1,saved=0,error;
  const makeRender=view=>({readView:()=>view,isCurrent:(owner,startedEpoch)=>owner===session.getSnapshot().projectId&&startedEpoch===epoch,save:async view=>{const base=session.getSnapshot();session.commit(await stageWorkspaceChange({...base,view},{current:base}));},onSaved:()=>saved++,onError:value=>{error=value;}});
  const old=validateViewState({mode:'research',language:'zh',layout:{preset:'evidence',panels:{modelWidth:390}},atlas:'dk',coordinate:[1,2,3],selectedIds:['precentral-l']});
  const latest={current:makeRender(old)};
  scheduleLayoutSave(latest,{projectId:initial.projectId,epoch});
  t.mock.timers.tick(100);
  latest.current=makeRender(validateViewState({...old,language:'en',atlas:'aal-registered',coordinate:[10.25,20.5,30.75],selectedIds:['fusiform-l']}));
  t.mock.timers.tick(200);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(error,undefined);assert.equal(saved,1);
  const restored=JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)).view;
  assert.equal(restored.layout.panels.modelWidth,390);assert.equal(restored.language,'en');assert.equal(restored.atlas,'aal-registered');
  assert.deepEqual(restored.coordinate,[10.25,20.5,30.75]);assert.deepEqual(restored.selectedIds,['fusiform-l']);
  scheduleLayoutSave(latest,{projectId:initial.projectId,epoch});epoch++;
  t.mock.timers.tick(300);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saved,1,'a changed project epoch cannot publish the pending layout save');
});

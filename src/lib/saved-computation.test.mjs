import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSavedComputation,decodeSavedComputation,savedComputationUsage} from './saved-computation.js';
import {prepareProjectPayload,parseProject,serializeProject} from './workspace-project.js';
import {stageProjectImport} from './workspace-session.js';
import {emptyEvidence} from './evidence-schema.js';

const grid={shape:[2,2,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],space:'MNI152NLin6Asym',order:'x-fastest'};
const manifest={appVersion:'4.1.0',algorithmVersion:'roi-v1',inputs:['a','b'].map(id=>({id,version:'1',sha256:'a'.repeat(64),spaceId:grid.space})),transforms:[],sourceGrids:[grid,grid],targetGrid:grid,interpolation:['nearest-neighbour','nearest-neighbour'],thresholds:[0,0].map(()=>({kind:'label',threshold:0,tail:'positive'})),labelSets:[[1],[2]]};
const saved=(id='saved')=>({id,manifest,grid,classes:Uint8Array.of(0,1,2,3),metrics:{dice:.5,aVoxels:2},probabilityMetrics:{fuzzyDice:.7},display:{mode:'parts'},maskA:Uint8Array.of(0,1,0,1),surfaces:{ignored:'redundant'}});
const project=(extra={})=>({projectId:'A',revision:0,view:{atlas:'dk',roi:{computed:true}},notes:[],evidence:emptyEvidence(),drafts:[],volumes:[],...extra});

test('bounded snapshot encoding preserves exact metrics manifest grid and Uint8 classes, omitting redundant geometry',async()=>{
 const original=saved(),encoded=await encodeSavedComputation(original);assert.ok(encoded.value.classesGzip);assert.equal(encoded.rawPayloadBytes,savedComputationUsage(original).rawPayloadBytes);
 assert.ok(!('surfaces' in encoded.value));assert.ok(!('maskA' in encoded.value));
 const restored=await decodeSavedComputation(encoded.value);for(const key of ['manifest','metrics','probabilityMetrics','grid','display'])assert.deepEqual(restored[key],original[key]);assert.deepEqual(restored.classes,original.classes);
});

test('both distinct historical and recomputed snapshots survive the sole project codec and import staging',async()=>{
 const source=project({roiSnapshot:saved(),recomputedSnapshot:{...saved('recomputed'),metrics:{dice:.9}}});
 const prepared=await prepareProjectPayload(source),restored=await parseProject(prepared.text);
 assert.deepEqual(restored.roiSnapshot.metrics,source.roiSnapshot.metrics);assert.deepEqual(restored.recomputedSnapshot.metrics,{dice:.9});assert.deepEqual(restored.roiSnapshot.classes,source.roiSnapshot.classes);
 assert.equal(restored.view.roi.computed,false);
 assert.ok(prepared.usage.rawPayloadBytes>=8);assert.equal(prepared.usage.compressedAssetBytes.length,2);
 const stage=await stageProjectImport(prepared.text,{current:project()});assert.deepEqual(stage.next.roiSnapshot.classes,source.roiSnapshot.classes);assert.equal(stage.next.recomputedSnapshot.id,'recomputed');
});

test('snapshot class mismatch, values, gzip expansion and combined budgets reject before publication',async()=>{
 assert.throws(()=>savedComputationUsage({...saved(),classes:Uint8Array.of(4,1,2,3)}),/snapshot-classes/);
 assert.throws(()=>savedComputationUsage({...saved(),grid:{...grid,shape:[64000001,1,1]}}),/snapshot-grid/);
 assert.throws(()=>savedComputationUsage({...saved(),classes:new Uint8Array(3)}),/snapshot-classes/);
 await assert.rejects(encodeSavedComputation(saved(),{maxRawBytes:3}),/snapshot-budget/);
 const encoded=await encodeSavedComputation(saved());encoded.value.classCount=1;encoded.value.grid={...grid,shape:[1,1,1]};await assert.rejects(decodeSavedComputation(encoded.value),/snapshot-inflated-budget/);
 const binary=Uint8Array.of(1);const fake=new Proxy(binary,{get(target,key){if(key==='byteLength')return 256*1024*1024;return Reflect.get(target,key,target);}});
 await assert.rejects(serializeProject(project({volumes:[{id:'custom-big',data:fake}],roiSnapshot:saved()})),/decoded-budget/);
});

test('v1 migration retains selections but cannot fabricate saved provenance or trigger recomputation',async()=>{
 const legacy={schema:'neuroatlas-project-v1',view:{roi:{computed:true,aAtlas:'dk',aLabels:[1],display:{mode:'A'}}},notes:[],evidence:emptyEvidence(),volumes:[]};
 const restored=await parseProject(JSON.stringify(legacy));assert.equal(restored.provenanceStatus,'missing-provenance');assert.equal(restored.roiSnapshot,null);assert.equal(restored.recomputedSnapshot,null);assert.equal(restored.view.roi.computed,false);assert.deepEqual(restored.view.roi.aLabels,[1]);
 const partial={id:'legacy-values',metrics:{dice:.42},manifest:null};const savedPartial=await decodeSavedComputation((await encodeSavedComputation(partial)).value);assert.equal(savedPartial.manifest,null);assert.equal(savedPartial.status,'missing-provenance');assert.deepEqual(savedPartial.metrics,partial.metrics);
});

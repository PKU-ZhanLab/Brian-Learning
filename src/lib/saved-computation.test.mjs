import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSavedComputation,decodeSavedComputation,savedComputationUsage,inspectEncodedSavedComputation} from './saved-computation.js';
import {prepareProjectPayload,parseProject,serializeProject} from './workspace-project.js';
import {stageProjectImport} from './workspace-session.js';
import {emptyEvidence} from './evidence-schema.js';
import {compareROIs} from './roi.js';

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

test('legal multi-megabyte encoded classes round trip without regular-expression stack growth',async()=>{
 const classes=new Uint8Array(24_000_000);let seed=0x12345678;
 for(let i=0;i<classes.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;classes[i]=seed&3;}
 const original={id:'large-supported-snapshot',manifest:null,grid:{...grid,shape:[300,400,200]},classes,metrics:{dice:.5}};
 const encoded=await encodeSavedComputation(original);
 assert.ok(encoded.compressedBytes>6_000_000);assert.ok(encoded.value.classesGzip.length>8_000_000);
 assert.equal(inspectEncodedSavedComputation(encoded.value).compressedBytes,encoded.compressedBytes);
 const restored=await decodeSavedComputation(encoded.value);assert.deepEqual(restored.classes,classes);assert.deepEqual(restored.metrics,original.metrics);assert.deepEqual(restored.grid,original.grid);
});

test('actual many-label ROI producer IDs survive project round trip and import staging unchanged',async()=>{
 const labels=Array.from({length:500},(_,i)=>i+1),source={...grid,shape:[500,1,1],kind:'label',canOverlayOnTarget:true,alignmentStatus:'verified-native',data:Uint16Array.from(labels)};
 const result=compareROIs(source,{labels},source,{labels},source);
 assert.equal(result.metrics.dice,1);assert.ok(result.id.length>2000);assert.equal(result.classes.length,500);
 assert.equal(savedComputationUsage(result).metadata.id,result.id);
 const text=await serializeProject(project({roiSnapshot:result})),restored=await parseProject(text);
 assert.equal(restored.roiSnapshot.id,result.id);assert.deepEqual(restored.roiSnapshot.metrics,result.metrics);assert.deepEqual(restored.roiSnapshot.classes,result.classes);
 const staged=await stageProjectImport(text,{current:project()});assert.equal(staged.next.roiSnapshot.id,result.id);assert.deepEqual(staged.next.roiSnapshot.classes,result.classes);
});

test('encoded admission rejects malformed padding alphabet and noncanonical final bits',()=>{
 const encoded=classesGzip=>({id:'padding-probe',manifest:null,grid,classCount:4,classEncoding:'uint8-gzip-base64',classesGzip});
 for(const valid of ['AA==','AAA=','AAAA','/w==','//8='])assert.doesNotThrow(()=>inspectEncodedSavedComputation(encoded(valid)));
 for(const invalid of ['A','AAA','AAAA=','AA=','AA===','A===','A=AA','AA==AAAA','AA\n=','AA-_','AA?=','AB==','AAB='])assert.throws(()=>inspectEncodedSavedComputation(encoded(invalid)),/snapshot-encoded-budget/,invalid);
});

test('producer ID admission retains the existing bounded metadata budget and ID type checks',async()=>{
 const oversizedId={...saved(),id:'x'.repeat(2*1024*1024)};
 assert.throws(()=>savedComputationUsage(oversizedId),/snapshot-metadata-budget/);
 await assert.rejects(encodeSavedComputation(oversizedId),/snapshot-metadata-budget/);
 assert.throws(()=>savedComputationUsage({...saved(),id:'large-id'.repeat(500),note:'x'.repeat(2*1024*1024)}),/snapshot-metadata-budget/);
 for(const id of ['',123,{}])assert.throws(()=>savedComputationUsage({...saved(),id}),/snapshot-id/);
});

// W6 behavior: the storage codec above remains the sole snapshot encoding path.
import * as history from './saved-computation.js';

test('manifest mismatch blocks silent recompute and reports the actual changed fields',()=>{
 const original=saved();
 const changes=[['algorithmVersion',v=>v.algorithmVersion='roi-v-next'],['inputs.0.sha256',v=>v.inputs[0].sha256='b'.repeat(64)],['inputs.1.sha256',v=>v.inputs[1].sha256='c'.repeat(64)],['transforms.0.id',v=>v.transforms[0].id='new-transform'],['transforms.0.sha256',v=>v.transforms[0].sha256='d'.repeat(64)],['sourceGrids.0.affine.3',v=>v.sourceGrids[0].affine[3]=4],['targetGrid.affine.7',v=>v.targetGrid.affine[7]=2],['interpolation.0',v=>v.interpolation[0]='trilinear'],['thresholds.0.threshold',v=>v.thresholds[0].threshold=.4],['thresholds.1.tail',v=>v.thresholds[1].tail='negative'],['labelSets.0.0',v=>v.labelSets[0]=[8]]];
 original.manifest=structuredClone(manifest);original.manifest.transforms=[{id:'transform',sha256:'f'.repeat(64)}];
 for(const [path,change]of changes){const current=structuredClone(original.manifest);change(current);const restored=history.restoreComputation(original,{currentManifest:current});assert.equal(restored.status,'mismatch',path);assert.equal(restored.shouldRecompute,false);assert.ok(restored.differences.some(d=>d.path===path),path);assert.strictEqual(restored.saved,original);assert.deepEqual(restored.saved.metrics,{dice:.5,aVoxels:2});}
 assert.equal(history.restoreComputation(original,{currentManifest:original.manifest}).status,'matched');
});

test('saved numerical inspection builds masks and surfaces only from stored classes under version drift',()=>{
 const original=saved(),before=structuredClone(original);let workerCalls=0;
 const oldWorker=globalThis.Worker;globalThis.Worker=class{constructor(){workerCalls++;throw Error('must not run');}};
 try{const restored=history.restoreComputation(original,{currentManifest:{...manifest,algorithmVersion:'next'}});assert.equal(workerCalls,0);assert.deepEqual(restored.comparison.maskA,Uint8Array.of(0,1,0,1));assert.deepEqual(restored.comparison.maskB,Uint8Array.of(0,0,1,1));assert.ok(restored.comparison.surfaces.intersection.faces>0);assert.deepEqual(restored.comparison.metrics,original.metrics);assert.deepEqual(restored.comparison.classes,original.classes);assert.deepEqual(original,before);}finally{globalThis.Worker=oldWorker;}
});

test('missing provenance and missing inputs remain explicit; only an explicit decision requests recomputation',()=>{
 const partial={...saved(),manifest:null};assert.equal(history.restoreComputation(partial,{currentManifest:manifest}).status,'missing-provenance');assert.equal(partial.manifest,null);
 const unavailable={...saved(),status:'missing-input',missingAssetIds:['custom-lost']};const restored=history.restoreComputation(unavailable,{currentManifest:manifest});assert.equal(restored.status,'missing-input');assert.deepEqual(restored.missingAssetIds,['custom-lost']);assert.equal(restored.shouldRecompute,false);
 assert.equal(history.restoreComputation(saved(),{currentManifest:null}).status,'unverified');assert.equal(history.restoreComputation(saved(),{decision:'recompute'}).shouldRecompute,false);
 assert.equal(history.restoreComputation(saved(),{currentManifest:manifest,decision:'recompute'}).shouldRecompute,true);assert.throws(()=>history.restoreComputation(saved(),{decision:'automatic'}),/invalid-restore-decision/);
});

test('explicit repeated computation gets new identities while original snapshot and deterministic metrics survive export',async()=>{
 const source={...grid,kind:'mask',canOverlayOnTarget:true,data:Uint8Array.of(0,1,1,0)};
 const raw=compareROIs(source,{},source,{},source),first=history.createComputationSnapshot({...raw,manifest});
 const original=structuredClone(first),second=history.createComputationSnapshot({...compareROIs(source,{},source,{},source),manifest});
 assert.notEqual(first.id,second.id);assert.equal(first.producerId,raw.id);assert.equal(second.producerId,raw.id);assert.deepEqual(second.metrics,first.metrics);
 const retained=history.retainComputation({roiSnapshot:first,recomputedSnapshot:null},second);assert.strictEqual(retained.roiSnapshot,first);assert.strictEqual(retained.recomputedSnapshot,second);
 const reopened=await parseProject(await serializeProject(project(retained)));assert.deepEqual(reopened.roiSnapshot.metrics,original.metrics);assert.deepEqual(reopened.roiSnapshot.classes,original.classes);assert.equal(reopened.roiSnapshot.id,first.id);assert.equal(reopened.recomputedSnapshot.id,second.id);assert.equal(reopened.recomputedSnapshot.metrics.dice,1);
});

test('original and recomputed class payloads are admitted together before any volume export',async()=>{
 const original=saved('first'),recomputed=saved('second'),bytes=256*1024*1024-savedComputationUsage(original).rawPayloadBytes-savedComputationUsage(recomputed).rawPayloadBytes-351;
 const tiny=Uint8Array.of(1),data=new Proxy(tiny,{get(target,key){if(key==='byteLength')return bytes;return Reflect.get(target,key,target);}});
 await assert.rejects(prepareProjectPayload(project({volumes:[{id:'custom-budget',kind:'mask',shape:[1,1,1],affine:grid.affine,data}],roiSnapshot:original,recomputedSnapshot:recomputed})),/decoded-budget/);
});

test('z-fastest historical classes are reordered for geometry without changing the recorded bytes or grid',()=>{
 const original={...saved(),grid:{...grid,shape:[2,1,2],order:'z-fastest'},classes:Uint8Array.of(1,2,3,0)},before=structuredClone(original);
 const result=history.restoreComputation(original);assert.deepEqual(result.comparison.classes,Uint8Array.of(1,3,2,0));assert.equal(result.comparison.grid.order,'x-fastest');assert.deepEqual(original,before);
});

test('historical unknown-space results retain metrics and bytes but cannot attach geometry to the main brain',()=>{
 const original={...saved(),grid:{...grid,space:'native-unverified'}};const restored=history.restoreComputation(original);assert.equal(restored.comparison,null);assert.equal(restored.overlayUnavailableReason,'saved-space-not-main');assert.deepEqual(restored.saved.metrics,original.metrics);assert.deepEqual(restored.saved.classes,original.classes);
});

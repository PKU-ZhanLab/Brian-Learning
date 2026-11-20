import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {parseNiftiInWorker,exportNiftiInWorker} from './nifti-worker-client.js';
import {exportNifti,parseNifti,MAX_NIFTI_FILE_BYTES} from './nifti.js';
import {newImportDraft,stageVolumeImport} from './roi-import-state.js';
import {createWorkspaceSession} from './workspace-session.js';
import {emptyEvidence} from './evidence-schema.js';

const affine=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const volume=()=>({kind:'label',space:'native-unverified',shape:[2,2,1],affine,data:Uint16Array.of(0,1,2,3)});
const hash=data=>createHash('sha256').update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
// Actual production worker module and canonical parser, with only the transport adapted to Node.
export function nodeWorkerFactory(){
 const source=`import {parentPort} from 'node:worker_threads';
 globalThis.self={postMessage:(value,transfer)=>parentPort.postMessage(value,transfer),addEventListener:(type,fn)=>parentPort.on(type,data=>fn({data}))};
 await import(${JSON.stringify(new URL('../workers/nifti.worker.js',import.meta.url).href)});`;
 const worker=new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(source)}`),{type:'module'});
 return {postMessage:(...args)=>worker.postMessage(...args),terminate:()=>worker.terminate(),addEventListener:(type,fn)=>worker.on(type,type==='message'?data=>fn({data}):fn),removeEventListener:()=>{}};
}
const controls={workerFactory:nodeWorkerFactory};
const file=bytes=>({name:'local.nii',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer});

test('worker parse equals canonical parser and never transfers the caller input',async()=>{
 const bytes=exportNifti(volume()),before=hash(bytes),progress=[];
 const actual=await parseNiftiInWorker(bytes,{kind:'label'}, {...controls,onProgress:value=>progress.push(value.phase)});
 assert.deepEqual(actual,await parseNifti(bytes,{kind:'label'}));
 assert.equal(bytes.byteLength,360);assert.equal(hash(bytes),before);assert.ok(progress.includes('parsing'));assert.equal(progress.at(-1),'complete');
});
test('worker export and gzip roundtrip preserve original data buffer length and hash',async()=>{
 for(const gzip of [false,true]){
  const original=volume(),before=hash(original.data),length=original.data.buffer.byteLength;
  const result=await exportNiftiInWorker(original,{gzip},controls);
  assert.equal(result.extension,gzip?'.nii.gz':'.nii');assert.deepEqual([...(await parseNifti(result.bytes)).data],[0,1,2,3]);
  assert.equal(original.data.buffer.byteLength,length);assert.equal(hash(original.data),before);
 }
});
test('pre-aborted request allocates no worker',async()=>{
 const controller=new AbortController();controller.abort();let started=0;
 await assert.rejects(parseNiftiInWorker(exportNifti(volume()),{}, {signal:controller.signal,workerFactory:()=>{started++;}}),{name:'AbortError'});assert.equal(started,0);
});
test('abort during actual parse rejects promptly without publishing a partial result; retry succeeds',async()=>{
 const original={...volume(),shape:[200,200,200],data:new Uint16Array(8_000_000)},bytes=exportNifti(original),controller=new AbortController();let published=0,start;
 const pending=parseNiftiInWorker(bytes,{}, {...controls,signal:controller.signal,onProgress:({phase})=>{if(phase==='parsing'){start=performance.now();controller.abort();}}}).then(()=>{published++;});
 await assert.rejects(pending,{name:'AbortError'});assert.equal(published,0);assert.ok(performance.now()-start<1000);assert.equal(bytes.byteLength,16_000_352);
 assert.deepEqual([...(await parseNiftiInWorker(exportNifti(volume()),{},controls)).data],[0,1,2,3]);
});
test('abort export publishes no downloadable bytes and retains the volume',async()=>{
 const original=volume(),before=hash(original.data),controller=new AbortController();let published=0;
 await assert.rejects(exportNiftiInWorker(original,{}, {...controls,signal:controller.signal,onProgress:({phase})=>{if(phase==='exporting')controller.abort();}}).then(()=>{published++;}),{name:'AbortError'});
 assert.equal(published,0);assert.equal(hash(original.data),before);assert.equal(original.data.byteLength,8);
});
test('canonical header and decoded budgets propagate without partial data',async()=>{
 const bytes=exportNifti(volume());
 for(const [options,error] of [[{maxDecodedVoxelBytes:7},/decoded-budget/],[{maxInflatedBytes:359},/inflated-budget/]]) await assert.rejects(parseNiftiInWorker(bytes,options,controls),error);
 await assert.rejects(parseNiftiInWorker(Uint8Array.of(1,2),{},controls),/nifti-truncated-header/);
 await assert.rejects(parseNiftiInWorker({size:MAX_NIFTI_FILE_BYTES+1,arrayBuffer:()=>assert.fail('must not read oversized input')},{},controls),/nifti-file-too-large/);
});
test('worker crash and cancelled worker admission leave the actual session unchanged',async()=>{
 const storage=new Map(),session=createWorkspaceSession({storage:{setItem:(key,value)=>storage.set(key,value)},initial:{projectId:'worker-test',revision:0,view:{},volumes:[],notes:[],drafts:[],evidence:emptyEvidence()}}),before=session.getSnapshot(),bytes=exportNifti(volume());
 for(const fail of ['crash','cancel']){
  const controller=new AbortController();let staged=0;
  const parseVolume=(input,options,control)=>parseNiftiInWorker(input,options,{...controls,...control,signal:controller.signal,...(fail==='crash'?{workerFactory:()=>{const listeners={};return {addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener:()=>{},postMessage:()=>queueMicrotask(()=>listeners.error({message:'nifti-worker-error'})),terminate:()=>{}};}}:{onProgress:({phase})=>{if(phase==='parsing')controller.abort();}})});
  await assert.rejects(stageVolumeImport(newImportDraft('A'),{file:file(bytes),current:before,signal:controller.signal,parseVolume,stage:()=>{staged++;}}),fail==='crash'?/nifti-worker-error/:/cancel|abort/i);
  assert.equal(staged,0);assert.equal(session.getSnapshot(),before);assert.equal(storage.size,0);
 }
});

test('worker completion still requires current file/revision/project and preserves original-byte provenance',async()=>{
 const bytes=exportNifti(volume()),originalHash=hash(bytes),parseVolume=(input,options,control)=>parseNiftiInWorker(input,options,{...controls,...control});
 let current=true,admissions=0;
 await assert.rejects(stageVolumeImport(newImportDraft('A'),{file:file(bytes),parseVolume,isCurrent:()=>current,onProgress:({phase})=>{if(phase==='parsing')current=false;},stage:()=>{admissions++;}}),/stale-workspace/);
 assert.equal(admissions,0);
 const result=await stageVolumeImport(newImportDraft('A'),{file:file(bytes),parseVolume,stage:async value=>value});
 assert.equal(result.sourceIdentities[0].sha256,originalHash);assert.equal(hash(bytes),originalHash);assert.deepEqual([...result.data],[0,1,2,3]);
});
test('abort in the completion callback wins over a fully computed result',async()=>{
 const controller=new AbortController();
 await assert.rejects(parseNiftiInWorker(exportNifti(volume()),{}, {...controls,signal:controller.signal,onProgress:({phase})=>{if(phase==='complete')controller.abort();}}),{name:'AbortError'});
});
test('message deserialization failure terminates without publishing and keeps source buffers intact',async()=>{
 let terminated=0;const original=volume(),before=hash(original.data);
 const workerFactory=()=>{const listeners={};return {addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener:()=>{},terminate:()=>{terminated++;},postMessage:()=>queueMicrotask(()=>listeners.messageerror({}))};};
 await assert.rejects(exportNiftiInWorker(original,{}, {workerFactory}),/nifti-worker-message-error/);assert.equal(terminated,1);assert.equal(hash(original.data),before);
});

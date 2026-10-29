import {assertNiftiFileSize} from './nifti.js';

const abortError=()=>Object.assign(new Error('import-cancelled'),{name:'AbortError'});
const defaultWorker=()=>new Worker(new URL('../workers/nifti.worker.js',import.meta.url),{type:'module'});

/** One isolated worker per task: termination cancels CPU-bound parsing as well as streams.
 * No caller-owned buffers are ever included in a transfer list. In particular export
 * must leave the current session's voxel and snapshot buffers attached and unchanged.
 * workerFactory is an injectable transport boundary for isolated Node tests.
 */
function runTask(action,payload,{signal,onProgress,workerFactory=defaultWorker}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  let worker,settled=false;
  const cleanup=()=>{
   signal?.removeEventListener('abort',cancel);
   if(worker){worker.removeEventListener('message',message);worker.removeEventListener('error',error);worker.removeEventListener('messageerror',messageError);worker.terminate();}
  };
  const finish=(problem,value)=>{if(settled)return;settled=true;cleanup();problem?reject(problem):resolve(value);};
  const cancel=()=>finish(abortError());
  const progress=value=>{if(!settled)onProgress?.(value);};
  const message=event=>{
   if(settled)return;
   try{
    const response=event.data;
    if(response?.type==='progress'){progress(response.progress);return;}
    if(response?.type==='error'){finish(new Error(response.error||'nifti-worker-error'));return;}
    if(response?.type!=='result'){finish(new Error('nifti-worker-invalid-response'));return;}
    progress({phase:'complete'});if(!settled)finish(null,response.result);
   }catch(problem){finish(problem);}
  };
  const error=()=>finish(new Error('nifti-worker-error'));
  const messageError=()=>finish(new Error('nifti-worker-message-error'));
  try{
   worker=workerFactory();
   worker.addEventListener('message',message);worker.addEventListener('error',error);worker.addEventListener('messageerror',messageError);
   signal?.addEventListener('abort',cancel,{once:true});
   progress({phase:'starting'});
   if(signal?.aborted)cancel();
   if(!settled)worker.postMessage({action,...payload});
  }catch(problem){finish(problem);}
 });
}

export async function parseNiftiInWorker(file,options={},controls={}){
 if(controls.signal?.aborted)throw abortError();
 assertNiftiFileSize(file?.size??file?.byteLength);
 return runTask('parse',{file,options},controls);
}

export function exportNiftiInWorker(volume,{gzip=false}={},controls={}){
 // Keep unrelated cached geometry and session assets out of this message.
 const source={shape:volume.shape,affine:volume.affine,kind:volume.kind,order:volume.order,name:volume.name,data:volume.data||volume.dataTypedArray};
 return runTask('export',{volume:source,gzip},controls);
}

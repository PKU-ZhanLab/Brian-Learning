import {parseNifti,exportNifti,assertNiftiFileSize} from '../lib/nifti.js';

// The worker delegates all geometry, datatype, scaling and budget decisions to W1.
// It publishes a result only after the canonical operation has fully succeeded.
self.addEventListener('message',async({data:task})=>{
 const progress=phase=>self.postMessage({type:'progress',progress:{phase}});
 try{
  let result;
  if(task.action==='parse'){
   let input=task.file;
   if(input instanceof Blob){assertNiftiFileSize(input.size);progress('reading');input=await input.arrayBuffer();}
   progress('parsing');result=await parseNifti(input,task.options);
  }else if(task.action==='export'){
   progress('exporting');let bytes=exportNifti(task.volume);
   if(task.gzip){
    if(typeof CompressionStream==='undefined')throw new Error('nifti-gzip-unavailable');
    progress('compressing');bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
   }
   result={bytes,extension:task.gzip?'.nii.gz':'.nii'};
  }else throw new Error('nifti-worker-invalid-task');
  const buffer=task.action==='parse'?result.data.buffer:result.bytes.buffer;
  self.postMessage({type:'result',result},[buffer]);
 }catch(problem){self.postMessage({type:'error',error:problem.message||'nifti-worker-error'});}
});

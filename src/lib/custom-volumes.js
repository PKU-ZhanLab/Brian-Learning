let volumes = new Map();
let currentProjectId = null;
const listeners = new Set();
let sequence = 0;
export function registerCustomVolume(volume, options = {}) {
  const data=volume?.data||volume?.dataTypedArray;
  if (!ArrayBuffer.isView(data) || data instanceof DataView || !volume.shape || data.length!==volume.shape.reduce((a,b)=>a*b,1)) throw new Error('invalid-custom-volume');
  const id=String(options.id||volume.id||`custom-${Date.now().toString(36)}-${++sequence}`);
  if(!id.startsWith('custom-')||id.length>120||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('invalid-custom-id');
  const stored={...volume,data,dataTypedArray:data,id,name:options.name||volume.name||id,custom:true,available:true};
  volumes.set(id,stored);notifyCustomVolumes();return id;
}
export const getCustomVolume = (id,projectId=currentProjectId) => projectId===currentProjectId?volumes.get(id)||null:null;
export const listCustomVolumes = (projectId=currentProjectId) => projectId===currentProjectId?[...volumes.values()]:[];
export function removeCustomVolume(id) { const removed=volumes.delete(id);if(removed)notifyCustomVolumes();return removed; }
export function subscribeCustomVolumes(callback) {listeners.add(callback);return()=>listeners.delete(callback);}

// Prepare all potentially throwing work before the session's storage write.
export function prepareCustomVolumeReplacement(projectId,entries){
  if(typeof projectId!=='string'||!projectId.trim()||!Array.isArray(entries))throw Error('invalid-project-volumes');
  const next=new Map();
  for(const volume of entries){
    const data=volume?.data||volume?.dataTypedArray;
    if(!/^custom-[a-zA-Z0-9_-]{1,112}$/.test(volume?.id)||next.has(volume.id)||!ArrayBuffer.isView(data)||data instanceof DataView||!Array.isArray(volume.shape)||data.length!==volume.shape.reduce((a,b)=>a*b,1))throw Error('invalid-custom-volume');
    next.set(volume.id,{...volume,data,dataTypedArray:data,custom:true,available:true});
  }
  return {projectId,volumes:next};
}
export function publishCustomVolumeReplacement(prepared,{notify=true}={}){
  currentProjectId=prepared.projectId;volumes=prepared.volumes;
  if(notify)notifyCustomVolumes();
}
export function replaceCustomVolumes(projectId,entries){publishCustomVolumeReplacement(prepareCustomVolumeReplacement(projectId,entries));}
export function notifyCustomVolumes(){for(const callback of [...listeners]){try{callback();}catch{/* An observer cannot undo an accepted transaction. */}}}

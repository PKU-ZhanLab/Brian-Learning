const volumes = new Map();
const listeners = new Set();
let sequence = 0;
export function registerCustomVolume(volume, options = {}) {
  const data=volume?.data||volume?.dataTypedArray;
  if (!ArrayBuffer.isView(data) || data instanceof DataView || !volume.shape || data.length!==volume.shape.reduce((a,b)=>a*b,1)) throw new Error('invalid-custom-volume');
  const id=String(options.id||volume.id||`custom-${Date.now().toString(36)}-${++sequence}`);
  if(!id.startsWith('custom-')||id.length>120||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('invalid-custom-id');
  const stored={...volume,data,dataTypedArray:data,id,name:options.name||volume.name||id,custom:true,available:true};
  volumes.set(id,stored);listeners.forEach(callback=>callback());return id;
}
export const getCustomVolume = id => volumes.get(id)||null;
export const listCustomVolumes = () => [...volumes.values()];
export function removeCustomVolume(id) { const removed=volumes.delete(id);if(removed)listeners.forEach(callback=>callback());return removed; }
export function subscribeCustomVolumes(callback) {listeners.add(callback);return()=>listeners.delete(callback);}

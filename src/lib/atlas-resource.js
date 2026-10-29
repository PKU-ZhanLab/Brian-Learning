import {dataURL} from './assets.js';

export const MAIN_MANIFEST_RESOURCE='manifest:main';
export const ANATOMY_MANIFEST_RESOURCE='manifest:anatomy';
export const BA_COVERAGE_RESOURCE='manifest:ba-coverage';
export const ANATOMY_VOLUME_RESOURCE='volume:anatomy';
export const SPATIAL_QC_RESOURCE='manifest:spatial-qc';
const manifestFiles={
  [MAIN_MANIFEST_RESOURCE]:'manifest.json',
  [ANATOMY_MANIFEST_RESOURCE]:'anatomy/manifest.json',
  [BA_COVERAGE_RESOURCE]:'ba-v2/manifest.json',
  [SPATIAL_QC_RESOURCE]:'spatial-qc/assessment.json',
};
const resources=new Map();
const record=key=>{if(!resources.has(key))resources.set(key,{state:{status:'idle',generation:0,value:null,error:null},listeners:new Set(),pending:null,controller:null});return resources.get(key);};
export function atlasResourceKey(identity){
  if(!identity?.id||!identity.version||!identity.sha256)throw Error('Complete asset identity is required');
  return `atlas:${JSON.stringify([identity.id,identity.version,identity.sha256,identity.spaceId??null])}`;
}
export const getResourceState=key=>record(key).state;
export function subscribe(key,listener){const resource=record(key);resource.listeners.add(listener);return()=>resource.listeners.delete(listener);}
function publish(resource,state){resource.state=state;for(const listener of resource.listeners){try{listener(state);}catch{/* One consumer cannot block its peers. */}}}
async function load(key,signal){
  if(manifestFiles[key]){
    const response=await fetch(dataURL(manifestFiles[key]),{signal});
    if(!response.ok)throw Error(`Resource ${key} could not be loaded (${response.status??'network'})`);
    return response.json();
  }
  const volume=await import('./volume.js');
  if(key===ANATOMY_VOLUME_RESOURCE)return volume.loadAnatomyVolumeData({signal});
  if(key.startsWith('atlas:')){
    const [id,version,sha256,spaceId]=JSON.parse(key.slice(6));
    return volume.loadAtlasVersionData({id,version,sha256,spaceId},{signal});
  }
  throw Error(`Unknown resource: ${key}`);
}
export function ensureResource(key){
  const resource=record(key);
  if(resource.pending)return resource.pending;
  // Failures remain visible; retry is explicit and starts a fresh generation.
  if(resource.state.status==='ready'||resource.state.status==='error')return Promise.resolve(resource.state);
  const generation=resource.state.generation,controller=new AbortController();resource.controller=controller;
  const pending=Promise.resolve().then(()=>load(key,controller.signal)).then(value=>{
    if(resource.state.generation===generation)publish(resource,{status:'ready',generation,value,error:null});
    return resource.state;
  },error=>{
    if(resource.state.generation===generation)publish(resource,{status:'error',generation,value:null,error:String(error.message||error)});
    return resource.state;
  }).finally(()=>{if(resource.pending===pending){resource.pending=null;resource.controller=null;}});
  resource.pending=pending;
  publish(resource,{status:'loading',generation,value:null,error:resource.state.error});
  return pending;
}
export function retry(key){
  const resource=record(key);resource.controller?.abort();resource.pending=null;resource.controller=null;
  publish(resource,{status:'idle',generation:resource.state.generation+1,value:null,error:resource.state.error});
  return ensureResource(key);
}
export async function resourceValue(key){const state=await ensureResource(key);if(state.status!=='ready')throw Error(state.error||`Resource ${key} is unavailable`);return state.value;}

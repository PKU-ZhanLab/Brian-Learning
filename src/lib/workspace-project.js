import {validateVolumeMetadata,assertWorkspaceBudget,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,MAX_PROJECT_UTF8_BYTES,utf8ByteLength} from './workspace-limits.js';
import {parseNifti,exportNifti,MAX_NIFTI_FILE_BYTES} from './nifti.js';

export const PROJECT_SCHEMA='neuroatlas-project-v1';
export const VIEW_SCHEMA='neuroatlas-view-v1';
const MAX_FILE_BYTES=MAX_PROJECT_UTF8_BYTES;
const boundedString=(v,max=500)=>typeof v==='string'?v.slice(0,max):'';
const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
const stringArray=(v,max=500)=>Array.isArray(v)?v.filter(s=>typeof s==='string'&&s.length<=120).slice(0,max):[];
const point=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<10000)?[...v]:null;
export function validateCamera(v){
  const position=point(v?.position),target=point(v?.target);
  if(!position||!target||position.every((n,i)=>n===target[i]))return null;
  const camera={position,target,zoom:number(v.zoom,.12,18,1)};
  if(v.frameExtent!==undefined){if(!Number.isFinite(v.frameExtent)||v.frameExtent<=0||v.frameExtent>1e6)return null;camera.frameExtent=v.frameExtent;}
  if(v.up!==undefined){const up=point(v.up),length=up&&Math.hypot(...up);if(!length)return null;camera.up=up.map(n=>n/length);}
  return camera;
}
const safeObject=(value,maxBytes=50000)=>{const text=JSON.stringify(value??null);if(utf8ByteLength(text)>maxBytes)throw Error('View state is too large');return JSON.parse(text);};

export function validateViewState(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid view state');
  const output={schema:VIEW_SCHEMA,language:input.language==='en'?'en':'zh',atlas:boundedString(input.atlas,120)||'dk',selectedIds:stringArray(input.selectedIds),visibleCategories:stringArray(input.visibleCategories,20),hiddenIds:stringArray(input.hiddenIds),hemisphere:['L','R'].includes(input.hemisphere)?input.hemisphere:'both',opacity:number(input.opacity,0,1,1),exploded:input.exploded===true,labels:input.labels===true,showSchematic:input.showSchematic===true,preset:boundedString(input.preset,40)||'cortex',view:boundedString(input.view,40)||'oblique',mode:['roi','research'].includes(input.mode)?input.mode:'anatomy',network:boundedString(input.network,80)||null,coordinate:point(input.coordinate)||[-38,-20,54],showSlices:input.showSlices===true,camera:validateCamera(input.camera),researchScope:input.researchScope===true,atlasExplorerOpen:input.atlasExplorerOpen===true};
  const s=input.slices||{};output.slices={enabled:s.enabled===true,x:number(s.x,-100,100,-38),y:number(s.y,-140,100,-20),z:number(s.z,-80,120,54),axis:['x','y','z'].includes(s.axis)?s.axis:'z'};
  if(input.roi){const r=input.roi;output.roi={aAtlas:boundedString(r.aAtlas,120)||'dk',bAtlas:boundedString(r.bAtlas,120)||'ba-histology',aLabels:Array.isArray(r.aLabels)?r.aLabels.filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,5000):[],bLabels:Array.isArray(r.bLabels)?r.bLabels.filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,5000):[],aThreshold:number(r.aThreshold,-1e12,1e12,0),bThreshold:number(r.bThreshold,-1e12,1e12,0),aTail:['negative','absolute'].includes(r.aTail)?r.aTail:'positive',bTail:['negative','absolute'].includes(r.bTail)?r.bTail:'positive',computed:r.computed===true,display:{mode:['parts','overlap','A','B'].includes(r.display?.mode)?r.display.mode:'parts',opacityA:number(r.display?.opacityA,0,1,.65),opacityB:number(r.display?.opacityB,0,1,.65),opacityOverlap:number(r.display?.opacityOverlap,0,1,.9),xray:r.display?.xray===true}};}
  if(input.literature){const l=input.literature;output.literature={query:boundedString(l.query,500),topic:boundedString(l.topic,100),modality:boundedString(l.modality,100),scope:l.scope===true,paperId:boundedString(l.paperId,160)||null,compared:stringArray(l.compared,3),showCompare:l.showCompare===true,scopeRegionId:boundedString(l.scopeRegionId,120)||null,onlyResults:l.onlyResults===true};}
  if(input.atlasExplorer){const a=input.atlasExplorer;output.atlasExplorer={atlas:boundedString(a.atlas,120)||'dk',query:boundedString(a.query,200),selected:Array.isArray(a.selected)?a.selected.filter(x=>Number.isInteger(x)&&x>0).slice(0,5000):[],opacity:number(a.opacity,0,1,1),camera:validateCamera(a.camera),threshold:number(a.threshold,0,1e12,.5),tail:['negative','absolute'].includes(a.tail)?a.tail:'positive',display:a.display==='slices'?'slices':'boundaries',slicePoint:point(a.slicePoint)?.map((n,i)=>Math.min([100,100,120][i],Math.max([-100,-140,-80][i],n)))||[0,0,0],sliceOpacity:number(a.sliceOpacity,0,1,.55)};}
  return output;
}
function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function encodedByteLength(text,maxBytes=MAX_FILE_BYTES){if(typeof text!=='string'||text.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Invalid encoded data');const padding=text.endsWith('==')?2:text.endsWith('=')?1:0;const bytes=Math.floor(text.length*3/4)-padding;if(bytes>maxBytes)throw Error('Encoded data exceed the size limit');return bytes;}
function base64ToBytes(text,maxBytes=MAX_FILE_BYTES){encodedByteLength(text,maxBytes);return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}

export function encodeView(input,{publicReferenceIds=[]}={}){
  const state=validateViewState(input);const omitted=[];
  if(state.atlas.startsWith('custom-')){state.atlas='dk';omitted.push('atlas');}
  if(state.roi&&[state.roi.aAtlas,state.roi.bAtlas].some(id=>id.startsWith('custom-'))){delete state.roi;if(state.mode==='roi')state.mode='anatomy';omitted.push('ROI');}
  if(state.atlasExplorer?.atlas.startsWith('custom-')){delete state.atlasExplorer;state.atlasExplorerOpen=false;omitted.push('atlasExplorer');}
  // IDs are not inherently public. Only the caller's bundled reference allowlist can authorize link inclusion.
  const publicIds=new Set(publicReferenceIds instanceof Set||Array.isArray(publicReferenceIds)?publicReferenceIds:[]);
  if(state.literature){
    const l=state.literature,compared=l.compared.filter(id=>publicIds.has(id)),paperId=publicIds.has(l.paperId)?l.paperId:null;
    if((l.paperId&&!paperId)||compared.length!==l.compared.length)omitted.push('literature');
    state.literature={...l,query:'',paperId,compared,showCompare:l.showCompare&&compared.length>1};
  }
  if(state.atlasExplorer)state.atlasExplorer.query='';
  const bytes=new TextEncoder().encode(JSON.stringify(state));if(bytes.length>30000)throw Error('View is too large for a link; export a project file');
  return {encoded:bytesToBase64(bytes).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''),omitted};
}
export function decodeView(encoded){if(!encoded||encoded.length>45000)throw Error('Invalid view link');const base=encoded.replaceAll('-','+').replaceAll('_','/');return validateViewState(JSON.parse(new TextDecoder().decode(base64ToBytes(base+'='.repeat((4-base.length%4)%4)))));}

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function checkedVolumeId(id,ids){if(typeof id!=='string'||!/^custom-[a-zA-Z0-9_-]{1,112}$/.test(id)||ids.has(id))throw Error('Invalid or duplicate custom volume ID');ids.add(id);return id;}
export function assertProjectVolumePayloadSize(byteLength){
  try{assertWorkspaceBudget({assetCount:0,rawPayloadBytes:0,compressedAssetBytes:[byteLength]});}
  catch{throw Error('A compressed project volume exceeds the 128 MiB import limit: compressed-asset-budget');}
}

async function compressVolume(raw){
  const reader=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip')).getReader();
  const chunks=[];let length=0;
  try{
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;assertProjectVolumePayloadSize(length);chunks.push(value);}
  }catch(error){try{await reader.cancel();}catch{/* Preserve the original error. */}throw error;}
  const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;
}

export async function prepareProjectPayload({view,notes=[],evidence=null,volumes=[]}){
  if(!Array.isArray(volumes))throw Error('Invalid project volumes');
  const usage={assetCount:volumes.length,rawPayloadBytes:0,compressedAssetBytes:[],projectUtf8Bytes:0};
  assertWorkspaceBudget(usage);
  const entries=[],encodedAssets=[],ids=new Set();
  // Preflight every asset before the first binary export or compression allocation.
  const candidates=volumes.map(v=>{
    if(!record(v))throw Error('Invalid project volume');
    const id=checkedVolumeId(v.id,ids),metadata=validateVolumeMetadata(v);
    const rawPayloadBytes=(v.data||v.dataTypedArray)?.byteLength+352;
    assertWorkspaceBudget({...usage,rawPayloadBytes});usage.rawPayloadBytes+=rawPayloadBytes;assertWorkspaceBudget(usage);
    return {v,id,metadata,rawPayloadBytes};
  });
  const project={schema:PROJECT_SCHEMA,createdAt:new Date().toISOString(),view:validateViewState(view),notes:projectNotes(notes),evidence:safeObject(evidence,20*1024*1024),volumes:entries};
  // Empty volumes already include the brackets. Entries contribute their exact UTF-8 size.
  let projectedBytes=utf8ByteLength(JSON.stringify(project));
  assertWorkspaceBudget({...usage,projectUtf8Bytes:projectedBytes});
  for(const {v,id,metadata,rawPayloadBytes} of candidates){
    const compressed=await compressVolume(exportNifti(v));
    usage.compressedAssetBytes.push(compressed.byteLength);
    projectedBytes+=utf8ByteLength(JSON.stringify({id,metadata,niftiGzip:''}))+4*Math.ceil(compressed.byteLength/3)+(entries.length?1:0);
    // Reject before allocating the base64 string or concatenating the final JSON document.
    assertWorkspaceBudget({...usage,projectUtf8Bytes:projectedBytes});
    const entry={id,metadata,niftiGzip:bytesToBase64(compressed)};
    entries.push(entry);encodedAssets.push({...entry,rawPayloadBytes,compressedBytes:compressed.byteLength});
  }
  const text=JSON.stringify(project);usage.projectUtf8Bytes=utf8ByteLength(text);assertWorkspaceBudget(usage);
  return {text,usage,encodedAssets};
}
export async function serializeProject(workspace){return (await prepareProjectPayload(workspace)).text;}

function projectNotes(notes){
  if(!Array.isArray(notes)||notes.length>20000)throw Error('Invalid project content');
  return safeObject(notes.map(n=>{if(typeof n?.text!=='string'||n.text.length>100000)throw Error('Invalid project note');return {id:boundedString(n.id,160)||crypto.randomUUID(),text:n.text,structureId:boundedString(n.structureId,160),structureName:boundedString(n.structureName,500),createdAt:typeof n.createdAt==='string'&&Number.isFinite(Date.parse(n.createdAt))?n.createdAt:new Date().toISOString(),position:point(n.position),coordinateSpace:boundedString(n.coordinateSpace,50),coordinateFrame:boundedString(n.coordinateFrame,160)};}),8*1024*1024);
}
export async function parseProject(text){
  if(typeof text!=='string')throw Error('Project exceeds 180 MB');
  const projectUtf8Bytes=utf8ByteLength(text);assertWorkspaceBudget({assetCount:0,rawPayloadBytes:0,projectUtf8Bytes});
  const p=JSON.parse(text);if(!record(p)||p.schema!==PROJECT_SCHEMA)throw Error('Unsupported project format');
  const view=validateViewState(p.view);if(!Array.isArray(p.volumes))throw Error('Invalid project content');
  const notes=projectNotes(p.notes),evidence=safeObject(p.evidence,20*1024*1024);
  const ids=new Set(),volumes=[],usage={assetCount:p.volumes.length,rawPayloadBytes:0,compressedAssetBytes:[],projectUtf8Bytes};
  assertWorkspaceBudget(usage);
  const candidates=p.volumes.map(e=>{
    if(!record(e))throw Error('Invalid project volume');
    const id=checkedVolumeId(e.id,ids),meta=validateVolumeMetadata(e.metadata);
    usage.compressedAssetBytes.push(encodedByteLength(e.niftiGzip,MAX_NIFTI_FILE_BYTES));assertWorkspaceBudget(usage);
    return {id,meta,niftiGzip:e.niftiGzip};
  });
  for(const {id,meta,niftiGzip} of candidates){
    const remaining=MAX_WORKSPACE_RAW_PAYLOAD_BYTES-usage.rawPayloadBytes;
    const volume=await parseNifti(base64ToBytes(niftiGzip,MAX_NIFTI_FILE_BYTES),{name:meta.name,space:meta.space,kind:meta.kind,maxDecodedVoxelBytes:Math.max(0,remaining-352),maxInflatedBytes:remaining});
    usage.rawPayloadBytes+=352+volume.data.byteLength;assertWorkspaceBudget(usage);
    const declared=meta.space==='MNI152NLin6Asym'&&meta.alignmentStatus==='user-declared'&&meta.canOverlayOnTarget&&meta.provenance.trim().length>0;
    volumes.push({...meta,...volume,id,metadata:{...volume.metadata,affineConflict:!!(volume.metadata.affineConflict||meta.metadata.affineConflict||meta.metadata.sourceImport?.affineConflict),sourceImport:meta.metadata.sourceImport||meta.metadata,userDeclaredAligned:declared,referenceSpace:meta.space,restoredFromProject:true},labels:meta.labels,custom:true,available:true,canOverlayOnTarget:declared,alignmentStatus:declared?'user-declared':'unverified'});
  }
  const restored={schema:PROJECT_SCHEMA,view,notes,evidence,volumes};
  // Restoration adds truthful header provenance; admit its actual next export too.
  await prepareProjectPayload(restored);
  return restored;
}
export function readSavedViews(storage=localStorage){try{const values=JSON.parse(storage.getItem('neuroatlas-saved-views')||'[]');return Array.isArray(values)?values.filter(v=>typeof v.id==='string'&&typeof v.name==='string').slice(0,30).map(v=>({...v,view:validateViewState(v.view)})):[];}catch{return [];}}
export function writeSavedViews(values,storage=localStorage){storage.setItem('neuroatlas-saved-views',JSON.stringify(values.slice(0,30)));}

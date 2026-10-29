import {validateVolumeMetadata,assertWorkspaceBudget,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,MAX_PROJECT_UTF8_BYTES,utf8ByteLength,boundedJsonStringify} from './workspace-limits.js';
import {parseNifti,exportNifti,MAX_NIFTI_FILE_BYTES} from './nifti.js';
import {atlasRegionKey} from './atlas-identity.js';
import {savedComputationUsage,encodeSavedComputation,inspectEncodedSavedComputation,decodeSavedComputation} from './saved-computation.js';
import {validateResultLayers,projectPublicResultLayers,resolveResultLayers} from './result-layers.js';
import {migrateEvidence,emptyEvidence} from './evidence-schema.js';
import {validateAssetIdentity,validateGridSpec,validateTransformIdentity,encodeDerivedVolume,makeAssetIdentity,compareComputationManifest,prepareLocalVolumeProvenance} from './computation-manifest.js';

export const PROJECT_SCHEMA='neuroatlas-project-v2';
export const LEGACY_PROJECT_SCHEMA='neuroatlas-project-v1';
export const VIEW_SCHEMA='neuroatlas-view-v2';
const PROVENANCE_STATES=['missing-input','missing-provenance','unverified','matched','mismatch'];
function projectProvenance(value,snapshots){
  if(value!=null&&!PROVENANCE_STATES.includes(value))throw Error('invalid-project-provenance-status');
  const recorded=Object.values(snapshots).filter(Boolean);
  if(recorded.some(s=>s.status==='missing-input'))return 'missing-input';
  if(recorded.some(s=>savedComputationUsage(s).metadata.status==='missing-provenance'))return 'missing-provenance';
  return value??(recorded.length?'unverified':'missing-provenance');
}
const MAX_FILE_BYTES=MAX_PROJECT_UTF8_BYTES;
const boundedString=(v,max=500)=>typeof v==='string'?v.slice(0,max):'';
const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
const stringArray=(v,max=500)=>Array.isArray(v)?v.filter(s=>typeof s==='string'&&s.length<=120).slice(0,max):[];
const point=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<10000)?[...v]:null;
const coordinatePoint=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)?[...v]:null;
const finiteCoordinate=(v,fallback)=>Number.isFinite(v)?v:fallback;
function coordinateOrigin(value){
  const origin={kind:['manual','result','private'].includes(value?.kind)?value.kind:'unknown',cameraSensitive:value?.cameraSensitive!==false,explorerSensitive:value?.explorerSensitive!==false,imported:value?.imported===true};
  if(origin.kind==='result'){
    for(const key of ['resultId','sourceReferenceId','coordinateId','spaceId'])if(typeof value[key]!=='string'||!value[key]||value[key].length>160)return {...origin,kind:'unknown'};
    for(const key of ['resultId','sourceReferenceId','coordinateId','spaceId'])origin[key]=value[key];
  }
  return origin;
}
function shareableCoordinate(state,options){
  const origin=state.coordinateOrigin;
  if(origin.kind==='manual')return !origin.imported;
  if(origin.kind!=='result'||origin.spaceId!=='MNI152NLin6Asym')return false;
  try{
    const candidate={layerId:'coordinate-origin',resultId:origin.resultId,sourceReferenceId:origin.sourceReferenceId,coordinateIds:[origin.coordinateId],spaceId:origin.spaceId,visible:true,style:{}};
    const publicLayer=projectPublicResultLayers([candidate],options).layers;
    if(publicLayer.length!==1)return false;
    const marker=resolveResultLayers(publicLayer,options).markers[0];
    return marker?.space===origin.spaceId&&marker.position.every((value,i)=>value===state.coordinate[i]);
  }catch{return false;}
}
export function validateCamera(v){
  const position=point(v?.position),target=point(v?.target);
  if(!position||!target||position.every((n,i)=>n===target[i]))return null;
  const camera={position,target,zoom:number(v.zoom,.12,18,1)};
  if(v.frameExtent!==undefined){if(!Number.isFinite(v.frameExtent)||v.frameExtent<=0||v.frameExtent>1e6)return null;camera.frameExtent=v.frameExtent;}
  if(v.up!==undefined){const up=point(v.up),length=up&&Math.hypot(...up);if(!length)return null;camera.up=up.map(n=>n/length);}
  return camera;
}
const safeObject=(value,maxBytes=50000)=>JSON.parse(boundedJsonStringify(value??null,maxBytes,'View state is too large'));

function regionRef(value){
  atlasRegionKey(value);
  if(!['atlasId','atlasVersion','spaceId'].every(key=>value[key].length<=160))throw Error('Invalid AtlasRegionRef length');
  return {atlasId:value.atlasId,atlasVersion:value.atlasVersion,labelId:value.labelId,hemisphere:value.hemisphere,spaceId:value.spaceId};
}
const regionRefs=value=>{if(!Array.isArray(value)||value.length>5000)throw Error('Invalid atlas selection');return value.map(regionRef);};
export function validateMissingAssetIds(value=[]){
  if(!Array.isArray(value)||value.length>20000||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!/^custom-[a-zA-Z0-9_-]{1,112}$/.test(id)))throw Error('invalid-missing-asset-ids');
  return [...value];
}
export function validateProjectDrafts(value=[],projectId){
  if(!Array.isArray(value)||value.length>30)throw Error('draft-count');
  const drafts=JSON.parse(boundedJsonStringify(value,1024*1024,'draft-json-budget')),ids=new Set();
  for(const d of drafts){if(!d||typeof d!=='object'||typeof d.id!=='string'||!d.id||ids.has(d.id)||d.projectId!==projectId||typeof d.kind!=='string'||!d.kind.trim()||!(d.recordId===null||typeof d.recordId==='string')||!d.payload||typeof d.payload!=='object'||Array.isArray(d.payload)||typeof d.updatedAt!=='string'||!Number.isFinite(Date.parse(d.updatedAt)))throw Error('invalid-draft');boundedJsonStringify(d.payload,50000,'draft-payload-budget');ids.add(d.id);}
  return drafts;
}

export function validateViewState(input,{savedProjectId,projectId}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid view state');
  // Named local references are meaningful only in their original project. A v1
  // view has no layers; public URLs use their separate canonical-public gate.
  if(projectId!==undefined&&input.schema!=='neuroatlas-view-v1'&&input.resultLayers?.length&&savedProjectId!==projectId)throw Error('named-view-project-mismatch: Open the originating project before restoring these result layers.');
  if(projectId!==undefined&&['original','recomputed'].includes(input.roi?.snapshot)&&savedProjectId!==projectId)throw Error('named-view-project-mismatch: Open the originating project before restoring this saved computation.');
  const output={schema:VIEW_SCHEMA,language:input.language==='en'?'en':'zh',atlas:boundedString(input.atlas,120)||'dk',selectedIds:stringArray(input.selectedIds),visibleCategories:stringArray(input.visibleCategories,20),hiddenIds:stringArray(input.hiddenIds),hemisphere:['L','R'].includes(input.hemisphere)?input.hemisphere:'both',opacity:number(input.opacity,0,1,1),exploded:input.exploded===true,labels:input.labels===true,showSchematic:input.showSchematic===true,preset:boundedString(input.preset,40)||'cortex',view:boundedString(input.view,40)||'oblique',mode:['roi','research'].includes(input.mode)?input.mode:'anatomy',network:boundedString(input.network,80)||null,coordinate:coordinatePoint(input.coordinate)||[-38,-20,54],showSlices:input.showSlices===true,camera:validateCamera(input.camera),researchScope:input.researchScope===true,atlasExplorerOpen:input.atlasExplorerOpen===true};
  // `brain` is the existing main-template sentinel. Only absent legacy fields
  // default to it; explicit unknown/native contexts must remain independent.
  output.coordinateSpace=Object.hasOwn(input,'coordinateSpace')?(typeof input.coordinateSpace==='string'&&input.coordinateSpace.length<=500?input.coordinateSpace:null):'brain';
  output.coordinateOrigin=coordinateOrigin(input.coordinateOrigin);
  if(projectId!==undefined&&savedProjectId!==projectId)output.coordinateOrigin={...output.coordinateOrigin,imported:true,cameraSensitive:true,explorerSensitive:true};
  const s=input.slices||{};output.slices={enabled:s.enabled===true,x:finiteCoordinate(s.x,-38),y:finiteCoordinate(s.y,-20),z:finiteCoordinate(s.z,54),axis:['x','y','z'].includes(s.axis)?s.axis:'z'};
  if(input.roi){const r=input.roi;output.roi={aAtlas:r.aAtlas===''?'':boundedString(r.aAtlas,120)||'dk',bAtlas:r.bAtlas===''?'':boundedString(r.bAtlas,120)||'ba-histology',aLabels:Array.isArray(r.aLabels)?r.aLabels.filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,5000):[],bLabels:Array.isArray(r.bLabels)?r.bLabels.filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,5000):[],aThreshold:number(r.aThreshold,-1e12,1e12,0),bThreshold:number(r.bThreshold,-1e12,1e12,0),aTail:['negative','absolute'].includes(r.aTail)?r.aTail:'positive',bTail:['negative','absolute'].includes(r.bTail)?r.bTail:'positive',computed:r.computed===true,display:{mode:['parts','overlap','A','B'].includes(r.display?.mode)?r.display.mode:'parts',opacityA:number(r.display?.opacityA,0,1,.65),opacityB:number(r.display?.opacityB,0,1,.65),opacityOverlap:number(r.display?.opacityOverlap,0,1,.9),xray:r.display?.xray===true}};}
  if(input.literature){const l=input.literature,paperModality=boundedString(l.paperModality??l.modality,100);output.literature={query:boundedString(l.query,500),topic:boundedString(l.topic,100),modality:paperModality,paperModality,resultModality:boundedString(l.resultModality,100),scope:l.scope===true,paperId:boundedString(l.paperId,160)||null,compared:stringArray(l.compared,3),showCompare:l.showCompare===true,scopeRegionId:boundedString(l.scopeRegionId,120)||null,onlyResults:l.onlyResults===true};}
  if(input.atlasExplorer){const a=input.atlasExplorer;output.atlasExplorer={atlas:boundedString(a.atlas,120)||'dk',query:boundedString(a.query,200),selected:Array.isArray(a.selected)?a.selected.filter(x=>Number.isInteger(x)&&x>0).slice(0,5000):[],opacity:number(a.opacity,0,1,1),camera:validateCamera(a.camera),threshold:number(a.threshold,0,1e12,.5),tail:['negative','absolute'].includes(a.tail)?a.tail:'positive',display:a.display==='slices'?'slices':'boundaries',slicePoint:coordinatePoint(a.slicePoint)||[0,0,0],sliceOpacity:number(a.sliceOpacity,0,1,.55)};}
  for(const key of ['atlasSelection','unresolvedAtlasSelection'])if(input[key]!==undefined)output[key]=regionRefs(input[key]);
  if(input.atlasSelectionQuery!==undefined)output.atlasSelectionQuery=safeObject(input.atlasSelectionQuery);
  output.resultLayers=input.schema==='neuroatlas-view-v1'?[]:validateResultLayers(safeObject(input.resultLayers??[],2*1024*1024));
  if(input.roi){for(const key of ['aRegionRefs','bRegionRefs','unresolvedRegionRefs'])if(input.roi[key]!==undefined)output.roi[key]=regionRefs(input.roi[key]);if(input.roi.resolutionMm!==undefined){if(![1,2].includes(input.roi.resolutionMm))throw Error('Invalid ROI grid spacing');output.roi.resolutionMm=input.roi.resolutionMm;}}
  if(input.roi?.snapshot!==undefined){if(!['original','recomputed','none'].includes(input.roi.snapshot))throw Error('Invalid ROI snapshot reference');output.roi.snapshot=input.roi.snapshot;}
  return output;
}
function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function encodedByteLength(text,maxBytes=MAX_FILE_BYTES){if(typeof text!=='string'||text.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Invalid encoded data');const padding=text.endsWith('==')?2:text.endsWith('=')?1:0;const bytes=Math.floor(text.length*3/4)-padding;if(bytes>maxBytes)throw Error('Encoded data exceed the size limit');return bytes;}
function base64ToBytes(text,maxBytes=MAX_FILE_BYTES){encodedByteLength(text,maxBytes);return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}

export function encodeView(input,{publicReferenceIds=[],publicResults,publicEvidence,evidence}={}){
  const state=validateViewState(input);const omitted=[];
  if(state.coordinateSpace!=='brain'||!shareableCoordinate(state,{publicReferenceIds,publicResults,publicEvidence,evidence})){
    state.coordinateSpace='brain';state.coordinate=[-38,-20,54];state.slices={enabled:false,x:-38,y:-20,z:54,axis:'z'};state.camera=null;state.showSlices=false;
    state.coordinateOrigin={kind:'manual',cameraSensitive:false,explorerSensitive:false,imported:false};
    if(state.atlasExplorer){state.atlasExplorer.slicePoint=[0,0,0];state.atlasExplorer.camera=null;}
    omitted.push('coordinate');
  }else if(state.coordinateOrigin.cameraSensitive){
    state.camera=null;state.coordinateOrigin.cameraSensitive=false;omitted.push('camera');
    if(state.atlasExplorer){state.atlasExplorer.slicePoint=[0,0,0];state.atlasExplorer.camera=null;}
  }
  // The explorer has its own retained reference/camera; resetting only the
  // main BrainScene cannot release independently imported explorer locations.
  if(state.atlasExplorer&&state.coordinateOrigin.explorerSensitive){
    state.atlasExplorer.slicePoint=[0,0,0];state.atlasExplorer.camera=null;
    state.coordinateOrigin.explorerSensitive=false;omitted.push('atlasExplorer.location');
  }
  // Main crosshairs are coupled. A copied public point ID cannot authorize
  // unrelated slice values from an imported view.
  if(['x','y','z'].some((axis,i)=>state.slices[axis]!==state.coordinate[i])){
    for(const [i,axis]of ['x','y','z'].entries())state.slices[axis]=state.coordinate[i];
    omitted.push('slices');
  }
  const projectRegionRefs=(container,keys,prefix='')=>{for(const key of keys)if(container?.[key]){const original=container[key];container[key]=original.filter(ref=>!ref.atlasId.startsWith('custom-'));if(original.length!==container[key].length)omitted.push(`${prefix}${key}`);}};
  const projection=projectPublicResultLayers(state.resultLayers,{publicReferenceIds,publicResults,publicEvidence,evidence});state.resultLayers=projection.layers;omitted.push(...projection.omitted);
  projectRegionRefs(state,['atlasSelection','unresolvedAtlasSelection']);
  if(state.atlasSelectionQuery){delete state.atlasSelectionQuery;omitted.push('atlasSelectionQuery');}
  if(state.atlas.startsWith('custom-')){state.atlas='dk';omitted.push('atlas');}
  if(state.roi&&[state.roi.aAtlas,state.roi.bAtlas].some(id=>id.startsWith('custom-'))){delete state.roi;if(state.mode==='roi')state.mode='anatomy';omitted.push('ROI');}
  projectRegionRefs(state.roi,['aRegionRefs','bRegionRefs','unresolvedRegionRefs'],'roi.');
  if(state.roi){delete state.roi.snapshot;state.roi.computed=false;}
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
export function decodeView(encoded){if(!encoded||encoded.length>45000)throw Error('Invalid view link');const base=encoded.replaceAll('-','+').replaceAll('_','/');const view=validateViewState(JSON.parse(new TextDecoder().decode(base64ToBytes(base+'='.repeat((4-base.length%4)%4)))));if(view.roi){view.roi.snapshot='none';view.roi.computed=false;}return view;}

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

const VOLUME_PROVENANCE_FIELDS=['identity','sourceIdentities','sourceGrid','transforms','encoding','spatialEvidence'];
function checkedVolumeProvenance(input){
  if(input==null)return null;
  const value=JSON.parse(boundedJsonStringify(input,2*1024*1024,'project-volume-provenance-budget'));
  if(!record(value)||!Array.isArray(value.sourceIdentities)||!Array.isArray(value.transforms)||!record(value.encoding)||!record(value.spatialEvidence))throw Error('project-volume-provenance-required');
  const identity=validateAssetIdentity(value.identity);value.sourceIdentities.forEach(validateAssetIdentity);value.transforms.forEach(validateTransformIdentity);
  if(identity.spaceId===null){if(value.sourceGrid!==null)throw Error('project-volume-grid-mismatch');}
  else if(validateGridSpec(value.sourceGrid).space!==identity.spaceId)throw Error('project-volume-grid-mismatch');
  if(!['uint8','int8','uint16','int16','uint32','int32','float32','float64'].includes(value.encoding.dtype)||value.encoding.byteOrder!=='little-endian'||typeof value.encoding.derivation!=='string'||!value.encoding.derivation)throw Error('project-volume-encoding-mismatch');
  return Object.fromEntries(VOLUME_PROVENANCE_FIELDS.map(key=>[key,value[key]]));
}
function volumeProvenanceFor(volume){
  const value=volume.identity?checkedVolumeProvenance(Object.fromEntries(VOLUME_PROVENANCE_FIELDS.map(key=>[key,volume[key]]))):null;
  if(value?.sourceGrid){const original=validateGridSpec(volume.sourceGrid);for(let i=0;i<16;i++)if(Object.is(original.affine[i],-0))value.sourceGrid.affine[i]=-0;}
  return value;
}
function checkVolumeProvenanceGrid(volume,provenance){
  if(!provenance)return;
  if(provenance.identity.spaceId!==null){
    const actual=validateGridSpec({...volume,order:volume.order||'x-fastest'});
    if(provenance.identity.spaceId!==volume.space||!compareComputationManifest(provenance.sourceGrid,actual).matches)throw Error('project-volume-grid-mismatch');
  }
}
// The embedded NIfTI uses mm sform/float32 geometry and x-fastest voxel storage.
// This versioned layout retains the exact decoded grid/order independently.
const VOLUME_LAYOUT_SCHEMA='neuroatlas-volume-layout-v1';
const storageGridFor=grid=>({...grid,shape:[...grid.shape],affine:grid.affine.map((value,index)=>index<12?Math.fround(value):value),order:'x-fastest'});
function checkedVolumeLayout(input){
  if(input==null)return null;
  const value=JSON.parse(boundedJsonStringify(input,16*1024,'project-volume-layout-budget'));
  if(!record(value)||value.schema!==VOLUME_LAYOUT_SCHEMA)throw Error('project-volume-layout-mismatch');
  const grid=validateGridSpec(value.grid),storageGrid=validateGridSpec(value.storageGrid);
  const signs=value.negativeZeroAffineIndices??[];
  if(!Array.isArray(signs)||signs.length>16||new Set(signs).size!==signs.length||signs.some(index=>!Number.isInteger(index)||index<0||index>15||grid.affine[index]!==0||storageGrid.affine[index]!==0))throw Error('project-volume-layout-mismatch');
  for(const index of signs){grid.affine[index]=-0;storageGrid.affine[index]=-0;}
  const expectedStorage=storageGridFor(grid);
  for(let i=0;i<16;i++)if(Object.is(expectedStorage.affine[i],-0)&&storageGrid.affine[i]===0)storageGrid.affine[i]=-0;
  if(!compareComputationManifest(expectedStorage,storageGrid).matches)throw Error('project-volume-layout-mismatch');
  return {schema:VOLUME_LAYOUT_SCHEMA,grid,storageGrid,...(signs.length?{negativeZeroAffineIndices:signs}:{})};
}
function makeVolumeLayout(volume){
  const grid=validateGridSpec({...volume,order:volume.order||'x-fastest'});
  const negativeZeroAffineIndices=grid.affine.flatMap((value,index)=>Object.is(value,-0)?[index]:[]);
  return checkedVolumeLayout({schema:VOLUME_LAYOUT_SCHEMA,grid,storageGrid:storageGridFor(grid),negativeZeroAffineIndices});
}
function restoreVolumeLayout(volume,layout,space){
  if(!layout)return volume;
  const actual=validateGridSpec({...volume,order:volume.order||'x-fastest'}),header=volume.metadata;
  if(layout.grid.space!==space||!compareComputationManifest(layout.storageGrid,actual).matches||header.littleEndian!==true||header.originalSpatialUnits!==2||header.affineSource!=='sform'||header.sformCode!==2||header.qformCode!==0||header.scaling.slope!==1||header.scaling.intercept!==0)throw Error('project-volume-storage-mismatch');
  let data=volume.data;
  if(layout.grid.order==='z-fastest'){
    const [nx,ny,nz]=layout.grid.shape;data=new volume.data.constructor(volume.data.length);
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)data[z+nz*(y+ny*x)]=volume.data[x+nx*(y+ny*z)];
  }
  return {...volume,...layout.grid,data,dataTypedArray:data};
}
async function verifyVolumeProvenance(volume,provenance){
  checkVolumeProvenanceGrid(volume,provenance);
  const encoded=encodeDerivedVolume(volume);
  if(encoded.dtype!==provenance.encoding.dtype||encoded.byteOrder!==provenance.encoding.byteOrder)throw Error('project-volume-encoding-mismatch');
  const observed=await makeAssetIdentity(encoded.bytes,provenance.identity);
  if(!compareComputationManifest(validateAssetIdentity(provenance.identity),observed).matches)throw Error('project-volume-digest-mismatch');
  return observed;
}

export async function prepareProjectPayload({projectId=`project-${crypto.randomUUID()}`,view,notes=[],evidence=null,drafts=[],volumes=[],missingAssetIds=[],roiSnapshot=null,recomputedSnapshot=null,provenanceStatus}){
  if(typeof projectId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(projectId))throw Error('Invalid project ID');
  if(!Array.isArray(volumes))throw Error('Invalid project volumes');
  const usage={assetCount:volumes.length,rawPayloadBytes:0,compressedAssetBytes:[],projectUtf8Bytes:0};
  assertWorkspaceBudget(usage);
  const entries=[],encodedAssets=[],ids=new Set();
  const snapshots={roiSnapshot,recomputedSnapshot};
  for(const snapshot of Object.values(snapshots)){usage.rawPayloadBytes+=savedComputationUsage(snapshot).rawPayloadBytes;assertWorkspaceBudget(usage);}
  // Preflight every asset before the first binary export or compression allocation.
  const candidates=volumes.map(v=>{
    if(!record(v))throw Error('Invalid project volume');
    const id=checkedVolumeId(v.id,ids),metadata=validateVolumeMetadata(v),volumeProvenance=volumeProvenanceFor(v);
    checkVolumeProvenanceGrid(v,volumeProvenance);
    let rawPayloadBytes=(v.data||v.dataTypedArray)?.byteLength+352+(volumeProvenance?utf8ByteLength(JSON.stringify(volumeProvenance)):0);
    assertWorkspaceBudget({...usage,rawPayloadBytes:usage.rawPayloadBytes+rawPayloadBytes});
    const layout=makeVolumeLayout({...v,space:metadata.space});rawPayloadBytes+=utf8ByteLength(JSON.stringify(layout));
    assertWorkspaceBudget({...usage,rawPayloadBytes});usage.rawPayloadBytes+=rawPayloadBytes;assertWorkspaceBudget(usage);
    return {v,id,metadata,volumeProvenance,layout,rawPayloadBytes};
  });
  const encodedSnapshots={};
  for(const [key,snapshot] of Object.entries(snapshots)){const encoded=await encodeSavedComputation(snapshot);encodedSnapshots[key]=encoded.value;if(snapshot)usage.compressedAssetBytes.push(encoded.compressedBytes);assertWorkspaceBudget(usage);}
  const project={schema:PROJECT_SCHEMA,projectId,createdAt:new Date().toISOString(),view:validateViewState(view),notes:validateProjectNotes(notes),evidence:safeObject(evidence,20*1024*1024),drafts:validateProjectDrafts(drafts,projectId),volumes:entries,missingAssetIds:validateMissingAssetIds(missingAssetIds),...encodedSnapshots,provenanceStatus:projectProvenance(provenanceStatus,snapshots)};
  // Empty volumes already include the brackets. Entries contribute their exact UTF-8 size.
  let projectedBytes=utf8ByteLength(JSON.stringify(project));
  assertWorkspaceBudget({...usage,projectUtf8Bytes:projectedBytes});
  for(const {v,id,metadata,volumeProvenance,layout,rawPayloadBytes} of candidates){
    if(volumeProvenance)await verifyVolumeProvenance(v,volumeProvenance);
    const compressed=await compressVolume(exportNifti(v,{kind:metadata.kind}));
    usage.compressedAssetBytes.push(compressed.byteLength);
    projectedBytes+=utf8ByteLength(JSON.stringify({id,metadata,...(volumeProvenance?{volumeProvenance}:{}),layout,niftiGzip:''}))+4*Math.ceil(compressed.byteLength/3)+(entries.length?1:0);
    // Reject before allocating the base64 string or concatenating the final JSON document.
    assertWorkspaceBudget({...usage,projectUtf8Bytes:projectedBytes});
    const entry={id,metadata,...(volumeProvenance?{volumeProvenance}:{}),layout,niftiGzip:bytesToBase64(compressed)};
    entries.push(entry);encodedAssets.push({...entry,rawPayloadBytes,compressedBytes:compressed.byteLength});
  }
  const text=JSON.stringify(project);usage.projectUtf8Bytes=utf8ByteLength(text);assertWorkspaceBudget(usage);
  return {text,usage,encodedAssets};
}
export async function serializeProject(workspace){return (await prepareProjectPayload(workspace)).text;}

export function validateProjectNotes(notes){
  if(!Array.isArray(notes)||notes.length>20000)throw Error('Invalid project content');
  const normalized=[],ids=new Set();let bytes=2;
  for(const n of notes){
    if(typeof n?.text!=='string'||n.text.length>100000)throw Error('Invalid project note');
    const entry={id:boundedString(n.id,160)||crypto.randomUUID(),text:n.text,structureId:boundedString(n.structureId,160),structureName:boundedString(n.structureName,500),createdAt:typeof n.createdAt==='string'&&Number.isFinite(Date.parse(n.createdAt))?n.createdAt:new Date().toISOString(),position:point(n.position),coordinateSpace:boundedString(n.coordinateSpace,50),coordinateFrame:boundedString(n.coordinateFrame,160)};
    if(ids.has(entry.id))throw Error('duplicate-note');ids.add(entry.id);
    if(n.regionRef!==undefined){entry.regionRef=regionRef(n.regionRef);delete entry.structureId;}
    if(n.queryContext!==undefined)entry.queryContext=safeObject(n.queryContext);
    const comma=normalized.length?1:0;
    const text=boundedJsonStringify(entry,8*1024*1024-bytes-comma,'View state is too large');
    bytes+=comma+utf8ByteLength(text);normalized.push(entry);
  }
  return normalized;
}
/** Only the project container receives a new identity; no historical computation is invented. */
export function migrateProjectV1(value){
  if(!record(value)||value.schema!==LEGACY_PROJECT_SCHEMA)throw Error('Unsupported project format');
  const view=validateViewState(value.view);if(view.roi)view.roi.computed=false;
  return {...value,schema:PROJECT_SCHEMA,projectId:`project-${crypto.randomUUID()}`,view,evidence:migrateEvidence(value.evidence??emptyEvidence()).value,drafts:[],roiSnapshot:null,recomputedSnapshot:null,provenanceStatus:'missing-provenance'};
}
export async function parseProject(text){
  if(typeof text!=='string')throw Error('Project exceeds 180 MB');
  const projectUtf8Bytes=utf8ByteLength(text);assertWorkspaceBudget({assetCount:0,rawPayloadBytes:0,projectUtf8Bytes});
  let p=JSON.parse(text);if(!record(p)||![PROJECT_SCHEMA,LEGACY_PROJECT_SCHEMA].includes(p.schema))throw Error('Unsupported project format');
  if(p.schema===LEGACY_PROJECT_SCHEMA)p=migrateProjectV1(p);
  const view=validateViewState(p.view);if(!Array.isArray(p.volumes))throw Error('Invalid project content');
  // File claims cannot attest how a point or camera was obtained. Exact public
  // result references can still be independently authorized at link projection.
  view.coordinateOrigin={...view.coordinateOrigin,cameraSensitive:true,explorerSensitive:true,imported:true};
  const projectId=p.schema===PROJECT_SCHEMA?p.projectId:`project-${crypto.randomUUID()}`;
  if(typeof projectId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(projectId))throw Error('Invalid project ID');
  const drafts=validateProjectDrafts(p.schema===LEGACY_PROJECT_SCHEMA?[]:p.drafts??[],projectId);
  const notes=validateProjectNotes(p.notes),evidence=safeObject(p.evidence,20*1024*1024);
  const ids=new Set(),volumes=[],usage={assetCount:p.volumes.length,rawPayloadBytes:0,compressedAssetBytes:[],projectUtf8Bytes};
  assertWorkspaceBudget(usage);
  const snapshotInputs=p.schema===LEGACY_PROJECT_SCHEMA?{roiSnapshot:null,recomputedSnapshot:null}:{roiSnapshot:p.roiSnapshot??null,recomputedSnapshot:p.recomputedSnapshot??null};
  for(const snapshot of Object.values(snapshotInputs)){const declared=inspectEncodedSavedComputation(snapshot);usage.rawPayloadBytes+=declared.rawPayloadBytes;if(snapshot)usage.compressedAssetBytes.push(declared.compressedBytes);assertWorkspaceBudget(usage);}
  const candidates=p.volumes.map(e=>{
    if(!record(e))throw Error('Invalid project volume');
    const id=checkedVolumeId(e.id,ids),meta=validateVolumeMetadata(e.metadata),volumeProvenance=checkedVolumeProvenance(e.volumeProvenance),layout=checkedVolumeLayout(e.layout);
    if(volumeProvenance?.sourceGrid)for(const index of layout?.negativeZeroAffineIndices??[])if(volumeProvenance.sourceGrid.affine[index]===0)volumeProvenance.sourceGrid.affine[index]=-0;
    usage.rawPayloadBytes+=(volumeProvenance?utf8ByteLength(JSON.stringify(volumeProvenance)):0)+(layout?utf8ByteLength(JSON.stringify(layout)):0);
    usage.compressedAssetBytes.push(encodedByteLength(e.niftiGzip,MAX_NIFTI_FILE_BYTES));assertWorkspaceBudget(usage);
    return {id,meta,volumeProvenance,layout,niftiGzip:e.niftiGzip};
  });
  for(const {id,meta,volumeProvenance,layout,niftiGzip} of candidates){
    const remaining=MAX_WORKSPACE_RAW_PAYLOAD_BYTES-usage.rawPayloadBytes;
    const received=base64ToBytes(niftiGzip,MAX_NIFTI_FILE_BYTES);
    let volume=await parseNifti(received,{name:meta.name,space:meta.space,kind:meta.kind,maxDecodedVoxelBytes:Math.max(0,remaining-352),maxInflatedBytes:remaining});
    usage.rawPayloadBytes+=352+volume.data.byteLength;assertWorkspaceBudget(usage);
    volume=restoreVolumeLayout(volume,layout,meta.space);
    let observed;
    if(volumeProvenance){observed=await verifyVolumeProvenance(volume,volumeProvenance);volume={...volume,...volumeProvenance};}
    else{const declared=meta.space==='MNI152NLin6Asym'&&meta.alignmentStatus==='user-declared'&&meta.canOverlayOnTarget&&meta.provenance.trim().length>0;volume=await prepareLocalVolumeProvenance({...meta,...volume,canOverlayOnTarget:declared,alignmentStatus:declared?'user-declared':'unverified'},received,{id:`project-entry:${id}`});observed=volume.identity;}
    volume.projectEntryObservation={scope:'current-project-entry',derivedIdentity:observed,originalSourceBytesEmbedded:false};
    const declared=volume.identity.spaceId===meta.space&&meta.space==='MNI152NLin6Asym'&&meta.alignmentStatus==='user-declared'&&meta.canOverlayOnTarget&&meta.provenance.trim().length>0;
    volumes.push({...meta,...volume,id,metadata:{...volume.metadata,affineConflict:!!(volume.metadata.affineConflict||meta.metadata.affineConflict||meta.metadata.sourceImport?.affineConflict),sourceImport:meta.metadata.sourceImport||meta.metadata,userDeclaredAligned:declared,referenceSpace:meta.space,restoredFromProject:true},labels:meta.labels,custom:true,available:true,canOverlayOnTarget:declared,alignmentStatus:declared?'user-declared':'unverified'});
  }
  const snapshots={};for(const [key,snapshot]of Object.entries(snapshotInputs))snapshots[key]=await decodeSavedComputation(snapshot);
  // Restoring a file never authorizes a new computation; W6 owns explicit recompute.
  if(view.roi){view.roi.computed=false;view.roi.snapshot??=snapshots.recomputedSnapshot?'recomputed':snapshots.roiSnapshot?'original':'none';}
  const restored={schema:PROJECT_SCHEMA,projectId,view,notes,evidence,drafts,volumes,...snapshots,missingAssetIds:validateMissingAssetIds(p.missingAssetIds??[]),provenanceStatus:projectProvenance(p.provenanceStatus,snapshots)};
  // Restoration adds truthful header provenance; admit its actual next export too.
  await prepareProjectPayload(restored);
  return restored;
}
export function readSavedViews(storage=localStorage){try{const values=JSON.parse(storage.getItem('neuroatlas-saved-views')||'[]');return Array.isArray(values)?values.filter(v=>typeof v.id==='string'&&typeof v.name==='string').slice(0,30).map(v=>({...v,view:validateViewState(v.view)})):[];}catch{return [];}}
export function writeSavedViews(values,storage=localStorage){storage.setItem('neuroatlas-saved-views',JSON.stringify(values.slice(0,30)));}

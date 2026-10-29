import {boundedJsonStringify,utf8ByteLength,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,MAX_COMPRESSED_ASSET_BYTES} from './workspace-limits.js';
import {makeComputationManifest,compareComputationManifest} from './computation-manifest.js';
import {attachROISurfaces} from './roi.js';

const MAX_SNAPSHOT_METADATA_BYTES=2*1024*1024;
const MAX_CLASSES=64_000_000;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function gridCount(grid){
 if(!object(grid)||grid.shape?.length!==3||!grid.shape.every(n=>Number.isSafeInteger(n)&&n>0)||grid.affine?.length!==16||!grid.affine.every(Number.isFinite)||typeof grid.space!=='string'||!grid.space||!['x-fastest','z-fastest'].includes(grid.order))throw Error('snapshot-grid');
 const count=grid.shape.reduce((a,b)=>a*b,1);if(!Number.isSafeInteger(count)||count>MAX_CLASSES)throw Error('snapshot-grid');return count;
}
function metadata(input){
 if(!object(input)||(input.id!=null&&(typeof input.id!=='string'||!input.id)))throw Error('snapshot-id');
 const {classes,classesGzip,classCount,classEncoding,maskA,maskB,surfaces,...rest}=input;
 const value=JSON.parse(boundedJsonStringify(rest,MAX_SNAPSHOT_METADATA_BYTES,'snapshot-metadata-budget'));
 value.manifest??=null;
 let complete=false;if(value.manifest){try{makeComputationManifest(value.manifest);complete=true;}catch{/* Incomplete historical facts are retained without upgrading them. */}}
 if(value.status!=='missing-input'&&!complete)value.status='missing-provenance';
 return value;
}
/** Preflight without cloning or JSON-stringifying any voxel array. */
export function savedComputationUsage(input){
 if(input==null)return {rawPayloadBytes:0,classCount:0,metadata:null};
 const value=metadata(input),classes=input.classes;
 let count=0;if(classes!=null){count=gridCount(value.grid);if(!(classes instanceof Uint8Array)||classes.length!==count||classes.some(n=>n>3))throw Error('snapshot-classes');}
 else if(value.grid)gridCount(value.grid);
 return {rawPayloadBytes:count+utf8ByteLength(JSON.stringify(value)),classCount:count,metadata:value};
}
async function streamBytes(stream,limit,code){
 const reader=stream.getReader(),chunks=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit)throw Error(code);chunks.push(value);}}
 catch(error){try{await reader.cancel();}catch{/* Keep admission failure. */}throw error;}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
function encodedBytes(text){
 if(typeof text!=='string'||text.length>4*Math.ceil(MAX_COMPRESSED_ASSET_BYTES/3)||text.length%4!==0)throw Error('snapshot-encoded-budget');
 const padding=text.endsWith('==')?2:text.endsWith('=')?1:0,payloadLength=text.length-padding;
 let last=0;
 // Constant-stack, linear admission, including canonical unused final sextet bits.
 for(let i=0;i<payloadLength;i++){
  const code=text.charCodeAt(i);
  if(code>=65&&code<=90)last=code-65;
  else if(code>=97&&code<=122)last=code-71;
  else if(code>=48&&code<=57)last=code+4;
  else if(code===43)last=62;
  else if(code===47)last=63;
  else throw Error('snapshot-encoded-budget');
 }
 const bytes=text.length/4*3-padding;
 if((padding===2&&(last&15)!==0)||(padding===1&&(last&3)!==0)||bytes>MAX_COMPRESSED_ASSET_BYTES)throw Error('snapshot-encoded-budget');
 return bytes;
}
export async function encodeSavedComputation(input,{maxRawBytes=MAX_WORKSPACE_RAW_PAYLOAD_BYTES}={}){
 const usage=savedComputationUsage(input);if(usage.rawPayloadBytes>maxRawBytes)throw Error('snapshot-budget');
 if(input==null)return {value:null,rawPayloadBytes:0,compressedBytes:0};
 const bytes=input.classes==null?null:await streamBytes(new Blob([input.classes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_COMPRESSED_ASSET_BYTES,'snapshot-compressed-budget');
 return {value:{...usage.metadata,classEncoding:'uint8-gzip-base64',classCount:usage.classCount,classesGzip:bytes?base64(bytes):null},rawPayloadBytes:usage.rawPayloadBytes,compressedBytes:bytes?.byteLength||0};
}
/** Validates declared grids/counts/budgets before allocating compressed or raw bytes. */
export function inspectEncodedSavedComputation(input){
 if(input==null)return {rawPayloadBytes:0,compressedBytes:0,classCount:0,metadata:null};
 const value=metadata(input);
 if(input.classEncoding!=='uint8-gzip-base64'||!Number.isSafeInteger(input.classCount)||input.classCount<0||input.classCount>MAX_CLASSES)throw Error('snapshot-class-encoding');
 const count=input.classCount;
 if(count&&gridCount(value.grid)!==count)throw Error('snapshot-classes');
 if(!count&&input.classesGzip!=null)throw Error('snapshot-classes');
 if(count&&typeof input.classesGzip!=='string')throw Error('snapshot-classes');
 return {metadata:value,classCount:count,rawPayloadBytes:count+utf8ByteLength(JSON.stringify(value)),compressedBytes:count?encodedBytes(input.classesGzip):0};
}
export async function decodeSavedComputation(input,{maxRawBytes=MAX_WORKSPACE_RAW_PAYLOAD_BYTES}={}){
 const usage=inspectEncodedSavedComputation(input);if(usage.rawPayloadBytes>maxRawBytes)throw Error('snapshot-budget');if(input==null)return null;
 let classes=null;if(usage.classCount){const compressed=Uint8Array.from(atob(input.classesGzip),c=>c.charCodeAt(0));classes=await streamBytes(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),usage.classCount,'snapshot-inflated-budget');if(classes.length!==usage.classCount||classes.some(n=>n>3))throw Error('snapshot-classes');}
 return {...usage.metadata,classes};
}

/** Evaluate recorded facts with S5's sole comparator. Inspection never samples a source or starts a worker. */
export function restoreComputation(saved,{currentManifest=null,decision='inspect-saved',geometry=true}={}){
 if(!['inspect-saved','recompute'].includes(decision))throw Error('invalid-restore-decision');
 let recorded=false,current=false;
 try{if(saved?.manifest){makeComputationManifest(saved.manifest);recorded=true;}}catch{/* Preserve incomplete historical facts. */}
 try{if(currentManifest){makeComputationManifest(currentManifest);current=true;}}catch{/* Current provenance is not yet available. */}
 const report=recorded&&current?compareComputationManifest(saved.manifest,currentManifest):null;
 const status=saved?.status==='missing-input'?'missing-input':!recorded?'missing-provenance':!current?'unverified':report.matches?'matched':'mismatch';
 let comparison=null,geometryError=null;
 const overlayUnavailableReason=saved?.grid&&saved.grid.space!=='MNI152NLin6Asym'?'saved-space-not-main':null;
 if(saved&&geometry&&decision==='inspect-saved'&&saved.classes!=null&&!overlayUnavailableReason){
  savedComputationUsage(saved);
  let classes=saved.classes,grid=saved.grid;
  // The renderer's existing geometry helpers use x-fastest; only reorder stored cells.
  if(grid.order==='z-fastest'){
   const [nx,ny,nz]=grid.shape;classes=new Uint8Array(saved.classes.length);
   for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)classes[x+nx*(y+ny*z)]=saved.classes[z+nz*(y+ny*x)];
   grid={...grid,order:'x-fastest'};
  }
  comparison={...saved,grid,classes,maskA:Uint8Array.from(classes,n=>n&1),maskB:Uint8Array.from(classes,n=>(n>>1)&1)};
  try{comparison=attachROISurfaces(comparison);}catch(error){geometryError=error.message;comparison=null;}
 }
 return {saved,status,canRecompute:current,shouldRecompute:decision==='recompute'&&current,differences:report?.differences??[],missingAssetIds:saved?.missingAssetIds??[],comparison,geometryError,overlayUnavailableReason};
}

/** A new run has a new identity even when operands and numerical results are identical. */
export function createComputationSnapshot(result){
 const snapshot={...result,id:`computation-${crypto.randomUUID()}`,producerId:result.id,manifest:makeComputationManifest(result.manifest),status:'matched'};
 savedComputationUsage(snapshot);return snapshot;
}

/** Retain the original computation forever; a later explicit run occupies its own slot. */
export function retainComputation(history,result){
 if(history.roiSnapshot?.id===result.id||history.recomputedSnapshot?.id===result.id)throw Error('computation-identity-reused');
 return history.roiSnapshot?{roiSnapshot:history.roiSnapshot,recomputedSnapshot:result}:{roiSnapshot:result,recomputedSnapshot:null};
}

import {readFile,mkdir,lstat,open} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const preparationFile='data-sources/spatial-qc/source-preparation.json';
const sourceFiles=new Set(['README.md','Diedrichsen_2009/atlas_description.json','Diedrichsen_2009/atl-Anatom.tsv','Diedrichsen_2009/atl-Anatom_space-MNI_dseg.nii','tpl-MNI152NLin6AsymC/tpl-MNI152NLin6AsymC_T1w.nii']);
const metadataFiles=['reference-set.json','source-preparation.json','candidate-inspection.json','download-manifest.json'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const validPath=value=>typeof value==='string'&&!value.includes('\\')&&!path.isAbsolute(value)&&value.split('/').every(part=>part&&part!=='.'&&part!=='..');
const inside=(root,file)=>{if(!validPath(file))throw Error(`Invalid cache path: ${file}`);const target=path.resolve(root,file);if(!target.startsWith(path.resolve(root)+path.sep))throw Error(`Cache path escapes root: ${file}`);return target;};
const hint='Run node scripts/prepare-spatial-qc-sources.mjs explicitly to prepare the pinned source cache; QC --check never downloads.';

function validateManifest(manifest){
 if(manifest?.schemaVersion!==1||manifest.repository!=='DiedrichsenLab/cerebellar_atlases'||!/^[a-f\d]{40}$/.test(manifest.commit||''))throw Error('Invalid pinned source preparation manifest');
 if(!validPath(manifest.cacheRoot)||!manifest.cacheRoot.startsWith('data-cache/spatial-qc/'))throw Error('Source cache must remain inside data-cache/spatial-qc/');
 if(!Array.isArray(manifest.files)||!manifest.files.length||new Set(manifest.files.map(file=>file.path)).size!==manifest.files.length)throw Error('Missing or duplicate pinned source files');
 for(const file of manifest.files){
  if(!validPath(file.path)||!sourceFiles.has(file.path))throw Error(`Unapproved source path: ${file.path}`);
  if(file.url!==`https://raw.githubusercontent.com/${manifest.repository}/${manifest.commit}/${file.path}`)throw Error(`Source URL must use the exact pinned official commit: ${file.path}`);
  if(!/^[a-f\d]{64}$/.test(file.sha256||'')||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>16*1024*1024)throw Error(`Invalid source digest/length: ${file.path}`);
  if(file.gitBlobSha&&!/^[a-f\d]{40}$/.test(file.gitBlobSha))throw Error(`Invalid source Git blob digest: ${file.path}`);
 }
}
async function safeParent(root,relative,{create=false}={}){
 let current=path.resolve(root);
 for(const part of relative.split('/').slice(0,-1)){
  current=path.join(current,part);
  let stat=await lstat(current).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(!stat&&create){await mkdir(current).catch(error=>{if(error.code!=='EEXIST')throw error;});stat=await lstat(current);}
  if(stat&&(stat.isSymbolicLink()||!stat.isDirectory()))throw Error(`Unsafe cache directory: ${current}`);
 }
}
function verifyBytes(bytes,file){
 if(bytes.byteLength!==file.bytes||sha(bytes)!==file.sha256)throw Error(`Source hash/length mismatch; existing evidence is preserved: ${file.path}`);
 if(file.gitBlobSha&&createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex')!==file.gitBlobSha)throw Error(`Source Git blob mismatch: ${file.path}`);
}
async function cached(root,manifest,file){
 const relative=`${manifest.cacheRoot}/${file.path}`;await safeParent(root,relative);
 const destination=inside(root,relative),stat=await lstat(destination).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(!stat)return null;
 if(stat.isSymbolicLink()||!stat.isFile())throw Error(`Unsafe cache file: ${relative}`);
 const bytes=await readFile(destination);verifyBytes(bytes,file);return destination;
}
async function fetchBytes(file,fetchImpl){
 const response=await fetchImpl(file.url,{redirect:'error',headers:{'accept-encoding':'identity'},signal:AbortSignal.timeout(30000)});
 if(response.redirected||(response.url&&response.url!==file.url))throw Error(`Source redirect refused: ${file.path}`);
 if(!response.ok)throw Error(`Pinned source download failed (${response.status}): ${file.path}`);
 const declared=response.headers?.get('content-length'),encoding=response.headers?.get('content-encoding');
 if(declared&&(!encoding||encoding==='identity')&&Number(declared)!==file.bytes)throw Error(`Source length mismatch: ${file.path}`);
 const reader=response.body?.getReader();if(!reader)throw Error(`Empty source response: ${file.path}`);
 const chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>file.bytes)throw Error(`Source response exceeds locked length: ${file.path}`);chunks.push(value);}}
 finally{await reader.cancel();reader.releaseLock();}
 const bytes=Buffer.concat(chunks,length);verifyBytes(bytes,file);return bytes;
}

/** Explicit preparation only. It never executes downloaded text and never replaces an existing file. */
export async function prepareSpatialQCSources({root=projectRoot,manifest,fetchImpl=globalThis.fetch,checkOnly=false}={}){
 root=path.resolve(root);manifest??=JSON.parse(await readFile(inside(root,preparationFile),'utf8'));validateManifest(manifest);
 const missing=[];for(const file of manifest.files)if(!await cached(root,manifest,file))missing.push(file);
 if(checkOnly&&missing.length)throw Error(`Missing pinned QC source cache (${missing.map(file=>file.path).join(', ')}). ${hint}`);
 let downloaded=0;
 for(const file of missing){
  const bytes=await fetchBytes(file,fetchImpl),relative=`${manifest.cacheRoot}/${file.path}`;
  await safeParent(root,relative,{create:true});const destination=inside(root,relative);
  let handle;
  try{handle=await open(destination,'wx');}catch(error){if(error.code!=='EEXIST')throw error;await cached(root,manifest,file);continue;}
  try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  downloaded++;
 }
 return {passed:true,cacheRoot:manifest.cacheRoot,checked:manifest.files.length,downloaded,reused:manifest.files.length-downloaded,status:'candidate-only-no-validation-upgrade'};
}

/** Check that source packaging can recreate every locked QC input without ignored research output. */
export function assertSpatialQCSourcePackageInputs({registry,preparation,allowedSourceFiles}){
 validateManifest(preparation);
 for(const reviewFile of registry.reviewFiles||[])if(!registry.lockedInputs.some(input=>input.path===reviewFile))throw Error(`Review file has no locked source-package input: ${reviewFile}`);
 for(const file of metadataFiles)if(!allowedSourceFiles.has(`data-sources/spatial-qc/${file}`))throw Error(`Source package omits QC metadata: ${file}`);
 for(const input of registry.lockedInputs){
  if(input.path.startsWith('data-cache/')){
   const source=preparation.files.find(file=>`${preparation.cacheRoot}/${file.path}`===input.path);
   if(!source||source.sha256!==input.sha256||source.url!==input.sourceUrl)throw Error(`Missing pinned preparation for cache input: ${input.path}`);
  }else if(input.path.startsWith('data-sources/')){
   if(!allowedSourceFiles.has(input.path))throw Error(`Source package omits locked QC input: ${input.path}`);
  }else if(!/^(public|docs|src|scripts)\//.test(input.path)||!validPath(input.path))throw Error(`Ignored or unpackaged QC input: ${input.path}`);
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await prepareSpatialQCSources({checkOnly:process.argv.includes('--check')}),null,2));}
 catch(error){console.error(JSON.stringify({passed:false,error:error.message}));process.exitCode=1;}
}

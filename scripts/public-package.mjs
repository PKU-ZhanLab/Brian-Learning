import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {pam50RemoteDescriptor} from '../src/lib/pam50.js';

export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const slash=value=>value.split(path.sep).join('/');
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const writeJSON=(file,data)=>fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
async function files(root){const result=[];for(const entry of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isDirectory())result.push(...await files(file));else result.push(file);}return result;}
function inside(root,file){const absolute=path.resolve(file),relative=path.relative(path.resolve(root),absolute);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error(`Unsafe output path: ${absolute}`);return absolute;}
async function removeFile(root,file){const absolute=inside(root,file);const stat=await fs.stat(absolute).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));if(stat?.isDirectory())throw Error('Only individual generated files may be removed');if(stat)await fs.unlink(absolute);}

export async function preparePublicData(source,target){
  source=path.resolve(source);target=path.resolve(target);
  if(source===target)throw Error('Public packaging must preserve its source tree');
  await fs.mkdir(target,{recursive:true});await fs.cp(source,target,{recursive:true});
  const manifest=await json(path.join(target,'manifest.json'));
  const anatomy=await json(path.join(target,'anatomy/manifest.json'));
  const excluded=new Set(['aal.bin','aal3.bin','ba.bin','dk.bin','cortex-left.json','cortex-right.json','legacy-manifest-v1.json']);
  let remoteCount=0;
  for(const [id,entry] of Object.entries(anatomy.structures)){
    if(entry.dataset!=='PAM50'||(!entry.geometry&&!entry.remoteGeometry))continue;
    if(entry.geometry)excluded.add(entry.geometry.replace(/^\/data\//,''));
    entry.remoteGeometry=pam50RemoteDescriptor(id,entry);entry.geometry=null;
    for(const key of ['sha256','vertices','triangles','originalTriangles'])delete entry[key];
    entry.meshMethod='Browser-generated source-resolution voxel-cell boundary; no smoothing';
    entry.distribution='on-demand-official-source';remoteCount++;
  }
  for(const file of await files(target))if(/^anatomy\/pam-[^/]+\.json$/.test(slash(path.relative(target,file))))excluded.add(slash(path.relative(target,file)));
  for(const id of ['aal','aal3','ba-legacy']){
    const entry=manifest.atlases[id];if(!entry)continue;
    entry.available=false;entry.canOverlayOnTarget=false;entry.data=null;delete entry.metadata;delete entry.file;
    entry.distribution='metadata-only';entry.publicationNote={zh:'公开版仅保留来源与标签目录，未分发旧版二进制。',en:'The public edition retains source and terminology metadata; legacy binary files are not distributed.'};
  }
  manifest.edition='public-teaching';manifest.version='3.0.0';
  manifest.dataLicenseNotice='/data/licenses/NOTICE-DATA.md';
  anatomy.edition='public-teaching';anatomy.datasets.PAM50.distribution='on-demand-official-source';
  anatomy.datasets.PAM50.bundledGeometryCount=0;anatomy.datasets.PAM50.remoteGeometryCount=remoteCount;
  for(const file of excluded)await removeFile(target,path.join(target,file));
  await writeJSON(path.join(target,'manifest.json'),manifest);await writeJSON(path.join(target,'anatomy/manifest.json'),anatomy);
  // Preserve fetched license evidence as inert text, so third-party HTML cannot execute on this origin.
  const htmlFiles=(await files(target)).filter(file=>file.endsWith('.html'));
  for(const file of htmlFiles){const dest=inside(target,file+'.txt');await fs.rename(file,dest);}
  for(const file of await files(target))if(/\.(md|json)$/.test(file)){
    const originalContent=await fs.readFile(file,'utf8');
    let content=originalContent,changed=false;
    const renameReference=value=>{
      if(typeof value==='string'&&!/^https?:\/\//.test(value))for(const original of htmlFiles){const name=path.basename(original);if(value===name||value.endsWith('/'+name)){changed=true;return value+'.txt';}}
      if(Array.isArray(value))return value.map(renameReference);
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,renameReference(item)]));
      return value;
    };
    if(file.endsWith('.json')){const updated=renameReference(JSON.parse(content));if(changed)content=JSON.stringify(updated,null,2)+'\n';}
    else for(const original of htmlFiles){const name=path.basename(original);content=content.replaceAll(`](${name})`,`](${name}.txt)`).replaceAll('`'+name+'`','`'+name+'.txt`');}
    if(content!==originalContent)await fs.writeFile(file,content);
  }
  const report={edition:'public-teaching',generatedAt:new Date().toISOString(),excludedBundledFiles:[...excluded].sort(),bundledPAM50Geometry:0,onDemandPAM50Structures:remoteCount,metadataOnlyAtlases:['aal','aal3','ba-legacy'],licenseNotice:'licenses/NOTICE-DATA.md',licenseEvidenceFormat:'Original fetched HTML bytes retained as inert .html.txt files',sourceRepository:'https://github.com/PKU-ZhanLab/Brian-Learning'};
  await writeJSON(path.join(target,'public-edition.json'),report);
  const hashes={};for(const file of await files(target)){const name=slash(path.relative(target,file));if(name==='asset-checksums.json')continue;hashes[name]=sha(await fs.readFile(file));}
  await writeJSON(path.join(target,'asset-checksums.json'),{generated:new Date().toISOString(),algorithm:'SHA-256',files:hashes});
  for(const forbidden of excluded)if(await fs.stat(path.join(target,forbidden)).catch(()=>null))throw Error('Excluded data remained in the public package: '+forbidden);
  return {...report,files:Object.keys(hashes).length};
}

const sourceInputs={
  raw:['MNI152_T1_2mm_brain.nii.gz','HarvardOxford-sub.nii.gz','HarvardOxford-Subcortical.xml','HarvardOxford-fs-labels.txt','HarvardOxford-relabel.sh','JHU.nii.gz','JHU-labels.xml','Cerebellum.nii.gz','Cerebellum.xml','download-manifest.json'],
  ba:['Talairach-labels-2mm.nii.gz','Talairach.xml','Juelich-maxprob-thr25-2mm.nii.gz','Juelich-prob-2mm.nii.gz','Juelich.xml','source-manifest.json','talairach-ba-label-mapping.json'],
  space:['sources.json','TemplateFlow-commit.txt','MNI152NLin2009aAsym-template_description.json','LICENSE-MNI.txt'],
  literature:['verification.json','candidates.json','README.md'],
  'literature-upgrade':['curation.mjs','discovery.mjs','candidates.json','figure-audit.json','metadata.json'],
};

export async function prepareSourceRelease(target){
  target=path.resolve(target);inside(projectRoot,target);await fs.mkdir(target,{recursive:true});
  for(const file of await files(target))if(/(?:^|\/)__pycache__\/|\.pyc$/.test(slash(path.relative(target,file))))await removeFile(target,file);
  const copy=async(relative)=>{const source=path.join(projectRoot,relative),destination=inside(target,path.join(target,relative));await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(source,destination);};
  for(const folder of ['src','scripts','docs'])for(const file of await files(path.join(projectRoot,folder))){const relative=slash(path.relative(projectRoot,file));if(relative==='scripts/integrate-workspace.mjs'||relative==='src/i18n/ui-strings.json'||/(?:^|\/)__pycache__\/|\.pyc$/.test(relative))continue;await copy(relative);}
  for(const name of ['package.json','package-lock.json','vite.config.js','index.html','README.md','README.en.md','LICENSE','LICENSE-MIT','.gitattributes','启动教学模型.cmd'])await copy(name);
  for(const file of await files(path.join(projectRoot,'public'))){const relative=slash(path.relative(path.join(projectRoot,'public'),file));if(relative.startsWith('data/'))continue;await copy('public/'+relative);}
  const report=await preparePublicData(path.join(projectRoot,'public/data'),path.join(target,'public/data'));
  for(const [folder,names] of Object.entries(sourceInputs))for(const name of names)await copy(`data-sources/${folder}/${name}`);
  const dk=await json(path.join(projectRoot,'data-sources/dk/sources.json'));
  for(const name of ['sources.json','CBIG-commit.txt',...dk.files.map(f=>f.file)])await copy('data-sources/dk/'+name);
  const metadataFile=path.join(target,'data-sources/literature-upgrade/metadata.json'),metadata=await json(metadataFile);
  for(const entry of metadata.records){delete entry.abstract;delete entry.fulltext;}
  metadata.publicationPolicy='Full abstracts, raw API bodies and full article XML are omitted. Source URLs, dates and hashes remain; fetch scripts can restore local verification caches.';
  await writeJSON(metadataFile,metadata);
  await fs.writeFile(path.join(target,'.gitignore'),'node_modules/\ndist/\ndist-public/\n.vite/\noutput/\n.deployment/\nsnapshots/\ndata-cache/\n__pycache__/\n*.pyc\n*.log\ndata-sources/literature/raw/\ndata-sources/literature-upgrade/raw/\n');
  await writeJSON(path.join(target,'PUBLIC_RELEASE.json'),{...report,sourceInputs:'Licensed originals and transformation scripts included; PAM50 precomputed files and full article caches excluded.'});
  return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const target=process.argv[2]||path.join(projectRoot,'.deployment/source');
  console.log(JSON.stringify(await prepareSourceRelease(target),null,2));
}

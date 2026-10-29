import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import registry from '../data-sources/results/publication-registry.json' with {type:'json'};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const readJSON=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const slash=p=>p.split(path.sep).join('/');
const validCommit=c=>/^[a-f0-9]{40}$/.test(c||'');
const safe=(root,p)=>{if(typeof p!=='string'||p.includes('\\')||/^[a-z]:/i.test(p)||p.startsWith('/')||p.split('/').some(x=>!x||x==='..'||x==='.'))throw Error('Unsafe manifest path');return path.join(root,p);};
async function tree(root,{source=false}={}){const entries=Object.create(null);async function visit(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(source&&e.isDirectory()&&['node_modules','dist','dist-public','output','.git','.vite','test-results','playwright-report','browserprofiles','.superpowers'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink in release: '+p);if(e.isDirectory())await visit(p);else entries[slash(path.relative(root,p))]=hash(await fs.readFile(p));}}await visit(root);return Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a<b?-1:a>b?1:0));}
const treeHash=files=>hash(JSON.stringify(files));
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();

/** Called by the builder, before compilation; a parent repository is never an origin. */
export async function recordBuildSource({sourceRoot}){
 sourceRoot=path.resolve(sourceRoot);let repo;
 try{repo=path.resolve(git(sourceRoot,'rev-parse','--show-toplevel'));}catch{}
 if(repo!==sourceRoot){
  const origin=await readJSON(path.join(sourceRoot,'SOURCE_ORIGIN.json')).catch(()=>null);
  if(!origin||!validCommit(origin.originCommit)||origin.schema!=='neuroatlas-packaged-source-v1')throw Error('Source is not a repository root and has no explicit packaged origin');
  const actual=await tree(sourceRoot,{source:true});for(const name of Object.keys(actual))if(name==='SOURCE_ORIGIN.json'||/^(node_modules|dist|dist-public|output|\.git)\//.test(name))delete actual[name];
  if(treeHash(actual)!==origin.packagedTreeSha256)throw Error('Packaged source is stale or modified');
  return {schema:'neuroatlas-build-source-v1',originCommit:origin.originCommit,sourceKind:'transformed-source-package',sourceTreeSha256:treeHash(actual),version:(await readJSON(path.join(sourceRoot,'package.json'))).version,clean:false,exactCommit:false};
 }
 const originCommit=git(sourceRoot,'rev-parse','HEAD'),status=git(sourceRoot,'status','--porcelain','--untracked-files=all');
 const names=execFileSync('git',['-C',sourceRoot,'ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const files={};for(const name of [...new Set(names)].sort()){try{files[name]=hash(await fs.readFile(path.join(sourceRoot,name)));}catch(e){if(e.code!=='ENOENT')throw e;files[name]='missing';}}
 return {schema:'neuroatlas-build-source-v1',originCommit,sourceKind:'git-worktree',sourceTreeSha256:treeHash(files),version:(await readJSON(path.join(sourceRoot,'package.json'))).version,clean:!status,exactCommit:!status};
}

export async function writeBuildOutput({buildDir,source}){
 const receipt={schema:'neuroatlas-build-output-v1',version:source.version,originCommit:source.originCommit,sourceTreeSha256:source.sourceTreeSha256,files:await tree(buildDir)};
 await fs.writeFile(path.join(buildDir,'build-files.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}

async function validateBuild(buildDir,version,sourceCommit,sourceRoot){
 if(!validCommit(sourceCommit))throw Error('Invalid source commit');
 const source=await readJSON(path.join(buildDir,'build-source.json'));
 if(!['git-worktree','transformed-source-package','declared-origin'].includes(source.sourceKind)||source.schema!=='neuroatlas-build-source-v1'||source.originCommit!==sourceCommit||source.version!==version||!/^[a-f0-9]{64}$/.test(source.sourceTreeSha256||''))throw Error('Invalid or mismatched build source provenance');
 if(source.exactCommit&&(!source.clean||source.sourceKind!=='git-worktree'))throw Error('Unsupported exact clean commit claim');
 if(sourceRoot){const actualSource=await recordBuildSource({sourceRoot});if(JSON.stringify(actualSource)!==JSON.stringify(source))throw Error('Source tree is stale, dirty or different from the recorded build');}
 if(source.exactCommit&&!sourceRoot)throw Error('Exact commit verification requires the source repository root');
 const output=await readJSON(path.join(buildDir,'build-files.json'));
 if(output.schema!=='neuroatlas-build-output-v1'||output.version!==version||output.originCommit!==sourceCommit||output.sourceTreeSha256!==source.sourceTreeSha256||!output.files||!Object.keys(output.files).length)throw Error('Missing or mismatched builder output receipt');
 const built=await tree(buildDir);delete built['build-files.json'];
 if(JSON.stringify(built)!==JSON.stringify(output.files))throw Error('Build output is missing, extra or modified since the builder receipt');
 for(const file of ['index.html','data/manifest.json','data/anatomy/manifest.json','data/spatial-qc/assessment.json','data/public-edition.json','data/asset-checksums.json','results/manifest.json'])await fs.access(safe(buildDir,file));
 for(const name of ['data/manifest.json','data/public-edition.json'])if((await readJSON(safe(buildDir,name))).version!==version)throw Error('Version mismatch: '+name);
 const checks=await readJSON(safe(buildDir,'data/asset-checksums.json'));
 if(!checks.files||!Object.keys(checks.files).length)throw Error('Empty asset manifest');
 const dataFiles=await tree(path.join(buildDir,'data'));
 const actual=Object.keys(dataFiles).filter(n=>n!=='asset-checksums.json').sort();
 if(JSON.stringify(actual)!==JSON.stringify(Object.keys(checks.files).sort()))throw Error('Data manifest file list differs');
 for(const [file,digest] of Object.entries(checks.files))if(dataFiles[file]!==digest)throw Error('Data hash mismatch: '+file);
 const main=await readJSON(safe(buildDir,'data/manifest.json')),anatomy=await readJSON(safe(buildDir,'data/anatomy/manifest.json'));
 const runtimeKeys=new Set(['file','data','metadata','geometry','probabilityData','anatomy','aalSourceManifest','aalRegistrationReview','dataLicenseNotice','regionRelations','spatialQC']);
 async function declared(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(runtimeKeys.has(key)&&typeof item==='string'&&!/^https?:/.test(item)&&/\.(?:json|bin|nii(?:\.gz)?|md|txt)$/.test(item)){const file=item.replace(/^\/data\//,'');if(!dataFiles[file])throw Error('Missing declared data file: '+file);if((key==='data'||key==='file')&&value.sha256&&dataFiles[file]!==value.sha256)throw Error('Declared data digest mismatch: '+file);}else if(item&&typeof item==='object')await declared(item);}}
 await declared(main);await declared(anatomy);
 const pages=await readJSON(safe(buildDir,'results/manifest.json'));
 const required=registry.versions.flatMap(v=>v.records.flatMap(r=>['zh','en'].map(language=>({resultId:r.resultId,dataVersion:v.dataVersion,language,contentHash:r.contentHash,snapshotSha256:v.sha256}))));
 if(pages.schema!=='public-result-pages-v1'||pages.records?.length!==required.length||pages.files?.length!==2)throw Error('Incomplete result page manifest');
 for(const expected of required){const records=pages.records.filter(r=>r.resultId===expected.resultId&&r.dataVersion===expected.dataVersion&&r.language===expected.language);if(records.length!==1||Object.entries(expected).some(([k,v])=>records[0][k]!==v)||records[0]?.file!==`results/${expected.resultId}/${expected.dataVersion}/index${expected.language==='en'?'.en':''}.html`)throw Error('Missing or stale published result identity');}
 for(const entry of [...pages.records,...pages.files])if(hash(await fs.readFile(safe(buildDir,entry.file)))!==entry.sha256)throw Error('Result page hash mismatch: '+entry.file);
 for(const file of ['results/index.html','results/index.en.html'])if(!pages.files.some(e=>e.file===file))throw Error('Missing result directory');
 return source;
}
export async function createReleaseManifest({buildDir,version,sourceCommit,sourceRoot}){
 const source=await validateBuild(buildDir,version,sourceCommit,sourceRoot);
 return {schema:'neuroatlas-release-v1',version,sourceCommit,source,files:await tree(buildDir)};
}
export async function verifyRelease({buildDir,manifest,sourceCommit,sourceRoot}){
 const failures=[],missing=[],extra=[],changed=[];let actual={};
 try{if(manifest.schema!=='neuroatlas-release-v1'||!validCommit(manifest.sourceCommit)||manifest.sourceCommit!==sourceCommit||!manifest.files||!Object.keys(manifest.files).length)throw Error('Invalid expected manifest/source identity');for(const name of Object.keys(manifest.files))safe(buildDir,name);const source=await validateBuild(buildDir,manifest.version,sourceCommit,sourceRoot);if(JSON.stringify(source)!==JSON.stringify(manifest.source))throw Error('Build source differs from immutable expected provenance');}catch(e){failures.push(e.message);}
 try{actual=await tree(buildDir);}catch(e){failures.push(e.message);}
 for(const [name,digest] of Object.entries(manifest.files||{})){if(!Object.hasOwn(actual,name))missing.push(name);else if(actual[name]!==digest)changed.push(name);}
 for(const name of Object.keys(actual))if(!Object.hasOwn(manifest.files||{},name))extra.push(name);
 if(missing.length||extra.length||changed.length)failures.push('Release files differ from immutable expectations');
 return {pass:!failures.length,status:failures.length?'fail':'pass',version:manifest.version,sourceCommit,source:manifest.source,missing,extra,changed,failures,scope:'artifact integrity and recorded source provenance; runtime/scientific acceptance is separate'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,buildDir,manifestPath,sourceCommit,versionOrSource,sourceRootArg]=process.argv.slice(2);
 if(!['--create-manifest','--verify'].includes(mode)||!buildDir||!manifestPath||!sourceCommit)throw Error('Usage: node scripts/verify-release.mjs --create-manifest BUILD EXPECTED_JSON COMMIT VERSION SOURCE_ROOT | --verify BUILD EXPECTED_JSON COMMIT SOURCE_ROOT');
 if(mode==='--create-manifest'){const expected=await createReleaseManifest({buildDir,version:versionOrSource,sourceCommit,sourceRoot:sourceRootArg});await fs.writeFile(manifestPath,JSON.stringify(expected,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'created',files:Object.keys(expected.files).length,source:expected.source}));}
 else{const result=await verifyRelease({buildDir,manifest:await readJSON(manifestPath),sourceCommit,sourceRoot:versionOrSource});console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;}
}

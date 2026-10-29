/** Reproducible offline audit; this module never calls fetch or follows URLs. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {auditTranscription} from '../src/lib/source-artifact.js';
const resultsDirectory=new URL('../data-sources/results/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function auditFromDisk({artifactDirectory=new URL('source-artifacts/',resultsDirectory),bundleFile=new URL('curated-results.json',resultsDirectory)}={}){
  const integrityErrors=[],unavailableArtifacts=[],artifacts=[];
  let bundle;
  try{bundle=JSON.parse(await readFile(bundleFile,'utf8'));}catch(error){return {valid:false,integrityErrors:[],semanticReviewRequired:[],unavailableArtifacts:[`bundle: ${error.code||error.message}`],coverage:{coordinates:[],fields:[]}};}
  let index;
  try{index=JSON.parse(await readFile(new URL('index.json',artifactDirectory),'utf8'));}catch(error){unavailableArtifacts.push(`artifact-index: ${error.code||error.message}`);}
  if(index){
    if(index.schema!=='source-artifact-index-v1'||!Array.isArray(index.artifacts))integrityErrors.push('invalid source artifact index');
    else for(const entry of index.artifacts){
      if(path.basename(entry.file||'')!==entry.file||!/^[-a-z0-9]+-v\d+\.json$/.test(entry.file||'')){integrityErrors.push(`${entry.id}: unsafe or unversioned source artifact path`);continue;}
      try{
        const bytes=await readFile(new URL(entry.file,artifactDirectory));
        if(hash(bytes)!==entry.sha256)integrityErrors.push(`${entry.id}: artifact file SHA-256 mismatch`);
        const artifact=JSON.parse(bytes);if(artifact.id!==entry.id||artifact.referenceId!==entry.referenceId)integrityErrors.push(`${entry.id}: artifact index identity mismatch`);
        artifacts.push(artifact);
      }catch(error){unavailableArtifacts.push(`${entry.id}: ${error.code||error.message}`);}
    }
  }
  const report=auditTranscription(bundle,artifacts);
  report.integrityErrors.push(...integrityErrors);report.unavailableArtifacts.push(...unavailableArtifacts);
  return {...report,valid:!report.integrityErrors.length&&!report.semanticReviewRequired.length&&!report.unavailableArtifacts.length,mode:'offline',artifactFiles:artifacts.length};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2),outputIndex=args.indexOf('--output');
  if(!args.includes('--offline')||args.some((arg,i)=>!['--offline','--output'].includes(arg)&&i!==outputIndex+1)||outputIndex>=0&&!args[outputIndex+1])throw Error('Usage: node scripts/evidence-audit.mjs --offline [--output <new-path>]');
  const report=await auditFromDisk();
  if(outputIndex>=0){const output=path.resolve(args[outputIndex+1]);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
  console.log(JSON.stringify({valid:report.valid,mode:report.mode,artifactFiles:report.artifactFiles,coordinates:report.coverage.coordinates.length,fields:report.coverage.fields.length,integrityErrors:report.integrityErrors,semanticReviewRequired:report.semanticReviewRequired,unavailableArtifacts:report.unavailableArtifacts,humanReview:report.humanReview},null,2));
  if(!report.valid)process.exitCode=1;
}

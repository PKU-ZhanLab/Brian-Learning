import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadLockedInputs,inspectSegmentationCandidate} from './spatial-qc.mjs';

export async function checkSegmentationSources(candidateFile){
 const {registry,inputs}=await loadLockedInputs();
 const candidates=candidateFile?[JSON.parse(await readFile(candidateFile,'utf8'))]:registry.segmentationCandidates;
 const results=await Promise.all(candidates.map(candidate=>inspectSegmentationCandidate(candidate,inputs)));
 // Known pending candidates are expected failures, never implicit replacements.
 const passed=candidateFile?results.every(result=>result.eligible):results.every(result=>result.eligible===registry.segmentationCandidates.find(candidate=>candidate.id===result.candidateId).expectedEligible);
 return {passed,status:results.every(result=>result.eligible)?'eligible':'partial',results};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const argument=process.argv.indexOf('--candidate');
  if(argument>=0&&!process.argv[argument+1])throw Error('--candidate requires a JSON file');
  const result=await checkSegmentationSources(argument<0?null:process.argv[argument+1]);
  console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
 }catch(error){console.error(JSON.stringify({passed:false,error:error.message}));process.exitCode=1;}
}

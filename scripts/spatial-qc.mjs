import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateSpatialQC,validateSegmentationSource} from '../src/lib/spatial-qc.js';
import {parseNifti,parseLabelTable} from '../src/lib/nifti.js';
import {prepareSpatialQCSources} from './prepare-spatial-qc-sources.mjs';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const registryPath='data-sources/spatial-qc/reference-set.json';
export const outputPath=path.join(root,'public/data/spatial-qc/assessment.json');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=file=>{const target=path.resolve(root,file);if(!target.startsWith(root+path.sep))throw Error(`QC input escapes checkout: ${file}`);return target;};
const json=async file=>JSON.parse(await readFile(local(file),'utf8'));

export async function loadLockedInputs(){
 await prepareSpatialQCSources({checkOnly:true});
 const registryBytes=await readFile(local(registryPath)),registry=JSON.parse(registryBytes);
 const inputs=[{id:'reference-set',path:registryPath,sha256:digest(registryBytes),version:registry.protocolVersion,kind:'protocol'}];
 for(const item of registry.lockedInputs){
  const bytes=await readFile(local(item.path)),actual=digest(bytes);
  if(actual!==item.sha256)throw Error(`${item.id}: locked input hash mismatch (${item.path})`);
  inputs.push({...item,sha256:actual,expectedSha256:item.sha256,bytes:bytes.byteLength});
 }
 for(const file of ['src/lib/spatial-qc.js','scripts/spatial-qc.mjs','scripts/validate-segmentation-source.mjs','scripts/prepare-spatial-qc-sources.mjs'])inputs.push({id:file,path:file,kind:'software',version:registry.algorithmVersion,sha256:digest(await readFile(local(file)))});
 const assets=inputs.filter(item=>item.kind==='asset'),transforms=inputs.filter(item=>item.kind==='transform');
 const lockedEvidence=hash=>inputs.some(input=>input.sha256===hash&&input.expectedSha256===hash);
 for(const reference of registry.references)if(!lockedEvidence(reference.sha256))throw Error(`${reference.id}: independent reference bytes are not locked`);
 for(const measurement of registry.measurements)if(!lockedEvidence(measurement.evidenceSha256))throw Error(`${measurement.regionId}: measurement evidence bytes are not locked`);
 return {registry,inputs,assets,transforms};
}

export async function inspectSegmentationCandidate(candidate,inputs){
 const result={candidateId:candidate.id,assetSha256:candidate.asset?.sha256??null,coverageStructures:candidate.coverageStructures,...validateSegmentationSource(candidate,inputs)};
 const dictionary=inputs.find(input=>input.id===candidate.originalLabelDictionary?.assetId),asset=inputs.find(input=>input.id===candidate.asset?.id);
 if(dictionary&&asset){
  const rawDictionary=await readFile(local(dictionary.path),'utf8');
  const sourceRows=dictionary.path.endsWith('.tsv')?rawDictionary.trim().split(/\r?\n/).slice(1).map(line=>{const [id,name]=line.split('\t');return {id:Number(id),name};}):null;
  const labels=sourceRows?parseLabelTable(JSON.stringify(sourceRows),'json'):parseLabelTable(rawDictionary,dictionary.path.endsWith('.json')?'json':'csv');
  const volume=await parseNifti(await readFile(local(asset.path)),{kind:'label'});
  const actual=[...new Set(volume.data)].filter(id=>id>0).sort((a,b)=>a-b),expected=labels.map(row=>row.id).sort((a,b)=>a-b);
  if(JSON.stringify(actual)!==JSON.stringify(expected)||JSON.stringify(actual)!==JSON.stringify(candidate.originalLabelDictionary.labelIds)){result.eligible=false;result.issues.push('Actual original label IDs disagree with the candidate dictionary.');}
  const templateAsset=inputs.find(input=>input.id===candidate.templateAssetId);
  const template=templateAsset&&await parseNifti(await readFile(local(templateAsset.path)));
  const sameGrid=template?JSON.stringify(template.shape)===JSON.stringify(volume.shape)&&JSON.stringify(template.affine)===JSON.stringify(volume.affine):null;
  result.automatedInspection={positiveLabels:actual.length,vermisLabels:labels.filter(label=>/^Vermis_/.test(label.name)).map(label=>({id:label.id,name:label.name})),shape:volume.shape,affine:volume.affine,sameGrid,templateAssetId:templateAsset?.id??null,parserSpace:volume.space,sourceSpaceDeclaration:candidate.sourceSpace?.id??null,anatomicalAccuracyMeasured:false};
 }
 return result;
}

export async function buildAssessment(){
 const {registry,inputs,assets,transforms}=await loadLockedInputs();
 const reviews=await Promise.all(registry.reviewFiles.map(json));
 const assessment=evaluateSpatialQC({assets:assets.filter(asset=>registry.assessedAssetIds.includes(asset.id)),transforms,referenceSet:registry,measurements:registry.measurements,reviews});
 const manifest=await json('public/data/manifest.json');
 const labelChecks=[];
 for(const id of registry.assessedAssetIds){
  const asset=assets.find(item=>item.id===id),entry=manifest.atlases[id];
  if(!asset||!entry||entry.sha256!==asset.sha256||entry.atlasVersion!==asset.version||entry.spaceId!==asset.spaceId)throw Error(`${id}: manifest identity differs from locked asset`);
  const bytes=await readFile(local(asset.path)),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),labels=new Set();
  const stride=entry.dtype==='uint16'?2:entry.dtype==='uint8'?1:0;
  if(!stride||bytes.byteLength!==entry.shape.reduce((n,d)=>n*d,1)*stride)throw Error(`${id}: unexpected discrete-label grid`);
  for(let offset=0;offset<bytes.byteLength;offset+=stride){const label=stride===2?view.getUint16(offset,true):view.getUint8(offset);if(label)labels.add(label);}
  const expected=entry.labels.filter(label=>label.id>0).map(label=>label.id).sort((a,b)=>a-b),actual=[...labels].sort((a,b)=>a-b);
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error(`${id}: original label IDs disagree with actual volume`);
  labelChecks.push({id,kind:'discrete-label-preservation',passed:true,positiveLabels:actual.length,containsLabel134:labels.has(134),gridSpacingMm:entry.voxelSizeMm,fieldResolutionMm:entry.fieldResolutionMm});
 }
 const candidateChecks=[];
 for(const candidate of registry.segmentationCandidates){
  candidateChecks.push(await inspectSegmentationCandidate(candidate,inputs));
 }
 return {schemaVersion:1,protocolVersion:registry.protocolVersion,algorithmVersion:registry.algorithmVersion,...assessment,automatedChecks:assessment.automatedChecks.concat(labelChecks),inputs,thresholds:registry.thresholds,independentReferences:registry.references,coverageRegions:registry.coverageRegions,historicalReviewScope:'Three central orthogonal planes; AI review only.',segmentationSources:candidateChecks,excludedSources:registry.excludedSources};
}

export async function runSpatialQC({check=false}={}){
 const assessment=await buildAssessment(),serialized=JSON.stringify(assessment,null,2)+'\n';
 if(check){
  if(await readFile(outputPath,'utf8')!==serialized)throw Error('Spatial QC assessment is stale. Regenerate explicitly with node scripts/spatial-qc.mjs.');
 }else{await mkdir(path.dirname(outputPath),{recursive:true});await writeFile(outputPath,serialized);}
 return {passed:true,status:assessment.status,humanValidated:assessment.humanValidated,independentCoverage:assessment.independentCoverage,missingCoverage:assessment.missingCoverage,checkedInputs:assessment.inputs.length,segmentationSources:assessment.segmentationSources.map(({candidateId,eligible,missing,issues})=>({candidateId,eligible,missing,issues}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await runSpatialQC({check:process.argv.includes('--check')}),null,2));}catch(error){console.error(JSON.stringify({passed:false,error:error.message}));process.exitCode=1;}
}

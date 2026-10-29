import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {SPATIAL_QC_RESOURCE,ensureResource,getResourceState,retry} from './atlas-resource.js';
import { evaluateSpatialQC, validateSegmentationSource, representationForAsset, spatialQCForRegion } from './spatial-qc.js';

const hash='a'.repeat(64), other='b'.repeat(64);
const assets=[{id:'atlas',version:'v1',sha256:hash,expectedSha256:hash,spaceId:'test-space'}];
const reference={id:'external',version:'v1',sha256:other,sourceUrl:'https://example.org/source',license:'CC BY 4.0',spaceId:'test-space',annotationMethod:'independent manual delineation',independent:true,derivedFromAssetIds:[]};
const referenceSet={requiredCoverage:['aal3-label-134'],references:[reference],thresholds:[{regionId:'aal3-label-134',referenceId:'external',landmarkDistanceMm:2,boundaryDistanceMm:3,basis:'Predeclared test protocol',protocolVersion:'fixture-v1'}]};
const measurement={regionId:'aal3-label-134',referenceId:'external',assetId:'atlas',assetSha256:hash,referenceSha256:other,transformSha256s:[],landmarkDistanceMm:1,boundaryDistanceMm:2,overlap:null,evidenceSha256:hash};
// Synthetic test records only. They are never copied to the production registry.
const review={reviewer:{id:'fixture-reviewer',name:'Synthetic test reviewer',kind:'human'},date:'2026-10-29',scope:['aal3-label-134'],assetSha256:hash,referenceId:'external',evidenceSha256:hash,verdict:'pass'};

test('historical three-plane AI review never becomes whole-volume or human validation',async()=>{
 const historical=JSON.parse(await readFile(new URL('../../public/data/aal-v3/root-review.json',import.meta.url)));
 const qc=evaluateSpatialQC({assets,transforms:[],referenceSet:{requiredCoverage:['whole-volume-axial','whole-volume-coronal','whole-volume-sagittal','aal3-label-134'],references:[],thresholds:[]},measurements:[],reviews:[historical]});
 assert.equal(qc.status,'partial');assert.equal(qc.humanValidated,false);
 assert(qc.missingCoverage.includes('aal3-label-134'));assert(qc.missingCoverage.includes('whole-volume-axial'));
 assert(qc.measurements.every(row=>row.landmarkDistanceMm===null&&row.boundaryDistanceMm===null));
});
test('hashes, high surface coverage, Jacobian and round trips cannot certify anatomy',()=>{
 const qc=evaluateSpatialQC({assets,transforms:[],referenceSet,measurements:[{surfaceCoverage:.999,jacobianMin:.9,roundTripMm:.01}],reviews:[{...review,reviewer:{id:'ai',name:'AI agent',kind:'ai'}}]});
 assert.equal(qc.status,'partial');assert.equal(qc.humanValidated,false);assert.deepEqual(qc.independentCoverage,[]);
});
test('self-derived references and unbound measurements cannot count as independent',()=>{
 for(const change of [{referenceSet:{...referenceSet,references:[{...reference,derivedFromAssetIds:['atlas']}]}},{measurements:[{...measurement,assetSha256:other}]},{measurements:[{...measurement,referenceSha256:hash}]},{measurements:[{...measurement,transformSha256s:[hash]}]}]){
  const qc=evaluateSpatialQC({assets,transforms:[],referenceSet,measurements:[measurement],reviews:[review],...change});
  assert.equal(qc.status,'partial');assert.deepEqual(qc.independentCoverage,[]);
 }
});
test('reviewed requires predeclared metric limits plus identity/date/actual human scope',()=>{
 const input={assets,transforms:[],referenceSet,measurements:[measurement],reviews:[review]};
 const qc=evaluateSpatialQC(input);assert.equal(qc.status,'reviewed');assert.equal(qc.humanValidated,true);
 for(const reviews of [[],[{...review,scope:['unrelated']}],[{...review,date:null}],[{...review,reviewer:{id:'ai',name:'AI agent',kind:'ai'}}]])assert.equal(evaluateSpatialQC({...input,reviews}).status,'partial');
 for(const measurements of [[{...measurement,landmarkDistanceMm:5}],[{...measurement,boundaryDistanceMm:null}]])assert.equal(evaluateSpatialQC({...input,measurements}).status,'partial');
 assert.equal(evaluateSpatialQC({...input,referenceSet:{...referenceSet,thresholds:[]}}).status,'partial');
 assert.equal(evaluateSpatialQC({...input,assets:[{...assets[0],expectedSha256:other}]}).status,'partial');
});
test('geometric brainstem divisions and vermis midline bands are ineligible',()=>{
 for(const id of ['midbrain','pons','medulla','cerebellar-vermis']){
  const candidate={id,coverageStructures:[id],derivationSteps:['z ranges or absolute x <= 5']};
  const result=validateSegmentationSource(candidate,assets);assert.equal(result.eligible,false);
  assert(result.missing.includes('originalSegmentation'));assert.equal(representationForAsset(candidate,{status:'reviewed',humanValidated:true}),'illustrative-subdivision');
 }
});
test('source replacement is gated per structure, with a complete positive fixture',()=>{
 const qc=evaluateSpatialQC({assets,transforms:[],referenceSet,measurements:[measurement],reviews:[review]});
 const candidate={id:'candidate',originalSegmentation:{assetId:'atlas',sourceUrl:'https://example.org/source',version:'v1',license:{id:'CC-BY-4.0',publicRedistributionAllowed:true,reviewStatus:'resolved',sourceUrl:'https://example.org/license'}},asset:{...assets[0]},originalLabelDictionary:{assetId:'atlas',sha256:hash,labelIds:[134]},sourceSpace:{id:'test-space',sourceUrl:'https://example.org/space'},targetSpaceId:'test-space',transformChain:[],derivationSteps:[{method:'native discrete labels',interpolation:'none',inputSha256:hash,outputSha256:hash}],coverageStructures:['aal3-label-134'],regionalQC:{referenceSet,measurements:[measurement],reviews:[review]}};
 const index=assets.concat({id:'external',version:'v1',sha256:other,expectedSha256:other,spaceId:'test-space'});
 const gate=validateSegmentationSource(candidate,index);assert.equal(gate.eligible,true,JSON.stringify(gate));
 assert.equal(validateSegmentationSource(candidate,assets).eligible,false,'External reference bytes must be in the verified input index');
 const assessment={...qc,segmentationSources:[{candidateId:'candidate',assetSha256:hash,coverageStructures:['aal3-label-134'],...gate}]};
 assert.equal(representationForAsset({id:'aal3-label-134',candidateId:'candidate',sha256:hash},assessment),'source-segmentation');
 assert.equal(representationForAsset({id:'pons',candidateId:'candidate',sha256:hash},assessment),'illustrative-subdivision');
 assert.equal(validateSegmentationSource({...candidate,regionalQC:{referenceSet,measurements:[measurement],reviews:[review],assets,transforms:[]},asset:{...candidate.asset,sha256:other}},assets).eligible,false);
 for(const changes of [{asset:{...candidate.asset,sha256:other}},{originalSegmentation:{...candidate.originalSegmentation,license:{id:'CC BY',publicRedistributionAllowed:true,reviewStatus:'pending'}}},{regionalQC:{referenceSet,measurements:[measurement],reviews:[]}},{regionalQC:null,regionalAssessment:qc},{transformChain:[{id:'missing',sha256:other}]}])assert.equal(validateSegmentationSource({...candidate,...changes},assets).eligible,false);
 assert.equal(validateSegmentationSource({...candidate,derivationSteps:[{...candidate.derivationSteps[0],outputSha256:other}]},assets).eligible,false);
 assert.equal(validateSegmentationSource({...candidate,originalSegmentation:{...candidate.originalSegmentation,version:'other'}},assets).eligible,false);
});
test('reference space, overlap requirement, and same-file version drift remain gates',()=>{
 const input={assets,transforms:[],referenceSet,measurements:[measurement],reviews:[review]};
 assert.equal(evaluateSpatialQC({...input,referenceSet:{...referenceSet,references:[{...reference,spaceId:'other-space'}]}}).status,'partial');
 assert.equal(evaluateSpatialQC({...input,referenceSet:{...referenceSet,references:[{...reference,hasIndependentSegmentation:true}]}}).status,'partial');
 assert.equal(evaluateSpatialQC({...input,assets:[{...assets[0],sha256:other}]}).status,'partial');
});
test('detail scope is bound to atlas version, label and space',()=>{
 const ref={atlasId:'atlas',atlasVersion:'v1',labelId:134,spaceId:'test-space',hemisphere:'L'};
 const assessment={...evaluateSpatialQC({assets,transforms:[],referenceSet,measurements:[measurement],reviews:[review]}),inputs:assets,coverageRegions:[{regionId:'aal3-label-134',atlasId:'atlas',labelId:134}]};
 assert.equal(spatialQCForRegion(ref,assessment).humanValidated,true);
 for(const changes of [{atlasVersion:'v2'},{atlasId:'unrelated'},{spaceId:'other'},{labelId:1}])assert.equal(spatialQCForRegion({...ref,...changes},assessment).humanValidated,false);
 assert.equal(spatialQCForRegion(ref,null).humanValidated,false);
 const native={...ref,atlasId:'native'};
 assert.equal(spatialQCForRegion(native,{...assessment,inputs:assets.concat({...assets[0],id:'native'}),coverageRegions:assessment.coverageRegions.concat({regionId:'aal3-label-134',atlasId:'native',labelId:134})}).humanValidated,false,'review of a registered asset does not review its native counterpart');
});
test('QC consumers share report loading/failure/retry without upgrading a partial assessment',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;assert.match(String(url),/spatial-qc\/assessment\.json$/);return calls===1?{ok:false,status:503}:{ok:true,json:async()=>({status:'partial',humanValidated:false})};};
 try{
  const a=ensureResource(SPATIAL_QC_RESOURCE),b=ensureResource(SPATIAL_QC_RESOURCE);assert.strictEqual(a,b);
  assert.equal((await a).status,'error');assert.equal(getResourceState(SPATIAL_QC_RESOURCE).value,null);
  const recovered=await retry(SPATIAL_QC_RESOURCE);assert.equal(recovered.value.status,'partial');assert.equal(recovered.value.humanValidated,false);assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});

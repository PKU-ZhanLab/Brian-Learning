/** Spatial evidence gates. Integrity, anatomical evidence and human review remain separate.
 * @typedef {import('./research-contracts.js').AssetIdentity} AssetIdentity
 */
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const digest=value=>typeof value==='string'&&/^[a-f\d]{64}$/.test(value);
const list=value=>Array.isArray(value)?value:[];
const unique=value=>[...new Set(value)];
const validIdentity=value=>nonempty(value?.id)&&nonempty(value.version)&&digest(value.sha256)&&value.sha256===value.expectedSha256&&nonempty(value.spaceId);
const transformValid=value=>nonempty(value?.id)&&digest(value.sha256)&&value.sha256===value.expectedSha256;
const validReference=(ref,assets)=>ref?.independent===true&&nonempty(ref.id)&&nonempty(ref.version)&&digest(ref.sha256)&&nonempty(ref.sourceUrl)&&nonempty(ref.license)&&nonempty(ref.spaceId)&&nonempty(ref.annotationMethod)&&Array.isArray(ref.derivedFromAssetIds)&&!ref.derivedFromAssetIds.some(id=>assets.some(asset=>asset.id===id))&&!assets.some(asset=>asset.sha256===ref.sha256);
const sameHashes=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const actualHuman=review=>review?.reviewer?.kind==='human'&&nonempty(review.reviewer.id)&&nonempty(review.reviewer.name)&&!/(?:\bAI\b|agent|automated|bot|system)/i.test(review.reviewer.name)&&/^\d{4}-\d{2}-\d{2}$/.test(review.date||'')&&Number.isFinite(Date.parse(review.date))&&new Date(review.date).toISOString().slice(0,10)===review.date&&digest(review.evidenceSha256)&&review.verdict==='pass'&&Array.isArray(review.scope);
const metric=(value,maximum)=>Number.isFinite(value)&&value>=0&&Number.isFinite(maximum)&&maximum>=0&&value<=maximum;

/** No supplied status, boolean assertion or numerical registration QA can certify anatomy. */
export function evaluateSpatialQC({assets=[],transforms=[],referenceSet={},measurements=[],reviews=[]}={}) {
 const required=unique(list(referenceSet.requiredCoverage).filter(nonempty));
 const automatedChecks=[...assets.map(asset=>({id:asset.id,kind:'asset-integrity',passed:validIdentity(asset)})),...transforms.map(transform=>({id:transform.id,kind:'transform-integrity',passed:transformValid(transform)}))];
 if(!assets.length)automatedChecks.push({id:'assets',kind:'asset-integrity',passed:false});
 const integrity=automatedChecks.every(check=>check.passed);
 const independentCoverage=[],humanReviewScope=[],rows=[];
 for(const regionId of required){
  const candidates=list(measurements).filter(row=>row.regionId===regionId);
  let accepted=null;
  for(const row of candidates){
   const asset=assets.find(value=>value.id===row.assetId&&value.sha256===row.assetSha256);
   const reference=list(referenceSet.references).find(value=>value.id===row.referenceId&&value.sha256===row.referenceSha256&&validReference(value,assets));
   const threshold=list(referenceSet.thresholds).find(value=>value.regionId===regionId&&value.referenceId===reference?.id&&nonempty(value.basis)&&nonempty(value.protocolVersion));
   const overlapRequired=reference?.hasIndependentSegmentation===true;
   const passes=asset&&reference&&reference.spaceId===asset.spaceId&&threshold&&digest(row.evidenceSha256)&&sameHashes(row.transformSha256s,transforms.map(value=>value.sha256))&&metric(row.landmarkDistanceMm,threshold.landmarkDistanceMm)&&metric(row.boundaryDistanceMm,threshold.boundaryDistanceMm)&&(!overlapRequired||(Number.isFinite(row.overlap)&&row.overlap>=0&&row.overlap<=1&&Number.isFinite(threshold.minimumOverlap)&&threshold.minimumOverlap>=0&&threshold.minimumOverlap<=1&&row.overlap>=threshold.minimumOverlap));
   if(passes){accepted=row;break;}
  }
  if(accepted){
   independentCoverage.push(regionId);
   if(reviews.some(review=>actualHuman(review)&&review.scope.includes(regionId)&&review.assetSha256===accepted.assetSha256&&review.referenceId===accepted.referenceId))humanReviewScope.push(regionId);
  }
  rows.push(accepted?{...accepted,status:'measured',units:{landmarkDistanceMm:'mm',boundaryDistanceMm:'mm',overlap:'Dice [0,1]'}}:{regionId,status:'unmeasured',landmarkDistanceMm:null,boundaryDistanceMm:null,overlap:null,submittedMeasurements:candidates,reason:candidates.length?'No independently bound measurement with predeclared passing thresholds; submitted values are retained separately.':'No independent regional measurements supplied.'});
 }
 const missingCoverage=required.filter(region=>!independentCoverage.includes(region));
 const humanValidated=integrity&&required.length>0&&required.every(region=>humanReviewScope.includes(region));
 const limitations=unique([
  ...list(referenceSet.limitations),
  ...(!integrity?['One or more input identities are absent, unknown-space or do not match locked bytes.']:[]),
  ...(!required.length?['No prespecified coverage protocol.']:[]),
  ...(missingCoverage.length?['Independent anatomical coverage is incomplete; unmeasured metrics remain null.']:[]),
  ...(!humanValidated?['Named human review with date, evidence and actual regional scope is pending.']:[]),
  'File hashes, surface coverage, Jacobian and round-trip error are automated checks; they do not establish anatomical accuracy.',
  'Output grid spacing does not imply registration or landmark accuracy.',
 ]);
 return {status:humanValidated?'reviewed':'partial',automatedChecks,independentCoverage,missingCoverage,measurements:rows,humanValidated,humanReviewScope,limitations};
}

/** Candidate data stay separate until source, distribution and structure-specific QC gates pass. */
export function validateSegmentationSource(candidate={},assetIndex=[]) {
 const index=Array.isArray(assetIndex)?assetIndex:Object.values(assetIndex||{}), missing=[],issues=[];
 const need=(condition,key)=>{if(!condition)missing.push(key);};
 const source=candidate.originalSegmentation,asset=candidate.asset,dictionary=candidate.originalLabelDictionary;
 need(source&&nonempty(source.sourceUrl)&&nonempty(source.version)&&nonempty(source.assetId),'originalSegmentation');
 const license=source?.license;
 need(license&&nonempty(license.id)&&nonempty(license.sourceUrl)&&license.reviewStatus==='resolved'&&license.publicRedistributionAllowed===true,'resolvedRedistributionLicense');
 need(validIdentity(asset)&&index.some(value=>validIdentity(value)&&value.id===asset?.id&&value.version===asset.version&&value.sha256===asset.sha256&&value.spaceId===asset.spaceId),'verifiedAssetHash');
 const original=index.find(value=>validIdentity(value)&&value.id===source?.assetId&&value.version===source.version);
 need(original,'originalSegmentationAsset');
 need(dictionary&&digest(dictionary.sha256)&&list(dictionary.labelIds).length>0&&dictionary.labelIds.every(value=>Number.isSafeInteger(value)&&value>0)&&index.some(value=>value.id===dictionary.assetId&&value.sha256===dictionary.sha256&&validIdentity(value)),'originalLabelDictionary');
 need(nonempty(candidate.sourceSpace?.id)&&nonempty(candidate.sourceSpace?.sourceUrl),'sourceSpace');
 need(nonempty(candidate.targetSpaceId)&&candidate.targetSpaceId===asset?.spaceId,'targetSpace');
 need(Array.isArray(candidate.transformChain),'transformChain');
 if(Array.isArray(candidate.transformChain)){
  if(!candidate.transformChain.length&&candidate.sourceSpace?.id!==candidate.targetSpaceId)issues.push('An empty transform chain cannot connect different spaces.');
  let from=candidate.sourceSpace?.id;
  for(const transform of candidate.transformChain){
   if(!transformValid(transform)||!index.some(value=>value.id===transform.id&&value.sha256===transform.sha256&&transformValid(value))||transform.sourceSpaceId!==from||!nonempty(transform.targetSpaceId))issues.push('Transform chain is incomplete, unbound or not connected.');
   from=transform.targetSpaceId;
  }
  if(candidate.transformChain.length&&from!==candidate.targetSpaceId)issues.push('Transform chain does not reach the target space.');
 }
 need(list(candidate.derivationSteps).length>0&&candidate.derivationSteps.every(step=>nonempty(step.method)&&nonempty(step.interpolation)&&digest(step.inputSha256)&&digest(step.outputSha256)),'derivationSteps');
 if(list(candidate.derivationSteps).length){
  let inputSha256=original?.sha256;
  for(const step of candidate.derivationSteps){if(step.inputSha256!==inputSha256)issues.push('Derivation input does not connect to the original segmentation or preceding output.');inputSha256=step.outputSha256;}
  if(inputSha256!==asset?.sha256)issues.push('Derivation output does not match the proposed asset.');
 }
 need(list(candidate.coverageStructures).length>0&&candidate.coverageStructures.every(nonempty),'coverageStructures');
 const lockedEvidence=hash=>digest(hash)&&index.some(value=>value.sha256===hash&&value.expectedSha256===hash);
 need(list(candidate.regionalQC?.referenceSet?.references).length>0&&candidate.regionalQC.referenceSet.references.every(reference=>lockedEvidence(reference.sha256)),'lockedIndependentReferenceEvidence');
 need(list(candidate.regionalQC?.measurements).length>0&&candidate.regionalQC.measurements.every(measurement=>lockedEvidence(measurement.evidenceSha256)),'lockedMeasurementEvidence');
 need(list(candidate.regionalQC?.reviews).length>0&&candidate.regionalQC.reviews.every(review=>lockedEvidence(review.evidenceSha256)),'lockedHumanReviewEvidence');
 const regionalAssets=asset?[{...asset,expectedSha256:index.find(value=>value.id===asset.id)?.sha256}]:[];
 if(original&&original.id!==asset?.id)regionalAssets.push(original);
 const regional=candidate.regionalQC&&evaluateSpatialQC({...candidate.regionalQC,assets:regionalAssets,transforms:list(candidate.transformChain)});
 need(regional&&regional.humanValidated&&regional.status==='reviewed'&&list(candidate.coverageStructures).every(id=>regional.independentCoverage.includes(id)&&regional.humanReviewScope.includes(id)),'independentRegionalHumanReview');
 return {eligible:missing.length===0&&issues.length===0,missing,issues};
}

export function representationForAsset(asset,assessment) {
 const qualified=list(assessment?.segmentationSources).some(source=>source.eligible===true&&source.candidateId===asset?.candidateId&&source.assetSha256===asset?.sha256&&list(source.coverageStructures).includes(asset?.id)&&list(assessment?.independentCoverage).includes(asset?.id)&&list(assessment?.humanReviewScope).includes(asset?.id));
 return qualified&&assessment.humanValidated===true?'source-segmentation':'illustrative-subdivision';
}

/** A report for another atlas version/space/label cannot lend its review to this selection. */
export function spatialQCForRegion(ref,assessment){
 const asset=list(assessment?.inputs).find(asset=>asset.id===ref?.atlasId&&asset.version===ref?.atlasVersion&&asset.spaceId===ref?.spaceId);
 const region=asset&&list(assessment.coverageRegions).find(row=>row.atlasId===ref.atlasId&&row.labelId===ref.labelId);
 const measured=region&&list(assessment.measurements).some(row=>row.regionId===region.regionId&&row.assetId===asset.id&&row.assetSha256===asset.sha256&&row.status==='measured');
 const humanValidated=Boolean(measured&&assessment.humanValidated&&list(assessment.humanReviewScope).includes(region.regionId));
 return {status:humanValidated?'reviewed':'partial',humanValidated,independentMeasured:Boolean(measured&&list(assessment.independentCoverage).includes(region.regionId)),reportMatchesAsset:Boolean(asset),regionId:region?.regionId??null};
}

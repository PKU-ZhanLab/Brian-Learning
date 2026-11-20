/** @typedef {import('./research-contracts.js').AtlasRegionRef} AtlasRegionRef */
/**
 * A reading link keeps the study's identity separate from a human catalog concept.
 * No support category in this module grants coordinate-overlay eligibility.
 * @typedef {Object} EvidenceMapping
 * @property {string} id
 * @property {string} referenceId
 * @property {string|null} claimId
 * @property {string|null} resultId
 * @property {{species:string|null,label:string|null,hemisphere:'L'|'R'|'M'|'B'|'U',spaceId:string|null}} sourceRegion
 * @property {AtlasRegionRef|null} targetRegionRef
 * @property {string|null} targetConceptId
 * @property {'direct-measurement'|'synthesis'|'background'|'unknown'} measurementKind
 * @property {'direct'|'context'|'cross-species'|'unknown'} support
 * @property {'author-reported'|'contextual'|'homology-unverified'|'spatial-overlap'|'unknown'} mappingKind
 * @property {Object[]} sourceRefs
 * @property {{zh:string,en:string}|{zh:string,en:string}[]} limitations
 */
const unknownSpecies=new Set(['mixed','unspecified','unknown','not-applicable']);
const hemispheres=new Set(['L','R','M','B']);
const targetHemisphere=m=>m.targetRegionRef?.hemisphere||(/-l$/.test(m.targetConceptId||'')?'L':/-r$/.test(m.targetConceptId||'')?'R':null);

/** Conservatively classify an individual claim-to-target relationship, without mutation. */
export function classifyMapping(mapping) {
  const sourceRegion={species:null,label:null,hemisphere:'U',spaceId:null,...mapping.sourceRegion};
  const species=sourceRegion.species;
  const targetSide=targetHemisphere(mapping);
  const sideSupported=hemispheres.has(sourceRegion.hemisphere)&&(!targetSide||sourceRegion.hemisphere===targetSide||sourceRegion.hemisphere==='B');
  let support=['direct','context','cross-species','unknown'].includes(mapping.support)?mapping.support:'unknown';
  let mappingKind=mapping.mappingKind||'unknown';
  if(species&&species!=='human'&&!unknownSpecies.has(species)){
    support='cross-species';
    mappingKind='homology-unverified';
  } else if(support==='direct') {
    if(species!=='human'||!sourceRegion.label||!hemispheres.has(sourceRegion.hemisphere))support='unknown';
    else if(!sideSupported||mapping.measurementKind!=='direct-measurement'||!['author-reported','spatial-overlap'].includes(mappingKind))support='context';
  }
  return {...mapping,claimId:mapping.claimId??null,resultId:mapping.resultId??null,sourceRegion,targetRegionRef:mapping.targetRegionRef??null,targetConceptId:mapping.targetConceptId??null,measurementKind:mapping.measurementKind||'unknown',support,mappingKind,sourceRefs:mapping.sourceRefs||[],limitations:mapping.limitations||[],directEvidence:support==='direct'};
}

/** Defaults to supported targets only. Context is returned only after an explicit opt-in.
 * Rows are never merged by target: different claims retain their own restrictions.
 */
export function buildLocateRequest(paperId,{mappings,includeContext=false}) {
  const rows=(mappings||[]).filter(m=>m.referenceId===paperId).map(classifyMapping);
  const directMappings=rows.filter(m=>m.support==='direct'&&m.targetConceptId);
  const contextMappings=includeContext?rows.filter(m=>m.support!=='direct'&&m.targetConceptId):[];
  const limitations=[];
  for(const m of [...directMappings,...contextMappings])for(const limit of Array.isArray(m.limitations)?m.limitations:[m.limitations]){
    if(limit&&!limitations.some(v=>v.zh===limit.zh&&v.en===limit.en))limitations.push(limit);
  }
  return {directMappings,contextMappings,limitations};
}

import {references} from '../data/references.js';
import {additionalReferences} from '../data/references-expanded.js';
import {literaturePapers,additionalLiteratureReferences} from '../data/literature.js';
import {curatedEvidence} from '../data/results.js';
import {EVIDENCE_COLLECTIONS,emptyEvidence,migrateEvidence,validateEvidenceV2,safeSourceURL,normalizeDOI,resolveReferenceAlias} from './evidence-schema.js';

const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
const clone=value=>structuredClone(value);
const fields={
  references:'id title authors fullAuthorList year journal volume pages doi url pmid pmcid kind type publisher place edition series verificationStatus metadataSources verified summary summaryEn method studyModalities topics',
  readings:'id referenceId resultSummaries methodProvenance limitations claimIds modalities topics species speciesLabel studyType studyTypeLabel population associationStrength associationStrengthLabel coordinateStatus figures atlasAssociations recordVersion legacyV1',
  experiments:'id referenceId task species sample modalities sourceRefs limitations recordVersion',
  results:'id referenceId experimentId recordVersion contrast finding modalities sample statistics effectEstimate correction timeWindow frequencyBand locationIds claimIds limitations sourceRefs legacyV1',
  locations:'id resultId recordVersion kind sourceLabel sourceSpaceId xyz unit uncertainty dispersion sourceRefs derivedAsset transformRef limitations legacyV1',
  claims:'id referenceId experimentId resultId text sourceRefs limitations recordVersion',
  mappings:'id referenceId claimId resultId sourceRegion targetRegionRef targetConceptId measurementKind support mappingKind sourceRefs limitations directEvidence structureId relation space coordinates source sourceKind sourceFields modalities recordVersion',
  reviewEvents:'id subjectId stage actorType actorName date scope sourceRefs limitations recordVersion legacyV1',
  relations:'id fromResultId toResultId type rationale annotator sourceUrl limitations recordVersion',
};
const forbidden=new Set(['notes','note','volumes','volumeData','localVolumes','localAssets','assets','bytes','blob','file','filePath','privateNotes','localNotes']);
function clean(value){
  if(Array.isArray(value))return value.map(clean);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!forbidden.has(key)).map(([key,v])=>[key,clean(v)]));
  return value;
}
const pick=(row,names)=>Object.fromEntries(names.split(' ').filter(key=>Object.hasOwn(row,key)).map(key=>[key,clean(row[key])]));

/** Committed records are the public authority. Caller flags and same-ID edits
 * cannot expand this manifest. Every return value is an independent clone. */
export function getBuiltinEvidenceBundle(){
  const bibliography=unique([...references,...additionalReferences,...additionalLiteratureReferences,...curatedEvidence.references]);
  const migrated=migrateEvidence({schema:'brain-evidence-v1',references:bibliography,results:[],relations:[],readings:literaturePapers}).value;
  // Preserve the complete generated reading vocabulary used by search/cards.
  migrated.readings=migrated.readings.map(row=>({...clone(literaturePapers.find(p=>p.id===row.id)),...row}));
  for(const key of EVIDENCE_COLLECTIONS)migrated[key]=unique([...migrated[key],...clone(curatedEvidence[key])]);
  migrated.dataVersion=`literature-2026-10-29+results-${curatedEvidence.dataVersion}`;
  delete migrated.legacyV1;
  return migrated;
}

/** Reconstruct a card solely from the serialized graph, with no library lookup. */
export function getReadingViewModel(referenceId,bundle){
  const reading=bundle.readings.find(r=>r.referenceId===referenceId);if(!reading)return null;
  const claims=bundle.claims.filter(c=>reading.claimIds.includes(c.id)).map(c=>({...clone(c),source:c.sourceRefs.find(s=>safeSourceURL(s))||bundle.sourceArtifacts.find(a=>c.sourceRefs.includes(a.id))?.sourceUrl,limitations:c.limitations.length===1?clone(c.limitations[0]):{zh:c.limitations.map(l=>typeof l==='string'?l:l.zh||l.en).join(' '),en:c.limitations.map(l=>typeof l==='string'?l:l.en||l.zh).join(' ')}}));
  return {...clone(reading),id:referenceId,claims,mappedRegions:clone(bundle.mappings.filter(m=>m.referenceId===referenceId&&(!m.claimId||reading.claimIds.includes(m.claimId))))};
}
const referenceFor=(row,bundle)=>row.referenceId||bundle.experiments.find(e=>e.id===row.experimentId)?.referenceId||bundle.claims.find(c=>c.resultId===row.id)?.referenceId;
function walkSources(value,visit,path=''){
  if(!value||typeof value!=='object')return;
  for(const [key,nested] of Object.entries(value)){
    if(key==='legacyV1')continue;
    if(key==='sourceRefs'&&Array.isArray(nested))for(const ref of nested)visit(typeof ref==='string'?ref:ref?.url,`${path}.sourceRefs`);
    else if(key==='methodProvenance'&&nested)visit(nested.source,`${path}.methodProvenance.source`);
    else walkSources(nested,visit,`${path}.${key}`);
  }
}
const omittedLimit={zh:'来源内容因再分发依据不足未包含；离线原文核对不可用，保留来源身份和链接。',en:'Source content is omitted because redistribution permission is not established; offline source checking is unavailable. Source identity and link are retained.'};
function sourceReference(artifact){
  return {...pick(artifact,'id referenceId sourceReferenceId referenceIds doi schema sourceUrl sourceVersion retrievedAt locator rights sourceFileSha256'),schema:'source-reference-v1',originalArtifactSchema:artifact.schema||null,originalExcerptSha256:artifact.sha256||null,originalRecordSha256:artifact.recordSha256||null,contentOmitted:true,offlineEvidenceAvailable:false,limitations:[omittedLimit]};
}

/** Export the selected paper graph. Local files explicitly opt into selected
 * private evidence; public output is reconstructed from committed records. */
export function buildEvidencePackage({paperIds,bundle,includePrivate=false}){
  if(!Array.isArray(paperIds)||paperIds.some(id=>typeof id!=='string'))throw Error('paperIds must be an array of paper identifiers');
  const canonical=getBuiltinEvidenceBundle(),source=includePrivate?migrateEvidence(bundle).value:canonical;
  const out={...emptyEvidence(),dataVersion:source.dataVersion,packageVersion:'1',sourceDataVersion:source.dataVersion,exclusions:[]};
  const chosen=new Set();
  for(const id of new Set(paperIds)){
    let paper=source.references.find(r=>r.id===id);
    if(!paper&&!includePrivate){const doi=normalizeDOI(bundle?.references?.find(r=>r.id===id)?.doi);if(doi)paper=source.references.find(r=>normalizeDOI(r.doi)===doi);}
    if(paper)chosen.add(paper.id);else out.exclusions.push({collection:'references',id,reason:includePrivate?'unknown-selection':'not-in-public-manifest'});
  }
  out.references=source.references.filter(r=>chosen.has(r.id));
  out.experiments=source.experiments.filter(e=>chosen.has(e.referenceId));
  out.results=source.results.filter(r=>chosen.has(referenceFor(r,source)));
  const resultIds=new Set(out.results.map(r=>r.id));
  out.locations=source.locations.filter(l=>resultIds.has(l.resultId));
  out.readings=source.readings.filter(r=>chosen.has(r.referenceId));
  out.claims=source.claims.filter(c=>chosen.has(c.referenceId));
  out.mappings=source.mappings.filter(m=>chosen.has(m.referenceId));
  out.relations=source.relations.filter(r=>{
    const from=resultIds.has(r.fromResultId),to=resultIds.has(r.toResultId);
    if(from&&to)return true;
    if(from||to)out.exclusions.push({collection:'relations',id:r.id,reason:'endpoint-not-selected',missingEndpoints:[!from?'fromResultId':null,!to?'toResultId':null].filter(Boolean)});
    return false;
  });
  const subjects=new Set(EVIDENCE_COLLECTIONS.filter(k=>!['sourceArtifacts','reviewEvents'].includes(k)).flatMap(k=>out[k].map(r=>r.id)));
  const needed=new Set();
  // Review events can be about artifacts and select still older versions.
  // Close both edge kinds before projecting source rights/content. Ownership
  // alone never selects a private file; cycles terminate once the sets settle.
  let previousSize=-1;
  while(previousSize!==subjects.size+needed.size){
    previousSize=subjects.size+needed.size;
    out.reviewEvents=source.reviewEvents.filter(e=>subjects.has(e.subjectId));
    walkSources(out,ref=>{if(ref&&!safeSourceURL(ref))needed.add(ref);});
    out.sourceArtifacts=source.sourceArtifacts.filter(a=>needed.has(a.id));
    for(const artifact of out.sourceArtifacts)subjects.add(artifact.id);
  }
  const approved=new Map(canonical.sourceArtifacts.map(a=>[a.id,JSON.stringify(a)]));
  out.sourceArtifacts=out.sourceArtifacts.map(a=>approved.get(a.id)===JSON.stringify(a)?clone(a):sourceReference(a));
  const requiredAliases=new Set(out.sourceArtifacts.flatMap(a=>[a.referenceId,...(a.referenceIds||[]),a.sourceReferenceId,...(a.fields||[]).filter(f=>f.path.startsWith('references/')).map(f=>f.path.split('/')[1])]).filter(Boolean));
  const aliases=(source.referenceAliases||[]).filter(a=>chosen.has(a.canonicalId)&&requiredAliases.has(a.aliasId));
  if(aliases.length)out.referenceAliases=aliases.map(a=>({aliasId:a.aliasId,canonicalId:a.canonicalId,originalReference:pick(a.originalReference,fields.references)}));
  for(const key of EVIDENCE_COLLECTIONS)if(key!=='sourceArtifacts')out[key]=out[key].map(row=>pick(row,fields[key]));
  const report=validateEvidencePackageClosure(out);if(!report.valid)throw Error(report.errors.join('\n'));
  return report.value;
}

/** Closure needs no known records or atlas catalog. It proves resolvability,
 * never source semantics, spatial eligibility or review completion. */
export function validateEvidencePackageClosure(input){
  const base=validateEvidenceV2(input,{knownReferences:[],knownResults:[],knownRegions:undefined});
  if(!base.valid)return base;
  const value=base.value,errors=[],artifacts=new Set(value.sourceArtifacts.map(a=>a.id)),papers=new Set(value.references.map(r=>r.id));
  const resolve=(ref,path)=>{if(typeof ref!=='string'||!safeSourceURL(ref)&&!artifacts.has(ref))errors.push(`${path}: unresolved source ${ref}`);};
  walkSources(value,resolve);
  for(const artifact of value.sourceArtifacts){if(artifact.referenceId&&!papers.has(resolveReferenceAlias(value,artifact.referenceId)))errors.push(`${artifact.id}: source paper absent`);if(!safeSourceURL(artifact.sourceUrl))errors.push(`${artifact.id}: source URL required`);}
  for(const mapping of value.mappings){if(!mapping.limitations)errors.push(`${mapping.id}: mapping limitations required`);if(!mapping.targetConceptId&&!mapping.targetRegionRef)errors.push(`${mapping.id}: target concept or exact region required`);}
  for(const reading of value.readings){if(!reading.claimIds.length)errors.push(`${reading.id}: reading claim required`);}
  const warnings=[...base.warnings,...value.sourceArtifacts.filter(a=>a.contentOmitted).map(a=>`${a.id}: source identity retained; content omitted and offline evidence unavailable. Original hashes identify absent source bytes, not this reference stub.`)];
  return {valid:errors.length===0,errors,warnings,value:errors.length?null:value};
}

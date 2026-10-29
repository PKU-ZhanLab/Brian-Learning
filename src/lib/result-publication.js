import registry from '../../data-sources/results/publication-registry.json' with {type:'json'};
import v1 from '../../data-sources/results/published/2026-10-29.2.json' with {type:'json'};
import v2 from '../../data-sources/results/published/2026-10-30.1.json' with {type:'json'};
import correctionLog from '../../data-sources/results/corrections.json' with {type:'json'};
import {deriveReviewState,safeSourceURL} from './evidence-schema.js';
import {buildEvidencePackage,validateEvidencePackageClosure} from './evidence-package.js';

export const canonicalPublicationJSON=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(item=>JSON.parse(canonicalPublicationJSON(item))):Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(canonicalPublicationJSON(value[key]))])):value);
const clone=value=>structuredClone(value);
const snapshots=new Map([[v1.dataVersion,v1],[v2.dataVersion,v2]]);
const stripLegacy=value=>Array.isArray(value)?value.map(stripLegacy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='legacyV1').map(([key,nested])=>[key,stripLegacy(nested)])):value;

/** Internal deterministic projection of a committed snapshot. Never apply this
 * helper to local/imported evidence; buildPublicResultRecord gates authority. */
function projectPublishedContent(bundle,{resultId,dataVersion}){
 const result=bundle.results.find(row=>row.id===resultId);if(!result)throw Error('unpublished-result');
 const claims=bundle.claims.filter(row=>result.claimIds.includes(row.id));
 const locations=bundle.locations.filter(row=>result.locationIds.includes(row.id));
 const mappings=bundle.mappings.filter(row=>row.resultId===resultId||claims.some(claim=>claim.id===row.claimId));
 const experiment=bundle.experiments.find(row=>row.id===result.experimentId)||null;
 const events=bundle.reviewEvents.filter(row=>row.subjectId===resultId&&row.recordVersion===result.recordVersion);
 const reviewState=deriveReviewState(events);
 const reference=bundle.references.find(row=>row.id===result.referenceId);
 const refs=new Set(reference?.url?[reference.url]:[]);
 const visit=value=>{if(!value||typeof value!=='object')return;for(const [key,nested] of Object.entries(value)){if(key==='legacyV1')continue;if(key==='sourceRefs'&&Array.isArray(nested))nested.forEach(ref=>{if(typeof ref==='string')refs.add(ref);});else visit(nested);}};
 [result,experiment,...claims,...locations,...mappings,...events].forEach(visit);
 for(const artifact of bundle.sourceArtifacts)if(refs.has(artifact.id))refs.add(artifact.sourceUrl);
 return stripLegacy({resultId,dataVersion,sourceRefs:[...refs].sort(),experiment,result,locations,mappings,reviewState,limitations:[...(result.limitations||[]),...reviewState.limitations],corrections:(bundle.corrections||[]).filter(row=>row.subjectId===resultId)});
}

function entryFor(resultId,dataVersion){
 const entry=registry.versions.find(row=>row.dataVersion===dataVersion);if(!entry||!snapshots.has(dataVersion))throw Error('unpublished-version');
 const record=entry.records.find(row=>row.resultId===resultId);if(!record)throw Error('unpublished-result');return {entry,record};
}
export const publishedResultVersion=resultId=>registry.latest[resultId]||null;
export const publicResultURL=(resultId,dataVersion=publishedResultVersion(resultId))=>{entryFor(resultId,dataVersion);return `?result=${encodeURIComponent(resultId)}&version=${encodeURIComponent(dataVersion)}`;};

/** Trusted lookup for X11. Explicit versions NEVER fall through to latest.
 * Routing may redirect the versionless URL to publicResultURL's fixed URL. */
export function getPublishedResultRecord({resultId,dataVersion=publishedResultVersion(resultId)}){
 const {record}=entryFor(resultId,dataVersion),snapshot=snapshots.get(dataVersion);
 return {...clone(projectPublishedContent(snapshot,{resultId,dataVersion})),contentHash:record.contentHash};
}

/** Caller flags and IDs are insufficient. Even a same-ID result edit or extra
 * private claim makes the input noncanonical. Output always comes from the
 * committed snapshot, never the caller's objects. */
export function buildPublicResultRecord(bundle,{resultId,dataVersion=publishedResultVersion(resultId)}){
 entryFor(resultId,dataVersion);
 if(bundle?.dataVersion!==dataVersion)throw Error('version-mismatch');
 if(canonicalPublicationJSON(bundle)!==canonicalPublicationJSON(snapshots.get(dataVersion)))throw Error('canonical-publication-mismatch');
 return getPublishedResultRecord({resultId,dataVersion});
}

export const getResultCorrections=resultId=>clone(correctionLog.corrections.filter(row=>row.subjectId===resultId));
export function getPublishedSourceDetails({resultId,dataVersion=publishedResultVersion(resultId)}){
 const record=getPublishedResultRecord({resultId,dataVersion});
 return clone(snapshots.get(dataVersion).sourceArtifacts.filter(row=>record.sourceRefs.includes(row.id)).map(row=>({id:row.id,sourceUrl:safeSourceURL(row.sourceUrl),sourceVersion:row.sourceVersion,locator:row.locator,sha256:row.sha256,recordSha256:row.recordSha256,rights:row.rights,limitations:row.limitations})));
}

function exportVersion(resultId,dataVersion){
 const snapshot=snapshots.get(dataVersion),record=getPublishedResultRecord({resultId,dataVersion});
 const evidence=buildEvidencePackage({paperIds:[record.result.referenceId],bundle:snapshot,includePrivate:true});
 evidence.results=evidence.results.filter(row=>row.id===resultId);
 evidence.locations=evidence.locations.filter(row=>record.result.locationIds.includes(row.id));
 evidence.claims=evidence.claims.filter(row=>record.result.claimIds.includes(row.id));
 evidence.experiments=evidence.experiments.filter(row=>row.id===record.result.experimentId);
 evidence.mappings=evidence.mappings.filter(row=>row.resultId===resultId||record.result.claimIds.includes(row.claimId));
 evidence.relations=[];
 const subjects=new Set([...evidence.results,...evidence.locations,...evidence.claims,...evidence.experiments,...evidence.mappings,...evidence.sourceArtifacts].map(row=>row.id));
 evidence.reviewEvents=evidence.reviewEvents.filter(row=>subjects.has(row.subjectId));
 const report=validateEvidencePackageClosure(evidence);if(!report.valid)throw Error(report.errors.join('\n'));
 return {record,evidence:report.value};
}

/** Publication provenance export, separate from editable E5 evidence packages.
 * Fixed records and the correction endpoints each carry their own closed graph.
 * No caller bundle/notes/flags can enter this canonical export. */
export function buildPublicResultExport({resultId,dataVersion=publishedResultVersion(resultId)}){
 const selected=exportVersion(resultId,dataVersion),corrections=getResultCorrections(resultId);
 const versions=new Set([dataVersion,...corrections.flatMap(row=>[row.fromVersion,row.toVersion])]);
 const relatedVersions=[...versions].filter(version=>version!==dataVersion).map(version=>exportVersion(resultId,version));
 const publicationIdentities=[...versions].map(version=>{const {entry,record}=entryFor(resultId,version);return {resultId,dataVersion:version,contentHash:record.contentHash,snapshotSha256:entry.sha256};});
 return {schema:'public-result-export-v1',resultId,dataVersion,...selected,corrections,publicationIdentities,relatedVersions,validationScope:'Self-contained record/source integrity and graph closure. Snapshot hashes are retained identity references; this unsigned file alone does not authenticate publication origin, establish source semantics, spatial accuracy or human review.'};
}

const hashJSON=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalPublicationJSON(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
/** Standalone async verifier: no built-in registry, atlas or network lookup. */
export async function validatePublicResultExport(input){
 const errors=[];
 try{
  if(input?.schema!=='public-result-export-v1'||!Array.isArray(input.relatedVersions)||!Array.isArray(input.publicationIdentities)||!Array.isArray(input.corrections))throw Error('invalid-public-result-export');
  if(input.resultId!==input.record?.resultId||input.dataVersion!==input.record?.dataVersion)errors.push('selected-version-mismatch');
  const versions=[{record:input.record,evidence:input.evidence},...input.relatedVersions],seen=new Set();
  if(input.publicationIdentities.length!==versions.length)errors.push('publication-identities-mismatch');
  const sourceIds=new Set(),boundCorrections=new Map();
  for(const {record,evidence} of versions){
   if(seen.has(record.dataVersion)||record.resultId!==input.resultId)errors.push('duplicate-or-foreign-version');seen.add(record.dataVersion);
   const identity=input.publicationIdentities.find(row=>row.resultId===record.resultId&&row.dataVersion===record.dataVersion);
   if(!identity||identity.contentHash!==record.contentHash||!/^[a-f0-9]{64}$/.test(identity.snapshotSha256))errors.push('publication-identity-mismatch');
   const closure=validateEvidencePackageClosure(evidence);if(!closure.valid)errors.push(...closure.errors);
   if(evidence.dataVersion!==record.dataVersion||evidence.results.length!==1||evidence.results[0]?.id!==record.resultId)errors.push('evidence-version-mismatch');
   const {contentHash,...content}=record;
   for(const correction of record.corrections||[]){const prior=boundCorrections.get(correction.id);if(prior&&canonicalPublicationJSON(prior)!==canonicalPublicationJSON(correction))errors.push('correction-version-conflict');boundCorrections.set(correction.id,correction);}
   if(await hashJSON(content)!==contentHash)errors.push('record-content-hash-mismatch');
   const reconstructed=projectPublishedContent({...evidence,corrections:record.corrections},{resultId:record.resultId,dataVersion:record.dataVersion});
   if(canonicalPublicationJSON(reconstructed)!==canonicalPublicationJSON(content))errors.push('record-evidence-projection-mismatch');
   for(const artifact of evidence.sourceArtifacts){
    sourceIds.add(artifact.id);const {sha256,recordSha256,...sourceRecord}=artifact;
    if(await hashJSON(artifact.excerpt)!==sha256||await hashJSON(sourceRecord)!==recordSha256)errors.push('source-artifact-hash-mismatch');
   }
  }
  const sorted=rows=>[...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  if(canonicalPublicationJSON(sorted(input.corrections))!==canonicalPublicationJSON(sorted([...boundCorrections.values()])))errors.push('correction-content-mismatch');
  for(const correction of input.corrections){
   if(correction.subjectId!==input.resultId||!seen.has(correction.fromVersion)||!seen.has(correction.toVersion)||!correction.id||!/^\d{4}-\d{2}-\d{2}$/.test(correction.date)||typeof correction.reason!=='string'||!Array.isArray(correction.changedFields)||!correction.changedFields.length||!Array.isArray(correction.sourceRefs)||correction.sourceRefs.some(ref=>!safeSourceURL(ref)&&!sourceIds.has(ref)))errors.push('correction-endpoint-or-source-mismatch');
  }
 }catch(error){errors.push(error.message||'invalid-public-result-export');}
 return {valid:errors.length===0,errors,scope:'Internal integrity/closure only; independent of built-in records and network access.'};
}

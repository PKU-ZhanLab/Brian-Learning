import {classifyMapping} from './evidence-mapping.js';
export const LEGACY_SCHEMA = 'brain-evidence-v1';
export const COORDINATE_SPACES = ['MNI-unspecified', 'MNI152NLin6Asym', 'MNI152NLin2009cAsym', 'Talairach', 'subject-native', 'other'];
export const CURATION_STATUSES = ['draft', 'source-checked'];
export const safeSourceURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
export const normalizeDOI = value => String(value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
const doiID = doi => { let hash = 14695981039346656037n; for (const char of doi) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0))) * 1099511628211n); return `doi-${doi.replace(/[^a-z0-9]+/g,'-').slice(0,120)}-${hash.toString(16)}`; };
const hasText = value => typeof value === 'string' ? value.trim().length > 0 : value && typeof value === 'object' && ['zh', 'en'].some(k => typeof value[k] === 'string' && value[k].trim());
const text = value => typeof value === 'string' || (value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([k,v]) => ['zh','en'].includes(k) && typeof v === 'string'));

/** Validation never promotes a record's curation status. knownReferences/knownResults may be IDs or records. */
export function validateEvidenceV1(input, {knownReferences = [], knownResults = [], knownRegions} = {}) {
  const errors = [], warnings = [];
  let value = input;
  if (typeof input === 'string') { try { value = JSON.parse(input); } catch { return {valid: false, errors: ['Invalid JSON / JSON 格式不正确'], warnings, value: null}; } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {valid: false, errors: ['Evidence must be an object / 证据包必须是对象'], warnings, value: null};
  if (value.schema !== LEGACY_SCHEMA) errors.push(`schema must be ${LEGACY_SCHEMA}`);
  for (const key of ['references', 'results', 'relations']) if (!Array.isArray(value[key])) errors.push(`${key} must be an array`);
  if (errors.length) return {valid: false, errors, warnings, value: null};
  if (value.references.length + value.results.length + value.relations.length > 10000) errors.push('Maximum 10,000 records per package');
  const ids = list => new Set(list.map(v => typeof v === 'string' ? v : v?.id).filter(Boolean));
  const referenceIds = new Set([...ids(knownReferences), ...ids(value.references)]), resultIds = new Set([...ids(knownResults), ...ids(value.results)]);
  const regions = knownRegions ? ids(knownRegions) : null;
  const url = (v, path, required = true) => { if ((required || v) && !safeSourceURL(v)) errors.push(`${path}: an http(s) source URL is required`); };
  const requireText = (v, path) => { if (!hasText(v) || !text(v)) errors.push(`${path}: text is required`); };
  const stringArray = (v, path) => { if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) errors.push(`${path}: expected string array`); };
  const regionArray = (v, path) => { stringArray(v, path); if (regions && Array.isArray(v)) v.forEach(id => { if (!regions.has(id)) errors.push(`${path}: unknown region ${id}`); }); };
  for (const key of ['references', 'results', 'relations']) {
    const seen = new Set();
    value[key].forEach((row, i) => { const p = `${key}[${i}]`; if (!row || typeof row !== 'object' || Array.isArray(row)) { errors.push(`${p}: expected object`); return; } if (typeof row.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(row.id)) errors.push(`${p}.id: invalid identifier`); if (seen.has(row.id)) errors.push(`${p}: duplicate id ${row.id}`); seen.add(row.id); });
  }
  value.references.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const p = `references[${i}]`; if (typeof r.title !== 'string' || !r.title.trim()) errors.push(`${p}.title: a nonempty string is required`);
    if (r.authors != null && typeof r.authors !== 'string' && (!Array.isArray(r.authors) || r.authors.some(a => typeof a !== 'string'))) errors.push(`${p}.authors: expected text or string array`);
    for (const key of ['journal','doi','url','pmid','pmcid','volume','pages']) if (r[key] != null && typeof r[key] !== 'string') errors.push(`${p}.${key}: expected string`);
    if (r.fullAuthorList != null) stringArray(r.fullAuthorList, `${p}.fullAuthorList`);
    if (r.year != null && (!Number.isInteger(r.year) || r.year < 1000 || r.year > 2200)) errors.push(`${p}.year: invalid year`);
    if (r.doi && !/^10\.\d{4,9}\/\S+$/i.test(normalizeDOI(r.doi))) errors.push(`${p}.doi: invalid DOI`);
    url(r.url, `${p}.url`, !r.doi); if (r.metadataSources) { stringArray(r.metadataSources, `${p}.metadataSources`); if (Array.isArray(r.metadataSources)) r.metadataSources.forEach(s => url(s, `${p}.metadataSources`)); }
  });
  value.results.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const p = `results[${i}]`;
    if (!referenceIds.has(r.referenceId)) errors.push(`${p}.referenceId: unknown paper ${r.referenceId}`);
    for (const key of ['finding','condition','sample','roiDefinition','direction','annotator']) requireText(r[key], `${p}.${key}`);
    stringArray(r.modalities, `${p}.modalities`); if (Array.isArray(r.modalities) && !r.modalities.length) errors.push(`${p}.modalities: choose at least one modality`); if (r.topics != null) stringArray(r.topics, `${p}.topics`); regionArray(r.regionIds, `${p}.regionIds`); url(r.sourceUrl, `${p}.sourceUrl`);
    if (!CURATION_STATUSES.includes(r.curationStatus)) errors.push(`${p}.curationStatus: expected draft or source-checked`);
    if (r.curationStatus === 'source-checked') requireText(r.curationNote, `${p}.curationNote`);
    if (!Array.isArray(r.coordinates)) errors.push(`${p}.coordinates: expected array`);
    else r.coordinates.forEach((c, j) => {
      const cp = `${p}.coordinates[${j}]`; if (!c || typeof c !== 'object') { errors.push(`${cp}: expected object`); return; }
      if (typeof c.id !== 'string' || !c.id.trim() || r.coordinates.some((other,k) => k < j && other?.id === c.id)) errors.push(`${cp}.id: a unique coordinate ID is required`);
      for (const k of ['x','y','z']) if (typeof c[k] !== 'number' || !Number.isFinite(c[k]) || Math.abs(c[k]) > 300) errors.push(`${cp}.${k}: finite millimetre coordinate within ±300 required`);
      if (!COORDINATE_SPACES.includes(c.space)) errors.push(`${cp}.space: use an explicit supported frame (generic MNI is MNI-unspecified)`);
      if (!CURATION_STATUSES.includes(c.status)) errors.push(`${cp}.status: expected draft or source-checked`);
      if (c.kind && !['peak','roi-mean','stimulation-target','electrode','other'].includes(c.kind)) errors.push(`${cp}.kind: invalid coordinate meaning`);
      for (const k of ['label','sourceTable','sourceRow','frameNote']) requireText(c[k], `${cp}.${k}`);
      url(c.sourceUrl, `${cp}.sourceUrl`);
      if (c.space !== 'MNI152NLin6Asym') warnings.push(`${cp}: independent coordinate frame; no automatic atlas overlay`);
      if (c.status !== 'source-checked') warnings.push(`${cp}: draft coordinate; not eligible for verified result markers`);
    });
    if (!Array.isArray(r.figures)) errors.push(`${p}.figures: expected array`);
    else r.figures.forEach((f,j) => { const fp = `${p}.figures[${j}]`; if (!f || typeof f !== 'object') { errors.push(`${fp}: expected object`); return; } url(f.url, `${fp}.url`); url(f.imageUrl, `${fp}.imageUrl`, false); url(f.sourceUrl, `${fp}.sourceUrl`); requireText(f.caption, `${fp}.caption`); requireText(f.license, `${fp}.license`); regionArray(f.regionIds, `${fp}.regionIds`); if (f.rehosted && !/\bCC[ -](BY|0)\b/i.test(f.license)) errors.push(`${fp}: rehosting requires a compatible Creative Commons license`); });
  });
  value.relations.forEach((r,i) => { if (!r || typeof r !== 'object') return; const p = `relations[${i}]`; if (!resultIds.has(r.fromResultId) || !resultIds.has(r.toResultId)) errors.push(`${p}: relation must link two existing results`); if (r.fromResultId === r.toResultId) errors.push(`${p}: relation endpoints must differ`); if (!['agreement','disagreement','complementary','not-comparable'].includes(r.type)) errors.push(`${p}.type: invalid relation`); requireText(r.rationale, `${p}.rationale`); requireText(r.annotator, `${p}.annotator`); url(r.sourceUrl, `${p}.sourceUrl`); });
  return {valid: errors.length === 0, errors, warnings: [...new Set(warnings)], value: errors.length ? null : structuredClone(value)};
}

export const EVIDENCE_SCHEMA = 'brain-evidence-v2';
export const EVIDENCE_COLLECTIONS = ['references','readings','experiments','results','locations','claims','mappings','sourceArtifacts','reviewEvents','relations'];
export const emptyEvidence = () => ({schema:EVIDENCE_SCHEMA,dataVersion:'2.0.0',...Object.fromEntries(EVIDENCE_COLLECTIONS.map(key=>[key,[]]))});
export const missing = (reason='Not extracted from the source',state='not-extracted',sourceRefs=[]) => ({state,reason,sourceRefs});
export const reported = (value,sourceRefs) => ({state:'reported',value,sourceRefs});
const bi = (en) => ({en,zh:en});
const refsOf = row => Array.isArray(row?.sourceRefs) ? row.sourceRefs.map(s=>typeof s==='string'?s:s?.url).filter(Boolean) : [row?.sourceUrl||row?.source].filter(Boolean);
const validDate = date => typeof date==='string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date.slice(0,10);
const validReview = event => !!event && typeof event.id==='string' && !!event.id.trim() && typeof event.subjectId==='string' && !!event.subjectId.trim() && ['extracted','source-checked','space-checked','human-reviewed'].includes(event.stage) && ['ai','human','unknown'].includes(event.actorType) && typeof event.actorName==='string' && typeof event.scope==='string' && typeof event.recordVersion==='string' && !!event.recordVersion.trim() && Array.isArray(event.sourceRefs) && event.sourceRefs.every(s=>typeof s==='string') && Array.isArray(event.limitations) && (event.stage!=='human-reviewed' || event.actorType==='human' && !!event.actorName.trim() && !/^(unknown|human|reviewer|anonymous|n\/a)$/i.test(event.actorName.trim()) && validDate(event.date) && !!event.scope.trim()) && (event.actorType==='unknown' || validDate(event.date) && !!event.scope.trim());

/** Aggregate only events for the subject selected by the caller. Stages do not imply one another. */
export function deriveReviewState(events=[]) {
  const valid=events.filter(validReview);
  return {extracted:valid.some(e=>e.stage==='extracted'),sourceChecked:valid.some(e=>e.stage==='source-checked'),spaceChecked:valid.some(e=>e.stage==='space-checked'),humanReviewed:valid.some(e=>e.stage==='human-reviewed'&&e.actorType==='human'),events:structuredClone(events),limitations:events.flatMap(e=>e?.limitations||[])};
}

/** Pure lossless v1 preview. No experiment boundary, template identity or reviewer is inferred. */
export function migrateEvidence(input,options={}) {
  let parsed=input;
  if(typeof input==='string') parsed=JSON.parse(input);
  if(parsed?.schema===EVIDENCE_SCHEMA){const report=validateEvidenceV2(parsed,options);if(!report.valid)throw Error(report.errors.join('\n'));return {value:report.value,warnings:report.warnings};}
  const report=validateEvidenceV1(parsed,options);if(!report.valid)throw Error(report.errors.join('\n'));
  const legacy=report.value,bundle=emptyEvidence(),warnings=[...report.warnings,'v1 migration preview: independent experiments, statistical fields and source artifacts require extraction; the original is retained in legacyV1.'];
  bundle.legacyV1=structuredClone(legacy);bundle.references=structuredClone(legacy.references);bundle.relations=structuredClone(legacy.relations);
  const migrationLimit=bi('Independent experiment boundary was not specified in v1; experimentId remains null. Source evidence material still needs to be attached; historical checking is not a fresh source audit.');
  for(const row of legacy.results){
    const sourceRefs=refsOf(row),claimId=`${row.id}:claim`;
    bundle.results.push({id:row.id,referenceId:row.referenceId,experimentId:null,recordVersion:'legacy-v1',contrast:structuredClone(row.condition),finding:structuredClone(row.finding),modalities:[...row.modalities],sample:{enrolled:missing(),included:missing(),perAnalysis:missing()},statistics:missing(),effectEstimate:missing(),correction:missing(),timeWindow:missing(),frequencyBand:missing(),locationIds:row.coordinates.map(c=>c.id),claimIds:[claimId],limitations:[structuredClone(row.limitations),migrationLimit],legacyV1:structuredClone(row)});
    bundle.claims.push({id:claimId,referenceId:row.referenceId,experimentId:null,resultId:row.id,text:structuredClone(row.finding),sourceRefs,limitations:[structuredClone(row.limitations)]});
    const eventFor=(subject,status,note)=>{if(status!=='source-checked')return;const ai=/\bAI\b|Codex|人工智能/i.test(typeof row.annotator==='string'?row.annotator:JSON.stringify(row.annotator));const dated=validDate(row.checkedAt);bundle.reviewEvents.push({id:`${subject}:legacy-source-check`,subjectId:subject,stage:'source-checked',actorType:ai&&dated?'ai':'unknown',actorName:typeof row.annotator==='string'?row.annotator:JSON.stringify(row.annotator),date:row.checkedAt||null,scope:typeof note==='string'?note:JSON.stringify(note),sourceRefs,limitations:[migrationLimit],recordVersion:'legacy-v1',legacyV1:{annotator:structuredClone(row.annotator),checkedAt:row.checkedAt||null,scope:structuredClone(note)}});};
    eventFor(row.id,row.curationStatus,row.curationNote||'Legacy source-check scope was not specified');
    for(const c of row.coordinates){bundle.locations.push({id:c.id,resultId:row.id,kind:c.kind||'other',sourceLabel:structuredClone(c.label),sourceSpaceId:c.space,xyz:[c.x,c.y,c.z],unit:'mm',uncertainty:{kind:'unknown',reason:'Localization error was not extracted; group dispersion is not localization error',unit:'mm',sourceRefs:[c.sourceUrl]},sourceRefs:[c.sourceUrl],derivedAsset:null,transformRef:null,legacyV1:structuredClone(c)});eventFor(c.id,c.status,[c.sourceTable,c.sourceRow].map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' / '));}
  }
  for(const reading of legacy.readings||legacy.literaturePapers||[]){
    const sourceRefs=refsOf(reading.methodProvenance?{source:reading.methodProvenance.source}:reading),id=reading.id,claimId=`${id}:reading-claim`,referenceId=reading.referenceId||id;
    bundle.readings.push({id,referenceId,resultSummaries:structuredClone(reading.resultSummaries),methodProvenance:structuredClone(reading.methodProvenance),limitations:structuredClone(reading.limitations),claimIds:[claimId],legacyV1:structuredClone(reading)});
    bundle.claims.push({id:claimId,referenceId,experimentId:null,resultId:null,text:structuredClone(reading.resultSummaries),sourceRefs,limitations:[structuredClone(reading.limitations)]});
    // E1 mappings retain their original identity and support. They are not result locations.
    for(const mapping of reading.mappedRegions||[])bundle.mappings.push({...structuredClone(mapping),claimId});
  }
  return {value:bundle,warnings};
}

/** Sole display adapter. legacyV1 is a fallback for text, never authority for space or review. */
export function getResultViewModel(resultId,bundle) {
  const r=bundle.results.find(row=>row.id===resultId);if(!r)return null;
  const old=r.legacyV1||{},experiment=bundle.experiments.find(e=>e.id===r.experimentId),claims=bundle.claims.filter(c=>r.claimIds.includes(c.id));
  const reviewState=deriveReviewState(bundle.reviewEvents.filter(e=>e.subjectId===r.id&&(!r.recordVersion||e.recordVersion===r.recordVersion)));
  const coordinates=r.locationIds.map(id=>bundle.locations.find(l=>l.id===id)).filter(Boolean).map(l=>{
    const state=deriveReviewState(bundle.reviewEvents.filter(e=>e.subjectId===l.id&&(!l.recordVersion||e.recordVersion===l.recordVersion)));
    return {...(l.legacyV1||{}),id:l.id,label:l.sourceLabel,x:l.xyz[0],y:l.xyz[1],z:l.xyz[2],space:l.sourceSpaceId,kind:l.kind,sourceUrl:l.sourceRefs[0]||'',status:state.sourceChecked?'source-checked':'draft',uncertainty:structuredClone(l.uncertainty)};
  });
  return {...old,id:r.id,referenceId:resultReferenceId(r,bundle),finding:r.finding,condition:r.contrast,sample:old.sample||bi(r.sample?.perAnalysis?.state==='reported'?`n = ${r.sample.perAnalysis.value}`:r.sample?.perAnalysis?.reason||'Sample not extracted'),roiDefinition:old.roiDefinition||bi('ROI definition not extracted'),direction:old.direction||bi(r.statistics.reason||'Statistics not extracted'),modalities:r.modalities,topics:old.topics||[],coordinates,regionIds:old.regionIds||bundle.mappings.filter(m=>m.resultId===r.id).map(m=>m.targetConceptId).filter(Boolean),figures:old.figures||[],sourceUrl:old.sourceUrl||claims.flatMap(c=>c.sourceRefs)[0]||'',limitations:old.limitations||bi((r.limitations||[]).map(v=>typeof v==='string'?v:v.en||v.zh).join(' ')),reviewState,curationStatus:reviewState.sourceChecked?'source-checked':'draft'};
}

/** Validate explicit editor action, never a claim inferred from inherited status fields. */
export function validateSourceCheckIntent(intent,record) {
  if(!intent||typeof intent!=='object'||typeof intent.result!=='boolean'||!Array.isArray(intent.coordinateIds)||intent.coordinateIds.some(id=>typeof id!=='string'))throw Error('Source-check intent must name the result and coordinate selections');
  if(!['ai','human','unknown'].includes(intent.actorType)||typeof intent.actorName!=='string'||!intent.actorName.trim()||!validDate(intent.date)||typeof intent.scope!=='string'||!intent.scope.trim())throw Error('Supply the current source reviewer/tool name, actor type, valid date and checked scope');
  if(intent.stage&&intent.stage!=='source-checked')throw Error('The editor records source checks only');
  if(intent.result&&record.curationStatus!=='source-checked')throw Error('The finding must be explicitly marked source-checked');
  for(const id of intent.coordinateIds)if(!record.coordinates.some(c=>c.id===id&&c.status==='source-checked'))throw Error(`Coordinate ${id} must be explicitly marked source-checked`);
  return intent;
}

/** Convert an existing editor's text fields at this boundary, retaining structured fields it cannot edit. */
export function resultViewModelToEvidence(record,bundle,options={}) {
  const clean=structuredClone(record);delete clean.reviewState;
  const converted=migrateEvidence({schema:LEGACY_SCHEMA,references:[],results:[clean],relations:[]},options).value;
  const previous=bundle?.results.find(r=>r.id===record.id);
  for(const location of converted.locations){const original=bundle?.locations.find(l=>l.id===location.id);if(original&&original.sourceSpaceId===location.sourceSpaceId&&JSON.stringify(original.xyz)===JSON.stringify(location.xyz)&&JSON.stringify(original.sourceLabel)===JSON.stringify(location.sourceLabel)&&original.sourceRefs[0]===location.sourceRefs[0]){for(const key of ['uncertainty','dispersion','derivedAsset','transformRef','sourceRefs'])if(Object.hasOwn(original,key))location[key]=structuredClone(original[key]);}}
  if(previous){const next=converted.results[0];for(const key of ['experimentId','statistics','effectEstimate','correction','timeWindow','frequencyBand','sample'])next[key]=structuredClone(previous[key]);next.claimIds=[...new Set([...previous.claimIds,...next.claimIds])];converted.claims=[...bundle.claims.filter(c=>previous.claimIds.includes(c.id)&&!converted.claims.some(n=>n.id===c.id)),...converted.claims];if(previous.experimentId)converted.experiments=bundle.experiments.filter(e=>e.id===previous.experimentId);}
  const version=`edit-${globalThis.crypto.randomUUID()}`;
  converted.results[0].recordVersion=version;
  for(const location of converted.locations)location.recordVersion=version;
  // Status fields are display projections, not a fresh review authorization.
  // Preserve actual history verbatim; only a separately supplied ReviewEvent
  // for the new version can certify the edited result or its locations.
  const subjects=new Set([record.id,...converted.locations.map(l=>l.id)]);
  converted.reviewEvents=structuredClone((bundle?.reviewEvents||[]).filter(e=>subjects.has(e.subjectId)));
  if(options.reviewIntent){
    const intent=validateSourceCheckIntent(options.reviewIntent,record);
    const checkedSubjects=[...(intent.result?[record.id]:[]),...new Set(intent.coordinateIds)];
    for(const subjectId of checkedSubjects){
      const coordinate=record.coordinates.find(c=>c.id===subjectId);
      converted.reviewEvents.push({id:`${subjectId}:source-check:${version}`,subjectId,stage:'source-checked',actorType:intent.actorType,actorName:intent.actorName,date:intent.date,scope:intent.scope,sourceRefs:[coordinate?.sourceUrl||record.sourceUrl],limitations:[bi('Source checking records only the supplied scope; it does not certify study quality, spatial alignment or expert/human review.')],recordVersion:version});
    }
  }
  return converted;
}

/** Resolve the paper through the same graph used by result display. */
function resultReferenceId(result,bundle) {
  return result.referenceId||bundle.experiments.find(e=>e.id===result.experimentId)?.referenceId||bundle.claims.find(c=>result.claimIds.includes(c.id))?.referenceId||null;
}

/** Remove explicitly selected local records and their dependent edges. */
export function removeEvidenceRecords(bundle,{referenceIds=[],resultIds=[],retainedResultIds=[]}={}) {
  const next=structuredClone(bundle),references=new Set(referenceIds),results=new Set(resultIds),retained=new Set(retainedResultIds);
  const experiments=new Set(bundle.experiments.filter(e=>references.has(e.referenceId)).map(e=>e.id));
  for(const r of bundle.results)if(references.has(resultReferenceId(r,bundle)))results.add(r.id);
  const claims=new Set(bundle.claims.filter(c=>references.has(c.referenceId)||experiments.has(c.experimentId)||results.has(c.resultId)).map(c=>c.id));
  const dependent=row=>references.has(row.referenceId)||references.has(row.sourceReferenceId)||experiments.has(row.experimentId)||results.has(row.resultId)||claims.has(row.claimId);
  next.references=next.references.filter(r=>!references.has(r.id));
  next.results=next.results.filter(r=>!results.has(r.id));
  next.experiments=next.experiments.filter(e=>!experiments.has(e.id));
  next.readings=next.readings.filter(r=>!references.has(r.referenceId));
  next.locations=next.locations.filter(l=>!results.has(l.resultId));
  next.claims=next.claims.filter(c=>!claims.has(c.id));
  next.mappings=next.mappings.filter(m=>!dependent(m));
  next.sourceArtifacts=next.sourceArtifacts.filter(a=>!dependent(a));
  for(const row of [...next.results,...next.readings])row.claimIds=row.claimIds.filter(id=>!claims.has(id));
  // A built-in override can disappear locally while its endpoint survives in
  // the built-in bundle. Its independently authored relations must survive.
  const deletedEndpoint=id=>results.has(id)&&!retained.has(id);
  next.relations=next.relations.filter(r=>!deletedEndpoint(r.fromResultId)&&!deletedEndpoint(r.toResultId));
  const removedSubjects=new Set(EVIDENCE_COLLECTIONS.filter(k=>k!=='reviewEvents').flatMap(k=>bundle[k].filter(r=>!next[k].some(n=>n.id===r.id)).map(r=>r.id)));
  next.reviewEvents=next.reviewEvents.filter(e=>!removedSubjects.has(e.subjectId));
  return next;
}

export function validateEvidenceV2(input,options={}) {
  try{return validateEvidenceV2Model(input,options);}
  catch(error){return {valid:false,errors:[`Malformed evidence: ${String(error.message||error)}`],warnings:[],value:null};}
}

function validateEvidenceV2Model(input,{knownReferences=[],knownResults=[],knownRegions}={}) {
  const errors=[],warnings=[];let value=input;
  if(typeof input==='string'){try{value=JSON.parse(input);}catch{return {valid:false,errors:['Invalid JSON'],warnings,value:null};}}
  if(!value||typeof value!=='object'||Array.isArray(value))return {valid:false,errors:['Evidence must be an object'],warnings,value:null};
  if(value.schema!==EVIDENCE_SCHEMA)errors.push(`schema must be ${EVIDENCE_SCHEMA}`);
  for(const key of EVIDENCE_COLLECTIONS)if(!Array.isArray(value[key]))errors.push(`${key} must be an array`);
  if(errors.length)return {valid:false,errors,warnings,value:null};
  if(typeof value.dataVersion!=='string'||!value.dataVersion.trim())errors.push('dataVersion is required');
  if(EVIDENCE_COLLECTIONS.reduce((n,k)=>n+value[k].length,0)>10000)errors.push('Maximum 10,000 records per package');
  const identifiers=new Map();
  for(const key of EVIDENCE_COLLECTIONS){const seen=new Set();for(const row of value[key]){if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(`${key}: expected object`);continue;}if(typeof row.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(row.id))errors.push(`${key}: invalid identifier`);if(seen.has(row.id))errors.push(`${key}: duplicate id ${row.id}`);seen.add(row.id);}identifiers.set(key,seen);}
  if(errors.length)return {valid:false,errors,warnings,value:null};
  const ids=rows=>new Set(rows.map(r=>typeof r==='string'?r:r.id));const references=new Set([...identifiers.get('references'),...ids(knownReferences)]),results=new Set([...identifiers.get('results'),...ids(knownResults)]),subjects=new Set(EVIDENCE_COLLECTIONS.filter(k=>k!=='reviewEvents').flatMap(k=>[...identifiers.get(k)]));
  const link=(id,set,path,nullable=false)=>{if(!(nullable&&id===null)&&!set.has(id))errors.push(`${path}: unknown reference ${id}`);};
  const strings=(v,p)=>{if(!Array.isArray(v)||v.some(s=>typeof s!=='string'||!s.trim()))errors.push(`${p}: expected string array`);};
  const refs=(v,p,required=false)=>{strings(v,p);if(required&&(!Array.isArray(v)||!v.length))errors.push(`${p}: a source reference is required`);if(Array.isArray(v))for(const ref of v)if(typeof ref==='string'&&!safeSourceURL(ref)&&!identifiers.get('sourceArtifacts').has(ref))errors.push(`${p}: source must resolve to an artifact or an http(s) anchor`);};
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const report=(r,p,check)=>{if(!r||typeof r!=='object'){errors.push(`${p}: Reported value required`);return;}refs(r.sourceRefs,`${p}.sourceRefs`,r.state==='reported');if(r.state==='reported'){if(!check(r.value))errors.push(`${p}: invalid reported value`);}else if(!['not-reported','not-extracted','uncertain','not-applicable'].includes(r.state)||typeof r.reason!=='string'||!r.reason.trim()||Object.hasOwn(r,'value'))errors.push(`${p}: explicit missing state and reason required without a substituted value`);};
  // Reuse the original bibliography/relation checks rather than relaxing their safety contract.
  const metadataReport=validateEvidenceV1({schema:LEGACY_SCHEMA,references:value.references,results:[],relations:value.relations},{knownReferences:[...knownReferences,...value.references],knownResults:[...knownResults,...value.results]});errors.push(...metadataReport.errors);
  for(const e of value.experiments){link(e.referenceId,references,`${e.id}.referenceId`);if(!hasText(e.task)||typeof e.species!=='string'||!e.species.trim())errors.push(`${e.id}: task and explicit species required`);strings(e.modalities,`${e.id}.modalities`);refs(e.sourceRefs,`${e.id}.sourceRefs`);for(const k of ['enrolled','included','perAnalysis'])report(e.sample?.[k],`${e.id}.sample.${k}`,v=>Number.isInteger(v)&&v>0);}
  for(const r of value.results){
    if(r.referenceId!=null)link(r.referenceId,references,`${r.id}.referenceId`);link(r.experimentId,identifiers.get('experiments'),`${r.id}.experimentId`,true);
    if(r.experimentId===null&&!r.referenceId&&!value.claims.some(c=>c.resultId===r.id))errors.push(`${r.id}: source paper cannot be resolved`);
    for(const k of ['finding','contrast'])if(!hasText(r[k])||!text(r[k]))errors.push(`${r.id}.${k}: text required`);
    strings(r.modalities,`${r.id}.modalities`);if(!r.modalities?.length)errors.push(`${r.id}.modalities: choose at least one modality`);
    strings(r.locationIds,`${r.id}.locationIds`);strings(r.claimIds,`${r.id}.claimIds`);for(const id of Array.isArray(r.locationIds)?r.locationIds:[]){link(id,identifiers.get('locations'),`${r.id}.locationIds`);if(value.locations.some(l=>l.id===id&&l.resultId!==r.id))errors.push(`${r.id}: location belongs to a different result`);}for(const id of Array.isArray(r.claimIds)?r.claimIds:[])link(id,identifiers.get('claims'),`${r.id}.claimIds`);
    if(!Array.isArray(r.limitations))errors.push(`${r.id}.limitations: expected array`);
    if(r.sample)for(const k of ['enrolled','included','perAnalysis'])report(r.sample[k],`${r.id}.sample.${k}`,v=>Number.isInteger(v)&&v>0);
    report(r.statistics,`${r.id}.statistics`,statistics=>{
      if(!Array.isArray(statistics)||!statistics.length)return false;
      let valid=true;
      statistics.forEach((statistic,index)=>{
        const path=`${r.id}.statistics.value[${index}]`;
        if(!statistic||typeof statistic!=='object'||Array.isArray(statistic)){errors.push(`${path}: expected statistic object`);valid=false;return;}
        const before=errors.length;
        refs(statistic.sourceRefs,`${path}.sourceRefs`,true);
        const shape=typeof statistic.type==='string'&&!!statistic.type.trim()&&finite(statistic.value)
          &&(statistic.df===null||finite(statistic.df)||Array.isArray(statistic.df)&&statistic.df.every(finite))
          &&typeof statistic.unit==='string'&&!!statistic.unit.trim()
          &&(statistic.p===null||statistic.p&&typeof statistic.p==='object'&&!Array.isArray(statistic.p)&&['=','<','>'].includes(statistic.p.operator)&&finite(statistic.p.value)&&statistic.p.value>=0&&statistic.p.value<=1);
        if(!shape){errors.push(`${path}: invalid statistic fields`);valid=false;}
        if(errors.length!==before)valid=false;
      });
      return valid;
    });
    report(r.correction,`${r.id}.correction`,v=>v&&typeof v.method==='string'&&!!v.method.trim()&&typeof v.comparisonFamily==='string'&&!!v.comparisonFamily.trim()&&(typeof v.passed==='boolean'||v.passed===null)&&v.threshold&&['=','<','>','<=','>='].includes(v.threshold.operator)&&finite(v.threshold.value)&&v.threshold.value>=0&&v.threshold.value<=1);
    report(r.timeWindow,`${r.id}.timeWindow`,v=>v&&finite(v.start)&&finite(v.end)&&v.end>=v.start&&v.unit==='ms');
    report(r.frequencyBand,`${r.id}.frequencyBand`,v=>v&&finite(v.min)&&finite(v.max)&&v.min>=0&&v.max>=v.min&&v.unit==='Hz');
    report(r.effectEstimate,`${r.id}.effectEstimate`,v=>{if(!v||typeof v.type!=='string'||!v.type.trim()||!finite(v.value)||typeof v.unit!=='string'||!v.unit.trim())return false;report(v.variance,`${r.id}.effectEstimate.variance`,n=>finite(n)&&n>=0);report(v.interval,`${r.id}.effectEstimate.interval`,n=>n&&finite(n.level)&&n.level>0&&n.level<1&&finite(n.lower)&&finite(n.upper)&&n.lower<=n.upper&&typeof n.unit==='string'&&!!n.unit.trim());return true;});
    // Legacy text and figures remain validated, and never supply missing v2 spatial fields.
    if(r.legacyV1){const old=validateEvidenceV1({schema:LEGACY_SCHEMA,references:[],results:[{...r.legacyV1,referenceId:r.referenceId}],relations:[]},{knownReferences:[...knownReferences,...value.references],knownResults,knownRegions});errors.push(...old.errors);warnings.push(...old.warnings);}
  }
  for(const l of value.locations){link(l.resultId,results,`${l.id}.resultId`);const owner=value.results.find(r=>r.id===l.resultId);if(owner&&(!Array.isArray(owner.locationIds)||!owner.locationIds.includes(l.id)))errors.push(`${l.id}: location absent from owning result`);if(!['peak','roi-mean','stimulation-target','electrode','other'].includes(l.kind)||!hasText(l.sourceLabel))errors.push(`${l.id}: location kind/label required`);if(!COORDINATE_SPACES.includes(l.sourceSpaceId))errors.push(`${l.id}: explicit supported source space required`);if(l.unit!=='mm'||!Array.isArray(l.xyz)||l.xyz.length!==3||!l.xyz.every(n=>finite(n)&&Math.abs(n)<=300))errors.push(`${l.id}: finite mm xyz within ±300 required`);refs(l.sourceRefs,`${l.id}.sourceRefs`,true);if(!l.uncertainty||!['sd','se','ci','localization-error','not-reported','unknown'].includes(l.uncertainty.kind)||l.uncertainty.unit!=='mm')errors.push(`${l.id}.uncertainty: explicit kind and mm required`);else if(['unknown','not-reported'].includes(l.uncertainty.kind)){if(typeof l.uncertainty.reason!=='string'||!l.uncertainty.reason.trim())errors.push(`${l.id}.uncertainty: missing reason required`);}else if(!(finite(l.uncertainty.value)&&l.uncertainty.value>=0)&&!(Array.isArray(l.uncertainty.value)&&l.uncertainty.value.length===3&&l.uncertainty.value.every(n=>finite(n)&&n>=0)))errors.push(`${l.id}.uncertainty: numeric value required`);if(l.uncertainty)refs(l.uncertainty.sourceRefs,`${l.id}.uncertainty.sourceRefs`);if(l.dispersion)report(l.dispersion,`${l.id}.dispersion`,v=>v&&['sd','se','ci'].includes(v.kind)&&v.unit==='mm'&&Array.isArray(v.value)&&v.value.length===3&&v.value.every(n=>finite(n)&&n>=0));if(l.derivedAsset!==null&&(!l.derivedAsset||typeof l.derivedAsset.id!=='string'||!l.derivedAsset.id||typeof l.derivedAsset.version!=='string'||!l.derivedAsset.version||!/^[a-f\d]{64}$/i.test(l.derivedAsset.sha256)||!(l.derivedAsset.spaceId===null||typeof l.derivedAsset.spaceId==='string'&&l.derivedAsset.spaceId.trim())))errors.push(`${l.id}.derivedAsset: invalid AssetIdentity`);if(l.transformRef!==null&&(typeof l.transformRef!=='string'||!l.transformRef.trim()))errors.push(`${l.id}.transformRef: explicit identity or null required`);if(l.sourceSpaceId!=='MNI152NLin6Asym')warnings.push(`${l.id}: independent coordinate frame; no automatic atlas overlay`);}
  for(const c of value.claims){link(c.referenceId,references,`${c.id}.referenceId`);link(c.experimentId,identifiers.get('experiments'),`${c.id}.experimentId`,true);link(c.resultId,results,`${c.id}.resultId`,true);if(!hasText(c.text))errors.push(`${c.id}.text: required`);refs(c.sourceRefs,`${c.id}.sourceRefs`);if(!Array.isArray(c.limitations))errors.push(`${c.id}.limitations: expected array`);}
  for(const r of value.readings){link(r.referenceId,references,`${r.id}.referenceId`);if(!hasText(r.resultSummaries)||!r.methodProvenance||!hasText(r.limitations))errors.push(`${r.id}: reading summary, method provenance and limits required`);strings(r.claimIds,`${r.id}.claimIds`);for(const id of Array.isArray(r.claimIds)?r.claimIds:[])link(id,identifiers.get('claims'),`${r.id}.claimIds`);}
  for(const m of value.mappings){link(m.referenceId,references,`${m.id}.referenceId`);if(m.claimId!=null)link(m.claimId,identifiers.get('claims'),`${m.id}.claimId`);if(m.resultId!=null)link(m.resultId,results,`${m.id}.resultId`);const classified=classifyMapping(m);if(m.support!==classified.support||m.directEvidence!==classified.directEvidence||m.mappingKind!==classified.mappingKind)errors.push(`${m.id}: mapping must preserve E1 species and support classification`);}
  for(const e of value.reviewEvents){if(!validReview(e))errors.push(`${e.id}: invalid review event; human review requires a real human name, date, scope and record version`);refs(e.sourceRefs,`${e.id}.sourceRefs`);link(e.subjectId,subjects,`${e.id}.subjectId`);}
  return {valid:errors.length===0,errors,warnings:[...new Set(warnings)],value:errors.length?null:structuredClone(value)};
}

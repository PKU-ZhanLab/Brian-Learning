// Offline Node tooling. Runtime views consume only the versioned JSON artifacts.
// Hashes establish byte identity; semantic comparisons establish only the listed
// transcription checks. Neither establishes scientific quality or human review.
import {createHash} from 'node:crypto';

export const canonicalSourceJSON=value=>JSON.stringify(value&&typeof value==='object'
  ?Array.isArray(value)?value.map(item=>JSON.parse(canonicalSourceJSON(item)))
    :Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(canonicalSourceJSON(value[key]))]))
  :value);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>/^[a-f0-9]{64}$/.test(value||'');
const url=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const text=value=>typeof value==='string'&&value.trim().length>0;
export const sourceExcerptBytes=artifact=>Buffer.from(canonicalSourceJSON(artifact.excerpt),'utf8');
export const sourceArtifactRecordHash=artifact=>{
  const {sha256,recordSha256,...record}=artifact;
  return digest(canonicalSourceJSON(record));
};

/** Source fields use collection/entity-ID/property/... paths. Entity IDs, unlike
 * array offsets, survive result/coordinate reorder. Remaining segments are own
 * properties and numeric array offsets; no expressions or executable selectors. */
export function sourceFieldValue(bundle,path){
  const [collection,id,...segments]=String(path).split('/');
  let value=Array.isArray(bundle?.[collection])?bundle[collection].find(row=>row.id===id):undefined;
  for(const key of segments){
    if(['__proto__','prototype','constructor'].includes(key)||value==null||!Object.hasOwn(value,key))return undefined;
    value=value[key];
  }
  return value;
}

function decodeField(field){
  if(field.encoding==='number'){
    const raw=field.rawText.replace(/[−–]/g,'-').trim();
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))throw Error('numeric source cell required');
    return Number(raw);
  }
  if(field.encoding==='text')return field.rawText;
  if(field.encoding==='normalization'&&text(field.rationale)&&Object.hasOwn(field,'normalizedValue'))return field.normalizedValue;
  throw Error('explicit text, number or explained normalization required');
}

/** `bytes` are canonical UTF-8 minimal-excerpt bytes, never full article bytes. */
export function verifySourceArtifact(artifact,bytes){
  const errors=[];
  if(!artifact||typeof artifact!=='object')return {valid:false,errors:['artifact missing']};
  for(const key of ['id','referenceId','doi','sourceVersion','retrievedAt','locator','rights'])if(!text(artifact[key]))errors.push(`${key}: required`);
  if(artifact.schema!=='source-artifact-v1'||!/-v\d+$/.test(artifact.id||''))errors.push('versioned source-artifact-v1 identity required');
  if(!url(artifact.sourceUrl))errors.push('sourceUrl: public https source required');
  if(!Number.isFinite(Date.parse(artifact.retrievedAt)))errors.push('retrievedAt: date required');
  if(!(artifact.sourceFileSha256===null||hash(artifact.sourceFileSha256)))errors.push('sourceFileSha256: observed digest or null required');
  try{if(!hash(artifact.sha256)||digest(bytes)!==artifact.sha256||digest(sourceExcerptBytes(artifact))!==artifact.sha256)errors.push('minimal excerpt SHA-256 mismatch');}catch{errors.push('minimal excerpt bytes unavailable');}
  try{if(!hash(artifact.recordSha256)||sourceArtifactRecordHash(artifact)!==artifact.recordSha256)errors.push('artifact record SHA-256 mismatch');}catch{errors.push('artifact record not serializable');}
  const cells=Array.isArray(artifact.excerpt?.cells)?artifact.excerpt.cells:[],fields=Array.isArray(artifact.fields)?artifact.fields:[],captures=Array.isArray(artifact.captures)?artifact.captures:[];
  if(!cells.length||new Set(cells.map(cell=>cell?.id)).size!==cells.length)errors.push('unique minimal source cells required');
  if(!fields.length)errors.push('field bindings required');
  if(!captures.length)errors.push('source capture provenance required');
  for(const capture of captures){
    if(!capture||typeof capture!=='object'){errors.push('invalid source capture');continue;}
    if(!text(capture.id)||!url(capture.sourceUrl)||!text(capture.sourceVersion)||!text(capture.retrievedAt)||!(capture.sourceFileSha256===null||hash(capture.sourceFileSha256)))errors.push('invalid source capture');
    if(capture.retrievalMethod==='rendered-source'&&capture.sourceFileSha256!==null)errors.push(`${capture.id}: rendered capture has no source-file bytes`);
  }
  for(const cell of cells){
    if(!cell||typeof cell!=='object'){errors.push('invalid source cell');continue;}
    if(!text(cell.id)||!text(cell.rawText)||cell.rawText.length>200||!text(cell.locator)||!captures.some(capture=>capture?.id===cell.captureId))errors.push(`${cell.id}: minimal text, locator and source capture required`);
  }
  const paths=new Set();
  for(const field of fields){
    if(!field||typeof field!=='object'){errors.push('invalid source field binding');continue;}
    const cell=cells.find(row=>row?.id===field.cellId);
    if(!cell||field.rawText!==cell.rawText||field.locator!==cell.locator)errors.push(`${field.path}: field/cell anchor mismatch`);
    if(!/^(references|results|locations)\/[^/]+\/.+/.test(field.path||'')||paths.has(field.path))errors.push(`${field.path}: unique stable field path required`);
    paths.add(field.path);
    try{decodeField(field);}catch(error){errors.push(`${field.path}: ${error.message}`);}
  }
  if(!Array.isArray(artifact.limitations)||!artifact.limitations.length||!Array.isArray(artifact.paraphrases))errors.push('limitations and separately labelled paraphrases required');
  return {valid:errors.length===0,errors};
}

export function auditTranscription(bundle,artifacts=bundle?.sourceArtifacts||[]){
  const integrityErrors=[],semanticReviewRequired=[],unavailableArtifacts=[],fields=new Set(),coordinates=[];
  const available=new Map();
  if(!Array.isArray(artifacts)){integrityErrors.push('artifact material must be an array');artifacts=[];}
  for(const artifact of artifacts){
    if(!artifact||typeof artifact!=='object'||!text(artifact.id)){integrityErrors.push('artifact material has no identity');continue;}
    if(available.has(artifact.id)){integrityErrors.push(`${artifact.id}: duplicate artifact identity`);continue;}
    available.set(artifact.id,artifact);
    let integrity;try{integrity=verifySourceArtifact(artifact,sourceExcerptBytes(artifact));}catch{integrity={valid:false,errors:['minimal excerpt material unavailable or malformed']};}
    integrityErrors.push(...integrity.errors.map(error=>`${artifact.id}: ${error}`));
    if(!integrity.valid)continue;
    for(const field of artifact.fields){
      const [collection,recordId]=field.path.split('/');
      // A paper-level excerpt may support several findings. A selected-result
      // package compares only extant records; required anchors for its actual
      // records are enforced below, so renaming a point cannot evade coverage.
      if(!bundle?.[collection]?.some(row=>row.id===recordId))continue;
      fields.add(field.path);
      const actual=sourceFieldValue(bundle,field.path),expected=decodeField(field);
      if(actual===undefined||canonicalSourceJSON(actual)!==canonicalSourceJSON(expected))semanticReviewRequired.push({artifactId:artifact.id,path:field.path,expected,actual:actual??null,locator:field.locator,reason:'transcribed field differs from the anchored minimal source cell'});
    }
  }
  for(const embedded of bundle?.sourceArtifacts||[]){
    const external=available.get(embedded.id);
    if(!external)unavailableArtifacts.push(embedded.id);
    else if(canonicalSourceJSON(embedded)!==canonicalSourceJSON(external))integrityErrors.push(`${embedded.id}: embedded/source artifact version mismatch`);
  }
  const requireField=(path,referenceId)=>{
    if(!fields.has(path)){
      if(![...available.values()].some(a=>a.referenceId===referenceId))unavailableArtifacts.push(`reference:${referenceId}`);
      else semanticReviewRequired.push({path,reason:'no verified source field anchor available'});
    }
  };
  const referenceIds=new Set((bundle?.results||[]).map(row=>row.referenceId).filter(Boolean));
  for(const referenceId of referenceIds){
    requireField(`references/${referenceId}/doi`,referenceId);
    requireField(`references/${referenceId}/url`,referenceId);
    const authors=sourceFieldValue(bundle,`references/${referenceId}/fullAuthorList`);
    for(let i=0;i<(authors?.length||1);i++)requireField(`references/${referenceId}/fullAuthorList/${i}`,referenceId);
  }
  for(const location of bundle?.locations||[]){
    const referenceId=bundle.results.find(row=>row.id===location.resultId)?.referenceId;
    const paths=[0,1,2].map(axis=>`locations/${location.id}/xyz/${axis}`);
    for(const tail of ['sourceSpaceId','sourceRefs/0','legacyV1/sourceTable'])paths.push(`locations/${location.id}/${tail}`);
    paths.forEach(path=>requireField(path,referenceId));
    if(paths.every(path=>fields.has(path)))coordinates.push(location.id);
    for(const ref of location.sourceRefs||[])if(!/^https?:\/\//.test(ref)&&!available.has(ref))unavailableArtifacts.push(ref);
  }
  const uncheckedReportedNumericFields=[];
  const numericLeaves=(value,path)=>{
    if(typeof value==='number'){if(!fields.has(path))uncheckedReportedNumericFields.push(path);return;}
    if(value&&typeof value==='object')for(const [key,nested] of Object.entries(value))if(key!=='sourceRefs')numericLeaves(nested,`${path}/${key}`);
  };
  for(const collection of ['results','locations'])for(const row of bundle?.[collection]||[]){
    const reportedLeaves=(value,path)=>{
      if(!value||typeof value!=='object')return;
      if(value.state==='reported'){numericLeaves(value.value,`${path}/value`);return;}
      for(const [key,nested] of Object.entries(value))if(!['legacyV1','sourceRefs'].includes(key))reportedLeaves(nested,`${path}/${key}`);
    };
    reportedLeaves(row,`${collection}/${row.id}`);
  }
  return {integrityErrors,semanticReviewRequired,unavailableArtifacts:[...new Set(unavailableArtifacts)],coverage:{coordinates,fields:[...fields].sort(),uncheckedReportedNumericFields:uncheckedReportedNumericFields.sort()},
    scope:'Only listed primary-source cells and explicit normalizations were compared offline; this is AI-assisted transcription checking, not full-text re-review, spatial validation or human certification.',humanReview:'pending'};
}

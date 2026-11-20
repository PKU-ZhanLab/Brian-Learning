// Offline Node tooling. Runtime views consume only the versioned JSON artifacts.
// Hashes establish byte identity; semantic comparisons establish only the listed
// transcription checks. Neither establishes scientific quality or human review.
import {createHash} from 'node:crypto';
import {validateReferenceAliases,resolveReferenceAlias} from './evidence-schema.js';

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
  const resolved=collection==='references'&&validateReferenceAliases(bundle).valid?resolveReferenceAlias(bundle,id):id;
  let value=Array.isArray(bundle?.[collection])?bundle[collection].find(row=>row.id===resolved):undefined;
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
  const aliases=validateReferenceAliases(bundle);integrityErrors.push(...aliases.errors);
  const canonicalReference=id=>aliases.valid?resolveReferenceAlias(bundle,id):id;
  const canonicalPath=path=>{const parts=path.split('/');if(parts[0]==='references')parts[1]=canonicalReference(parts[1]);return parts.join('/');};
  if(aliases.valid)for(const alias of bundle?.referenceAliases||[]){
    const current=bundle.references.find(r=>r.id===alias.canonicalId);
    if(current.title!==alias.originalReference.title)semanticReviewRequired.push({path:`references/${alias.canonicalId}/title`,reason:'Current title differs from the preserved original bibliography identity; source verification is required. This compares the historical identity snapshot, not an unavailable primary-source title cell.'});
  }
  const available=new Map(),verified=[];
  if(!Array.isArray(artifacts)){integrityErrors.push('artifact material must be an array');artifacts=[];}
  for(const artifact of artifacts){
    if(!artifact||typeof artifact!=='object'||!text(artifact.id)){integrityErrors.push('artifact material has no identity');continue;}
    if(available.has(artifact.id)){integrityErrors.push(`${artifact.id}: duplicate artifact identity`);continue;}
    available.set(artifact.id,artifact);
    let integrity;try{integrity=verifySourceArtifact(artifact,sourceExcerptBytes(artifact));}catch{integrity={valid:false,errors:['minimal excerpt material unavailable or malformed']};}
    integrityErrors.push(...integrity.errors.map(error=>`${artifact.id}: ${error}`));
    if(!integrity.valid)continue;
    verified.push(artifact);
  }
  const resultReference=result=>result?.referenceId||bundle?.experiments?.find(row=>row.id===result?.experimentId)?.referenceId||bundle?.claims?.find(row=>result?.claimIds?.includes(row.id))?.referenceId;
  const rowReference=(collection,row)=>collection==='references'?row.id:collection==='results'?resultReference(row):resultReference(bundle?.results?.find(result=>result.id===row.resultId));
  const artifactIds=refs=>new Set((Array.isArray(refs)?refs:[]).filter(ref=>{
    if(typeof ref!=='string'||/^https?:\/\//.test(ref))return false;
    if(!available.has(ref))unavailableArtifacts.push(ref);
    return true;
  }));
  const currentEvents=row=>artifactIds((bundle?.reviewEvents||[]).filter(event=>row.recordVersion&&event.subjectId===row.id&&event.recordVersion===row.recordVersion&&event.stage==='source-checked').flatMap(event=>event.sourceRefs||[]));
  const paperSelections=new Map();
  // Reference metadata can inherit an explicit selection from its current
  // findings/locations. Merely retaining an artifact in the index is never a
  // selection, and old review events never select for a new record version.
  for(const collection of ['results','locations'])for(const row of bundle?.[collection]||[]){
    const selected=new Set(),collect=node=>{
      if(!node||typeof node!=='object')return;
      for(const [key,value] of Object.entries(node)){
        if(key==='sourceRefs')for(const id of artifactIds(value))selected.add(id);
        else if(key!=='legacyV1')collect(value);
      }
    };
    collect(row);
    if(!selected.size)for(const id of currentEvents(row))selected.add(id);
    const referenceId=rowReference(collection,row),paper=paperSelections.get(referenceId)||new Set();
    for(const id of selected)paper.add(id);paperSelections.set(referenceId,paper);
  }
  const activeSources=(collection,row,segments)=>{
    let selected=new Set(),node=row;
    // The nearest explicit sourceRefs wins: e.g. a statistic's source can be
    // more specific than the result's, or a location can use a corrected v2
    // while another location from the same paper still uses v1.
    for(let i=0;i<=segments.length;i++){
      if(node&&typeof node==='object'){
        const ids=artifactIds(node.sourceRefs);if(ids.size)selected=ids;
      }
      if(i<segments.length)node=node?.[segments[i]];
    }
    if(!selected.size)selected=currentEvents(row);
    if(!selected.size&&collection==='references')selected=paperSelections.get(row.id)||new Set();
    return selected;
  };
  const activeArtifacts=new Set(),verifiedById=new Map(verified.map(artifact=>[artifact.id,artifact]));
  for(const artifact of verified){
    for(const field of artifact.fields){
      const [collection,recordId,...segments]=field.path.split('/');
      // A paper-level excerpt may support several findings. A selected-result
      // package compares only extant records; required anchors for its actual
      // records are enforced below, so renaming a point cannot evade coverage.
      const row=bundle?.[collection]?.find(row=>row.id===(collection==='references'?canonicalReference(recordId):recordId));if(!row)continue;
      // legacyV1 is retained historical data, never a required native-v2
      // provenance container. Native source locators live in artifact fields.
      if(segments[0]==='legacyV1'&&sourceFieldValue(bundle,field.path)===undefined)continue;
      const selected=activeSources(collection,row,segments);
      const applicable=[...selected].some(id=>verifiedById.get(id)?.fields.some(binding=>binding.path===field.path));
      if(!applicable){
        // Retaining a declared historical binding is evidence that this field
        // needs an explicit current source/version decision. Never turn that
        // unresolved decision into a successful audit by silently skipping it,
        // including nonnumeric fields such as corrected significance.
        semanticReviewRequired.push({artifactId:artifact.id,cellId:field.cellId,path:field.path,locator:field.locator,recordVersion:row.recordVersion??null,reasonCode:'unresolved-source-version',reason:'declared field binding has no applicable explicit current source/version selection or exact-current-version source event'});
      }
      if(!selected.has(artifact.id))continue;
      activeArtifacts.add(artifact.id);
      fields.add(field.path);
      fields.add(canonicalPath(field.path));
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
      if(![...available.values()].some(a=>canonicalReference(a.referenceId)===referenceId))unavailableArtifacts.push(`reference:${referenceId}`);
      else semanticReviewRequired.push({path,reason:'no verified source field anchor available'});
    }
  };
  const referenceIds=new Set((bundle?.results||[]).map(resultReference).filter(Boolean));
  for(const referenceId of referenceIds){
    requireField(`references/${referenceId}/doi`,referenceId);
    requireField(`references/${referenceId}/url`,referenceId);
    const authors=sourceFieldValue(bundle,`references/${referenceId}/fullAuthorList`);
    for(let i=0;i<(authors?.length||1);i++)requireField(`references/${referenceId}/fullAuthorList/${i}`,referenceId);
  }
  for(const location of bundle?.locations||[]){
    const referenceId=resultReference(bundle.results.find(row=>row.id===location.resultId));
    const paths=[0,1,2].map(axis=>`locations/${location.id}/xyz/${axis}`);
    paths.push(`locations/${location.id}/sourceSpaceId`);
    if(Object.hasOwn(location.legacyV1||{},'sourceTable'))paths.push(`locations/${location.id}/legacyV1/sourceTable`);
    // Legacy URL fields remain compared when bound. For a native record, a
    // selected artifact ID plus verified per-axis locators is sufficient; no
    // fixed URL-array offset or invented legacy snapshot is required.
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
  return {integrityErrors,semanticReviewRequired,unavailableArtifacts:[...new Set(unavailableArtifacts)],coverage:{coordinates,fields:[...fields].sort(),uncheckedReportedNumericFields:uncheckedReportedNumericFields.sort(),integrityCheckedArtifacts:verified.map(artifact=>artifact.id),currentComparedArtifacts:[...activeArtifacts]},
    scope:'Only listed primary-source cells and explicit normalizations were compared offline; this is AI-assisted transcription checking, not full-text re-review, spatial validation or human certification.',humanReview:'pending'};
}

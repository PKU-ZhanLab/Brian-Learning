/** @typedef {import('./research-contracts.js').Reported<string[]>} StudyModalities */
/** @typedef {{referenceId:string,resultIds:string[],matchedFields:string[]}} SearchHit */
/** @typedef {{resultId:string,normalizedText:string,modalities:string[],fields:Object<string,string>}} ResultSearchEntry */
/** @typedef {{referenceId:string,normalizedText:string,topics:string[],studyModalities:StudyModalities,resultEntries:ResultSearchEntry[],mappings:Object[],fields:Object<string,string>}} SearchEntry */
/** @typedef {{entries:SearchEntry[]}} SearchIndex */

// The display language never participates in normalization or field selection.
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\p{Dash_Punctuation}\u2212]+/gu,'');
const strings=value=>typeof value==='string'||typeof value==='number'?[String(value)]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?['zh','en'].flatMap(key=>strings(value[key])):[];
const unique=values=>[...new Set(values)];
const sourceURL=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}};
const sourced=record=>Array.isArray(record?.sourceRefs)&&record.sourceRefs.length>0&&record.sourceRefs.every(sourceURL);
const referenceOf=(row,bundle)=>row.referenceId||bundle.experiments?.find(experiment=>experiment.id===row.experimentId)?.referenceId;
const methodsOf=(reference,readings)=>{
  const explicit=reference.studyModalities??readings.find(row=>row.studyModalities)?.studyModalities;
  if(explicit){
    if(explicit.state==='reported'&&(!sourced(explicit)||!Array.isArray(explicit.value)||!explicit.value.length||explicit.value.some(value=>typeof value!=='string'||!value.trim())))return {state:'uncertain',reason:'Paper method values or source provenance are incomplete',sourceRefs:[]};
    return structuredClone(explicit);
  }
  // Existing reading methods carry independent curation provenance. Never
  // take paper methods from a result, mapping, title or abstract.
  const reading=readings.find(row=>Array.isArray(row.modalities)&&row.modalities.length&&sourceURL(row.methodProvenance?.source));
  return reading?{state:'reported',value:[...reading.modalities],sourceRefs:[reading.methodProvenance.source]}:{state:'not-extracted',reason:'Paper methods have not been extracted',sourceRefs:[]};
};
const textKeys=['title','titleZh','titleEn','abstract','summary','summaryEn','resultSummaries','finding','contrast','condition','limitations','roiDefinition','sourceLabel','sourceRow','label','name','en','authors','year','doi','pmid','id'];
const addRecord=(fields,prefix,row)=>{
  for(const key of textKeys){const values=strings(row?.[key]);if(values.length)fields[`${prefix}.${key}`]=values.join(' ');}
};
const normalizedFields=(fields,aliases)=>{
  const normalized=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,normalize(value)]));
  // Match against original fields, never cascade one alias into another group.
  const original=Object.values(normalized);
  for(const alias of aliases)if(alias.terms.some(term=>original.some(value=>value.includes(normalize(term)))))normalized[`aliases.${alias.id}`]=alias.terms.map(normalize).join(' ');
  return normalized;
};
const allText=fields=>Object.values(fields).join(' ');

/** Pure bilingual index. Aliases expand text only; mappings are copied unchanged.
 * @returns {SearchIndex}
 */
export function buildEvidenceSearchIndex(bundle,{aliases=[],regions=[]}={}){
  const groups=(Array.isArray(aliases)?aliases:aliases.aliases||[]).filter(alias=>sourced(alias)&&Array.isArray(alias.terms)&&alias.terms.length&&alias.terms.every(term=>typeof term==='string'&&normalize(term)));
  const catalog=Array.isArray(regions)?regions:Object.values(regions);
  return {entries:(bundle.references||[]).map(reference=>{
    const readings=(bundle.readings||[]).filter(row=>referenceOf(row,bundle)===reference.id);
    const results=(bundle.results||[]).filter(row=>referenceOf(row,bundle)===reference.id);
    const mappings=(bundle.mappings||[]).filter(row=>row.referenceId===reference.id).concat(readings.flatMap(row=>row.mappedRegions||[]));
    const fields={};addRecord(fields,'reference',reference);
    readings.forEach((row,i)=>{addRecord(fields,`readings.${i}`,row);addRecord(fields,`readings.${i}.legacyV1`,row.legacyV1);});
    (bundle.claims||[]).filter(row=>referenceOf(row,bundle)===reference.id).forEach((row,i)=>addRecord(fields,`claims.${i}`,{finding:row.text,limitations:row.limitations}));
    mappings.forEach((mapping,i)=>{
      addRecord(fields,`mappings.${i}.sourceRegion`,mapping.sourceRegion);
      addRecord(fields,`mappings.${i}`,mapping);
      addRecord(fields,`mappings.${i}.target`,catalog.find(region=>region.id===(mapping.targetConceptId||mapping.structureId)));
    });
    const resultEntries=results.map(result=>{
      const resultFields={};addRecord(resultFields,`results.${result.id}`,result);addRecord(resultFields,`results.${result.id}.legacyV1`,result.legacyV1);
      (bundle.locations||[]).filter(location=>location.resultId===result.id).forEach(location=>{
        addRecord(resultFields,`locations.${location.id}`,location);addRecord(resultFields,`locations.${location.id}.legacyV1`,location.legacyV1);
      });
      const normalized=normalizedFields(resultFields,groups);
      return {resultId:result.id,normalizedText:allText(normalized),modalities:[...(result.modalities||[])],fields:normalized};
    });
    const normalized=normalizedFields(fields,groups);
    return {referenceId:reference.id,normalizedText:[allText(normalized),...resultEntries.map(entry=>entry.normalizedText)].join(' '),topics:unique([...(reference.topics||[]),...readings.flatMap(row=>row.topics||[]),...results.flatMap(row=>row.topics||row.legacyV1?.topics||[])]),studyModalities:methodsOf(reference,readings),resultEntries,mappings:structuredClone(mappings),fields:normalized};
  })};
}

const sameRegion=(left,right)=>!!left&&['atlasId','atlasVersion','labelId','hemisphere','spaceId'].every(key=>left[key]===right[key]);
/** Paper methods restrict papers; result methods restrict returned result IDs.
 * @param {SearchIndex} index
 * @returns {SearchHit[]}
 */
export function searchEvidence(index,{query='',topic='',paperModality='',resultModality='',regionRef}={}){
  const term=normalize(query),hits=[];
  for(const entry of index.entries){
    if(topic&&!entry.topics.includes(topic))continue;
    if(paperModality&&!(entry.studyModalities?.state==='reported'&&sourced(entry.studyModalities)&&Array.isArray(entry.studyModalities.value)&&entry.studyModalities.value.includes(paperModality)))continue;
    if(regionRef&&!entry.mappings.some(mapping=>sameRegion(mapping.targetRegionRef,regionRef)))continue;
    const results=entry.resultEntries.filter(result=>!resultModality||result.modalities.includes(resultModality));
    if(resultModality&&!results.length)continue;
    const searchableFields=[...Object.entries(entry.fields),...results.flatMap(result=>Object.entries(result.fields))];
    const matchedFields=term?unique(searchableFields.filter(([,value])=>value.includes(term)).map(([key])=>key)):[];
    if(term&&!matchedFields.length)continue;
    hits.push({referenceId:entry.referenceId,resultIds:results.map(result=>result.resultId),matchedFields});
  }
  return hits;
}

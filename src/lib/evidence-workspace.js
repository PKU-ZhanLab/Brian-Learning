import {EVIDENCE_SCHEMA,EVIDENCE_COLLECTIONS,emptyEvidence,migrateEvidence,validateEvidenceV2,normalizeDOI,safeSourceURL} from './evidence-schema.js';
export {EVIDENCE_SCHEMA,emptyEvidence,normalizeDOI,safeSourceURL,COORDINATE_SPACES,CURATION_STATUSES} from './evidence-schema.js';
export const EVIDENCE_STORAGE_KEY='brain-model.evidence.v2';
export const LEGACY_EVIDENCE_STORAGE_KEY='brain-model.evidence.v1';
const doiID = doi => { let hash = 14695981039346656037n; for (const char of doi) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0))) * 1099511628211n); return `doi-${doi.replace(/[^a-z0-9]+/g,'-').slice(0,120)}-${hash.toString(16)}`; };

/** A v1 read is only an in-memory migration preview; validation never writes storage. */
export function validateEvidence(input,options={}) {
  try{const {value,warnings}=migrateEvidence(input,options),report=validateEvidenceV2(value,options);return {...report,warnings:[...new Set([...warnings,...report.warnings])]};}
  catch(error){return {valid:false,errors:[String(error.message||error)],warnings:[],value:null};}
}

/** DOI deduplication rewrites every active reference edge, including artifacts and review subjects. */
export function mergeEvidence(base,incoming,options={}) {
  const baseReport=validateEvidence(base,options);if(!baseReport.valid)throw Error(baseReport.errors.join('\n'));
  const previous=baseReport.value,context={...options,knownReferences:[...(options.knownReferences||[]),...previous.references],knownResults:[...(options.knownResults||[]),...previous.results]};
  const report=validateEvidence(incoming,context);if(!report.valid)throw Error(report.errors.join('\n'));
  const references=new Map(previous.references.map(r=>[r.id,r])),remap=new Map();
  for(const r of report.value.references){const doi=normalizeDOI(r.doi),duplicate=doi&&[...references.values(),...(options.knownReferences||[]).filter(r=>typeof r==='object')].find(old=>normalizeDOI(old.doi)===doi),id=duplicate?.id||r.id;remap.set(r.id,id);references.set(id,{...references.get(id),...r,id});}
  const rewrite=(node,key='')=>{
    if(Array.isArray(node))return node.map(n=>rewrite(n,key));
    if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,rewrite(v,k)]));
    return ['referenceId','sourceReferenceId','referenceIds','subjectId'].includes(key)&&typeof node==='string'?(remap.get(node)||node):node;
  };
  const next={...previous,schema:EVIDENCE_SCHEMA,dataVersion:report.value.dataVersion,references:[...references.values()]};
  const snapshots=[...(previous.legacyImports||[]),...(report.value.legacyImports||[]),...(report.value.legacyV1?[report.value.legacyV1]:[])];
  if(snapshots.length)next.legacyImports=[...new Map(snapshots.map(snapshot=>[JSON.stringify(snapshot),structuredClone(snapshot)])).values()];
  for(const key of EVIDENCE_COLLECTIONS.filter(k=>k!=='references'))next[key]=[...new Map([...previous[key],...rewrite(report.value[key])].map(r=>[r.id,r])).values()];
  // A replacement result owns its location list. Explicitly removed points must
  // not survive as orphaned current locations after an editor save.
  const replacements=new Map(report.value.results.map(r=>[r.id,r]));
  next.locations=next.locations.filter(l=>!replacements.has(l.resultId)||replacements.get(l.resultId).locationIds.includes(l.id));
  const subjects=new Set(EVIDENCE_COLLECTIONS.filter(k=>k!=='reviewEvents').flatMap(k=>next[k].map(r=>r.id)));
  next.reviewEvents=next.reviewEvents.filter(e=>subjects.has(e.subjectId));
  const validated=validateEvidenceV2(next,options);if(!validated.valid)throw Error(validated.errors.join('\n'));return validated.value;
}
export function loadEvidence(storage,options={}) {
  try{storage??=globalThis.localStorage;const raw=storage?.getItem(EVIDENCE_STORAGE_KEY)??storage?.getItem(LEGACY_EVIDENCE_STORAGE_KEY);if(!raw)return emptyEvidence();const report=validateEvidence(raw,options);if(!report.valid)throw Error(report.errors.join('; '));return report.value;}
  catch(error){return {...emptyEvidence(),storageError:String(error.message||error)};}
}
export function saveEvidence(input,storage,options={}) {
  const report=validateEvidence(input,options);if(!report.valid)throw Error(report.errors.join('\n'));storage??=globalThis.localStorage;if(!storage)throw Error('Local storage is unavailable');storage.setItem(EVIDENCE_STORAGE_KEY,JSON.stringify(report.value));return report.value;
}

function crossrefReference(item) {
  const doi = normalizeDOI(item.DOI), year = item.published?.['date-parts']?.[0]?.[0] || item.issued?.['date-parts']?.[0]?.[0];
  const authors = (item.author || []).map(a => [a.given,a.family].filter(Boolean).join(' ') || a.name).filter(Boolean);
  return {id: doiID(doi), title: item.title?.[0] || doi, authors: authors.join(', '), fullAuthorList: authors, year, journal: item['container-title']?.[0] || '', volume: item.volume || '', pages: item.page || item['article-number'] || '', doi, url: `https://doi.org/${doi}`, verificationStatus: 'metadata-only', metadataSources: [`https://api.crossref.org/works/${encodeURIComponent(doi)}`]};
}
function europeReference(item) { const doi = normalizeDOI(item.doi); return {id: doi ? doiID(doi) : `epmc-${item.source}-${item.id}`, title: item.title, authors: item.authorString || '', year: Number(item.pubYear) || undefined, journal: item.journalTitle || item.journalInfo?.journal?.title || '', doi, pmid: item.source === 'MED' ? item.id : '', pmcid: item.pmcid || '', url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${item.source}/${item.id}`, verificationStatus: 'metadata-only', metadataSources: [`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`EXT_ID:${item.id} AND SRC:${item.source}`)}&format=json`]}; }
async function fetchJSON(url, fetcher, signal) { const response = await fetcher(url, {signal, headers: {Accept: 'application/json'}}); if (!response.ok) throw new Error(`Metadata service: HTTP ${response.status}`); return response.json(); }
/** Uses public APIs. A successful lookup adds metadata only, never findings or coordinates. */
export async function lookupPaperMetadata(query, {provider = 'crossref', fetcher = globalThis.fetch, signal} = {}) {
  const term = String(query || '').trim(); if (!term) throw new Error('Enter a DOI or title / 请填写 DOI 或标题');
  const doi = normalizeDOI(term), isDOI = /^10\.\d{4,9}\/\S+$/i.test(doi);
  if (provider === 'crossref') {
    try { const url = isDOI ? `https://api.crossref.org/works/${encodeURIComponent(doi)}` : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(term)}&rows=8`; const data = await fetchJSON(url, fetcher, signal); return (isDOI ? [data.message] : data.message.items).map(crossrefReference); }
    catch (error) { if (!isDOI || signal?.aborted) throw error; }
  }
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(isDOI ? `DOI:${doi}` : term)}&format=json&resultType=core&pageSize=8`;
  const data = await fetchJSON(url, fetcher, signal); return (data.resultList?.result || []).map(europeReference);
}

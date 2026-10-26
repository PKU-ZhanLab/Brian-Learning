export const EVIDENCE_SCHEMA = 'brain-evidence-v1';
export const EVIDENCE_STORAGE_KEY = 'brain-model.evidence.v1';
export const COORDINATE_SPACES = ['MNI-unspecified', 'MNI152NLin6Asym', 'MNI152NLin2009cAsym', 'Talairach', 'subject-native', 'other'];
export const CURATION_STATUSES = ['draft', 'source-checked'];
export const emptyEvidence = () => ({schema: EVIDENCE_SCHEMA, references: [], results: [], relations: []});
export const safeSourceURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
export const normalizeDOI = value => String(value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
const doiID = doi => { let hash = 14695981039346656037n; for (const char of doi) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0))) * 1099511628211n); return `doi-${doi.replace(/[^a-z0-9]+/g,'-').slice(0,120)}-${hash.toString(16)}`; };
const hasText = value => typeof value === 'string' ? value.trim().length > 0 : value && typeof value === 'object' && ['zh', 'en'].some(k => typeof value[k] === 'string' && value[k].trim());
const text = value => typeof value === 'string' || (value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([k,v]) => ['zh','en'].includes(k) && typeof v === 'string'));

/** Validation never promotes a record's curation status. knownReferences/knownResults may be IDs or records. */
export function validateEvidence(input, {knownReferences = [], knownResults = [], knownRegions} = {}) {
  const errors = [], warnings = [];
  let value = input;
  if (typeof input === 'string') { try { value = JSON.parse(input); } catch { return {valid: false, errors: ['Invalid JSON / JSON 格式不正确'], warnings, value: null}; } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {valid: false, errors: ['Evidence must be an object / 证据包必须是对象'], warnings, value: null};
  if (value.schema !== EVIDENCE_SCHEMA) errors.push(`schema must be ${EVIDENCE_SCHEMA}`);
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

/** Upserts by ID, deduplicates papers by DOI, and rewrites incoming result paper IDs. Throws on invalid input. */
export function mergeEvidence(base, incoming, options = {}) {
  const report = validateEvidence(incoming, {...options, knownReferences: [...(options.knownReferences || []), ...base.references], knownResults: [...(options.knownResults || []), ...base.results]});
  if (!report.valid) throw new Error(report.errors.join('\n'));
  const references = new Map(base.references.map(r => [r.id, r])), remap = new Map();
  for (const r of report.value.references) { const duplicate = r.doi && [...references.values(), ...(options.knownReferences || []).filter(x => typeof x === 'object')].find(old => normalizeDOI(old.doi) === normalizeDOI(r.doi)); const id = duplicate?.id || r.id; remap.set(r.id, id); references.set(id, {...references.get(id), ...r, id}); }
  const upsert = (old, next) => [...new Map([...old, ...next].map(r => [r.id, r])).values()];
  return {schema: EVIDENCE_SCHEMA, references: [...references.values()], results: upsert(base.results, report.value.results.map(r => ({...r, referenceId: remap.get(r.referenceId) || r.referenceId}))), relations: upsert(base.relations, report.value.relations)};
}

export function loadEvidence(storage, options = {}) {
  try { storage ??= globalThis.localStorage; const raw = storage?.getItem(EVIDENCE_STORAGE_KEY); if (!raw) return emptyEvidence(); const report = validateEvidence(raw, options); if (!report.valid) throw new Error(report.errors.join('; ')); return report.value; } catch (error) { return {...emptyEvidence(), storageError: String(error.message || error)}; }
}
export function saveEvidence(value, storage, options = {}) {
  const report = validateEvidence(value, options); if (!report.valid) throw new Error(report.errors.join('\n')); storage ??= globalThis.localStorage; if (!storage) throw new Error('Local storage is unavailable'); storage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(report.value)); return report.value;
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

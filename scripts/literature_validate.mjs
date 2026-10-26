/** Offline integrity checks for the reading library and its provenance. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {references} from '../src/data/references.js';
import {additionalReferences} from '../src/data/references-expanded.js';
import {evidenceByStructureId,atlasEvidence} from '../src/data/evidence.js';
import {additionalLiteratureReferences,literaturePapers,literatureTopics,literatureModalities,literatureDebates,literatureByReferenceId} from '../src/data/literature.js';
import {additionalResultsReferences,curatedResults} from '../src/data/results.js';
import {emptyEvidence,validateEvidence} from '../src/lib/evidence-workspace.js';
import {structures as allStructures} from '../src/data/catalog.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data-sources/literature-upgrade');
const sha=s=>createHash('sha256').update(s).digest('hex');
const legacyRefs=[...references,...additionalReferences,...additionalLiteratureReferences];
const refs=[...legacyRefs,...additionalResultsReferences];
const refIds=new Set(refs.map(r=>r.id));
const topics=new Set(literatureTopics.map(t=>t.id));
const modalities=new Set(literatureModalities.map(t=>t.id));
const bilingual=(x,name)=>assert(x&&typeof x.zh==='string'&&x.zh.trim()&&typeof x.en==='string'&&x.en.trim(),`Missing bilingual text: ${name}`);
const url=(s,name)=>assert(/^https?:\/\//.test(s),`Missing source URL: ${name}`);
assert.equal(refIds.size,refs.length,'Duplicate reference IDs');
assert.equal(literaturePapers.length,legacyRefs.length,'Every legacy reference must have one reading record');
assert.equal(refs.length,118,'Expected 118 references in the current release');
assert.equal(new Set(literaturePapers.map(p=>p.id)).size,literaturePapers.length,'Duplicate paper IDs');
const doiSet=new Set();
for(const r of refs)if(r.doi){const d=r.doi.toLowerCase();assert(!doiSet.has(d),`Duplicate DOI: ${d}`);doiSet.add(d);}
for(const option of [...literatureTopics,...literatureModalities]){bilingual(option.label,option.id);bilingual(option.description,option.id);}
const mappedIds=new Set();
let links=0,figures=0;
for(const p of literaturePapers){
  assert(refIds.has(p.referenceId)&&p.referenceId===p.id,`Unknown paper reference: ${p.id}`);
  assert.strictEqual(literatureByReferenceId[p.id],p);
  for(const key of ['resultSummaries','studyTypeLabel','speciesLabel','population','associationStrengthLabel','limitations'])bilingual(p[key],`${p.id}.${key}`);
  assert(p.topics.length&&p.modalities.length,`Missing indexing: ${p.id}`);
  p.topics.forEach(t=>assert(topics.has(t),`Unknown topic: ${p.id}/${t}`));
  p.modalities.forEach(m=>assert(modalities.has(m),`Unknown method: ${p.id}/${m}`));
  p.atlasAssociations.forEach(a=>assert(atlasEvidence[a],`Unknown atlas: ${p.id}/${a}`));
  url(p.methodProvenance.source,p.id);
  assert(p.methodProvenance.metadataSources.length,`No verified source metadata: ${p.id}`);
  for(const m of p.mappedRegions){
    assert(evidenceByStructureId[m.structureId],`Unknown mapped structure: ${p.id}/${m.structureId}`);
    assert.equal(m.coordinates,null,`Unreviewed coordinates: ${p.id}`);assert.equal(m.space,null,`Implied coordinate system: ${p.id}`);
    assert(!m.position,`Synthetic position leaked into paper: ${p.id}`);
    bilingual(m.limitations,`${p.id}/${m.structureId}`);url(m.source,p.id);
    if(m.sourceKind==='cross-species-context'||m.sourceKind==='contextual-reading')assert.equal(m.directEvidence,false,`Context must not become direct evidence: ${p.id}`);
    mappedIds.add(m.structureId);links++;
  }
  assert(p.claims.length,`No finding: ${p.id}`);
  for(const c of p.claims){bilingual(c.text,p.id);bilingual(c.limitations,p.id);url(c.source,p.id);c.regionIds.forEach(id=>assert(evidenceByStructureId[id]));}
  if(['atlas','anatomical-study','methods-study'].includes(p.studyType))assert(p.claims.every(c=>c.field==='anatomy'),`Anatomy source presented as functional proof: ${p.id}`);
  for(const f of p.figures){bilingual(f.label,p.id);bilingual(f.caption,p.id);url(f.url,p.id);assert.equal(f.canEmbed,false,'Figure redistribution must remain disabled');assert(f.url.endsWith(`#${f.figureId}`));figures++;}
}
for(const d of literatureDebates){
  bilingual(d.title,d.id);bilingual(d.interpretation,d.id);assert(topics.has(d.topic));
  d.regionIds.forEach(id=>assert(evidenceByStructureId[id]));
  assert(d.papers.length>=2,`Not a comparison: ${d.id}`);
  for(const p of d.papers){assert(refIds.has(p.referenceId));assert(modalities.has(p.modality));bilingual(p.claim,d.id);}
  d.sources.forEach(s=>url(s,d.id));
}
// Scientific guardrails: method labels and lateralization must survive regeneration.
assert.deepEqual(literatureByReferenceId.raichle2001.modalities,['PET']);
assert.deepEqual(literatureByReferenceId.gibo1981.modalities,['dissection']);
assert.deepEqual(literatureByReferenceId.parvizi2012.mappedRegions.map(m=>m.structureId),['fusiform-r']);
assert(literatureByReferenceId.tsao2006.mappedRegions.every(m=>m.directEvidence===false));
assert(literatureByReferenceId.bentin1996.mappedRegions.every(m=>m.directEvidence===false));
assert(literatureByReferenceId.dubois2006.mappedRegions.filter(m=>m.structureId.endsWith('-r')).every(m=>m.directEvidence===false));
for(const modality of ['MEG','fMRI','EEG','iEEG','single-unit'])assert(literaturePapers.some(p=>p.modalities.includes(modality)),`Requested modality missing: ${modality}`);
const metadata=JSON.parse(await readFile(path.join(dir,'metadata.json'),'utf8'));
let checkedHashes=0,unavailableRawCaches=0;
for(const r of metadata.records){
  assert.equal(r.status,'verified');assert(refIds.has(r.id));
  for(const kind of ['crossref','europepmc']){
    let raw;
    try{raw=JSON.parse(await readFile(path.join(dir,'raw',`${r.id}.${kind}.json`),'utf8'));}catch(error){if(error.code==='ENOENT'){unavailableRawCaches++;continue;}throw error;}
    assert(raw.ok);assert.equal(sha(raw.raw),raw.sha256,`Changed raw metadata: ${r.id}/${kind}`);
    assert(r.sources.some(s=>s.url===raw.url&&s.sha256===raw.sha256));checkedHashes++;
  }
}
const figureAudit=JSON.parse(await readFile(path.join(dir,'figure-audit.json'),'utf8'));
assert.equal(figureAudit.figures.length,figures);
for(const f of figureAudit.figures){
  // Local full text is optional in a fresh public clone; the audit retains its hash.
  let raw;try{raw=JSON.parse(await readFile(path.join(dir,'raw',`${f.referenceId}.fulltext.json`),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(raw){assert(raw.ok);assert.equal(sha(raw.raw),f.verification.sha256);assert(new RegExp(`<fig\\b[^>]*\\bid="${f.figureId}"`).test(raw.raw));checkedHashes++;}
  assert(literatureByReferenceId[f.referenceId].figures.some(x=>x.url===f.url&&x.license===f.license));
}
assert.equal(mappedIds.size,Object.keys(evidenceByStructureId).length,'Some structures have no reading links');
// Structured extraction is a separate layer from the legacy reading annotations.
// These checks lock provenance and numeric transcription; they do not re-review the paper.
const structured={...emptyEvidence(),references:additionalResultsReferences,results:curatedResults};
const structuredReport=validateEvidence(structured,{knownReferences:refs,knownRegions:Object.keys(evidenceByStructureId)});
assert(structuredReport.valid,structuredReport.errors.join('\n'));
assert.equal(additionalResultsReferences.length,3,'Expected three primary papers with structured results');
assert.equal(curatedResults.length,4,'Expected four structured findings');
const sourceCheckedCoordinates=curatedResults.flatMap(r=>r.coordinates);
assert.equal(sourceCheckedCoordinates.length,8,'Expected eight source-checked coordinates');
for(const r of curatedResults){
  assert(refIds.has(r.referenceId),`Unknown structured-result paper: ${r.id}`);
  assert.equal(r.curationStatus,'source-checked');
  for(const key of ['finding','condition','sample','roiDefinition','direction','limitations','curationNote'])bilingual(r[key],`${r.id}.${key}`);
  r.topics.forEach(t=>assert(topics.has(t),`Unknown result topic: ${r.id}/${t}`));
  r.modalities.forEach(m=>assert(modalities.has(m),`Unknown result modality: ${r.id}/${m}`));
  for(const c of r.coordinates){assert.equal(c.space,'MNI-unspecified',`Do not infer a precise MNI variant: ${c.id}`);assert.equal(c.status,'source-checked');bilingual(c.frameNote,`${c.id}.frameNote`);}
  for(const f of r.figures){bilingual(f.caption,`${r.id}/${f.id}`);assert(!f.rehosted,'Source figures must remain external');if(f.imageUrl)assert(/^CC BY 4\.0/.test(f.license),'External source image requires recorded open license');}
}
const resultsDir=path.join(root,'data-sources/results');
const audit=JSON.parse(await readFile(path.join(resultsDir,'source-audit.json'),'utf8'));
assert.equal(audit.metadataSources.length,3);assert.equal(audit.coordinates.length,8);
let resultMetadataHashChecks=0;
for(const record of audit.metadataSources){
  assert(additionalResultsReferences.some(r=>r.id===record.referenceId));
  assert.equal(path.basename(record.file),record.file,'Metadata audit path must stay in results directory');
  const raw=await readFile(path.join(resultsDir,record.file));assert.equal(sha(raw),record.sha256,`Changed results metadata: ${record.referenceId}`);resultMetadataHashChecks++;
  const parsed=JSON.parse(raw);const ref=additionalResultsReferences.find(r=>r.id===record.referenceId);
  assert.equal(parsed.crossref.title[0],ref.title);assert.equal(parsed.europepmc.doi.toLowerCase(),ref.doi.toLowerCase());assert.equal(Number(parsed.europepmc.pubYear),ref.year);
  assert.deepEqual(parsed.crossref.author.map(a=>[a.given,a.family].filter(Boolean).join(' ')),ref.fullAuthorList);
}
for(const source of audit.coordinates){const c=sourceCheckedCoordinates.find(c=>c.id===source.id);assert(c,`Missing audited coordinate ${source.id}`);assert.deepEqual([c.x,c.y,c.z],source.xyz);assert.equal(c.space,source.space);assert.equal(c.sourceRow,source.sourceRow);assert.equal(c.sourceTable,source.sourceTable);assert.equal(c.sourceUrl,source.sourceURL);assert.equal(c.kind,source.kind);}
const portable=JSON.parse(await readFile(path.join(resultsDir,'curated-results.json'),'utf8'));
assert.deepEqual(portable,structured,'Portable example must match the built-in structured findings');
const frames=Object.fromEntries([...new Set(sourceCheckedCoordinates.map(c=>c.space))].map(space=>[space,sourceCheckedCoordinates.filter(c=>c.space===space).length]));
const activeBrainStructuresWithReadingLinks=allStructures.filter(s=>s.category!=='spinal'&&mappedIds.has(s.id)).length;
assert.equal(activeBrainStructuresWithReadingLinks,150,'Expected 150 active brain catalog structures');
console.log(JSON.stringify({status:'passed',papers:refs.length,legacyReadingRecords:literaturePapers.length,legacyStructureRecordsWithReadingLinks:mappedIds.size,activeBrainStructuresWithReadingLinks,regionLinks:links,topics:topics.size,modalities:modalities.size,comparisons:literatureDebates.length,figureLinks:figures+curatedResults.reduce((n,r)=>n+r.figures.length,0),externalSourceImages:curatedResults.flatMap(r=>r.figures).filter(f=>f.imageUrl).length,rawHashChecks:checkedHashes,unavailableRawCaches,resultMetadataHashChecks,structuredPapers:additionalResultsReferences.length,structuredFindings:curatedResults.length,sourceCheckedCoordinates:sourceCheckedCoordinates.length,coordinateFrames:frames},null,2));

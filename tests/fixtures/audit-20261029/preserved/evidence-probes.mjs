// Read-only data/code probes. Writes only the sibling evidence-probes.json report.
// Run: node output/audit-20261029/evidence-probes.mjs
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {structures as catalogStructures, references as catalogReferences} from '../../src/data/catalog.js';
import {additionalLiteratureReferences, literaturePapers} from '../../src/data/literature.js';
import {additionalResultsReferences, curatedResults} from '../../src/data/results.js';
import {localizeStructure} from '../../src/i18n/catalog-en.js';
import {localizeReference} from '../../src/i18n/references-en.js';

const byId = rows => [...new Map(rows.map(r => [r.id, r])).values()];
const text = (value, language) => typeof value === 'string' ? value : value?.[language] || value?.en || value?.zh || '';
const viewerStructures = catalogStructures.filter(s => s.category !== 'spinal'); // App.jsx:25
const activeIds = new Set(viewerStructures.map(s => s.id));
const spinalIds = new Set(catalogStructures.filter(s => s.category === 'spinal').map(s => s.id));
const refs = byId([...catalogReferences, ...additionalLiteratureReferences, ...additionalResultsReferences]); // App.jsx:41
const links = literaturePapers.flatMap(p => p.mappedRegions.map(m => ({referenceId:p.id, species:p.species, ...m})));
const coordinates = curatedResults.flatMap(r => r.coordinates);
const structuredRegionIds = [...new Set(curatedResults.flatMap(r => r.regionIds))];
const nonhumanSpecies = new Set(['cat', 'rat', 'nonhuman-primate']);
const nonhumanDirect = links.filter(m => nonhumanSpecies.has(m.species) && m.directEvidence === true);
const compactMapping = m => ({referenceId:m.referenceId, species:m.species, structureId:m.structureId, sourceKind:m.sourceKind});

// Mirrors LiteratureWorkspace.jsx:35-36 for a fresh session with no local evidence.
function searchProbe(language) {
  const localizedRefs = refs.map(r => localizeReference(r, language));
  const regions = Object.fromEntries(viewerStructures.map(s => { const r=localizeStructure(s,language); return [r.id,r]; }));
  const papers = localizedRefs.map(r => {
    const p = literaturePapers.find(p => p.id === r.id) || {id:r.id,topics:[],modalities:[],mappedRegions:[]};
    const results = curatedResults.filter(v => v.referenceId === r.id);
    return {...p, ref:r, results,
      topics:[...new Set([...(p.topics||[]), ...results.flatMap(v=>v.topics||[])])],
      modalities:[...new Set([...(p.modalities||[]), ...results.flatMap(v=>v.modalities||[])])],
      mappedRegions:byId([...(p.mappedRegions||[]).map(v=>({...v,id:v.structureId})), ...results.flatMap(v=>(v.regionIds||[]).map(structureId=>({id:structureId,structureId,source:v.sourceUrl})))])};
  });
  const find = query => papers.filter(p => {
    const r = p.ref;
    return [r.title,r.authors,r.year,r.pmid,r.doi,text(p.resultSummaries,language),...p.results.flatMap(v=>[text(v.finding,language),text(v.condition,language),v.id]),...p.mappedRegions.map(m=>[regions[m.structureId]?.name,regions[m.structureId]?.en].join(' '))].join(' ').toLowerCase().includes(query.toLowerCase());
  }).map(p => p.id);
  const schaum = papers.find(p => p.id === 'schaum2021');
  return {queryMatches:Object.fromEntries(['pre-SMA','BA44','BA44/45','停止','inhibitory'].map(query=>[query,find(query)])),
    schaumTopics:schaum.topics,schaumPaperModalities:schaum.modalities,
    schaumIncludedByControlFilter:schaum.topics.includes('control'),
    schaumIncludedByFMRIFilter:schaum.modalities.includes('fMRI')};
}
const sourceFiles = ['src/App.jsx','src/components/LiteratureWorkspace.jsx','src/data/literature.js','src/data/results.js','scripts/literature_build.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file,createHash('sha256').update(await readFile(new URL(`../../${file}`,import.meta.url))).digest('hex')])));
const report = {
  generatedAt:new Date().toISOString(),nodeVersion:process.version,
  method:'Current built-in data import and code-derived search; no browser execution, no local user evidence, no live literature re-verification.',
  sourceHashes,
  denominators:{
    fullBibliographyReferences:refs.length,
    note:'App.jsx filters structures, not allReferences: 118 and 115 are full-library counts, and 512 includes links to hidden spinal structures.',
    fullCatalogStructures:catalogStructures.length,activeBrainStructures:viewerStructures.length,hiddenSpinalStructures:spinalIds.size,
    fullReadingRecords:literaturePapers.length,
    readingRecordsWithActiveBrainLinks:literaturePapers.filter(p=>p.mappedRegions.some(m=>activeIds.has(m.structureId))).length,
    readingRecordsWithHiddenSpinalLinks:literaturePapers.filter(p=>p.mappedRegions.some(m=>spinalIds.has(m.structureId))).length,
    hiddenSpinalOnlyReadingRecordIds:literaturePapers.filter(p=>p.mappedRegions.length && p.mappedRegions.every(m=>spinalIds.has(m.structureId))).map(p=>p.id),
    readingRecordsWithoutStructureLinks:literaturePapers.filter(p=>!p.mappedRegions.length).map(p=>p.id),
    fullReadingLinks:links.length,activeBrainReadingLinks:links.filter(m=>activeIds.has(m.structureId)).length,
    hiddenSpinalReadingLinks:links.filter(m=>spinalIds.has(m.structureId)).length,
    unknownStructureLinks:links.filter(m=>!activeIds.has(m.structureId)&&!spinalIds.has(m.structureId)).map(compactMapping),
    activeBrainStructuresWithReadingLinks:new Set(links.filter(m=>activeIds.has(m.structureId)).map(m=>m.structureId)).size,
    fullLibraryClaims:literaturePapers.reduce((n,p)=>n+p.claims.length,0),
    readingRecordsWithGenericPopulation:literaturePapers.filter(p=>p.population.en.includes('See the source')).length,
  },
  structuredCoverage:{papers:new Set(curatedResults.map(r=>r.referenceId)).size,findings:curatedResults.length,coordinates:coordinates.length,
    coordinateSpaces:Object.fromEntries([...new Set(coordinates.map(c=>c.space))].map(space=>[space,coordinates.filter(c=>c.space===space).length])),
    activeBrainRegionIds:structuredRegionIds.filter(id=>activeIds.has(id)),
    hiddenSpinalRegionIds:structuredRegionIds.filter(id=>spinalIds.has(id)),
    directlyOverlayEligibleCoordinates:coordinates.filter(c=>c.space==='MNI152NLin6Asym'&&c.status==='source-checked').length},
  nonhumanDirectEvidence:{fullDataCount:nonhumanDirect.length,
    activeBrainCount:nonhumanDirect.filter(m=>activeIds.has(m.structureId)).length,
    hiddenSpinalCount:nonhumanDirect.filter(m=>spinalIds.has(m.structureId)).length,
    activeBrainMappings:nonhumanDirect.filter(m=>activeIds.has(m.structureId)).map(compactMapping),
    hiddenSpinalMappings:nonhumanDirect.filter(m=>spinalIds.has(m.structureId)).map(compactMapping),
    tsaoCounterexample:links.filter(m=>m.referenceId==='tsao2006').map(m=>({...compactMapping(m),directEvidence:m.directEvidence}))},
  search:{zh:searchProbe('zh'),en:searchProbe('en'),existingSchaumCoordinateLabels:curatedResults.filter(r=>r.referenceId==='schaum2021').flatMap(r=>r.coordinates.map(c=>c.label))}
};
await writeFile(new URL('./evidence-probes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

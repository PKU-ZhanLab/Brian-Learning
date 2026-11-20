// Offline minimal-source audit by default. Optional live requests check only
// bibliographic metadata; reachable URLs never certify numeric transcription.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {auditFromDisk} from '../../scripts/evidence-audit.mjs';
const live=process.argv.includes('--metadata-live');
if(process.argv.includes('--refresh'))throw Error('Immutable source artifacts cannot be refreshed in place. Add a new version after source inspection.');
if(live){
  for(const id of ['schaum2021','axelrod2015','bosco2008']){
    const saved=JSON.parse(await readFile(new URL(`${id}-metadata.json`,import.meta.url),'utf8'));
    const get=async url=>{const response=await fetch(url);if(!response.ok)throw Error(`${response.status}: ${url}`);return response.json();};
    const [crossref,europe]=await Promise.all([get(saved.crossrefURL),get(saved.europeURL)]);
    assert.deepEqual(crossref.message.title,saved.crossref.title,`${id}: title changed`);
    assert.deepEqual(crossref.message.author.map(author=>[author.given,author.family]),saved.crossref.author.map(author=>[author.given,author.family]),`${id}: ordered authors changed`);
    const record=europe.resultList.result[0];assert.equal(record.doi.toLowerCase(),saved.europepmc.doi.toLowerCase(),`${id}: DOI changed`);assert.equal(record.pubYear,saved.europepmc.pubYear,`${id}: year changed`);
  }
}
const report=await auditFromDisk();
console.log(JSON.stringify({mode:'offline',liveBibliographicMetadataChecked:live,valid:report.valid,coordinates:report.coverage.coordinates.length,fields:report.coverage.fields.length,integrityErrors:report.integrityErrors,semanticReviewRequired:report.semanticReviewRequired,unavailableArtifacts:report.unavailableArtifacts,humanReview:report.humanReview},null,2));
if(!report.valid)process.exitCode=1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {curatedEvidence} from '../data/results.js';
import {sourceInputPaths} from '../../scripts/public-package.mjs';
const api=await import('./result-publication.js').catch(()=>({}));
const resultId='schaum2021-meg-stop';
test('published result versions are immutable',async()=>{
 assert.equal(typeof api.buildPublicResultRecord,'function');
 const old=JSON.parse(await readFile(new URL('../../data-sources/results/published/2026-10-29.2.json',import.meta.url)));
 const original=api.buildPublicResultRecord(old,{resultId,dataVersion:old.dataVersion});
 const latest=api.buildPublicResultRecord(curatedEvidence,{resultId,dataVersion:curatedEvidence.dataVersion});
 assert.notEqual(latest.dataVersion,original.dataVersion);
 assert.equal(api.getPublishedResultRecord({resultId,dataVersion:old.dataVersion}).contentHash,original.contentHash);
 assert.throws(()=>api.buildPublicResultRecord(curatedEvidence,{resultId,dataVersion:old.dataVersion}),/version-mismatch/);
 assert.throws(()=>api.getPublishedResultRecord({resultId,dataVersion:'unknown'}),/unpublished-version/);
 original.result.finding.en='mutated';
 assert.notEqual(api.getPublishedResultRecord({resultId,dataVersion:old.dataVersion}).result.finding.en,'mutated');
});
test('public flags, same IDs and local free text never establish publication authority',()=>{
 const local=structuredClone(curatedEvidence);local.public=true;local.results[0].finding.en='SECRET';
 assert.throws(()=>api.buildPublicResultRecord(local,{resultId,dataVersion:local.dataVersion}),/canonical-publication-mismatch/);
 const extra=structuredClone(curatedEvidence);extra.claims.push({id:'private',text:'SECRET',public:true});
 assert.throws(()=>api.buildPublicResultRecord(extra,{resultId,dataVersion:extra.dataVersion}),/canonical-publication-mismatch/);
 assert.ok(!JSON.stringify(api.getPublishedResultRecord({resultId})).includes('SECRET'));
});
test('public record includes source, spatial limits and subject-scoped pending human review',()=>{
 const record=api.buildPublicResultRecord(curatedEvidence,{resultId,dataVersion:curatedEvidence.dataVersion});
 assert.equal(record.reviewState.humanReviewed,false);assert.equal(record.reviewState.spaceChecked,false);
 assert.ok(record.sourceRefs.length);assert.ok(record.limitations.length);
 assert.equal(record.locations.length,4);assert.ok(record.locations.every(row=>row.sourceSpaceId==='MNI-unspecified'));
 const left=api.getPublishedResultRecord({resultId:'axelrod2015-lffa'});
 assert.equal(left.result.correction.value.passed,false);
 assert.ok(left.corrections.some(c=>c.fromVersion==='2026-10-29.2'&&c.toVersion===curatedEvidence.dataVersion));
});
test('immutable snapshot bytes and content hashes match committed registry',async()=>{
 const registry=JSON.parse(await readFile(new URL('../../data-sources/results/publication-registry.json',import.meta.url)));
 for(const entry of registry.versions){
  const bytes=await readFile(new URL(`../../data-sources/results/${entry.file}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  for(const row of entry.records){const record=api.getPublishedResultRecord({resultId:row.resultId,dataVersion:entry.dataVersion});const {contentHash,...content}=record;assert.equal(contentHash,createHash('sha256').update(api.canonicalPublicationJSON(content)).digest('hex'));}
 }
});
test('original eight coordinates retain independent MNI frames and no derived overlays',()=>{
 assert.equal(curatedEvidence.locations.length,8);
 for(const row of curatedEvidence.locations){assert.equal(row.sourceSpaceId,'MNI-unspecified');assert.equal(row.derivedAsset,null);}
});
test('source package closes over immutable versions and reusable source facts without output caches',async()=>{
 const paths=sourceInputPaths(),required=['curation-scope.json','upstream-assets.json','corrections.json','publication-registry.json','published/2026-10-29.2.json','published/2026-10-30.1.json','source-artifacts/axelrod2015-v2.json','source-facts/index.json','source-facts/axelrod-participants-v1.json','source-facts/martin-article-v1.json','source-facts/martin-rights-v1.json','source-facts/martin-image-api-v1.json','source-facts/martin-collection-api-v1.json','source-facts/martin-retrievals-v1.json','source-facts/martin-local-verification-v1.json','source-facts/schaum-doi-lookup-v1.json','source-facts/martin-code-evidence-v1.json','source-facts/martin-code-LICENSE.txt','source-facts/neurovault-api-contract-v1.json'];
 for(const path of required){assert.ok(paths.has(`data-sources/results/${path}`),path);await readFile(new URL(`../../data-sources/results/${path}`,import.meta.url));}
 assert.ok(![...paths].some(path=>path.startsWith('output/')));
 assert.ok(paths.has('tests/fixtures/evidence-v1-baseline.json'),'portable editor regression requires the retained inert v1 fixture');
});
test('source fact hashes pin portable metadata while scientific gaps remain explicit',async()=>{
 const base=new URL('../../data-sources/results/',import.meta.url),index=JSON.parse(await readFile(new URL('source-facts/index.json',base)));
 for(const row of index.files){assert.equal(row.file,row.file.split('/').at(-1));const bytes=await readFile(new URL(`source-facts/${row.file}`,base));assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);}
 const upstream=JSON.parse(await readFile(new URL('upstream-assets.json',base))),martin=upstream.assets[0];
 assert.equal(martin.sourceSpaceId,null);assert.equal(martin.sourceAsset.spaceId,null);assert.equal(martin.derivedAsset,null);assert.equal(martin.thresholdEvidence.imageAPIIsThresholded,true);assert.equal(martin.upstream.thresholdState,'conflicting');assert.equal(martin.sourceSpaceAssertions[0].uploadBindingVerified,false);assert.equal(upstream.lookups.verifiedEmpty,false);
});
test('versioned public export is self-contained with source and correction endpoint identities',async()=>{
 assert.equal(typeof api.buildPublicResultExport,'function');
 const exported=api.buildPublicResultExport({resultId:'axelrod2015-lffa',dataVersion:'2026-10-29.2'}),portable=JSON.parse(JSON.stringify(exported));
 assert.equal(portable.record.dataVersion,'2026-10-29.2');assert.equal(portable.relatedVersions[0].record.dataVersion,'2026-10-30.1');
 assert.ok(portable.evidence.sourceArtifacts.length);assert.equal(portable.evidence.results.length,1);
 assert.equal((await api.validatePublicResultExport(portable)).valid,true);
 assert.deepEqual(new Set(portable.publicationIdentities.map(row=>row.dataVersion)),new Set(['2026-10-29.2','2026-10-30.1']));
 assert.ok(portable.relatedVersions[0].evidence.sourceArtifacts.some(row=>row.id==='axelrod2015-v2'));
 assert.equal(portable.record.reviewState.humanReviewed,false);
});
test('offline public export validation rejects changed content, missing closure and broken correction endpoints',async()=>{
 for(const mutate of [x=>x.record.result.finding.en='SECRET',x=>x.evidence.sourceArtifacts=[],x=>x.publicationIdentities.pop(),x=>x.corrections[0].toVersion='missing',x=>x.corrections[0].reason='changed',x=>x.corrections=[],x=>x.evidence.sourceArtifacts[0].excerpt.cells[0].rawText='wrong',x=>x.relatedVersions[0].evidence.locations=[]]){
  const value=api.buildPublicResultExport({resultId:'axelrod2015-lffa',dataVersion:'2026-10-29.2'});mutate(value);assert.equal((await api.validatePublicResultExport(value)).valid,false);
 }
 assert.throws(()=>api.buildPublicResultExport({resultId:'private',dataVersion:curatedEvidence.dataVersion}),/unpublished-result/);
 assert.throws(()=>api.buildPublicResultExport({resultId,dataVersion:'unknown'}),/unpublished-version/);
 const local={...structuredClone(curatedEvidence),notes:'SECRET'};local.results[0].finding.en='SECRET';
 assert.ok(!JSON.stringify(api.buildPublicResultExport({resultId,dataVersion:curatedEvidence.dataVersion,bundle:local,public:true})).includes('SECRET'));
});

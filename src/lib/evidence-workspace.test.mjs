import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyEvidence,validateEvidence,mergeEvidence,loadEvidence,saveEvidence,lookupPaperMetadata,EVIDENCE_STORAGE_KEY,LEGACY_EVIDENCE_STORAGE_KEY,safeSourceURL} from './evidence-workspace.js';
import {migrateEvidence,getResultViewModel,resultViewModelToEvidence,removeEvidenceRecords} from './evidence-schema.js';
import {classifyMapping} from './evidence-mapping.js';
import {curatedEvidence,curatedResults,additionalResultsReferences} from '../data/results.js';
const fixture=JSON.parse(readFileSync(new URL('../../tests/fixtures/evidence-v1-baseline.json',import.meta.url)));
const curated=()=>structuredClone(curatedEvidence);
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('curated and v1 packages share one validation/migration boundary',()=>{
  for(const payload of [fixture,curated()]){const report=validateEvidence(payload);assert.equal(report.valid,true,report.errors.join('\n'));assert.equal(report.value.schema,'brain-evidence-v2');assert.equal(report.value.results.length,4);assert.equal(report.value.locations.length,8);assert.ok(report.value.locations.every(c=>c.sourceSpaceId==='MNI-unspecified'));}
  assert.equal(curatedResults.length,4);assert.equal(curatedResults.flatMap(r=>r.coordinates).length,8);
});
test('invalid legacy coordinates and figure provenance remain rejected',()=>{
  for(const patch of [{space:'MNI'},{space:'invented-template'},{x:'50'},{y:NaN},{z:Infinity},{x:301},{sourceTable:''},{sourceRow:''},{sourceUrl:'javascript:alert(1)'},{frameNote:''},{status:'human-verified'}]){const p=structuredClone(fixture);Object.assign(p.results[0].coordinates[0],patch);assert.equal(validateEvidence(p).valid,false,JSON.stringify(patch));}
  assert.equal(safeSourceURL('data:text/html,test'),'');assert.equal(safeSourceURL('https://user:pass@example.org'),'');
  const payload=structuredClone(fixture);payload.results[0].figures[0].imageUrl='javascript:alert(1)';assert.equal(validateEvidence(payload).valid,false);payload.results[0].figures[0].imageUrl='https://example.org/image.png';payload.results[0].figures[0].license='All rights reserved';payload.results[0].figures[0].rehosted=true;assert.equal(validateEvidence(payload).valid,false);
});
test('v1 load is a preview and failed v2 saves preserve both original storage keys',()=>{
  const storage=store(),raw=JSON.stringify(fixture);storage.setItem(LEGACY_EVIDENCE_STORAGE_KEY,raw);const loaded=loadEvidence(storage);assert.equal(loaded.schema,'brain-evidence-v2');assert.equal(storage.getItem(EVIDENCE_STORAGE_KEY),null);assert.equal(storage.getItem(LEGACY_EVIDENCE_STORAGE_KEY),raw);
  storage.setItem=(key)=>{if(key===EVIDENCE_STORAGE_KEY)throw Error('quota');};assert.throws(()=>saveEvidence(loaded,storage),/quota/);assert.equal(storage.getItem(LEGACY_EVIDENCE_STORAGE_KEY),raw);
});
test('malformed packages are rejected without throwing or changing data',()=>{
  for(const bad of ['{broken',null,{},[],{...emptyEvidence(),references:[null]},{...emptyEvidence(),results:[null]},{...emptyEvidence(),references:[{id:'a',title:{en:'bad UI shape'},url:'https://example.org'}]}])assert.equal(validateEvidence(bad).valid,false);
  const storage=store();saveEvidence(curated(),storage);const previous=storage.getItem(EVIDENCE_STORAGE_KEY);assert.throws(()=>saveEvidence({...curated(),schema:'wrong'},storage));assert.equal(storage.getItem(EVIDENCE_STORAGE_KEY),previous);
});
test('roundtrip retains explicit relation provenance',()=>{
  const p=curated();p.relations=[{id:'relation-a',fromResultId:'axelrod2015-rffa',toResultId:'axelrod2015-lffa',type:'complementary',rationale:'Different hemispheres and ROI sample sizes.',annotator:'Researcher A',sourceUrl:'https://doi.org/10.1371/journal.pone.0117126'}];const storage=store();saveEvidence(p,storage);assert.deepEqual(loadEvidence(storage),p);p.relations[0].sourceUrl='';assert.equal(validateEvidence(p).valid,false);
});
test('DOI merge rewrites experiments readings claims mappings artifacts review subjects and legacy display edges',()=>{
  const base=curated(),incoming=curated(),oldId='axelrod2015',imported='imported-paper';
  incoming.references=incoming.references.filter(r=>r.id===oldId).map(r=>({...r,id:imported,doi:'https://doi.org/10.1371/journal.pone.0117126'}));
  incoming.results=incoming.results.filter(r=>r.referenceId===oldId);incoming.locations=incoming.locations.filter(l=>incoming.results.some(r=>r.id===l.resultId));incoming.claims=incoming.claims.filter(c=>c.referenceId===oldId);incoming.reviewEvents=incoming.reviewEvents.filter(e=>[...incoming.results,...incoming.locations].some(r=>r.id===e.subjectId));
  for(const r of [...incoming.results,...incoming.claims])r.referenceId=imported;
  incoming.readings=[{id:'reading',referenceId:imported,resultSummaries:'Reading summary',methodProvenance:{source:'https://example.org'},limitations:'Reading only',claimIds:[incoming.claims[0].id]}];
  incoming.experiments=[{id:'exp',referenceId:imported,task:'Explicit experiment',species:'human',sample:incoming.results[0].sample,modalities:['fMRI'],sourceRefs:['https://example.org']}];
  incoming.sourceArtifacts=[{id:'source',referenceId:imported,sourceReferenceId:imported,referenceIds:[imported]}];incoming.mappings=[classifyMapping({id:'mapping',referenceId:imported,claimId:incoming.claims[0].id})];
  incoming.reviewEvents.push({id:'paper-check',subjectId:imported,stage:'extracted',actorType:'ai',actorName:'Codex',date:'2026-10-29',scope:'Metadata only',sourceRefs:[],limitations:[],recordVersion:'1'});
  const copy=structuredClone(incoming),merged=mergeEvidence(base,incoming);
  for(const key of ['results','claims','readings','experiments','mappings','sourceArtifacts'])for(const row of merged[key].filter(r=>r.referenceId))assert.notEqual(row.referenceId,imported);
  assert.equal(merged.sourceArtifacts[0].sourceReferenceId,oldId);assert.deepEqual(merged.sourceArtifacts[0].referenceIds,[oldId]);assert.equal(merged.reviewEvents.find(e=>e.id==='paper-check').subjectId,oldId);assert.deepEqual(incoming,copy);assert.equal(merged.references.length,3);
});
test('legacy text editor preserves structured fields, resets current checks and retains history',()=>{
  const b=curated(),vm=getResultViewModel('axelrod2015-lffa',b);vm.finding='Changed annotation';vm.curationStatus='draft';vm.coordinates[0].status='draft';
  const p=resultViewModelToEvidence(vm,b,{knownReferences:additionalResultsReferences});const merged=mergeEvidence(b,p);const updated=getResultViewModel(vm.id,merged);assert.equal(updated.finding,'Changed annotation');assert.equal(updated.curationStatus,'draft');assert.equal(updated.coordinates[0].status,'draft');assert.deepEqual(merged.results.find(r=>r.id===vm.id).statistics,b.results.find(r=>r.id===vm.id).statistics);assert.ok(merged.reviewEvents.some(e=>e.id===`${vm.id}:legacy-source-check`));
});
test('editor preserves coordinate dispersion and explicit coordinate deletion cleans dependent records',()=>{
  const b=curated(),vm=getResultViewModel('bosco2008-tms-protocol1',b);vm.finding='Edited narrative';vm.curationStatus='draft';
  const p=resultViewModelToEvidence(vm,b,{knownReferences:additionalResultsReferences});assert.deepEqual(p.locations[0].dispersion,b.locations.find(l=>l.id===p.locations[0].id).dispersion);
  vm.coordinates=vm.coordinates.slice(0,1);const edited=mergeEvidence(b,resultViewModelToEvidence(vm,b,{knownReferences:additionalResultsReferences}));assert.equal(edited.locations.filter(l=>l.resultId===vm.id).length,1);
  const removed=removeEvidenceRecords(edited,{resultIds:[vm.id]});assert.equal(validateEvidence(removed).valid,true);assert.ok(!removed.locations.some(l=>l.resultId===vm.id));assert.ok(!removed.claims.some(c=>c.resultId===vm.id));
});
test('DOI/v1 merges retain the untouched imported original for unknown fields',()=>{
  const old=structuredClone(fixture);old.privateLegacyField={source:'Unnormalized original'};const merged=mergeEvidence(emptyEvidence(),old);assert.deepEqual(merged.legacyImports,[old]);assert.equal(old.schema,'brain-evidence-v1');
});
test('known builtins permit local-only v1 packages without copying the builtins into storage',()=>{
  const p={schema:'brain-evidence-v1',references:[],results:[fixture.results[0]],relations:[]};assert.equal(validateEvidence(p).valid,false);const report=validateEvidence(p,{knownReferences:additionalResultsReferences,knownResults:curatedResults});assert.equal(report.valid,true);assert.equal(report.value.references.length,0);
});
test('metadata DOI lookup is metadata only and falls back to Europe PMC',async()=>{
  const seen=[];const fetcher=async url=>{seen.push(url);return {ok:true,json:async()=>({message:{DOI:'10.1000/example',title:['A paper'],author:[{given:'A',family:'Author'}],published:{'date-parts':[[2020]]},'container-title':['Journal']}})};};
  const results=await lookupPaperMetadata('https://doi.org/10.1000/example',{fetcher});assert.match(seen[0],/api.crossref.org\/works\/10.1000%2Fexample/);assert.equal(results[0].verificationStatus,'metadata-only');assert.equal(results[0].coordinates,undefined);assert.equal(results[0].finding,undefined);
  const fallback=await lookupPaperMetadata('10.1000/example',{fetcher:async url=>url.includes('crossref')?{ok:false,status:404}:{ok:true,json:async()=>({resultList:{result:[{id:'42',source:'MED',doi:'10.1000/example',title:'A paper',pubYear:'2020'}]}})}});assert.equal(fallback[0].pmid,'42');assert.equal(fallback[0].verificationStatus,'metadata-only');
});
test('distinct DOI punctuation does not collapse imported paper IDs',async()=>{
  const fetcher=async()=>({ok:true,json:async()=>({message:{items:[{DOI:'10.1000/a-b',title:['First']},{DOI:'10.1000/a/b',title:['Second']}]}})});
  const rows=await lookupPaperMetadata('two articles',{fetcher});assert.notEqual(rows[0].id,rows[1].id);
});
test('local storage corruption is reported and preserved',()=>{const storage=store();storage.setItem(EVIDENCE_STORAGE_KEY,'{bad');const loaded=loadEvidence(storage);assert.ok(loaded.storageError);assert.equal(storage.getItem(EVIDENCE_STORAGE_KEY),'{bad');assert.deepEqual(loaded.results,[]);});

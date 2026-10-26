import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyEvidence,validateEvidence,mergeEvidence,loadEvidence,saveEvidence,lookupPaperMetadata,EVIDENCE_STORAGE_KEY,safeSourceURL} from './evidence-workspace.js';
import {curatedResults,additionalResultsReferences} from '../data/results.js';
import {literatureTopics,literatureModalities} from '../data/literature.js';
const curated = () => structuredClone({...emptyEvidence(),references:additionalResultsReferences,results:curatedResults});
const store = () => { const map = new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}; };
test('curated primary-source subset has complete provenance and preserves generic MNI',()=>{
  const report=validateEvidence(curated()); assert.equal(report.valid,true,report.errors.join('\n'));
  assert.equal(curatedResults.length,4); assert.equal(new Set(curatedResults.map(r=>r.referenceId)).size,3);
  assert.equal(curatedResults.flatMap(r=>r.coordinates).length,8);
  for(const r of curatedResults){for(const c of r.coordinates){assert.equal(c.space,'MNI-unspecified');assert.equal(c.status,'source-checked');assert.ok(c.sourceTable&&c.sourceRow&&c.sourceUrl&&c.frameNote);}
    assert.ok(r.topics.every(id=>literatureTopics.some(t=>t.id===id)));assert.ok(r.modalities.every(id=>literatureModalities.some(m=>m.id===id)));
  }
});
test('invalid spaces, numeric strings, nonfinite/out-of-range coordinates and missing provenance are rejected',()=>{
  for(const patch of [{space:'MNI'},{space:'invented-template'},{x:'50'},{y:NaN},{z:Infinity},{x:301},{sourceTable:''},{sourceRow:''},{sourceUrl:'javascript:alert(1)'},{frameNote:''},{status:'human-verified'}]){
    const payload=curated();Object.assign(payload.results[0].coordinates[0],patch);assert.equal(validateEvidence(payload).valid,false,JSON.stringify(patch));
  }
});
test('draft remains draft and cannot silently acquire a checked status',()=>{
  const payload=curated();payload.results[0].curationStatus='draft';payload.results[0].coordinates[0].status='draft';
  const report=validateEvidence(payload);assert.equal(report.valid,true);assert.equal(report.value.results[0].coordinates[0].status,'draft');assert.ok(report.warnings.some(w=>w.includes('draft coordinate')));
});
test('malformed packages return errors without throwing or changing stored data',()=>{
  for(const bad of ['{broken',null,{},[],{...emptyEvidence(),references:[null]},{...emptyEvidence(),results:[null]}, {...emptyEvidence(),references:[{id:'a',title:{en:'bad UI shape'},url:'https://example.org'}]}]) assert.equal(validateEvidence(bad).valid,false);
  const storage=store();saveEvidence(curated(),storage);const previous=storage.getItem(EVIDENCE_STORAGE_KEY);assert.throws(()=>saveEvidence({...curated(),schema:'wrong'},storage));assert.equal(storage.getItem(EVIDENCE_STORAGE_KEY),previous);
});
test('roundtrip persists results and explicit relation provenance',()=>{
  const payload=curated();payload.relations=[{id:'relation-a',fromResultId:'axelrod2015-rffa',toResultId:'axelrod2015-lffa',type:'complementary',rationale:'Different hemispheres and ROI sample sizes; not a direct contradiction.',annotator:'Researcher A',sourceUrl:'https://doi.org/10.1371/journal.pone.0117126'}];
  const storage=store();saveEvidence(payload,storage);assert.deepEqual(loadEvidence(storage),payload);
  const broken=structuredClone(payload);broken.relations[0].sourceUrl='';assert.equal(validateEvidence(broken).valid,false);broken.relations[0].sourceUrl='https://example.org';broken.relations[0].fromResultId='missing';assert.equal(validateEvidence(broken).valid,false);
});
test('upsert deduplicates DOI and rewrites imported findings to canonical paper ID',()=>{
  const base=curated(),incoming=curated();incoming.references=incoming.references.filter(r=>r.id==='axelrod2015');incoming.references[0].id='imported-paper';incoming.references[0].doi='https://doi.org/10.1371/journal.pone.0117126';incoming.results=incoming.results.filter(r=>r.id==='axelrod2015-rffa');incoming.results[0].referenceId='imported-paper';incoming.results[0].direction='Updated annotation';
  const merged=mergeEvidence(base,incoming);assert.equal(merged.references.length,3);assert.equal(merged.results.length,4);assert.equal(merged.results.find(r=>r.id==='axelrod2015-rffa').referenceId,'axelrod2015');assert.equal(merged.results.find(r=>r.id==='axelrod2015-rffa').direction,'Updated annotation');assert.notEqual(base.results.find(r=>r.id==='axelrod2015-rffa').direction,'Updated annotation');
});
test('known builtin references and results permit local-only relation and result packages',()=>{
  const payload={...emptyEvidence(),results:[curatedResults[0]],relations:[{id:'rel',fromResultId:'schaum2021-meg-stop',toResultId:'axelrod2015-rffa',type:'not-comparable',rationale:'Different tasks and modalities.',annotator:'Reader',sourceUrl:'https://elifesciences.org/articles/61679'}]};
  assert.equal(validateEvidence(payload).valid,false);assert.equal(validateEvidence(payload,{knownReferences:additionalResultsReferences,knownResults:curatedResults}).valid,true);
});
test('unsafe source protocols and unlicensed rehosting are rejected',()=>{
  assert.equal(safeSourceURL('data:text/html,test'),'');assert.equal(safeSourceURL('https://user:pass@example.org'),'');
  const payload=curated();payload.results[0].figures[0].imageUrl='javascript:alert(1)';assert.equal(validateEvidence(payload).valid,false);payload.results[0].figures[0].imageUrl='https://example.org/image.png';payload.results[0].figures[0].license='All rights reserved';payload.results[0].figures[0].rehosted=true;assert.equal(validateEvidence(payload).valid,false);
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

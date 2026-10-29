import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyEvidence,validateEvidence,mergeEvidence,loadEvidence,saveEvidence,lookupPaperMetadata,EVIDENCE_STORAGE_KEY,LEGACY_EVIDENCE_STORAGE_KEY,safeSourceURL} from './evidence-workspace.js';
import {migrateEvidence,getResultViewModel,resultViewModelToEvidence,removeEvidenceRecords} from './evidence-schema.js';
import {classifyMapping} from './evidence-mapping.js';
import {curatedEvidence,curatedResults,additionalResultsReferences} from '../data/results.js';
import {createEvidenceEditorState,updateEvidenceEditorField,prepareEvidenceEditorSubmission} from './evidence-editor.js';
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
  incoming.sourceArtifacts=[...incoming.sourceArtifacts,{id:'source',referenceId:imported,sourceReferenceId:imported,referenceIds:[imported]}];incoming.mappings=[classifyMapping({id:'mapping',referenceId:imported,claimId:incoming.claims[0].id})];
  incoming.reviewEvents.push({id:'paper-check',subjectId:imported,stage:'extracted',actorType:'ai',actorName:'Codex',date:'2026-10-29',scope:'Metadata only',sourceRefs:[],limitations:[],recordVersion:'1'});
  const copy=structuredClone(incoming),merged=mergeEvidence(base,incoming);
  for(const key of ['results','claims','readings','experiments','mappings','sourceArtifacts'])for(const row of merged[key].filter(r=>r.referenceId))assert.notEqual(row.referenceId,imported);
  const mergedSource=merged.sourceArtifacts.find(row=>row.id==='source');assert.equal(mergedSource.sourceReferenceId,oldId);assert.deepEqual(mergedSource.referenceIds,[oldId]);assert.equal(merged.reviewEvents.find(e=>e.id==='paper-check').subjectId,oldId);assert.deepEqual(incoming,copy);assert.equal(merged.references.length,3);
});
test('legacy text editor preserves structured fields, resets current checks and retains history',()=>{
  const b=curated(),vm=getResultViewModel('axelrod2015-lffa',b);vm.finding='Changed annotation';vm.curationStatus='draft';vm.coordinates[0].status='draft';
  const p=resultViewModelToEvidence(vm,b,{knownReferences:additionalResultsReferences});const merged=mergeEvidence(b,p);const updated=getResultViewModel(vm.id,merged);assert.equal(updated.finding,'Changed annotation');assert.equal(updated.curationStatus,'draft');assert.equal(updated.coordinates[0].status,'draft');assert.deepEqual(merged.results.find(r=>r.id===vm.id).statistics,b.results.find(r=>r.id===vm.id).statistics);assert.ok(merged.reviewEvents.some(e=>e.id===`${vm.id}:legacy-source-check`));
});

test('production editor payload saves only its referenced source artifacts with statistics and review anchors',()=>{
  for(const id of ['axelrod2015-lffa','schaum2021-meg-stop']){
    const original=curated(),record=getResultViewModel(id,original),referenceId=original.results.find(row=>row.id===id).referenceId;
    record.finding='Edited narrative; source observations retained';
    const options={knownReferences:additionalResultsReferences};
    const payload=resultViewModelToEvidence(record,original,options);
    assert.deepEqual(payload.sourceArtifacts.map(row=>row.id).sort(),original.sourceArtifacts.filter(row=>row.referenceId===referenceId).map(row=>row.id).sort());
    assert.equal(validateEvidence(payload,options).valid,true);
    assert.deepEqual(payload.results[0].statistics,original.results.find(row=>row.id===id).statistics);
    for(const event of payload.reviewEvents)for(const source of event.sourceRefs.filter(ref=>!/^https?:/.test(ref)))assert(payload.sourceArtifacts.some(artifact=>artifact.id===source));
    const storage=store();saveEvidence(payload,storage,options);const reopened=loadEvidence(storage,options);
    assert.deepEqual(reopened,payload);assert.deepEqual([...reopened.sourceArtifacts].sort((a,b)=>a.id.localeCompare(b.id)),original.sourceArtifacts.filter(row=>row.referenceId===referenceId).sort((a,b)=>a.id.localeCompare(b.id)));
    const merged=mergeEvidence(original,reopened,options);assert.equal(getResultViewModel(id,merged).reviewState.sourceChecked,false);
  }
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
test('reverting a built-in result override preserves an independently authored local relation',()=>{
  const options={knownReferences:additionalResultsReferences,knownResults:curatedResults},id='axelrod2015-lffa',b=curated();
  const vm=getResultViewModel(id,b);vm.finding='Local override';vm.curationStatus='draft';
  const local=resultViewModelToEvidence(vm,b,options);local.relations=[{id:'independent-relation',fromResultId:id,toResultId:'axelrod2015-rffa',type:'complementary',rationale:'Independent local comparison',annotator:'Reader',sourceUrl:'https://example.org/comparison'}];
  const next=removeEvidenceRecords(local,{resultIds:[id],retainedResultIds:[id]});assert.equal(next.results.length,0);assert.deepEqual(next.relations,local.relations);assert.equal(validateEvidence(next,options).valid,true);
  const merged=mergeEvidence(b,next,options);assert.deepEqual(merged.results.find(r=>r.id===id).finding,b.results.find(r=>r.id===id).finding);assert.equal(merged.relations[0].id,'independent-relation');
  assert.equal(removeEvidenceRecords(local,{resultIds:[id]}).relations.length,0);
});
test('paper pruning resolves native v2 experiment-owned results and removes only their dependent graph',()=>{
  const b=curated(),removedPaper='axelrod2015',removed=b.results.filter(r=>r.referenceId===removedPaper),sample=structuredClone(removed[0].sample);
  b.experiments=[{id:'native-experiment',referenceId:removedPaper,task:'Explicit native experiment',species:'human',sample,modalities:['fMRI'],sourceRefs:['https://example.org/experiment']}];
  for(const r of removed){delete r.referenceId;delete r.legacyV1;r.experimentId='native-experiment';}
  b.claims.push({id:'experiment-claim',referenceId:removedPaper,experimentId:'native-experiment',resultId:null,text:'Experiment-level claim',sourceRefs:[],limitations:[]});
  b.sourceArtifacts.push({id:'experiment-artifact',experimentId:'native-experiment'},{id:'claim-artifact',claimId:'experiment-claim'},{id:'unrelated-artifact',referenceId:'schaum2021'});
  b.mappings.push(classifyMapping({id:'claim-mapping',referenceId:removedPaper,claimId:'experiment-claim'}));
  b.relations=[{id:'cross-paper-relation',fromResultId:removed[0].id,toResultId:'schaum2021-meg-stop',type:'not-comparable',rationale:'Different methods',annotator:'Reader',sourceUrl:'https://example.org/relation'}];
  assert.equal(validateEvidence(b).valid,true);
  const before=structuredClone(b),next=removeEvidenceRecords(b,{referenceIds:[removedPaper]});assert.deepEqual(b,before);assert.equal(validateEvidence(next).valid,true);
  assert.equal(next.results.length,2);assert.equal(next.locations.length,6);assert.equal(next.experiments.length,0);assert.equal(next.relations.length,0);assert.ok(!next.claims.some(c=>c.referenceId===removedPaper));assert.ok(!next.mappings.some(m=>m.id==='claim-mapping'));assert.deepEqual(next.sourceArtifacts,b.sourceArtifacts.filter(row=>row.referenceId!==removedPaper&&!row.experimentId&&!row.claimId));assert.ok(next.reviewEvents.every(e=>!removed.some(r=>r.id===e.subjectId)));
  assert.deepEqual(next.results,b.results.filter(r=>!removed.some(x=>x.id===r.id)));
  // The selected-paper export prunes every unrelated paper using this same API.
  const selected=removeEvidenceRecords(b,{referenceIds:b.references.filter(r=>r.id!==removedPaper).map(r=>r.id)});assert.equal(validateEvidence(selected).valid,true);assert.deepEqual(selected.results.map(r=>r.id),removed.map(r=>r.id));assert.equal(selected.experiments.length,1);assert.equal(selected.locations.length,2);
});
test('shared editor adapter never restamps inherited checks onto edited content',()=>{
  const b=curated(),id='axelrod2015-lffa',vm=getResultViewModel(id,b),history=structuredClone(b.reviewEvents.filter(e=>[id,vm.coordinates[0].id].includes(e.subjectId)));
  vm.finding='Changed without manually resetting inherited status';vm.coordinates[0].x-=1;
  const payload=resultViewModelToEvidence(vm,b,{knownReferences:additionalResultsReferences});
  const result=payload.results[0],newVersion=result.recordVersion;assert.ok(payload.reviewEvents.every(e=>e.recordVersion!==newVersion));
  const merged=mergeEvidence(b,payload),view=getResultViewModel(id,merged);assert.equal(view.reviewState.sourceChecked,false);assert.equal(view.coordinates[0].status,'draft');for(const event of history)assert.deepEqual(merged.reviewEvents.find(e=>e.id===event.id),event);
  merged.reviewEvents.push({id:'fresh-check',subjectId:id,stage:'source-checked',actorType:'ai',actorName:'Codex',date:'2026-10-29',scope:'Explicit fresh check of changed text',sourceRefs:['https://example.org/source'],limitations:[],recordVersion:newVersion});assert.equal(validateEvidence(merged).valid,true);assert.equal(getResultViewModel(id,merged).reviewState.sourceChecked,true);
});
test('real editor submission contract saves new checks and edited rechecks without promoting inherited flags',()=>{
  const b=curated(),options={knownReferences:additionalResultsReferences},original=getResultViewModel('axelrod2015-lffa',b);
  const details={actorType:'human',actorName:'Named source annotator',date:'2026-10-29',scope:'Checked Table 1 and the revised result text'};
  const submit=state=>{const {record,reviewIntent}=prepareEvidenceEditorSubmission('result',state);return resultViewModelToEvidence(record,b,{...options,reviewIntent});};
  const newRecord={...structuredClone(original),id:'new-editor-result',curationStatus:'draft',annotator:'',curationNote:'',coordinates:original.coordinates.map(c=>({...c,id:'new-editor-location',status:'draft'}))};
  let state=createEvidenceEditorState(newRecord);state=updateEvidenceEditorField(state,'curationStatus','source-checked');state=updateEvidenceEditorField(state,'coordinates',state.draft.coordinates.map(c=>({...c,status:'source-checked'})),{coordinateCheckId:'new-editor-location',statusOnly:true});state={...state,reviewDetails:details};
  const added=submit(state),newView=getResultViewModel(newRecord.id,added);assert.equal(validateEvidence(added,options).valid,true);assert.equal(newView.curationStatus,'source-checked');assert.equal(newView.coordinates[0].status,'source-checked');assert.equal(newView.reviewState.humanReviewed,false);assert.equal(newView.annotator,details.actorName);assert.equal(newView.curationNote,details.scope);assert.equal(newView.checkedAt,details.date);assert.ok(added.reviewEvents.every(e=>e.stage==='source-checked'&&e.date===details.date&&e.actorName===details.actorName));
  state=createEvidenceEditorState(original);state=updateEvidenceEditorField(state,'finding','Rechecked changed finding');state=updateEvidenceEditorField(state,'coordinates',state.draft.coordinates.map(c=>({...c,x:c.x-1,status:'draft'})));state=updateEvidenceEditorField(state,'curationStatus','source-checked');state=updateEvidenceEditorField(state,'coordinates',state.draft.coordinates.map(c=>({...c,status:'source-checked'})),{coordinateCheckId:original.coordinates[0].id,statusOnly:true});state={...state,reviewDetails:{...details,actorType:'ai',actorName:'Codex AI'}};
  const edited=submit(state),merged=mergeEvidence(b,edited),view=getResultViewModel(original.id,merged);assert.equal(view.reviewState.sourceChecked,true);assert.equal(view.coordinates[0].status,'source-checked');assert.equal(view.reviewState.humanReviewed,false);for(const event of b.reviewEvents.filter(e=>e.subjectId===original.id))assert.deepEqual(merged.reviewEvents.find(e=>e.id===event.id),event);
  const inherited=createEvidenceEditorState({...original,finding:'Changed without fresh editor selection'});const unchangedIntent=submit(inherited);assert.equal(getResultViewModel(original.id,unchangedIntent).reviewState.sourceChecked,false);assert.equal(getResultViewModel(original.id,unchangedIntent).coordinates[0].status,'draft');
  let coordinateOnly=createEvidenceEditorState(original);coordinateOnly=updateEvidenceEditorField(coordinateOnly,'coordinates',coordinateOnly.draft.coordinates,{coordinateCheckId:original.coordinates[0].id,statusOnly:true});coordinateOnly={...coordinateOnly,reviewDetails:{...details,actorType:'unknown'}};const coordinatePayload=submit(coordinateOnly),coordinateView=getResultViewModel(original.id,coordinatePayload);assert.equal(coordinateView.reviewState.sourceChecked,false);assert.equal(coordinateView.coordinates[0].status,'source-checked');assert.equal(coordinateView.reviewState.humanReviewed,false);
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

test('independent package import and DOI alias merge preserve the complete reading graph',async()=>{
  const {getBuiltinEvidenceBundle,buildEvidencePackage,getReadingViewModel}=await import('./evidence-package.js');
  const original=buildEvidencePackage({paperIds:['kanwisher1997'],bundle:getBuiltinEvidenceBundle()});
  const incoming=structuredClone(original),alias='imported-kanwisher';
  incoming.references[0].id=alias;incoming.references[0].doi='https://doi.org/'+incoming.references[0].doi.toUpperCase();
  for(const key of ['readings','claims','mappings','experiments'])for(const row of incoming[key])row.referenceId=alias;
  const before=structuredClone(incoming),merged=mergeEvidence(original,incoming);
  assert.equal(merged.references.length,1);
  for(const key of ['readings','claims','mappings','experiments'])assert.ok(merged[key].every(row=>row.referenceId==='kanwisher1997'));
  assert.deepEqual(getReadingViewModel('kanwisher1997',merged).resultSummaries,getReadingViewModel('kanwisher1997',original).resultSummaries);
  assert.deepEqual(incoming,before);
});

test('file import validates package closure before any storage write',async()=>{
  const api=await import('./evidence-workspace.js');
  assert.equal(typeof api.validateEvidenceImport,'function','file import has a closed-graph validation boundary');
  const {getBuiltinEvidenceBundle,buildEvidencePackage}=await import('./evidence-package.js');
  const packageValue=buildEvidencePackage({paperIds:['kanwisher1997'],bundle:getBuiltinEvidenceBundle()});
  assert.equal(api.validateEvidenceImport(JSON.stringify(packageValue)).valid,true);
  const bad=structuredClone(packageValue);bad.readings[0].methodProvenance.source='missing-source';
  const storage=store();storage.setItem(EVIDENCE_STORAGE_KEY,JSON.stringify(packageValue));const before=storage.getItem(EVIDENCE_STORAGE_KEY);
  const report=api.validateEvidenceImport(bad);assert.equal(report.valid,false);assert.equal(storage.getItem(EVIDENCE_STORAGE_KEY),before);
  assert.equal(api.validateEvidenceImport(fixture).valid,true);
});

test('E5-R1 aliased source package imports back into original builtins and known-reference local storage',async()=>{
  const {getBuiltinEvidenceBundle,buildEvidencePackage,validateEvidencePackageClosure}=await import('./evidence-package.js');
  const builtin=getBuiltinEvidenceBundle(),paper='axelrod2015',canonical='canonical-axelrod';
  const original=buildEvidencePackage({paperIds:[paper],bundle:builtin});
  const base={...emptyEvidence(),references:original.references.map(r=>({...structuredClone(r),id:canonical}))};
  const outward=buildEvidencePackage({paperIds:[canonical],bundle:mergeEvidence(base,original),includePrivate:true});
  assert.equal(validateEvidencePackageClosure(outward).valid,true);
  for(const [target,options] of [[builtin,{}],[emptyEvidence(),{knownReferences:builtin.references,knownResults:builtin.results}]]){
    const before=structuredClone(outward),merged=mergeEvidence(target,outward,options);
    assert.ok(!merged.referenceAliases?.some(a=>a.aliasId===a.canonicalId));
    assert.ok(merged.results.filter(r=>r.id.startsWith(paper)).every(r=>r.referenceId===paper));
    assert.deepEqual(merged.sourceArtifacts.find(a=>a.id==='axelrod2015-v1'),original.sourceArtifacts[0]);
    assert.equal(validateEvidencePackageClosure(buildEvidencePackage({paperIds:[paper],bundle:merged,includePrivate:true})).valid,true);
    assert.deepEqual(outward,before);
  }
});

test('E5-R1/R3 reverse alias import rejects loss of an established original title baseline',async()=>{
  const {getBuiltinEvidenceBundle,buildEvidencePackage}=await import('./evidence-package.js');
  const builtin=getBuiltinEvidenceBundle(),original=buildEvidencePackage({paperIds:['axelrod2015'],bundle:builtin});
  const base={...emptyEvidence(),references:original.references.map(r=>({...structuredClone(r),id:'canonical-axelrod'}))};
  const outward=buildEvidencePackage({paperIds:['canonical-axelrod'],bundle:mergeEvidence(base,original),includePrivate:true});
  outward.references[0].title+=' changed before returning to original library';
  const before=structuredClone(builtin);
  assert.throws(()=>mergeEvidence(builtin,outward),/historical reference title/);
  assert.deepEqual(builtin,before);
});

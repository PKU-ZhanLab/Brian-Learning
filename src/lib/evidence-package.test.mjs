import test from 'node:test';
import assert from 'node:assert/strict';
import {curatedEvidence} from '../data/results.js';
import {literaturePapers} from '../data/literature.js';
import {emptyEvidence,validateEvidenceV2,getResultViewModel} from './evidence-schema.js';
const api=await import('./evidence-package.js').catch(()=>({}));
const {buildEvidencePackage,validateEvidencePackageClosure,getBuiltinEvidenceBundle,getReadingViewModel}=api;

test('reading-only export is independently interpretable',()=>{
  assert.equal(typeof buildEvidencePackage,'function','self-contained package builder must exist');
  const bundle=getBuiltinEvidenceBundle(),before=structuredClone(bundle);
  const exported=buildEvidencePackage({paperIds:['kanwisher1997'],bundle,includePrivate:false});
  assert.equal(exported.results.length,0);
  assert.ok(exported.claims.length>0&&exported.mappings.length>0&&exported.readings.length>0);
  const copy=JSON.parse(JSON.stringify(exported));
  assert.equal(validateEvidencePackageClosure(copy).valid,true);
  assert.equal(validateEvidenceV2(copy,{knownReferences:[],knownResults:[],knownRegions:undefined}).valid,true);
  assert.ok(exported.dataVersion&&exported.mappings.every(mapping=>mapping.limitations));
  const original=literaturePapers.find(p=>p.id==='kanwisher1997'),reading=getReadingViewModel('kanwisher1997',copy);
  for(const field of ['resultSummaries','methodProvenance','limitations','modalities','topics'])assert.deepEqual(reading[field],original[field]);
  assert.deepEqual(reading.mappedRegions,original.mappedRegions);
  assert.ok(copy.claims[0].sourceRefs[0].startsWith('https://'));
  assert.ok(copy.mappings.every(m=>m.targetRegionRef===null));
  assert.deepEqual(bundle,before);
});

test('public exports use canonical content and disclose only selected exclusions',()=>{
  const bundle=getBuiltinEvidenceBundle();
  bundle.readings.find(r=>r.referenceId==='kanwisher1997').resultSummaries='PRIVATE OVERRIDE';
  bundle.references.find(r=>r.id==='kanwisher1997').notes='SECRET';
  bundle.references.push({id:'private-paper',title:'SECRET PAPER',url:'https://example.org',public:true});
  bundle.notes=['SECRET'];bundle.volumes=[{id:'private-image',bytes:'SECRET'}];
  const exported=buildEvidencePackage({paperIds:['kanwisher1997','private-paper'],bundle});
  const json=JSON.stringify(exported);assert.ok(!json.includes('SECRET')&&!json.includes('PRIVATE OVERRIDE'));
  assert.deepEqual(exported.references.map(r=>r.id),['kanwisher1997']);
  assert.ok(exported.exclusions.some(e=>e.reason==='not-in-public-manifest'));
  assert.equal(validateEvidencePackageClosure(exported).valid,true);
});

test('local selected closure retains exact sources, versions, history and excludes unrelated data',()=>{
  const bundle=getBuiltinEvidenceBundle();bundle.references.find(r=>r.id==='axelrod2015').notes='PRIVATE NOTE';
  bundle.readings.find(r=>r.referenceId==='kanwisher1997').resultSummaries='UNSELECTED PRIVATE READING';
  bundle.results.find(r=>r.id==='axelrod2015-rffa').finding='Selected local revision';
  bundle.results.find(r=>r.id==='axelrod2015-rffa').notes='PRIVATE NOTE';
  bundle.relations=[{id:'cross-paper',fromResultId:'axelrod2015-rffa',toResultId:'schaum2021-meg-stop',type:'not-comparable',rationale:'different tasks',annotator:'Reader',sourceUrl:'https://example.org'}];
  const before=structuredClone(bundle),out=buildEvidencePackage({paperIds:['axelrod2015'],bundle,includePrivate:true});
  assert.equal(validateEvidencePackageClosure(out).valid,true);
  assert.equal(getResultViewModel('axelrod2015-rffa',out).finding,'Selected local revision');
  assert.deepEqual(out.sourceArtifacts,bundle.sourceArtifacts.filter(a=>a.referenceId==='axelrod2015'));
  assert.deepEqual(out.reviewEvents,bundle.reviewEvents.filter(e=>[...out.results,...out.locations].some(r=>r.id===e.subjectId)));
  assert.equal(out.relations.length,0);assert.ok(out.exclusions.some(e=>e.id==='cross-paper'));
  assert.ok(!JSON.stringify(out).includes('PRIVATE NOTE')&&!JSON.stringify(out).includes('UNSELECTED PRIVATE'));
  assert.equal(out.locations.length,2);assert.ok(out.locations.every(l=>l.sourceSpaceId==='MNI-unspecified'));
  assert.deepEqual(bundle,before);
});

test('closure rejects missing reference, mapping, method and nested source endpoints',()=>{
  const reading=buildEvidencePackage({paperIds:['kanwisher1997'],bundle:getBuiltinEvidenceBundle()});
  for(const mutate of [b=>b.references=[],b=>b.claims=[],b=>b.mappings[0].claimId='missing',b=>b.readings[0].methodProvenance.source='artifact-missing',b=>b.claims[0].sourceRefs=['artifact-missing'],b=>b.mappings[0].sourceRefs=[{url:'javascript:bad'}]]){
    const bad=structuredClone(reading);mutate(bad);assert.equal(validateEvidencePackageClosure(bad).valid,false);
  }
});

test('non-redistributable source content becomes a resolvable limited source reference',()=>{
  const bundle=structuredClone(curatedEvidence),source=bundle.sourceArtifacts.find(a=>a.referenceId==='axelrod2015');
  source.excerpt={cells:[{id:'fulltext',rawText:'RESTRICTED FULL TEXT'}]};source.rights='All rights reserved';
  bundle.results.find(r=>r.id==='axelrod2015-rffa').sourceRefs=[source.id];
  const out=buildEvidencePackage({paperIds:['axelrod2015'],bundle,includePrivate:true});
  assert.ok(!JSON.stringify(out).includes('RESTRICTED FULL TEXT'));
  assert.ok(out.sourceArtifacts.some(a=>a.id===source.id&&a.sourceUrl&&a.contentOmitted));
  assert.equal(validateEvidencePackageClosure(out).valid,true);
});


test('unreferenced private source rows are not selected merely by paper ownership',()=>{
  const bundle=getBuiltinEvidenceBundle();
  bundle.sourceArtifacts.push({id:'unselected-image',referenceId:'kanwisher1997',sourceUrl:'https://example.org/private-image',rights:'Private',excerpt:{cells:[{rawText:'PRIVATE VOLUME'}]}});
  const out=buildEvidencePackage({paperIds:['kanwisher1997'],bundle,includePrivate:true});
  assert.equal(out.sourceArtifacts.length,0);assert.ok(!JSON.stringify(out).includes('unselected-image'));
});

test('synthetic non-builtin reading is reconstructed from JSON and exports faithfully',()=>{
  const out=buildEvidencePackage({paperIds:['kanwisher1997'],bundle:getBuiltinEvidenceBundle()});
  const original=getReadingViewModel('kanwisher1997',out),id='synthetic-reading';
  out.references[0]={...out.references[0],id,title:'Synthetic reading fixture',doi:''};
  for(const key of ['readings','claims','mappings'])for(const row of out[key])row.referenceId=id;
  const imported=JSON.parse(JSON.stringify(out));
  const vm=getReadingViewModel(id,imported);assert.deepEqual(vm.resultSummaries,original.resultSummaries);assert.deepEqual(vm.mappedRegions.map(m=>m.support),original.mappedRegions.map(m=>m.support));
  assert.equal(validateEvidencePackageClosure(imported).valid,true);
  const again=buildEvidencePackage({paperIds:[id],bundle:imported,includePrivate:true});
  assert.deepEqual(getReadingViewModel(id,again),vm);
});

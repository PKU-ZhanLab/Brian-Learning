import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrateEvidence, validateEvidenceV2, deriveReviewState, getResultViewModel} from './evidence-schema.js';
import {literatureByReferenceId} from '../data/literature.js';
import {references} from '../data/references.js';
import {additionalReferences} from '../data/references-expanded.js';
import {additionalLiteratureReferences} from '../data/literature.js';
const bytes=readFileSync(new URL('../../tests/fixtures/evidence-v1-baseline.json',import.meta.url));
const fixture=JSON.parse(bytes);
test('v1 migration preserves unknowns and review scope',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'76078639bb42e23994695d9e6bf922f8200a6305e9e818fe29a7c1e24ac91c2a');
  const original=structuredClone(fixture),{value,warnings}=migrateEvidence(fixture);
  assert.deepEqual(fixture,original);assert.deepEqual(value.legacyV1,original);
  assert.equal(value.results.length,4);assert.equal(value.locations.length,8);
  assert.ok(value.locations.every(l=>l.sourceSpaceId==='MNI-unspecified'));
  assert.deepEqual(value.locations.map(l=>l.xyz),fixture.results.flatMap(r=>r.coordinates.map(c=>[c.x,c.y,c.z])));
  assert.deepEqual(getResultViewModel('schaum2021-meg-stop',value).modalities,['MEG']);
  assert.equal(deriveReviewState(value.reviewEvents).humanReviewed,false);
  assert.ok(warnings.length);assert.equal(value.experiments.length,0);
  for(const r of value.results){assert.equal(r.experimentId,null);assert.equal(r.timeWindow.state,'not-extracted');assert.equal(r.frequencyBand.state,'not-extracted');assert.equal(r.effectEstimate.state,'not-extracted');}
  assert.ok(value.reviewEvents.every(e=>e.actorType==='ai'));
  assert.equal(validateEvidenceV2(value).valid,true);
  for(const r of fixture.results){const vm=getResultViewModel(r.id,value);for(const key of Object.keys(r).filter(k=>k!=='coordinates'))assert.deepEqual(vm[key],r[key],`${r.id}/${key}`);for(const c of r.coordinates){const shown=vm.coordinates.find(x=>x.id===c.id);for(const key of Object.keys(c))assert.deepEqual(shown[key],c[key]);}}
});
test('review stages remain independent and human review requires an actual scoped reviewer',()=>{
  const event={id:'review',subjectId:'r',stage:'source-checked',actorType:'ai',actorName:'Codex AI',date:'2026-10-29',scope:'Selected table cells',sourceRefs:['https://example.org/table'],limitations:[],recordVersion:'1'};
  assert.equal(deriveReviewState([event]).sourceChecked,true);assert.equal(deriveReviewState([event]).spaceChecked,false);assert.equal(deriveReviewState([event]).humanReviewed,false);
  const bundle=migrateEvidence(fixture).value;
  for(const patch of [{actorType:'ai'},{actorName:''},{date:''},{date:'2026-02-30'},{scope:''},{actorName:'unknown'},{recordVersion:''}]){
    bundle.reviewEvents=[{...event,subjectId:bundle.results[0].id,stage:'human-reviewed',actorType:'human',actorName:'Actual Reviewer',...patch}];
    assert.equal(validateEvidenceV2(bundle).valid,false,JSON.stringify(patch));assert.equal(deriveReviewState(bundle.reviewEvents).humanReviewed,false);
  }
  bundle.reviewEvents=[{...event,subjectId:bundle.results[0].id,stage:'human-reviewed',actorType:'human',actorName:'Actual Reviewer'}];
  assert.equal(validateEvidenceV2(bundle).valid,true);assert.equal(getResultViewModel(bundle.results[1].id,bundle).reviewState.humanReviewed,false);
});
test('missing states and units are validated without numeric coercion',()=>{
  const bundle=migrateEvidence(fixture).value;
  for(const bad of [{state:'reported',value:0,sourceRefs:[]},{state:'not-extracted',reason:'',sourceRefs:[]}]){const b=structuredClone(bundle);b.results[0].timeWindow=bad;assert.equal(validateEvidenceV2(b).valid,false);}
  const b=structuredClone(bundle);b.locations[0].xyz[0]='50';assert.equal(validateEvidenceV2(b).valid,false);
});
test('legacy reading summaries become reading claims without creating results or experiments',()=>{
  const reading=structuredClone(literatureByReferenceId.tsao2006),refs=[...references,...additionalReferences,...additionalLiteratureReferences],reference=refs.find(r=>r.id===reading.referenceId);
  const old={schema:'brain-evidence-v1',references:[reference],readings:[reading],results:[],relations:[]};
  const {value}=migrateEvidence(old);assert.equal(value.results.length,0);assert.equal(value.experiments.length,0);assert.equal(value.readings.length,1);assert.equal(value.claims[0].resultId,null);assert.equal(value.claims[0].experimentId,null);assert.deepEqual(value.readings[0].methodProvenance,reading.methodProvenance);assert.deepEqual(value.readings[0].limitations,reading.limitations);assert.deepEqual(value.mappings.map(m=>m.support),reading.mappedRegions.map(m=>m.support));assert.equal(validateEvidenceV2(value).valid,true);
});
test('malformed nested v2 fields return reports and cannot evade source or owner checks',()=>{
  const original=migrateEvidence(fixture).value;
  for(const field of ['modalities','locationIds','claimIds'])for(const bad of [null,{},'wrong']){const b=structuredClone(original);b.results[0][field]=bad;assert.equal(validateEvidenceV2(b).valid,false);}
  const b=structuredClone(original);b.results[0].timeWindow={state:'not-extracted',reason:'Missing',sourceRefs:[],value:0};assert.equal(validateEvidenceV2(b).valid,false);
  const c=structuredClone(original);c.locations[0].sourceRefs=['javascript:alert(1)'];assert.equal(validateEvidenceV2(c).valid,false);
  const d=structuredClone(original);d.results[0].locationIds.push(d.locations[4].id);assert.equal(validateEvidenceV2(d).valid,false);
});
test('curated numeric facts retain source, side, correction and uncertainty distinctions',async()=>{
  const {curatedEvidence}=await import('../data/results.js');
  const left=curatedEvidence.results.find(r=>r.id==='axelrod2015-lffa'),right=curatedEvidence.results.find(r=>r.id==='axelrod2015-rffa');
  assert.equal(left.statistics.value[0].value,2.57);assert.equal(left.statistics.value[0].df,12);
  assert.deepEqual(left.statistics.value.map(s=>[s.p.value,s.p.operator]),[[.012,'='],[.01,'=']]);
  assert.notDeepEqual(left.statistics.value[0].sourceRefs,left.statistics.value[1].sourceRefs);
  assert.equal(left.correction.value.passed,false);assert.equal(left.sample.perAnalysis.value,13);assert.equal(right.sample.perAnalysis.value,16);
  const tpj=curatedEvidence.locations.find(l=>l.id==='bosco-tpj');assert.deepEqual(tpj.dispersion.value.value,[1.2,3.3,3.6]);assert.equal(tpj.dispersion.value.kind,'sd');assert.equal(tpj.uncertainty.kind,'unknown');
  assert.equal(deriveReviewState(curatedEvidence.reviewEvents).humanReviewed,false);assert.ok(curatedEvidence.locations.every(l=>l.sourceSpaceId==='MNI-unspecified'));
  assert.equal(validateEvidenceV2(curatedEvidence).valid,true);
});
test('reported zero effect is distinct from missing variance and interval',()=>{
  const b=migrateEvidence(fixture).value;
  b.results[0].effectEstimate={state:'reported',sourceRefs:['https://example.org/table'],value:{type:'mean-difference',value:0,unit:'ms',variance:{state:'not-extracted',reason:'Not extracted',sourceRefs:[]},interval:{state:'not-reported',reason:'Source did not report an interval',sourceRefs:['https://example.org/table']}}};
  assert.equal(validateEvidenceV2(b).valid,true);assert.equal(b.results[0].effectEstimate.value.variance.state,'not-extracted');
  b.results[0].effectEstimate.value.variance={state:'reported',value:-1,sourceRefs:['https://example.org/table']};assert.equal(validateEvidenceV2(b).valid,false);
});
test('each statistic requires a safe resolvable source and malformed statistics return a report',async()=>{
  const {curatedEvidence}=await import('../data/results.js');
  for(const bad of [null,3,'t',[],{}, {type:'t',value:2,df:12,unit:'dimensionless',p:null,sourceRefs:['javascript:alert(1)']}, {type:'t',value:2,df:12,unit:'dimensionless',p:null,sourceRefs:['missing-artifact']}]){
    const b=structuredClone(curatedEvidence);b.results[1].statistics.value=[bad];let report;assert.doesNotThrow(()=>{report=validateEvidenceV2(b);});assert.equal(report.valid,false,JSON.stringify(bad));assert.ok(report.errors.some(e=>e.includes('statistics')));
  }
  const b=structuredClone(curatedEvidence);b.sourceArtifacts=[{id:'statistic-source'}];b.results[1].statistics.value[0].sourceRefs=['statistic-source'];assert.equal(validateEvidenceV2(b).valid,true);
});

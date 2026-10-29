import test from 'node:test';
import assert from 'node:assert/strict';
import {literaturePapers} from '../data/literature.js';
import {structures} from '../data/catalog.js';
import {classifyMapping, buildLocateRequest} from './evidence-mapping.js';

// Frozen audit relationships, deliberately explicit: deleting a row cannot fix it.
const affectedFixtures = [
  ['hubel1962','pericalcarine-l','cat'], ['hubel1962','pericalcarine-r','cat'],
  ['hafting2005','entorhinal-l','rat'], ['hafting2005','entorhinal-r','rat'],
  ['padoaschioppa2006','medial-orbitofrontal-l','nonhuman-primate'],
  ['padoaschioppa2006','medial-orbitofrontal-r','nonhuman-primate'],
  ['graziano2002','precentral-l','nonhuman-primate'], ['graziano2002','precentral-r','nonhuman-primate'],
  ['rexed1952','spinal-gray','cat'], ['rexed1952','spinal-posterior-horn-l','cat'],
  ['rexed1952','spinal-posterior-horn-r','cat'],
];
const mappings = literaturePapers.flatMap(p=>p.mappedRegions);

test('species and hemisphere are retained per mapping', () => {
  const activeIds = new Set(structures.filter(s=>s.category!=='spinal').map(s=>s.id));
  const spinalIds = new Set(structures.filter(s=>s.category==='spinal').map(s=>s.id));
  const affected = affectedFixtures.map(([referenceId,targetConceptId,species])=>{
    const m=mappings.find(m=>m.referenceId===referenceId&&m.targetConceptId===targetConceptId);
    assert.ok(m, `Missing audited relationship ${referenceId}/${targetConceptId}`);
    assert.equal(m.sourceRegion.species,species);
    assert.equal(m.sourceRegion.hemisphere,'U','Unextracted source laterality must not be copied from a human target');
    assert.ok(m.sourceRegion.label, 'Animal source label must be separate from the target');
    assert.equal(m.targetRegionRef,null,'A concept reading link must not invent an atlas label identity');
    return m;
  });
  assert.equal(affected.filter(m=>activeIds.has(m.targetConceptId)).length,8);
  assert.equal(affected.filter(m=>spinalIds.has(m.targetConceptId)).length,3);
  assert.ok(affected.every(m=>m.support==='cross-species'&&m.directEvidence===false));
  assert.deepEqual(buildLocateRequest('silani2013',{mappings}).directMappings.map(m=>m.targetConceptId),['supramarginal-r']);
  assert.equal(buildLocateRequest('bentin1996',{mappings}).directMappings.length,0);
  assert.ok(buildLocateRequest('dronkers2007',{mappings}).directMappings.every(m=>m.targetConceptId.endsWith('-l')));
  assert.ok(mappings.every(m=>m.space===null&&m.coordinates===null),'Reading support does not grant coordinate overlay');
});

test('context is opt-in and retains side-specific provenance and limitations',()=>{
  assert.equal(buildLocateRequest('silani2013',{mappings}).contextMappings.length,0);
  const request=buildLocateRequest('silani2013',{mappings,includeContext:true});
  assert.deepEqual(request.contextMappings.map(m=>m.targetConceptId),['supramarginal-l']);
  assert.equal(request.directMappings[0].sourceRegion.hemisphere,'R');
  assert.equal(request.contextMappings[0].sourceRegion.hemisphere,'R');
  assert.match(request.contextMappings[0].limitations.en,/left/i);
  assert.ok(request.limitations.some(v=>/left/i.test(v.en)));
});

test('unknown, mixed and new animal species cannot inherit human direct support',()=>{
  for(const species of ['zebrafish','mixed','unspecified',null]){
    const m=classifyMapping({id:species||'missing',referenceId:'new',targetConceptId:'insula-l',sourceRegion:{species,label:'insula',hemisphere:'L',spaceId:null},measurementKind:'direct-measurement',support:'direct',mappingKind:'author-reported',sourceRefs:[{url:'https://example.org/paper'}],limitations:[]});
    assert.notEqual(m.support,'direct',String(species));
    assert.equal(m.directEvidence,false);
  }
  for(const sourceRegion of [{species:'human',label:null,hemisphere:'L'},{species:'human',label:'insula',hemisphere:'U'}]){
    assert.notEqual(classifyMapping({sourceRegion,measurementKind:'direct-measurement',support:'direct',mappingKind:'author-reported',targetConceptId:'insula-l'}).support,'direct');
  }
});

test('same target claims remain distinct and classification does not mutate input',()=>{
  const rows=[
    {id:'claim-a-map',claimId:'claim-a',referenceId:'p',sourceRegion:{species:'human',label:'insula',hemisphere:'L',spaceId:null},targetConceptId:'insula-l',measurementKind:'direct-measurement',support:'direct',mappingKind:'author-reported',limitations:{zh:'小样本',en:'Small sample'}},
    {id:'claim-b-map',claimId:'claim-b',referenceId:'p',sourceRegion:{species:'human',label:'insula',hemisphere:'R',spaceId:null},targetConceptId:'insula-l',measurementKind:'direct-measurement',support:'context',mappingKind:'contextual',limitations:{zh:'仅右侧',en:'Right side only'}},
  ];
  const before=structuredClone(rows);
  const request=buildLocateRequest('p',{mappings:rows,includeContext:true});
  assert.deepEqual(request.directMappings.map(m=>m.id),['claim-a-map']);
  assert.deepEqual(request.contextMappings.map(m=>m.id),['claim-b-map']);
  assert.deepEqual(request.limitations,[{zh:'小样本',en:'Small sample'},{zh:'仅右侧',en:'Right side only'}]);
  assert.deepEqual(rows,before);
});

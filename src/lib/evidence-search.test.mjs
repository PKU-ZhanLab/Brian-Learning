import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildEvidenceSearchIndex,searchEvidence,describeStudyModalities} from './evidence-search.js';
import {curatedEvidence} from '../data/results.js';
import {literaturePapers} from '../data/literature.js';
import {structures} from '../data/catalog.js';
import {emptyEvidence,missing,reported} from './evidence-schema.js';

const aliases=JSON.parse(await readFile(new URL('../../data-sources/results/search-aliases.json',import.meta.url),'utf8'));
const index=buildEvidenceSearchIndex({...curatedEvidence,readings:literaturePapers},{aliases,regions:structures});
const ids=hits=>hits.map(hit=>hit.referenceId);

test('bilingual aliases and paper methods remain searchable',()=>{
  for(const language of ['zh','en']){
    for(const query of ['pre-SMA','pre SMA','BA44','BA44/45','停止','inhibitory','前辅助运动区','pre‑SMA']){
      assert.ok(ids(searchEvidence(index,{query,language})).includes('schaum2021'),`${language}: ${query}`);
    }
  }
  assert.ok(ids(searchEvidence(index,{topic:'control',paperModality:'fMRI'})).includes('schaum2021'));
  assert.ok(!searchEvidence(index,{resultModality:'fMRI'}).flatMap(hit=>hit.resultIds).includes('schaum2021-meg-stop'));
  assert.deepEqual(searchEvidence(index,{query:'pre-SMA',paperModality:'fMRI'})[0].resultIds,['schaum2021-meg-stop']);
  assert.deepEqual(ids(searchEvidence(index,{query:'停止',language:'zh'})),ids(searchEvidence(index,{query:'停止',language:'en'})));
  assert.ok(searchEvidence(index,{query:'前辅助运动区'})[0].matchedFields.some(field=>field.includes('aliases')));
  assert.deepEqual(curatedEvidence.results.find(r=>r.id==='schaum2021-meg-stop').modalities,['MEG']);
});

test('index searches both languages and all source fields without changing mapping identity',()=>{
  const target={atlasId:'test',atlasVersion:'1',labelId:44,hemisphere:'R',spaceId:'native'};
  const bundle={...emptyEvidence(),references:[{id:'paper',title:'A title',titleZh:'中文标题',abstract:{zh:'中文摘要',en:'English abstract'}}],
    results:[{id:'result',referenceId:'paper',finding:{zh:'发现',en:'finding'},contrast:{zh:'条件一',en:'condition one'},modalities:['MEG'],locationIds:['loc'],limitations:[{zh:'局限一',en:'limit one'}],legacyV1:{roiDefinition:{zh:'独立定位',en:'independent localizer'}}}],
    locations:[{id:'loc',resultId:'result',sourceLabel:'original peak',legacyV1:{sourceRow:'original row'}}],
    mappings:[{id:'mapping',referenceId:'paper',resultId:'result',sourceRegion:{label:'source area',hemisphere:'R'},targetConceptId:'region',targetRegionRef:target,support:'context'}]};
  const before=structuredClone(bundle);
  const search=buildEvidenceSearchIndex(bundle,{regions:[{id:'region',name:'目标区域',en:'target area'}]});
  for(const query of ['中文标题','中文摘要','English abstract','条件一','condition one','局限一','limit one','独立定位','original peak','original row','source area','目标区域','target area'])assert.deepEqual(ids(searchEvidence(search,{query})),['paper'],query);
  assert.deepEqual(ids(searchEvidence(search,{regionRef:target})),['paper']);
  assert.deepEqual(searchEvidence(search,{regionRef:{...target,hemisphere:'L'}}),[]);
  assert.deepEqual(searchEvidence(search,{regionRef:{...target,atlasVersion:'2'}}),[]);
  assert.deepEqual(bundle,before);
  const originalMappings=structuredClone(curatedEvidence.mappings);
  searchEvidence(index,{query:'pre-SMA'});
  assert.deepEqual(curatedEvidence.mappings,originalMappings);
  assert.ok(!curatedEvidence.mappings.some(m=>m.targetConceptId?.includes('sma')&&m.support==='direct'));
});

test('paper methods require reported provenance and result filters select only matching result ids',()=>{
  const bundle={...emptyEvidence(),references:[
    {id:'unknown',title:'Unknown methods'},
    {id:'uncertain',title:'Uncertain methods',studyModalities:missing('Uncertain','uncertain')},
    {id:'mixed',title:'Multimodal paper',studyModalities:reported(['MEG','fMRI'],['https://example.org/methods'])},
  ],results:[
    {id:'unknown-fmri',referenceId:'unknown',modalities:['fMRI']},
    {id:'uncertain-fmri',referenceId:'uncertain',modalities:['fMRI']},
    {id:'meg',referenceId:'mixed',modalities:['MEG']},
    {id:'fmri',referenceId:'mixed',modalities:['fMRI']},
  ]};
  const search=buildEvidenceSearchIndex(bundle);
  assert.deepEqual(ids(searchEvidence(search,{paperModality:'fMRI'})),['mixed']);
  assert.deepEqual(searchEvidence(search,{paperModality:'fMRI',resultModality:'fMRI'}).map(hit=>[hit.referenceId,hit.resultIds]),[['mixed',['fmri']]]);
  assert.deepEqual(search.entries.find(e=>e.referenceId==='unknown').studyModalities.state,'not-extracted');
  assert.deepEqual(bundle.references[0].studyModalities,undefined);
});

test('aliases expand only attested terms and never add spatial relationships',()=>{
  const bundle={...emptyEvidence(),references:[{id:'unrelated',title:'Other paper'},{id:'attested',title:'pre-SMA study'}]};
  const search=buildEvidenceSearchIndex(bundle,{aliases});
  assert.deepEqual(ids(searchEvidence(search,{query:'前辅助运动区'})),['attested']);
  assert.deepEqual(search.entries.flatMap(entry=>entry.mappings),[]);
  assert.deepEqual(searchEvidence(search,{query:'BA44'}),[]);
  const untrusted=buildEvidenceSearchIndex(bundle,{aliases:[{terms:['Other paper','invented term'],sourceRefs:[]}]});
  assert.deepEqual(searchEvidence(untrusted,{query:'invented term'}),[]);
});

test('malformed or unsourced paper methods stay unavailable while sourced reading methods remain usable',()=>{
  const bundle={...emptyEvidence(),references:[
    {id:'bad',title:'Bad',studyModalities:{state:'reported',value:'fMRI',sourceRefs:['https://example.org']}},
    {id:'unsourced',title:'Unsourced',studyModalities:reported(['fMRI'],[])},
    {id:'reading',title:'Reading methods'},
  ],readings:[{referenceId:'reading',modalities:['MEG'],methodProvenance:{source:'https://example.org/methods'}}]};
  const search=buildEvidenceSearchIndex(bundle);
  assert.ok(search.entries.filter(entry=>entry.referenceId!=='reading').every(entry=>entry.studyModalities.state!=='reported'));
  assert.deepEqual(searchEvidence(search,{paperModality:'fMRI'}),[]);
  assert.deepEqual(ids(searchEvidence(search,{paperModality:'MEG'})),['reading']);
});

test('new paper-method extraction never backfills the retained historical v1 snapshot',()=>{
  assert.equal(curatedEvidence.legacyV1.references.find(reference=>reference.id==='schaum2021').studyModalities,undefined);
  assert.deepEqual(curatedEvidence.references.find(reference=>reference.id==='schaum2021').studyModalities.value,['MEG','fMRI']);
});

test('paper method summary distinguishes every missingness state and retains its recorded reason',()=>{
  const labels={zh:['已报告','未报告','尚未摘录','不确定','不适用'],en:['Reported','Not reported','Not extracted','Uncertain','Not applicable']};
  const states=['reported','not-reported','not-extracted','uncertain','not-applicable'];
  for(const language of ['zh','en'])for(const [i,state] of states.entries()){
    const record=state==='reported'?reported(['MEG','fMRI'],['https://example.org/methods']):missing('Recorded source-specific reason',state);
    const summary=describeStudyModalities(record,{language});
    assert.equal(summary.label,labels[language][i]);
    assert.equal(summary.reason,state==='reported'?'':'Recorded source-specific reason');
    assert.deepEqual(summary.modalities,state==='reported'?['MEG','fMRI']:[]);
  }
  const index=buildEvidenceSearchIndex({...emptyEvidence(),references:[{id:'incomplete',title:'Missing provenance',studyModalities:reported(['fMRI'],[])}]});
  const incomplete=describeStudyModalities(index.entries[0].studyModalities,{language:'en'});
  assert.equal(incomplete.label,'Uncertain');assert.match(incomplete.reason,/provenance/);
  assert.deepEqual(searchEvidence(index,{paperModality:'fMRI'}),[]);
});

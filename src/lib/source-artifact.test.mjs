import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {curatedEvidence} from '../data/results.js';
import {auditTranscription,verifySourceArtifact,sourceExcerptBytes} from './source-artifact.js';
import {auditFromDisk} from '../../scripts/evidence-audit.mjs';
import {removeEvidenceRecords} from './evidence-schema.js';

const directory=new URL('../../data-sources/results/source-artifacts/',import.meta.url);
const index=JSON.parse(await readFile(new URL('index.json',directory),'utf8'));
const artifacts=await Promise.all(index.artifacts.map(async row=>JSON.parse(await readFile(new URL(row.file,directory),'utf8'))));
const copy=()=>structuredClone(curatedEvidence);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('offline audit separates integrity and transcription',()=>{
  const artifact=artifacts[0];
  const badBytes=Buffer.from(sourceExcerptBytes(artifact));badBytes[20]^=1;
  assert.equal(verifySourceArtifact(artifact,badBytes).valid,false);
  const changed=copy();changed.locations.find(row=>row.id==='schaum-rifg').xyz[0]=51;
  const wrong=auditTranscription(changed,artifacts);
  assert.ok(wrong.semanticReviewRequired.some(row=>row.path==='locations/schaum-rifg/xyz/0'));
  assert.deepEqual(wrong.integrityErrors,[]);
  assert.ok(auditTranscription(curatedEvidence,artifacts.slice(1)).unavailableArtifacts.length>0);
  const intact=auditTranscription(curatedEvidence,artifacts);
  assert.deepEqual(intact.integrityErrors,[]);
  assert.deepEqual(intact.semanticReviewRequired,[]);
  assert.deepEqual(intact.unavailableArtifacts,[]);
});

test('all eight coordinates have individually anchored axes and remain independent MNI',()=>{
  const audit=auditTranscription(curatedEvidence,artifacts);
  assert.equal(audit.coverage.coordinates.length,8);
  for(const location of curatedEvidence.locations){
    for(let axis=0;axis<3;axis++)assert(audit.coverage.fields.includes(`locations/${location.id}/xyz/${axis}`));
    assert.equal(location.sourceSpaceId,'MNI-unspecified');
    assert.equal(location.derivedAsset,null);assert.equal(location.transformRef,null);
  }
  assert(curatedEvidence.locations.every(location=>curatedEvidence.reviewEvents.some(event=>event.subjectId===location.id&&event.stage==='source-checked'&&event.actorType==='ai'&&event.recordVersion===location.recordVersion)));
  assert(!curatedEvidence.reviewEvents.some(event=>event.stage==='human-reviewed'||event.stage==='space-checked'));
});

test('a changed excerpt or field binding cannot keep the old artifact identity',()=>{
  const changed=structuredClone(artifacts);
  changed[0].excerpt.cells[0].rawText+='x';
  assert(auditTranscription(curatedEvidence,changed).integrityErrors.length>0);
  changed[0].sha256=sha(sourceExcerptBytes(changed[0]));
  assert(auditTranscription(curatedEvidence,changed).integrityErrors.length>0,'manifest digest also protects bindings and locators');
});

test('bibliographic identity and source locators are checked independently',()=>{
  for(const mutate of [
    bundle=>bundle.references[0].doi+='x',
    bundle=>bundle.references[0].fullAuthorList.reverse(),
    bundle=>bundle.references[0].url='https://example.invalid/paper',
    bundle=>bundle.locations[0].legacyV1.sourceTable='Table 9',
    bundle=>bundle.locations[0].sourceRefs[0]='https://example.invalid/table',
  ]){const changed=copy();mutate(changed);assert(auditTranscription(changed,artifacts).semanticReviewRequired.length>0);}
});

test('minimal factual cells preserve text/table precision, SD and analysis roles',()=>{
  const left=curatedEvidence.results.find(row=>row.id==='axelrod2015-lffa');
  assert.deepEqual(left.statistics.value.map(row=>row.p.value),[.012,.01]);
  assert.deepEqual(curatedEvidence.results.find(row=>row.id==='axelrod2015-rffa').statistics.value.map(row=>row.value),[4.29,4.3]);
  const schaum=curatedEvidence.results.find(row=>row.id==='schaum2021-meg-stop');
  assert.equal(schaum.statistics.value.length,4);
  assert.deepEqual([schaum.timeWindow.value.start,schaum.timeWindow.value.end],[100,373]);
  assert.deepEqual([schaum.timeWindow.value.temporalROI.start,schaum.timeWindow.value.temporalROI.end],[100,350]);
  assert.deepEqual([schaum.frequencyBand.value.min,schaum.frequencyBand.value.max],[12,32]);
  assert.equal(schaum.sample.perAnalysis.value,59);
  assert.equal(curatedEvidence.locations.find(row=>row.id==='bosco-tpj').dispersion.value.kind,'sd');
  for(const artifact of artifacts){
    assert(artifact.excerpt.cells.every(cell=>cell.rawText.length<200));
    assert(!JSON.stringify(artifact).includes('precedingContext'));
    assert(artifact.rights&&artifact.paraphrases&&artifact.limitations.length);
    for(const capture of artifact.captures)if(capture.retrievalMethod==='rendered-source')assert.equal(capture.sourceFileSha256,null);
  }
});

test('offline disk audit performs no network and fails closed for absent material',async()=>{
  const prior=globalThis.fetch;globalThis.fetch=()=>{throw Error('network disabled');};
  try{
    const audit=await auditFromDisk();assert.equal(audit.valid,true);
    assert.equal(audit.coverage.coordinates.length,8);
    const absent=await auditFromDisk({artifactDirectory:new URL('./missing-artifacts/',directory)});
    assert.equal(absent.valid,false);assert(absent.unavailableArtifacts.length>0);
  }finally{globalThis.fetch=prior;}
});

test('malformed source material returns a closed audit report rather than throwing',()=>{
  for(const malformed of [[null],[{}],[{id:'broken-v1',excerpt:null}],null]){
    let report;assert.doesNotThrow(()=>{report=auditTranscription(curatedEvidence,malformed);});
    assert(report.integrityErrors.length>0||report.unavailableArtifacts.length>0);
  }
  for(const mutate of [row=>row.excerpt.cells.push(null),row=>row.fields={},row=>row.fields.push(null),row=>row.captures=[null]]){
    const artifact=structuredClone(artifacts[0]);mutate(artifact);
    let integrity;assert.doesNotThrow(()=>{integrity=verifySourceArtifact(artifact,sourceExcerptBytes(artifact));});assert.equal(integrity.valid,false);
  }
});

test('a shared paper artifact audits a selected result subset without inventing missing results',()=>{
  const selected=removeEvidenceRecords(curatedEvidence,{resultIds:['axelrod2015-rffa']});
  const audit=auditTranscription(selected,selected.sourceArtifacts);
  assert.deepEqual(audit.semanticReviewRequired,[]);
  assert.equal(audit.coverage.coordinates.length,7);
});

test('correction status and analysis roles are semantic checks and raw Bosco precision is retained',()=>{
  const corrected=copy();corrected.results.find(row=>row.id==='axelrod2015-lffa').correction.value.passed=true;
  assert(auditTranscription(corrected,artifacts).semanticReviewRequired.some(row=>row.path.endsWith('/correction/value/passed')));
  const role=copy();role.results.find(row=>row.id==='schaum2021-meg-stop').timeWindow.value.role='a priori temporal ROI';
  assert(auditTranscription(role,artifacts).semanticReviewRequired.some(row=>row.path.endsWith('/timeWindow/value/role')));
  const bosco=artifacts.find(row=>row.referenceId==='bosco2008');
  assert.equal(bosco.excerpt.cells.find(row=>row.id==='bosco-tpj-y').rawText,'−36.6');
  assert.equal(bosco.excerpt.cells.find(row=>row.id==='bosco-mt-sd-2').rawText,'3.0');
});

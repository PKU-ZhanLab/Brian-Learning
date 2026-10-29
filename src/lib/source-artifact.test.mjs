import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {curatedEvidence} from '../data/results.js';
import {auditTranscription,verifySourceArtifact,sourceExcerptBytes,sourceArtifactRecordHash} from './source-artifact.js';
import {auditFromDisk} from '../../scripts/evidence-audit.mjs';
import {removeEvidenceRecords,validateEvidenceV2} from './evidence-schema.js';

const directory=new URL('../../data-sources/results/source-artifacts/',import.meta.url);
const index=JSON.parse(await readFile(new URL('index.json',directory),'utf8'));
const artifacts=await Promise.all(index.artifacts.map(async row=>JSON.parse(await readFile(new URL(row.file,directory),'utf8'))));
const copy=()=>structuredClone(curatedEvidence);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const seal=artifact=>{artifact.sha256=sha(sourceExcerptBytes(artifact));artifact.recordSha256=sourceArtifactRecordHash(artifact);return artifact;};

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

test('explicit current source versions permit additive corrections while preserving historical integrity and events',()=>{
  const bundle=copy(),history=structuredClone(bundle.reviewEvents),original=structuredClone(bundle.sourceArtifacts[0]);
  const corrected=structuredClone(original);corrected.id='schaum2021-v2';corrected.sourceVersion='Synthetic correction fixture v2, not a new real source observation';
  const sourceCell=corrected.excerpt.cells.find(cell=>cell.id==='schaum-rifg-x');sourceCell.rawText='51';
  corrected.fields.filter(field=>field.cellId===sourceCell.id).forEach(field=>{field.rawText='51';});seal(corrected);
  bundle.sourceArtifacts.push(corrected);
  const point=bundle.locations.find(row=>row.id==='schaum-rifg');point.xyz[0]=51;point.recordVersion='synthetic-current-v2';point.sourceRefs=point.sourceRefs.map(ref=>ref===original.id?corrected.id:ref);
  bundle.results.find(row=>row.id==='schaum2021-meg-stop').sourceRefs=[corrected.id];
  bundle.reviewEvents.push({...history.find(event=>event.subjectId===point.id&&event.stage==='source-checked'),id:'synthetic-v2-source-check',recordVersion:point.recordVersion,sourceRefs:[corrected.id]});
  const unchanged=structuredClone(bundle),audit=auditTranscription(bundle,bundle.sourceArtifacts);
  assert.deepEqual(audit.integrityErrors,[]);assert.deepEqual(audit.unavailableArtifacts,[]);assert.deepEqual(audit.semanticReviewRequired,[]);
  assert(audit.coverage.integrityCheckedArtifacts.includes(original.id));assert(audit.coverage.integrityCheckedArtifacts.includes(corrected.id));
  assert.deepEqual(auditTranscription(bundle,[...bundle.sourceArtifacts].reverse()).semanticReviewRequired,[],'artifact/index order is not version selection');
  assert.equal(audit.coverage.coordinates.length,8);assert.deepEqual(bundle,unchanged);assert.deepEqual(bundle.sourceArtifacts[0],original);assert.deepEqual(bundle.reviewEvents.slice(0,history.length),history);
  const wrong=structuredClone(bundle);wrong.locations.find(row=>row.id===point.id).xyz[0]=52;
  const mismatch=auditTranscription(wrong,wrong.sourceArtifacts).semanticReviewRequired;
  assert(mismatch.some(item=>item.artifactId===corrected.id&&item.path==='locations/schaum-rifg/xyz/0'&&item.expected===51));
  assert(!mismatch.some(item=>item.artifactId===original.id&&item.path==='locations/schaum-rifg/xyz/0'));
  const historicalTamper=structuredClone(bundle.sourceArtifacts);historicalTamper[0].excerpt.cells[0].rawText+='x';
  assert(auditTranscription(bundle,historicalTamper).integrityErrors.some(error=>error.startsWith(original.id+':')));
  // A higher version's presence is not selection. Explicitly choosing v1 still
  // compares current x to 50 and leaves the unselected v2 as historical material.
  const oldSelected=structuredClone(bundle);oldSelected.locations.find(row=>row.id===point.id).sourceRefs=point.sourceRefs.map(ref=>ref===corrected.id?original.id:ref);
  const oldMismatch=auditTranscription(oldSelected,oldSelected.sourceArtifacts).semanticReviewRequired;
  assert(oldMismatch.some(item=>item.artifactId===original.id&&item.path==='locations/schaum-rifg/xyz/0'&&item.expected===50));
  oldSelected.locations.find(row=>row.id===point.id).xyz[0]=50;
  assert.deepEqual(auditTranscription(oldSelected,oldSelected.sourceArtifacts).semanticReviewRequired,[],'explicit v1 remains valid even while a higher v2 is retained');
});

test('native v2 provenance uses verified source locators without fabricated legacy snapshots',()=>{
  const native=copy();delete native.legacyV1;
  for(const collection of ['results','locations'])for(const row of native[collection])delete row.legacyV1;
  native.sourceArtifacts=native.sourceArtifacts.map(artifact=>{artifact.fields=artifact.fields.filter(field=>!field.path.includes('/legacyV1/'));return seal(artifact);});
  assert.equal(validateEvidenceV2(native).valid,true);
  assert(native.sourceArtifacts.every(artifact=>verifySourceArtifact(artifact,sourceExcerptBytes(artifact)).valid));
  const snapshot=structuredClone(native),audit=auditTranscription(native,native.sourceArtifacts);
  assert.deepEqual(audit.integrityErrors,[]);assert.deepEqual(audit.unavailableArtifacts,[]);assert.deepEqual(audit.semanticReviewRequired,[]);assert.equal(audit.coverage.coordinates.length,8);assert.deepEqual(native,snapshot);
  const wrong=structuredClone(native);wrong.locations[0].xyz[0]=51;
  assert(auditTranscription(wrong,wrong.sourceArtifacts).semanticReviewRequired.some(item=>item.path==='locations/schaum-rifg/xyz/0'));
  const point=native.locations[0],artifactId=point.sourceRefs.find(ref=>ref==='schaum2021-v1');point.sourceRefs=[artifactId];
  const selected=native.sourceArtifacts.find(artifact=>artifact.id===artifactId);selected.fields=selected.fields.filter(field=>field.path!==`locations/${point.id}/sourceRefs/0`);seal(selected);
  assert.equal(validateEvidenceV2(native).valid,true);
  const artifactOnly=auditTranscription(native,native.sourceArtifacts);assert.deepEqual(artifactOnly.semanticReviewRequired,[]);assert.equal(artifactOnly.coverage.coordinates.length,8);
});

test('a declared Boolean binding with no current source selection stays unresolved instead of disappearing',()=>{
  const bundle=copy(),history=structuredClone(bundle.reviewEvents),retainedArtifacts=structuredClone(bundle.sourceArtifacts);
  const result=bundle.results.find(row=>row.id==='axelrod2015-lffa');result.recordVersion='focused-probe-new-current';
  const onlyURLs=node=>{
    if(!node||typeof node!=='object')return;
    for(const [key,value] of Object.entries(node)){
      if(key==='sourceRefs')node[key]=value.filter(ref=>/^https?:\/\//.test(ref));
      else onlyURLs(value);
    }
  };
  onlyURLs(result);result.correction.value.passed=true;
  assert.equal(validateEvidenceV2(bundle).valid,true);
  const audit=auditTranscription(bundle,bundle.sourceArtifacts),path='results/axelrod2015-lffa/correction/value/passed';
  assert.deepEqual(audit.integrityErrors,[]);assert.deepEqual(audit.unavailableArtifacts,[]);assert.equal(audit.coverage.coordinates.length,8);
  assert(audit.semanticReviewRequired.some(item=>item.path===path&&item.artifactId==='axelrod2015-v1'&&item.cellId&&item.reasonCode==='unresolved-source-version'));
  assert(!audit.coverage.fields.includes(path),'missing current selection is not a comparison');
  assert.deepEqual(bundle.reviewEvents,history);assert.deepEqual(bundle.sourceArtifacts,retainedArtifacts);
  result.correction.value.passed=false;
  assert(auditTranscription(bundle,bundle.sourceArtifacts).semanticReviewRequired.some(item=>item.path===path&&item.reasonCode==='unresolved-source-version'),'correct-looking values do not resolve missing current provenance');
  result.sourceRefs=['axelrod2015-v1'];result.correction.value.passed=true;
  assert(auditTranscription(bundle,bundle.sourceArtifacts).semanticReviewRequired.some(item=>item.path===path&&item.expected===false&&item.actual===true),'an explicit selection restores the actual Boolean comparison');
  result.correction.value.passed=false;
  const resolved=auditTranscription(bundle,bundle.sourceArtifacts);assert.deepEqual(resolved.semanticReviewRequired,[]);
  assert.deepEqual(resolved.coverage.uncheckedReportedNumericFields,['results/axelrod2015-lffa/sample/included/value','results/axelrod2015-rffa/sample/included/value']);
});

test('real hashed artifact survives DOI alias merge and independent export with canonical active references',async()=>{
  const {mergeEvidence,validateEvidenceImport}=await import('./evidence-workspace.js');
  const {buildEvidencePackage,validateEvidencePackageClosure}=await import('./evidence-package.js');
  const incoming=copy(),oldId='axelrod2015',canonicalId='canonical-axelrod';
  const reference=incoming.references.find(r=>r.id===oldId),base={...copy(),references:copy().references.map(r=>r.id===oldId?{...r,id:canonicalId}:r)};
  // Base must itself be an empty graph with the pre-existing canonical paper.
  for(const key of ['readings','experiments','results','locations','claims','mappings','sourceArtifacts','reviewEvents','relations'])base[key]=[];
  const sample=incoming.results.find(r=>r.referenceId===oldId).sample;
  incoming.experiments=[{id:'alias-experiment',referenceId:oldId,task:'Explicit alias test experiment',species:'human',sample,modalities:['fMRI'],sourceRefs:['https://doi.org/'+reference.doi]}];
  const {classifyMapping}=await import('./evidence-mapping.js');
  incoming.mappings=[classifyMapping({id:'alias-mapping',referenceId:oldId,claimId:incoming.claims.find(c=>c.referenceId===oldId).id,targetConceptId:'fusiform-r'})];
  const originalArtifact=structuredClone(incoming.sourceArtifacts.find(a=>a.referenceId===oldId));
  const merged=mergeEvidence(base,incoming);
  assert.deepEqual(merged.sourceArtifacts.find(a=>a.id===originalArtifact.id),originalArtifact);
  for(const key of ['results','claims','experiments','mappings'])assert.ok(merged[key].filter(r=>r.referenceId===canonicalId).length);
  assert.ok(!merged.references.some(r=>r.id===oldId));
  assert.ok(merged.referenceAliases.some(a=>a.aliasId===oldId&&a.canonicalId===canonicalId&&a.originalReference.id===oldId));
  const out=buildEvidencePackage({paperIds:[canonicalId],bundle:merged,includePrivate:true});
  assert.equal(validateEvidencePackageClosure(out).valid,true);assert.equal(validateEvidenceImport(out).valid,true);
  assert.deepEqual(out.sourceArtifacts[0],originalArtifact);assert.equal(verifySourceArtifact(out.sourceArtifacts[0],sourceExcerptBytes(originalArtifact)).valid,true);
  const audit=auditTranscription(out,[originalArtifact]);assert.deepEqual(audit.integrityErrors,[]);assert.deepEqual(audit.semanticReviewRequired,[]);assert.deepEqual(audit.unavailableArtifacts,[]);
  for(const mutate of [b=>b.references[0].title+=' changed',b=>b.references[0].fullAuthorList.reverse(),b=>b.references[0].url='https://example.org/wrong',b=>b.references[0].doi+='x']){
    const wrong=structuredClone(out);mutate(wrong);const report=auditTranscription(wrong,[originalArtifact]);assert.ok(report.semanticReviewRequired.length||report.integrityErrors.length);
  }
});

test('E5-R3 repeated alias import preserves original title baseline and exposes merged metadata drift',async()=>{
  const {emptyEvidence}=await import('./evidence-schema.js');
  const {mergeEvidence}=await import('./evidence-workspace.js');
  const {buildEvidencePackage,getBuiltinEvidenceBundle}=await import('./evidence-package.js');
  const original=buildEvidencePackage({paperIds:['axelrod2015'],bundle:getBuiltinEvidenceBundle()});
  const base={...emptyEvidence(),references:original.references.map(r=>({...structuredClone(r),id:'canonical-axelrod'}))};
  const initial=mergeEvidence(base,original),snapshot=structuredClone(initial.referenceAliases[0].originalReference);
  const changed=structuredClone(original);changed.references[0].title+=' changed on repeated import';
  const before=structuredClone(changed),merged=mergeEvidence(initial,changed);
  assert.deepEqual(merged.referenceAliases[0].originalReference,snapshot);
  assert.equal(merged.references[0].title,changed.references[0].title);
  assert.deepEqual(merged.sourceArtifacts[0],original.sourceArtifacts[0]);
  assert.deepEqual(changed,before);
  const audit=auditTranscription(merged,original.sourceArtifacts);
  assert.deepEqual(audit.integrityErrors,[]);assert.ok(audit.semanticReviewRequired.some(f=>f.path==='references/canonical-axelrod/title'));
});

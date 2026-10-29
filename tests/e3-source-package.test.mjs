import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('a fresh source package includes the runtime aliases and resolves the bilingual search dependency',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  assert.ok(process.env.E3_PACKAGE_FIXTURE,'Pass an explicit isolated E3_PACKAGE_FIXTURE');
  const target=path.resolve(process.env.E3_PACKAGE_FIXTURE),scope=path.resolve(root,'output/e3-package-fix1');
  const relative=path.relative(scope,target);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Only an explicit child of output/e3-package-fix1 may be checked');
  const relativeAlias='data-sources/results/search-aliases.json';
  const original=await readFile(path.join(root,relativeAlias));
  const packaged=await readFile(path.join(target,relativeAlias));
  assert.deepEqual(packaged,original,'Runtime alias bytes must survive source packaging');
  const dk=JSON.parse(await readFile(path.join(target,'data-sources/dk/sources.json'),'utf8'));
  const expected=dk.files.find(file=>file.file==='scripts/recon-all.log');
  const requiredLog=await readFile(path.join(target,'data-sources/dk/scripts/recon-all.log'));
  assert.equal(requiredLog.length,expected.bytes);
  assert.equal(createHash('sha256').update(requiredLog).digest('hex'),expected.sha256,'Recovered package prerequisite must retain the original manifest bytes');
  const {buildEvidenceSearchIndex,searchEvidence}=await import(pathToFileURL(path.join(target,'src/lib/evidence-search.js')));
  const {curatedEvidence}=await import(pathToFileURL(path.join(target,'src/data/results.js')));
  const index=buildEvidenceSearchIndex(curatedEvidence,{aliases:JSON.parse(packaged)});
  for(const query of ['pre-SMA','前辅助运动区','BA44/45'])assert.ok(searchEvidence(index,{query}).some(hit=>hit.referenceId==='schaum2021'),query);
});

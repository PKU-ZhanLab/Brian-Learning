import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('source release preserves the exact minimal artifact inputs and audits without network',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  assert(process.env.E4_PACKAGE_FIXTURE,'Pass an isolated E4_PACKAGE_FIXTURE');
  const target=path.resolve(process.env.E4_PACKAGE_FIXTURE),scope=path.join(root,'output/e4-source-package'),relative=path.relative(scope,target);
  assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Read only an explicit E4 source-package child');
  const source='data-sources/results/source-artifacts';
  const expected=JSON.parse(await readFile(path.join(root,source,'index.json'),'utf8'));
  for(const name of ['index.json',...expected.artifacts.map(row=>row.file)])assert.deepEqual(await readFile(path.join(target,source,name)),await readFile(path.join(root,source,name)),name);
  const {curatedEvidence}=await import(pathToFileURL(path.join(target,'src/data/results.js')));
  assert.equal(curatedEvidence.sourceArtifacts.length,3);
  const {auditFromDisk}=await import(pathToFileURL(path.join(target,'scripts/evidence-audit.mjs')));
  const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('network disabled');};
  try{assert.equal((await auditFromDisk()).valid,true);}finally{globalThis.fetch=old;}
  const dk=JSON.parse(await readFile(path.join(target,'data-sources/dk/sources.json'),'utf8'));
  const required=dk.files.find(row=>row.file==='scripts/recon-all.log'),log=await readFile(path.join(target,'data-sources/dk/scripts/recon-all.log'));
  assert.equal(log.length,required.bytes);assert.equal(createHash('sha256').update(log).digest('hex'),required.sha256);
  assert((await readFile(path.join(target,'.gitignore'),'utf8')).includes('!/data-sources/dk/scripts/recon-all.log'));
});

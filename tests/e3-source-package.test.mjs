import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,copyFile,access,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('a fresh source package includes the runtime aliases and resolves the bilingual search dependency',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  assert.ok(process.env.E3_PACKAGE_FIXTURE,'Pass an explicit isolated E3_PACKAGE_FIXTURE');
  const target=path.resolve(process.env.E3_PACKAGE_FIXTURE);
  assert.ok(['e3-package-fix1','e3-package-fix2'].some(name=>{const relative=path.relative(path.resolve(root,'output',name),target);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);}), 'Only an explicit E3 package output child may be checked');
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

test('generated source ignore rules retain the manifest-required DK log under normal Git staging',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  assert.ok(process.env.E3_PACKAGE_FIXTURE&&process.env.E3_PACKAGE_GIT_FIXTURE,'Explicit package and isolated Git fixture paths are required');
  const source=path.resolve(process.env.E3_PACKAGE_FIXTURE),target=path.resolve(process.env.E3_PACKAGE_GIT_FIXTURE);
  const scope=path.resolve(root,'output/e3-package-fix2'),relative=path.relative(scope,target);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Git writes must stay in a child of output/e3-package-fix2');
  assert.ok(['e3-package-fix1','e3-package-fix2'].some(name=>{const relative=path.relative(path.resolve(root,'output',name),source);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);}), 'Read only an explicit E3 package output');
  assert.notEqual(source,target,'Never initialize or stage the source package itself');
  let exists=true;try{await access(target);}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}
  assert.equal(exists,false,'Acceptance Git fixture must be new; never alter an existing package/repository');
  await mkdir(target,{recursive:true});
  const relativeLog='data-sources/dk/scripts/recon-all.log';
  for(const file of ['.gitignore','.gitattributes','data-sources/dk/sources.json',relativeLog]){
    const destination=path.join(target,file);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(source,file),destination);
  }
  await writeFile(path.join(target,'unrelated.log'),'Generated acceptance log; must remain ignored.');
  await writeFile(path.join(target,'data-sources/dk/scripts/unrelated.log'),'Same-folder acceptance log; must remain ignored.');
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'};
  for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR'])delete env[key];
  const git=(...args)=>execFileSync('git',['-C',target,'-c','core.excludesFile=',...args],{env});
  git('init','--quiet');
  git('add','.');
  const tracked=git('ls-files').toString('utf8').trim().split(/\r?\n/);
  assert.ok(tracked.includes(relativeLog),'Normal git add must include the required original DK log');
  assert.deepEqual(tracked.filter(file=>file.endsWith('.log')),[relativeLog],'The exception must not admit any other log');
  const manifest=JSON.parse(await readFile(path.join(target,'data-sources/dk/sources.json'),'utf8'));
  const expected=manifest.files.find(file=>file.file==='scripts/recon-all.log');
  const staged=git('show',`:${relativeLog}`);
  assert.equal(staged.length,expected.bytes);
  assert.equal(createHash('sha256').update(staged).digest('hex'),expected.sha256,'The normally staged Git blob must retain exact manifest bytes');
  const sourceBytes=await readFile(path.join(source,relativeLog));
  assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),expected.sha256,'The source acceptance package stays unchanged');
});

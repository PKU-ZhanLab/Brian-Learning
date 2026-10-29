import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildResultPages} from '../../scripts/build-result-pages.mjs';
import {createReleaseManifest,verifyRelease,recordBuildSource,writeBuildOutput} from '../../scripts/verify-release.mjs';

test('release verification rejects changed, missing, extra and stale files without rewriting expectations',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'release-verification-'));
 const write=(p,v)=>fs.writeFile(path.join(dir,p),JSON.stringify(v));
 await fs.mkdir(path.join(dir,'data'));await fs.mkdir(path.join(dir,'results'));
 await fs.writeFile(path.join(dir,'index.html'),'<main>release</main>');await fs.writeFile(path.join(dir,'runtime.js'),'application entry');
 await fs.mkdir(path.join(dir,'data/anatomy'));await fs.mkdir(path.join(dir,'data/spatial-qc'));
 await write('data/anatomy/manifest.json',{});await write('data/spatial-qc/assessment.json',{});await write('data/manifest.json',{version:'4.2.0'});await write('data/public-edition.json',{version:'4.2.0'});
 const hashes={};for(const name of ['manifest.json','anatomy/manifest.json','spatial-qc/assessment.json','public-edition.json'])hashes[name]=crypto.createHash('sha256').update(await fs.readFile(path.join(dir,'data',name))).digest('hex');
 await write('data/asset-checksums.json',{files:hashes});await buildResultPages({outDir:dir});
 const source={schema:'neuroatlas-build-source-v1',originCommit:'a'.repeat(40),sourceKind:'declared-origin',sourceTreeSha256:'b'.repeat(64),clean:false,exactCommit:false,version:'4.2.0'};
 await write('build-source.json',source);await writeBuildOutput({buildDir:dir,source});
 const expected=await createReleaseManifest({buildDir:dir,sourceCommit:source.originCommit,version:'4.2.0'}),frozen=JSON.stringify(expected);
 assert.equal((await verifyRelease({buildDir:dir,manifest:expected,sourceCommit:source.originCommit})).pass,true);
 await fs.unlink(path.join(dir,'runtime.js'));await assert.rejects(createReleaseManifest({buildDir:dir,sourceCommit:source.originCommit,version:'4.2.0'}));await fs.writeFile(path.join(dir,'runtime.js'),'application entry');
 await fs.writeFile(path.join(dir,'index.html'),'tampered');assert.equal((await verifyRelease({buildDir:dir,manifest:expected,sourceCommit:source.originCommit})).pass,false);
 await fs.writeFile(path.join(dir,'toString'),'prototype-key extra');await fs.writeFile(path.join(dir,'unexpected.txt'),'extra');await fs.unlink(path.join(dir,'data/manifest.json'));
 const result=await verifyRelease({buildDir:dir,manifest:expected,sourceCommit:source.originCommit});assert.ok(result.missing.includes('data/manifest.json'));assert.ok(result.extra.includes('unexpected.txt'));assert.ok(result.extra.includes('toString'));assert.equal(JSON.stringify(expected),frozen);
 await assert.rejects(createReleaseManifest({buildDir:dir,sourceCommit:source.originCommit,version:'4.2.0'}));
 assert.equal((await verifyRelease({buildDir:dir,manifest:expected,sourceCommit:'c'.repeat(40)})).pass,false);
});

test('build provenance refuses a nested non-repository package and separates cleanliness from origin',async()=>{
 await fs.mkdir('output',{recursive:true});const nested=await fs.mkdtemp(path.resolve('output/g1-nested-source-'));await fs.writeFile(path.join(nested,'package.json'),'{"version":"4.2.0"}');
 await assert.rejects(recordBuildSource({sourceRoot:nested}),/repository root|origin/i);
 const source=await recordBuildSource({sourceRoot:path.resolve('.')});assert.equal(source.exactCommit,source.clean);assert.ok(['git-worktree','transformed-source-package'].includes(source.sourceKind));assert.match(source.sourceTreeSha256,/^[a-f0-9]{64}$/);
});


test('explicit packaged origin detects modified and extra source independently from parent Git',async()=>{
 await fs.mkdir('output',{recursive:true});const dir=await fs.mkdtemp(path.resolve('output/g1-origin-'));
 const bytes=Buffer.from('{"version":"4.2.0"}');await fs.writeFile(path.join(dir,'package.json'),bytes);
 const files={'package.json':crypto.createHash('sha256').update(bytes).digest('hex')};
 const origin={schema:'neuroatlas-packaged-source-v1',originCommit:'a'.repeat(40),packagedTreeSha256:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex')};
 await fs.writeFile(path.join(dir,'SOURCE_ORIGIN.json'),JSON.stringify(origin));const recorded=await recordBuildSource({sourceRoot:dir});assert.equal(recorded.originCommit,origin.originCommit);assert.equal(recorded.exactCommit,false);assert.equal(recorded.sourceKind,'transformed-source-package');
 await fs.mkdir(path.join(dir,'.superpowers'),{recursive:true});await fs.writeFile(path.join(dir,'.superpowers','test.log'),'generated receipt');assert.deepEqual(await recordBuildSource({sourceRoot:dir}),recorded);
 await fs.writeFile(path.join(dir,'extra.js'),'stale source');await assert.rejects(recordBuildSource({sourceRoot:dir}),/stale|modified/);
});

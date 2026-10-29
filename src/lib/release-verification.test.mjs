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
 for(const name of ['volume.json','asset-identities.json','aal-v3/manifest.json','ba-v2/manifest.json']){await fs.mkdir(path.dirname(path.join(dir,'data',name)),{recursive:true});await write('data/'+name,{});}
 const hashes={};for(const name of ['volume.json','asset-identities.json','aal-v3/manifest.json','ba-v2/manifest.json','manifest.json','anatomy/manifest.json','spatial-qc/assessment.json','public-edition.json'])hashes[name]=crypto.createHash('sha256').update(await fs.readFile(path.join(dir,'data',name))).digest('hex');
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

async function runtimeFixture({omit=null,wrongProbabilityHash=false}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'g1-runtime-contract-'));
 const digest=value=>crypto.createHash('sha256').update(value).digest('hex'),binary=Buffer.from('synthetic runtime bytes'),binarySha=digest(binary);
 const json=(p,v)=>[p,Buffer.from(JSON.stringify(v))];
 const entries=[json('manifest.json',{version:'4.2.0',anatomy:'anatomy/manifest.json',alignment:'space/alignment.json',baCoverage:'ba-v2/manifest.json',aalSourceManifest:'aal-v3/manifest.json',atlases:{test:{available:true,data:'labels.bin',sha256:binarySha,probability:'probability.bin',probabilitySha256:wrongProbabilityHash?'0'.repeat(64):binarySha,surfaceProjection:'surface/manifest.json'}}}),json('anatomy/manifest.json',{}),json('spatial-qc/assessment.json',{}),json('public-edition.json',{version:'4.2.0'}),json('volume.json',{}),json('asset-identities.json',{assets:{'labels.bin':{verificationFiles:[{path:'transform.bin',sha256:binarySha}],sourceIdentities:[{id:'data-sources/unshipped-original.nii',sha256:'0'.repeat(64)}]}}}),json('space/alignment.json',{targetImage:'data-sources/not-runtime.nii',targetImageSha256:'0'.repeat(64),datasets:{test:{evidence:['unbundled-provenance.pdf']}}}),json('ba-v2/manifest.json',{atlases:{}}),json('aal-v3/manifest.json',{nativeTemplate:{data:'native-t1.bin',sha256:binarySha}}),json('surface/manifest.json',{atlases:{test:{sourceVolume:'labels.bin',sourceSha256:binarySha,hemispheres:{L:{file:'surface-labels.bin',sha256:binarySha}}}}}),...['labels.bin','probability.bin','native-t1.bin','surface-labels.bin','transform.bin'].map(p=>[p,binary])];
 const hashes={};for(const [p,bytes]of entries){if(p===omit)continue;await fs.mkdir(path.dirname(path.join(dir,'data',p)),{recursive:true});await fs.writeFile(path.join(dir,'data',p),bytes);hashes[p]=digest(bytes);}
 await fs.writeFile(path.join(dir,'data/asset-checksums.json'),JSON.stringify({files:hashes}));await fs.writeFile(path.join(dir,'index.html'),'<main>synthetic</main>');await buildResultPages({outDir:dir});
 const source={schema:'neuroatlas-build-source-v1',originCommit:'a'.repeat(40),sourceKind:'declared-origin',sourceTreeSha256:'b'.repeat(64),clean:false,exactCommit:false,version:'4.2.0'};
 await fs.writeFile(path.join(dir,'build-source.json'),JSON.stringify(source));await writeBuildOutput({buildDir:dir,source});return {buildDir:dir,version:'4.2.0',sourceCommit:source.originCommit};
}

for(const omit of ['probability.bin','native-t1.bin','space/alignment.json','ba-v2/manifest.json','surface/manifest.json','surface-labels.bin','transform.bin'])test(`runtime completeness rejects ${omit} absent before builder and expected receipts`,async()=>{
 await assert.rejects(createReleaseManifest(await runtimeFixture({omit})),/Missing declared runtime/);
});
test('runtime graph checks declared probability hash but does not ship provenance-only references',async()=>{
 await assert.rejects(createReleaseManifest(await runtimeFixture({wrongProbabilityHash:true})),/Declared runtime digest mismatch/);
 const fixture=await runtimeFixture();assert.equal((await verifyRelease({...fixture,manifest:await createReleaseManifest(fixture)})).pass,true);
});

test('pinned QC cache preparation preserves packaged source identity while invalid bytes and unexpected source remain rejected',async()=>{
 const {prepareSpatialQCSources}=await import('../../scripts/prepare-spatial-qc-sources.mjs');
 await fs.mkdir('output',{recursive:true});const dir=await fs.mkdtemp(path.resolve('output/g1-pinned-cache-')),bytes=Buffer.from('synthetic pinned candidate only'),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
 const manifest={schemaVersion:1,repository:'DiedrichsenLab/cerebellar_atlases',commit:'a'.repeat(40),cacheRoot:'data-cache/spatial-qc/test-pinned',files:[{path:'README.md',url:`https://raw.githubusercontent.com/DiedrichsenLab/cerebellar_atlases/${'a'.repeat(40)}/README.md`,bytes:bytes.length,sha256:digest(bytes)}]};
 const sourceFiles={'package.json':Buffer.from('{"version":"4.2.0"}'),'data-sources/spatial-qc/source-preparation.json':Buffer.from(JSON.stringify(manifest))};
 for(const [file,content]of Object.entries(sourceFiles)){await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});await fs.writeFile(path.join(dir,file),content);}
 const hashes=Object.fromEntries(Object.entries(sourceFiles).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,content])=>[file,digest(content)]));
 await fs.writeFile(path.join(dir,'SOURCE_ORIGIN.json'),JSON.stringify({schema:'neuroatlas-packaged-source-v1',originCommit:'a'.repeat(40),packagedTreeSha256:digest(JSON.stringify(hashes))}));
 const origin=await fs.readFile(path.join(dir,'SOURCE_ORIGIN.json')),before=await recordBuildSource({sourceRoot:dir});
 await prepareSpatialQCSources({root:dir,fetchImpl:async()=>new Response(bytes)});assert.deepEqual(await recordBuildSource({sourceRoot:dir}),before);assert.deepEqual(await fs.readFile(path.join(dir,'SOURCE_ORIGIN.json')),origin);
 const cache=path.join(dir,manifest.cacheRoot,'README.md');await fs.writeFile(cache,'corrupted cache');await assert.rejects(recordBuildSource({sourceRoot:dir}),/hash\/length mismatch/);await fs.writeFile(cache,bytes);
 await fs.writeFile(path.join(dir,'data-cache/unexpected.txt'),'not a declared cache');await assert.rejects(recordBuildSource({sourceRoot:dir}),/stale or modified/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const catalogPath='public/data/asset-identities.json';
const cases=[
  {file:'data-sources/raw/HarvardOxford-fs-labels.txt',volumes:['ho.bin']},
  {file:'scripts/register_volume.py',volumes:['aal-v3/aal-fsl1mm.bin','aal-v3/aal3-fsl1mm.bin']},
  {file:'data-sources/raw/MNI152_T1_2mm_brain.nii.gz',volumes:['dk-v2/dk68.bin'],pinnedTemplate:true},
];

test('each derivation dependency is fingerprinted per affected volume and tampering invalidates the catalog',async t=>{
  const originalCatalog=read(path.join(root,catalogPath));
  const files=new Set(['scripts/build-asset-identities.mjs','public/data/manifest.json','public/data/volume.json','public/data/aal-v3/manifest.json',...cases.map(entry=>entry.file)]);
  for(const entry of Object.values(originalCatalog.assets))for(const asset of [entry.identity,...entry.sourceIdentities,...entry.transforms])files.add(asset.id);
  const scratch=path.join(root,'.superpowers/sdd/README');fs.mkdirSync(scratch,{recursive:true});
  for(const variant of cases)await t.test(variant.file,()=>{
    const fixture=fs.mkdtempSync(path.join(scratch,'S5-dependency-'));
    const sourceBytes=fs.readFileSync(path.join(root,variant.file));
    try{
      for(const file of files){const destination=path.join(fixture,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination);}
      const run=(...args)=>spawnSync(process.execPath,[path.join(fixture,'scripts/build-asset-identities.mjs'),...args],{encoding:'utf8'});
      let result=run();assert.equal(result.status,0,result.stderr);
      const baseline=read(path.join(fixture,catalogPath));
      for(const volume of variant.volumes){
        const dependency=baseline.assets[volume].sourceIdentities.find(asset=>asset.id===variant.file);
        assert.ok(dependency,`${volume} must retain its own dependency ${variant.file}`);
        assert.equal(dependency.sha256,hash(sourceBytes));
      }
      result=run('--check');assert.equal(result.status,0,result.stderr);
      const changedBytes=Buffer.from(sourceBytes);changedBytes[changedBytes.length-1]^=1;
      fs.writeFileSync(path.join(fixture,variant.file),changedBytes);
      result=run('--check');assert.notEqual(result.status,0,'source-byte changes must invalidate --check');
      // A changed pinned template must remain rejected until its declared source
      // digest is deliberately updated. This is an isolated source-update case,
      // not a rerun or certification of the scientific derivation.
      if(variant.pinnedTemplate){
        assert.match(result.stderr,/Template source mismatch/);
        const metadataPath=path.join(fixture,'public/data/volume.json'),metadata=read(metadataPath);
        metadata.sourceSha256=hash(changedBytes);fs.writeFileSync(metadataPath,JSON.stringify(metadata));
      }
      result=run('--check');assert.notEqual(result.status,0);assert.match(result.stderr,/missing or stale/);
      result=run();assert.equal(result.status,0,result.stderr);
      const regenerated=read(path.join(fixture,catalogPath));
      for(const volume of variant.volumes){
        const before=baseline.assets[volume],after=regenerated.assets[volume];
        const oldDependency=before.sourceIdentities.find(asset=>asset.id===variant.file),newDependency=after.sourceIdentities.find(asset=>asset.id===variant.file);
        assert.equal(newDependency.sha256,hash(changedBytes));assert.equal(newDependency.version,`sha256:${hash(changedBytes)}`);
        assert.notEqual(newDependency.sha256,oldDependency.sha256);
        assert.deepEqual(after.identity,before.identity,'source changes must not be misreported as regenerated binary bytes');
      }
      result=run('--check');assert.equal(result.status,0,result.stderr);
      fs.unlinkSync(path.join(fixture,variant.file));result=run('--check');assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);
    }finally{
      assert.deepEqual(fs.readFileSync(path.join(root,variant.file)),sourceBytes,'isolated source copies must not alter preserved originals');
      const resolved=path.resolve(fixture);assert(resolved.startsWith(path.resolve(scratch)+path.sep));fs.rmSync(resolved,{recursive:true,force:true});
    }
  });
});

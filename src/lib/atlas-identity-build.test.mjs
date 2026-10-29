import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { atlasRegionKey, makeAtlasRegionRef, validateRegionRelations } from './atlas-identity.js';
import { structures } from '../data/catalog.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('documented manifest upgrade deterministically rebuilds source identities and relations', async () => {
  const scratch = path.join(root, '.superpowers/sdd/README');
  fs.mkdirSync(scratch, { recursive:true });
  const fixture = fs.mkdtempSync(path.join(scratch, 'S1-rebuild-'));
  try {
    const data = path.join(fixture, 'public/data');
    fs.mkdirSync(data, { recursive:true });
    fs.cpSync(path.join(root, 'scripts'), path.join(fixture, 'scripts'), { recursive:true });
    fs.symlinkSync(path.join(root, 'data-sources'), path.join(fixture, 'data-sources'), 'junction');
    for (const name of ['dk-v2','aal-v3','ba-v2','space']) fs.symlinkSync(path.join(root, 'public/data', name), path.join(data,name), 'junction');
    const original = read(path.join(root, 'public/data/manifest.json'));
    for (const [id, atlas] of Object.entries(original.atlases)) if (atlas.data && !atlas.data.includes('/')) fs.copyFileSync(path.join(root,'public/data',atlas.data), path.join(data,atlas.data));
    fs.writeFileSync(path.join(data,'manifest.json'), JSON.stringify(original));
    const run = () => execFileSync(process.execPath, [path.join(fixture,'scripts/upgrade-manifest.mjs'),'--manifest-only'], { encoding:'utf8' });
    run();
    const rebuilt = read(path.join(data,'manifest.json'));
    const index = new Map();
    for (const [id, atlas] of Object.entries(rebuilt.atlases)) {
      assert(atlas.atlasVersion, `${id}: atlasVersion missing after documented rebuild`);
      assert(atlas.spaceIdentitySource, `${id}: space provenance missing after documented rebuild`);
      for (const label of atlas.labels.filter(l => l.id > 0)) {
        const ref = makeAtlasRegionRef(id, atlas, label.id);
        index.set(atlasRegionKey(ref), { ...label,ref });
      }
    }
    assert.equal(index.size, 806, 'legacy declarations must retain their original 41 IDs');
    assert.deepEqual(rebuilt.atlases['ba-legacy'].labels.map(l=>l.id), original.atlases['ba-legacy'].labels.map(l=>l.id));
    const relationBytes = fs.readFileSync(path.join(data,'atlas-region-relations.json'),'utf8');
    const relations = JSON.parse(relationBytes).relations;
    assert.equal(relations.length, 68);
    assert.equal(validateRegionRelations(relations,index,new Map(structures.map(s=>[s.id,s]))).valid,true);
    run();
    assert.deepEqual(read(path.join(data,'manifest.json')),rebuilt,'a second supported rebuild must preserve the same identities');
    assert.equal(fs.readFileSync(path.join(data,'atlas-region-relations.json'),'utf8'),relationBytes);
    const extractionFile=path.join(fixture,'scripts/data_build.py');
    fs.appendFileSync(extractionFile,'\n# Isolated regression: provenance bytes changed, declarations unchanged.\n');
    run();
    const afterSourceChange=read(path.join(data,'manifest.json'));
    const actualDigest=createHash('sha256').update(fs.readFileSync(extractionFile)).digest('hex');
    assert.notEqual(afterSourceChange.atlases.ho.spaceIdentitySource.sourceSha256,rebuilt.atlases.ho.spaceIdentitySource.sourceSha256);
    assert.equal(afterSourceChange.atlases.ho.spaceIdentitySource.sourceSha256,actualDigest,'changed source bytes must receive a fresh digest');
    assert.equal(afterSourceChange.atlases['ba-legacy'].labels[0].labelMetadataSource.sourceSha256,actualDigest);
    const originalFetch=globalThis.fetch;
    try {
      globalThis.fetch=async url=>String(url).endsWith('manifest.json')?{ok:true,json:async()=>afterSourceChange}:{ok:true,arrayBuffer:async()=>{
        const bytes=fs.readFileSync(path.join(root,'public',String(url).replace(/^\//,'')));
        return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
      }};
      const {loadAtlas}=await import('./volume.js?manifest-rebuild-regression');
      const dk=await loadAtlas('dk');
      assert.equal(makeAtlasRegionRef('dk',dk,1).atlasVersion,rebuilt.atlases.dk.atlasVersion,'rebuilt identities must satisfy the unchanged runtime guard');
    } finally { globalThis.fetch=originalFetch; }
    assert.deepEqual(read(path.join(root,'public/data/manifest.json')),original,'temporary rebuild must not write to original manifest');
  } finally {
    assert(path.resolve(fixture).startsWith(path.resolve(scratch)+path.sep));
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});

test('enrichment rejects changed binary digests, dictionary mismatches and stale DK concept mappings', async () => {
  const { enrichAtlasIdentities } = await import('../../scripts/enrich-atlas-identities.mjs');
  const original = read(path.join(root,'public/data/manifest.json'));
  const changedHash = structuredClone(original);
  changedHash.atlases.dk.sha256 = '0'.repeat(64);
  assert.throws(()=>enrichAtlasIdentities(changedHash,{root}),/digest|hash/i);
  const changedLabel = structuredClone(original);
  changedLabel.atlases.aal.labels[0].name = 'Unverified_Replacement_L';
  assert.throws(()=>enrichAtlasIdentities(changedLabel,{root}),/dictionary/i);
  const wrongConcept = structuredClone(original);
  wrongConcept.atlases.dk.labels[0].structureId = 'cingulum-l';
  assert.throws(()=>enrichAtlasIdentities(wrongConcept,{root}),/mapping|concept/i);
  assert.deepEqual(read(path.join(root,'public/data/manifest.json')),original);
});

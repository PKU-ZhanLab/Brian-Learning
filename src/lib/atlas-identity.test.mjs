import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { structures } from '../data/catalog.js';
import { atlasRegionKey, makeAtlasRegionRef, relationsForRegion, validateRegionRelations } from './atlas-identity.js';

const readJSON = async path => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const manifest = await readJSON('public/data/manifest.json');
const relationFile = await readJSON('public/data/atlas-region-relations.json');
const relations = relationFile.relations;
const regions = new Map(Object.entries(manifest.atlases).flatMap(([id, atlas]) => atlas.labels.filter(l => l.id > 0).map(label => {
  const ref = makeAtlasRegionRef(id, atlas, label.id);
  return [atlasRegionKey(ref), { ...label, ref }];
})));
const concepts = new Map(structures.map(s => [s.id, s]));

test('original non-contiguous IDs and artifact versions remain independent identities', () => {
  const aal = manifest.atlases.aal, aal3 = manifest.atlases.aal3;
  assert.notEqual(atlasRegionKey(makeAtlasRegionRef('aal', aal, 8121)), atlasRegionKey(makeAtlasRegionRef('aal', aal, 8211)));
  assert.notEqual(atlasRegionKey(makeAtlasRegionRef('aal3', aal3, 87)), atlasRegionKey(makeAtlasRegionRef('aal3', aal3, 91)));
  const ref = makeAtlasRegionRef('aal', aal, 2001);
  assert.notEqual(atlasRegionKey(ref), atlasRegionKey({ ...ref, atlasVersion: 'changed-version' }));
  assert.deepEqual([2001,8121,8211].map(id => makeAtlasRegionRef('aal', aal, id).labelId), [2001,8121,8211]);
  assert.equal(atlasRegionKey({ spaceId:'s',hemisphere:'L',labelId:8121,atlasVersion:'v',atlasId:'aal',name:'ignored' }), '["aal","v",8121,"L","s"]');
});

test('cingulate cortex labels never acquire cingulum white matter concepts', () => {
  const aal = manifest.atlases.aal;
  const labels = aal.labels.filter(l => /^Cingulum_(Ant|Mid|Post)_[LR]$/.test(l.name));
  assert.equal(labels.length, 6);
  for (const label of labels) {
    const related = relationsForRegion(makeAtlasRegionRef('aal', aal, label.id), relations);
    assert(related.every(r => concepts.get(r.conceptId)?.category !== 'tract'));
    assert.deepEqual(related, [], 'unknown anatomical relationships remain unlinked');
  }
});

test('BA4 and BA10 do not acquire a DK equivalent by catalog order or shared names', () => {
  for (const id of [4,10]) assert.deepEqual(relationsForRegion(makeAtlasRegionRef('ba', manifest.atlases.ba, id), relations), []);
  const dk = manifest.atlases.dk;
  const ref = makeAtlasRegionRef('dk', dk, 1);
  const [relation] = relationsForRegion(ref, relations);
  assert.equal(relation.conceptId, 'bankssts-l');
  assert.equal(relation.type, 'exact-source');
  assert(relation.sourceLocator.includes('bankssts'));
  assert.equal(relationsForRegion({ ...ref, atlasVersion:'other' }, relations).length, 0);
});

test('source dictionaries, not coordinates or caller label fields, supply hemisphere', () => {
  const atlas = manifest.atlases.aal;
  assert.equal(makeAtlasRegionRef('aal', atlas, { id:2001,hemisphere:'R',center:[99,0,0] }).hemisphere, 'L');
  assert.equal(makeAtlasRegionRef('ba', manifest.atlases.ba, 4).hemisphere, 'B');
  assert.throws(() => makeAtlasRegionRef('aal', atlas, 999999), /label/i);
  assert.throws(() => makeAtlasRegionRef('aal', { ...atlas,spaceId:null }, 2001), /space/i);
  assert.throws(() => makeAtlasRegionRef('aal', { ...atlas,spaceIdentitySource:null }, 2001), /space/i);
  const unsourced = { ...atlas,labels:atlas.labels.map(l => ({ ...l,labelMetadataSource:null })) };
  assert.throws(() => makeAtlasRegionRef('aal', unsourced, 2001), /source/i);
  assert.throws(() => atlasRegionKey({ atlasId:'aal',atlasVersion:'v',labelId:0,hemisphere:'L',spaceId:'s' }), /label/i);
});

test('relation validation rejects tissue, laterality, missing identity and unsourced exact equivalence', () => {
  assert.deepEqual(validateRegionRelations(relations, regions, concepts), { valid:true,errors:[] });
  const ref = makeAtlasRegionRef('dk', manifest.atlases.dk, 1);
  const original = relationsForRegion(ref, relations)[0];
  const white = { ...original,conceptId:'cingulum-l',targetTissue:'white-matter' };
  const invalid = validateRegionRelations([white], regions, concepts);
  assert.equal(invalid.valid, false);
  assert(invalid.errors.some(e => /tissue/i.test(e)));
  assert.equal(validateRegionRelations([{ ...original,conceptId:'bankssts-r' }], regions, concepts).valid, false);
  assert.equal(validateRegionRelations([{ ...original,sourceUrl:'' }], regions, concepts).valid, false);
  assert.equal(validateRegionRelations([{ ...original,sourceLocator:'unrelated table row' }], regions, concepts).valid, false);
  assert.equal(validateRegionRelations([{ ...original,region:{ ...ref,atlasVersion:'unknown' } }], regions, concepts).valid, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeAtlasRegionRef, atlasRegionKey } from './atlas-identity.js';
import { selectAtlasRegions, serializeAtlasSelection, restoreAtlasSelection, regionDetails, buildRegionIndex } from './atlas-selection.js';

const manifest = JSON.parse(await readFile(new URL('../../public/data/manifest.json', import.meta.url)));
const relations = JSON.parse(await readFile(new URL('../../public/data/atlas-region-relations.json', import.meta.url)));
const index = buildRegionIndex(manifest);

test('all actual AAL116 / AAL3 166 positive labels retain original identity through selection and restore', async () => {
  for (const [id, count] of [['aal',116], ['aal3',166], ['aal-registered',116], ['aal3-registered',166]]) {
    const meta = manifest.atlases[id];
    const data = await readFile(new URL(`../../public/data/${meta.data}`, import.meta.url));
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const actual = [...new Set(meta.dtype.includes('16') ? new Uint16Array(bytes) : new Uint8Array(bytes))].filter(id => id > 0);
    assert.equal(actual.length, count);
    const refs = actual.map(label => makeAtlasRegionRef(id, meta, label));
    const selected = selectAtlasRegions(refs, 'replace', []);
    const saved = JSON.parse(JSON.stringify(serializeAtlasSelection(selected)));
    assert.deepEqual(restoreAtlasSelection(saved, index), {selected:refs, unresolved:[]});
    assert.deepEqual(saved.map(ref => ref.labelId), actual);
  }
});

test('temporal pole labels, atlas versions and spaces never collapse or migrate by name', () => {
  const refs = [['aal',8121],['aal',8211],['aal3',87],['aal3',91]].map(([id,label]) => makeAtlasRegionRef(id, manifest.atlases[id], label));
  assert.equal(selectAtlasRegions([...refs,refs[0]], 'add', [refs[0]]).length, 4);
  const changed = {...refs[0],atlasVersion:'different'};
  assert.deepEqual(restoreAtlasSelection([changed], index), {selected:[],unresolved:[changed]});
  assert.equal(selectAtlasRegions([changed], 'add', refs).length, 5);
  const otherSpace = {...refs[0],spaceId:'unverified-native'};
  assert.deepEqual(restoreAtlasSelection([otherSpace], index).unresolved, [otherSpace]);
});

test('unlinked actual labels have source details without invented evidence or concept relations', () => {
  const ref = makeAtlasRegionRef('aal', manifest.atlases.aal, 2101);
  const detail = regionDetails(ref, index, relations);
  assert.equal(detail.labelName, 'Frontal_Sup_L');
  assert(detail.sourceUrl.startsWith('https://'));
  assert(detail.sourceLocator.includes('2101'));
  assert.deepEqual(detail.relations, []);
  assert.equal(detail.hasEvidence, false);
  const dk = makeAtlasRegionRef('dk', manifest.atlases.dk, 1);
  assert.equal(regionDetails(dk,index,relations).relations[0].conceptId,'bankssts-l');
  assert.equal(atlasRegionKey(detail.ref), atlasRegionKey(ref));
});

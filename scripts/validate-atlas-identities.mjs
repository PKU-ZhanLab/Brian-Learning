import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { structures } from '../src/data/catalog.js';
import { atlasRegionKey, makeAtlasRegionRef, relationsForRegion, validateRegionRelations } from '../src/lib/atlas-identity.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const json = async path => JSON.parse(await read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await json('public/data/manifest.json');
const relations = (await json('public/data/atlas-region-relations.json')).relations;
const regionIndex = new Map(), conceptIndex = new Map(structures.map(s => [s.id, s]));
const sourceCache = new Map(), projectionCache = new Map(), atlasReports = [];

async function source(metadata) {
  assert(metadata?.sourceFile && metadata.sourceSha256 && metadata.sourceUrl, 'Label source file, digest and URL are required');
  if (!sourceCache.has(metadata.sourceFile)) sourceCache.set(metadata.sourceFile, await read(metadata.sourceFile));
  const bytes = sourceCache.get(metadata.sourceFile);
  assert.equal(sha(bytes), metadata.sourceSha256, `Source dictionary bytes changed: ${metadata.sourceFile}`);
  return bytes.toString('utf8');
}

// Validate dictionary membership independently of UI names, positions and catalog order.
function dictionaryEntry(atlasId, atlas, label, text) {
  const base = atlasId.replace('-registered', '');
  if (base === 'aal' || base === 'aal3') {
    const entry = text.split(/\r?\n/).map(s => s.trim().split(/\s+/)).find(c => Number(c[2]) === label.id);
    assert(entry && entry[1] === label.name, `Original AAL dictionary identity changed: ${atlasId}:${label.id}`);
    const expected = /_[LR]$/.test(entry[1]) ? entry[1].at(-1) : 'U';
    assert.equal(label.hemisphere, expected, 'AAL laterality must come from the original dictionary suffix');
  } else if (base === 'dk') {
    const entry = text.split(/\r?\n/).map(s => s.trim().split(/\s+/)).find(c => c[1] === label.sourceName);
    assert(entry, `Original DK annotation is absent: ${label.sourceName}`);
    const offset = { L:1000, R:2000 }[label.hemisphere];
    assert(offset && label.sourceId === offset + Number(entry[0]), 'DK source ID must agree with the recorded cortical hemisphere and annotation');
    verifyDKMapping(label);
  } else if (base === 'ba-legacy') {
    assert.equal(label.hemisphere, 'U', 'Unavailable legacy dictionary cannot supply laterality');
    assert.equal(label.tissue, 'unknown', 'Unavailable legacy dictionary cannot supply tissue');
  } else {
    const entries = [...text.matchAll(/<label\s+[^>]*index="(\d+)"[^>]*>([^<]*)<\/label>/g)].map(m => ({ id:Number(m[1]),name:m[2].trim() }));
    if (base === 'ba') {
      const selected = entries.filter(e => e.name.endsWith(`.Brodmann area ${label.id}`));
      assert(selected.some(e => e.name.startsWith('Left ')) && selected.some(e => e.name.startsWith('Right ')), `Bilateral Talairach aggregation is not documented for BA${label.id}`);
      assert.equal(label.hemisphere, 'B');
      assert(selected.every(e => e.name.includes('.Gray Matter.')));
      assert.equal(label.tissue, 'gray-matter');
    } else {
      const entry = entries.find(e => e.id === (base === 'jhu' ? label.id : label.id - 1));
      assert.equal(entry?.name, label.name, `Original XML label changed: ${atlasId}:${label.id}`);
      const expected = /^(Left|Right)\b/.test(entry.name) ? (entry.name.startsWith('Left') ? 'L' : 'R') : / [LR]$/.test(entry.name) ? entry.name.at(-1) : 'U';
      assert.equal(label.hemisphere, expected);
      if (base === 'jhu') { assert(text.includes('White-Matter Labels')); assert.equal(label.tissue, 'white-matter'); }
      if (base === 'ba-histology') { assert(entry.name.startsWith('GM ')); assert.equal(label.tissue, 'gray-matter'); }
    }
  }
}

function verifyDKMapping(label) {
  assert(label.structureIdSource?.sourceLocator?.includes(label.sourceName), 'DK concept mapping must record the original annotation');
  assert(label.structureIdSource.sourceLocator.includes(`sourceId ${label.sourceId}`), 'DK concept mapping must record the original FreeSurfer integer');
}

for (const [id, atlas] of Object.entries(manifest.atlases)) {
  assert.equal(atlas.atlasId, id);
  if (atlas.versionBasis === 'derived-artifact-sha256') assert.equal(atlas.atlasVersion, `sha256:${atlas.sha256}`);
  assert.equal(atlas.spaceId, atlas.space, 'Space identity must preserve the declared source space');
  const spaceSource = await source(atlas.spaceIdentitySource);
  assert.equal(atlas.spaceIdentitySource.spaceId, atlas.spaceId, 'Source space provenance must refer to the same declaration');
  const pointer = atlas.spaceIdentitySource.sourceLocator.split('#/')[1];
  if (pointer) assert.equal(pointer.split('/').reduce((value,key) => value?.[key], JSON.parse(spaceSource)), atlas.spaceId, 'Space source locator must resolve to its recorded declaration');
  else assert(spaceSource.includes(atlas.spaceId), 'Space declaration must be present in the cited source');
  const present = new Set();
  const labels = atlas.labels.filter(label => label.id > 0);
  assert.equal(new Set(labels.map(l => l.id)).size, labels.length, 'Duplicate original label IDs');
  if (atlas.data) {
    const bytes = await read(`public/data/${atlas.data}`);
    assert.equal(sha(bytes), atlas.sha256, `Atlas binary digest changed: ${id}`);
    const width = atlas.dtype === 'uint16' ? 2 : atlas.dtype === 'uint8' ? 1 : null;
    assert(width, `Unsupported atlas storage: ${id}`);
    assert.equal(bytes.byteLength, atlas.shape.reduce((a,b) => a*b, 1) * width);
    for (let i = 0; i < bytes.byteLength; i += width) {
      const value = width === 2 ? bytes.readUInt16LE(i) : bytes[i];
      if (value > 0) present.add(value);
    }
    assert.deepEqual([...present].sort((a,b) => a-b), labels.map(l => l.id).sort((a,b) => a-b), `Dictionary must cover exactly the actual positive values: ${id}`);
  } else assert.equal(atlas.available, false, 'Available atlas must have a declared binary');
  await source(atlas.labelMetadataSource);
  for (const label of labels) {
    const original = await source(label.labelMetadataSource);
    dictionaryEntry(id, atlas, label, original);
    if (label.structureIdSource) await source(label.structureIdSource);
    const ref = makeAtlasRegionRef(id, atlas, label.id), key = atlasRegionKey(ref);
    assert(!regionIndex.has(key), 'Duplicate complete region identity');
    regionIndex.set(key, { ...label,ref });
  }
  let corticalIds = [];
  if (id === 'dk') corticalIds = labels.map(l => l.id);
  else if (atlas.surfaceProjection) {
    if (!projectionCache.has(atlas.surfaceProjection)) projectionCache.set(atlas.surfaceProjection, await json(`public/data/${atlas.surfaceProjection}`));
    const projection = projectionCache.get(atlas.surfaceProjection).atlases?.[id];
    assert.equal(projection?.sourceSha256, atlas.sha256);
    corticalIds = projection.corticalLabelIds;
    assert(corticalIds.every(n => present.has(n)), 'Projectable labels must exist in the volume');
  }
  const linked = labelId => relationsForRegion(makeAtlasRegionRef(id, atlas, labelId), relations).length > 0;
  const linkedLabels = labels.filter(l => linked(l.id)).length;
  atlasReports.push({
    atlasId:id,
    available:atlas.available,
    declaredLabelIdentities:labels.length,
    actualVolumeLabels:atlas.data ? present.size : null,
    linkedVolumeLabels:linkedLabels,
    unknownRelationLabels:labels.length-linkedLabels,
    projectableCorticalLabels:corticalIds.length,
    linkedProjectableCorticalLabels:corticalIds.filter(linked).length,
    unknownHemisphereLabels:labels.filter(l => l.hemisphere === 'U').length,
    unknownTissueLabels:labels.filter(l => l.tissue === 'unknown').length,
    sourceDictionaryStatus:atlas.labelMetadataSource.status ?? 'preserved-source-dictionary',
  });
}

const validation = validateRegionRelations(relations, regionIndex, conceptIndex);
assert(validation.valid, validation.errors.join('\n'));
console.log(JSON.stringify({
  valid:true,
  scope:'Software identity, source dictionary membership, artifact bytes, tissue/laterality consistency and explicit relationships. No independent anatomical or human certification.',
  indexedLabelIdentities:regionIndex.size,
  actualVolumeLabels:atlasReports.reduce((n,a) => n+(a.actualVolumeLabels ?? 0), 0),
  declaredOnlyLabels:atlasReports.filter(a => a.actualVolumeLabels === null).reduce((n,a) => n+a.declaredLabelIdentities, 0),
  explicitRelations:relations.length,
  unknownRelationLabels:atlasReports.reduce((n,a) => n+a.unknownRelationLabels, 0),
  tissueOrLateralityConflicts:validation.errors.length,
  atlases:atlasReports,
}, null, 2));

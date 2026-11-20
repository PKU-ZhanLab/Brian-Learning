// Read-only numerical probes for the published NeuroAtlas source.
// Run from the workspace: node output/audit-20261029/anatomy-probes.mjs
// Only stdout is written. Redirect stdout to preserve the JSON evidence.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '../../.deployment/source');
const dataRoot = path.join(sourceRoot, 'public/data');
const read = name => JSON.parse(fs.readFileSync(path.join(dataRoot, name), 'utf8'));
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const revision = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
assert.equal(revision, 'ca00c0928b0c7b62c662636cddf3a8d1da374a15', 'This probe records the pinned audit revision; review expected results before using another revision.');
const {structures} = await import(pathToFileURL(path.join(sourceRoot, 'src/data/catalog.js')));
const {isAalCorticalLabel} = await import(pathToFileURL(path.join(sourceRoot, 'src/lib/surface-projection.js')));
const {compareROIs} = await import(pathToFileURL(path.join(sourceRoot, 'src/lib/roi.js')));
const manifest = read('manifest.json');
const projection = read('surface-v1/manifest.json');
const code = fs.readFileSync(path.join(sourceRoot, 'src/components/BrainScene.jsx'), 'utf8');
// Execute the exact two pure functions from the pinned source, without loading React/JSX.
const normalizedDefinition = code.match(/const normalized = (.+);/);
assert(normalizedDefinition, 'Cannot locate the source normalization function');
const normalized = new Function(`return (${normalizedDefinition[1]});`)();
const start = code.indexOf('function findMatchingStructure');
const end = code.indexOf('function nearestStructure', start);
assert(start >= 0 && end > start, 'Cannot locate the source matching function');
const findMatchingStructure = new Function('normalized', `return (${code.slice(start, end)});`)(normalized);
const viewerStructures = structures.filter(s => s.category !== 'spinal');
const corticalStructures = viewerStructures.filter(s => s.category === 'cortex');
const side = label => label.name.endsWith('_L') ? 'L' : label.name.endsWith('_R') ? 'R' : null;

const coverage = {};
for (const atlasId of ['aal-registered', 'aal3-registered']) {
  const corticalLabels = manifest.atlases[atlasId].labels.filter(isAalCorticalLabel);
  const rows = corticalLabels.map(label => ({
    labelId: label.id,
    labelName: label.name,
    hemisphere: side(label),
    corticalCardId: findMatchingStructure(corticalStructures, label.name, side(label))?.id || null,
    clickCardId: findMatchingStructure(viewerStructures, label.name, side(label))?.id || null,
    clickCardCategory: findMatchingStructure(viewerStructures, label.name, side(label))?.category || null,
  }));
  const vertices = {mappedToCorticalCard:0, unmappedToCorticalCard:0, labelled:0, eligible:0};
  const observedLabelIds = new Set();
  for (const entry of Object.values(projection.atlases[atlasId].hemispheres)) {
    vertices.eligible += entry.eligibleVertices;
    // Count the binary labels themselves, not only the manifest summary.
    const buffer = fs.readFileSync(path.join(dataRoot, entry.file));
    assert.equal(buffer.byteLength, entry.vertices * 2);
    const observedCounts = {};
    for (let offset = 0; offset < buffer.byteLength; offset += 2) {
      const id = buffer.readUInt16LE(offset);
      if (!id) continue;
      observedLabelIds.add(id);
      observedCounts[id] = (observedCounts[id] || 0) + 1;
      const row = rows.find(item => item.labelId === id);
      assert(row, `Surface label ${id} is not in the admitted cortical subset`);
      vertices.labelled++;
      vertices[row.corticalCardId ? 'mappedToCorticalCard' : 'unmappedToCorticalCard']++;
    }
    assert.deepEqual(observedCounts, entry.labelVertexCounts, 'Binary surface counts differ from the manifest');
  }
  coverage[atlasId] = {
    totalVolumeLabels: manifest.atlases[atlasId].labels.length,
    corticalLabelDenominator: corticalLabels.length,
    corticalLabelDenominatorDefinition: 'All actual volume labels admitted by the current isAalCorticalLabel predicate, including both hemispheres. This is not the entire atlas and is not a vertex count.',
    distinctPositiveProjectedLabels: observedLabelIds.size,
    labelsMappedToCorticalCards: rows.filter(row => row.corticalCardId).length,
    labelsUnmappedToCorticalCards: rows.filter(row => !row.corticalCardId).length,
    vertices,
    unmappedLabelledVertexPercent: 100 * vertices.unmappedToCorticalCard / vertices.labelled,
    rows,
  };
}

const wrongTissueMappings = coverage['aal-registered'].rows.filter(row => row.clickCardCategory && row.clickCardCategory !== 'cortex');
const collapsedTemporalPoleMappings = Object.fromEntries(Object.entries(coverage).map(([id, item]) => [id, item.rows.filter(row => row.labelName.includes('Temporal_Pole'))]));
const baExamples = [4,10,20,32,40,47].map(id => {
  const label = manifest.atlases.ba.labels.find(item => item.id === id);
  return {labelId:id, labelName:label.name, leftCard:findMatchingStructure(viewerStructures,label.name,'L')?.id};
});

const atlas = manifest.atlases['aal3-registered'];
const bytes = fs.readFileSync(path.join(dataRoot, atlas.data));
assert.equal(atlas.dtype, 'uint8');
const source = {...atlas, data:new Uint8Array(bytes)};
const target = read('volume.json');
const sourceLabel = atlas.labels.find(label => label.id === 134);
const actualSourceVoxels = source.data.reduce((n, value) => n + Number(value === 134), 0);
const comparison = compareROIs(source, [134], source, [134], target, {
  A:{atlasId:'aal3-registered',name:sourceLabel.name},
  B:{atlasId:'aal3-registered',name:sourceLabel.name},
});

assert.equal(coverage['aal-registered'].corticalLabelDenominator, 78);
assert.equal(coverage['aal3-registered'].corticalLabelDenominator, 86);
assert.equal(coverage['aal-registered'].labelsMappedToCorticalCards, 24);
assert.equal(coverage['aal3-registered'].labelsMappedToCorticalCards, 24);
assert.equal(wrongTissueMappings.length, 6);
assert.equal(actualSourceVoxels, 7);
assert.equal(comparison.metrics.aVoxels, 0);
assert.equal(comparison.metrics.bVoxels, 0);
assert.equal(comparison.metrics.dice, null);

console.log(JSON.stringify({
  schema:1,
  createdAt:new Date().toISOString(),
  sourceRoot,
  revision,
  method:'Read-only Node execution of the pinned source matching functions and compareROIs; actual binary surface labels and AAL3 voxels were read. No browser interaction and no anatomical certification.',
  inputSha256:Object.fromEntries([
    'manifest.json','surface-v1/manifest.json','volume.json',atlas.data,
    ...Object.values(projection.atlases).flatMap(a => Object.values(a.hemispheres).map(h => h.file)),
  ].map(file => [file,sha256(path.join(dataRoot,file))])),
  coverage,
  wrongTissueMappings,
  collapsedTemporalPoleMappings,
  baExamples,
  label134SelfComparison:{
    sourceLabel,
    actualSourceVoxels,
    sourceVoxelSizeMm:atlas.voxelSizeMm,
    sourceVolumeMm3:sourceLabel.volumeMm3,
    targetGrid:comparison.grid,
    metrics:comparison.metrics,
    interpretation:'The fixed 2 mm comparison grid removes this 7 mm3 source parcel. The UI has an empty-target warning. This demonstrates a known resolution limitation, not an arithmetic error in nearest-neighbour resampling.',
  },
},null,2));

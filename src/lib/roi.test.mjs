import test from 'node:test';
import assert from 'node:assert/strict';
import { assetURL, dataURL } from './assets.js';
import { compareLabelROIs, positiveLabels, voxelMaskSurface } from './roi.js';

const affine = [2,0,0,0, 0,2,0,0, 0,0,2,0, 0,0,0,1];
const grid = { shape: [4,3,2], affine, space: 'MNI152NLin6Asym' };
const volume = (indices, label = 1, metadata = {}) => ({ ...grid, canOverlayOnTarget: true, alignmentStatus: 'verified-native', order: 'x-fastest', data: Uint16Array.from({ length: 24 }, (_, i) => indices.includes(i) ? label : 0), labels: [{ id: label, name: 'Test label' }], ...metadata });

test('ROI metrics count exact intersection, union and physical volume', () => {
  const result = compareLabelROIs(volume([0,1,2,5]), 1, volume([1,2,3,7,8], 2), 2, grid);
  assert.equal(result.metrics.intersectionVoxels, 2);
  assert.equal(result.metrics.unionVoxels, 7);
  assert.equal(result.metrics.aOnlyVoxels, 2);
  assert.equal(result.metrics.bOnlyVoxels, 3);
  assert.equal(result.metrics.dice, 4 / 9);
  assert.equal(result.metrics.jaccard, 2 / 7);
  assert.equal(result.metrics.intersectionMm3, 16);
});

test('identical and disjoint masks have Dice 1 and 0', () => {
  const a = volume([0,1,2]);
  assert.equal(compareLabelROIs(a, 1, a, 1, grid).metrics.dice, 1);
  assert.equal(compareLabelROIs(a, 1, volume([23], 2), 2, grid).metrics.dice, 0);
});

test('nearest-neighbour sampling applies declared translation and axis reflection', () => {
  const translated = [...affine]; translated[3] = 2;
  assert.equal(compareLabelROIs(volume([0,1], 1, { affine: translated }), 1, volume([1,2], 2), 2, grid).metrics.dice, 1);
  const reflected = [...affine]; reflected[0] = -2; reflected[3] = 6;
  assert.equal(compareLabelROIs(volume([0], 1, { affine: reflected }), 1, volume([3], 2), 2, grid).metrics.dice, 1);
});

test('z-fastest input is reordered without changing anatomy', () => {
  const source = volume([0,1,2,5]);
  const zfast = Uint16Array.from({ length: 24 }, (_, n) => { const k = n % 2, j = Math.floor(n / 2) % 3, i = Math.floor(n / 6); return source.data[i + 4 * (j + 3 * k)]; });
  assert.equal(compareLabelROIs({ ...source, order: 'z-fastest', data: zfast }, 1, source, 1, grid).metrics.dice, 1);
});

test('unverified alignment, background, missing labels and invalid geometry are rejected', () => {
  const source = volume([0]);
  assert.throws(() => compareLabelROIs({ ...source, canOverlayOnTarget: false }, 1, source, 1, grid), /unaligned-atlas/);
  assert.throws(() => compareLabelROIs(source, 0, source, 1, grid), /invalid-label/);
  assert.throws(() => compareLabelROIs(source, 2, source, 1, grid), /empty-label/);
  assert.throws(() => compareLabelROIs({ ...source, affine: new Array(16).fill(0) }, 1, source, 1, grid), /invalid-affine/);
  assert.deepEqual(positiveLabels(source).map(label => [label.id, label.voxels]), [[1,1]]);
});

test('voxel surfaces expose six faces for one cell and omit a shared face for adjacent cells', () => {
  const single = compareLabelROIs(volume([0]), 1, volume([0]), 1, grid);
  assert.equal(voxelMaskSurface(single, 'A').faces, 6);
  assert.equal(voxelMaskSurface(single, 'A').triangles, 12);
  const adjacent = compareLabelROIs(volume([0,1]), 1, volume([0,1]), 1, grid);
  assert.equal(voxelMaskSurface(adjacent, 'A').faces, 10);
});

test('public paths respect a repository deployment prefix', () => {
  assert.equal(assetURL('/data/a.bin', '/brain-model/'), '/brain-model/data/a.bin');
  assert.equal(dataURL('a.bin', '/brain-model/'), '/brain-model/data/a.bin');
  assert.equal(dataURL('/data/a.bin', './'), './data/a.bin');
  assert.equal(assetURL('https://example.org/a.bin', '/brain-model/'), 'https://example.org/a.bin');
});

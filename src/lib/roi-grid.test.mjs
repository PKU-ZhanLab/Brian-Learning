import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeComparisonGrid, inspectROISampling } from './roi-grid.js';
import { compareROIs, comparisonMaskVolume } from './roi.js';
import { exportNifti, parseNifti } from './nifti.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../../public/data/manifest.json', import.meta.url)));
const reference = manifest.template;
const metadata = manifest.atlases['aal3-registered'];
const source = { ...metadata, data: new Uint8Array(fs.readFileSync(new URL('../../public/data/aal-v3/aal3-fsl1mm.bin', import.meta.url))) };

test('only the two declared NLin6Asym common grids can be made', () => {
  for (const resolution of [1, 2]) {
    const grid = makeComparisonGrid(reference, resolution);
    assert.deepEqual(grid.shape, resolution === 1 ? [181,217,181] : [91,109,91]);
    assert.deepEqual(grid.affine, [resolution,0,0,-90,0,resolution,0,-126,0,0,resolution,-72,0,0,0,1]);
    assert.equal(grid.order, 'x-fastest');
    assert.ok(grid.shape.reduce((a,b) => a*b) <= 8_000_000);
  }
  for (const resolution of [0, 3, 1.5, '1']) assert.throws(() => makeComparisonGrid(reference, resolution), /unsupported-comparison-resolution/);
  assert.throws(() => makeComparisonGrid({...reference, space:'MNI-unspecified'}, 1), /unsupported-reference-grid/);
  assert.throws(() => makeComparisonGrid({...reference, shape:[2,2,2]}, 1), /unsupported-reference-grid/);
  assert.throws(() => makeComparisonGrid({...reference, affine:reference.affine.map((v,i) => i===3 ? -89 : v)}, 1), /unsupported-reference-grid/);
});

test('real AAL3 label 134 retains seven source voxels at 1 mm and disappears at 2 mm without fabricated points', () => {
  const fine = makeComparisonGrid(reference, 1), coarse = makeComparisonGrid(reference, 2);
  const at1 = compareROIs(source, 134, source, 134, fine);
  assert.equal(at1.metrics.aVoxels, 7);
  assert.equal(at1.metrics.intersectionVoxels, 7);
  assert.equal(at1.metrics.dice, 1);
  assert.equal(at1.sampling.A.sourceVoxels, 7);
  assert.equal(at1.sampling.A.sourceMm3, 7);
  assert.equal(at1.sampling.A.status, 'retained');
  const at2 = compareROIs(source, 134, source, 134, coarse);
  assert.equal(at2.metrics.aVoxels, 0);
  assert.equal(at2.metrics.dice, null);
  assert.equal(at2.sampling.A.targetVoxels, 0);
  assert.deepEqual(at2.sampling.A.lostLabelIds, [134]);
  assert.equal(at2.sampling.A.status, 'empty-target');
});

test('per-label loss is visible when the selected union remains nonempty; absent source is a different state', () => {
  const coarse = makeComparisonGrid(reference, 2);
  const report = inspectROISampling(source, [133,134], coarse);
  assert.ok(report.targetVoxels > 0);
  assert.deepEqual(report.lostLabelIds, [134]);
  assert.equal(report.status, 'partial-loss');
  assert.equal(report.sourceVoxels, 15);
  assert.equal(report.labels.find(label => label.labelId === 134).sourceVoxels, 7);
  assert.equal(report.labels.find(label => label.labelId === 134).targetMm3, 0);
  const absent = inspectROISampling(source, 999, coarse);
  assert.equal(absent.status, 'empty-source');
  assert.deepEqual(absent.lostLabelIds, []);
  assert.deepEqual(absent.absentLabelIds, [999]);
  const partiallyAbsent = inspectROISampling(source, [133,999], coarse);
  assert.equal(partiallyAbsent.status, 'partial-loss');
  assert.deepEqual(partiallyAbsent.absentLabelIds, [999]);
});

test('disjoint retained labels have empty intersection rather than sampling loss', () => {
  const result = compareROIs(source, 133, source, 134, makeComparisonGrid(reference, 1));
  assert.equal(result.sampling.A.status, 'retained');
  assert.equal(result.sampling.B.status, 'retained');
  assert.equal(result.metrics.intersectionVoxels, 0);
  assert.equal(result.metrics.dice, 0);
});

test('actual label 134 mask exports keep chosen grid, affine and count', async () => {
  for (const resolution of [1,2]) {
    const grid = makeComparisonGrid(reference, resolution);
    const result = compareROIs(source, 134, source, 134, grid);
    const mask = await parseNifti(exportNifti(comparisonMaskVolume(result, 'A')), {kind:'mask'});
    assert.deepEqual(mask.shape, grid.shape);
    assert.deepEqual(mask.affine, grid.affine);
    assert.equal(mask.data.reduce((a,b) => a+b,0), resolution === 1 ? 7 : 0);
  }
});

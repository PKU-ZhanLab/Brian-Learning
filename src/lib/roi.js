import { Matrix4 } from 'three';

export const ROI_COLORS = { aOnly: '#27a5b5', bOnly: '#e39845', intersection: '#8e69c6', A: '#27a5b5', B: '#e39845' };
export const ROI_DEFAULT_DISPLAY = { mode: 'parts', opacity: 0.7, opacityA: 0.65, opacityB: 0.65, opacityOverlap: 0.9, xray: false };
const comparisonSamplers = new WeakMap();
const MAX_GRID_VOXELS = 8_000_000;
const affineArray = volume => Array.isArray(volume.affine?.[0]) ? volume.affine.flat() : volume.affine;

function checkedGrid(volume) {
  const affine = affineArray(volume);
  if (!volume.shape || volume.shape.length !== 3 || !volume.shape.every(n => Number.isInteger(n) && n > 0) || volume.shape.reduce((a, b) => a * b, 1) > MAX_GRID_VOXELS) throw new Error('invalid-grid');
  if (!affine || affine.length !== 16 || !affine.every(Number.isFinite) || affine.slice(12, 15).some(n => Math.abs(n) > 1e-10) || Math.abs(affine[15] - 1) > 1e-10) throw new Error('invalid-affine');
  const matrix = new Matrix4().set(...affine);
  const determinant = matrix.determinant();
  if (Math.abs(determinant) < 1e-10) throw new Error('invalid-affine');
  return { shape: [...volume.shape], affine: [...affine], matrix, voxelVolumeMm3: Math.abs(determinant), space: volume.space || 'MNI152NLin6Asym', order: 'x-fastest' };
}

export function positiveLabels(volume) {
  const counts = new Map();
  for (const value of volume.data) if (Number.isInteger(value) && value > 0) counts.set(value, (counts.get(value) || 0) + 1);
  const labelMap = new Map((Array.isArray(volume.labels) ? volume.labels : Object.entries(volume.labels || {}).map(([id, value]) => ({ id: +id, ...(typeof value === 'string' ? { name: value } : value) }))).map(label => [Number(label.id ?? label.value ?? label.index), label]));
  return [...counts].sort(([a], [b]) => a - b).map(([id, voxels]) => ({ ...labelMap.get(id), id, name: labelMap.get(id)?.name || labelMap.get(id)?.label || `Label ${id}`, voxels }));
}

export function sameGrid(a, b) {
  const aa = affineArray(a), ab = affineArray(b);
  return a.shape.every((n, i) => n === b.shape[i]) && aa.length === 16 && ab.length === 16 && aa.every((n, i) => Math.abs(n - ab[i]) < 1e-7);
}

/** Nearest-neighbour label sampling at target voxel centres. This does not estimate registration. */
export function resampleLabelMask(volume, labelId, target) {
  if (volume.canOverlayOnTarget !== true) throw new Error('unaligned-atlas');
  if (!Number.isInteger(labelId) || labelId <= 0) throw new Error('invalid-label');
  const source = checkedGrid(volume), grid = checkedGrid(target);
  if (volume.data.length !== source.shape.reduce((a, b) => a * b, 1)) throw new Error('invalid-data-length');
  const mask = new Uint8Array(grid.shape.reduce((a, b) => a * b, 1));
  const sourceXFast = volume.order !== 'z-fastest';
  let sourceCount = 0;
  for (const value of volume.data) if (value === labelId) sourceCount++;
  if (!sourceCount) throw new Error('empty-label');
  const identical = sameGrid(source, grid);
  if (identical && sourceXFast) {
    for (let i = 0; i < mask.length; i++) mask[i] = Number(volume.data[i] === labelId);
  } else {
    const transform = source.matrix.clone().invert().multiply(grid.matrix).elements;
    const [sx, sy, sz] = source.shape, [tx, ty, tz] = grid.shape;
    let index = 0;
    for (let k = 0; k < tz; k++) for (let j = 0; j < ty; j++) for (let i = 0; i < tx; i++, index++) {
      const x = Math.round(transform[0] * i + transform[4] * j + transform[8] * k + transform[12]);
      const y = Math.round(transform[1] * i + transform[5] * j + transform[9] * k + transform[13]);
      const z = Math.round(transform[2] * i + transform[6] * j + transform[10] * k + transform[14]);
      if (x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz) mask[index] = Number(volume.data[sourceXFast ? x + sx * (y + sy * z) : (x * sy + y) * sz + z] === labelId);
    }
  }
  return { mask, sourceCount, resampled: !identical, reordered: !sourceXFast };
}

export function compareLabelROIs(volumeA, labelA, volumeB, labelB, target, descriptors = {}) {
  const grid = checkedGrid(target);
  if (grid.space !== 'MNI152NLin6Asym') throw new Error('unsupported-target-space');
  const a = resampleLabelMask(volumeA, Number(labelA), grid), b = resampleLabelMask(volumeB, Number(labelB), grid);
  const classes = new Uint8Array(a.mask.length);
  let aVoxels = 0, bVoxels = 0, intersectionVoxels = 0, unionVoxels = 0;
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity], sum = [0, 0, 0];
  const [nx, ny, nz] = grid.shape, af = grid.affine;
  let index = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, index++) {
    const va = a.mask[index], vb = b.mask[index], value = va | (vb << 1); classes[index] = value;
    aVoxels += va; bVoxels += vb; intersectionVoxels += va & vb;
    if (value) {
      unionVoxels++;
      const p = [af[0] * i + af[1] * j + af[2] * k + af[3], af[4] * i + af[5] * j + af[6] * k + af[7], af[8] * i + af[9] * j + af[10] * k + af[11]];
      for (let axis = 0; axis < 3; axis++) { low[axis] = Math.min(low[axis], p[axis]); high[axis] = Math.max(high[axis], p[axis]); sum[axis] += p[axis]; }
    }
  }
  const aOnlyVoxels = aVoxels - intersectionVoxels, bOnlyVoxels = bVoxels - intersectionVoxels;
  const mm3 = grid.voxelVolumeMm3;
  const info = (volume, labelId, selection, sampled) => ({ ...selection, labelId: Number(labelId), name: selection?.name || volume.labels?.find(label => Number(label.id) === Number(labelId))?.name || `Label ${labelId}`, alignmentStatus: volume.alignmentStatus, space: volume.space, source: volume.source, thresholdPercent: volume.thresholdPercent, sourceLabelVoxels: sampled.sourceCount, resampled: sampled.resampled, reordered: sampled.reordered });
  const A = info(volumeA, labelA, descriptors.A, a), B = info(volumeB, labelB, descriptors.B, b);
  return {
    id: `${A.atlasId || 'A'}:${labelA}|${B.atlasId || 'B'}:${labelB}|${grid.shape.join('x')}|${grid.affine.join(',')}`,
    A, B, grid: { shape: grid.shape, affine: grid.affine, order: 'x-fastest', space: grid.space, voxelVolumeMm3: mm3 },
    maskA: a.mask, maskB: b.mask, classes, center: unionVoxels ? sum.map(n => n / unionVoxels) : null, bounds: unionVoxels ? [low, high] : null,
    metrics: { aVoxels, bVoxels, intersectionVoxels, unionVoxels, aOnlyVoxels, bOnlyVoxels, aMm3: aVoxels * mm3, bMm3: bVoxels * mm3, intersectionMm3: intersectionVoxels * mm3, unionMm3: unionVoxels * mm3, aOnlyMm3: aOnlyVoxels * mm3, bOnlyMm3: bOnlyVoxels * mm3, dice: aVoxels + bVoxels ? 2 * intersectionVoxels / (aVoxels + bVoxels) : null, jaccard: unionVoxels ? intersectionVoxels / unionVoxels : null, aCoveredByB: aVoxels ? intersectionVoxels / aVoxels : null, bCoveredByA: bVoxels ? intersectionVoxels / bVoxels : null },
    display: { ...ROI_DEFAULT_DISPLAY }, representation: 'binary-labels', method: 'Nearest-neighbour source-label sampling at FSL target voxel centres; exact counts on the shared grid; no new anatomical registration.'
  };
}

const FACES = [
  { offset: [-1, 0, 0], normal: [-1, 0, 0], corners: [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]] },
  { offset: [1, 0, 0], normal: [1, 0, 0], corners: [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]] },
  { offset: [0, -1, 0], normal: [0, -1, 0], corners: [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]] },
  { offset: [0, 1, 0], normal: [0, 1, 0], corners: [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]] },
  { offset: [0, 0, -1], normal: [0, 0, -1], corners: [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]] },
  { offset: [0, 0, 1], normal: [0, 0, 1], corners: [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]] },
];

/** Exact voxel-cell boundary faces; no smoothing, morphology, or inferred bridges. */
export function voxelMaskSurface(comparison, part) {
  const { classes, grid } = comparison, [nx, ny, nz] = grid.shape, affine = grid.affine;
  const included = value => part === 'A' ? (value & 1) !== 0 : part === 'B' ? (value & 2) !== 0 : value === ({ aOnly: 1, bOnly: 2, intersection: 3 }[part]);
  const faces = [];
  let index = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, index++) {
    if (!included(classes[index])) continue;
    for (let f = 0; f < FACES.length; f++) {
      const [dx, dy, dz] = FACES[f].offset, x = i + dx, y = j + dy, z = k + dz;
      if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz || !included(classes[x + nx * (y + ny * z)])) faces.push(index, f);
    }
  }
  if (faces.length / 2 > 600_000) throw new Error('surface-too-large');
  const positions = new Float32Array(faces.length / 2 * 18), normals = new Float32Array(positions.length);
  const inverseTranspose = new Matrix4().set(...affine).invert().transpose().elements;
  const determinant = new Matrix4().set(...affine).determinant();
  const triangles = determinant < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
  let at = 0;
  for (let n = 0; n < faces.length; n += 2) {
    const voxel = faces[n], i = voxel % nx, j = Math.floor(voxel / nx) % ny, k = Math.floor(voxel / (nx * ny));
    const face = FACES[faces[n + 1]], nv = face.normal;
    const normal = [inverseTranspose[0] * nv[0] + inverseTranspose[4] * nv[1] + inverseTranspose[8] * nv[2], inverseTranspose[1] * nv[0] + inverseTranspose[5] * nv[1] + inverseTranspose[9] * nv[2], inverseTranspose[2] * nv[0] + inverseTranspose[6] * nv[1] + inverseTranspose[10] * nv[2]];
    const length = Math.hypot(...normal);
    for (const corner of triangles) {
      const q = face.corners[corner], x = i + q[0], y = j + q[1], z = k + q[2];
      positions[at] = affine[0] * x + affine[1] * y + affine[2] * z + affine[3];
      positions[at + 1] = affine[4] * x + affine[5] * y + affine[6] * z + affine[7];
      positions[at + 2] = affine[8] * x + affine[9] * y + affine[10] * z + affine[11];
      normals[at] = normal[0] / length; normals[at + 1] = normal[1] / length; normals[at + 2] = normal[2] / length; at += 3;
    }
  }
  return { positions, normals, triangles: positions.length / 9, faces: faces.length / 2 };
}

export function attachROISurfaces(comparison) {
  return { ...comparison, surfaces: Object.fromEntries(['aOnly', 'bOnly', 'intersection', 'A', 'B'].map(part => [part, voxelMaskSurface(comparison, part)])) };
}

export function sampleComparisonRAS(comparison, x, y, z) {
  if (!comparison) return 0;
  let inverse = comparisonSamplers.get(comparison);
  if (!inverse) { inverse = new Matrix4().set(...comparison.grid.affine).invert().elements; comparisonSamplers.set(comparison, inverse); }
  const i = Math.round(inverse[0] * x + inverse[4] * y + inverse[8] * z + inverse[12]);
  const j = Math.round(inverse[1] * x + inverse[5] * y + inverse[9] * z + inverse[13]);
  const k = Math.round(inverse[2] * x + inverse[6] * y + inverse[10] * z + inverse[14]);
  const shape = comparison.grid.shape;
  if (i < 0 || j < 0 || k < 0 || i >= shape[0] || j >= shape[1] || k >= shape[2]) return 0;
  return comparison.classes[i + shape[0] * (j + shape[1] * k)];
}

export function roiSliceStyle(value, display = ROI_DEFAULT_DISPLAY) {
  const mode = display.mode || 'parts';
  if (!value || (mode === 'overlap' && value !== 3) || (mode === 'A' && !(value & 1)) || (mode === 'B' && !(value & 2))) return null;
  const key = mode === 'A' ? 'A' : mode === 'B' ? 'B' : value === 3 ? 'intersection' : value === 1 ? 'aOnly' : 'bOnly';
  return { key, color: ROI_COLORS[key], opacity: Math.max(0, Math.min(1, key === 'intersection' ? display.opacityOverlap ?? display.opacity ?? 0.9 : ['A', 'aOnly'].includes(key) ? display.opacityA ?? display.opacity ?? 0.65 : display.opacityB ?? display.opacity ?? 0.65)) };
}

export function serializableVolume(volume) {
  return Object.fromEntries(['data', 'shape', 'affine', 'order', 'space', 'canOverlayOnTarget', 'alignmentStatus', 'labels', 'source', 'thresholdPercent'].map(key => [key, volume[key]]));
}

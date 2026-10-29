import { Matrix4 } from 'three';

export const ROI_COLORS = { aOnly: '#27a5b5', bOnly: '#e39845', intersection: '#8e69c6', A: '#27a5b5', B: '#e39845' };
export const ROI_DEFAULT_DISPLAY = { mode: 'parts', opacity: 0.7, opacityA: 0.65, opacityB: 0.65, opacityOverlap: 0.9, xray: false };
const comparisonSamplers = new WeakMap();
const MAX_GRID_VOXELS = 8_000_000;
const affineArray = volume => Array.isArray(volume.affine?.[0]) ? volume.affine.flat() : volume.affine;

function checkedGrid(volume, maxVoxels = MAX_GRID_VOXELS) {
  const affine = affineArray(volume);
  if (!volume.shape || volume.shape.length !== 3 || !volume.shape.every(n => Number.isInteger(n) && n > 0) || volume.shape.reduce((a, b) => a * b, 1) > maxVoxels) throw new Error('invalid-grid');
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
export function resampleROI(volume, selection, target) {
  if (volume.canOverlayOnTarget !== true) throw new Error('unaligned-atlas');
  if ((volume.custom || volume.alignmentStatus === 'user-declared') && volume.space !== target.space) throw new Error('unaligned-atlas');
  const source = checkedGrid(volume, 64_000_000), grid = checkedGrid(target);
  selection = normalizeROISelection(volume, selection);
  if (volume.data.length !== source.shape.reduce((a, b) => a * b, 1)) throw new Error('invalid-data-length');
  const mask = new Uint8Array(grid.shape.reduce((a, b) => a * b, 1));
  const weights = selection.kind === 'probability' ? new Float32Array(mask.length) : null;
  const sourceXFast = volume.order !== 'z-fastest';
  const labels = new Set(selection.labels);
  const sourceLabelCounts = new Map(), targetLabelCounts = new Map();
  const include = value => selection.kind === 'label' ? labels.has(value) : selection.kind === 'mask' ? value !== 0 : selection.kind === 'probability' ? value > 0 && value >= selection.threshold : selection.tail === 'negative' ? value < 0 && value <= -selection.threshold : selection.tail === 'absolute' ? value !== 0 && Math.abs(value) >= selection.threshold : value > 0 && value >= selection.threshold;
  let sourceCount = 0;
  for (const value of volume.data) {
    if (!Number.isFinite(value)) throw new Error('invalid-values');
    if (selection.kind === 'probability' && (value < 0 || value > 1)) throw new Error('invalid-probability-range');
    if (include(value)) { sourceCount++; if (selection.kind === 'label') sourceLabelCounts.set(value, (sourceLabelCounts.get(value) || 0) + 1); }
  }
  let targetCount = 0;
  const recordTarget = value => {
    if (!include(value)) return 0;
    targetCount++;
    if (selection.kind === 'label') targetLabelCounts.set(value, (targetLabelCounts.get(value) || 0) + 1);
    return 1;
  };
  const identical = sameGrid(source, grid);
  if (identical && sourceXFast) {
    for (let i = 0; i < mask.length; i++) { mask[i] = recordTarget(volume.data[i]); if (weights) weights[i] = volume.data[i]; }
  } else {
    const transform = source.matrix.clone().invert().multiply(grid.matrix).elements;
    const [sx, sy, sz] = source.shape, [tx, ty, tz] = grid.shape;
    const at = (x,y,z) => x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : volume.data[sourceXFast ? x + sx * (y + sy * z) : (x * sy + y) * sz + z];
    let index = 0;
    for (let k = 0; k < tz; k++) for (let j = 0; j < ty; j++) for (let i = 0; i < tx; i++, index++) {
      const x = transform[0] * i + transform[4] * j + transform[8] * k + transform[12];
      const y = transform[1] * i + transform[5] * j + transform[9] * k + transform[13];
      const z = transform[2] * i + transform[6] * j + transform[10] * k + transform[14];
      let value;
      if (selection.kind === 'label' || selection.kind === 'mask') value = at(Math.round(x),Math.round(y),Math.round(z));
      else {
        const x0=Math.floor(x),y0=Math.floor(y),z0=Math.floor(z),dx=x-x0,dy=y-y0,dz=z-z0;
        value=0;
        for(let oz=0;oz<2;oz++)for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++)value+=at(x0+ox,y0+oy,z0+oz)*(ox?dx:1-dx)*(oy?dy:1-dy)*(oz?dz:1-dz);
      }
      mask[index]=recordTarget(value);if(weights)weights[index]=value;
    }
  }
  const perLabel = selection.kind === 'label' ? selection.labels.map(labelId => {
    const sourceVoxels = sourceLabelCounts.get(labelId) || 0, targetVoxels = targetLabelCounts.get(labelId) || 0;
    return { labelId, sourceVoxels, sourceMm3:sourceVoxels * source.voxelVolumeMm3, targetVoxels, targetMm3:targetVoxels * grid.voxelVolumeMm3 };
  }) : [];
  const lostLabelIds = perLabel.filter(label => label.sourceVoxels && !label.targetVoxels).map(label => label.labelId);
  const absentLabelIds = perLabel.filter(label => !label.sourceVoxels).map(label => label.labelId);
  const sampling = { sourceVoxels:sourceCount, sourceMm3:sourceCount * source.voxelVolumeMm3, targetVoxels:targetCount, targetMm3:targetCount * grid.voxelVolumeMm3, lostLabelIds, absentLabelIds, labels:perLabel,
    status:!sourceCount ? 'empty-source' : !targetCount ? 'empty-target' : lostLabelIds.length || absentLabelIds.length ? 'partial-loss' : 'retained' };
  return { mask, weights, selection, sourceCount, sampling, resampled: !identical, reordered: !sourceXFast, interpolation: ['label','mask'].includes(selection.kind) ? 'nearest-neighbour' : 'trilinear' };
}

export function normalizeROISelection(volume, selection) {
  if (typeof selection === 'number' || typeof selection === 'string' || Array.isArray(selection)) selection = { labels: Array.isArray(selection) ? selection : [Number(selection)] };
  selection = selection || {};
  const kind = volume.kind || 'label';
  if (!['label','mask','probability','statistic'].includes(kind)) throw new Error('invalid-roi-kind');
  const labels = [...new Set((selection.labels || []).map(Number))].sort((a,b)=>a-b);
  if(kind==='label' && (!labels.length || !labels.every(n=>Number.isSafeInteger(n)&&n>0))) throw new Error('invalid-label');
  const threshold = Number(selection.threshold ?? (kind==='probability'?0.5:0));
  if (!Number.isFinite(threshold)||threshold<0||(kind==='probability'&&threshold>1))throw new Error('invalid-threshold');
  const tail=selection.tail||'positive';
  if(!['positive','negative','absolute'].includes(tail))throw new Error('invalid-tail');
  return {kind, labels, threshold, tail};
}

export const resampleLabelMask = (volume, labelId, target) => resampleROI(volume, {labels:[Number(labelId)]}, target);

export function compareROIs(volumeA, selectionA, volumeB, selectionB, target, descriptors = {}) {
  const grid = checkedGrid(target);
  if (grid.space !== 'MNI152NLin6Asym') throw new Error('unsupported-target-space');
  const a = resampleROI(volumeA, selectionA, grid), b = resampleROI(volumeB, selectionB, grid);
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
  const info = (volume, descriptor, sampled) => ({ ...descriptor, labelId: sampled.selection.labels.length===1?sampled.selection.labels[0]:null, labelIds:sampled.selection.labels, selection:sampled.selection, name:descriptor?.name||volume.name||`Labels ${sampled.selection.labels.join(' + ')}`, alignmentStatus: volume.alignmentStatus, space: volume.space, source: volume.source, provenance:volume.provenance, thresholdPercent: volume.thresholdPercent, sourceLabelVoxels: sampled.sourceCount, resampled: sampled.resampled, reordered: sampled.reordered, interpolation:sampled.interpolation });
  const A = info(volumeA, descriptors.A, a), B = info(volumeB, descriptors.B, b);
  let probabilityMetrics = null;
  if(a.weights && b.weights) {
    let sumA=0,sumB=0,sumMin=0,sumMax=0;
    for(let i=0;i<a.weights.length;i++){sumA+=a.weights[i];sumB+=b.weights[i];sumMin+=Math.min(a.weights[i],b.weights[i]);sumMax+=Math.max(a.weights[i],b.weights[i]);}
    probabilityMetrics={fuzzyDice:sumA+sumB?2*sumMin/(sumA+sumB):null,fuzzyJaccard:sumMax?sumMin/sumMax:null,massA:sumA,massB:sumB,intersectionMass:sumMin,unionMass:sumMax,massAMm3:sumA*mm3,massBMm3:sumB*mm3,intersectionMassMm3:sumMin*mm3,unionMassMm3:sumMax*mm3,method:'Unthresholded probabilities on shared grid; fuzzy Dice = 2 sum(min(p,q)) / (sum(p)+sum(q)); fuzzy Jaccard = sum(min(p,q)) / sum(max(p,q)).'};
  }
  return {
    id: `${A.atlasId || 'A'}:${JSON.stringify(a.selection)}|${B.atlasId || 'B'}:${JSON.stringify(b.selection)}|${grid.shape.join('x')}|${grid.affine.join(',')}`,
    A, B, sampling: { A:a.sampling, B:b.sampling }, grid: { shape: grid.shape, affine: grid.affine, order: 'x-fastest', space: grid.space, voxelVolumeMm3: mm3 },
    maskA: a.mask, maskB: b.mask, classes, center: unionVoxels ? sum.map(n => n / unionVoxels) : null, bounds: unionVoxels ? [low, high] : null,
    metrics: { aVoxels, bVoxels, intersectionVoxels, unionVoxels, aOnlyVoxels, bOnlyVoxels, aMm3: aVoxels * mm3, bMm3: bVoxels * mm3, intersectionMm3: intersectionVoxels * mm3, unionMm3: unionVoxels * mm3, aOnlyMm3: aOnlyVoxels * mm3, bOnlyMm3: bOnlyVoxels * mm3, dice: aVoxels + bVoxels ? 2 * intersectionVoxels / (aVoxels + bVoxels) : null, jaccard: unionVoxels ? intersectionVoxels / unionVoxels : null, aCoveredByB: aVoxels ? intersectionVoxels / aVoxels : null, bCoveredByA: bVoxels ? intersectionVoxels / bVoxels : null },
    probabilityMetrics, display: { ...ROI_DEFAULT_DISPLAY }, representation: 'binary-labels', method: `Labels/masks: nearest-neighbour. Continuous maps: trilinear sampling with zero outside source, then threshold. Exact binary counts on FSL shared grid; no new anatomical registration. A: ${JSON.stringify(a.selection)}; B: ${JSON.stringify(b.selection)}.`
  };
}

export const compareLabelROIs = (volumeA,labelA,volumeB,labelB,target,descriptors={}) => compareROIs(volumeA,{labels:[Number(labelA)]},volumeB,{labels:[Number(labelB)]},target,descriptors);

export function comparisonMaskVolume(comparison, part) {
  if(!['A','B','intersection','union'].includes(part))throw new Error('invalid-mask-part');
  const data=Uint8Array.from(comparison.classes, value=>Number(part==='A'?(value&1)!==0:part==='B'?(value&2)!==0:part==='intersection'?value===3:value!==0));
  return {...comparison.grid,data,dtype:'uint8',kind:'mask',name:`ROI ${part}; ${comparison.grid.space}`};
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
      if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz || !included(classes[x + nx * (y + ny * z)])) {
        faces.push(index, f);
        if (faces.length / 2 > 600_000) throw new Error('surface-too-large');
      }
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
  const surfaceWarnings = [];
  const surfaces = Object.fromEntries(['aOnly', 'bOnly', 'intersection', 'A', 'B'].map(part => {
    try { return [part, voxelMaskSurface(comparison, part)]; }
    catch (error) {
      if (error.message !== 'surface-too-large') throw error;
      surfaceWarnings.push(part);
      return [part, {positions:new Float32Array(0),normals:new Float32Array(0),triangles:0,faces:0,omitted:true}];
    }
  }));
  return { ...comparison, surfaces, surfaceWarnings };
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
  return Object.fromEntries(['data', 'shape', 'affine', 'order', 'space', 'canOverlayOnTarget', 'alignmentStatus', 'labels', 'source', 'thresholdPercent','kind','custom','name','provenance'].map(key => [key, volume[key]]));
}

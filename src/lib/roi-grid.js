import { resampleROI } from './roi.js';

const SPACE = 'MNI152NLin6Asym';
const affineFor = step => [step,0,0,-90,0,step,0,-126,0,0,step,-72,0,0,0,1];
const shapeFor = step => step === 1 ? [181,217,181] : [91,109,91];

/** Declared RAS grids only. Sampling spacing is not registration accuracy. */
export function makeComparisonGrid(reference, resolutionMm) {
  if (resolutionMm !== 1 && resolutionMm !== 2) throw new Error('unsupported-comparison-resolution');
  const affine = Array.isArray(reference?.affine?.[0]) ? reference.affine.flat() : reference?.affine;
  const declared = [1,2].some(step => reference?.shape?.length === 3 && shapeFor(step).every((n,i) => reference.shape[i] === n) && affine?.length === 16 && affineFor(step).every((n,i) => Number.isFinite(affine[i]) && Math.abs(affine[i]-n) < 1e-7));
  if (!declared || reference.space !== SPACE || (reference.order && reference.order !== 'x-fastest')) throw new Error('unsupported-reference-grid');
  return { shape:shapeFor(resolutionMm), affine:affineFor(resolutionMm), space:SPACE, order:'x-fastest' };
}

/** Counts source and target separately; only present source labels can be lost. */
export function inspectROISampling(volume, selection, target) {
  return resampleROI(volume, selection, target).sampling;
}

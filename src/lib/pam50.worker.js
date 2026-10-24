import { parseNifti1, cropNiftiSelections } from './nifti.js';
import { voxelMaskSurface } from './roi.js';

const PAM50_PREFIX = 'https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/609a18235d9143dad0d6bf5bb35e2bff9e55196f/';
const queue = [];
let running = false;

async function processSource(entries) {
  const source = entries[0];
  if (!source.url?.startsWith(PAM50_PREFIX) || !source.url.endsWith('.nii.gz') || entries.some(entry => entry.format !== 'nifti1-gzip' || entry.sha256 !== source.sha256 || !['label','threshold'].includes(entry.selector))) throw new Error('unsupported-pam50-source');
  if (typeof DecompressionStream === 'undefined') throw new Error('gzip-not-supported');
  self.postMessage({ type: 'progress', ids: entries.map(entry => entry.id), stage: 'download', url: source.url });
  const response = await fetch(source.url, { mode: 'cors', credentials: 'omit', cache: 'force-cache', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`source-http-${response.status}`);
  const compressed = await response.arrayBuffer();
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', compressed))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (sha256 !== source.sha256) throw new Error('source-hash-mismatch');
  self.postMessage({ type: 'progress', ids: entries.map(entry => entry.id), stage: 'extract', url: source.url });
  const inflated = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const volume = parseNifti1(inflated, { spatialUnitsIfMissing: source.sourceAffine && source.sourceShape ? source.spatialUnitsIfMissing : undefined });
  if (source.sourceShape && source.sourceShape.some((value, axis) => value !== volume.shape[axis])) throw new Error('source-shape-mismatch');
  if (source.sourceAffine && source.sourceAffine.some((value, index) => Math.abs(value - volume.affine[index]) > 0.001)) throw new Error('source-affine-mismatch');
  const masks = cropNiftiSelections(volume, entries);
  for (const mask of masks) {
    const surface = voxelMaskSurface({ classes: mask.mask, grid: mask.grid }, 'A');
    const data = { kind: 'mesh', coordinateSystem: 'RAS', units: 'mm', positions: surface.positions, normals: surface.normals, indices: null };
    self.postMessage({ type: 'result', id: mask.id, data, metadata: { sourceVerifiedSha256: sha256, runtimeGenerated: true, runtimeVertices: surface.positions.length / 3, runtimeTriangles: surface.triangles, sourceMaskVoxels: mask.sourceVoxels, sourceVoxelSizeMm: volume.voxelSizeMm, unitsProvenance: volume.unitsProvenance, meshMethod: 'Browser-generated source-resolution voxel-cell boundary; no smoothing, interpolation or anatomical registration', generatedInBrowser: true } }, [data.positions.buffer, data.normals.buffer]);
  }
}

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const first = queue.shift(), entries = [first];
    for (let index = queue.length - 1; index >= 0; index--) if (queue[index].url === first.url) entries.push(queue.splice(index, 1)[0]);
    try { await processSource(entries); }
    catch (error) { self.postMessage({ type: 'error', ids: entries.map(entry => entry.id), message: error.message || 'source-unavailable' }); }
  }
  running = false; self.postMessage({ type: 'idle' });
}

self.onmessage = event => { queue.push(...event.data.entries); void drain(); };

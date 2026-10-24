import { Matrix4, Vector3 } from 'three';
import { dataURL } from './assets.js';
import { roiSliceStyle, sampleComparisonRAS } from './roi.js';

const cache = new Map();
const pending = new Map();
export const SLICE_BOUNDS = { x: [-100, 100], y: [-140, 100], z: [-80, 120] };
const assetPath = dataURL;

export async function loadManifest() {
  if (!pending.has('manifest')) pending.set('manifest', fetch(dataURL('manifest.json')).then(response => {
    if (!response.ok) throw new Error('解剖数据清单尚未加载');
    return response.json();
  }).catch(error => { pending.delete('manifest'); throw error; }));
  return pending.get('manifest');
}

export function prepareVolume(data, metadata) {
  const affine = Array.isArray(metadata.affine?.[0]) ? metadata.affine.flat() : metadata.affine;
  if (!affine || affine.length !== 16 || !metadata.shape?.every(Number.isFinite)) throw new Error('影像空间信息不完整');
  const matrix = new Matrix4().set(...affine);
  if (!affine.every(Number.isFinite) || Math.abs(matrix.determinant()) < 1e-10) throw new Error('影像仿射矩阵无效');
  const inverse = matrix.clone().invert();
  const shape = metadata.shape;
  const world = new Vector3();
  return {
    ...metadata, data, affine, inverse,
    sampleRAS(x, y, z) {
      world.set(x, y, z).applyMatrix4(inverse);
      const i = Math.round(world.x), j = Math.round(world.y), k = Math.round(world.z);
      if (i < 0 || j < 0 || k < 0 || i >= shape[0] || j >= shape[1] || k >= shape[2]) return 0;
      const index = metadata.order === 'z-fastest' ? (i * shape[1] + j) * shape[2] + k : i + shape[0] * (j + shape[1] * k);
      return data[index] || 0;
    },
    sampleProbabilityRAS(x, y, z) {
      if (!metadata.probabilityData) return null;
      world.set(x, y, z).applyMatrix4(inverse);
      const i = Math.round(world.x), j = Math.round(world.y), k = Math.round(world.z);
      if (i < 0 || j < 0 || k < 0 || i >= shape[0] || j >= shape[1] || k >= shape[2]) return null;
      const index = metadata.order === 'z-fastest' ? (i * shape[1] + j) * shape[2] + k : i + shape[0] * (j + shape[1] * k);
      return metadata.probabilityData[index];
    },
  };
}

async function loadBinaryVolume(metadata) {
  const response = await fetch(assetPath(metadata.data || metadata.file || metadata.path));
  if (!response.ok) throw new Error('影像文件加载失败');
  const buffer = await response.arrayBuffer();
  const dtype = String(metadata.dtype || 'uint8').toLowerCase();
  const data = dtype.includes('float32') ? new Float32Array(buffer) : dtype.includes('16') ? new Uint16Array(buffer) : new Uint8Array(buffer);
  if (data.length !== metadata.shape.reduce((a, b) => a * b, 1)) throw new Error('影像文件尺寸与空间信息不一致');
  if (metadata.probability) {
    const probabilityResponse = await fetch(assetPath(metadata.probability));
    if (!probabilityResponse.ok) throw new Error('图谱概率数据加载失败');
    const probabilityData = new Uint8Array(await probabilityResponse.arrayBuffer());
    if (probabilityData.length !== data.length) throw new Error('图谱概率体积尺寸不匹配');
    metadata = { ...metadata, probabilityData };
  }
  return prepareVolume(data, metadata);
}

export async function loadAnatomyVolume() {
  if (cache.has('t1')) return cache.get('t1');
  if (!pending.has('t1')) pending.set('t1', fetch(dataURL('volume.json')).then(response => {
    if (!response.ok) throw new Error('MNI152 影像尚未加载');
    return response.json();
  }).then(loadBinaryVolume).then(volume => { cache.set('t1', volume); return volume; }).catch(error => { pending.delete('t1'); throw error; }));
  return pending.get('t1');
}

export async function loadAtlas(atlasId) {
  if (cache.has(atlasId)) return cache.get(atlasId);
  const key = `atlas-${atlasId}`;
  if (!pending.has(key)) pending.set(key, loadManifest().then(async manifest => {
    let metadata = manifest.atlases?.[atlasId];
    if (!metadata?.available || !(metadata.data || metadata.file || metadata.metadata)) return null;
    if (metadata.metadata) metadata = { ...metadata, ...await fetch(assetPath(metadata.metadata)).then(r => { if (!r.ok) throw new Error('图谱空间信息加载失败'); return r.json(); }) };
    const volume = await loadBinaryVolume(metadata);
    cache.set(atlasId, volume);
    return volume;
  }).catch(error => { pending.delete(key); throw error; }));
  return pending.get(key);
}

export function sliceWorldPoint(axis, value, u, v, radiological = true) {
  const horizontal = axis === 'x' ? 'y' : 'x';
  const vertical = axis === 'z' ? 'y' : 'z';
  const h = SLICE_BOUNDS[horizontal], w = SLICE_BOUNDS[vertical];
  const hu = radiological && axis !== 'x' ? 1 - u : u;
  const point = { x: 0, y: 0, z: 0 };
  point[axis] = value;
  point[horizontal] = h[0] + hu * (h[1] - h[0]);
  point[vertical] = w[1] - v * (w[1] - w[0]);
  return [point.x, point.y, point.z];
}

export function makeSliceCanvas(volume, axis, value, options = {}) {
  const size = options.size || 256;
  const canvas = document.createElement('canvas');
  const horizontal = axis === 'x' ? 'y' : 'x';
  const vertical = axis === 'z' ? 'y' : 'z';
  const h = SLICE_BOUNDS[horizontal], v = SLICE_BOUNDS[vertical];
  canvas.width = size;
  canvas.height = Math.round(size * (v[1] - v[0]) / (h[1] - h[0]));
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  const radiological = options.radiological !== false;
  for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) {
    const point = sliceWorldPoint(axis, value, px / (canvas.width - 1), py / (canvas.height - 1), radiological);
    const intensity = volume.sampleRAS(...point);
    const q = (py * canvas.width + px) * 4;
    pixels.data[q] = pixels.data[q + 1] = pixels.data[q + 2] = intensity;
    pixels.data[q + 3] = options.transparent && intensity < 5 ? 0 : 255;
    if (options.roiComparison) {
      const style = roiSliceStyle(sampleComparisonRAS(options.roiComparison, ...point), options.roiDisplay || options.roiComparison.display);
      if (style) {
        const rgb = style.color.match(/\w\w/g).map(value => parseInt(value, 16));
        for (let channel = 0; channel < 3; channel++) pixels.data[q + channel] = Math.round(intensity * (1 - style.opacity) + rgb[channel] * style.opacity);
        if (style.opacity > 0) pixels.data[q + 3] = 255;
      }
    }
  }
  context.putImageData(pixels, 0, 0);
  if (options.crosshair) {
    const point = { x: options.crosshair[0], y: options.crosshair[1], z: options.crosshair[2] };
    let u = (point[horizontal] - h[0]) / (h[1] - h[0]);
    if (radiological && axis !== 'x') u = 1 - u;
    const y = (v[1] - point[vertical]) / (v[1] - v[0]) * canvas.height;
    const x = u * canvas.width;
    context.strokeStyle = options.crosshairColor || '#8fc5b5';
    context.lineWidth = 0.8;
    context.setLineDash([3, 3]);
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  return canvas;
}

export function atlasLabelAt(volume, point) {
  if (!volume) return null;
  const value = volume.sampleRAS(...point);
  if (!value) return null;
  const labels = volume.labels;
  const label = Array.isArray(labels) ? labels.find(label => Number(label.id ?? label.index ?? label.value) === value) : labels?.[value];
  return { value, name: typeof label === 'string' ? label : label?.name || label?.label || `标签 ${value}`, probability: volume.sampleProbabilityRAS?.(...point) ?? null };
}

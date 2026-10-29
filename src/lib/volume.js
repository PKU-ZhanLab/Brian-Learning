import { Matrix4, Vector3 } from 'three';
import { dataURL } from './assets.js';
import { roiSliceStyle, sampleComparisonRAS } from './roi.js';
import {getCustomVolume,listCustomVolumes} from './custom-volumes.js';
import { makeAssetIdentity } from './computation-manifest.js';
import { MAIN_MANIFEST_RESOURCE, ANATOMY_VOLUME_RESOURCE, atlasResourceKey, resourceValue } from './atlas-resource.js';

const pending = new Map();
const atlasMetadata = new Map();
export const SLICE_BOUNDS = { x: [-100, 100], y: [-140, 100], z: [-80, 120] };
const assetPath = dataURL;
const ATLAS_RGB = ['9ebdb2','e4bcaa','b6b7d3','b8cbb0','d9c797','a6becf','d5b0ba','b8c5d5','c9c1a7','98bfbf','d7c4b9','c2b5ca'].map(hex=>hex.match(/../g).map(value=>parseInt(value,16)));

export async function loadManifest() {
  return resourceValue(MAIN_MANIFEST_RESOURCE);
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

async function loadBinaryVolume(metadata, {signal}={}) {
  const file = metadata.data || metadata.file || metadata.path;
  const response = await fetch(assetPath(file),{signal});
  if (!response.ok) throw new Error('影像文件加载失败');
  const buffer = await response.arrayBuffer();
  const identity = await makeAssetIdentity(new Uint8Array(buffer), {id:`public/data/${file}`,version:metadata.atlasVersion||`sha256:${metadata.sha256}`,spaceId:metadata.spaceId??metadata.space??null});
  if (!metadata.sha256 || identity.sha256 !== metadata.sha256) throw new Error('Loaded volume byte digest mismatch or missing expected hash');
  if (!pending.has('asset-identities')) pending.set('asset-identities',fetch(dataURL('asset-identities.json')).then(r=>{if(!r.ok)throw Error('Asset identities could not be loaded');return r.json();}).catch(error=>{pending.delete('asset-identities');throw error;}));
  const entry=(await pending.get('asset-identities')).assets?.[file];
  if(entry&&(entry.identity.sha256!==identity.sha256||entry.identity.spaceId!==identity.spaceId))throw Error('Asset identity differs from loaded volume');
  for(const dependency of entry?.verificationFiles||[]){
    if(dependency.path===metadata.probability)continue;
    const r=await fetch(assetPath(dependency.path),{signal});if(!r.ok)throw Error('Transform/source bytes unavailable');
    const observed=await makeAssetIdentity(new Uint8Array(await r.arrayBuffer()),{id:dependency.path,version:'observed',spaceId:null});
    if(observed.sha256!==dependency.sha256)throw Error('Transform/source byte digest mismatch');
  }
  const dtype = String(metadata.dtype || 'uint8').toLowerCase();
  const data = dtype.includes('float32') ? new Float32Array(buffer) : dtype.includes('16') ? new Uint16Array(buffer) : new Uint8Array(buffer);
  if (data.length !== metadata.shape.reduce((a, b) => a * b, 1)) throw new Error('影像文件尺寸与空间信息不一致');
  if (metadata.probability) {
    const probabilityResponse = await fetch(assetPath(metadata.probability),{signal});
    if (!probabilityResponse.ok) throw new Error('图谱概率数据加载失败');
    const probabilityData = new Uint8Array(await probabilityResponse.arrayBuffer());
    const probabilityIdentity=await makeAssetIdentity(probabilityData,{id:metadata.probability,version:'observed',spaceId:identity.spaceId});
    if(!metadata.probabilitySha256||probabilityIdentity.sha256!==metadata.probabilitySha256)throw Error('Probability byte digest mismatch');
    if (probabilityData.length !== data.length) throw new Error('图谱概率体积尺寸不匹配');
    metadata = { ...metadata, probabilityData };
  }
  return prepareVolume(data, {...metadata,identity,identityVerification:'received-bytes',sourceIdentities:entry?.sourceIdentities??null,sourceGrid:entry?.sourceGrid??null,transforms:entry?.transforms??null,spatialEvidence:entry?.spatialEvidence??{space:identity.spaceId,source:metadata.source??null,limitations:['Original dependencies and transform chain are unavailable.']}});
}

export async function loadAnatomyVolume() {
  return resourceValue(ANATOMY_VOLUME_RESOURCE);
}
export async function loadAnatomyVolumeData({signal}={}) {
  return fetch(dataURL('volume.json'),{signal}).then(response => {
    if (!response.ok) throw new Error('MNI152 影像尚未加载');
    return response.json();
  }).then(metadata=>loadBinaryVolume(metadata,{signal}));
}

async function resolveAtlasMetadata(atlasId,{signal}={}) {
  const custom=getCustomVolume(atlasId);
  if(custom)return {...custom,atlasId,atlasVersion:custom.atlasVersion||custom.identity?.version,sha256:custom.identity?.sha256||custom.sha256,spaceId:custom.identity?custom.identity.spaceId:custom.spaceId??null};
  const manifest = await loadManifest();
  let metadata = manifest.atlases?.[atlasId];
  if (!metadata?.available || !(metadata.data || metadata.file || metadata.metadata)) return null;
  if (metadata.metadata) metadata = { ...metadata, ...await fetch(assetPath(metadata.metadata),{signal}).then(r => { if (!r.ok) throw new Error('图谱空间信息加载失败'); return r.json(); }) };
  metadata = { ...metadata, atlasId };
  if (!metadata.atlasVersion || !/^[a-f\d]{64}$/i.test(metadata.sha256) || !metadata.spaceId) throw Error('Atlas version, digest and source space identity are required');
  return metadata;
}
export const atlasIdentityFor=metadata=>metadata?.identity||{id:`public/data/${metadata?.data||metadata?.file||metadata?.path}`,version:metadata?.atlasVersion,sha256:metadata?.sha256,spaceId:metadata?.spaceId};
const metadataIdentity=atlasIdentityFor;
const metadataSignature=metadata=>JSON.stringify([metadata.atlasId,metadata.probabilitySha256??null,metadata.shape,metadata.affine,metadata.order,metadata.surfaceProjection??null]);
export async function loadAtlas(atlasId,options={}) {
  const metadata=await resolveAtlasMetadata(atlasId,options);if(!metadata)return null;
  const identity=metadataIdentity(metadata),key=atlasResourceKey(identity);
  const previous=atlasMetadata.get(key);
  if(previous&&metadataSignature(previous)!==metadataSignature(metadata))throw Error('Atlas metadata changed without a new asset identity');
  atlasMetadata.set(key,getCustomVolume(atlasId)?{...metadata}:structuredClone(metadata));
  return loadAtlasVersion(identity,options);
}
/** Load only the declared identity; byte/catalog/transform checks remain mandatory. */
export async function loadAtlasVersion(identity,{signal}={}) {
  signal?.throwIfAborted();
  const promise=resourceValue(atlasResourceKey(identity));
  if(!signal)return promise;
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));
    signal.addEventListener('abort',abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
/** Resource loader: only atlas-resource starts/cancels the shared transfer. */
export async function loadAtlasVersionData(identity,{signal}={}) {
  signal?.throwIfAborted();
  const key=atlasResourceKey(identity);
  let metadata=atlasMetadata.get(key);
  if(!metadata){
    const custom=listCustomVolumes().find(volume=>atlasResourceKey(metadataIdentity(volume))===key);
    if(custom)metadata=await resolveAtlasMetadata(custom.id,{signal});
  }
  if(!metadata){
    const manifest=await loadManifest();
    const candidate=Object.entries(manifest.atlases||{}).find(([atlasId,entry])=>identity.id===atlasId||identity.id===`public/data/${entry.data||entry.file||entry.path}`);
    if(candidate)metadata=await resolveAtlasMetadata(candidate[0],{signal});
  }
  if(!metadata||atlasResourceKey(metadataIdentity(metadata))!==key)throw Error('Requested atlas identity/version is unavailable');
  const atlasId=metadata.atlasId;
  const volume=metadata.custom||getCustomVolume(atlasId)?prepareVolume(metadata.data,metadata):await loadBinaryVolume(metadata,{signal});
  if(atlasResourceKey(volume.identity)!==key)throw Error('Loaded atlas identity differs from requested identity');
    if(metadata.surfaceProjection){
      const response=await fetch(dataURL(metadata.surfaceProjection),{signal});
      if(!response.ok)throw Error('Surface projection metadata could not be loaded');
      const projection=(await response.json()).atlases?.[atlasId];
      if(!projection||projection.sourceSha256!==metadata.sha256)throw Error('Surface projection does not match the atlas volume');
      volume.surfaceLabels={};volume.surfaceProjectionInfo=projection;
      await Promise.all(Object.entries(projection.hemispheres).map(async([hemi,entry])=>{
        const r=await fetch(dataURL(entry.file),{signal});if(!r.ok)throw Error('Surface labels could not be loaded');
        const buffer=await r.arrayBuffer();if(buffer.byteLength!==entry.vertices*2)throw Error('Surface label count does not match geometry');
        const view=new DataView(buffer),labels=new Uint16Array(entry.vertices);for(let i=0;i<labels.length;i++)labels[i]=view.getUint16(i*2,true);
        volume.surfaceLabels[hemi]=labels;
      }));
    }
    return volume;
}

export const nativeAtlasId=id=>['aal-registered','aal3-registered'].includes(id)?id.replace('-registered',''):['aal','aal3'].includes(id)?id:null;
export const unifiedAtlasId=id=>['aal','aal3'].includes(id)?`${id}-registered`:id;

export async function loadAtlasSlicePair(id){
  const atlas=await loadAtlas(id);if(!atlas)throw Error('Atlas volume is unavailable');
  if(['aal','aal3'].includes(id)){
    const key='aal-native-t1';
    if(!pending.has(key))pending.set(key,fetch(dataURL('aal-v3/manifest.json')).then(r=>{if(!r.ok)throw Error('Native T1 metadata unavailable');return r.json();}).then(m=>loadBinaryVolume(m.nativeTemplate)).catch(e=>{pending.delete(key);throw e;}));
    const anatomy=await pending.get(key);
    return {anatomy:{...anatomy,sliceReference:'aal-colin27'},atlas:{...atlas,sliceReference:'aal-colin27'},native:true};
  }
  if(atlas.canOverlayOnTarget!==true)throw Error('No verified matching T1 is available for this native volume');
  return {anatomy:await loadAnatomyVolume(),atlas,native:false};
}

export function sliceOverlayAllowed(anatomy,atlas){
  if(!anatomy||!atlas)return false;
  if(anatomy.sliceReference)return anatomy.sliceReference===atlas.sliceReference;
  if(atlas.spaceId===null||/unknown|unspecified/i.test(atlas.spaceId||atlas.space||''))return false;
  return atlas.canOverlayOnTarget===true;
}

export function sliceWorldPoint(axis, value, u, v, radiological = true, bounds = SLICE_BOUNDS) {
  const horizontal = axis === 'x' ? 'y' : 'x';
  const vertical = axis === 'z' ? 'y' : 'z';
  const h = bounds[horizontal], w = bounds[vertical];
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
  const bounds=options.bounds||SLICE_BOUNDS;
  const h = bounds[horizontal], v = bounds[vertical];
  canvas.width = size;
  canvas.height = Math.round(size * (v[1] - v[0]) / (h[1] - h[0]));
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  const radiological = options.radiological !== false;
  for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) {
    const point = sliceWorldPoint(axis, value, px / (canvas.width - 1), py / (canvas.height - 1), radiological, bounds);
    const intensity = volume.sampleRAS(...point);
    const q = (py * canvas.width + px) * 4;
    pixels.data[q] = pixels.data[q + 1] = pixels.data[q + 2] = intensity;
    pixels.data[q + 3] = options.transparent && intensity < 5 ? 0 : 255;
    if (!options.roiComparison && sliceOverlayAllowed(volume,options.atlasVolume)) {
      const label = options.atlasVolume.sampleRAS(...point);
      if (label > 0 && (!options.selectedLabels||options.selectedLabels.has(label))) {
        const rgb = ATLAS_RGB[(label * 7) % ATLAS_RGB.length];
        const alpha=options.overlayOpacity??.55;
        for (let channel = 0; channel < 3; channel++) pixels.data[q + channel] = Math.round(intensity * (1-alpha) + rgb[channel] * alpha);
        pixels.data[q + 3] = 255;
      }
    }
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

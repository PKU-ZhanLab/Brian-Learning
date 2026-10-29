import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assetURL, dataURL } from './assets.js';
import { compareLabelROIs, compareROIs, positiveLabels, voxelMaskSurface, comparisonMaskVolume, attachROISurfaces } from './roi.js';
import { parseNifti, exportNifti } from './nifti.js';

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

test('unverified alignment, background and invalid geometry are rejected; missing source labels are explicit', () => {
  const source = volume([0]);
  assert.throws(() => compareLabelROIs({ ...source, canOverlayOnTarget: false }, 1, source, 1, grid), /unaligned-atlas/);
  assert.throws(() => compareLabelROIs(source, 0, source, 1, grid), /invalid-label/);
  assert.equal(compareLabelROIs(source, 2, source, 1, grid).sampling.A.status, 'empty-source');
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

test('multiple selected labels form an exact union without double counting',()=>{
  const a=volume([0,1],1);a.data[2]=2;a.data[3]=3;
  const result=compareROIs(a,{labels:[1,2,2]},volume([0,1,2]),{labels:[1]},grid);
  assert.equal(result.metrics.aVoxels,3);assert.equal(result.metrics.dice,1);assert.deepEqual(result.A.labelIds,[1,2]);
});

test('statistical tails include threshold boundaries and exclude zero background',()=>{
  const a={...volume([]),kind:'statistic',data:Float32Array.from({length:24},(_,i)=>[-3,-2,-1,0,1,2,3][i]||0)};
  const expected={positive:[5,6],negative:[0,1],absolute:[0,1,5,6]};
  for(const tail of Object.keys(expected)){
    const result=compareROIs(a,{threshold:2,tail},volume(expected[tail]),{labels:[1]},grid);
    assert.equal(result.metrics.dice,1);
  }
  const zero=compareROIs(a,{threshold:0,tail:'absolute'},volume([0,1,2,4,5,6]),1,grid);
  assert.equal(zero.metrics.aVoxels,6);assert.equal(zero.metrics.dice,1);
});

test('continuous resampling is trilinear before thresholding',()=>{
  const shifted=[...affine];shifted[3]=-1;
  const a={...volume([]),kind:'statistic',affine:shifted,data:Float32Array.from({length:24},(_,i)=>i===1?4:0)};
  const result=compareROIs(a,{threshold:2},volume([0,1]),1,grid);
  assert.equal(result.metrics.dice,1);assert.equal(result.A.interpolation,'trilinear');
});

test('probability metrics use full min/max weights and are distinct from binary Dice',()=>{
  const probability=values=>({...volume([]),kind:'probability',data:Float32Array.from({length:24},(_,i)=>values[i]||0)});
  const a=probability([1,.5]),b=probability([.5,1]);
  const result=compareROIs(a,{threshold:.75},b,{threshold:.75},grid);
  assert.equal(result.metrics.dice,0);assert.equal(result.probabilityMetrics.fuzzyDice,2/3);assert.equal(result.probabilityMetrics.fuzzyJaccard,.5);
  assert.equal(compareROIs(a,{threshold:.1},b,{threshold:.1},grid).probabilityMetrics.fuzzyDice,2/3);
  assert.equal(compareROIs(a,{threshold:.5},volume([0]),1,grid).probabilityMetrics,null);
});

test('custom imports cannot bypass native-space rejection or mismatch reference identity',()=>{
  const a={...volume([0]),custom:true,alignmentStatus:'user-declared',space:'native-unverified'};
  assert.throws(()=>compareROIs(a,1,volume([0]),1,grid),/unaligned-atlas/);
  assert.throws(()=>compareROIs({...a,space:'MNI152NLin2009cAsym'},1,volume([0]),1,grid),/unaligned-atlas/);
  assert.equal(compareROIs({...a,space:grid.space},1,volume([0]),1,grid).metrics.dice,1);
});

test('A, B, intersection and union NIfTI exports round-trip exact binary counts and target affine',async()=>{
  const comparison=compareROIs(volume([0,1,2]),1,volume([1,2,3,4]),1,grid);
  for(const [part,count] of [['A',3],['B',4],['intersection',2],['union',5]]) {
    const mask=await parseNifti(exportNifti(comparisonMaskVolume(comparison,part)),{kind:'mask'});
    assert.equal(mask.data.reduce((a,b)=>a+b,0),count);assert.deepEqual(mask.affine,grid.affine);assert.deepEqual(mask.shape,grid.shape);
  }
});

test('published DK left precentral and Juelich BA4a baseline remains 1732/1065/57',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../../public/data/manifest.json',import.meta.url)));
  const load=id=>{const meta=manifest.atlases[id];return {...meta,data:new Uint8Array(fs.readFileSync(new URL(`../../public/data/${meta.data}`,import.meta.url)))};};
  const result=compareLabelROIs(load('dk'),23,load('ba-histology'),47,manifest.template);
  assert.equal(result.metrics.aVoxels,1732);assert.equal(result.metrics.bVoxels,1065);assert.equal(result.metrics.intersectionVoxels,57);
  assert.equal(result.metrics.dice,114/2797);assert.equal(result.metrics.jaccard,57/2740);
});

test('oversized surfaces preserve exact metrics, masks and slices instead of failing the comparison',()=>{
  const shape=[110,110,20];
  const data=Uint8Array.from({length:shape.reduce((a,b)=>a*b)},(_,i)=>(i%110+Math.floor(i/110)%110+Math.floor(i/12100))%2);
  const source={...volume([]),shape,data};
  const result=attachROISurfaces(compareROIs(source,1,source,1,{...grid,shape}));
  assert.equal(result.metrics.dice,1);assert.equal(result.metrics.aVoxels,121000);
  assert.deepEqual(result.surfaceWarnings,['intersection','A','B']);assert.equal(result.surfaces.A.positions.length,0);assert.equal(result.surfaces.A.omitted,true);
});

test('worker preflight blocks absent source, waits for loss confirmation, and ignores cancelled or stale confirmation', async () => {
  const messages = [];
  globalThis.self = { postMessage:message => messages.push(message) };
  try {
    await import(`./roi.worker.js?test=${Date.now()}`);
    const source = volume([0]);
    const shifted = [...affine]; shifted[3] = 100;
    const input = {requestId:1, volumeA:source, volumeB:source, selectionA:1, selectionB:1, target:{...grid,affine:shifted}};
    self.onmessage({data:input});
    assert.deepEqual(messages.map(message => message.phase), ['preflight']);
    assert.equal(messages[0].requiresConfirmation, true);
    self.onmessage({data:{requestId:999,action:'confirm'}});
    assert.equal(messages.length, 1);
    self.onmessage({data:{requestId:1,action:'cancel'}});
    self.onmessage({data:{requestId:1,action:'confirm'}});
    assert.equal(messages.length, 1);
    self.onmessage({data:{...input,requestId:2}});
    self.onmessage({data:{requestId:2,action:'confirm'}});
    assert.equal(messages.at(-1).phase, 'complete');
    assert.equal(messages.at(-1).requestId, 2);
    assert.equal(messages.at(-1).comparison.sampling.A.status, 'empty-target');
    self.onmessage({data:{...input,requestId:3,selectionA:999}});
    assert.equal(messages.at(-1).blocked, true);
    assert.equal(messages.at(-1).sampling.A.status, 'empty-source');
    const length = messages.length;
    self.onmessage({data:{requestId:3,action:'confirm'}});
    assert.equal(messages.length, length);
    self.onmessage({data:{...input,requestId:4,target:grid}});
    assert.deepEqual(messages.slice(-2).map(message => message.phase), ['preflight','complete']);
  } finally { delete globalThis.self; }
});

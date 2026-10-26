import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSliceCanvas, prepareVolume } from './volume.js';

test('slice rendering overlays aligned atlas voxels and leaves unavailable space uncoloured', () => {
  const original = globalThis.document;
  let drawn;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}),
    putImageData: image => { drawn = image.data; },
  }) }) };
  try {
    const metadata = {shape:[1,1,1],affine:[2,0,0,0,0,2,0,20,0,0,2,20,0,0,0,1]};
    const t1 = prepareVolume(new Uint8Array([100]),metadata);
    const atlas = prepareVolume(new Uint8Array([1]),{...metadata,canOverlayOnTarget:true});
    makeSliceCanvas(t1,'z',20,{size:3,atlasVolume:atlas});
    const q=(1*3+1)*4;
    assert.notEqual(drawn[q],drawn[q+2],'a labelled voxel must have a visible atlas colour');
    assert.deepEqual([...drawn.slice(0,3)],[0,0,0],'background must not acquire an atlas label');
    makeSliceCanvas(t1,'z',20,{size:3,atlasVolume:{...atlas,canOverlayOnTarget:false}});
    assert.deepEqual([...drawn.slice(q,q+3)],[100,100,100],'unverified atlas space must not be overlaid');
    makeSliceCanvas(t1,'z',20,{size:3});
    assert.deepEqual([...drawn.slice(q,q+3)],[100,100,100],'MRI-only callers must retain grayscale');
  } finally { globalThis.document=original; }
});

import { attachROISurfaces, compareLabelROIs } from './roi.js';

self.onmessage = event => {
  const { requestId, volumeA, labelA, volumeB, labelB, target, descriptors } = event.data;
  try {
    const comparison = attachROISurfaces(compareLabelROIs(volumeA, labelA, volumeB, labelB, target, descriptors));
    const transfer = [comparison.maskA.buffer, comparison.maskB.buffer, comparison.classes.buffer, ...Object.values(comparison.surfaces).flatMap(surface => [surface.positions.buffer, surface.normals.buffer])];
    self.postMessage({ requestId, comparison }, transfer);
  } catch (error) { self.postMessage({ requestId, error: error.message }); }
};

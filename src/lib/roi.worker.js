import { attachROISurfaces, compareROIs, normalizeROISelection } from './roi.js';
import { inspectROISampling } from './roi-grid.js';
import { makeComputationManifest, makeComparisonManifest, compareComputationManifest } from './computation-manifest.js';

let pending = null;
function complete(input) {
  const { requestId, volumeA, labelA, volumeB, labelB, selectionA, selectionB, target, descriptors } = input;
  const comparison = attachROISurfaces(compareROIs(volumeA, selectionA ?? labelA, volumeB, selectionB ?? labelB, target, {...descriptors,manifest:input.manifest}));
  const transfer = [comparison.maskA.buffer, comparison.maskB.buffer, comparison.classes.buffer, ...Object.values(comparison.surfaces).flatMap(surface => [surface.positions.buffer, surface.normals.buffer])];
  self.postMessage({ requestId, phase:'complete', comparison }, transfer);
}
self.onmessage = event => {
  const input = structuredClone(event.data), { requestId, action } = input;
  try {
    if (action === 'cancel') { if (pending?.requestId === requestId) pending = null; return; }
    if (action === 'confirm') {
      if (pending?.requestId !== requestId) return;
      const accepted = pending; pending = null; complete(accepted); return;
    }
    pending = null;
    input.manifest=makeComputationManifest(input.manifest);
    const expected=makeComparisonManifest(input.volumeA,normalizeROISelection(input.volumeA,input.selectionA??input.labelA),input.volumeB,normalizeROISelection(input.volumeB,input.selectionB??input.labelB),input.target);
    if(!compareComputationManifest(input.manifest,expected).matches)throw Error('result-manifest-mismatch');
    const sampling = { A:inspectROISampling(input.volumeA, input.selectionA ?? input.labelA, input.target), B:inspectROISampling(input.volumeB, input.selectionB ?? input.labelB, input.target) };
    const blocked = Object.values(sampling).some(report => report.status === 'empty-source' || report.absentLabelIds.length);
    const requiresConfirmation = !blocked && Object.values(sampling).some(report => report.status !== 'retained');
    self.postMessage({ requestId, phase:'preflight', sampling, grid:input.target, blocked, requiresConfirmation });
    if (blocked) return;
    if (requiresConfirmation) { pending = input; return; }
    complete(input);
  } catch (error) { pending = null; self.postMessage({ requestId, phase:action === 'confirm' ? 'complete' : 'preflight', error:error.message }); }
};

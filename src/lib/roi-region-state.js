import {atlasRegionKey} from './atlas-identity.js';

/** Calculation parameters never authorize a new source identity. Only the side
 * whose source/labels the user explicitly reselects may accept its current source.
 */
export function updateROIRegionExpectation(expected,edit) {
  if (!['source','labels'].includes(edit.kind)) return expected;
  if (!['A','B'].includes(edit.side)) throw Error('ROI source side is required');
  return {...expected,[edit.side]:null};
}

export function roiRegionIdentityMismatch(expected,current,loaded) {
  return ['A','B'].some(side => expected[side]?.length && loaded[side] &&
    JSON.stringify(expected[side].map(atlasRegionKey).sort()) !== JSON.stringify(current[side].map(atlasRegionKey).sort()));
}

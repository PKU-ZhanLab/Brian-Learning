import {atlasRegionKey} from './atlas-identity.js';

/** Export continuations belong to one displayed scientific comparison. Replacing
 * that comparison cancels its worker and rejects even an already queued result.
 * A late task's finally must not clear the busy state of a newer export.
 */
export function createComparisonExportTasks(){
  let current=null;
  const invalidate=()=>{current?.controller.abort();current=null;};
  return {
    invalidate,
    begin(comparison){invalidate();const controller=new AbortController();current={comparison,controller,signal:controller.signal};return current;},
    isCurrent(task){return !!task&&current===task&&!task.signal.aborted;},
    finish(task){if(current!==task)return false;current=null;return true;},
  };
}

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

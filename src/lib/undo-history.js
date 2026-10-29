import {removeEvidenceRecords,EVIDENCE_COLLECTIONS} from './evidence-schema.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const rows=v=>Array.isArray(v)&&v.every(row=>object(row)&&typeof (row.id??row.layerId)==='string');
const identity=row=>row.id??row.layerId;
function differences(before,after,path=[],out=[]){
  if(same(before,after))return out;
  if(rows(before)&&rows(after)){
    const a=new Map(before.map((r,i)=>[identity(r),{r,i}])),b=new Map(after.map((r,i)=>[identity(r),{r,i}]));
    for(const id of new Set([...a.keys(),...b.keys()]))if(!same(a.get(id)?.r,b.get(id)?.r))out.push({path,id,index:a.get(id)?.i??b.get(id)?.i,before:structuredClone(a.get(id)?.r),after:structuredClone(b.get(id)?.r)});
  }else if(object(before)&&object(after)){
    for(const name of new Set([...Object.keys(before),...Object.keys(after)]))differences(before[name],after[name],[...path,name],out);
  }else out.push({path,before:structuredClone(before),after:structuredClone(after)});
  return out;
}
function restorePatch(state,patch){
  let parent=state;for(const name of patch.path.slice(0,-1))parent=parent[name];const name=patch.path.at(-1),value=parent[name];
  if(patch.id!==undefined){
    const index=value.findIndex(r=>identity(r)===patch.id),current=index<0?undefined:value[index];
    if(!same(current,patch.after))throw Error(`undo-conflict: ${patch.id}`);
    if(index>=0)value.splice(index,1);
    if(patch.before!==undefined)value.splice(Math.min(patch.index,value.length),0,structuredClone(patch.before));
  }else{if(!same(value,patch.after)&&patch.path[0]==='view')return;if(!same(value,patch.after))throw Error(`undo-conflict: ${patch.path.join('.')}`);if(patch.before===undefined)delete parent[name];else parent[name]=structuredClone(patch.before);}
}
function cleanView(view,evidence,removedReferences,removedResults){
  const clean=v=>{const next={...v,resultLayers:(v.resultLayers??[]).filter(l=>!removedResults.has(l.resultId))};if(v.literature)next.literature={...v.literature,paperId:removedReferences.has(v.literature.paperId)?null:v.literature.paperId,compared:(v.literature.compared??[]).filter(id=>!removedReferences.has(id))};return next;};
  const next=clean(view);if(view.navigationHistory)next.navigationHistory={...view.navigationHistory,entries:view.navigationHistory.entries.map(entry=>({...entry,view:clean(entry.view)}))};return next;
}
/** History contains only inverse research deltas; volumes and saved computations are never copied. */
export function applyUndoableAction(state,action,{limit=20,undoState}={}){
  if(undoState&&undoState.projectId!==state.projectId)throw Error('undo-project-mismatch');
  let next;
  if(action.type==='delete-evidence'){
    const evidence=action.collection==='relations'?{...state.evidence,relations:state.evidence.relations.filter(r=>r.id!==action.id)}:action.collection==='references'&&action.revert?{...state.evidence,references:state.evidence.references.filter(r=>r.id!==action.id)}:removeEvidenceRecords(state.evidence,action);
    const removedReferences=new Set(state.evidence.references.filter(r=>!evidence.references.some(n=>n.id===r.id)).map(r=>r.id)),removedResults=new Set(state.evidence.results.filter(r=>!evidence.results.some(n=>n.id===r.id)&&!(action.retainedResultIds??[]).includes(r.id)).map(r=>r.id));
    next={...state,evidence,view:cleanView(state.view,evidence,action.revert?new Set():removedReferences,removedResults)};
  }else if(action.type==='change')next={...state,...action.patch};
  else throw Error('unsupported-undo-action');
  const patches=[];for(const name of ['notes','evidence','drafts','view'])differences(state[name],next[name],[name],patches);
  const counts=Object.fromEntries(EVIDENCE_COLLECTIONS.map(name=>[name,state.evidence[name].filter(r=>!next.evidence[name].some(n=>n.id===r.id)).length]));
  const entries=[...(undoState?.entries??[])];if(patches.length)entries.push({label:action.label||action.id||'Research edit',patches,counts});
  return {state:next,undoState:{projectId:state.projectId,entries:entries.slice(-Math.min(20,Math.max(1,limit))),state:next},counts};
}
export function undoLast(undoState,current=undoState.state){
  if(current.projectId!==undoState.projectId)throw Error('undo-project-mismatch');
  const entry=undoState.entries.at(-1);if(!entry)return {state:current,undoState};
  const state={...current,notes:structuredClone(current.notes),evidence:structuredClone(current.evidence),drafts:structuredClone(current.drafts),view:structuredClone(current.view)};
  for(const patch of entry.patches)restorePatch(state,patch);
  return {state,undoState:{projectId:current.projectId,entries:undoState.entries.slice(0,-1),state},label:entry.label};
}

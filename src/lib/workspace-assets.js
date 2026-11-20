// Plans are pure. Publication belongs exclusively to workspace-session.
import {validateStartupRecovery} from './workspace-project.js';
const assetFields=new Set(['atlas','atlasId','aAtlas','bAtlas','volumeId','assetId','sourceAssetId']);
const skipped=new Set(['legacyV1','legacyImports','payload']);
const isRecord=value=>value&&typeof value==='object'&&!ArrayBuffer.isView(value);
export function referencedAssetIds(value){
 const ids=new Set();
 function visit(node,parent=''){
  if(!isRecord(node))return;
  if(Array.isArray(node)){node.forEach(child=>visit(child,parent));return;}
  for(const [key,child] of Object.entries(node)){
   if((assetFields.has(key)||(key==='id'&&['inputs','derivedAsset'].includes(parent)))&&typeof child==='string'&&child.startsWith('custom-'))ids.add(child);
   if(!skipped.has(key))visit(child,key);
  }
 }
 visit(value);return [...ids];
}
const owned=snapshot=>(snapshot.volumes||[]).filter(v=>!v.projectId||v.projectId===snapshot.projectId);
const uses=(value,id)=>referencedAssetIds(value).includes(id);
const historical=snapshot=>['notes','evidence','roiSnapshot','recomputedSnapshot'].flatMap(key=>referencedAssetIds(snapshot[key]));

function detachView(view,ids){
 const next=structuredClone(view||{}),fields=[];
 const hit=value=>[...ids].some(id=>uses(value,id));
 if(ids.has(next.atlas)){next.atlas='dk';next.selectedIds=[];next.hiddenIds=[];fields.push('atlas');}
 for(const key of ['atlasSelection','unresolvedAtlasSelection'])if(next[key]?.some(ref=>ids.has(ref.atlasId))){next[key]=next[key].filter(ref=>!ids.has(ref.atlasId));fields.push(key);}
 if(hit(next.atlasSelectionQuery)){delete next.atlasSelectionQuery;fields.push('atlasSelectionQuery');}
 if(next.roi){
  if(next.roi.paired)for(const side of ['left','right'])if(hit(next.roi.paired[side])){next.roi.paired[side]={assetId:'',identity:null,point:[0,0,0],camera:null,labels:[],threshold:.5,tail:'positive'};fields.push(`roi.paired.${side}`);}

  for(const side of ['a','b'])if(ids.has(next.roi[`${side}Atlas`])){
   next.roi[`${side}Atlas`]='';next.roi[`${side}Labels`]=[];next.roi[`${side}RegionRefs`]=[];next.roi.computed=false;fields.push(`roi.${side}Atlas`);
  }
  for(const key of ['aRegionRefs','bRegionRefs','unresolvedRegionRefs'])if(next.roi[key]?.some(ref=>ids.has(ref.atlasId))){next.roi[key]=next.roi[key].filter(ref=>!ids.has(ref.atlasId));next.roi.computed=false;fields.push(`roi.${key}`);}
 }
 if(hit(next.atlasExplorer)){delete next.atlasExplorer;next.atlasExplorerOpen=false;fields.push('atlasExplorer');}
 if(next.navigationHistory){
  const h=next.navigationHistory,retained=h.entries.map((entry,index)=>({entry,index})).filter(({entry})=>!hit(entry.view));
  const removed=h.entries.length-retained.length;
  if(removed){h.entries=retained.map(({entry})=>entry);h.index=retained.length?Math.max(0,retained.filter(({index})=>index<=h.index).length-1):-1;fields.push(`navigationHistory:${removed}`);}
 }
 return {view:next,fields};
}
function detach(snapshot,excluded){
 const ids=new Set(excluded),detached=detachView(snapshot.view,ids),next={...snapshot,view:detached.view,volumes:owned(snapshot).filter(v=>!ids.has(v.id))},dependentResults=[];
 const historicalIds=new Set(historical(snapshot));
 next.missingAssetIds=[...new Set([...(snapshot.missingAssetIds||[]),...excluded.filter(id=>historicalIds.has(id))])];
 for(const key of ['roiSnapshot','recomputedSnapshot'])if(snapshot[key]){
  const missing=excluded.filter(id=>uses(snapshot[key],id));
  if(missing.length){next[key]={...snapshot[key],status:'missing-input',missingAssetIds:[...new Set([...(snapshot[key].missingAssetIds||[]),...missing])]};dependentResults.push(key);}
 }
 return {next,dependentViewFields:detached.fields,dependentResults};
}
/** Startup has metadata but no session image bytes; use the ordinary detach rules. */
export function recoverUnavailableSessionAssets(snapshot,sessionAssetIds=[]){
 const ids=[...new Set([...sessionAssetIds,...referencedAssetIds(snapshot.view),...historical(snapshot),...(snapshot.missingAssetIds||[])])];
 const recovery=detach(snapshot,ids);
 recovery.next.missingAssetIds=ids;
 return {...recovery,unavailableAssetIds:ids};
}
/** An explicit archive action separates the original receipt from active work. */
export function planRecoveryArchive(snapshot){
 const recovery=validateStartupRecovery(snapshot.startupRecovery);
 if(!recovery)throw Error('startup-recovery-unavailable');
 const {startupRecovery,...next}=snapshot;
 return {next,preview:{mode:'archive-recovery'}};
}
export function planAssetRemoval(snapshot,assetId){
 if(!owned(snapshot).some(v=>v.id===assetId))throw Error(`foreign-asset: ${assetId}`);
 return {assetId,...detach(snapshot,[assetId])};
}
export function describeWorkspaceAssets(snapshot){
 return owned(snapshot).map(volume=>({id:volume.id,name:volume.name||volume.id,kind:volume.kind||'label',space:volume.space||null,bytes:352+((volume.data||volume.dataTypedArray)?.byteLength||0),usedBy:['view','notes','evidence','roiSnapshot','recomputedSnapshot'].filter(key=>uses(snapshot[key],volume.id))}));
}
export function planProjectExport(snapshot,{assetIds,dependentPolicy}={}){
 if(!Array.isArray(assetIds)||assetIds.some(id=>typeof id!=='string'))throw Error('invalid-asset-selection');
 if(!['include','detach'].includes(dependentPolicy))throw Error('invalid-dependent-policy');
 const assets=owned(snapshot),available=new Set(assets.map(v=>v.id)),selected=new Set(assetIds);
 for(const id of selected)if(!available.has(id))throw Error(`foreign-asset: ${id}`);
 if(dependentPolicy==='include'){
  const refs=[...referencedAssetIds(snapshot.view),...historical(snapshot)];let previous=-1;
  while(previous!==selected.size){previous=selected.size;for(const id of refs.concat(assets.filter(v=>selected.has(v.id)).flatMap(referencedAssetIds))){if(available.has(id))selected.add(id);else if(!(snapshot.missingAssetIds||[]).includes(id))throw Error(`missing-asset: ${id}`);}}
 }
 const excluded=assets.filter(v=>!selected.has(v.id)).map(v=>v.id),plan=detach(snapshot,excluded);
 if(excluded.length&&snapshot.startupRecovery)throw Error('Startup recovery retains original project context. Export the full project to keep it, or open a separate project before selecting assets. / 启动恢复记录包含原项目内容，请导出完整项目保留记录，或另开项目后选择部分影像。');
 const included=describeWorkspaceAssets(snapshot).filter(v=>selected.has(v.id));
 return {workspace:plan.next,preview:{mode:'export',dependentPolicy,includedAssetIds:included.map(v=>v.id),excludedAssetIds:excluded,assets:included,assetCount:included.length,rawPayloadBytes:included.reduce((n,v)=>n+v.bytes,0),dependentViewFields:plan.dependentViewFields,dependentResults:plan.dependentResults,localEvidenceCounts:Object.fromEntries(Object.entries(snapshot.evidence||{}).filter(([,v])=>Array.isArray(v)).map(([key,value])=>[key,value.length])),noteCount:snapshot.notes?.length||0}};
}

import {parseProject,prepareProjectPayload,validateViewState,validateProjectDrafts,validateProjectNotes} from './workspace-project.js';
import {boundedJsonStringify,utf8ByteLength,assertWorkspaceBudget,MAX_PROJECT_UTF8_BYTES} from './workspace-limits.js';
import {emptyEvidence,EVIDENCE_COLLECTIONS} from './evidence-schema.js';
import {validateEvidence,loadEvidence} from './evidence-workspace.js';
import {prepareCustomVolumeReplacement,publishCustomVolumeReplacement,notifyCustomVolumes} from './custom-volumes.js';

export const WORKSPACE_STORAGE_KEY='neuroatlas-workspace-current-v1';
const stages=new WeakMap();
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const json=(value,max=MAX_PROJECT_UTF8_BYTES,message='workspace-json-budget')=>JSON.parse(boundedJsonStringify(value,max,message));
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
const freeze=value=>{if(value&&typeof value==='object'&&!ArrayBuffer.isView(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
function sameContent(a,b){
  if(a===b)return true;
  if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){if(!ArrayBuffer.isView(a)||!ArrayBuffer.isView(b)||a.constructor!==b.constructor||a.byteLength!==b.byteLength)return false;const x=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),y=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);return x.every((v,i)=>v===y[i]);}
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  const keys=v=>Object.keys(v).filter(k=>!['dataTypedArray','custom','available'].includes(k)).sort();const ka=keys(a),kb=keys(b);return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&sameContent(a[k],b[k]));
}
const contextOptions=known=>({knownReferences:known?.references||[],knownResults:known?.results||[],...(known?.regions?{knownRegions:known.regions}:{})});

function checkedEvidence(input,known){const bounded=json(input??emptyEvidence(),20*1024*1024,'evidence-json-budget'),report=validateEvidence(bounded,contextOptions(known));if(!report.valid)throw Error(`invalid-evidence: ${report.errors.join('; ')}`);return {value:report.value,warnings:report.warnings};}
const checkedView=input=>{const view=validateViewState(json(input||{},2*1024*1024,'view-budget'));view.resultLayers??=[];return view;};
function assertReferences(snapshot,known){
  const assets=new Set(snapshot.volumes.map(v=>v.id));
  const asset=id=>{if(typeof id==='string'&&id.startsWith('custom-')&&!assets.has(id))throw Error(`missing-asset: ${id}`);};
  const scan=node=>{if(Array.isArray(node)){node.forEach(scan);return;}if(!object(node)||ArrayBuffer.isView(node))return;for(const [key,value]of Object.entries(node)){if(['atlas','atlasId','aAtlas','bAtlas','volumeId','assetId','sourceAssetId'].includes(key))asset(value);if(['inputs','derivedAsset'].includes(key)){for(const identity of Array.isArray(value)?value:[value])asset(identity?.id);}if(!['legacyV1','legacyImports','payload'].includes(key))scan(value);}};
  scan(snapshot.view);scan(snapshot.notes);scan(snapshot.roiSnapshot);scan(snapshot.recomputedSnapshot);scan(snapshot.evidence);
  const results=new Map([...(known?.results||[]),...snapshot.evidence.results].map(r=>[typeof r==='string'?r:r.id,r]));
  const references=new Set([...(known?.references||[]),...snapshot.evidence.references].map(r=>typeof r==='string'?r:r.id));
  const locations=new Map(snapshot.evidence.locations.map(l=>[l.id,l]));
  for(const r of known?.locations||[])locations.set(r.id,r);
  const layerIds=new Set();
  for(const layer of snapshot.view.resultLayers){
    if(!object(layer)||!identifier(layer.layerId)||layerIds.has(layer.layerId)||!results.has(layer.resultId)||!references.has(layer.sourceReferenceId)||!Array.isArray(layer.coordinateIds)||new Set(layer.coordinateIds).size!==layer.coordinateIds.length||!(layer.spaceId===null||typeof layer.spaceId==='string')||typeof layer.visible!=='boolean'||!object(layer.style))throw Error('invalid-result-layer-reference');
    const result=results.get(layer.resultId);
    for(const id of layer.coordinateIds){const location=locations.get(id)||result?.coordinates?.find(c=>c.id===id);if(!location||(location.resultId&&location.resultId!==layer.resultId))throw Error(`invalid-coordinate-reference: ${id}`);}
    layerIds.add(layer.layerId);
  }
}

/** Full candidate admission. No storage, registry or React state is touched. */
export async function stageWorkspaceChange(candidate,{current,knownEvidence,preview}={}){
  if(!current||!Number.isSafeInteger(current.revision)||current.revision<0||!identifier(current.projectId))throw Error('invalid-current-workspace');
  if(!object(candidate)||!identifier(candidate.projectId))throw Error('invalid-project-id');
  const candidateVolumes=candidate.volumes??[];
  if(!Array.isArray(candidateVolumes))throw Error('invalid-project-volumes');
  let rawPayloadBytes=0;assertWorkspaceBudget({assetCount:candidateVolumes.length,rawPayloadBytes});
  for(const volume of candidateVolumes){rawPayloadBytes+=352+(volume?.data||volume?.dataTypedArray)?.byteLength;assertWorkspaceBudget({assetCount:candidateVolumes.length,rawPayloadBytes});}
  const {value:evidence,warnings}=checkedEvidence(candidate.evidence,knownEvidence);
  const assetsChanged=candidate.projectId!==current.projectId||!sameContent(candidateVolumes,current.volumes);
  const next={projectId:candidate.projectId,revision:current.revision+1,view:checkedView(candidate.view),notes:validateProjectNotes(candidate.notes??[]),evidence,drafts:validateProjectDrafts(candidate.drafts??[],candidate.projectId),volumes:assetsChanged?structuredClone(candidateVolumes):current.volumes,roiSnapshot:structuredClone(candidate.roiSnapshot??null),recomputedSnapshot:structuredClone(candidate.recomputedSnapshot??null)};
  if(candidate.provenanceStatus)next.provenanceStatus=candidate.provenanceStatus;
  if(!Array.isArray(next.notes)||next.notes.some(n=>!object(n)||typeof n.text!=='string'))throw Error('invalid-notes');
  assertReferences(next,knownEvidence);
  const prepared=await prepareProjectPayload(next);
  const snapshotBytes=boundedJsonStringify({roiSnapshot:next.roiSnapshot,recomputedSnapshot:next.recomputedSnapshot},MAX_PROJECT_UTF8_BYTES,'snapshot-budget');
  assertWorkspaceBudget({...prepared.usage,rawPayloadBytes:prepared.usage.rawPayloadBytes+utf8ByteLength(snapshotBytes),projectUtf8Bytes:prepared.usage.projectUtf8Bytes+utf8ByteLength(snapshotBytes)+utf8ByteLength(JSON.stringify(next.drafts))});
  const persistedJSON=boundedJsonStringify({schema:WORKSPACE_STORAGE_KEY,projectId:next.projectId,revision:next.revision,notes:next.notes,evidence:next.evidence,view:next.view,drafts:next.drafts},32*1024*1024,'workspace-storage-budget');
  const replacement=assetsChanged?prepareCustomVolumeReplacement(next.projectId,next.volumes):null;
  freeze(next);
  const stage=Object.freeze({baseRevision:current.revision,next,persistedJSON,preview:freeze(preview||{mode:'change',includedAssetIds:next.volumes.map(v=>v.id),removedAssetIds:current.volumes.filter(v=>!next.volumes.some(n=>n.id===v.id)).map(v=>v.id),collisions:[],remap:{},changedReferenceCounts:{}}),warnings:freeze(warnings)});
  stages.set(stage,{next,replacement,base:current});return stage;
}

/** Exactly one storage mutation precedes every in-memory publication. */
export function createWorkspaceSession({storage,initial,knownEvidence}={}){
  if(!storage||typeof storage.setItem!=='function')throw Error('workspace-storage-unavailable');
  let current=freeze({...initial,drafts:initial.drafts??[],volumes:initial.volumes??[],evidence:initial.evidence??emptyEvidence(),roiSnapshot:initial.roiSnapshot??null,recomputedSnapshot:initial.recomputedSnapshot??null});
  publishCustomVolumeReplacement(prepareCustomVolumeReplacement(current.projectId,current.volumes),{notify:false});
  const listeners=new Set();let committing=false;
  return {getSnapshot:()=>current,subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},async stage(candidate){return stageWorkspaceChange(candidate,{current,knownEvidence});},commit(stage){
    if(committing)throw Error('workspace-commit-in-progress');
    const prepared=stages.get(stage);if(!prepared)throw Error('invalid-stage');
    if(stage.baseRevision!==current.revision||prepared.base!==current)throw Error('stale-workspace');
    storage.setItem(WORKSPACE_STORAGE_KEY,stage.persistedJSON);
    committing=true;
    try{current=prepared.next;if(prepared.replacement)publishCustomVolumeReplacement(prepared.replacement,{notify:false});for(const callback of [...listeners]){try{callback();}catch{/* Already committed; continue notifying peers. */}}if(prepared.replacement)notifyCustomVolumes();return current;}
    finally{committing=false;}
  }};
}

/** Startup migration is read-only; legacy keys are retained byte for byte. */
export function restoreWorkspaceInitial({storage,fallback,knownEvidence,legacyNotesKey='brain-model-notes'}={}){
  const raw=storage?.getItem(WORKSPACE_STORAGE_KEY);
  if(raw){
    const saved=json(JSON.parse(raw),32*1024*1024);if(saved.schema!==WORKSPACE_STORAGE_KEY||!identifier(saved.projectId)||!Number.isSafeInteger(saved.revision)||saved.revision<0)throw Error('invalid-workspace-envelope');
    return {...fallback,...saved,view:checkedView(saved.view),notes:validateProjectNotes(saved.notes),evidence:checkedEvidence(saved.evidence,knownEvidence).value,drafts:validateProjectDrafts(saved.drafts??[],saved.projectId),volumes:[],roiSnapshot:null,recomputedSnapshot:null};
  }
  const legacyNotes=storage?.getItem(legacyNotesKey),legacyEvidence=loadEvidence(storage,contextOptions(knownEvidence));
  if(legacyEvidence.storageError)throw Error(legacyEvidence.storageError);
  return {...fallback,notes:validateProjectNotes(legacyNotes?json(JSON.parse(legacyNotes),8*1024*1024):fallback.notes),evidence:legacyEvidence,drafts:fallback.drafts??[]};
}

const fields={referenceId:'references',sourceReferenceId:'references',referenceIds:'references',paperId:'references',compared:'references',experimentId:'experiments',resultId:'results',resultIds:'results',fromResultId:'results',toResultId:'results',locationIds:'locations',coordinateIds:'locations',claimId:'claims',claimIds:'claims',artifactId:'sourceArtifacts',sourceArtifactId:'sourceArtifacts',volumeId:'volumes',assetId:'volumes',sourceAssetId:'volumes',atlas:'volumes',atlasId:'volumes',aAtlas:'volumes',bAtlas:'volumes'};
function rewriteIncoming(value,maps,counts,key='',parent=''){
  if(['legacyV1','legacyImports'].includes(key))return structuredClone(value);
  if(ArrayBuffer.isView(value))return value;
  if(Array.isArray(value))return value.map(v=>rewriteIncoming(v,maps,counts,key,parent));
  if(object(value))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewriteIncoming(v,maps,counts,k,key)]));
  if(typeof value!=='string')return value;
  let kind=fields[key];
  if(key==='sourceRefs')kind='sourceArtifacts';
  if(key==='id'&&['derivedAsset','inputs'].includes(parent))kind='volumes';
  if(key==='subjectId'){
    const targets=[...maps.entries()].filter(([k,m])=>EVIDENCE_COLLECTIONS.includes(k)&&m.has(value)).map(([,m])=>m.get(value));
    if(new Set(targets).size>1)throw Error(`ambiguous-subject-reference: ${value}`);
    if(targets.length){counts.subjectId=(counts.subjectId||0)+1;return targets[0];}
  }
  const replacement=maps.get(kind)?.get(value);if(replacement){counts[key]=(counts[key]||0)+1;return replacement;}return value;
}
function mergeWorkspace(current,incoming,makeId){
  const collections={volumes:[current.volumes,incoming.volumes],notes:[current.notes,incoming.notes],drafts:[current.drafts??[],incoming.drafts??[]],resultLayers:[current.view.resultLayers??[],incoming.view.resultLayers??[]],...Object.fromEntries(EVIDENCE_COLLECTIONS.map(k=>[k,[current.evidence[k],incoming.evidence[k]]]))};
  const maps=new Map(Object.keys(collections).map(k=>[k,new Map()])),collisions=[],used=new Map(Object.entries(collections).map(([k,lists])=>[k,new Set(lists.flat().map(r=>k==='resultLayers'?r.layerId:r.id))]));
  const identity=(row,kind)=>kind==='resultLayers'?row.layerId:row.id;
  const rewriteRow=(row,kind,counts)=>{
    const result=rewriteIncoming(row,maps,counts);
    if(kind==='drafts'){
      result.projectId=current.projectId;
      const recordKind=({paper:'references',reference:'references',result:'results',finding:'results',relation:'relations',note:'notes',location:'locations'})[row.kind]||row.kind;
      const target=maps.get(recordKind)?.get(row.recordId);if(target){result.recordId=target;counts.recordId=(counts.recordId||0)+1;}
    }
    return result;
  };
  const allocate=(kind,id)=>{
    if(maps.get(kind).has(id))return;
    let next;for(let tries=0;tries<100;tries++){next=makeId?makeId(kind,id):`${kind==='volumes'?'custom-':''}${crypto.randomUUID()}`;if(identifier(next)&&(!['volumes'].includes(kind)||/^custom-[a-zA-Z0-9_-]{1,112}$/.test(next))&&!used.get(kind).has(next))break;next=null;}
    if(!next)throw Error('id-remap-exhausted');used.get(kind).add(next);maps.get(kind).set(id,next);collisions.push({recordKind:kind,id,incomingId:next});
  };
  // Dependency changes can force an otherwise byte-identical child to separate.
  let changed=true;while(changed){changed=false;for(const [kind,[existing,rows]]of Object.entries(collections)){const old=new Map(existing.map(r=>[identity(r,kind),r]));for(const row of rows){const id=identity(row,kind);if(!maps.get(kind).has(id)&&old.has(id)&&!sameContent(old.get(id),rewriteRow(row,kind,{}))){allocate(kind,id);changed=true;}}}}
  const counts={},merged={};
  for(const [kind,[existing,rows]]of Object.entries(collections)){
    const next=[...existing],ids=new Set(existing.map(r=>identity(r,kind)));
    for(const row of rows){const original=identity(row,kind),id=maps.get(kind).get(original)||original;if(ids.has(id))continue;const rewritten=rewriteRow(row,kind,counts);rewritten[kind==='resultLayers'?'layerId':'id']=id;next.push(rewritten);ids.add(id);}
    merged[kind]=next;
  }
  const snapshot={...incoming,projectId:current.projectId,view:{...rewriteIncoming(incoming.view,maps,counts),resultLayers:merged.resultLayers},notes:merged.notes,drafts:merged.drafts,volumes:merged.volumes,evidence:{...current.evidence,...Object.fromEntries(EVIDENCE_COLLECTIONS.map(k=>[k,merged[k]]))},roiSnapshot:rewriteIncoming(incoming.roiSnapshot??current.roiSnapshot,maps,counts),recomputedSnapshot:rewriteIncoming(incoming.recomputedSnapshot??current.recomputedSnapshot,maps,counts)};
  const legacy=[...(current.evidence.legacyImports||[]),...(incoming.evidence.legacyImports||[]),...(incoming.evidence.legacyV1?[incoming.evidence.legacyV1]:[])];if(legacy.length)snapshot.evidence.legacyImports=legacy;
  return {snapshot,preview:{mode:'merge',includedAssetIds:merged.volumes.map(v=>v.id),removedAssetIds:[],collisions,remap:Object.fromEntries([...maps].map(([k,v])=>[k,Object.fromEntries(v)])),changedReferenceCounts:counts}};
}

export async function stageProjectImport(text,{current,currentView,mode='open',knownEvidence,makeId,projectId}={}){
  if(!['open','merge'].includes(mode))throw Error('invalid-import-mode');
  if(typeof text!=='string')throw Error('invalid-project-text');
  assertWorkspaceBudget({assetCount:0,rawPayloadBytes:0,projectUtf8Bytes:utf8ByteLength(text)});
  const parsed=await parseProject(text);
  const incoming={...parsed,projectId:projectId||parsed.projectId,revision:0,view:checkedView(parsed.view),evidence:checkedEvidence(parsed.evidence,knownEvidence).value,roiSnapshot:null,recomputedSnapshot:null};
  // Reject broken imports against their own asset closure before they can merge.
  assertReferences(incoming,knownEvidence);
  const merged=mode==='merge'?mergeWorkspace(currentView?{...current,view:checkedView(currentView)}:current,incoming,makeId):{snapshot:incoming,preview:{mode:'open',includedAssetIds:incoming.volumes.map(v=>v.id),removedAssetIds:current.volumes.map(v=>v.id),collisions:[],remap:{},changedReferenceCounts:{}}};
  return stageWorkspaceChange(merged.snapshot,{current,knownEvidence,preview:merged.preview});
}

import {parseNifti,parseLabelTable,MAX_NIFTI_FILE_BYTES} from './nifti.js';
import {validateVolumeMetadata,MAX_LABEL_FILE_BYTES} from './workspace-limits.js';
import {prepareLocalVolumeProvenance} from './computation-manifest.js';
import {stageWorkspaceChange} from './workspace-session.js';

/** One explicit task-entry intent, retained through lazy loading and consumed
 * only by its real mounted input. Navigation/unmount cancels both pending intent
 * and scheduled focus; the frame follows dialog return-focus microtasks.
 */
export function createImportTaskHandoff({schedule=callback=>requestAnimationFrame(callback),cancel=handle=>cancelAnimationFrame(handle)}={}){
  let active=null,frame=null;
  const clearFrame=()=>{if(frame!==null){cancel(frame);frame=null;}};
  return {
    begin(scope){clearFrame();active=Object.freeze({scope});return active;},
    isCurrent(intent){return !!intent&&active===intent;},
    cancel(){clearFrame();active=null;},
    whenReady(intent,scope,onReady){
      if(!intent||active!==intent||intent.scope!==scope||typeof onReady!=='function')return;
      clearFrame();
      frame=schedule(()=>{frame=null;if(active!==intent)return;active=null;onReady();});
    },
  };
}

/** A token identifies a picker selection, including a reselected same-name file. */
export function newImportDraft(fileToken){
  return {fileToken,kind:'label',spaceId:'native-unverified',otherSpace:'',aligned:false,provenance:'',labelFile:null};
}
export function reduceImportDraft(state,action){
  if(action.type==='file-changed')return newImportDraft(action.fileToken);
  if(action.fileToken!=null&&action.fileToken!==state.fileToken)return state;
  switch(action.type){
    case 'kind-changed':return {...state,kind:action.value};
    case 'space-changed':return {...state,spaceId:action.value,aligned:false};
    case 'other-space-changed':return {...state,otherSpace:action.value,aligned:false};
    case 'alignment-changed':return {...state,aligned:state.spaceId==='MNI152NLin6Asym'&&action.value===true};
    case 'provenance-changed':return {...state,provenance:action.value};
    case 'label-file-changed':return {...state,labelFile:action.file?{fileToken:state.fileToken,file:action.file}:null};
    default:return state;
  }
}
export function prepareImportSummary(draft,{file,labelFile=draft.labelFile?.file}={}){
  if(!draft.fileToken||!file||typeof file.name!=='string')throw Error('import-file-required');
  if((labelFile||draft.labelFile)&&(draft.labelFile?.fileToken!==draft.fileToken||draft.labelFile.file!==labelFile))throw Error('stale-label-file');
  const space=draft.spaceId==='other'?draft.otherSpace:draft.spaceId;
  // Check raw lengths before trimming, using the same import/export rules as W1.
  const metadata=validateVolumeMetadata({kind:draft.kind,space,provenance:draft.provenance,source:file.name,name:file.name.replace(/\.nii(\.gz)?$/i,'')});
  const spaceId=metadata.space.trim()||'native-unverified',provenance=metadata.provenance.trim();
  const accepted=draft.spaceId==='MNI152NLin6Asym'&&spaceId==='MNI152NLin6Asym'&&draft.aligned===true;
  if(accepted&&!provenance)throw Error('provenanceRequired');
  return {fileToken:draft.fileToken,fileName:file.name,kind:metadata.kind,spaceId,labelFileName:labelFile?.name??null,provenance,alignmentStatus:accepted?'user-declared':'unverified'};
}

/** Decode and identify in isolation, then delegate to the existing W2 admission boundary.
 * `stage` is an optional host adapter; it must retain isCurrent through its commit.
 * Without it this returns a genuine W2 Stage, which still requires session.commit.
 */
export async function stageVolumeImport(draft,{file,labelFile=draft.labelFile?.file,current,signal,isCurrent=()=>true,stage,knownEvidence,parseVolume=parseNifti,onProgress}={}){
  const check=()=>{if(signal?.aborted)throw Error('import-cancelled');if(!isCurrent(draft.fileToken,current?.revision))throw Error('stale-workspace');};
  check();const summary=prepareImportSummary(draft,{file,labelFile});
  if(file.size>MAX_NIFTI_FILE_BYTES)throw Error('nifti-file-too-large');
  if(labelFile?.size>MAX_LABEL_FILE_BYTES)throw Error('labels-invalid-table');
  const originalBytes=new Uint8Array(await file.arrayBuffer());check();
  // The browser supplies the worker parser; Node hosts retain the canonical injectable boundary.
  // Keep the original bytes attached here: their hash identifies the actual selected file.
  const volume=await parseVolume(originalBytes,{name:summary.fileName.replace(/\.nii(\.gz)?$/i,''),kind:summary.kind,space:summary.spaceId},{signal,onProgress});check();
  if(labelFile){const text=await labelFile.text();check();volume.labels=parseLabelTable(text,/\.json$/i.test(labelFile.name)?'json':'csv');}
  const accepted=summary.alignmentStatus==='user-declared';
  Object.assign(volume,{canOverlayOnTarget:accepted,alignmentStatus:summary.alignmentStatus,provenance:summary.provenance,source:summary.fileName,metadata:{...volume.metadata,userDeclaredAligned:accepted,referenceSpace:summary.spaceId}});
  onProgress?.({phase:'identifying'});check();
  const identified=await prepareLocalVolumeProvenance(volume,originalBytes,{id:summary.fileName});check();
  if(stage)return stage(identified,summary,{isCurrent:()=>{check();return true;}});
  if(!current)throw Error('workspace-session-unavailable');
  const candidate={...current,volumes:[...current.volumes,{...identified,id:`custom-${crypto.randomUUID()}`}]};
  const prepared=await stageWorkspaceChange(candidate,{current,knownEvidence});check();return prepared;
}

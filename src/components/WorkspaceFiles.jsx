import React,{useEffect,useRef,useState} from 'react';
import {readSavedViews,writeSavedViews} from '../lib/workspace-project.js';
import {MAX_PROJECT_UTF8_BYTES} from '../lib/workspace-limits.js';
import WorkspaceAssets from './WorkspaceAssets.jsx';
import WorkspaceStatus from './WorkspaceStatus.jsx';
import {normalizeWorkspaceError,describeProjectExport} from '../lib/workspace-status.js';
import './WorkspaceFiles.css';

export default function WorkspaceFiles({language='zh',onClose,getView,onRestoreView,onExportProject,onStageProject,onCommitProject,onShare,snapshot,onRemovePlan,onCommitRemoval,onExportPlan,onConfirmExport,onArchiveRecoveryPlan,onDownloadRecovery,onCommitRecovery,draftState,onFlushDrafts,undoEntries=[],onUndo}){
  const en=language==='en',t=(zh,eng)=>en?eng:zh;
  const [name,setName]=useState(''),[saved,setSaved]=useState(()=>readSavedViews()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[pending,setPending]=useState(null);
  const [recoveryDownloaded,setRecoveryDownloaded]=useState(false);
  const actionTrigger=useRef(null),previewHeading=useRef(null),input=useRef(null),importButton=useRef(null),mergeButton=useRef(null),pickerMode=useRef('open'),epoch=useRef(0),mounted=useRef(true);
  useEffect(()=>{if(pending)previewHeading.current?.focus();},[pending]);
  useEffect(()=>{mounted.current=true;const node=input.current,restore=()=>{(pickerMode.current==='merge'?mergeButton:importButton).current?.focus();};node?.addEventListener('cancel',restore);return()=>{mounted.current=false;epoch.current++;node?.removeEventListener('cancel',restore);};},[]);
  const fail=error=>{setFailed(true);setMessage(normalizeWorkspaceError(error,language));};
  const save=()=>{setFailed(false);setMessage('');try{const entry={id:crypto.randomUUID(),name:name.trim()||new Date().toLocaleString(),createdAt:new Date().toISOString(),projectId:snapshot?.projectId??null,view:getView()};const next=[entry,...saved].slice(0,30);writeSavedViews(next);setSaved(next);setName('');setMessage(t('视图已保存在此浏览器。','View saved in this browser.'));}catch(e){fail(e);}};
  const remove=id=>{setMessage('');setFailed(false);try{const next=saved.filter(s=>s.id!==id);writeSavedViews(next);setSaved(next);}catch(e){fail(e);}};
  const run=async(action,success=t('已完成。','Completed.'))=>{setBusy(true);setMessage('');setFailed(false);try{const result=await action();if(mounted.current)setMessage(typeof result==='string'?result:success);}catch(e){if(mounted.current)fail(e);}finally{if(mounted.current)setBusy(false);}};
  const pick=mode=>{pickerMode.current=mode;input.current?.click();};
  const stageFile=async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    actionTrigger.current=null;const request=++epoch.current,mode=pickerMode.current;setPending(null);setBusy(true);setMessage('');setFailed(false);
    try{if(file.size>MAX_PROJECT_UTF8_BYTES)throw Error(t('项目文件超过 180 MiB。','Project file exceeds 180 MiB.'));if(!onStageProject)throw Error('workspace-session-unavailable');const stage=await onStageProject(file,{mode,requestId:request});if(mounted.current&&request===epoch.current)setPending(stage);}
    catch(error){if(mounted.current&&request===epoch.current)fail(error);}
    finally{if(mounted.current&&request===epoch.current)setBusy(false);}
  };
  const commit=async()=>{const stage=pending;if(!stage||!onCommitProject)return;await run(async()=>{await onCommitProject(stage);setPending(null);});};
  const cancel=()=>{epoch.current++;setPending(null);setMessage('');if(actionTrigger.current?.isConnected)actionTrigger.current.focus();else (pickerMode.current==='merge'?mergeButton:importButton).current?.focus();};
  const preview=async action=>{actionTrigger.current=document.activeElement;const request=++epoch.current;setBusy(true);setMessage('');setFailed(false);setPending(null);setRecoveryDownloaded(false);try{const plan=await action();if(mounted.current&&request===epoch.current)setPending(plan);}catch(error){if(mounted.current&&request===epoch.current)fail(error);}finally{if(mounted.current&&request===epoch.current)setBusy(false);}};
  const exportPlan=options=>preview(()=>onExportPlan(options));
  const exportFullProject=()=>snapshot?exportPlan({
    assetIds:snapshot.volumes.filter(volume=>!volume.projectId||volume.projectId===snapshot.projectId).map(volume=>volume.id),
    dependentPolicy:'include'
  }):run(onExportProject);
  const confirmAsset=()=>run(async()=>{if(pending.preview.mode==='remove')await onCommitRemoval(pending);else await onConfirmExport(pending);setPending(null);});
  const exportSize=pending?.preview.mode==='export'?describeProjectExport(pending):null;
  return <div className="workspace-files-backdrop"><section className="workspace-files" aria-busy={busy}>
    <header><h2>{t('保存与分享','Save and share')}</h2><button onClick={onClose} aria-label={t('关闭保存窗口','Close save dialog')}>×</button></header>
    {draftState&&(draftState.dirty||draftState.records.length>0)&&<WorkspaceStatus status={{phase:draftState.error?'error':'ready',message:draftState.error?normalizeWorkspaceError(draftState.error,language):draftState.dirty?t('草稿待保存','Draft pending save'):t('草稿已保存','Drafts saved'),retryLabel:t('重试保存草稿','Retry saving drafts')}} onRetry={!busy&&draftState.dirty?()=>run(onFlushDrafts,''):undefined}/>}
    <div className="workspace-destinations">
      <section className="workspace-destination" aria-labelledby="remember-view-title">
        <div>
          <h3 id="remember-view-title">{t('在此浏览器记住视图','Remember a view in this browser')}</h3>
          <p id="remember-view-details">{t('可保留最近 30 个命名视图。刷新后，需打开完整项目文件才能恢复导入的影像。','Keep up to 30 named views. To restore imported images after a reload, open the full project file.')}</p>
        </div>
        <form className="workspace-save-row" onSubmit={event=>{event.preventDefault();if(!busy)save();}}>
          <input value={name} maxLength={100} onChange={e=>setName(e.target.value)} aria-label={t('视图名称','View name')} placeholder={t('视图名称（可选）','View name (optional)')}/>
          <button type="submit" disabled={busy} aria-describedby="remember-view-details">{t('保存视图','Save view')}</button>
        </form>
      </section>
      <section className="workspace-destination" aria-labelledby="download-project-title">
        <div>
          <h3 id="download-project-title">{t('换台设备继续研究','Continue on another device')}</h3>
          <p id="download-project-details">{t('下载完整项目，可恢复视图、批注、论文与证据、草稿、项目影像及已保存的计算结果。文件可能含有私有内容。','Download the full project to restore your view, notes, papers, evidence, drafts, project images and saved results. The file may contain private material.')}</p>
        </div>
        <button disabled={busy} onClick={exportFullProject} aria-describedby="download-project-details">{t('导出完整项目','Export project')}</button>
      </section>
      <section className="workspace-destination" aria-labelledby="share-public-title">
        <div>
          <h3 id="share-public-title">{t('分享公开视图','Share a public view')}</h3>
          <p id="share-public-details">{t('链接只包含他人能用公开数据重建的视图。私有批注、草稿和导入影像均保留在本地。','The link contains only what others can reconstruct from public data. Private notes, drafts and imported images stay local.')}</p>
        </div>
        <button disabled={busy} onClick={()=>run(onShare)} aria-describedby="share-public-details">{t('复制视图链接','Copy view link')}</button>
      </section>
    </div>
    <WorkspaceStatus status={{phase:failed?'error':busy?'loading':'ready',message:busy?t('正在处理…','Working…'):draftState?.error&&message===normalizeWorkspaceError(draftState.error,language)?'':message}}/>
    <h3>{t('打开已有项目','Open an existing project')}</h3>
    <div className="workspace-file-actions"><button ref={importButton} disabled={busy} onClick={()=>pick('open')}>{t('打开项目文件','Open project file')}</button><button ref={mergeButton} disabled={busy} onClick={()=>pick('merge')}>{t('合并到当前项目','Merge into current project')}</button></div>
    <input type="file" accept=".json,.neuroatlas" hidden ref={input} onChange={stageFile}/>
    {snapshot?.startupRecovery&&<button disabled={busy} onClick={()=>preview(onArchiveRecoveryPlan)}>{t('归档恢复记录并继续','Archive recovery record and continue')}</button>}
    {pending?.preview.mode==='archive-recovery'&&<section className="workspace-import-preview" aria-label={t('恢复记录归档预览','Recovery archive preview')}>
      <h3 ref={previewHeading} tabIndex={-1}>{t('另存原始恢复记录','Save the original recovery record separately')}</h3>
      <p>{t('请先保存下载的恢复记录。确认后将从当前项目移除这份嵌入副本；当前笔记、证据、草稿、历史数值和缺失影像身份保留，之后可正常保存和导出项目。','Save the downloaded recovery record first. Continuing removes its embedded copy from this project; current notes, evidence, drafts, saved numbers and missing-image identities remain available for normal saving and project export.')}</p>
      <div className="workspace-file-actions">
        <button disabled={busy} onClick={()=>run(async()=>{setRecoveryDownloaded(false);await onDownloadRecovery(pending);setRecoveryDownloaded(true);},t('请确认文件已保存，再继续。','Confirm that you saved the file before continuing.'))}>{t('下载原始恢复记录','Download original recovery record')}</button>
        <button disabled={busy||!recoveryDownloaded} onClick={()=>run(async()=>{await onCommitRecovery(pending);setPending(null);})}>{t('我已保存，继续工作','I saved it; continue')}</button>
        <button disabled={busy} onClick={cancel}>{t('取消','Cancel')}</button>
      </div>
    </section>}
    {pending&&['open','merge'].includes(pending.preview.mode)&&<section className="workspace-import-preview" aria-label={t('项目导入预览','Project import preview')}>
      <h3 ref={previewHeading} tabIndex={-1}>{pending.preview.mode==='merge'?t('合并到当前项目','Merge into current project'):t('打开并替换当前项目','Open and replace current project')}</h3>
      <p>{t(`${pending.next.notes.length} 条批注 · ${pending.next.evidence.references.length} 篇本地论文 · ${pending.next.volumes.length} 个影像`,`${pending.next.notes.length} notes · ${pending.next.evidence.references.length} local papers · ${pending.next.volumes.length} volumes`)}</p>
      {pending.preview.removedAssetIds.length>0&&<p>{t('将从当前工作区移除的影像：','Volumes leaving the current workspace: ')}<span data-user-content>{pending.preview.removedAssetIds.join(', ')}</span></p>}
      {pending.preview.collisions.length>0&&<ul>{pending.preview.collisions.map(c=><li key={`${c.recordKind}:${c.id}`} data-user-content>{c.recordKind}: {c.id} → {c.incomingId}</li>)}</ul>}
      {pending.preview.mode==='open'&&<p>{t('当前批注、证据、草稿和视图将由文件内容替换。','The file will replace current notes, evidence, drafts and view.')}</p>}
      <div className="workspace-file-actions"><button disabled={busy} onClick={commit}>{pending.preview.mode==='merge'?t('确认合并','Confirm merge'):t('确认打开','Confirm open')}</button><button disabled={busy} onClick={cancel}>{t('取消','Cancel')}</button></div>
    </section>}
    {pending&&['remove','export'].includes(pending.preview.mode)&&<section className="workspace-import-preview" aria-label={t('影像操作预览','Asset action preview')}>
      <h3 ref={previewHeading} tabIndex={-1}>{pending.preview.mode==='remove'?t('移除影像','Remove asset'):t('项目导出预览','Project export preview')}</h3>
      {pending.preview.mode==='remove'?<p data-user-content>{pending.preview.assetName}</p>:<><p>{t(`项目下载：${exportSize.projectBytes?.toLocaleString()??'—'} 字节`,`Project download: ${exportSize.projectBytes?.toLocaleString()??'—'} bytes`)}</p><p>{t(`${exportSize.imageCount} 个影像 · 影像原始数据 ${exportSize.imageBytes.toLocaleString()} 字节 · ${pending.preview.noteCount} 条批注`,`${exportSize.imageCount} images · ${exportSize.imageBytes.toLocaleString()} raw image bytes · ${pending.preview.noteCount} notes`)}</p><ul className="workspace-export-assets">{pending.preview.assets.map(asset=><li key={asset.id} data-user-content>{asset.name} · {asset.id} · {asset.bytes.toLocaleString()} B{asset.usedBy.length>0&&<> · {asset.usedBy.join(', ')}</>}</li>)}</ul><p>{t('包含的本地证据','Included local evidence')}: {Object.entries(pending.preview.localEvidenceCounts).filter(([,count])=>count>0).map(([key,count])=>`${key}: ${count}`).join(' · ')||'0'}</p></>}
      {!!pending.preview.dependentViewFields.length&&<p>{t('将解除的当前视图引用','Current view references to detach')}: {pending.preview.dependentViewFields.map(field=>field.startsWith('navigationHistory:')?t(`移除 ${field.split(':')[1]} 条无法恢复的最近访问`,`${field.split(':')[1]} unavailable recent visits removed`):field).join(', ')}</p>}
      {!!pending.preview.dependentResults.length&&<p>{t('历史数值保留，标记为缺少输入','Historical values retained, marked missing input')}: {pending.preview.dependentResults.join(', ')}</p>}
      {pending.preview.mode==='remove'&&<p>{t('批注和证据保留。','Notes and evidence are retained.')}</p>}
      <div className="workspace-file-actions"><button disabled={busy} onClick={confirmAsset}>{pending.preview.mode==='remove'?t('确认移除','Confirm removal'):t('确认下载','Confirm download')}</button><button disabled={busy} onClick={cancel}>{t('取消','Cancel')}</button></div>
    </section>}
    <h3>{t('此浏览器中已保存的视图','Saved views in this browser')}</h3>
    <div className="workspace-saved-list">{saved.map(s=><article key={s.id}><button disabled={busy} onClick={()=>run(async()=>{await onRestoreView(s);onClose();})}><strong data-user-content>{s.name}</strong><small>{new Date(s.createdAt).toLocaleString()}</small></button><button disabled={busy} onClick={()=>remove(s.id)} aria-label={`${t('删除视图','Delete view')} ${s.name}`}>×</button></article>)}{!saved.length&&<p>{t('尚未保存视图。','No saved views yet.')}</p>}</div>
    {snapshot&&<WorkspaceAssets snapshot={snapshot} language={language} busy={busy} onRemovePlan={id=>preview(()=>onRemovePlan(id))} onExportPlan={exportPlan}/>}
    {!!undoEntries.length&&<button disabled={busy} onClick={()=>run(onUndo)}>{t('撤销：','Undo: ')}{undoEntries.at(-1).label}</button>}
  </section></div>;
}

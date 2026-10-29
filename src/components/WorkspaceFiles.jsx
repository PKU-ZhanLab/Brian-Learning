import React,{useEffect,useRef,useState} from 'react';
import {readSavedViews,writeSavedViews} from '../lib/workspace-project.js';
import {MAX_PROJECT_UTF8_BYTES} from '../lib/workspace-limits.js';
import './WorkspaceFiles.css';

export default function WorkspaceFiles({language='zh',onClose,getView,onRestoreView,onExportProject,onStageProject,onCommitProject,onShare,customVolumeCount=0}){
  const en=language==='en',t=(zh,eng)=>en?eng:zh;
  const [name,setName]=useState(''),[saved,setSaved]=useState(()=>readSavedViews()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pending,setPending]=useState(null);
  const input=useRef(null),importButton=useRef(null),mergeButton=useRef(null),pickerMode=useRef('open'),epoch=useRef(0),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const node=input.current,restore=()=>{(pickerMode.current==='merge'?mergeButton:importButton).current?.focus();};node?.addEventListener('cancel',restore);return()=>{mounted.current=false;epoch.current++;node?.removeEventListener('cancel',restore);};},[]);
  const save=()=>{try{const entry={id:crypto.randomUUID(),name:name.trim()||new Date().toLocaleString(),createdAt:new Date().toISOString(),view:getView()};const next=[entry,...saved].slice(0,30);writeSavedViews(next);setSaved(next);setName('');setMessage(t('视图已保存在此浏览器。','View saved in this browser.'));}catch(e){setMessage(e.message);}};
  const remove=id=>{try{const next=saved.filter(s=>s.id!==id);writeSavedViews(next);setSaved(next);}catch(e){setMessage(e.message);}};
  const run=async action=>{setBusy(true);setMessage('');try{await action();if(mounted.current)setMessage(t('已完成。','Completed.'));}catch(e){if(mounted.current)setMessage(e.message);}finally{if(mounted.current)setBusy(false);}};
  const pick=mode=>{pickerMode.current=mode;input.current?.click();};
  const stageFile=async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    const request=++epoch.current,mode=pickerMode.current;setPending(null);setBusy(true);setMessage('');
    try{if(file.size>MAX_PROJECT_UTF8_BYTES)throw Error(t('项目文件超过 180 MiB。','Project file exceeds 180 MiB.'));if(!onStageProject)throw Error('workspace-session-unavailable');const stage=await onStageProject(file,{mode,requestId:request});if(mounted.current&&request===epoch.current)setPending(stage);}
    catch(error){if(mounted.current&&request===epoch.current)setMessage(error.message);}
    finally{if(mounted.current&&request===epoch.current)setBusy(false);}
  };
  const commit=async()=>{const stage=pending;if(!stage||!onCommitProject)return;await run(async()=>{await onCommitProject(stage);setPending(null);});};
  const cancel=()=>{epoch.current++;setPending(null);setMessage('');(pickerMode.current==='merge'?mergeButton:importButton).current?.focus();};
  return <div className="workspace-files-backdrop"><section className="workspace-files" aria-busy={busy}>
    <header><h2>{t('保存与分享','Save and share')}</h2><button onClick={onClose} aria-label={t('关闭保存窗口','Close save dialog')}>×</button></header>
    <p>{t('项目文件包含视图、批注、论文记录和本项目的影像。','Project files contain views, notes, evidence records and this project’s volumes.')}</p>
    <div className="workspace-file-actions"><button disabled={busy} onClick={()=>run(onExportProject)}>{t('导出完整项目','Export project')}</button><button ref={importButton} disabled={busy} onClick={()=>pick('open')}>{t('打开项目文件','Open project file')}</button><button ref={mergeButton} disabled={busy} onClick={()=>pick('merge')}>{t('合并到当前项目','Merge into current project')}</button><button disabled={busy} onClick={()=>run(onShare)}>{t('复制视图链接','Copy view link')}</button></div>
    <input type="file" accept=".json,.neuroatlas" hidden ref={input} onChange={stageFile}/>
    {pending&&<section className="workspace-import-preview" aria-label={t('项目导入预览','Project import preview')}>
      <h3>{pending.preview.mode==='merge'?t('合并到当前项目','Merge into current project'):t('打开并替换当前项目','Open and replace current project')}</h3>
      <p>{t(`${pending.next.notes.length} 条批注 · ${pending.next.evidence.references.length} 篇本地论文 · ${pending.next.volumes.length} 个影像`,`${pending.next.notes.length} notes · ${pending.next.evidence.references.length} local papers · ${pending.next.volumes.length} volumes`)}</p>
      {pending.preview.removedAssetIds.length>0&&<p>{t('将从当前工作区移除的影像：','Volumes leaving the current workspace: ')}<span data-user-content>{pending.preview.removedAssetIds.join(', ')}</span></p>}
      {pending.preview.collisions.length>0&&<ul>{pending.preview.collisions.map(c=><li key={`${c.recordKind}:${c.id}`} data-user-content>{c.recordKind}: {c.id} → {c.incomingId}</li>)}</ul>}
      {pending.preview.mode==='open'&&<p>{t('当前批注、证据、草稿和视图将由文件内容替换。','The file will replace current notes, evidence, drafts and view.')}</p>}
      <div className="workspace-file-actions"><button disabled={busy} onClick={commit}>{pending.preview.mode==='merge'?t('确认合并','Confirm merge'):t('确认打开','Confirm open')}</button><button disabled={busy} onClick={cancel}>{t('取消','Cancel')}</button></div>
    </section>}
    <p className="workspace-file-note">{t(`本项目有 ${customVolumeCount} 个导入影像。链接只包含可公开重建的视图设置。`,`This project contains ${customVolumeCount} imported volumes. Links include public view settings.`)}</p>
    <h3>{t('保存一个视图','Save a named view')}</h3><div className="workspace-save-row"><input value={name} maxLength={100} onChange={e=>setName(e.target.value)} aria-label={t('视图名称','View name')} placeholder={t('例如：运动皮层 ROI 对比','e.g. Motor cortex ROI comparison')}/><button disabled={busy} onClick={save}>{t('保存视图','Save view')}</button></div>
    <p className="workspace-file-note">{t('命名视图保存在此浏览器，最多保留最近 30 个。刷新后，自定义影像需通过完整项目文件恢复。','Named views stay in this browser (up to 30). Custom volumes require a project file after a reload.')}</p>
    <div className="workspace-saved-list">{saved.map(s=><article key={s.id}><button disabled={busy} onClick={()=>{try{onRestoreView(s.view);onClose();}catch(e){setMessage(e.message);}}}><strong data-user-content>{s.name}</strong><small>{new Date(s.createdAt).toLocaleString()}</small></button><button disabled={busy} onClick={()=>remove(s.id)} aria-label={`${t('删除视图','Delete view')} ${s.name}`}>×</button></article>)}{!saved.length&&<p>{t('尚未保存视图。','No saved views yet.')}</p>}</div>
    {message&&<p role="status">{message}</p>}
  </section></div>;
}

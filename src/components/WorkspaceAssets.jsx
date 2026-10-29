import React,{useEffect,useState} from 'react';
import {describeWorkspaceAssets} from '../lib/workspace-assets.js';
import './WorkspaceAssets.css';

export default function WorkspaceAssets({snapshot,language='zh',onRemovePlan,onExportPlan,busy=false}){
 const t=(zh,en)=>language==='en'?en:zh,assets=describeWorkspaceAssets(snapshot),[selected,setSelected]=useState(()=>assets.map(a=>a.id)),[policy,setPolicy]=useState('include');
 useEffect(()=>{setSelected(assets.map(a=>a.id));},[snapshot.projectId,snapshot.revision]);
 const usage={view:t('当前视图','Current view'),notes:t('批注','Notes'),evidence:t('证据','Evidence'),roiSnapshot:t('历史 ROI 结果','Historical ROI result'),recomputedSnapshot:t('重算结果','Recomputed result')};
 return <section className="workspace-assets" aria-label={t('项目影像','Project assets')}>
  <h3>{t('项目影像','Project assets')}</h3>
  <ul>{assets.map(asset=><li key={asset.id} data-asset-id={asset.id}><label><input type="checkbox" checked={selected.includes(asset.id)} disabled={busy} aria-label={`${t('导出影像','Export asset')}: ${asset.name}`} onChange={e=>setSelected(ids=>e.target.checked?[...ids,asset.id]:ids.filter(id=>id!==asset.id))}/><span><strong data-user-content>{asset.name}</strong><span data-user-content>{asset.kind} · {asset.space||t('空间未知','Unknown space')} · {asset.bytes.toLocaleString()} B</span>{asset.usedBy.length>0&&<span>{asset.usedBy.map(key=>usage[key]).join(' · ')}</span>}</span></label><button disabled={busy} onClick={()=>onRemovePlan(asset.id)} aria-label={`${t('移除影像','Remove asset')}: ${asset.name}`}>{t('移除','Remove')}</button></li>)}</ul>
  {!assets.length&&<p>{t('本项目没有导入影像。','No imported assets in this project.')}</p>}
  {!!snapshot.missingAssetIds?.length&&<p className="workspace-missing-input" role="status">{t('历史记录缺少输入','Historical records have missing inputs')}: <span data-user-content>{snapshot.missingAssetIds.join(', ')}</span></p>}
  <label className="workspace-asset-policy"><span>{t('未勾选的依赖影像','Unselected dependencies')}</span><select value={policy} disabled={busy} aria-label={t('导出依赖策略','Export dependency policy')} onChange={e=>setPolicy(e.target.value)}><option value="include">{t('自动包含依赖','Include dependencies')}</option><option value="detach">{t('解除视图引用，保留历史结果','Detach view references, retain history')}</option></select></label>
  <button disabled={busy} onClick={()=>onExportPlan({assetIds:selected,dependentPolicy:policy})}>{t('选择内容导出','Export selected content')}</button>
 </section>;
}

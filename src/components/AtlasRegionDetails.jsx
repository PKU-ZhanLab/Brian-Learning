import React, {useEffect,useState} from 'react';
import { atlasRegionKey } from '../lib/atlas-identity.js';
import {SPATIAL_QC_RESOURCE,ensureResource,getResourceState,subscribe,retry} from '../lib/atlas-resource.js';
import {spatialQCForRegion} from '../lib/spatial-qc.js';
import {dataURL} from '../lib/assets.js';
import './AtlasRegionDetails.css';

export default function AtlasRegionDetails({ details, language='zh', queryContext, notes=[], onAnnotate, onCompare, canCompare=false, onConcept }) {
  const [qcState,setQCState]=useState(()=>getResourceState(SPATIAL_QC_RESOURCE));
  const hasDetails=Boolean(details);
  useEffect(()=>{if(!hasDetails)return;const off=subscribe(SPATIAL_QC_RESOURCE,setQCState);setQCState(getResourceState(SPATIAL_QC_RESOURCE));ensureResource(SPATIAL_QC_RESOURCE);return off;},[hasDetails]);
  if (!details) return null;
  const {ref,labelName,sourceUrl,sourceLocator,relations} = details;
  const en=language==='en';
  const scope=spatialQCForRegion(ref,qcState.status==='ready'?qcState.value:null);
  const ownNotes=notes.filter(note=>note.regionRef && atlasRegionKey(note.regionRef)===atlasRegionKey(ref));
  return <section className="atlas-region-details" aria-label="Atlas region details" data-region-key={atlasRegionKey(ref)}>
    <h2>{labelName}</h2>
    <dl><dt>{en?'Atlas / label':'图谱 / 标签'}</dt><dd>{ref.atlasId} · {ref.labelId} · {ref.hemisphere}</dd><dt>{en?'Version':'版本'}</dt><dd>{ref.atlasVersion}</dd><dt>{en?'Space':'空间'}</dt><dd>{ref.spaceId}</dd><dt>{en?'Query method':'查询方式'}</dt><dd>{queryContext?.method || (en?'Source dictionary':'原始标签字典')}</dd></dl>
    {sourceUrl&&<a href={sourceUrl} target="_blank" rel="noreferrer">{en?'Label source':'标签来源'} ↗</a>}{sourceLocator&&<p className="atlas-region-source">{sourceLocator}</p>}
    <details><summary>{en?'Spatial validation scope':'空间验证范围'}</summary>
      <p>{scope.humanValidated?(en?'This label has a recorded human regional review. See the report for its exact scope.':'此标签有具名人工区域审阅记录；具体范围见报告。'):(en?'Independent anatomical and human regional review pending.':'独立解剖验证与人工区域复核待完成。')}</p>
      {scope.reportMatchesAsset&&<p>{en?'Historical AI review covered three central planes; it does not establish whole-volume or small-nucleus accuracy.':'历史 AI 核图仅覆盖三个中心平面，不能证明全脑或小核团定位精度。'}</p>}
      {qcState.status==='error'?<button onClick={()=>retry(SPATIAL_QC_RESOURCE)}>{en?'Retry validation report':'重试验证报告'}</button>:<a href={dataURL('spatial-qc/assessment.json')} target="_blank" rel="noreferrer">{en?'Validation report':'验证报告'} ↗</a>}
    </details>
    {relations.length ? <ul>{relations.map(row=><li key={`${row.conceptId}-${row.type}`}><button onClick={()=>onConcept?.(row.conceptId)}>{row.conceptId}</button> · {row.type}<a href={row.sourceUrl} target="_blank" rel="noreferrer"> ↗</a></li>)}</ul> : <p>{en?'No linked concepts or research results yet.':'暂无已关联概念/研究结果'}</p>}
    <div className="atlas-region-actions"><button onClick={onAnnotate} aria-label="Annotate atlas label">{en?'Add annotation':'添加批注'}</button><button onClick={onCompare} disabled={!canCompare} aria-label="Compare selected atlas label">{en?'Compare this ROI':'送入 ROI 对比'}</button></div>
    {ownNotes.map(note=><p data-user-content className="inline-note" key={note.id}>{note.text}</p>)}
  </section>;
}

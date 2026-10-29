import React from 'react';
import {getPublishedResultRecord,getPublishedSourceDetails,getResultCorrections,publicResultURL,buildPublicResultExport} from '../lib/result-publication.js';
import {safeSourceURL} from '../lib/evidence-schema.js';
import registry from '../../data-sources/results/publication-registry.json' with {type:'json'};
import './ResultRecordPage.css';

const text=(value,language)=>typeof value==='string'?value:value?.[language]||value?.en||value?.zh||'';
const field=(value,language)=>value?.state==='reported'?JSON.stringify(value.value):value?.reason||text(value,language)||'—';
/** Canonical built-in lookup only. Local/imported evidence is never a prop.
 * X11 owns routing; this component can also be inspected in the reading pane. */
export default function ResultRecordPage({resultId,dataVersion,language='zh',onClose,standalone=false}){
 const en=language==='en',t=(zh,english)=>en?english:zh;
 let record,sources;
 try{record=getPublishedResultRecord({resultId,dataVersion});sources=getPublishedSourceDetails({resultId,dataVersion:record.dataVersion});}
 catch{return <section className="result-record-page" role="alert"><p>{t('未找到该固定版本的内置结果。','This fixed version of the built-in result is unavailable.')}</p>{onClose&&<button onClick={onClose}>{t('关闭','Close')}</button>}</section>;}
 const {result,reviewState}=record,corrections=getResultCorrections(resultId),Heading=standalone?'h1':'h3';
 const reference=standalone?buildPublicResultExport({resultId,dataVersion:record.dataVersion}).evidence.references.find(row=>row.id===result.referenceId):null;
 const versionLink=version=>publicResultURL(resultId,version)+(en?'&lang=en':'');
 const download=()=>{const content=buildPublicResultExport({resultId,dataVersion:record.dataVersion}),url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`${resultId}-${record.dataVersion}-publication.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="result-record-page" aria-label={t('内置结果版本记录','Built-in versioned result record')} data-result-record={resultId}>
  <header><Heading>{text(result.finding,language)}</Heading>{onClose&&<button onClick={onClose}>{t('关闭','Close')}</button>}</header>
  {reference&&<p><cite>{reference.title}</cite> · {reference.authors} · {reference.journal} ({reference.year}) {safeSourceURL(reference.url)&&<a href={reference.url} target="_blank" rel="noreferrer">DOI / {reference.doi||reference.id}</a>}</p>}
  <p><code>{record.resultId}</code> · <a href={versionLink(record.dataVersion)}>{record.dataVersion}</a></p>{standalone&&<nav aria-label={t('固定版本','Fixed versions')}>{registry.versions.filter(version=>version.records.some(row=>row.resultId===resultId)).map(version=><a key={version.dataVersion} href={versionLink(version.dataVersion)} aria-current={version.dataVersion===record.dataVersion?'page':undefined}>{version.dataVersion}</a>)}</nav>}<button type="button" onClick={download}>{t('导出固定版本与勘误来源','Export fixed version and correction sources')}</button>
  <dl>
   <dt>{t('任务 / 对比','Task / contrast')}</dt><dd>{text(result.contrast,language)}</dd>
   <dt>{t('实验','Experiment')}</dt><dd>{record.experiment?text(record.experiment.task,language):t('独立实验边界未摘录','Independent experiment boundary not extracted')}</dd>
   <dt>{t('招募 / 纳入 / 本分析样本','Enrolled / included / analysis sample')}</dt><dd>{['enrolled','included','perAnalysis'].map(key=>field(result.sample?.[key],language)).join(' / ')}</dd>
   <dt>{t('原文核对','Source check')}</dt><dd>{reviewState.sourceChecked?t('AI 辅助核对，仅限所列原文单元','AI-assisted check of the listed minimal source cells'):t('未完成','Pending')}</dd>
   <dt>{t('空间核对 / 人工审阅','Spatial check / human review')}</dt><dd>{reviewState.spaceChecked?t('已记录空间核对','Spatial check recorded'):t('空间核对待完成','Spatial check pending')} · {reviewState.humanReviewed?t('有人工作范围记录','Human review scope recorded'):t('人工审阅未完成','Human review pending')}</dd>
  </dl>
  <details><summary>{t('统计与校正','Statistics and correction')}</summary><pre>{field(result.statistics,language)}</pre><pre>{field(result.correction,language)}</pre><p>{t('效应量','Effect estimate')}: {field(result.effectEstimate,language)}</p></details>
  {record.locations.length>0&&<div className="result-record-table"><table><thead><tr><th>{t('来源位置','Source location')}</th><th>x, y, z (mm)</th><th>{t('来源空间','Source space')}</th></tr></thead><tbody>{record.locations.map(row=><tr key={row.id}><td>{text(row.sourceLabel,language)}<br/>{row.kind}</td><td>{row.xyz.join(', ')}</td><td>{row.sourceSpaceId}</td></tr>)}</tbody></table></div>}
  <details><summary>{t('图谱与映射','Atlas and mapping')}</summary>{record.mappings.length?record.mappings.map(row=><p key={row.id}>{row.targetRegionRef?JSON.stringify(row.targetRegionRef):row.targetConceptId} · {row.support}</p>):<p>{t('未建立精确图谱标签映射；阅读关联不代表空间定位。','No exact atlas-label mapping established; reading associations do not establish spatial localization.')}</p>}</details>
  <details open><summary>{t('来源与局限','Sources and limitations')}</summary>{sources.map(source=><div key={source.id}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.id}</a><p>{source.sourceVersion} · {source.locator}</p><small>{source.rights}</small></div>)}<ul>{record.limitations.map((item,index)=><li key={index}>{text(item,language)}</li>)}</ul><div className="result-record-links">{record.sourceRefs.filter(safeSourceURL).map(url=><a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>)}</div></details>
  {corrections.length>0&&<details><summary>{t('补充与勘误链','Additions and correction chain')}</summary>{corrections.map(row=><div key={row.id}><p><a href={versionLink(row.fromVersion)}>{row.fromVersion}</a> → <a href={versionLink(row.toVersion)}>{row.toVersion}</a> · {row.date}</p><p>{row.reason}</p><p>{row.changedFields.join(', ')}</p></div>)}</details>}
  <details><summary>{t('固定内容摘要与核对范围','Fixed content hash and review scope')}</summary><code className="result-record-hash">SHA-256 {record.contentHash}</code>{reviewState.events.map(event=><p key={event.id}>{event.actorName} · {event.date} · {event.scope}</p>)}<p>{t('固定版本已在本地登记；此记录不证明公网部署或人工认证。','Fixed version registered locally; this record does not establish public deployment or human certification.')}</p></details>
 </section>;
}

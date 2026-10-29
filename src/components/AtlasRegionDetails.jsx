import React from 'react';
import { atlasRegionKey } from '../lib/atlas-identity.js';
import './AtlasRegionDetails.css';

export default function AtlasRegionDetails({ details, language='zh', queryContext, notes=[], onAnnotate, onCompare, canCompare=false, onConcept }) {
  if (!details) return null;
  const {ref,labelName,sourceUrl,sourceLocator,relations} = details;
  const en=language==='en';
  const ownNotes=notes.filter(note=>note.regionRef && atlasRegionKey(note.regionRef)===atlasRegionKey(ref));
  return <section className="atlas-region-details" aria-label="Atlas region details" data-region-key={atlasRegionKey(ref)}>
    <h2>{labelName}</h2>
    <dl><dt>{en?'Atlas / label':'图谱 / 标签'}</dt><dd>{ref.atlasId} · {ref.labelId} · {ref.hemisphere}</dd><dt>{en?'Version':'版本'}</dt><dd>{ref.atlasVersion}</dd><dt>{en?'Space':'空间'}</dt><dd>{ref.spaceId}</dd><dt>{en?'Query method':'查询方式'}</dt><dd>{queryContext?.method || (en?'Source dictionary':'原始标签字典')}</dd></dl>
    {sourceUrl&&<a href={sourceUrl} target="_blank" rel="noreferrer">{en?'Label source':'标签来源'} ↗</a>}{sourceLocator&&<p className="atlas-region-source">{sourceLocator}</p>}
    {relations.length ? <ul>{relations.map(row=><li key={`${row.conceptId}-${row.type}`}><button onClick={()=>onConcept?.(row.conceptId)}>{row.conceptId}</button> · {row.type}<a href={row.sourceUrl} target="_blank" rel="noreferrer"> ↗</a></li>)}</ul> : <p>{en?'No linked concepts or research results yet.':'暂无已关联概念/研究结果'}</p>}
    <div className="atlas-region-actions"><button onClick={onAnnotate} aria-label="Annotate atlas label">{en?'Add annotation':'添加批注'}</button><button onClick={onCompare} disabled={!canCompare} aria-label="Compare selected atlas label">{en?'Compare this ROI':'送入 ROI 对比'}</button></div>
    {ownNotes.map(note=><p data-user-content className="inline-note" key={note.id}>{note.text}</p>)}
  </section>;
}

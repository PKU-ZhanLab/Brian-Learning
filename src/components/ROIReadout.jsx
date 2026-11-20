import React, {useState} from 'react';

const tr = (en, english, chinese) => en ? english : chinese;
const number = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString(undefined, {maximumFractionDigits:digits}) : '—';

export function operandDescription(kind, labels, threshold, tail, en) {
  if (kind === 'label') return labels.length ? labels.join(' + ') : tr(en, 'Choose labels', '请选择标签');
  if (kind === 'mask') return tr(en, 'Nonzero mask voxels', '掩膜非零体素');
  if (threshold === '' || threshold == null) return tr(en, 'Set threshold', '请设置阈值');
  if (kind === 'probability') return tr(en, 'Positive probability', '正概率') + ' ≥ ' + threshold;
  const direction = {positive:tr(en,'Positive','正向'),negative:tr(en,'Negative','负向'),absolute:tr(en,'Absolute','绝对值')};
  return (direction[tail] || tail || '') + tr(en,' · threshold ',' · 阈值 ') + threshold;
}

export function OperandLines({operands}) {
  return <dl className="roi-operand-lines">{operands.map(({side,atlas,description}) =>
    <div key={side}><dt className={'operand-'+side.toLowerCase()}>{side}</dt>
      <dd><span>{atlas}</span><strong>{description}</strong></dd></div>
  )}</dl>;
}

export function CompactLabelPicker({side,labels,values,onChange,language,labelName,disabled}) {
  const [query,setQuery] = useState('');
  const en = language === 'en';
  const term = query.trim().toLowerCase();
  const matches = labels.filter(row => [row.id,row.name,row.zh].join(' ').toLowerCase().includes(term));
  return <details className="roi-touch-picker"><summary>{tr(en,'Choose labels','选择标签')} · {tr(en,values.length+' selected','已选 '+values.length+' 项')}</summary>
    <input type="search" aria-label={tr(en,'Search ROI '+side+' labels','搜索 ROI '+side+' 标签')} value={query} placeholder={tr(en,'Search name or ID','搜索名称或编号')} onChange={e=>setQuery(e.target.value)}/>
    <div className="roi-touch-options">{matches.map(row=><label key={row.id}>
      <input type="checkbox" disabled={disabled} checked={values.includes(row.id)} onChange={e=>onChange(e.target.checked?[...values,row.id]:values.filter(id=>id!==row.id))}/>
      <span>#{row.id} · {labelName(row,language)}</span></label>)}
      {!matches.length&&<p>{tr(en,'No matching labels','没有匹配的标签')}</p>}
    </div>
  </details>;
}

export function RecordedResult({result,title,operands,language}) {
  const en = language === 'en';
  const [copyState,setCopyState] = useState('');
  const m = result.metrics || {};
  const space = result.grid?.space || result.manifest?.targetGrid?.space;
  const digestText = [title,...operands.map(o=>o.side+' · '+o.atlas+' · '+o.description),
    tr(en,'Reference space: ','参考空间：')+(space||'—'),
    tr(en,'Intersection: ','交集：')+number(m.intersectionMm3)+ (en?' mm³ (':' mm³（')+number(m.intersectionVoxels,0)+tr(en,' voxels)',' 个体素）'),
    'Dice '+(Number.isFinite(m.dice)?m.dice.toFixed(4):'—')+' · Jaccard '+(Number.isFinite(m.jaccard)?m.jaccard.toFixed(4):'—'),
    ...((result.manifest?.inputs || []).slice(0,2).map((v,i) => {
      const version = v.version === 'sha256:'+v.sha256 ? '' : v.version;
      return [(i?'B · ':'A · ')+v.id, version, 'SHA-256 '+v.sha256].filter(Boolean).join(' · ');
    }))].join('\n');
  async function copy() {
    try {await navigator.clipboard.writeText(digestText);setCopyState('copied');}
    catch {setCopyState('manual');}
  }
  return <>
    <div className="roi-result-heading"><h2>{title}</h2><button type="button" onClick={copy}>{tr(en,'Copy result summary','复制结果摘要')}</button></div>
    <OperandLines operands={operands}/>
    <div className="roi-result-figures">
      <div><span>{tr(en,'Intersection','交集体积')}</span><strong>{number(m.intersectionMm3)} <small>mm³</small></strong><small>{number(m.intersectionVoxels,0)} {tr(en,'voxels','个体素')}</small></div>
      <div><span>Dice</span><strong>{Number.isFinite(m.dice)?m.dice.toFixed(4):'—'}</strong></div>
      <div><span>Jaccard</span><strong>{Number.isFinite(m.jaccard)?m.jaccard.toFixed(4):'—'}</strong></div>
    </div>
    {copyState==='copied'&&<small role="status">{tr(en,'Summary copied','摘要已复制')}</small>}
    {copyState==='manual'&&<textarea readOnly aria-label={tr(en,'Result summary to copy','可复制的结果摘要')} value={digestText} onFocus={e=>e.target.select()}/>}
  </>;
}

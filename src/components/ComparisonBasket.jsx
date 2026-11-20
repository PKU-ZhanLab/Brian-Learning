import React from 'react';
import {X} from 'lucide-react';

export default function ComparisonBasket({paperIds=[],maxPapers=3,references={},language='zh',onRemove,onOpenPaper,onOpenComparison,pendingPaperId,onReplace,onAdmitPending,onCancelPending}){
  const en=language==='en',title=id=>references[id]?.title||id;
  if(!paperIds.length&&!pendingPaperId)return null;
  return <section className="comparison-basket" aria-label={en?'Comparison basket':'论文比较篮'}>
    <div className="comparison-basket-heading"><strong>{en?'Comparison':'论文比较'} <span>{paperIds.length}/{maxPapers}</span></strong><button disabled={paperIds.length<2} onClick={onOpenComparison}>{en?'Open comparison':'打开比较'}</button></div>
    <ol>{paperIds.map(id=><li key={id} data-basket-reference={id}><button className="basket-paper-title" onClick={()=>onOpenPaper?.(id)}>{title(id)}</button><button aria-label={`${en?'Remove from comparison':'移除对比'} ${title(id)}`} onClick={()=>onRemove(id)}><X size={15}/></button></li>)}</ol>
    {pendingPaperId&&<div className="comparison-capacity" role="status"><p>{paperIds.length>=maxPapers?(en?'Three papers selected. Remove a paper or choose one to replace with:':'已选三篇。请移除一篇，或选择要替换的论文：'):(en?'Space available. Add this paper:':'已有空位，可加入这篇论文：')} <strong>{title(pendingPaperId)}</strong></p><div>{paperIds.length<maxPapers?<button onClick={()=>onAdmitPending?.(pendingPaperId)}>{en?'Add to comparison':'加入比较'}</button>:paperIds.map(id=><button key={id} onClick={()=>onReplace(id,pendingPaperId)}>{en?'Replace':'替换'} {title(id)}</button>)}<button onClick={onCancelPending}>{en?'Cancel':'取消'}</button></div></div>}
  </section>;
}

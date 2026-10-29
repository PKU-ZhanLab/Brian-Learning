import React,{useEffect,useState} from 'react';
import {Eye,EyeOff,Trash2,MapPin,ArrowUpRight} from 'lucide-react';
import './ResultLayerBar.css';

const text=(value,language)=>typeof value==='string'?value:value?.[language]||value?.en||value?.zh||'';
export default function ResultLayerBar({layers=[],results={},references={},unavailable=[],language='zh',onVisibilityChange,onRemove,onOpenResult,onClear}){
  const en=language==='en',t=(zh,eng)=>en?eng:zh;
  const [expanded,setExpanded]=useState(()=>typeof matchMedia==='function'?!matchMedia('(max-width: 650px)').matches:true);
  useEffect(()=>{const query=window.matchMedia('(max-width: 650px)'),change=()=>setExpanded(!query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  if(!layers.length)return null;
  const names=[...new Set(layers.map(layer=>`${layer.resultId} · ${references[layer.sourceReferenceId]?.title||layer.sourceReferenceId}`))].join(' / ');
  return <details className="result-layer-bar" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
    <summary><MapPin size={15}/><strong>{t('结果图层','Result layers')} ({layers.length})</strong><span title={names}>{names}</span></summary>
    <div className="result-layer-content"><ul aria-label={t('结果图层','Result layers')}>{layers.map(layer=>{
      const result=results[layer.resultId],reference=references[layer.sourceReferenceId],finding=text(result?.finding,language)||layer.resultId;
      const independent=unavailable.filter(item=>item.layerId===layer.layerId).length===layer.coordinateIds.length;
      return <li key={layer.layerId} data-layer-id={layer.layerId} data-result-id={layer.resultId} data-visible={layer.visible}>
        <button className="result-layer-visibility" aria-label={t(`${layer.visible?'隐藏':'显示'}图层 ${layer.layerId}`,`${layer.visible?'Hide':'Show'} layer ${layer.layerId}`)} aria-pressed={layer.visible} onClick={()=>onVisibilityChange?.(layer.layerId,!layer.visible)}>{layer.visible?<Eye size={16}/>:<EyeOff size={16}/>}</button>
        <button className="result-layer-source" onClick={()=>onOpenResult?.(layer.resultId)} aria-label={t(`打开结果 ${layer.resultId}`,`Open result ${layer.resultId}`)}>
          <strong><span className="result-layer-symbol" aria-hidden="true">◇</span>{layer.resultId}<ArrowUpRight size={13}/></strong><span className="result-layer-finding" title={finding}>{finding}</span><span className="result-layer-paper" title={reference?.title||layer.sourceReferenceId}>{reference?.title||layer.sourceReferenceId}</span>
        </button>
        <span className="result-layer-frame">{layer.spaceId||t('未指定空间','Unspecified frame')}<small>{layer.coordinateIds.length} {t('点','points')} · {independent?t('独立坐标','Independent coordinates'):layer.visible?t('显示中','Shown'):t('已隐藏','Hidden')}</small></span>
        <button className="result-layer-remove" onClick={()=>onRemove?.(layer.layerId)} aria-label={t(`移除图层 ${layer.layerId}`,`Remove layer ${layer.layerId}`)}><Trash2 size={15}/></button>
      </li>;
    })}</ul><button className="result-layer-clear" onClick={onClear}><Trash2 size={13}/>{t('清空结果图层','Clear result layers')}</button></div>
  </details>;
}

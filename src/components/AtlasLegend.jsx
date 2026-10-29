import React from 'react';
import {ROI_COLORS} from '../lib/roi.js';
const COLORS=['#9ebdb2','#e4bcaa','#b6b7d3','#b8cbb0','#d9c797','#a6becf','#d5b0ba','#b8c5d5','#c9c1a7','#98bfbf','#d7c4b9','#c2b5ca'];
export default function AtlasLegend({atlas,language='zh'}){
  const en=language==='en';
  const labels=(atlas?.labels||[]).filter(label=>label.id>0);
  const name=atlas?.name|| (en?'Current atlas':'当前图谱');
  return <>
    <div className="selection-legend"><span><i className="selection-boundary"/>◇ {en?'Selected region':'选中脑区'}</span>{[['aOnly',en?'A only':'仅 A'],['bOnly',en?'B only':'仅 B'],['intersection',en?'A ∩ B':'A ∩ B 交集']].map(([key,label])=><span key={key}><i style={{background:ROI_COLORS[key]}}/>{label}</span>)}</div>
    <p className="intro-text">{name} · {labels.length} {en?'spatial labels':'个空间标签'}</p>
    <p className="muted">{atlas?.canOverlayOnTarget===false
      ? (en?'This atlas space is unverified. Only the label palette is listed; overlay on the main template is disabled. ':'该图谱空间未验证，以下仅列标签色板，主模板上暂停叠加。')
      : (en?'Colors match atlas samples on the current cortical surface. ':'颜色与当前皮层表面的图谱采样一致。')}
      {en?'Uncovered voxels appear gray. Deep meshes and schematic pathways use fixed catalog colors. When neighboring labels share a palette color, use names and IDs to distinguish them.':'未覆盖体素显示为灰色；深部网格和示意通路使用结构目录中的固定颜色。相邻标签共用有限色板时，请结合名称与编号辨认。'}</p>
    <div className="atlas-color-grid">{labels.map(label=><div key={label.id}><i style={{background:COLORS[(label.id*7)%COLORS.length]}}/><span><small>{label.id}</small>{en?label.name:(label.zh||label.name)}</span></div>)}</div>
  </>;
}

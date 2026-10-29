import React,{useState} from 'react';
import {atlasRegionKey} from '../lib/atlas-identity.js';

export default function SelectionTray({regions=[],language='zh',labelFor=ref=>`${ref.atlasId} · ${ref.labelId}`,onRemove,onClear,onAssign,onAdd,canAssign=true}){
  const en=language==='en',[side,setSide]=useState('A');
  return <section className="selection-tray" aria-label={en?'Selection basket':'选择篮'}>
    <div className="selection-tray-heading"><strong>{en?`${regions.length} selected`:`已选 ${regions.length} 项`}</strong><button disabled={!regions.length} onClick={onClear}>{en?'Clear selection':'清空选择'}</button></div>
    {!!regions.length&&<ul>{regions.map(ref=><li key={atlasRegionKey(ref)}><span>{labelFor(ref)}</span><button aria-label={`${en?'Remove':'移除'} ${labelFor(ref)}`} onClick={()=>onRemove?.(ref)}>×</button></li>)}</ul>}
    <div className="selection-tray-actions"><button aria-label="Set selection as ROI A" disabled={!regions.length||!canAssign} onClick={()=>onAssign?.('A',regions)}>{en?'Set as A':'设为 A'}</button><button aria-label="Set selection as ROI B" disabled={!regions.length||!canAssign} onClick={()=>onAssign?.('B',regions)}>{en?'Set as B':'设为 B'}</button><select aria-label={en?'Current collection':'当前集合'} value={side} onChange={e=>setSide(e.target.value)}><option value="A">A</option><option value="B">B</option></select><button aria-label="Add selection to current ROI collection" disabled={!regions.length||!canAssign} onClick={()=>onAdd?.(side,regions)}>{en?'Add to collection':'加入当前集合'}</button></div>
  </section>;
}

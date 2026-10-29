import React,{useEffect,useRef,useState} from 'react';
import {normalizeLayout} from '../lib/workspace-layout.js';
import './WorkspaceLayout.css';

export default function WorkspaceLayout({mode,layout,onChange,language='zh',evidenceEditing=false,children}){
  const en=language==='en',host=useRef(null),[width,setWidth]=useState(()=>window.innerWidth);
  useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
  const current=normalizeLayout({mode,...layout},{width}),research=mode==='research',narrow=width<1000;
  const change=patch=>onChange?.({...layout,...patch,panels:{...layout?.panels,...patch.panels}});
  const setWidthValue=value=>change({panels:{modelWidth:Math.max(width*.2,Math.min(width*.65,value))}});
  const startResize=e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);};
  const resize=e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const bounds=host.current.getBoundingClientRect();setWidthValue(e.clientX-bounds.left-(current.panels.catalog?232:0));}};
  return <>
    {research&&<div className="workspace-layout-controls" aria-label={en?'Workspace layout':'工作区布局'}><div role="group" aria-label={en?'Layout presets':'布局预设'}>{[['model',en?'Model first':'模型优先'],['evidence',en?'Evidence first':'证据优先'],['compare',en?'Full comparison':'全宽比较']].map(([id,label])=><button key={id} disabled={evidenceEditing&&id!=='evidence'} aria-pressed={current.preset===id} onClick={()=>change({...normalizeLayout({mode,preset:id},{width}),panels:{...normalizeLayout({mode,preset:id},{width}).panels,catalog:layout?.panels?.catalog===true,active:id==='model'?'model':'evidence'}})}>{label}</button>)}</div>{current.preset!=='compare'&&<><button aria-pressed={layout?.panels?.catalog===true} onClick={()=>change({panels:{catalog:!layout?.panels?.catalog}})} className="layout-catalog-toggle">{en?'Anatomy controls':'解剖控制'}</button><button onClick={()=>onChange(normalizeLayout({mode,preset:current.preset},{width}))}>{en?'Reset widths':'重置宽度'}</button>{narrow?<div role="group" aria-label={en?'Visible panel':'显示面板'}>{[['model',en?'Model':'模型'],['evidence',en?'Evidence':'证据']].map(([id,label])=><button key={id} aria-pressed={current.panels.active===id} onClick={()=>change({panels:{active:id}})}>{label}</button>)}</div>:<label className="layout-width-control">{en?'Model width':'模型宽度'}<input aria-label={en?'Model panel width':'模型面板宽度'} type="range" min={Math.round(width*.2)} max={Math.round(width*.65)} value={Math.max(width*.2,Math.min(width*.65,current.panels.modelWidth))} onChange={e=>setWidthValue(Number(e.target.value))}/></label>}</>}</div>}
    <main ref={host} className={`workspace workspace-layout ${research?'research-layout':''}`} data-layout={current.preset} data-catalog={narrow?layout?.panels?.catalog===true:current.panels.catalog} data-active-panel={current.panels.active} data-narrow={narrow} style={research?{'--model-width':`${Math.max(width*.2,Math.min(width*.65,current.panels.modelWidth))}px`}:undefined}>
      {children}
      {research&&!narrow&&current.preset!=='compare'&&<div className="workspace-resizer" role="separator" aria-orientation="vertical" aria-label={en?'Resize model and evidence':'调整模型与证据宽度'} aria-valuemin={20} aria-valuemax={65} aria-valuenow={Math.round(Math.max(20,Math.min(65,current.panels.modelWidth/width*100)))} tabIndex={0} onPointerDown={startResize} onPointerMove={resize} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setWidthValue(e.key==='Home'?width*.2:e.key==='End'?width*.65:current.panels.modelWidth+(e.key==='ArrowLeft'?-24:24));}}}/>}
    </main>
  </>;
}

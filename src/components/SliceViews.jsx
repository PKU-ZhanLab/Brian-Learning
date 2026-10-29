import React,{useEffect,useRef,useState} from 'react';
import { makeSliceCanvas, sliceWorldPoint, atlasLabelAt, SLICE_BOUNDS } from '../lib/volume.js';
import { ANATOMY_VOLUME_RESOURCE, atlasResourceKey, getResourceState, subscribe, ensureResource, retry } from '../lib/atlas-resource.js';
import { queryableAtlasVolume } from '../lib/query-state.js';

const PLANES=[{axis:'x',title:'矢状位',en:'Sagittal',left:'P',right:'A',top:'S',bottom:'I',color:'#b99ac5'},{axis:'y',title:'冠状位',en:'Coronal',left:'R',right:'L',top:'S',bottom:'I',color:'#94b9a8'},{axis:'z',title:'轴位',en:'Axial',left:'R',right:'L',top:'A',bottom:'P',color:'#d5ae85'}];
function Slice({plane,volume,atlasVolume,atlasStatus,slices,onChange,onCoordinate,language='zh'}){
  const en=language==='en';
  const title=en?plane.en:plane.title;
  const canvas=useRef(null),label=atlasLabelAt(atlasVolume,[slices.x,slices.y,slices.z]);
  const outside=slices[plane.axis]<SLICE_BOUNDS[plane.axis][0]||slices[plane.axis]>SLICE_BOUNDS[plane.axis][1];
  useEffect(()=>{if(!volume||!canvas.current)return;const rendered=makeSliceCanvas(volume,plane.axis,slices[plane.axis],{size:224,atlasVolume,radiological:true,crosshair:[slices.x,slices.y,slices.z],crosshairColor:plane.color});const target=canvas.current;target.width=rendered.width;target.height=rendered.height;target.getContext('2d').drawImage(rendered,0,0);},[volume,atlasVolume,slices.x,slices.y,slices.z,plane]);
  const pick=e=>{const rect=e.currentTarget.getBoundingClientRect();const point=sliceWorldPoint(plane.axis,slices[plane.axis],(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height,true);onCoordinate(point);};
  const labelName=en?label?.name?.replace(/^标签\s*/, 'Label '):label?.name;
  const emptyLabel=en?'No atlas label at this coordinate':'当前坐标没有图谱标签';
  return <div className="slice-card">
    <div className="slice-card-header"><span><i style={{background:plane.color}}/>{title}</span><small>{plane.axis.toUpperCase()} = {Number(slices[plane.axis].toFixed(3))} mm</small></div>
    <div className="slice-image"><span className="orientation top">{plane.top}</span><span className="orientation left">{plane.left}</span><span className="orientation right">{plane.right}</span><span className="orientation bottom">{plane.bottom}</span>
      {volume?<><canvas ref={canvas} onClick={pick} title={en?'Click to move the intersection of all three slices':'点击移动三正交切片交点'} aria-label={`${title} MRI ${en?'slice':'切片'}`}/>{outside&&<div className="out-of-template">{en?'Outside the brain template':'超出脑模板范围'}<br/>{en?'Slices show the brain template only':'当前切片仅显示脑模板'}</div>}</>:<div className="slice-loading">{en?'Loading MRI…':'正在载入 MRI…'}</div>}
    </div>
    <div className="slice-slider"><input aria-label={`${title}${en?' slice position':'切片位置'}`} type="range" min={SLICE_BOUNDS[plane.axis][0]} max={SLICE_BOUNDS[plane.axis][1]} step="1" value={Math.min(SLICE_BOUNDS[plane.axis][1],Math.max(SLICE_BOUNDS[plane.axis][0],slices[plane.axis]))} onChange={e=>onChange(plane.axis,+e.target.value)} style={{accentColor:plane.color}}/></div>
    <div className="slice-label" title={labelName||emptyLabel}>{atlasStatus==='loading'||atlasStatus==='idle'?(en?'Loading atlas…':'正在加载图谱…'):atlasStatus==='error'?(en?'Atlas loading failed':'图谱加载失败'):label?`${label.value} · ${labelName}`:`— ${en?'No atlas label at this coordinate':'当前坐标无图谱标签'}`}</div>
  </div>;
}
function useSharedResource(key){
  const [,render]=useState(0);
  useEffect(()=>{if(!key)return;const off=subscribe(key,()=>render(v=>v+1));ensureResource(key);return off;},[key]);
  return key?getResourceState(key):null;
}
export default function SliceViews({slices,onChange,atlas,atlasIdentity,onCoordinate,independentSpace=false,onReturnToBrain,language='zh'}){
  const en=language==='en';
  const anatomyState=useSharedResource(ANATOMY_VOLUME_RESOURCE),atlasKey=atlasIdentity?.version&&atlasIdentity?.sha256?atlasResourceKey(atlasIdentity):null;
  const atlasState=useSharedResource(atlasKey);
  const volume=anatomyState?.status==='ready'?anatomyState.value:null;
  const atlasVolume=atlasState?.status==='ready'?queryableAtlasVolume(atlasState.value,atlas,atlasIdentity):null;
  if(anatomyState?.status==='error')return <div className="slice-error" role="alert">{anatomyState.error}<button onClick={()=>retry(ANATOMY_VOLUME_RESOURCE)}>{en?'Retry MRI loading':'重试加载 MRI'}</button></div>;
  if(independentSpace)return <div className="slice-error">{en?'The current coordinate belongs to an independent spinal reference; brain MRI slices do not follow this position.':'当前坐标属于独立脊髓参考；脑 MRI 切片不与该位置联动。'}<button className="text-button" onClick={onReturnToBrain}>{en?'Return to brain-template slices':'返回脑模板切片'}</button></div>;
  return <div className="slice-views">{PLANES.map(plane=><Slice key={plane.axis} plane={plane} volume={volume} atlasVolume={atlasVolume} atlasStatus={atlasState?.status||'idle'} slices={slices} onChange={onChange} onCoordinate={onCoordinate} language={language}/>)}</div>;
}

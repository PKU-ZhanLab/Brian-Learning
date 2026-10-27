import React,{useEffect,useRef,useState} from 'react';
import {loadAtlasSlicePair,makeSliceCanvas,sliceWorldPoint,atlasLabelAt,prepareVolume,SLICE_BOUNDS} from '../lib/volume.js';

const planes=[['x','矢状位','Sagittal','P','A','S','I'],['y','冠状位','Coronal','R','L','S','I'],['z','轴位','Axial','R','L','A','P']];
function Plane({plane,pair,point,opacity,selected,onPoint,en}){
  const canvas=useRef(null),[axis,zh,eng,left,right,top,bottom]=plane,index='xyz'.indexOf(axis);
  useEffect(()=>{
    if(!pair||!canvas.current)return;
    const rendered=makeSliceCanvas(pair.anatomy,axis,point[index],{size:320,atlasVolume:pair.atlas,crosshair:point,overlayOpacity:opacity,selectedLabels:new Set(selected)});
    const target=canvas.current;target.width=rendered.width;target.height=rendered.height;target.getContext('2d').drawImage(rendered,0,0);
  },[pair,point,opacity,selected,axis,index]);
  const pick=e=>{const r=e.currentTarget.getBoundingClientRect();onPoint(sliceWorldPoint(axis,point[index],(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,true).map(Math.round));};
  return <section className="atlas-slice-card"><header><strong>{en?eng:zh}</strong><span>{axis.toUpperCase()} = {point[index].toFixed(0)} mm</span></header><div className="atlas-slice-image"><canvas ref={canvas} onClick={pick} aria-label={`${en?eng:zh} T1`} title={en?'Click to move all three crosshairs':'点击联动三视图交点'}/><span className="orientation left">{left}</span><span className="orientation right">{right}</span><span className="orientation top">{top}</span><span className="orientation bottom">{bottom}</span></div><input type="range" aria-label={`${en?eng:zh} position`} min={SLICE_BOUNDS[axis][0]} max={SLICE_BOUNDS[axis][1]} step="1" value={point[index]} onChange={e=>onPoint(point.map((v,i)=>i===index?+e.target.value:v))}/></section>;
}
export default function AtlasSlicePanel({atlas,displayVolume,point,onPoint,opacity,onOpacity,selected,onPick,language}){
  const en=language==='en',[pair,setPair]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;setPair(null);setError('');if(!displayVolume)return;loadAtlasSlicePair(atlas).then(v=>{if(alive)setPair({...v,atlas:prepareVolume(displayVolume.data,{...displayVolume,sliceReference:v.atlas.sliceReference})});}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[atlas,displayVolume]);
  const label=atlasLabelAt(pair?.atlas,point);
  const exportSlices=()=>{
    if(!pair)return;const canvases=planes.map(([axis])=>makeSliceCanvas(pair.anatomy,axis,point['xyz'.indexOf(axis)],{size:420,atlasVolume:pair.atlas,crosshair:point,overlayOpacity:opacity,selectedLabels:new Set(selected)}));
    const output=document.createElement('canvas');output.width=1260;output.height=Math.max(...canvases.map(c=>c.height))+100;const ctx=output.getContext('2d');ctx.fillStyle='#101814';ctx.fillRect(0,0,output.width,output.height);ctx.fillStyle='#ffffff';ctx.font='17px sans-serif';ctx.fillText(`${atlas} · ${pair.anatomy.name||pair.atlas.space} · RAS ${point.map(n=>n.toFixed(1)).join(', ')} mm`,16,27);
    canvases.forEach((c,i)=>{ctx.drawImage(c,i*420,76);const [, ,title,left,right,top,bottom]=planes[i];ctx.fillStyle='#ffffff';ctx.fillText(`${title} · ${planes[i][0].toUpperCase()}=${point[i].toFixed(1)} mm`,i*420+15,59);ctx.fillText(left,i*420+5,76+c.height/2);ctx.fillText(right,i*420+400,76+c.height/2);ctx.fillText(top,i*420+205,94);ctx.fillText(bottom,i*420+205,70+c.height);});
    const a=document.createElement('a');a.href=output.toDataURL('image/png');a.download=`NeuroAtlas-${atlas}-T1-slices.png`;a.click();
  };
  if(error)return <p role="alert" className="atlas-error">{error}</p>;
  if(!pair)return <p role="status" className="atlas-slice-loading">{en?'Loading the matching T1…':'正在载入配对 T1…'}</p>;
  return <div className="atlas-slices"><div className="atlas-slice-intro"><strong>{pair.native?(en?'Original space · Colin27 T1':'原始空间 · Colin27 T1'):(en?'Standard space · FSL MNI152 T1':'标准空间 · FSL MNI152 T1')}</strong><p>{pair.native?(en?'Original atlas labels on their matching T1; independent of the main brain coordinates.':'原始标签叠加配对 T1；坐标独立于主界面的标准脑。'):(en?'Labels on the shared standard T1. AAL registration is a project estimate.':'标签叠加统一标准 T1；AAL 的配准为项目估计。')}</p></div><div className="atlas-slice-grid">{planes.map(plane=><Plane key={plane[0]} plane={plane} pair={pair} point={point} opacity={opacity} selected={selected} onPoint={onPoint} en={en}/>)}</div><div className="atlas-slice-controls"><label>{en?'Label opacity':'标签透明度'}<input type="range" min="0" max="1" step=".05" value={opacity} onChange={e=>onOpacity(+e.target.value)}/><output>{Math.round(opacity*100)}%</output></label><button onClick={exportSlices}>{en?'Save three-view image':'保存三视图'}</button></div><div className="atlas-slice-readout"><span>RAS · {point.map(n=>n.toFixed(0)).join(', ')} mm</span><button disabled={!label} onClick={()=>label&&onPick(label.value)}>{label?`${label.value} · ${label.name}`:(en?'No label at crosshair':'交点处无标签')}</button></div><p className="atlas-slice-help">{en?'Click an image or move a slider to update all three slices. Checked labels control the overlay; opacity 0 shows T1 alone. R/L follows radiological convention.':'点击图像或移动滑块可联动三视图。勾选标签控制叠加范围，透明度为 0 时只显示 T1。R/L 采用放射学显示惯例。'}</p></div>;
}

import React,{useEffect,useRef,useState} from 'react';
import AtlasCanvas from './AtlasCanvas.jsx';
import {SourceSliceViews} from './SliceViews.jsx';
import {loadAtlas,atlasIdentityFor} from '../lib/volume.js';
import {serializableVolume} from '../lib/roi.js';
import {prepareComparisonDisplay} from '../lib/comparison-display.js';
import {atlasResourceKey,subscribe,getResourceState,retry} from '../lib/atlas-resource.js';
import {canLinkCoordinates,comparisonVolumeBounds,comparisonSourceRequestKey,createComparisonSourceLoader,updateComparison,validateComparisonState} from '../lib/comparison-link.js';
import './ComparisonViewport.css';

const emptySource=assetId=>({assetId,identity:null,point:[0,0,0],camera:null,labels:[],threshold:.5,tail:'positive'});
function SourcePanel({side,value,manifest,language,onSource,onUpdate,onChoose,resetGeneration}){
 const en=language==='en',seq=useRef(0),[volume,setVolume]=useState(null),[geometry,setGeometry]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[epoch,setEpoch]=useState(0);
 const metadata=manifest?.atlases?.[value.assetId];let key=null;try{if(metadata)key=atlasResourceKey(atlasIdentityFor(metadata));}catch{/* Absent identity is shown by the loader. */}
 const [sourceLoader]=useState(()=>createComparisonSourceLoader(loadAtlas));
 const requestKey=comparisonSourceRequestKey(value,{epoch,key,resetGeneration});
 useEffect(()=>{if(!key)return;return subscribe(key,()=>setEpoch(getResourceState(key).generation));},[key]);
 const callbacks=useRef({onSource,onUpdate});callbacks.current={onSource,onUpdate};
 useEffect(()=>{
  let alive=true,w=null;const generation=++seq.current;setVolume(null);setGeometry(null);setError('');setBusy(true);callbacks.current.onSource(side,null);
  if(!metadata){setError(en?'Source unavailable. Choose a source.':'来源不可用，请选择来源。');setBusy(false);return;}
  sourceLoader.run(value).then(request=>{
   if(!alive||generation!==seq.current||!request?.isCurrent())return;
   const raw=request.volume;
   const display=prepareComparisonDisplay(raw,{threshold:value.threshold,tail:value.tail});
   w=new Worker(new URL('../lib/atlas-explorer.worker.js',import.meta.url),{type:'module'});
   w.onmessage=({data})=>{
    if(!alive||generation!==seq.current||data.requestId!==generation)return;
    if(data.error){setError(data.error);setBusy(false);w.terminate();return;}
    if(data.result.meshes){setGeometry(data.result);setBusy(false);w.terminate();return;}
    const ids=value.labels.length?value.labels:data.result.slice(0,1).map(l=>l.id),bounds=comparisonVolumeBounds(raw);
    setVolume({...raw,display});callbacks.current.onSource(side,raw,{...value,identity:raw.identity,labels:ids,point:value.identity?value.point:['x','y','z'].map(a=>(bounds[a][0]+bounds[a][1])/2)});
    w.postMessage({requestId:generation,action:'surfaces',volume:serializableVolume(display),ids,options:{overview:false}});
   };
   w.onerror=()=>{if(alive&&generation===seq.current){setError(en?'Surface generation failed.':'边界生成失败。');setBusy(false);}};
   w.postMessage({requestId:generation,action:'summary',volume:serializableVolume(display)});
  }).catch(e=>{if(alive&&generation===seq.current){setError(e.message==='comparison-source-identity-mismatch'?(en?'Saved source identity differs; reselect explicitly.':'保存的来源身份不同，请明确重新选择。'):e.message);setBusy(false);}});
  return()=>{alive=false;seq.current++;sourceLoader.cancel();w?.terminate();};
 },[requestKey]);
 const chooseSource=assetId=>{seq.current++;sourceLoader.cancel();onChoose(side,assetId);};
 const name=metadata?.name||value.assetId;
 return <section className="comparison-source" aria-label={`${side} comparison source`} data-source={value.assetId} data-identity={volume?.identity?.sha256||''} data-point={JSON.stringify(value.point)} data-camera={JSON.stringify(value.camera)}>
  <header><strong>{side==='left'?(en?'Left':'左侧'):(en?'Right':'右侧')}</strong><select aria-label={`${side} source`} value={value.assetId} onChange={e=>chooseSource(e.target.value)}><option value="">{en?'Choose source':'选择来源'}</option>{Object.entries(manifest?.atlases||{}).filter(([,m])=>(m.available||m.custom)&&(m.data||m.metadata||m.file||m.custom)).map(([id,m])=><option key={id} value={id}>{m.name||id}</option>)}</select><button onClick={()=>chooseSource(value.assetId)}>{en?'Reset source':'重置来源'}</button></header>
  <details><summary>{name} · {volume?.identity?.spaceId||(en?'Unknown reference':'未知参考空间')}</summary><p>{volume?.identity?.id} · {volume?.identity?.version}</p><code>{volume?.identity?.sha256}</code><p>{volume?.spatialEvidence?.alignmentStatus||volume?.alignmentStatus} · {volume?.spatialEvidence?.provenance||volume?.provenance||volume?.source}</p></details>
  {['statistic','probability'].includes(metadata?.kind)&&<div><label>{en?'Threshold':'阈值'} <input aria-label={`${side} threshold`} type="number" min="0" max={metadata.kind==='probability'?1:undefined} step="any" value={value.threshold} onChange={e=>{if(e.target.value!==''&&Number.isFinite(+e.target.value))onUpdate(side,'threshold',+e.target.value);}}/></label><select aria-label={`${side} tail`} value={value.tail} onChange={e=>onUpdate(side,'tail',e.target.value)}>{['positive','negative','absolute'].map(t=><option key={t}>{t}</option>)}</select></div>}
  {error&&<p role="alert">{error} {key&&<button onClick={()=>retry(key)}>{en?'Retry':'重试'}</button>}</p>}
  {geometry?.missingIds?.length>0&&<p role="status">{en?'Saved labels absent from this source: ':'此来源不存在已保存标签：'}{geometry.missingIds.join(', ')}</p>}
  {busy&&<p role="status">{en?'Loading source and exact boundaries…':'正在载入来源与精确边界…'}</p>}
  {volume&&<><AtlasCanvas geometry={geometry} opacity={.85} language={language} ariaLabel={`${side} comparison 3D`} cameraState={value.camera} onCamera={c=>onUpdate(side,'camera',c)} onPick={(id,p)=>onUpdate(side,'point',p)}/><SourceSliceViews volume={volume} displayVolume={volume.display} point={value.point} labels={value.labels} language={language} side={side} onPoint={p=>onUpdate(side,'point',p)}/></>}
 </section>;
}
/** Both sources carry AssetIdentity; scientific calculation selections remain separate. */
export default function ComparisonViewport({left,right,linkCamera=true,linkCrosshair=true,onPoint,initialState,onStateChange,manifest,language='zh',onClose}){
 const [resetGenerations,setResetGenerations]=useState({left:0,right:0});
 const en=language==='en',[pair,setPair]=useState(()=>validateComparisonState(initialState||{open:true,left:{...emptySource(left.assetId),...left},right:{...emptySource(right.assetId),...right},linkCamera,linkCrosshair})),sources=useRef({left:null,right:null}),[revision,setRevision]=useState(0),callback=useRef(onStateChange);callback.current=onStateChange;
 useEffect(()=>{callback.current?.({...pair,open:true});},[pair]);
 const eligibility=canLinkCoordinates(sources.current.left,sources.current.right);
 const resolved=(side,source,state)=>{sources.current[side]=source;setRevision(n=>n+1);if(state)setPair(current=>current[side].assetId===state.assetId?{...current,[side]:{...current[side],identity:state.identity,labels:state.labels,point:current[side].identity?current[side].point:state.point}}:current);};
 const update=(side,kind,value)=>{setPair(current=>['point','camera'].includes(kind)?updateComparison(current,side,kind,value,sources.current):{...current,[side]:{...current[side],[kind]:value}});if(kind==='point')onPoint?.(side,value,sources.current[side]?.identity);};
 const choose=(side,assetId)=>{sources.current[side]=null;setRevision(n=>n+1);setResetGenerations(current=>({...current,[side]:current[side]+1}));setPair(current=>({...current,[side]:emptySource(assetId)}));};
 return <div className="comparison-viewport" data-revision={revision}><header className="comparison-heading"><h2>{en?'Source comparison':'来源并排比较'}</h2><button onClick={onClose} aria-label={en?'Close source comparison':'关闭来源比较'}>×</button></header><div className="comparison-links">{[['linkCamera',en?'Link cameras':'联动相机'],['linkCrosshair',en?'Link crosshairs':'联动十字线']].map(([key,title])=><label key={key}><input type="checkbox" aria-label={title} checked={pair[key]} disabled={!eligibility.allowed} onChange={e=>setPair(current=>({...current,[key]:e.target.checked}))}/>{title}</label>)}<span role="status">{eligibility.reason.split(' / ')[en?0:1]||eligibility.reason}</span><span>{en?'Display only; ROI computation is unchanged.':'仅并排显示；ROI 数值计算仍使用原选择。'}</span></div><div className="comparison-panels">{['left','right'].map(side=><SourcePanel key={side} side={side} resetGeneration={resetGenerations[side]} value={pair[side]} manifest={manifest} language={language} onSource={resolved} onUpdate={update} onChoose={choose}/>)}</div></div>;
}

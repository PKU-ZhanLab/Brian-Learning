import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Niivue,SLICE_TYPE} from '@niivue/niivue';
import AtlasCanvas from '../../src/components/AtlasCanvas.jsx';
import {SourceSliceViews} from '../../src/components/SliceViews.jsx';
import {exportNifti} from '../../src/lib/nifti.js';
import {prepareFixture,surfaceSTL,captureFixtureProject,restoreFixtureProject} from './fixture.mjs';
import '../../src/components/ComparisonViewport.css';
import './style.css';

const finitePoint=p=>(Array.isArray(p)||ArrayBuffer.isView(p))&&p.length>=3&&Array.from(p).slice(0,3).every(Number.isFinite);
function Experiment(){
 const canvas=useRef(null),nv=useRef(null),generation=useRef(0),fixtureRef=useRef(null),threeProbe=useRef(null);
 const [config,setConfig]=useState({kind:'label',tail:'positive',threshold:3}),[fixture,setFixture]=useState(null),[ready,setReady]=useState(false),[point,setPoint]=useState([112.125,-201.5,70.75]),[nvPoint,setNvPoint]=useState(null),[camera,setCamera]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState(null),[record,setRecord]=useState({rendering:'not-run',performance:null,networkPrivacy:null});
 const {kind,tail,threshold}=config;
 useEffect(()=>{
  let active=true,viewer=null;const element=document.createElement('canvas');canvas.current.replaceChildren(element);const token=++generation.current,urls=[];setReady(false);setFixture(null);setError('');setNvPoint(null);
  const current=()=>active&&token===generation.current;
  const dispose=()=>{if(!viewer)return;viewer.onLocationChange=()=>{};viewer.broadcastTo([]);viewer.cleanup();if(nv.current===viewer)nv.current=null;};
  (async()=>{
   const f=await prepareFixture(config);if(!current())return;
   viewer=new Niivue({isSliceMM:true,show3Dcrosshair:true});nv.current=viewer;
   await viewer.attachToCanvas(element);if(!current()){dispose();return;}
   const image=URL.createObjectURL(new Blob([exportNifti(f.volume)]));urls.push(image);
   await viewer.loadVolumes([{url:image,name:`${kind}.nii`,cal_min:kind==='label'?0:threshold,cal_max:kind==='label'?42:4,colormap:kind==='label'?'gray':'warm',colormapNegative:'winter',cal_minNeg:-4,cal_maxNeg:-threshold}]);
   if(!current()){dispose();return;}
   // Each discrete ID keeps a separate mesh name and mapping; STL itself has no label-ID field.
   const meshes=f.geometry.meshes.map(part=>{const url=URL.createObjectURL(new Blob([surfaceSTL({meshes:[part]})],{type:'model/stl'}));urls.push(url);return {url,name:`source-label-${part.id}.stl`};});
   await viewer.loadMeshes(meshes);if(!current()){dispose();return;}
   viewer.setSliceType(SLICE_TYPE.MULTIPLANAR);
   const restoredPoint=config.restore?.point||point;
   viewer.onLocationChange=location=>{if(current()&&finitePoint(location?.mm))setNvPoint(Array.from(location.mm).slice(0,3));};
   viewer.scene.crosshairPos=viewer.mm2frac(config.restore?.nvPoint||restoredPoint,0,true);
   if(config.restore?.camera){viewer.setRenderAzimuthElevation(config.restore.camera.azimuth,config.restore.camera.elevation);viewer.setScale(config.restore.camera.scale);}
   viewer.drawScene();
   const observed=Array.from(viewer.frac2mm(viewer.scene.crosshairPos,0,true)).slice(0,3);
   if(finitePoint(observed))setNvPoint(observed);
   fixtureRef.current=f;setFixture(f);setReady(true);
   setRecord({rendering:'initialized; numeric and visual acceptance pending',meshIds:viewer.meshes.map((m,i)=>({viewerId:m.id,sourceLabelId:f.geometry.meshes[i]?.id,name:m.name})),performance:null,networkPrivacy:null});
  })().catch(e=>{if(current()){setError(e.message);setReady(false);}});
  return()=>{active=false;generation.current++;dispose();element.remove();urls.forEach(URL.revokeObjectURL);};
 },[config]);
 const capture=async()=>{
  const f=fixtureRef.current,v=nv.current;if(!ready||!f||!v)return;
  const projectText=await captureFixtureProject(f,{point,camera,nvPoint,threshold,tail});
  setSaved({projectText,renderer:{niivue:{azimuth:v.scene.renderAzimuth,elevation:v.scene.renderElevation,scale:v.scene.volScaleMultiplier}}});
 };
 const restore=async()=>{
  try{const {pair,config:restoredConfig}=await restoreFixtureProject(saved.projectText);setPoint(pair.left.point);setCamera(pair.left.camera);setConfig({...restoredConfig,restore:{point:pair.left.point,nvPoint:pair.right.point,camera:saved.renderer.niivue}});}catch(e){setError(e.message);}
 };
 const measure=async()=>{if(!ready||!threeProbe.current||!nv.current)return;const token=generation.current,three=[],niivue=[];for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);if(token!==generation.current)return;three.push(threeProbe.current());const start=performance.now();nv.current.drawScene();niivue.push(performance.now()-start);}setRecord(current=>({...current,performance:{metric:'CPU draw submission milliseconds; not GPU completion or FPS',scope:{three:'3D boundaries',niivue:'multiplanar plus 3D; diagnostic, not an equivalent-workload score'},samples:20,three,niivue,viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,userAgent:navigator.userAgent}}));};
 const sendPoint=()=>{const v=nv.current;if(!ready||!v)return;v.scene.crosshairPos=v.mm2frac(point,0,true);v.drawScene();setNvPoint(Array.from(v.frac2mm(v.scene.crosshairPos,0,true)).slice(0,3));};
 return <main><h1>Three.js / NiiVue 0.69.0</h1><p>Same immutable synthetic source, affine and per-label exact boundaries. Browser acceptance and performance are pending.</p><label>Fixture <select value={kind} onChange={e=>setConfig({kind:e.target.value,tail,threshold})}><option>label</option><option>statistic</option></select></label><label>Threshold <input type="number" min="0" max="4" value={threshold} onChange={e=>setConfig({kind,tail,threshold:+e.target.value})}/></label><select value={tail} onChange={e=>setConfig({kind,threshold,tail:e.target.value})}>{['positive','negative','absolute'].map(v=><option key={v}>{v}</option>)}</select><button disabled={!ready} onClick={()=>capture().catch(e=>setError(e.message))}>Capture canonical project and adapter camera</button><button disabled={!saved} onClick={restore}>Restore full fixture and state</button><button disabled={!ready} onClick={measure}>Measure 20 CPU draw submissions</button><button disabled={!ready} onClick={sendPoint}>Send app world-mm point to NiiVue</button><button disabled={!finitePoint(nvPoint)} onClick={()=>setPoint(nvPoint)}>Use NiiVue numeric world-mm point</button><p>App RAS mm: {point.join(', ')} · NiiVue world mm: {nvPoint?.join(', ')||'pending'} · delta: {nvPoint?.map((v,i)=>v-point[i]).join(', ')||'pending'}</p>{error&&<p role="alert">{error}</p>}<div className="comparison-panels"><section><h2>Current Three.js</h2>{fixture&&<><AtlasCanvas onRenderProbe={probe=>{threeProbe.current=probe;}} geometry={fixture.geometry} opacity={1} language="en" cameraState={camera} onCamera={setCamera} onPick={(id,p)=>setPoint(p)}/><SourceSliceViews volume={fixture.volume} displayVolume={fixture.display} labels={kind==='label'?[7,42]:[1]} point={point} onPoint={setPoint} side="three" language="en"/></>}</section><section><h2>NiiVue</h2><div className="niivue-host" ref={canvas}/></section></div><details><summary>Fixture, manifest and execution record</summary><pre>{JSON.stringify({original:fixture?.original,derived:fixture?.volume.identity,manifest:fixture?.manifest,saved,record},null,2)}</pre></details></main>;
}
createRoot(document.getElementById('root')).render(<Experiment/>);

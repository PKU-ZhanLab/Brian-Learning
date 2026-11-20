import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import './ResultCoordinates.css';
import {resultCoordinateOverlayReason} from '../lib/result-layers.js';
import {selectResultCoordinate} from '../lib/result-coordinate-selection.js';
import {safeSourceURL} from '../lib/evidence-schema.js';
const text=(value,language)=>typeof value==='string'?value:value?.[language]||value?.en||value?.zh||'';
const translatedLabels={
  'Right FFA mean ROI':'右侧 FFA · 跨被试 ROI 平均位置',
  'Left FFA mean ROI':'左侧 FFA · 跨被试 ROI 平均位置',
  'rIFG BA44/45':'右额下回 BA44/45','lIFG BA44/45':'左额下回 BA44/45',
  'Left anterior insula / IFG':'左前脑岛 / 额下回','pre-SMA':'前辅助运动区（pre-SMA）',
  'Right TPJ stimulation mean':'右侧 TPJ · 平均刺激位置',
  'Right hMT/V5+ stimulation mean':'右侧 hMT/V5+ · 平均刺激位置',
};
export function reportedPointTitle(point,language){
  const label=text(point?.label,language);
  return language==='zh'&&typeof point?.label==='string'?(translatedLabels[label]||label):label;
}
export function ReportedSourceLink({point,language,fallbackUrl}){
  const url=safeSourceURL(point.sourceUrl)||safeSourceURL(fallbackUrl),table=text(point.sourceTable,language);
  const locator=[language==='zh'?table.replace(/^Table (\d+)$/i,'表 $1'):table,text(point.sourceRow,language)].filter(Boolean).join(' · ');
  const title=locator||(language==='zh'?'原文来源':'Primary source');
  return url?<a href={url} target="_blank" rel="noreferrer">{title} ↗</a>:locator||'—';
}
export default function ResultCoordinates({result,reference,selectedCoordinateId=null,language='zh',onClose,onOverlay,onReturnFocus,onOpenSource,onSelectCoordinate}){
  const en=language==='en',t=(zh,eng)=>en?eng:zh,host=useRef(null),selectPoint=useRef(null),pointIndicator=useRef(null);
  const coords=result?.coordinates||[],spaces=[...new Set(coords.map(point=>point.space))];
  const [selection,setSelection]=useState(()=>selectResultCoordinate(result,selectedCoordinateId));
  const {space,coordinateId:selectedPoint}=selection;
  const points=coords.filter(point=>point.space===space);
  const choosePoint=point=>{setSelection(selectResultCoordinate(result,point.id));onSelectCoordinate?.(point);};selectPoint.current=choosePoint;
  useEffect(()=>{setSelection(selectResultCoordinate(result,selectedCoordinateId));},[result,selectedCoordinateId]);
  useEffect(()=>{pointIndicator.current?.(selectedPoint);},[selectedPoint]);
  useEffect(()=>{
    const container=host.current;if(!container||!points.length)return;
    let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch{return;}
    let active=true;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.domElement.setAttribute('aria-label',t('原文空间中的结果点；也可使用下方坐标表','Result points in the reported frame; also available in the coordinate table'));
    container.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,2000),controls=new OrbitControls(camera,renderer.domElement),spheres=[];
    camera.up.set(0,0,1);scene.add(new THREE.HemisphereLight(0xffffff,0x446655,3));
    const bounds=new THREE.Box3();for(const point of points){
      const at=new THREE.Vector3(point.x,point.y,point.z);bounds.expandByPoint(at);
      const sphere=new THREE.Mesh(new THREE.SphereGeometry(2,16,12),new THREE.MeshStandardMaterial({color:'#c37d51'}));sphere.position.copy(at);sphere.userData.point=point;scene.add(sphere);spheres.push(sphere);
    }
    const axes=new THREE.AxesHelper(35);scene.add(axes);
    const indicator=new THREE.Mesh(new THREE.SphereGeometry(2.8,12,8),new THREE.MeshBasicMaterial({color:'#263e30',wireframe:true,depthTest:false}));indicator.renderOrder=1000;scene.add(indicator);
    const center=bounds.getCenter(new THREE.Vector3()),size=Math.max(80,bounds.getSize(new THREE.Vector3()).length());
    camera.position.copy(center).add(new THREE.Vector3(-.7,1,.7).normalize().multiplyScalar(size*1.5));controls.target.copy(center);controls.update();
    const render=()=>{if(active&&container.isConnected)renderer.render(scene,camera);};controls.addEventListener('change',render);
    pointIndicator.current=coordinateId=>{const point=points.find(value=>value.id===coordinateId);indicator.visible=Boolean(point);if(point)indicator.position.set(point.x,point.y,point.z);render();};pointIndicator.current(selectedPoint);
    // ResizeObserver can deliver a queued callback after this panel was closed.
    // Capture its owning element and stop before touching disposed render resources.
    const resize=()=>{if(!active||host.current!==container||!container.isConnected)return;const rect=container.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();render();};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let start=null;
    const pointerDown=event=>{start=[event.clientX,event.clientY];};
    const pointerUp=event=>{if(!active||!start||Math.hypot(event.clientX-start[0],event.clientY-start[1])>5){start=null;return;}start=null;const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return;pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(spheres)[0];if(hit)selectPoint.current?.(hit.object.userData.point);};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
    return()=>{active=false;pointIndicator.current=null;observer.disconnect();controls.removeEventListener('change',render);controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);for(const sphere of spheres){sphere.geometry.dispose();sphere.material.dispose();}indicator.geometry.dispose();indicator.material.dispose();axes.geometry.dispose();axes.material.dispose();renderer.dispose();renderer.domElement.remove();};
  },[result,space,language]);
  const frameLabel=space||t('未指定空间','Unspecified frame'),canOverlay=points.length>0&&points.every(point=>!resultCoordinateOverlayReason(point));
  const point=points.find(row=>row.id===selectedPoint)||points[0];
  const heading=reportedPointTitle(point,language)||t('论文结果坐标','Paper result coordinates');
  const sample=text(result.sample,language),meaning=text(result.roiDefinition,language);
  const frame=space==='MNI-unspecified'?t('MNI · 模板变体未报告','MNI · template variant unspecified'):frameLabel;
  return <div className="result-coordinate-panel" data-result-id={result.id}>
    <header><h3>{heading}</h3><button onClick={onClose} aria-label={t('关闭结果坐标','Close result coordinates')}>×</button></header>
    <div className="result-source-identity">{safeSourceURL(result.sourceUrl)?<a href={result.sourceUrl} target="_blank" rel="noreferrer" aria-label={t('核对原文结果','Check the source finding')}><cite>{reference?.title||result.referenceId}</cite> ↗</a>:<cite>{reference?.title||result.referenceId}</cite>}{reference?.year&&<span> · {reference.year}</span>}</div>
    {point&&<section className="reported-point" aria-label={t('原文坐标','Reported coordinate')}>
      <div className="reported-xyz"><strong>({[point.x,point.y,point.z].join(', ')})</strong> mm</div>
      <p className="reported-frame">{frame}</p>
      <ReportedSourceLink point={point} fallbackUrl={result.sourceUrl} language={language}/>
    </section>}
    <p className="reported-finding">{text(result.finding,language)}</p>
    <dl className="reported-point-facts">
      {sample&&<><dt>{t('样本','Sample')}</dt><dd>{sample}</dd></>}
      {meaning&&<><dt>{t('定位方法','Localization')}</dt><dd>{meaning}</dd></>}
    </dl>
    <div className="result-paper-actions">{onOpenSource&&<button onClick={()=>onOpenSource(result.id,selectedPoint)}>{t('打开来源论文','Open source paper')}</button>}<button onClick={onReturnFocus}>{t('返回工作区','Return to workspace')}</button></div>
    {spaces.length>1&&<select aria-label={t('原文坐标空间','Reported coordinate frame')} value={spaces.indexOf(space)} onChange={event=>setSelection({resultId:result.id,space:spaces[Number(event.target.value)],coordinateId:null})}>{spaces.map((value,index)=><option key={index} value={index}>{value||t('未指定空间','Unspecified frame')}</option>)}</select>}
    <div className="coordinate-axis-key"><span style={{color:'#b54e51'}}>X</span><span style={{color:'#408652'}}>Y</span><span style={{color:'#3c68a5'}}>Z</span><span>mm</span></div>
    <div ref={host} className="result-coordinate-canvas"/>
    <p className="result-coordinate-note">{t('此视图只显示原文报告的坐标和坐标轴，未借用其他模板的脑表面。点的半径仅用于可见性，不表示激活范围。','This view shows reported coordinates and axes in their own frame, without borrowing another template’s brain surface. Marker radius is for visibility, not activation extent.')}</p>
    {!points.length&&<p>{t('这条结果没有实验坐标；可通过相关脑区或原文图查阅。','This finding has no experimental coordinates. Use region links or the source figure.')}</p>}
    <div className="result-coordinate-table"><table><thead><tr><th>{t('区域','Region')}</th><th>X</th><th>Y</th><th>Z</th><th>{t('出处','Source')}</th></tr></thead><tbody>{points.map((point,index)=><tr key={point.id||index} aria-selected={selectedPoint===point.id}><td><button className="result-coordinate-point" onClick={()=>choosePoint(point)} aria-label={t(`定位结果点 ${point.id}`,`Locate result point ${point.id}`)}>{selectedPoint===point.id?'◇ ':''}{reportedPointTitle(point,language)||point.id||index+1}</button><small>{point.id}</small></td><td>{point.x}</td><td>{point.y}</td><td>{point.z}</td><td><ReportedSourceLink point={point} fallbackUrl={result.sourceUrl} language={language}/></td></tr>)}</tbody></table></div>
    <details className="result-provenance"><summary>{t('坐标空间与记录编号','Coordinate frame and record IDs')}</summary><p>{frameLabel} · {text(point?.frameNote,language)}</p><code>{result.id}</code>{point&&<> · <code>{point.id}</code></>}</details>
    {points.length>0&&<button onClick={()=>onOverlay?.(result,space)}>{canOverlay?t('保存并在主脑显示','Save layer and show on brain'):t('保存结果图层','Save result layer')}</button>}
  </div>;
}

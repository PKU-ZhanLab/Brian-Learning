import React,{useEffect,useId,useRef,useState} from 'react';
import {parseCoordinateInput,stepCoordinate,coordinateOutsideBounds,formatCoordinate} from '../lib/coordinate-input.js';
import {coordinateUI} from '../i18n/ui.js';

export default function CoordinateNavigator({point,spaceId,onNavigate,onCopy,language='zh',context='main',bounds,lockedSpace=false,independent=false,inputRef}) {
  const t=coordinateUI[language==='en'?'en':'zh'],id=useId(),expected=useRef(null);
  const [text,setText]=useState(point.join(', ')),[draftSpace,setDraftSpace]=useState(spaceId||''),[convention,setConvention]=useState('RAS');
  const [errors,setErrors]=useState([]),[batch,setBatch]=useState([]),[index,setIndex]=useState(0),[step,setStep]=useState('1'),[message,setMessage]=useState('');
  const signature=JSON.stringify([point,spaceId]);
  useEffect(()=>{
    if(expected.current===signature){expected.current=null;return;}
    setDraftSpace(spaceId||'');setText((convention==='LPS'?[-point[0]||0,-point[1]||0,point[2]]:point).join(', '));setBatch([]);setIndex(0);setErrors([]);setMessage('');
  },[signature]);
  function move(next,space=spaceId,reason="input"){
    expected.current=JSON.stringify([next,space]);setMessage('');onNavigate(next,space,{reason});
  }
  function submit(event){
    event.preventDefault();const result=parseCoordinateInput(text,{spaceId:draftSpace,convention,maxPoints:1000});setErrors(result.errors);setMessage('');
    if(result.errors.length)return;
    const space=draftSpace.trim();setDraftSpace(space);setBatch(result.points);setIndex(0);move(result.points[0],space);
  }
  function axisStep(axis,direction){
    const amount=Number(step);
    if(!Number.isFinite(amount)||amount<=0){setErrors([{field:'step',code:'invalid-step'}]);return;}
    try {const next=stepCoordinate(point,axis,amount*direction);setErrors([]);setBatch([]);setText((convention==='LPS'?[-next[0]||0,-next[1]||0,next[2]]:next).join(', '));move(next,spaceId,"step");}
    catch {setErrors([{field:'step',code:'invalid-step'}]);}
  }
  async function copy(){
    try {const value=formatCoordinate(point,spaceId||t.unknown);if(onCopy)await onCopy(value);else await navigator.clipboard.writeText(value);setMessage(t.copied);}
    catch {setMessage(t.copyFailed);}
  }
  const errorFields=new Set(errors.map(error=>error.field)),sameSpace=draftSpace===spaceId;
  return <div role="group" aria-label={t[context]} className="coordinate-navigator" data-coordinate-space={spaceId||''}>
    <form onSubmit={submit}>
      <div className="coordinate-reference"><label htmlFor={`${id}-space`}>{t.space}</label><input id={`${id}-space`} value={draftSpace} readOnly={lockedSpace} list={lockedSpace?undefined:`${id}-spaces`} onChange={event=>{setDraftSpace(event.target.value);setBatch([]);setErrors([]);}} aria-invalid={errorFields.has('spaceId')||undefined} aria-describedby={errorFields.has('spaceId')?`${id}-errors`:undefined}/>{!lockedSpace&&<datalist id={`${id}-spaces`}><option value="MNI152NLin6Asym"/><option value="Colin27 / MNI single-subject"/><option value="MNI unspecified"/></datalist>}</div>
      <div className="coordinate-input-row"><label htmlFor={`${id}-input`}>{t.coordinates}</label><textarea ref={inputRef} id={`${id}-input`} rows={2} value={text} placeholder={t.placeholder} onChange={event=>{setText(event.target.value);setBatch([]);setErrors([]);}} aria-invalid={errorFields.has('coordinates')||undefined} aria-describedby={errorFields.has('coordinates')?`${id}-errors`:undefined}/><label htmlFor={`${id}-convention`}>{t.convention}</label><select id={`${id}-convention`} value={convention} onChange={event=>{setConvention(event.target.value);setBatch([]);}}><option value="RAS">RAS</option><option value="LPS">LPS → RAS</option></select><button type="submit">{t.go}</button></div>
    </form>
    {errors.length>0&&<div id={`${id}-errors`} role="alert" className="coordinate-error">{errors.map((error,i)=><p key={i}>{error.line?t.line(error.line):''}{t.errors[error.code]}</p>)}</div>}
    {batch.length>1&&<label className="coordinate-batch">{t.batch}<select aria-label={t.batch} value={index} onChange={event=>{const next=Number(event.target.value);setIndex(next);move(batch[next],spaceId,"batch");}}>{batch.map((p,i)=><option key={i} value={i}>{i+1} / {batch.length} · RAS {p.join(', ')}</option>)}</select></label>}
    <output className="coordinate-current" aria-live="polite">{formatCoordinate(point,spaceId||t.unknown)}</output>
    {independent&&<p className="coordinate-context" role="status">{t.independent}</p>}
    {coordinateOutsideBounds(point,bounds)&&<p className="coordinate-context" role="status">{t.outside}</p>}
    <div className="coordinate-actions"><label htmlFor={`${id}-step`}>{t.step}<input id={`${id}-step`} type="number" min="0" step="any" value={step} onChange={event=>setStep(event.target.value)} aria-invalid={errorFields.has('step')||undefined}/></label>{['X','Y','Z'].map((axis,i)=><span key={axis} className="coordinate-axis"><button type="button" aria-label={t.decrease(axis)} disabled={!sameSpace||!spaceId} onClick={()=>axisStep(i,-1)}>−{axis}</button><button type="button" aria-label={t.increase(axis)} disabled={!sameSpace||!spaceId} onClick={()=>axisStep(i,1)}>+{axis}</button></span>)}<button type="button" disabled={!sameSpace||!spaceId} onClick={()=>{setErrors([]);setBatch([]);setText('0, 0, 0');move([0,0,0],spaceId,"center");}}>{t.center}</button><button type="button" onClick={copy}>{t.copy}</button></div>
    {message&&<p role="status" className="coordinate-context">{message}</p>}
  </div>;
}

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
/** Saved preferences have no fixed minimum columns. Runtime normalization uses the available canvas. */
export function normalizeLayout({mode='research',preset,panels={}}={},viewport={width:1920}){
  const width=Number.isFinite(viewport.width)?Math.max(0,viewport.width):1920;
  preset=mode==='research'?(['model','evidence','compare'].includes(preset)?preset:'evidence'):'model';
  const narrow=width<1000,available=Math.max(0,width-48);
  const fallback=preset==='model'?Math.min(1100,Math.round(available*.62)):Math.min(440,Math.round(available*.34));
  const modelWidth=Number.isFinite(panels?.modelWidth)?panels.modelWidth:fallback;
  return {preset,panels:{modelWidth:Math.round(clamp(modelWidth,0,available)),catalog:!narrow&&panels?.catalog===true,active:['model','evidence'].includes(panels?.active)?panels.active:preset==='model'?'model':'evidence'}};
}
const ids=value=>[...new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'&&v):[])].slice(0,3);
export function requestComparison(paperIds,paperId,maxPapers=3){
  const current=ids(paperIds),limit=clamp(maxPapers,1,3);
  if(current.includes(paperId))return {paperIds:current.filter(id=>id!==paperId),pendingPaperId:null};
  if(typeof paperId!=='string'||!paperId)return {paperIds:current,pendingPaperId:null};
  return current.length>=limit?{paperIds:current,pendingPaperId:paperId}:{paperIds:[...current,paperId],pendingPaperId:null};
}
export function replaceComparedPaper(paperIds,removedId,paperId){
  const current=ids(paperIds);
  if(!current.includes(removedId)||current.includes(paperId)||typeof paperId!=='string'||!paperId)return current;
  return current.map(id=>id===removedId?paperId:id);
}

// A return borrows reading position only. The current view, evidence and basket
// remain authoritative, including edits made while reading an individual paper.
export function comparisonReturnScroll(history,literature){
  const context=value=>JSON.stringify({compared:ids(value?.compared),query:value?.query||'',topic:value?.topic||'',paperModality:value?.paperModality??value?.modality??'',resultModality:value?.resultModality||'',scope:value?.scope===true,scopeRegionId:value?.scopeRegionId||null,onlyResults:value?.onlyResults===true});
  const wanted=context(literature);
  for(let i=(history?.index??-1)-1;i>=0;i--){const entry=history.entries[i];if(entry.view?.mode==='research'&&entry.view.literature?.showCompare&&context(entry.view.literature)===wanted)return {...entry.scroll};}
  return {};
}

/** Read a current render at execution, then save through the existing transaction. */
export function scheduleLayoutSave(latest,{projectId,epoch,delay=300}){
  let active=true;
  const timer=setTimeout(async()=>{
    const current=latest.current;
    if(!active||!current.isCurrent(projectId,epoch))return;
    try{await current.save(current.readView());if(active&&latest.current.isCurrent(projectId,epoch))latest.current.onSaved?.();}
    catch(error){if(active)latest.current.onError?.(error);}
  },delay);
  return()=>{active=false;clearTimeout(timer);};
}

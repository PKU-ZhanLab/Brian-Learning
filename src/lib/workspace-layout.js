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

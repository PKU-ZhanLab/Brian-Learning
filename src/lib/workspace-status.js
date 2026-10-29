// Contextual presentation adapters for authoritative resource/session state.
import {utf8ByteLength} from './workspace-limits.js';

/** `matching` is E3 SearchHit[], after the caller's scope filter. No search here.
 * `papers` counts distinct references represented by structured results;
 * bibliography/matching.papers/selected count bibliographic references. */
export function summarizeEvidenceCounts(bundle,{matching,selected=[]}={}){
  const results=[...new Map((bundle.results||[]).map(row=>[row.id,row])).values()];
  const locations=[...new Map((bundle.locations||[]).map(row=>[row.id,row])).values()];
  const references=new Set((bundle.references||[]).map(row=>row.id));
  const selectedIds=new Set(selected.filter(id=>references.has(id)));
  const hits=matching??[...references].map(referenceId=>({referenceId,resultIds:results.filter(row=>row.referenceId===referenceId).map(row=>row.id)}));
  const matchingReferences=new Set(hits.map(hit=>hit.referenceId).filter(id=>references.has(id)));
  const matchingIds=new Set(hits.flatMap(hit=>hit.resultIds||[]));
  const matchingResults=results.filter(row=>matchingReferences.has(row.referenceId)&&matchingIds.has(row.id));
  const resultIds=new Set(results.map(row=>row.id)),visibleIds=new Set(matchingResults.map(row=>row.id));
  return {papers:new Set(results.map(row=>row.referenceId)).size,results:results.length,coordinates:locations.filter(row=>resultIds.has(row.resultId)).length,bibliography:references.size,selected:selectedIds.size,
    matching:{papers:matchingReferences.size,structuredPapers:new Set(matchingResults.map(row=>row.referenceId)).size,results:matchingResults.length,coordinates:locations.filter(row=>visibleIds.has(row.resultId)).length}};
}

export function describeProjectExport(stage){
  return {imageCount:stage.preview.assetCount,imageBytes:stage.preview.rawPayloadBytes,projectBytes:typeof stage.projectText==='string'?utf8ByteLength(stage.projectText):null};
}

export function describePublicLinkOmissions(omitted=[],language='zh'){
  const en=language==='en',has=prefix=>omitted.some(code=>code===prefix||code.startsWith(prefix+'.')||code.startsWith(prefix+':'));
  const categories=[
    [has('coordinate')||has('slices')||has('atlasExplorer.location'),en?'local or unverified positions':'本地或来源未核实的位置'],
    [has('camera')||has('coordinate')||has('atlasExplorer.location'),en?'camera positions':'相机位置'],
    [has('resultLayers'),en?'local result layers':'本地结果图层'],
    [has('literature'),en?'local reading selections':'本地阅读选择'],
    [omitted.some(code=>['atlas','atlasExplorer','ROI','atlasSelection','unresolvedAtlasSelection'].includes(code)||code.startsWith('roi.')),en?'imported image views and selections':'导入影像的视图与选择'],
    [has('navigationHistory')||has('navigationContext')||has('atlasSelectionQuery'),en?'navigation context':'导航现场'],
  ].filter(([present])=>present).map(([,label])=>label);
  if(!omitted.length)return en?'Public view link copied.':'已复制公开视图链接。';
  return en?`View link copied. Omitted: ${categories.join('; ')||'local context'}. Use the full local project file to retain these contents.`:`已复制视图链接；已省略${categories.join('、')||'本地现场'}。完整本地项目文件可保留这些内容。`;
}

export function normalizeWorkspaceError(error,language='zh'){
  const en=language==='en',value=typeof error==='string'?error:String(error?.message||error||''),code=`${error?.name||''} ${value}`;
  if(/quota|QuotaExceededError|storage.*full/i.test(code))return en?'Browser storage is full. Free space, then retry saving; current edits remain available.':'浏览器存储空间已满。释放空间后重试保存；当前编辑仍保留。';
  if(/draft-payload-budget|draft-json-budget|draft-count/.test(code))return en?'The draft is too large to save. Shorten it and retry; the complete current draft remains in this session.':'草稿内容超过保存上限。缩短后重试；当前完整草稿仍保留在本次会话中。';
  if(/named-view-project-mismatch/.test(code))return en?'This view belongs to another project. Open its full project file before restoring the view.':'此视图属于另一个项目。请先打开对应的完整项目文件，再恢复该视图。';
  if(error instanceof SyntaxError||/Unexpected|not valid JSON|JSON.*(?:parse|position)|(?:parse|position).*JSON/i.test(code))return en?'The file could not be read as valid project JSON. Choose a valid file; current work is retained.':'无法将此文件读取为有效的项目 JSON。请选择有效文件；当前工作仍保留。';
  if(/title.*conflict|conflict.*title/i.test(code))return en?'The imported title conflicts with an existing paper. Check the paper ID and title, then retry.':'导入的标题与已有论文冲突。请核对论文 ID 和标题后重试。';
  if(/stale-workspace|stale-draft-generation/.test(code))return en?'The project changed during this action. Retry using the current project.':'操作期间项目发生了变化。请在当前项目中重试。';
  if(/budget|too large|exceeds|too-long|size limit/i.test(code))return en?'This content exceeds the supported save or export size. Reduce the content and retry; current work is retained.':'内容超过保存或导出上限。减少内容后重试；当前工作仍保留。';
  if(/workspace-storage-unavailable|workspace-session-unavailable/.test(code))return en?'Local saving is unavailable. Keep this session open and retry.':'本地保存暂不可用。请保留当前会话后重试。';
  return value;
}

export function resourceFeedback(state,language='zh',label){
  const en=language==='en',name=label||(en?'Data':'数据'),phase=state?.status||'loading';
  return {phase,message:phase==='error'?(en?`${name} could not be loaded. Retry loading.`:`${name}加载失败，请重试加载。`):phase==='loading'||phase==='idle'?(en?`Loading ${name.toLowerCase()}…`:`正在加载${name}…`):'',retryLabel:en?'Retry data loading':'重试加载数据'};
}

export function selectionLabel(ref,label,language='zh'){
  const recorded=Array.isArray(label)?label.find(row=>row.id===ref.labelId):label?.[ref.labelId]??label;
  const name=language==='en'?recorded?.name||recorded?.en:recorded?.zh||recorded?.name||recorded?.en;
  return name?`${ref.labelId} · ${name}`:`${ref.atlasId} · ${ref.labelId}`;
}

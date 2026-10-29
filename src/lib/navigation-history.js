import {boundedJsonStringify} from './workspace-limits.js';
const clone=value=>JSON.parse(boundedJsonStringify(value,1536*1024,'navigation-history-budget'));
const scrollKeys=new Set(['left','right','roi','tree','model','reading','detail','literature','atlas','atlasDetails','atlasSlices','atlasWorkspace','windowX','windowY','matrixX']);
function entry(value,validateView=v=>v){
  if(!value?.view||typeof value.view!=='object'||Object.hasOwn(value.view,'navigationHistory'))throw Error('navigation-history-recursive');
  const scroll={};for(const [key,position]of Object.entries(value.scroll??{})){
    if(!scrollKeys.has(key)||!Number.isFinite(position)||position<0||position>1e8)throw Error('navigation-history-scroll');scroll[key]=position;
  }
  return {view:validateView(value.view),scroll};
}
/** Validate once at the W6 view admission boundary; entries cannot contain history. */
export function validateNavigationHistory(value,{validateView,projectId}={}){
  if(!value||typeof value.projectId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value.projectId))throw Error('navigation-history-project');
  if(projectId!==undefined&&value.projectId!==projectId)throw Error('navigation-history-project-mismatch');
  if(!Array.isArray(value.entries)||value.entries.length>50)throw Error('navigation-history-limit');
  if(!Number.isInteger(value.index)||value.index< (value.entries.length?0:-1)||value.index>=value.entries.length)throw Error('navigation-history-index');
  return clone({projectId:value.projectId,index:value.index,entries:value.entries.map(v=>entry(v,validateView))});
}
export function pushNavigation(history,value,{limit=50}={}){
  if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('navigation-history-limit');
  const h=validateNavigationHistory(history),target=entry(clone(value));
  const entries=[...h.entries.slice(0,h.index+1),target].slice(-limit);
  const next=validateNavigationHistory({...h,entries,index:entries.length-1});return {history:next,target:clone(target)};
}
export function replaceNavigationEntry(history,value){
  const h=validateNavigationHistory(history);if(h.index<0)return pushNavigation(h,value).history;
  h.entries[h.index]=entry(clone(value));return validateNavigationHistory(h);
}
function travel(history,delta){
  const h=validateNavigationHistory(history),index=h.index+delta;
  if(index<0||index>=h.entries.length)return {history:h,target:null};
  return {history:{...h,index},target:clone(h.entries[index])};
}
export const goBack=history=>travel(history,-1);
export const goForward=history=>travel(history,1);

import {getPublishedResultRecord,publishedResultVersion,publicResultURL} from './result-publication.js';

// Inspect only short parameter names before allocating/decoding public query
// values. Long workspace view links with no result key retain their own route.
function hasResultParameter(search){
  const hash=search.indexOf('#'),limit=hash<0?search.length:hash;
  for(let start=search.startsWith('?')?1:0;start<limit;){
    const amp=search.indexOf('&',start),end=amp<0?limit:Math.min(amp,limit);
    const name=search.slice(start,Math.min(end,start+19)).split('=',1)[0];
    if(name.length<=18){try{if(decodeURIComponent(name)==='result')return true;}catch{/* A malformed name cannot equal result. */}}
    start=end+1;
  }
  return false;
}

/** null means workspace, never an invalid publication. Invalid public input
 * throws so callers cannot accidentally initialize the private workspace. */
export function parsePublicResultRoute(search=''){
  if(typeof search!=='string')throw Error('invalid-public-route');
  if(!hasResultParameter(search))return null;
  if(search.length>4096||/%(?![a-f\d]{2})/i.test(search))throw Error('invalid-public-route');
  const params=new URLSearchParams(search.split('#')[0]);
  // URLSearchParams replaces malformed UTF-8 instead of rejecting it.
  try{decodeURIComponent(search.replaceAll('+',' '));}catch{throw Error('invalid-public-route');}
  for(const key of ['result','version','lang'])if(params.getAll(key).length>1)throw Error('ambiguous-public-route');
  const resultId=params.get('result'),dataVersion=params.has('version')?params.get('version'):null;
  if(!/^[a-z0-9][a-z0-9-]{0,127}$/.test(resultId)||dataVersion!==null&&!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(dataVersion))throw Error('invalid-public-route');
  if(params.has('lang')&&!['zh','en'].includes(params.get('lang')))throw Error('invalid-public-language');
  return {resultId,dataVersion};
}

export function publicResultHref(resultId,dataVersion,{base='',language='zh'}={}){
  if(!['zh','en'].includes(language))throw Error('invalid-public-language');
  if(base&&!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))throw Error('invalid-public-base');
  return `${base}${publicResultURL(resultId,dataVersion)}${language==='en'?'&lang=en':''}`;
}

/** Canonical getter is the sole content authority. No private data parameter. */
export function resolvePublicResultRoute(search){
  try{
    const route=parsePublicResultRoute(search);if(!route)return null;
    const language=new URLSearchParams(String(search).split('#')[0]).get('lang')||'zh';
    const dataVersion=route.dataVersion===null?publishedResultVersion(route.resultId):route.dataVersion;
    if(typeof dataVersion!=='string')throw Error('unpublished-result');
    const record=getPublishedResultRecord({resultId:route.resultId,dataVersion});
    return {...route,dataVersion,language,record,kind:route.dataVersion===null?'redirect':'result',href:publicResultHref(route.resultId,dataVersion,{language})};
  }catch{
    const params=typeof search==='string'&&search.length<=4096?new URLSearchParams(search.split('#')[0]):null;
    return {kind:'unavailable',language:params?.getAll('lang').length===1&&params.get('lang')==='en'?'en':'zh'};
  }
}

export function publicResultDirectoryHref({base='/',language='zh'}={}){
 if(!base.startsWith('/')||!base.endsWith('/')||base.includes('..')||base.includes('?')||base.includes('#')||base.startsWith('//'))throw Error('Invalid public result base');
 return `${base}results/${language==='en'?'index.en.html':''}`;
}

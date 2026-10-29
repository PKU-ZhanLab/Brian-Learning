/** @typedef {import('./research-contracts.js').QueryContext} QueryContext */
const idle=()=>({status:'idle',context:null,result:null,error:null});
const validContext=context=>context&&typeof context.atlasId==='string'&&context.atlasId&&typeof context.atlasVersion==='string'&&context.atlasVersion&&Array.isArray(context.coordinate)&&context.coordinate.length===3&&context.coordinate.every(Number.isFinite)&&typeof context.method==='string'&&context.method&&Number.isSafeInteger(context.requestId);
export function sameQueryContext(a,b){
  return Boolean(validContext(a)&&validContext(b)&&a.requestId===b.requestId&&a.atlasId===b.atlasId&&a.atlasVersion===b.atlasVersion&&a.method===b.method&&a.spaceId===b.spaceId&&a.coordinate.every((value,index)=>value===b.coordinate[index]));
}
export function beginQuery(_previous,context){
  if(!validContext(context))throw Error('A complete query context is required');
  return {status:'loading',context:{...context,coordinate:[...context.coordinate]},result:null,error:null};
}
export function invalidateQuery(_previous,_reason){return idle();}
export function acceptQueryResult(current,context,result){
  if(!sameQueryContext(current?.context,context)||current.status!=='loading')return current;
  const source=result?.sourceAsset,region=result?.region;
  if(!source||!source.id||!source.sha256||source.version!==context.atlasVersion||!result.spaceId||source.spaceId!==result.spaceId||(context.spaceId&&context.spaceId!==result.spaceId))return current;
  if(region&&(region.atlasId!==context.atlasId||region.atlasVersion!==context.atlasVersion||region.spaceId!==result.spaceId))return current;
  return {status:'ready',context:current.context,result,error:null};
}
export function queryableAtlasVolume(volume,atlasId,identity){
  if(!volume||!identity||volume.canOverlayOnTarget!==true||volume.atlasId!==atlasId||volume.atlasVersion!==identity.version||!identity.spaceId||/unknown|unspecified/i.test(identity.spaceId)||volume.spaceId!==identity.spaceId)return null;
  return ['id','version','sha256','spaceId'].every(key=>volume.identity?.[key]===identity[key])?volume:null;
}

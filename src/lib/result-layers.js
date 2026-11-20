import {EVIDENCE_COLLECTIONS,emptyEvidence,migrateEvidence,getResultViewModel} from './evidence-schema.js';

const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const identifier=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(v);
/** Accept E2 bundles or the existing public display-model list at this boundary only. */
function bundle(value,references=[]){
 if(!value)return emptyEvidence();
 if(Array.isArray(value)||value.results?.some(r=>Array.isArray(r.coordinates))){const results=Array.isArray(value)?value:value.results,known=Array.isArray(value)?references:value.references||references;const migrated=migrateEvidence({schema:'brain-evidence-v1',references:[],results,relations:[]},{knownReferences:known}).value;migrated.references=known.map(r=>typeof r==='string'?{id:r}:r);return migrated;}
 return {...emptyEvidence(),...value};
}
function context({evidence,publicEvidence,publicResults,publicReferenceIds=[]}={}){
 const refs=[...publicReferenceIds];
 const builtIn=bundle(publicEvidence??publicResults,refs),local=bundle(evidence);
 return {...builtIn,...Object.fromEntries(EVIDENCE_COLLECTIONS.map(key=>[key,[...new Map([...builtIn[key],...local[key]].map(row=>[row.id,row])).values()]]))};
}
/** The existing coordinate-overlay permission: exact target frame and actual E2 source-check state. */
export function resultCoordinateOverlayReason(coordinate){
 if(coordinate.space!=='MNI152NLin6Asym')return 'unavailable-space';
 if(coordinate.status!=='source-checked')return 'source-not-checked';
 return null;
}
/** Reference-only shape validation is shared with codecs that have no evidence context yet. */
export function validateResultLayers(layers=[],options){
 if(!Array.isArray(layers)||layers.length>1000)throw Error('invalid-result-layers');
 const ids=new Set(),model=options?context(options):null;
 return layers.map(layer=>{
  if(!object(layer)||!identifier(layer.layerId)||ids.has(layer.layerId)||!identifier(layer.resultId)||!identifier(layer.sourceReferenceId)||!Array.isArray(layer.coordinateIds)||!layer.coordinateIds.length||layer.coordinateIds.length>10000||layer.coordinateIds.some(id=>!identifier(id))||new Set(layer.coordinateIds).size!==layer.coordinateIds.length||!(layer.spaceId===null||typeof layer.spaceId==='string'&&layer.spaceId.length>0&&layer.spaceId.length<=160)||typeof layer.visible!=='boolean'||!object(layer.style))throw Error('invalid-result-layer-reference');
  ids.add(layer.layerId);
  const style={};for(const [key,value]of Object.entries(layer.style)){
   if(key==='color'&&typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)||key==='opacity'&&Number.isFinite(value)&&value>=0&&value<=1||key==='size'&&Number.isFinite(value)&&value>=1&&value<=20)style[key]=value;
   else throw Error('invalid-result-layer-style');
  }
  if(model){
   const result=getResultViewModel(layer.resultId,model);
   if(!result||result.referenceId!==layer.sourceReferenceId||!model.references.some(r=>r.id===layer.sourceReferenceId))throw Error('invalid-result-layer-source');
   for(const id of layer.coordinateIds){const coordinate=result.coordinates.find(c=>c.id===id),location=model.locations.find(l=>l.id===id);if(!coordinate||location?.resultId!==layer.resultId)throw Error(`invalid-coordinate-reference: ${id}`);if(coordinate.space!==layer.spaceId)throw Error(`invalid-coordinate-space: ${id}`);}
  }
  return {layerId:layer.layerId,resultId:layer.resultId,coordinateIds:[...layer.coordinateIds],sourceReferenceId:layer.sourceReferenceId,spaceId:layer.spaceId,visible:layer.visible,style};
 });
}
export function resolveResultLayers(input,options={}){
 const layers=validateResultLayers(input,options),model=context(options),markers=[],unavailable=[];
 for(const layer of layers){
  const result=getResultViewModel(layer.resultId,model);
  for(const id of layer.coordinateIds){const coordinate=result.coordinates.find(c=>c.id===id),reason=resultCoordinateOverlayReason(coordinate);
   if(reason){unavailable.push({layerId:layer.layerId,coordinateId:id,reason});continue;}
   if(layer.visible)markers.push({id:`${layer.layerId}:${id}`,layerId:layer.layerId,resultId:layer.resultId,coordinateId:id,sourceReferenceId:layer.sourceReferenceId,position:[coordinate.x,coordinate.y,coordinate.z],coordinateSpace:coordinate.space,space:coordinate.space,verified:true,color:layer.style.color,opacity:layer.style.opacity,radiusMm:layer.style.size,sourceUrl:coordinate.sourceUrl});
  }
 }
 return {layers,markers,unavailable};
}
const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value??null);
/** Public IDs alone cannot authorize locally edited evidence, sources or locations. */
export function projectPublicResultLayers(input,{publicReferenceIds=[],publicResults,publicEvidence,evidence}={}){
 const layers=validateResultLayers(input),allowed=new Set(publicReferenceIds),builtIn=bundle(publicEvidence??publicResults,[...allowed]),local=bundle(evidence),actual=context({evidence:local,publicEvidence:builtIn}),published=[],omitted=[];
 for(const layer of layers){
  try{
   validateResultLayers([layer],{evidence:builtIn});validateResultLayers([layer],{evidence:actual});
   if(!allowed.has(layer.sourceReferenceId))throw Error('private-reference');
   for(const [collection,ids]of [['references',[layer.sourceReferenceId]],['results',[layer.resultId]],['locations',layer.coordinateIds]])for(const id of ids){const original=builtIn[collection].find(r=>r.id===id),current=actual[collection].find(r=>r.id===id);if(!original||canonical(original)!==canonical(current))throw Error('private-content');}
   // Review history also changes eligibility and must not be reconstituted as a public source check.
   if(canonical(getResultViewModel(layer.resultId,builtIn))!==canonical(getResultViewModel(layer.resultId,actual)))throw Error('private-result');
   published.push({...layer,layerId:`public-layer-${published.length+1}`});
  }catch{if(!omitted.includes('resultLayers'))omitted.push('resultLayers');}
 }
 return {layers:published,omitted};
}

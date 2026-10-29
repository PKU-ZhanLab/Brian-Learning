import {validateAssetIdentity} from './computation-manifest.js';
export function comparisonSourceRequestKey(value,{epoch,key,resetGeneration=0}={}){
 return JSON.stringify([value.assetId,value.threshold,value.tail,value.labels,epoch,key,resetGeneration]);
}
/** UI request lifetime only; loadAtlas remains the authoritative shared cache. */
export function createComparisonSourceLoader(load){
 let generation=0;
 return {
  cancel(){generation++;},
  async run(value){
   const request=++generation,volume=await load(value.assetId);
   if(request!==generation)return null;
   if(!volume)throw Error('Source unavailable');
   if(value.identity&&!sameComparisonIdentity(value.identity,volume.identity))throw Error('comparison-source-identity-mismatch');
   return {volume,isCurrent:()=>request===generation};
  },
 };
}
const point=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const sameComparisonIdentity=(a,b)=>!!a&&!!b&&equal(a,b);
const specific=space=>typeof space==='string'&&space.trim()&&!/^(MNI|MNI152|native|unknown|unspecified)$/i.test(space.trim())&&!/unknown|unspecified/i.test(space);
function evidence(source){
 const space=source.identity.spaceId,e=source.spatialEvidence,reference=source.spaceIdentitySource;
 const projectBytes=source.identityVerification==='received-project-derived-bytes'
  &&source.projectEntryObservation?.scope==='current-project-entry'
  &&sameComparisonIdentity(source.projectEntryObservation.derivedIdentity,source.identity)
  &&source.alignmentStatus==='user-declared'&&source.canOverlayOnTarget===true
  &&e?.alignmentStatus==='user-declared';
 const received=source.identityVerification==='received-bytes'||projectBytes;
 return received&&((e?.space===space&&!!(e.source||e.provenance)&&!!e.alignmentStatus)||(reference?.spaceId===space&&!!reference.sourceUrl&&/^[a-f\d]{64}$/i.test(reference.sourceSha256||'')));
}
/** Grid coincidence, generic MNI and arbitrary imported transforms never prove registration. */
export function canLinkCoordinates(left,right,transform){
 try{validateAssetIdentity(left?.identity);validateAssetIdentity(right?.identity);}catch{return {allowed:false,reason:'Source identity is unavailable / 来源身份不可用'};}
 if(!specific(left.identity.spaceId)||!specific(right.identity.spaceId))return {allowed:false,reason:'Exact reference space is unknown / 精确参考空间未知'};
 if(left.identity.spaceId!==right.identity.spaceId)return {allowed:false,reason:transform?'No verified direction-correct transform bridge is available / 无可用的已核验定向变换':'Different reference spaces; no applicable recorded transform / 参考空间不同，无可用的记录变换'};
 if(!evidence(left)||!evidence(right))return {allowed:false,reason:'Recorded reference evidence is required / 缺少参考空间依据'};
 const declared=[left,right].some(s=>s.spatialEvidence?.alignmentStatus==='user-declared');
 return {allowed:true,reason:declared?'User-declared alignment; not independently verified / 用户声明对齐，未经独立核验':'Common recorded reference; display does not certify anatomical registration / 同记录参考空间；显示不认证解剖配准'};
}
export function validateComparisonState(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid-paired-view');
 const out={open:value.open===true,linkCamera:value.linkCamera===true,linkCrosshair:value.linkCrosshair===true};
 for(const side of ['left','right']){
  const s=value[side];if(!s||typeof s.assetId!=='string'||s.assetId.length>120||!point(s.point))throw Error('invalid-paired-source');
  const identity=s.identity==null?null:validateAssetIdentity(s.identity);if(identity&&[identity.id,identity.version,identity.spaceId||''].some(v=>v.length>500))throw Error('invalid-paired-identity');
  let camera=null;if(s.camera!=null){const c=s.camera;if(!point(c.position)||!point(c.target)||!point(c.up||[0,0,1])||Math.hypot(...(c.up||[0,0,1]))===0||!Number.isFinite(c.zoom)||c.zoom<.01||c.zoom>100)throw Error('invalid-paired-camera');camera={position:[...c.position],target:[...c.target],up:[...(c.up||[0,0,1])],zoom:c.zoom};}
  out[side]={assetId:s.assetId,identity,point:[...s.point],camera,labels:Array.isArray(s.labels)?[...new Set(s.labels.filter(n=>Number.isSafeInteger(n)&&n>0))].slice(0,5000):[],threshold:Number.isFinite(s.threshold)&&s.threshold>=0?s.threshold:.5,tail:['negative','absolute'].includes(s.tail)?s.tail:'positive'};
 }
 return out;
}
export function updateComparison(state,side,kind,value,sources){
 if(!['left','right'].includes(side)||!['point','camera'].includes(kind)||!sameComparisonIdentity(state[side].identity,sources[side]?.identity))return state;
 if(kind==='point'&&!point(value))return state;
 if(equal(state[side][kind],value))return state; // Programmatic callbacks must not echo.
 const other=side==='left'?'right':'left',next={...state,[side]:{...state[side],[kind]:structuredClone(value)}};
 const allowed=canLinkCoordinates(sources.left,sources.right).allowed;
 if(allowed&&state[kind==='point'?'linkCrosshair':'linkCamera']&&sameComparisonIdentity(state[other].identity,sources[other]?.identity))next[other]={...state[other],[kind]:structuredClone(value)};
 return next;
}
/** World bounds from all eight affine-transformed voxel edges; never template-clipped. */
export function comparisonVolumeBounds(volume){
 const a=volume.affine.flat(),bounds={x:[Infinity,-Infinity],y:[Infinity,-Infinity],z:[Infinity,-Infinity]};
 for(const i of [-.5,volume.shape[0]-.5])for(const j of [-.5,volume.shape[1]-.5])for(const k of [-.5,volume.shape[2]-.5])for(let q=0;q<3;q++){const v=a[q*4]*i+a[q*4+1]*j+a[q*4+2]*k+a[q*4+3],range=bounds['xyz'[q]];range[0]=Math.min(range[0],v);range[1]=Math.max(range[1],v);}
 return bounds;
}

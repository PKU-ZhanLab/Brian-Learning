import {normalizeDOI} from './evidence-schema.js';
import {validateAssetIdentity,validateGridSpec,validateTransformIdentity,makeComputationManifest} from './computation-manifest.js';
import s5Assets from '../../public/data/asset-identities.json' with {type:'json'};

const origin='https://neurovault.org';
const fail=code=>Object.assign(new Error(code),{code});
const aborted=signal=>{if(signal?.aborted)throw Object.assign(new Error('lookup-aborted'),{name:'AbortError',code:'aborted'});};
const idOf=value=>Number(typeof value==='string'&&value.includes('/')?value.match(/\/(\d+)\/?$/)?.[1]:value);
const knownSpace=value=>['MNI152NLin6Asym','MNI152NLin2009cAsym','MNI152NLin2009aAsym','Talairach'].includes(value)?value:null;
function nextURL(value,path){
 let url;try{url=new URL(value,origin);}catch{throw fail('pagination-url');}
 if(url.hostname!=='neurovault.org'||url.port||url.username||url.password||!['https:','http:'].includes(url.protocol)||url.pathname!==path||url.hash)throw fail('pagination-url');
 url.protocol='https:';return url.href;
}

/** Read-only discovery. No result is committed until every bounded page has
 * completed and the DOI and collection identities have been checked. An
 * ignored DOI filter is a failed lookup, never a verified empty catalogue. */
export async function lookupStatMapsByDOI(doi,{fetcher=globalThis.fetch,signal,maxPages=6,maxRequests=24,timeoutMs=15000}={}){
 doi=normalizeDOI(doi);if(!/^10\.\d{4,9}\/\S+$/.test(doi))throw fail('invalid-doi');
 if(typeof fetcher!=='function'||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>50||!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>100||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw fail('invalid-lookup-options');
 let requests=0;
 const pages=async(first,path)=>{
  const seen=new Set(),rows=[];let next=first,page=0,expected=null;
  while(next){
   aborted(signal);next=nextURL(next,path);
   if(seen.has(next))throw fail('pagination-loop');seen.add(next);
   if(++page>maxPages||++requests>maxRequests)throw fail('pagination-budget');
   const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),timeoutMs);
   let body;
   try{
    const response=await fetcher(next,{signal:signal?AbortSignal.any([signal,timeout.signal]):timeout.signal,redirect:'error'});aborted(signal);
    if(!response?.ok)throw fail(`http-error-${response?.status||'unknown'}`);
    body=await response.json();aborted(signal);
   }catch(error){aborted(signal);if(timeout.signal.aborted)throw fail('lookup-timeout');if(error.code)throw error;throw fail('network-error');}
   finally{clearTimeout(timer);}
   if(!body||!Array.isArray(body.results)||!Number.isSafeInteger(body.count)||body.count<0)throw fail('invalid-response');
   if(expected!==null&&expected!==body.count)throw fail('changing-catalogue');expected=body.count;
   rows.push(...body.results);next=body.next||null;
  }
  if(rows.length!==expected)throw fail('incomplete-response');
  return rows;
 };
 const collections=await pages(`${origin}/api/collections/?DOI=${encodeURIComponent(doi)}`,'/api/collections/');
 const exact=collections.filter(row=>normalizeDOI(row.DOI)===doi);
 if(collections.length&&!exact.length)throw fail('doi-filter-integrity');
 const candidates=[],collectionIds=new Set();
 for(const collection of exact){
  const collectionId=idOf(collection.id);if(!Number.isSafeInteger(collectionId)||collectionId<1||collectionIds.has(collectionId))throw fail('collection-identity-invalid');collectionIds.add(collectionId);
  const path=`/api/collections/${collectionId}/images/`;
  const images=await pages(origin+path,path),imageIds=new Set();
  for(const image of images){
   aborted(signal);const imageId=idOf(image.id);
   if(!Number.isSafeInteger(imageId)||imageId<1||imageIds.has(imageId))throw fail('image-identity-invalid');imageIds.add(imageId);
   if(idOf(image.collection)!==collectionId)throw fail('image-collection-mismatch');
   candidates.push({provider:'NeuroVault',collectionId,imageId,paperDOI:doi,sourceURL:`${origin}/images/${imageId}/`,retrievedAt:new Date().toISOString(),upstreamVersion:image.modify_date||collection.modify_date||null,asset:null,sourceSpaceId:knownSpace(image.target_template_image),upstreamRawTemplate:image.target_template_image??null,mapKind:image.image_type??'unknown',statisticType:image.map_type??'unknown',thresholdState:typeof image.is_thresholded==='boolean'?(image.is_thresholded?'thresholded':'unthresholded'):'unknown',rights:{license:'not-verified',sourceRefs:[`${origin}/FAQ`]},status:'candidate'});
  }
 }
 aborted(signal);return candidates;
}

function sourceGrid(value){
 if(!value||value.shape?.length!==3||!value.shape.every(n=>Number.isSafeInteger(n)&&n>0)||value.voxelSize?.length!==3||!value.voxelSize.every(n=>Number.isFinite(n)&&n>0)||!Array.isArray(value.affine)||value.affine.length!==4||!value.affine.every(row=>Array.isArray(row)&&row.length===4&&row.every(Number.isFinite))||typeof value.axisConvention!=='string'||!value.axisConvention.trim())throw fail('source-grid-required');
 return structuredClone(value);
}

function sourceRights(value){
 if(value==null)return {license:'unknown',sourceRefs:[],verifiedAt:null,reason:'No download-specific rights evidence supplied.'};
 const text=entry=>typeof entry==='string'&&entry.trim().length>0;
 if(typeof value!=='object'||Array.isArray(value)||!text(value.license)||!Array.isArray(value.sourceRefs)||!value.sourceRefs.every(text)||!['unknown','not-verified'].includes(value.license)&&!value.sourceRefs.length)throw fail('source-rights-evidence-required');
 if(value.verifiedAt!==undefined&&value.verifiedAt!==null&&(!text(value.verifiedAt)||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value.verifiedAt)||!Number.isFinite(Date.parse(value.verifiedAt))||new Date(value.verifiedAt).toISOString().slice(0,10)!==value.verifiedAt.slice(0,10)))throw fail('source-rights-date-invalid');
 if(value.basis!==undefined&&!(text(value.basis)||Array.isArray(value.basis)&&value.basis.length>0&&value.basis.every(text)))throw fail('source-rights-basis-invalid');
 return structuredClone(value);
}

/** Bind downloaded original bytes to an exact upstream observation. Download
 * metadata cannot grant a candidate a template or transform. S5-produced
 * derivations, when available, are attached through the authority adapter. */
export function resolveStatMapAsset(candidate,downloadManifest,{assetRegistry=s5Assets}={}){
 const m=downloadManifest;
 if(candidate?.provider!=='NeuroVault'||m?.provider!==candidate.provider||m.collectionId!==candidate.collectionId||m.imageId!==candidate.imageId||m.upstreamVersion!==candidate.upstreamVersion)throw fail('upstream-identity-mismatch');
 const space=knownSpace(candidate.sourceSpaceId),identity=validateAssetIdentity(m.sourceAsset);
 if(identity.spaceId!==space)throw fail('source-space-mismatch');
 if(candidate.asset&&JSON.stringify(validateAssetIdentity(candidate.asset))!==JSON.stringify(identity))throw fail('source-asset-mismatch');
 const limitations=[{zh:'上游身份和文件哈希不证明空间、论文对比或人工复核。',en:'Upstream identity and a file hash do not verify space, paper contrast or human review.'}];
 if(!space)limitations.push({zh:'原图精确空间未知；保持独立原生网格，无图谱叠加。',en:'Exact source space is unknown; retain the independent native grid without atlas overlay.'});
 const record={upstream:structuredClone(candidate),sourceAsset:identity,sourceSpaceId:space,sourceGrid:sourceGrid(m.sourceGrid),sourceRights:sourceRights(m.rights),derivedAsset:null,transformRef:null,limitations};
 if(space&&m.derivation){
  try{
   const d=m.derivation,same=(a,b)=>JSON.stringify(validateAssetIdentity(a))===JSON.stringify(validateAssetIdentity(b));
   const target=validateAssetIdentity(d.targetAsset),derived=validateAssetIdentity(d.derivedAsset),manifest=makeComputationManifest(d.manifest);
   if(!same(d.sourceAsset,identity)||!same(manifest.inputs[0],identity)||!same(manifest.inputs[1],target)||derived.spaceId!==target.spaceId||!target.spaceId||manifest.targetGrid.space!==target.spaceId||manifest.sourceGrids[0].space!==space||JSON.stringify(manifest.sourceGrids[0].shape)!==JSON.stringify(m.sourceGrid.shape)||JSON.stringify(manifest.sourceGrids[0].affine)!==JSON.stringify(m.sourceGrid.affine.flat()))throw fail('derivation-endpoint-mismatch');
   if(!same(d.receipt?.identity,derived)||d.receipt.identityVerification!=='received-bytes')throw fail('derivation-receipt-required');
   const authority=Object.values(assetRegistry?.assets||{}).find(row=>same(row.identity,derived));
   if(assetRegistry?.schema!=='neuroatlas-asset-identities-v1'||!authority||!authority.sourceIdentities?.some(row=>same(row,identity))||!authority.sourceIdentities?.some(row=>same(row,target)))throw fail('derivation-authority-required');
   let outputGrid;try{outputGrid=validateGridSpec(authority.sourceGrid);}catch{throw fail('derivation-output-grid-required');}
   if(JSON.stringify(outputGrid)!==JSON.stringify(manifest.targetGrid))throw fail('derivation-output-grid-mismatch');
   if(!Array.isArray(d.transforms)||!d.transforms.length||JSON.stringify(authority.transforms)!==JSON.stringify(manifest.transforms)||d.transforms.length!==manifest.transforms.length)throw fail('derivation-chain-mismatch');
   let endpoint=identity;
   for(let i=0;i<d.transforms.length;i++){
    const transform=d.transforms[i],validated=validateTransformIdentity(transform),expected=manifest.transforms[i];
    if(JSON.stringify(validated)!==JSON.stringify(expected)||transform.version!==`sha256:${validated.sha256}`||!same(transform.sourceAsset,endpoint)||!authority.verificationFiles?.some(file=>file.sha256===validated.sha256&&(file.path===validated.id||`public/data/${file.path}`===validated.id)))throw fail('derivation-transform-evidence-mismatch');
    endpoint=validateAssetIdentity(transform.targetAsset);
   }
   if(!same(endpoint,target)||!Array.isArray(d.limitations)||!d.limitations.length||!d.limitations.every(row=>typeof row.zh==='string'&&typeof row.en==='string')||!d.error||(d.error.kind==='unknown'?typeof d.error.reason!=='string'||!d.error.reason.trim():!Number.isFinite(d.error.value)||d.error.value<0||!d.error.unit))throw fail('derivation-error-limitations-required');
   record.derivedAsset=derived;record.transformRef=d.transforms.map(row=>row.id).join(' -> ');
   record.derivation={...structuredClone(d),manifest};record.limitations.push(...structuredClone(d.limitations));
  }catch(error){if(error.code?.startsWith('derivation-'))throw error;throw fail('derivation-invalid');}
 }
 return record;
}

import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./statmap-source.js').catch(()=>({}));
const doi='10.7554/elife.61679';
const page=(results,next=null,count=results.length)=>({results,next,count});
const collection=(id,DOI=doi)=>({id,DOI,modify_date:'2026-10-29'});
const image=(id,collection=1)=>({id,collection:`https://neurovault.org/api/collections/${collection}/`,target_template_image:'GenericMNI',image_type:'statistic_map',map_type:'T map',is_thresholded:false});
const response=data=>({ok:true,json:async()=>data});
const mock=routes=>async url=>{assert.ok(routes[String(url)],String(url));return response(routes[String(url)]);};
const first=`https://neurovault.org/api/collections/?DOI=${encodeURIComponent(doi)}`;

test('exact DOI, multiple collections and images remain candidates',async()=>{
 assert.equal(typeof api.lookupStatMapsByDOI,'function');
 const rows=await api.lookupStatMapsByDOI('https://doi.org/10.7554/eLife.61679',{fetcher:mock({[first]:page([collection(1),collection(2),collection(9,'10.1/unrelated')]),'https://neurovault.org/api/collections/1/images/':page([image(11)]),'https://neurovault.org/api/collections/2/images/':page([image(22,2)])})});
 assert.deepEqual(rows.map(row=>row.imageId),[11,22]);
 assert.ok(rows.every(row=>row.status==='candidate'&&row.asset===null&&row.sourceSpaceId===null));
});
test('a completed exact search can report empty; ignored filtering cannot',async()=>{
 assert.deepEqual(await api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([])})}),[]);
 await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([collection(9,'10.1/unrelated')])})}),/doi-filter-integrity/);
});
test('incomplete pagination never publishes partial candidates',async()=>{
 await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([collection(1)],'https://neurovault.org/api/collections/?page=2') }),maxPages:1}),/pagination-budget/);
});
test('official http next is upgraded; loops and foreign paths are rejected',async()=>{
 const next='https://neurovault.org/api/collections/?DOI=x&page=2';
 assert.deepEqual(await api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([],next.replace('https:','http:'),0),[next]:page([])})}),[]);
 for(const next of [first,'https://evil.example/api/collections/','https://neurovault.org/media/images/x'])await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([],next)})}),/pagination-(loop|url)/);
});
test('abort, network errors, invalid counts and mismatched collection images reject',async()=>{
 const controller=new AbortController();
 await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{signal:controller.signal,fetcher:async()=>{controller.abort();return response(page([collection(1)]));}}),{name:'AbortError'});
 await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{fetcher:async()=>{throw Error('offline');}}),/network-error/);
 await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([],null,100)})}),/incomplete-response/);
 await assert.rejects(()=>api.lookupStatMapsByDOI(doi,{fetcher:mock({[first]:page([collection(1)]),'https://neurovault.org/api/collections/1/images/':page([image(11,2)])})}),/image-collection-mismatch/);
});
const candidate={provider:'NeuroVault',collectionId:1,imageId:11,paperDOI:doi,sourceURL:'https://neurovault.org/images/11/',retrievedAt:'2026-10-29T00:00:00Z',upstreamVersion:'2026-10-29',asset:null,sourceSpaceId:null,status:'candidate',rights:{license:'unknown'}};
const downloaded={provider:'NeuroVault',collectionId:1,imageId:11,upstreamVersion:'2026-10-29',sourceAsset:{id:'nv11',version:'bytes-v1',sha256:'a'.repeat(64),spaceId:null},sourceGrid:{shape:[2,2,2],voxelSize:[1,1,1],affine:[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],axisConvention:'RAS+'},rights:{license:'CC0-1.0'}};
test('upstream identity never establishes unknown space',()=>{
 const asset=api.resolveStatMapAsset(candidate,{...downloaded,derivedAsset:{id:'pretend',version:'1',sha256:'b'.repeat(64),spaceId:'MNI152NLin6Asym'}});
 assert.equal(asset.sourceSpaceId,null);assert.equal(asset.sourceAsset.spaceId,null);assert.equal(asset.derivedAsset,null);assert.equal(asset.transformRef,null);
 assert.deepEqual(asset.sourceGrid,downloaded.sourceGrid);
});
test('download identity and original grid must bind the exact upstream version',()=>{
 assert.throws(()=>api.resolveStatMapAsset(candidate,{...downloaded,imageId:12}),/upstream-identity-mismatch/);
 assert.throws(()=>api.resolveStatMapAsset(candidate,{...downloaded,upstreamVersion:'old'}),/upstream-identity-mismatch/);
 assert.throws(()=>api.resolveStatMapAsset(candidate,{...downloaded,sourceGrid:{...downloaded.sourceGrid,affine:[]}}),/source-grid-required/);
 assert.throws(()=>api.resolveStatMapAsset({...candidate,asset:{...downloaded.sourceAsset,sha256:'b'.repeat(64)}},downloaded),/source-asset-mismatch/);
});
test('verified derivation records retain distinct identities and ordered versioned S5 transform evidence',()=>{
 const source={...downloaded.sourceAsset,spaceId:'MNI152NLin2009cAsym'},target={id:'target',version:'v2',sha256:'b'.repeat(64),spaceId:'MNI152NLin6Asym'},derived={id:'derived',version:'sha256:'+'c'.repeat(64),sha256:'c'.repeat(64),spaceId:target.spaceId};
 const transform={id:'fixture-warp',version:'sha256:'+'d'.repeat(64),sha256:'d'.repeat(64),sourceAsset:source,targetAsset:target};
 const grid=space=>({shape:[2,2,2],affine:downloaded.sourceGrid.affine.flat(),space,order:'x-fastest'});
 const manifest={appVersion:'4.1.0',algorithmVersion:'fixture-only',inputs:[source,target],transforms:[{id:transform.id,sha256:transform.sha256}],sourceGrids:[grid(source.spaceId),grid(target.spaceId)],targetGrid:grid(target.spaceId),interpolation:['trilinear','nearest-neighbour'],thresholds:[{kind:'statistic',threshold:0,tail:'positive'},{kind:'label',threshold:0,tail:'positive'}],labelSets:[[],[1]]};
 const derivation={sourceAsset:source,targetAsset:target,derivedAsset:derived,manifest,transforms:[transform],receipt:{identity:derived,identityVerification:'received-bytes'},error:{kind:'unknown',reason:'Fixture does not validate anatomical accuracy'},limitations:[{zh:'仅验证记录契约。',en:'Record contract fixture only.'}]};
 const known={...candidate,sourceSpaceId:source.spaceId},m={...downloaded,sourceAsset:source,derivation};
 const authority={schema:'neuroatlas-asset-identities-v1',assets:{fixture:{identity:derived,sourceIdentities:[source,target],transforms:manifest.transforms,verificationFiles:[{path:transform.id,sha256:transform.sha256}]}}};
 const resolved=api.resolveStatMapAsset(known,m,{assetRegistry:authority});
 assert.deepEqual(resolved.derivedAsset,derived);assert.notDeepEqual(resolved.sourceAsset,resolved.derivedAsset);
 assert.equal(resolved.transformRef,transform.id);assert.deepEqual(resolved.derivation.transforms,[transform]);assert.deepEqual(resolved.derivation.manifest.transforms,manifest.transforms);
 for(const mutate of [x=>x.derivation.sourceAsset.sha256='e'.repeat(64),x=>x.derivation.targetAsset.version='changed',x=>x.derivation.transforms[0].version='changed',x=>x.derivation.manifest.transforms.reverse().push({id:'extra',sha256:'f'.repeat(64)}),x=>delete x.derivation.error,x=>x.derivation.receipt.identity.sha256='f'.repeat(64)]){
  const bad=structuredClone(m);mutate(bad);assert.throws(()=>api.resolveStatMapAsset(known,bad,{assetRegistry:authority}),/derivation-/);
 }
 assert.throws(()=>api.resolveStatMapAsset(known,m),/derivation-authority/);
});

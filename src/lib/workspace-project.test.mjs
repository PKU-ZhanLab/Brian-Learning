import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeView,decodeView,validateViewState,validateCamera,serializeProject,prepareProjectPayload,parseProject,assertProjectVolumePayloadSize,validateProjectDrafts} from './workspace-project.js';
import {MAX_NIFTI_FILE_BYTES} from './nifti.js';
test('paper and recorded-result method filters survive separately with a legacy paper fallback',async()=>{
  const literature={paperModality:'fMRI',resultModality:'MEG',modality:'EEG',query:'local search'};
  for(const restored of [validateViewState({literature}),decodeView(encodeView({literature}).encoded),(await parseProject(await serializeProject({view:{literature},volumes:[]}))).view]){
    assert.equal(restored.literature.paperModality,'fMRI');
    assert.equal(restored.literature.resultModality,'MEG');
    assert.equal(restored.literature.modality,'fMRI');
  }
  const legacy=validateViewState({literature:{modality:'MEG'}}).literature;
  assert.equal(legacy.modality,'MEG');assert.equal(legacy.paperModality,'MEG');assert.equal(legacy.resultModality,'');
  const invalid=validateViewState({literature:{paperModality:{invalid:true},resultModality:['MEG']}}).literature;
  assert.equal(invalid.paperModality,'');assert.equal(invalid.resultModality,'');
  const bounded=validateViewState({literature:{paperModality:'x'.repeat(101),resultModality:'y'.repeat(101)}}).literature;
  assert.equal(bounded.paperModality.length,100);assert.equal(bounded.resultModality.length,100);
});
test('public link preserves camera opacity ROI and filters without custom data',()=>{const state={atlas:'jhu',language:'en',opacity:.12,camera:{position:[1,2,3],target:[0,0,0],zoom:2},roi:{aAtlas:'dk',bAtlas:'jhu',aLabels:[1,2],bLabels:[5],display:{opacityA:0},computed:true},literature:{modality:'meg',query:'private note'},atlasExplorer:{atlas:'dk',selected:[2,3]}};const restored=decodeView(encodeView(state).encoded);assert.deepEqual(restored.camera,state.camera);assert.equal(restored.opacity,.12);assert.equal(restored.roi.display.opacityA,0);assert.deepEqual(restored.roi.aLabels,[1,2]);assert.equal(restored.literature.modality,'meg');assert.equal(restored.literature.query,'');});
test('custom volumes are omitted from links and malformed input rejected',()=>{const v=encodeView({atlas:'custom-a',roi:{aAtlas:'custom-a'},mode:'roi'});assert.deepEqual(v.omitted,['atlas','ROI']);assert.equal(decodeView(v.encoded).atlas,'dk');assert.throws(()=>decodeView('!!'));assert.equal(validateViewState({camera:{position:[NaN,0,0]}}).camera,null);});
test('project round trip preserves binary data, notes, and user-declared frame',async()=>{const volume={id:'custom-example',data:new Uint16Array([0,1,3,4]),shape:[2,2,1],affine:[-2,0,0,12,0,2,0,-8,0,0,2,2,0,0,0,1],space:'MNI152NLin6Asym',kind:'label',name:'my labels',provenance:'My registered FSL image',metadata:{affineConflict:true},alignmentStatus:'user-declared',canOverlayOnTarget:true,labels:[{id:3,name:'three'}]};const value=await parseProject(await serializeProject({view:{atlas:'dk'},notes:[{text:'keep my note'}],volumes:[volume]}));assert.deepEqual([...value.volumes[0].data],[0,1,3,4]);assert.deepEqual(value.volumes[0].affine,volume.affine);assert.equal(value.volumes[0].canOverlayOnTarget,true);assert.equal(value.notes[0].text,'keep my note');assert.equal(value.volumes[0].labels[0].name,'three');assert.equal(value.volumes[0].metadata.sourceImport.affineConflict,true);});

const fixture=()=>({id:'custom-fixture',data:Uint8Array.of(0,1,1,0),shape:[2,2,1],affine:[2,0,0,0,0,2,0,0,0,0,2,0,0,0,0,1],kind:'mask',space:'MNI152NLin6Asym',name:'Fixture',source:'original.nii.gz',provenance:'Source DOI/example; aligned by pipeline',alignmentStatus:'user-declared',canOverlayOnTarget:true,labels:[{id:1,name:'Mask',zh:'掩膜'}],metadata:{affineConflict:true,qformCode:1,sformCode:4,originalSpatialUnits:1,description:'original header',geometryDoesNotVerifySpace:true}});

test('v2 codec retains project ownership, precise atlas selection, region notes and drafts; v1 remains missing-provenance',async()=>{
 const regionRef={atlasId:'dk',atlasVersion:'v1',labelId:1,hemisphere:'L',spaceId:'MNI152NLin6Asym'};
 const draft={id:'draft',projectId:'project-A',kind:'result',recordId:null,payload:{finding:'unsaved'},updatedAt:'2026-10-29T01:00:00Z'};
 const input={projectId:'project-A',view:{atlasSelection:[regionRef],unresolvedAtlasSelection:[],atlasSelectionQuery:{atlasId:'dk',atlasVersion:'v1',coordinate:[1,2,3],method:'voxel',requestId:1},resultLayers:[],roi:{aRegionRefs:[regionRef],bRegionRefs:[]}},notes:[{id:'note',text:'precise note',regionRef,queryContext:{atlasId:'dk',atlasVersion:'v1',coordinate:[1,2,3],method:'voxel',requestId:1}}],drafts:[draft],volumes:[]};
 const text=await serializeProject(input),raw=JSON.parse(text);assert.equal(raw.schema,'neuroatlas-project-v2');assert.equal(raw.projectId,'project-A');
 const restored=await parseProject(text);assert.deepEqual(restored.view.atlasSelection,[regionRef]);assert.deepEqual(restored.view.roi.aRegionRefs,[regionRef]);assert.deepEqual(restored.notes[0].regionRef,regionRef);assert.deepEqual(restored.notes[0].queryContext,input.notes[0].queryContext);assert.deepEqual(restored.drafts,[draft]);
 const legacy=await parseProject(JSON.stringify({...raw,schema:'neuroatlas-project-v1',projectId:undefined,drafts:undefined}));assert.deepEqual(legacy.drafts,[]);assert.equal(legacy.provenanceStatus,'missing-provenance');
});

test('new private result layers and custom atlas identities never enter view links',()=>{
 const privateRef={atlasId:'custom-private',atlasVersion:'private-version',labelId:1,hemisphere:'L',spaceId:'private-space'};
 const link=encodeView({atlasSelection:[privateRef],unresolvedAtlasSelection:[privateRef],atlasSelectionQuery:{atlasId:'custom-private',coordinate:[1,2,3]},resultLayers:[{layerId:'private-layer',resultId:'private-result',coordinateIds:['private-coordinate'],sourceReferenceId:'private-paper',spaceId:'private-space',visible:true,style:{}}]});
 const restored=JSON.stringify(decodeView(link.encoded));assert.ok(!restored.includes('private-'));assert.ok(!restored.includes('custom-private'));
});

test('built-in ROI source IDs do not authorize private identities in any nested region collection',()=>{
 const builtin={atlasId:'dk',atlasVersion:'public-version',labelId:1,hemisphere:'L',spaceId:'MNI152NLin6Asym'},privateRef={atlasId:'custom-private',atlasVersion:'private-version',labelId:2,hemisphere:'R',spaceId:'private-space'};
 const input={atlasSelection:[builtin,privateRef],unresolvedAtlasSelection:[privateRef,builtin],roi:{aAtlas:'dk',bAtlas:'jhu',aRegionRefs:[privateRef,builtin],bRegionRefs:[builtin,privateRef],unresolvedRegionRefs:[privateRef,builtin]}};
 const before=structuredClone(input),link=encodeView(input),restored=decodeView(link.encoded);
 for(const key of ['aRegionRefs','bRegionRefs','unresolvedRegionRefs']){assert.deepEqual(restored.roi[key],[builtin]);assert.ok(link.omitted.includes(`roi.${key}`));}
 assert.deepEqual(restored.atlasSelection,[builtin]);assert.deepEqual(restored.unresolvedAtlasSelection,[builtin]);assert.equal(restored.roi.aAtlas,'dk');assert.equal(restored.roi.bAtlas,'jhu');assert.ok(!JSON.stringify(restored).includes('private'));assert.deepEqual(input,before);
});

test('draft admission uses exact UTF-8 payload/collection bounds and project ownership',()=>{
 const draft={id:'d',projectId:'A',kind:'result',recordId:null,payload:{text:'x'.repeat(49989)},updatedAt:'2026-10-29T00:00:00Z'};
 assert.equal(new TextEncoder().encode(JSON.stringify(draft.payload)).length,50000);assert.equal(validateProjectDrafts([draft],'A').length,1);
 assert.throws(()=>validateProjectDrafts([{...draft,payload:{text:draft.payload.text+'x'}}],'A'),/draft-payload-budget/);
 assert.throws(()=>validateProjectDrafts([{...draft,projectId:'B'}],'A'),/invalid-draft/);
 assert.throws(()=>validateProjectDrafts(Array.from({length:31},(_,i)=>({...draft,id:`d${i}`,payload:{}})),'A'),/draft-count/);
 assert.throws(()=>validateProjectDrafts(Array.from({length:30},(_,i)=>({...draft,id:`d${i}`})),'A'),/draft-json-budget/);
});

test('optional camera extent and up restore while legacy snapshots remain unchanged',()=>{
  const legacy={position:[1,2,3],target:[0,0,0],zoom:2};
  assert.deepEqual(validateCamera(legacy),legacy);
  const current={...legacy,frameExtent:157.25,up:[0,1,0]};
  assert.deepEqual(decodeView(encodeView({camera:current}).encoded).camera,current);
  assert.equal(validateCamera({...current,frameExtent:-1}),null);
  assert.equal(validateCamera({...current,up:[0,0,0]}),null);
  assert.equal(validateCamera({...current,up:[0,Infinity,0]}),null);
});

test('links keep only explicitly public reference IDs and strip every free-text query',()=>{
  const input={literature:{paperId:'private-without-local-prefix',query:'private patient note',compared:['public-paper','secret-file','local-looking-public'],showCompare:true},atlasExplorer:{atlas:'dk',query:'confidential lookup',selected:[1]}};
  const shared=encodeView(input,{publicReferenceIds:new Set(['public-paper','local-looking-public'])});
  const restored=decodeView(shared.encoded);
  assert.equal(restored.literature.paperId,null);assert.equal(restored.literature.query,'');assert.equal(restored.atlasExplorer.query,'');
  assert.deepEqual(restored.literature.compared,['public-paper','local-looking-public']);assert.equal(restored.literature.showCompare,true);assert.ok(shared.omitted.includes('literature'));
  const defaultPrivate=decodeView(encodeView(input).encoded);
  assert.deepEqual(defaultPrivate.literature.compared,[]);assert.equal(defaultPrivate.literature.showCompare,false);
  assert.equal(decodeView(encodeView({literature:{paperId:'public-paper'}},{publicReferenceIds:['public-paper']}).encoded).literature.paperId,'public-paper');
});

test('project files retain local queries and full provenance without sending them to links',async()=>{
  const project=await parseProject(await serializeProject({view:{literature:{query:'local note'},atlasExplorer:{query:'local label'}},volumes:[fixture()]}));
  assert.equal(project.view.literature.query,'local note');assert.equal(project.view.atlasExplorer.query,'local label');
  assert.equal(project.volumes[0].source,'original.nii.gz');assert.equal(project.volumes[0].provenance,fixture().provenance);assert.equal(project.volumes[0].kind,'mask');assert.equal(project.volumes[0].canOverlayOnTarget,true);
});

test('malformed label and display metadata fail before a restored volume reaches React',async()=>{
  const text=await serializeProject({view:{},volumes:[fixture()]});
  const changes=[
    metadata=>{metadata.labels[0].name={unsafe:'object'};},
    metadata=>{metadata.labels[0].zh=['not text'];},
    metadata=>{metadata.labels.push({...metadata.labels[0]});},
    metadata=>{metadata.labels[0].id=-1;},
    metadata=>{metadata.source={url:'https://example.org'};},
    metadata=>{metadata.provenance={statement:'not text'};},
    metadata=>{metadata.note={text:'not text'};},
    metadata=>{metadata.license=[];},
    metadata=>{metadata.limitations=[{text:'not text'}];},
    metadata=>{metadata.canOverlayOnTarget='true';},
    metadata=>{metadata.metadata.affineConflict='true';},
    metadata=>{metadata.kind='arbitrary';},
  ];
  for(const change of changes){const p=JSON.parse(text);change(p.volumes[0].metadata);await assert.rejects(parseProject(JSON.stringify(p)),/Invalid/);}
  await assert.rejects(parseProject('null'),/Unsupported project/);
});

test('unknown metadata is not restored or allowed to override geometry and capabilities',async()=>{
  const project=JSON.parse(await serializeProject({view:{},volumes:[fixture()]}));
  Object.assign(project.volumes[0].metadata,{affine:new Array(16).fill(0),shape:[99,99,99],sampleRAS:'malicious function text',probabilityData:{},unexpectedPrivateBlob:'not a supported field'});
  project.volumes[0].metadata.labels[0].unsafeHtml='<script>no</script>';
  project.volumes[0].metadata.metadata.arbitraryNested={secret:'do not propagate'};
  const restored=(await parseProject(JSON.stringify(project))).volumes[0];
  assert.deepEqual(restored.shape,[2,2,1]);assert.deepEqual(restored.affine,fixture().affine);assert.equal(restored.sampleRAS,undefined);assert.equal(restored.probabilityData,undefined);assert.equal(restored.unexpectedPrivateBlob,undefined);assert.equal(restored.labels[0].unsafeHtml,undefined);assert.equal(restored.metadata.sourceImport.arbitraryNested,undefined);
});

test('original NIfTI warning survives repeated saves without nesting header history',async()=>{
  let volumes=[fixture()];
  for(let i=0;i<4;i++)volumes=(await parseProject(await serializeProject({view:{},volumes}))).volumes;
  const metadata=volumes[0].metadata;
  assert.equal(metadata.affineConflict,true);assert.equal(metadata.sourceImport.affineConflict,true);assert.equal(metadata.sourceImport.qformCode,1);assert.equal(metadata.sourceImport.originalSpatialUnits,1);assert.equal(metadata.sourceImport.sourceImport,undefined);assert.equal(metadata.userDeclaredAligned,true);
});

test('project eligibility never grants overlay to missing evidence or another template',async()=>{
  for(const patch of [{provenance:''},{space:'MNI152NLin2009cAsym'},{alignmentStatus:'unverified'},{canOverlayOnTarget:false}]){
    const result=(await parseProject(await serializeProject({view:{},volumes:[{...fixture(),...patch}]}))).volumes[0];
    assert.equal(result.canOverlayOnTarget,false);assert.equal(result.alignmentStatus,'unverified');assert.equal(result.metadata.userDeclaredAligned,false);
  }
});

test('export payload bound matches the NIfTI import limit',()=>{
  assert.doesNotThrow(()=>assertProjectVolumePayloadSize(MAX_NIFTI_FILE_BYTES));
  for(const size of [MAX_NIFTI_FILE_BYTES+1,-1,NaN,Infinity])assert.throws(()=>assertProjectVolumePayloadSize(size),/128 MiB/);
});

test('aggregate capacity is export symmetric',async()=>{
  const volume={...fixture(),labels:[{id:1,name:'x'.repeat(2000),zh:'中'.repeat(2000)}]};
  const accepted=await prepareProjectPayload({view:{},volumes:[volume]});
  assert.equal(accepted.usage.rawPayloadBytes,356);assert.equal(accepted.usage.assetCount,1);
  assert.equal(accepted.usage.projectUtf8Bytes,new TextEncoder().encode(accepted.text).length);
  assert.deepEqual(accepted.usage.compressedAssetBytes,[accepted.encodedAssets[0].compressedBytes]);
  const restored=await parseProject(accepted.text);
  assert.deepEqual(restored.volumes[0].labels,volume.labels);
  assert.deepEqual((await parseProject(await serializeProject(restored))).volumes[0].labels,volume.labels);
  await assert.rejects(prepareProjectPayload({view:{},volumes:[{...volume,labels:[{id:1,name:'x'.repeat(2001)}]}]}),/label-name-too-long/);
  // Virtual byte descriptors must be rejected before exportNifti reads data or creates a large array.
  const virtual={...fixture(),data:{byteLength:256*1024*1024-351,length:1}};
  await assert.rejects(prepareProjectPayload({view:{},volumes:[virtual]}),/decoded-budget/);
  await assert.rejects(prepareProjectPayload({view:{},volumes:Array.from({length:51},(_,i)=>({...fixture(),id:`custom-${i}`}))}),/asset-count/);
});

test('project preparation and restoration share every voxel value domain',async()=>{
  const cases=[
    ['mask',Uint8Array.of(2),/nifti-not-binary/],
    ['label',Float64Array.of(.5),/nifti-invalid-labels/],
    ['labels',Float64Array.of(-1),/nifti-invalid-labels/],
    ['probability',Float64Array.of(-.1),/nifti-probability-range/],
    ['prob',Float64Array.of(1.1),/nifti-probability-range/],
    ['statistic',Float64Array.of(1e31),/nifti-nonfinite-data/],
  ];
  for(const [kind,data,error] of cases){
    const volume={...fixture(),shape:[1,1,1],kind,data},before=structuredClone(volume);
    await assert.rejects(prepareProjectPayload({view:{},volumes:[volume]}),error);assert.deepEqual(volume,before);
  }
  for(const [kind,values] of [['mask',[0,1]],['labels',[0,2]],['prob',[0,1]],['stat',[-1e30,1e30]]]){
    const volume={...fixture(),shape:[2,1,1],kind,data:Float64Array.from(values)};
    const restored=await parseProject((await prepareProjectPayload({view:{},volumes:[volume]})).text);
    assert.deepEqual([...restored.volumes[0].data],values);
  }
});

test('oversized notes and evidence reject before complete aggregate serialization',async t=>{
  const original=JSON.stringify,text='x'.repeat(100000);
  for(const [limit,input] of [[8*1024*1024,{notes:Array.from({length:84},(_,i)=>({id:`note-${i}`,text}))}],[20*1024*1024,{evidence:{items:Array(210).fill(text)}}]]){
    await t.test(input.notes?'notes':'evidence',async()=>{
    let oversizedAllocations=0;
    JSON.stringify=function(...args){const result=original.apply(this,args);if(result?.length>limit)oversizedAllocations++;return result;};
    try{await assert.rejects(prepareProjectPayload({view:{},...input}),/too large/);assert.equal(oversizedAllocations,0);}
    finally{JSON.stringify=original;}
    });
  }
});

test('normalized note JSON includes exact punctuation at its inclusive budget',async()=>{
  const limit=8*1024*1024,notes=[];let bytes=2;
  while(bytes<limit){
    const note={id:`n${notes.length}`,text:'',structureId:'',structureName:'',createdAt:'2026-10-29T00:00:00.000Z',position:null,coordinateSpace:'',coordinateFrame:''};
    const comma=notes.length?1:0,overhead=JSON.stringify(note).length+comma;
    const textLength=Math.min(100000,limit-bytes-overhead);assert.ok(textLength>0);
    note.text='x'.repeat(textLength);bytes+=overhead+textLength;notes.push(note);
  }
  const prepared=await prepareProjectPayload({view:{},notes});
  assert.equal(new TextEncoder().encode(JSON.stringify(JSON.parse(prepared.text).notes)).length,limit);
  notes.at(-1).text+='x';await assert.rejects(prepareProjectPayload({view:{},notes}),/too large/);
});

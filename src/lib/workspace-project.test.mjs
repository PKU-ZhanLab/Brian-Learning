import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeView,decodeView,validateViewState,validateCamera,serializeProject,prepareProjectPayload,parseProject,assertProjectVolumePayloadSize,validateProjectDrafts} from './workspace-project.js';
import {MAX_NIFTI_FILE_BYTES} from './nifti.js';
import {migrateEvidence} from './evidence-schema.js';
import {resolveResultLayers} from './result-layers.js';
import {coordinateNavigationSpace,coordinateReferenceSpace,formatCoordinate,nextCoordinateOrigin} from './coordinate-input.js';

const syntheticEvidence=()=>migrateEvidence({schema:'brain-evidence-v1',references:[{id:'public-paper',title:'Synthetic public paper',url:'https://example.org/paper'}],results:[{id:'public-result',referenceId:'public-paper',finding:'Synthetic coordinates',condition:'task',sample:'n=2',roiDefinition:'table',direction:'positive',annotator:'unknown',modalities:['fmri'],regionIds:[],sourceUrl:'https://example.org/paper',curationStatus:'draft',limitations:'synthetic',coordinates:[[1,2,3],[-1,2,3]].map((xyz,i)=>({id:`public-point-${i}`,x:xyz[0],y:xyz[1],z:xyz[2],space:'MNI152NLin6Asym',status:'source-checked',label:'peak',sourceTable:'1',sourceRow:String(i+1),frameNote:'synthetic frame',sourceUrl:'https://example.org/paper'})),figures:[]}],relations:[]}).value;

test('coordinate context survives named and project views, including explicit unknown and native spaces',async()=>{
  assert.equal(validateViewState({}).coordinateSpace,'brain');
  for(const coordinateSpace of [null,'unknown','Colin27 / MNI single-subject','private patient reference']) {
    const input={coordinateSpace,coordinate:[12345.25,-200.5,54.1],slices:{x:12345.25,y:-200.5,z:54.1},atlasExplorer:{slicePoint:[12345.25,-200.5,54.1]}};
    for(const restored of [validateViewState(input),(await parseProject(await serializeProject({view:input,volumes:[]}))).view]){
      assert.equal(restored.coordinateSpace,coordinateSpace);assert.deepEqual(restored.coordinate,input.coordinate);
      assert.equal(restored.slices.x,12345.25);assert.equal(restored.slices.y,-200.5);assert.deepEqual(restored.atlasExplorer.slicePoint,input.coordinate);
    }
  }
});
test('reserved-looking raw source labels remain distinct in named/project display and copy',async()=>{
  for(const rawSpace of ['brain','independent:brain','independent:independent:brain','pam50','schematic','PAM50 native straightened']){
    const input={coordinateSpace:coordinateNavigationSpace(rawSpace),coordinate:[10.25,20.5,30.75]};
    for(const restored of [validateViewState(input),(await parseProject(await serializeProject({view:input,volumes:[]}))).view]){
      assert.notEqual(restored.coordinateSpace,'brain');assert.equal(coordinateReferenceSpace(restored.coordinateSpace),rawSpace);
      assert.equal(formatCoordinate(restored.coordinate,coordinateReferenceSpace(restored.coordinateSpace)),`${rawSpace} · RAS · 10.25, 20.5, 30.75 mm`);
    }
  }
});
test('X1-R1 imported explorer coordinates stay private after manual main input and main reset',async()=>{
  const explorer=validateViewState({atlasExplorer:{atlas:'aal3',slicePoint:[111.25,222.5,333.75],camera:{position:[901,902,903],target:[801,802,803],zoom:1}}}).atlasExplorer;
  const imported=await parseProject(await serializeProject({view:{atlasExplorer:explorer,coordinateOrigin:{kind:'manual',imported:false,cameraSensitive:false,explorerSensitive:false}},volumes:[]}));
  assert.equal(imported.view.coordinateOrigin.explorerSensitive,true);
  const manual=nextCoordinateOrigin(imported.view.coordinateOrigin,{kind:'manual',imported:false});
  const reset={...imported.view,coordinate:[10,20,30],slices:{x:10,y:20,z:30},coordinateOrigin:{...manual,cameraSensitive:false}};
  const shared=encodeView(reset),publicView=decodeView(shared.encoded);
  assert.deepEqual(publicView.coordinate,[10,20,30]);assert.ok(shared.omitted.includes('atlasExplorer.location'));
  assert.deepEqual(publicView.atlasExplorer.slicePoint,[0,0,0]);assert.equal(publicView.atlasExplorer.camera,null);
  for(const value of ['111.25','222.5','333.75','901','902','903','801','802','803'])assert.equal(JSON.stringify(publicView).includes(value),false,value);
  assert.deepEqual(reset.atlasExplorer,explorer); // Projection preserves the visible private context.
  for(const restored of [validateViewState(reset),(await parseProject(await serializeProject({view:reset,volumes:[]}))).view])assert.deepEqual(restored.atlasExplorer,explorer);
  const legacy=validateViewState({...reset,coordinateOrigin:{kind:'manual',cameraSensitive:false,imported:false}});
  assert.ok(encodeView(legacy).omitted.includes('atlasExplorer.location'));
});
test('public projection resets coupled independent coordinates and reports omission without leaking private context',()=>{
  const input={coordinateSpace:'private patient reference',coordinate:[12345.25,-200.5,54.1],slices:{enabled:true,x:12345.25,y:-200.5,z:54.1},camera:{position:[901,902,903],target:[801,802,803]},atlasExplorer:{atlas:'aal3',slicePoint:[12345.25,-200.5,54.1],camera:{position:[901,902,903],target:[801,802,803]}},atlasSelectionQuery:{coordinate:[12345.25,-200.5,54.1]}};
  const shared=encodeView(input),restored=decodeView(shared.encoded);
  assert.ok(shared.omitted.includes('coordinate'));assert.equal(restored.coordinateSpace,'brain');assert.deepEqual(restored.coordinate,[-38,-20,54]);
  assert.deepEqual(restored.slices,{enabled:false,x:-38,y:-20,z:54,axis:'z'});assert.equal(restored.camera,null);assert.equal(restored.atlasSelectionQuery,undefined);
  assert.deepEqual(restored.atlasExplorer.slicePoint,[0,0,0]);assert.equal(restored.atlasExplorer.camera,null);
  const text=JSON.stringify(restored);for(const privateText of ['private patient reference','12345.25','-200.5','901','801'])assert.equal(text.includes(privateText),false,privateText);
  for(const coordinateSpace of [null,'unknown'])assert.ok(encodeView({...input,coordinateSpace}).omitted.includes('coordinate'));
});
test('same-template private and unknown coordinate origins cannot leak after layer removal or restore',async()=>{
  for(const coordinateOrigin of [undefined,{kind:'unknown'},{kind:'private',cameraSensitive:true},{kind:'public',public:true},{kind:'result',resultId:'private-result',sourceReferenceId:'private-paper',coordinateId:'private-point',spaceId:'MNI152NLin6Asym',cameraSensitive:true}]){
    const input={coordinateSpace:'brain',coordinate:[1.25,2.5,3.75],slices:{enabled:true,x:1.25,y:2.5,z:3.75},camera:{position:[901,902,903],target:[1.25,2.5,3.75]},resultLayers:[],...(coordinateOrigin?{coordinateOrigin}:{})};
    const named=validateViewState(input),project=(await parseProject(await serializeProject({view:input,volumes:[]}))).view;
    for(const state of [input,named,project]){
      const shared=encodeView(state),view=decodeView(shared.encoded);assert.ok(shared.omitted.includes('coordinate'));assert.deepEqual(view.coordinate,[-38,-20,54]);assert.equal(view.slices.x,-38);assert.equal(view.camera,null);
      const text=JSON.stringify(view);for(const secret of ['private-result','private-paper','private-point','1.25','2.5','3.75','901'])assert.equal(text.includes(secret),false,secret);
    }
  }
});
test('canonical public result identity authorizes only its exact coordinates; local edits and publication flags cannot',()=>{
  const publicEvidence=syntheticEvidence(),coordinateOrigin={kind:'result',resultId:'public-result',sourceReferenceId:'public-paper',coordinateId:'public-point-0',spaceId:'MNI152NLin6Asym',cameraSensitive:true};
  const input={coordinateSpace:'brain',coordinate:[1,2,3],slices:{x:1,y:2,z:3},coordinateOrigin,resultLayers:[]},options={publicReferenceIds:['public-paper'],publicEvidence};
  const shared=encodeView(input,options);assert.deepEqual(decodeView(shared.encoded).coordinate,[1,2,3]);assert.ok(!shared.omitted.includes('coordinate'));
  const local=structuredClone(publicEvidence);local.results[0].finding='Private reanalysis';local.results[0].public=true;
  assert.ok(encodeView(input,{...options,evidence:local}).omitted.includes('coordinate'));
  assert.ok(encodeView({...input,coordinate:[1.01,2,3]},options).omitted.includes('coordinate'));
  const mismatchedSlices=decodeView(encodeView({...input,slices:{x:901,y:902,z:903}},options).encoded);assert.deepEqual([mismatchedSlices.slices.x,mismatchedSlices.slices.y,mismatchedSlices.slices.z],[1,2,3]);
  assert.ok(encodeView(input,{publicReferenceIds:['public-paper']}).omitted.includes('coordinate'));
});
test('explicit manual input can share its coordinates while an earlier sensitive camera remains omitted',()=>{
  const input={coordinate:[10.25,20.5,30.75],slices:{x:10.25,y:20.5,z:30.75},coordinateOrigin:{kind:'manual',cameraSensitive:true},camera:{position:[901,902,903],target:[1.25,2.5,3.75]}};
  const shared=encodeView(input),view=decodeView(shared.encoded);assert.deepEqual(view.coordinate,input.coordinate);assert.equal(view.camera,null);assert.ok(shared.omitted.includes('camera'));assert.equal(JSON.stringify(view).includes('901'),false);
});
test('project-file origin and false camera flags cannot attest manual or public provenance',async()=>{
  const input={coordinate:[1.25,2.5,3.75],coordinateOrigin:{kind:'manual',imported:false,cameraSensitive:false},camera:{position:[901,902,903],target:[1.25,2.5,3.75]}};
  const reopened=(await parseProject(await serializeProject({view:input,volumes:[]}))).view;
  assert.equal(reopened.coordinateOrigin.imported,true);assert.equal(reopened.coordinateOrigin.cameraSensitive,true);assert.ok(encodeView(reopened).omitted.includes('coordinate'));
  const foreign=validateViewState(input,{savedProjectId:'A',projectId:'B'});assert.equal(foreign.coordinateOrigin.imported,true);
  const owned=validateViewState(input,{savedProjectId:'A',projectId:'A'});assert.equal(owned.coordinateOrigin.imported,false);
});

test('project preserves local marker identity and visibility; public layer and hidden layer round trip',async()=>{
 const evidence=syntheticEvidence(),layer={layerId:'private-layer-name',resultId:'public-result',sourceReferenceId:'public-paper',coordinateIds:['public-point-0','public-point-1'],spaceId:'MNI152NLin6Asym',visible:true,style:{color:'#123456',opacity:.25,size:20}},hidden={...layer,layerId:'hidden-layer',visible:false};
 const project=await parseProject(await serializeProject({view:{resultLayers:[layer,hidden]},evidence,volumes:[]}));assert.deepEqual(project.view.resultLayers,[layer,hidden]);assert.equal(project.view.resultLayers[1].visible,false);assert.deepEqual(resolveResultLayers(project.view.resultLayers,{evidence:project.evidence}).markers.map(m=>m.position),[[1,2,3],[-1,2,3]]);
 const shared=encodeView(project.view,{publicReferenceIds:['public-paper'],publicResults:evidence});const restored=decodeView(shared.encoded);assert.deepEqual(restored.resultLayers.map(l=>l.layerId),['public-layer-1','public-layer-2']);assert.deepEqual(restored.resultLayers[0].coordinateIds,layer.coordinateIds);assert.equal(restored.resultLayers[1].visible,false);assert.equal(JSON.stringify(restored).includes('private-layer-name'),false);assert.deepEqual(shared.omitted,['coordinate']);
 const local=structuredClone(evidence);local.results[0].finding='Private reanalysis under a public paper';const omitted=encodeView(project.view,{publicReferenceIds:['public-paper'],publicResults:evidence,evidence:local});assert.deepEqual(decodeView(omitted.encoded).resultLayers,[]);assert.ok(omitted.omitted.includes('resultLayers'));
});

test('public result layers round trip without private identifiers and v1 views migrate empty',()=>{
 const publicResults=migrateEvidence({schema:'brain-evidence-v1',references:[{id:'pub',title:'Public',url:'https://example.org'}],results:[],relations:[]}).value;
 const privateLayer={layerId:'private-layer-name',resultId:'private-result',coordinateIds:['point'],sourceReferenceId:'pub',spaceId:null,visible:false,style:{}};
 const shared=encodeView({resultLayers:[privateLayer]},{publicReferenceIds:['pub'],publicResults});const sharedText=JSON.stringify(decodeView(shared.encoded));assert.ok(!sharedText.includes('private-result'));assert.ok(!sharedText.includes('private-layer-name'));assert.ok(shared.omitted.includes('resultLayers'));
 const old=btoa(JSON.stringify({schema:'neuroatlas-view-v1',resultLayers:[privateLayer]}));assert.deepEqual(decodeView(old).resultLayers,[]);assert.equal(validateViewState({}).schema,'neuroatlas-view-v2');
});

test('layer serialization retains the existing two MiB view payload budget',()=>{
 const coordinateIds=Array.from({length:9000},(_,i)=>`coordinate-${i}-${'x'.repeat(140)}`),layer={layerId:'layer',resultId:'result',coordinateIds,sourceReferenceId:'paper',spaceId:null,visible:false,style:{}};
 assert.throws(()=>validateViewState({resultLayers:[layer,{...layer,layerId:'layer-2'}]}),/View state is too large/);
});

test('named view origin is checked even for IDs that now match public records; legacy empty views and public URLs stay portable',()=>{
 const evidence=syntheticEvidence(),layer={layerId:'saved-layer',resultId:'public-result',sourceReferenceId:'public-paper',coordinateIds:['public-point-0'],spaceId:'MNI152NLin6Asym',visible:false,style:{}};
 for(const savedProjectId of [undefined,null,'project-A'])assert.throws(()=>validateViewState({resultLayers:[layer]},{savedProjectId,projectId:'project-B'}),/named-view-project-mismatch/);
 assert.deepEqual(validateViewState({resultLayers:[layer]},{savedProjectId:'project-B',projectId:'project-B'}).resultLayers,[layer]);
 assert.deepEqual(validateViewState({schema:'neuroatlas-view-v1',resultLayers:[layer]},{projectId:'project-B'}).resultLayers,[]);
 assert.deepEqual(validateViewState({schema:'neuroatlas-view-v2',resultLayers:[]},{projectId:'project-B'}).resultLayers,[]);
 const portable=decodeView(encodeView({resultLayers:[layer]},{publicReferenceIds:['public-paper'],publicEvidence:evidence}).encoded);assert.deepEqual(resolveResultLayers(portable.resultLayers,{publicEvidence:evidence}).layers[0].coordinateIds,layer.coordinateIds);
});
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
test('public link preserves camera opacity ROI and filters without custom data',()=>{const state={coordinateOrigin:{kind:'manual',cameraSensitive:false},atlas:'jhu',language:'en',opacity:.12,camera:{position:[1,2,3],target:[0,0,0],zoom:2},roi:{aAtlas:'dk',bAtlas:'jhu',aLabels:[1,2],bLabels:[5],display:{opacityA:0},computed:true},literature:{modality:'meg',query:'private note'},atlasExplorer:{atlas:'dk',selected:[2,3]}};const restored=decodeView(encodeView(state).encoded);assert.deepEqual(restored.camera,state.camera);assert.equal(restored.opacity,.12);assert.equal(restored.roi.display.opacityA,0);assert.deepEqual(restored.roi.aLabels,[1,2]);assert.equal(restored.literature.modality,'meg');assert.equal(restored.literature.query,'');});
test('custom volumes are omitted from links and malformed input rejected',()=>{const v=encodeView({atlas:'custom-a',roi:{aAtlas:'custom-a'},mode:'roi'});assert.deepEqual(v.omitted,['coordinate','atlas','ROI']);assert.equal(decodeView(v.encoded).atlas,'dk');assert.throws(()=>decodeView('!!'));assert.equal(validateViewState({camera:{position:[NaN,0,0]}}).camera,null);});
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
  assert.deepEqual(decodeView(encodeView({camera:current,coordinateOrigin:{kind:'manual',cameraSensitive:false}}).encoded).camera,current);
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
  assert.equal(accepted.usage.rawPayloadBytes,356+new TextEncoder().encode(JSON.stringify(accepted.encodedAssets[0].layout)).length);assert.equal(accepted.usage.assetCount,1);
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

test('project v2 keeps provenance states and v1 migration delegates evidence without inventing computation facts',async()=>{
 const {migrateProjectV1}=await import('./workspace-project.js');
 assert.equal(typeof migrateProjectV1,'function');
 const legacy={schema:'neuroatlas-project-v1',view:{mode:'roi',roi:{aAtlas:'dk',aLabels:[1],computed:true,display:{mode:'B'}}},notes:[],evidence:{schema:'brain-evidence-v1',references:[],results:[],relations:[]},volumes:[]};
 const before=structuredClone(legacy),migrated=migrateProjectV1(legacy);assert.deepEqual(legacy,before);assert.equal(migrated.schema,'neuroatlas-project-v2');assert.equal(migrated.evidence.schema,'brain-evidence-v2');assert.deepEqual(migrated.drafts,[]);assert.equal(migrated.roiSnapshot,null);assert.equal(migrated.view.roi.computed,false);assert.equal(migrated.view.roi.display.mode,'B');assert.equal(migrated.provenanceStatus,'missing-provenance');
 const reopened=await parseProject(await serializeProject({projectId:'A',view:{},notes:[],volumes:[],provenanceStatus:'mismatch'}));assert.equal(reopened.provenanceStatus,'mismatch');
 const publicView=decodeView(encodeView({...reopened.view,roiSnapshot:{manifest:{secret:'private'}},drafts:[{payload:'private'}],provenanceStatus:'mismatch'}).encoded);assert.equal(JSON.stringify(publicView).includes('secret'),false);assert.equal(JSON.stringify(publicView).includes('private'),false);
});

test('real local NIfTI provenance survives the project codec and explicit recompute; tampering fails symmetrically',async()=>{
 const {prepareLocalVolumeProvenance,prepareComparisonManifest}=await import('./computation-manifest.js'),{parseNifti,exportNifti}=await import('./nifti.js'),{compareROIs,normalizeROISelection}=await import('./roi.js');
 const input=fixture(),raw=exportNifti(input),parsed=await parseNifti(raw,{kind:'label',space:'MNI152NLin6Asym'}),source=await prepareLocalVolumeProvenance({...parsed,id:'custom-local',canOverlayOnTarget:true,alignmentStatus:'user-declared',provenance:'Synthetic alignment declaration'},raw,{id:'original.nii'});
 const project={projectId:'provenance-A',view:{},notes:[],evidence:null,volumes:[source]},text=await serializeProject(project),decoded=await parseProject(text),restored=decoded.volumes[0];
 for(const key of ['identity','sourceIdentities','sourceGrid','transforms','encoding','spatialEvidence'])assert.deepEqual(restored[key],source[key],key);
 const sa=normalizeROISelection(source,{labels:[1]}),sb=normalizeROISelection(source,{labels:[2]}),manifest=await prepareComparisonManifest(restored,sa,restored,sb,restored);assert.deepEqual(compareROIs(restored,sa,restored,sb,restored,{manifest}).metrics,compareROIs(source,sa,source,sb,source).metrics);
 const bad=JSON.parse(text);bad.volumes[0].volumeProvenance.identity.sha256='f'.repeat(64);await assert.rejects(parseProject(JSON.stringify(bad)),/project-volume-digest-mismatch/);await assert.rejects(serializeProject({...project,volumes:[{...source,identity:{...source.identity,sha256:'f'.repeat(64)}}]}),/project-volume-digest-mismatch/);
 const badGrid=JSON.parse(text);badGrid.volumes[0].volumeProvenance.sourceGrid.affine[3]+=1;await assert.rejects(parseProject(JSON.stringify(badGrid)),/project-volume-grid-mismatch/);
});

test('legacy project-entry observations do not backfill historical identity; unknown-space identities stay ineligible',async()=>{
 const {prepareLocalVolumeProvenance}=await import('./computation-manifest.js'),{exportNifti}=await import('./nifti.js');
 const source={...fixture(),space:'native-unverified'},unknown=await prepareLocalVolumeProvenance(source,exportNifti(source),{id:'native.nii'});
 const reopened=await parseProject(await serializeProject({projectId:'unknown-space',view:{},notes:[],volumes:[unknown],roiSnapshot:{id:'old-result',manifest:null,metrics:{dice:.42}}}));assert.equal(reopened.volumes[0].identity.spaceId,null);assert.equal(reopened.volumes[0].sourceGrid,null);assert.equal(reopened.volumes[0].canOverlayOnTarget,false);
 const legacy=JSON.parse(await serializeProject({projectId:'legacy-volume',view:{},notes:[],volumes:[source],roiSnapshot:{id:'old-result',manifest:null,metrics:{dice:.42}}}));delete legacy.volumes[0].volumeProvenance;
 const loaded=await parseProject(JSON.stringify(legacy));assert.equal(loaded.roiSnapshot.manifest,null);assert.equal(loaded.roiSnapshot.status,'missing-provenance');assert.deepEqual(loaded.roiSnapshot.metrics,{dice:.42});assert.equal(loaded.volumes[0].projectEntryObservation.scope,'current-project-entry');assert.equal(loaded.volumes[0].projectEntryObservation.originalSourceBytesEmbedded,false);assert.match(loaded.volumes[0].sourceIdentities[0].id,/project-entry:/);
});

test('project and named view preserve the displayed historical slot while public links never bind local history',async()=>{
 const history={id:'saved-history',manifest:null,metrics:{dice:.42}};
 for(const snapshot of ['original','recomputed','none']){const opened=await parseProject(await serializeProject({projectId:'A',view:{roi:{snapshot}},notes:[],volumes:[],roiSnapshot:history,recomputedSnapshot:{...history,id:'new-history'}}));assert.equal(opened.view.roi.snapshot,snapshot);}
 assert.throws(()=>validateViewState({roi:{snapshot:'original'}},{savedProjectId:'A',projectId:'B'}),/named-view-project-mismatch/);assert.equal(validateViewState({roi:{snapshot:'original'}},{savedProjectId:'A',projectId:'A'}).roi.snapshot,'original');
 const shared=decodeView(encodeView({roi:{snapshot:'original',computed:true}}).encoded);assert.equal(shared.roi.snapshot,'none');assert.equal(shared.roi.computed,false);
 const hostile=btoa(JSON.stringify({roi:{snapshot:'recomputed',computed:true}}));assert.equal(decodeView(hostile).roi.snapshot,'none');
});

test('identity-bearing project entries reject bounded-envelope, encoding and contradictory-grid violations',async()=>{
 const {prepareLocalVolumeProvenance}=await import('./computation-manifest.js'),{exportNifti}=await import('./nifti.js');
 const base={...fixture(),space:'MNI152NLin6Asym'},source=await prepareLocalVolumeProvenance(base,exportNifti(base),{id:'synthetic.nii'}),project=volumes=>({projectId:'A',view:{},notes:[],volumes});
 await assert.rejects(serializeProject(project([{...source,spatialEvidence:{note:'x'.repeat(2*1024*1024)}}])),/project-volume-provenance-budget/);
 await assert.rejects(serializeProject(project([{...source,encoding:{...source.encoding,dtype:'float64'}}])),/project-volume-encoding-mismatch/);
 await assert.rejects(serializeProject(project([{...source,sourceGrid:{...source.sourceGrid,shape:[1,2,2]}}])),/project-volume-grid-mismatch/);
 await assert.rejects(serializeProject(project([{...source,order:'z-fastest'}])),/project-volume-grid-mismatch/);
 const affine=[...source.affine];affine[0]=1/3;const precise=await parseProject(await serializeProject(project([{...source,affine,sourceGrid:{...source.sourceGrid,affine}}])));assert.deepEqual(precise.volumes[0].affine,affine);
 const encoded=JSON.parse(await serializeProject(project([source])));encoded.volumes[0].volumeProvenance.spatialEvidence={note:'x'.repeat(2*1024*1024)};await assert.rejects(parseProject(JSON.stringify(encoded)),/project-volume-provenance-budget/);
});

test('all supported voxel types retain exact S5 derived identities across the project-entry envelope',async()=>{
 const {prepareLocalVolumeProvenance}=await import('./computation-manifest.js'),{exportNifti,parseNifti}=await import('./nifti.js');
 for(const Type of [Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array]){
  const input={...fixture(),kind:'label',data:Type.of(1,2,0,3)},raw=exportNifti(input),decoded=await parseNifti(raw,{kind:'label',space:'MNI152NLin6Asym'}),source=await prepareLocalVolumeProvenance({...decoded,id:'custom-type'},raw,{id:`${Type.name}.nii`});
  const restored=(await parseProject(await serializeProject({projectId:'A',view:{},notes:[],volumes:[source]}))).volumes[0];assert.deepEqual(restored.identity,source.identity,Type.name);assert.equal(restored.data.constructor,Type);assert.deepEqual(restored.data,source.data);
 }
});

test('metre and micron NIfTI producers retain exact decoded mm geometry and provenance across projects',async()=>{
 const {exportNifti,parseNifti}=await import('./nifti.js'),{prepareLocalVolumeProvenance}=await import('./computation-manifest.js');
 for(const [units,diagonal]of [[1,.001],[3,1000.125]]){
  const raw=exportNifti({...fixture(),shape:[1,1,1],data:Uint8Array.of(1)}),header=new DataView(raw.buffer);raw[123]=units;for(const offset of [280,300,320])header.setFloat32(offset,diagonal,true);
  const decoded=await parseNifti(raw,{kind:'mask',space:'MNI152NLin6Asym'}),source=await prepareLocalVolumeProvenance({...decoded,id:'custom-units'},raw,{id:`unit-${units}.nii`});assert.notEqual(decoded.affine[0],Math.fround(decoded.affine[0]));
  const original={id:'old-unit-result',manifest:null,grid:{shape:source.shape,affine:source.affine,order:source.order,space:source.space},classes:Uint8Array.of(3),metrics:{dice:1}};
  const text=await serializeProject({projectId:'A',view:{},notes:[],volumes:[source],roiSnapshot:original}),restored=await parseProject(text);
  assert.deepEqual(restored.volumes[0].affine,source.affine);assert.deepEqual(restored.volumes[0].sourceGrid,source.sourceGrid);assert.deepEqual(restored.volumes[0].identity,source.identity);assert.deepEqual(restored.roiSnapshot.grid,original.grid);assert.equal(restored.roiSnapshot.manifest,null);
  const twice=await parseProject(await serializeProject(restored));assert.deepEqual(twice.volumes[0].affine,source.affine);assert.deepEqual(twice.volumes[0].identity,source.identity);
 }
});

test('versioned layout preserves precision, unknown-space geometry and asymmetric z-fastest voxel bytes',async()=>{
 const {exportNifti}=await import('./nifti.js'),{prepareLocalVolumeProvenance}=await import('./computation-manifest.js');
 const affine=[Math.SQRT2,1/7,0,Math.PI,0,Math.E,1/11,-1/3,0,0,Math.sqrt(3),Math.log(2),0,0,0,1];
 for(const space of ['MNI152NLin6Asym','native-unverified']){
  const base={...fixture(),kind:'label',shape:[2,3,2],affine,order:'z-fastest',space,data:Uint16Array.from({length:12},(_,i)=>i+1)},source=await prepareLocalVolumeProvenance(base,exportNifti(base),{id:'layout.nii'});
  const text=await serializeProject({projectId:'A',view:{},notes:[],volumes:[source]}),entry=JSON.parse(text).volumes[0];assert.equal(entry.layout.schema,'neuroatlas-volume-layout-v1');assert.deepEqual(entry.layout.grid,{shape:source.shape,affine,space,order:'z-fastest'});assert.equal(entry.layout.storageGrid.order,'x-fastest');assert.notDeepEqual(entry.layout.storageGrid.affine,affine);
  const restored=(await parseProject(text)).volumes[0];assert.deepEqual(restored.affine,affine);assert.equal(restored.order,'z-fastest');assert.deepEqual(restored.data,base.data);assert.strictEqual(restored.dataTypedArray,restored.data);assert.deepEqual(restored.identity,source.identity);assert.deepEqual(restored.sourceIdentities,source.sourceIdentities);assert.equal(restored.identity.spaceId,space==='native-unverified'?null:space);assert.deepEqual(restored.sourceGrid,source.sourceGrid);
 }
});

async function changeProjectHeader(entry,mutate){
 const compressed=Uint8Array.from(Buffer.from(entry.niftiGzip,'base64')),bytes=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());mutate(new DataView(bytes.buffer),bytes);entry.niftiGzip=Buffer.from(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).toString('base64');
}

test('layout source/storage/header inconsistencies reject without rewriting recorded source grids',async()=>{
 const {exportNifti}=await import('./nifti.js'),{prepareLocalVolumeProvenance}=await import('./computation-manifest.js');
 const base={...fixture(),space:'MNI152NLin6Asym'},source=await prepareLocalVolumeProvenance(base,exportNifti(base),{id:'layout.nii'}),text=await serializeProject({projectId:'A',view:{},notes:[],volumes:[source]});
 const requireLayout=JSON.parse(text);assert.ok(requireLayout.volumes[0].layout);
 for(const mutate of [entry=>entry.layout.grid.affine[3]+=1,entry=>entry.layout.storageGrid.affine[3]+=1,entry=>entry.volumeProvenance.sourceGrid.affine[3]+=1,entry=>entry.layout.grid.space='other-space']){const changed=JSON.parse(text);mutate(changed.volumes[0]);await assert.rejects(parseProject(JSON.stringify(changed)),/project-volume-(layout|grid|storage)-mismatch/);}
 const changed=JSON.parse(text);await changeProjectHeader(changed.volumes[0],view=>view.setFloat32(292,7,true));await assert.rejects(parseProject(JSON.stringify(changed)),/project-volume-storage-mismatch/);
 const changedUnits=JSON.parse(text);await changeProjectHeader(changedUnits.volumes[0],(_view,bytes)=>bytes[123]=1);await assert.rejects(parseProject(JSON.stringify(changedUnits)),/project-volume-storage-mismatch/);
});

test('lossless layout retains signed zero from actual NIfTI affines and the recorded source grid',async()=>{
 const {exportNifti,parseNifti}=await import('./nifti.js'),{prepareLocalVolumeProvenance}=await import('./computation-manifest.js');
 const raw=exportNifti(fixture());new DataView(raw.buffer).setFloat32(284,-0,true);const decoded=await parseNifti(raw,{kind:'mask',space:'MNI152NLin6Asym'});assert.ok(Object.is(decoded.affine[1],-0));
 const source=await prepareLocalVolumeProvenance({...decoded,id:'custom-signed-zero'},raw,{id:'signed-zero.nii'}),restored=(await parseProject(await serializeProject({projectId:'A',view:{},notes:[],volumes:[source]}))).volumes[0];assert.deepEqual(restored.affine,source.affine);assert.deepEqual(restored.sourceGrid,source.sourceGrid);assert.deepEqual(restored.identity,source.identity);
});

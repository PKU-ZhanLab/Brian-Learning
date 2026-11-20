import {prepareVolume} from '../../src/lib/volume.js';
import {buildAtlasSurfaces} from '../../src/lib/atlas-explorer.js';
import {prepareComparisonDisplay} from '../../src/lib/comparison-display.js';
import {exportNifti,parseNifti} from '../../src/lib/nifti.js';
import {makeAssetIdentity,prepareLocalVolumeProvenance,makeComputationManifest} from '../../src/lib/computation-manifest.js';
import {serializeProject,parseProject} from '../../src/lib/workspace-project.js';
export const fixtureVersion='synthetic-oblique-v1';
export async function prepareFixture({kind='label',threshold=3,tail='positive',restoredVolume}={}){
 const shape=[5,4,3],affine=[-2,.25,0,112.125,0,3,.5,-201.5,0,0,4,70.75,0,0,0,1];
 const data=kind==='label'?Uint16Array.from({length:60},(_,i)=>i%5<2?7:i%5===3?42:0):Float32Array.from({length:60},(_,i)=>[-4,-3,-2,0,2,3,4][i%7]);
 const source=prepareVolume(data,{id:'custom-x10-fixture',name:fixtureVersion,shape,affine,kind,space:'Synthetic-X10-reference-v1',order:'x-fastest',labels:[{id:7,name:'Seven'},{id:42,name:'Forty two'}]});
 const bytes=exportNifti(source),original=await makeAssetIdentity(bytes,{id:`synthetic-original-${kind}`,version:fixtureVersion,spaceId:source.space});
 const parsed=await parseNifti(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{kind,spaceId:source.space});
 const volume=restoredVolume?prepareVolume(restoredVolume.data,restoredVolume):prepareVolume(parsed.data,{...source,...await prepareLocalVolumeProvenance({...source,alignmentStatus:'user-declared',source:'Immutable synthetic formula in fixture.mjs'},bytes,{id:`synthetic-derived-${kind}`,version:fixtureVersion,spaceId:source.space})});
 const display=prepareComparisonDisplay(volume,{threshold,tail}),ids=kind==='label'?[7,42]:[1],geometry=buildAtlasSurfaces(display,ids);
 const grid={shape,affine,space:source.space,order:'x-fastest'};
 const manifest=makeComputationManifest({appVersion:'4.1.0',algorithmVersion:'x10-fixture-v1',inputs:[volume.identity,volume.identity,original],transforms:[],sourceGrids:[grid,grid],targetGrid:grid,interpolation:['nearest-neighbour','nearest-neighbour'],thresholds:[0,1].map(()=>({kind,threshold:kind==='label'?0:threshold,tail})),labelSets:[ids,ids]});
 return {volume,display,geometry,bytes,original,manifest,parsed};
}
export function surfaceSTL(geometry){
 let out='solid x10\n';for(const mesh of geometry.meshes)for(let i=0;i<mesh.positions.length;i+=9){out+=`facet normal ${[...mesh.normals.slice(i,i+3)].join(' ')}\nouter loop\n`;for(let k=0;k<9;k+=3)out+=`vertex ${[...mesh.positions.slice(i+k,i+k+3)].join(' ')}\n`;out+='endloop\nendfacet\n';}return out+'endsolid x10\n';
}
export async function captureFixtureProject(fixture,{point,camera,nvPoint,threshold,tail}){
 const source={assetId:fixture.volume.id,identity:fixture.volume.identity,labels:fixture.volume.kind==='label'?[7,42]:[1],threshold,tail,point,camera};
 return serializeProject({projectId:'x10-viewer-experiment',view:{language:'en',mode:'roi',roi:{paired:{open:true,linkCamera:false,linkCrosshair:false,left:source,right:{...source,point:nvPoint||point,camera:null}}}},volumes:[fixture.volume]});
}
export async function restoreFixtureProject(text){
 const restored=await parseProject(text),pair=restored.view.roi.paired,volume=restored.volumes.find(v=>v.id===pair.left.assetId);
 if(!volume||JSON.stringify(volume.identity)!==JSON.stringify(pair.left.identity))throw Error('Canonical source identity mismatch');
 return {volume,pair,config:{kind:volume.kind,threshold:pair.left.threshold,tail:pair.left.tail,restoredVolume:volume}};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import * as links from './comparison-link.js';
import {validateViewState,encodeView,decodeView,serializeProject,parseProject,readSavedViews,writeSavedViews} from './workspace-project.js';
import {pushNavigation,goBack} from './navigation-history.js';
import {sliceWorldPoint} from './volume.js';
const identity=(id,spaceId='MNI152NLin6Asym')=>({id,version:'v1',sha256:'a'.repeat(64),spaceId});
const source=(id,space='MNI152NLin6Asym')=>({identity:identity(id,space),identityVerification:'received-bytes',spatialEvidence:{space,alignmentStatus:'native',source:'FSL exact reference'}});
test('specific reference with recorded evidence permits same-reference crosshairs',()=>{
 assert.equal(links.canLinkCoordinates(source('a'),source('b')).allowed,true);
 assert.equal(links.canLinkCoordinates(source('a'),source('b',null)).allowed,false);
 assert.equal(links.canLinkCoordinates(source('a','MNI'),source('b','MNI')).allowed,false);
 assert.equal(links.canLinkCoordinates({identity:identity('a')},source('b')).allowed,false);
 assert.equal(links.canLinkCoordinates(source('a'),source('b','Colin27'),{matrix:[1,0,0,0]}).allowed,false);
});
test('bidirectional updates retain fractions, independently unlink, suppress feedback and reject stale source events',()=>{
 const left=source('a'),right=source('b'),pair={left:{assetId:'a',identity:left.identity,point:[0,0,0]},right:{assetId:'b',identity:right.identity,point:[3,4,5]},linkCamera:true,linkCrosshair:true};
 const next=links.updateComparison(pair,'left','point',[123.75,-202.125,54.5],{left,right});
 assert.deepEqual(next.right.point,[123.75,-202.125,54.5]);
 assert.equal(links.updateComparison(next,'right','point',next.right.point,{left,right}),next);
 const off=links.updateComparison({...next,linkCrosshair:false},'right','point',[1.1,2.2,3.3],{left,right});
 assert.deepEqual(off.left.point,next.left.point);
 const camera={position:[1,2,3],target:[0,0,0],up:[0,0,1],zoom:1};
 assert.deepEqual(links.updateComparison(off,'right','camera',camera,{left,right}).left.camera,camera);
 assert.equal(links.updateComparison(pair,'left','point',[4,5,6],{left:{...left,identity:identity('changed')},right}),pair);
});
test('pair view round trips exact identities and public projection omits all paired point/camera provenance',()=>{
 const pair={open:true,linkCamera:false,linkCrosshair:true,left:{assetId:'custom-private',identity:identity('custom-private',null),point:[1.125,2.5,300.75],camera:{position:[1,2,3],target:[0,0,0],zoom:2}},right:{assetId:'dk',identity:identity('public/data/dk.bin'),point:[4.5,5,6],camera:null}};
 const view=validateViewState({roi:{paired:pair}});
 assert.deepEqual(view.roi.paired.left.point,pair.left.point);
 assert.equal(view.roi.paired.linkCamera,false);
 const encoded=encodeView(view);
 assert.equal(decodeView(encoded.encoded??encoded.value??encoded).roi?.paired,undefined);
 assert.throws(()=>validateViewState({roi:{paired:{...pair,left:{...pair.left,point:[NaN,0,0]}}}}));
});
test('own-source slice bounds retain coordinates outside the brain template',()=>{
 assert.deepEqual(sliceWorldPoint('z',800.5,0,1,true,{x:[400,600],y:[700,900],z:[800,1000]}),[600,700,800.5]);
});
test('paired project, named and history restoration retain independent state and reject foreign local sources',async()=>{
 const pair=links.validateComparisonState({open:false,linkCamera:true,linkCrosshair:false,left:{assetId:'dk',identity:identity('public/data/dk.bin'),point:[12345.125,-3.75,8.5],camera:{position:[1,2,3],target:[5,6,7],zoom:2,up:[0,0,1]}},right:{assetId:'aal',identity:identity('public/data/aal.bin','Colin27'),point:[2.25,4.5,8.75],camera:null}});
 const view=validateViewState({mode:'roi',roi:{paired:pair}}),history=pushNavigation({projectId:'pair-test',entries:[],index:-1},{view,scroll:{roi:42}}).history;
 const restored=await parseProject(await serializeProject({projectId:'pair-test',view:{...view,navigationHistory:history},volumes:[]}));
 assert.deepEqual(restored.view.roi.paired,pair);assert.deepEqual(restored.view.navigationHistory.entries[0].view.roi.paired,pair);
 let stored;const storage={setItem:(key,value)=>{stored=value;},getItem:()=>stored};writeSavedViews([{id:'saved',name:'pair',view}],storage);assert.deepEqual(readSavedViews(storage)[0].view.roi.paired,pair);
 const privateView={roi:{paired:{...pair,left:{...pair.left,assetId:'custom-private'}}}};
 assert.throws(()=>validateViewState(privateView,{savedProjectId:'old',projectId:'new'}),/named-view-project-mismatch/);
 const incompatible={left:source('a'),right:source('b','Colin27')},state={...pair,left:{...pair.left,identity:incompatible.left.identity},right:{...pair.right,identity:incompatible.right.identity}};
 assert.equal(links.updateComparison(state,'left','camera',{position:[9,8,7],target:[1,1,1],up:[0,0,1],zoom:2},incompatible).right.camera,null);
});

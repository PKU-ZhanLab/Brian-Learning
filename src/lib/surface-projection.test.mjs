import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRibbon,isAalCorticalLabel,surfaceLabelAt} from './surface-projection.js';
test('ribbon preserves nonconsecutive IDs and resolves categorical ties without averaging',()=>{
 const run=sample=>projectRibbon({pial:[0,0,0],white:[0,0,1],sample,allowedIds:new Set([2001,6002]),depths:[0,.25,.75,1]}).labels[0];
 assert.equal(run((x,y,z)=>z<.5?6002:2001),2001);assert.equal(run((x,y,z)=>z===0?0:6002),6002);
});
test('background, deep labels and medial wall never receive invented cortical labels',()=>{
 const pial=[0,0,0,1,0,0,2,0,0],white=[0,0,1,1,0,1,2,0,1];
 const result=projectRibbon({pial,white,sample:x=>x===0?7001:2001,allowedIds:new Set([2001]),cortexMask:[1,0,1]});
 assert.deepEqual([...result.labels],[0,0,2001]);assert.deepEqual(pial,[0,0,0,1,0,0,2,0,0]);
 assert(!isAalCorticalLabel({name:'Hippocampus_L'}));assert(!isAalCorticalLabel({name:'Thal_MDm_R'}));assert(isAalCorticalLabel({name:'ACC_pre_L'}));assert(isAalCorticalLabel({name:'ParaHippocampal_L'}));
});
test('invalid surface correspondence and sampling outside ribbon are rejected',()=>{
 assert.throws(()=>projectRibbon({pial:[0,0,0],white:[],sample:()=>1,allowedIds:new Set([1])}));
 assert.throws(()=>projectRibbon({pial:[0,0,0],white:[0,0,1],sample:()=>1,allowedIds:new Set([1]),depths:[-1]}));
});
test('surface picking uses exactly the displayed labels, including uncovered vertices',()=>{
 const volume={surfaceLabels:{L:new Uint16Array([2001,0])},labels:[{id:2001,name:'Precentral_L'}]};
 assert.equal(surfaceLabelAt(volume,'L',0).name,'Precentral_L');assert.equal(surfaceLabelAt(volume,'L',1),null);assert.equal(surfaceLabelAt(volume,'R',0),undefined);
});

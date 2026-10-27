import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasLabelSummary,buildAtlasSurfaces,nativeDisplayVolume} from './atlas-explorer.js';
const affine=[-2,0,0,10,0,2,0,-4,0,0,2,8,0,0,0,1];
const volume={shape:[2,1,1],affine,data:new Uint16Array([1,2]),labels:[{id:1,name:'one'},{id:2,name:'two'},{id:3,name:'absent'}],space:'native-unknown',canOverlayOnTarget:false};
test('actual native labels and affine centroids do not create absent labels',()=>{const labels=atlasLabelSummary(volume);assert.deepEqual(labels.map(v=>v.id),[1,2]);assert.deepEqual(labels[1].centroid,[8,-4,8]);assert.equal(labels[0].volumeMm3,8);});
test('slice navigation stays inside disconnected parcels even when the centroid is background',()=>{
 const v={...volume,shape:[3,1,1],data:new Uint8Array([1,0,1])},label=atlasLabelSummary(v)[0];
 assert.deepEqual(label.centroid,[8,-4,8]);assert.deepEqual(label.representativePoint,[10,-4,8]);assert.equal(label.voxels,2);
});
test('independent native geometry preserves both sides of label boundary and handedness',()=>{const result=buildAtlasSurfaces(volume,[1,2]);assert.equal(result.faces,12);assert.equal(result.meshes.length,2);assert.equal(result.space,'native-unknown');assert.deepEqual(result.bounds,[[7,-5,7],[11,-3,9]]);const m=result.meshes[0];for(let q=0;q<m.positions.length;q+=9){const a=Array.from(m.positions.slice(q,q+3)),b=Array.from(m.positions.slice(q+3,q+6)).map((v,i)=>v-a[i]),c=Array.from(m.positions.slice(q+6,q+9)).map((v,i)=>v-a[i]),n=[b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0]];assert.ok(n.reduce((sum,v,i)=>sum+v*m.normals[q+i],0)>0);}});
test('single label never borrows adjacent atlas labels',()=>{const r=buildAtlasSurfaces(volume,[2]);assert.equal(r.meshes.length,1);assert.equal(r.meshes[0].id,2);assert.equal(r.faces,6);assert.throws(()=>buildAtlasSurfaces(volume,[1,2],{maxFaces:2}),/too large/);});
test('native statistical map thresholding does not claim target alignment',()=>{const native={...volume,data:new Float32Array([-3,2]),kind:'statistic'};const v=nativeDisplayVolume(native,{threshold:2.5,tail:'absolute'});assert.deepEqual([...v.data],[1,0]);assert.equal(v.canOverlayOnTarget,false);assert.equal(v.space,'native-unknown');assert.deepEqual(nativeDisplayVolume(native,{threshold:2,tail:'positive'}).data,new Uint8Array([0,1]));});

import test from 'node:test';import assert from 'node:assert/strict';
import {prepareFixture,surfaceSTL,captureFixtureProject,restoreFixtureProject} from './fixture.mjs';
test('immutable fixture keeps exact affine, discrete IDs and original/derived identities',async()=>{const a=await prepareFixture(),b=await prepareFixture();assert.equal(a.original.sha256,b.original.sha256);assert.notEqual(a.original.id,a.volume.identity.id);assert.deepEqual(a.geometry.meshes.map(m=>m.id),[7,42]);assert.equal(a.volume.sampleRAS(112.125,-201.5,70.75),7);assert.match(surfaceSTL(a.geometry),/vertex/);assert.equal(a.manifest.inputs[0].sha256,a.volume.identity.sha256);});
test('same known values exercise inclusive positive, negative and absolute tails',async()=>{for(const [tail,count] of [['positive',16],['negative',18],['absolute',34]]){const f=await prepareFixture({kind:'statistic',threshold:3,tail});assert.equal([...f.display.data].filter(Boolean).length,count);}});
test('canonical restore replaces changed fixture controls and preserves identity, source arrays and both decimal points',async()=>{
 const f=await prepareFixture({kind:'statistic',threshold:2,tail:'negative'}),point=[112.125,-201.5,70.75],nvPoint=[110.5,-202.25,72.125],camera={position:[1,2,3],target:[4,5,6],up:[0,0,1],zoom:1.5};
 const text=await captureFixtureProject(f,{point,nvPoint,camera,threshold:2,tail:'negative'});await prepareFixture({kind:'label'});
 const restored=await restoreFixtureProject(text),replayed=await prepareFixture(restored.config);
 assert.equal(restored.config.kind,'statistic');assert.equal(restored.config.threshold,2);assert.equal(restored.config.tail,'negative');assert.deepEqual(restored.pair.left.point,point);assert.deepEqual(restored.pair.right.point,nvPoint);assert.deepEqual(restored.pair.left.camera,camera);assert.deepEqual(replayed.volume.data,f.volume.data);assert.deepEqual(replayed.volume.identity,f.volume.identity);assert.deepEqual(replayed.display.data,f.display.data);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareVolume} from './volume.js';
import {makeAtlasRegionRef} from './atlas-identity.js';
import {pickDisplayedSurfaceRegion} from './atlas-surface-selection.js';

const json = async path => JSON.parse(await readFile(new URL(`../../public/data/${path}`,import.meta.url)));
const manifest = await json('manifest.json');
const surface = await json(manifest.meshes.find(mesh=>mesh.id==='cortex-left').file);
const positions = new Float32Array(surface.positions);

for (const [atlasId,triangle,shown,voxel] of [['ba',292,18,17],['ba-histology',1389,83,81]]) {
  test(`${atlasId} real triangle ${triangle} picks displayed categorical label ${shown}, not hit-coordinate voxel ${voxel}`,async()=>{
    const meta=manifest.atlases[atlasId];
    const bytes=await readFile(new URL(`../../public/data/${meta.data}`,import.meta.url));
    const volume=prepareVolume(new Uint8Array(bytes),meta);
    const face=surface.indices.slice(triangle*3,triangle*3+3);
    const point=[0,1,2].map(axis=>face.reduce((sum,vertex)=>sum+positions[vertex*3+axis],0)/3);
    const labelIds=new Uint16Array(positions.length/3),regionRefs=new Array(labelIds.length);
    for(const vertex of face) {
      const label=volume.sampleRAS(...positions.slice(vertex*3,vertex*3+3));
      labelIds[vertex]=label;regionRefs[vertex]=makeAtlasRegionRef(atlasId,meta,label);
    }
    assert.deepEqual(face.map(vertex=>labelIds[vertex]),[shown,shown,shown]);
    assert.equal(volume.sampleRAS(...point),voxel,'real volume query remains distinct');
    const result=pickDisplayedSurfaceRegion({positions,face,point,labelIds,regionRefs});
    assert.equal(result.labelId,shown);
    assert.deepEqual(result.ref,makeAtlasRegionRef(atlasId,meta,shown));
    assert(face.includes(result.vertex));
  });
}

test('background vertices are never filled from a neighbouring label or interpolated ID',()=>{
  const ref={atlasId:'a',atlasVersion:'v',labelId:8121,hemisphere:'L',spaceId:'s'};
  const input={positions:[0,0,0,1,0,0,0,1,0],face:[0,1,2],labelIds:[0,8121,8211],regionRefs:[null,ref,{...ref,labelId:8211}]};
  assert.equal(pickDisplayedSurfaceRegion({...input,point:[0,0,0]}),null);
  assert.equal(pickDisplayedSurfaceRegion({...input,point:[1,0,0]}).ref.labelId,8121);
  assert.equal(pickDisplayedSurfaceRegion({...input,point:[0,1,0]}).ref.labelId,8211);
});

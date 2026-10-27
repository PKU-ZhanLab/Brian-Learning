import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { structures, references, atlasOptions, categories, networks, brodmannIndex, citationGB } from '../src/data/catalog.js';
import { prepareVolume, atlasLabelAt, sliceWorldPoint } from '../src/lib/volume.js';

const root=path.resolve(import.meta.dirname,'..');
const data=path.join(root,'public','data');
const manifest=JSON.parse(fs.readFileSync(path.join(data,'manifest.json'),'utf8'));
const ids=new Set(structures.map(s=>s.id));
const refs=new Set(references.map(r=>r.id));
const categoryIds=new Set(categories.map(c=>c.id));
const networkIds=new Set(networks.map(n=>n.id));
assert.equal(ids.size,structures.length,'Structure IDs must be unique');
assert.equal(refs.size,references.length,'Reference IDs must be unique');
for(const s of structures){
  assert(s.name&&s.en&&s.anatomy&&s.function&&s.cognition&&s.clinical,`Missing structure fields: ${s.id}`);
  assert(s.position.length===3&&s.position.every(Number.isFinite),`Invalid anchor: ${s.id}`);
  assert(categoryIds.has(s.category),`Invalid category: ${s.id}`);
  assert(s.references.length>0,`Uncited structure: ${s.id}`);
  for(const ref of s.references)assert(refs.has(ref),`Unknown reference ${ref} for ${s.id}`);
  for(const n of s.networks)assert(networkIds.has(n),`Unknown network ${n}`);
  assert(['L','R','M'].includes(s.hemisphere),`Invalid hemisphere ${s.id}`);
  if(s.hemisphere==='L')assert(s.position[0]<=0,`Wrong RAS side ${s.id}`);
  if(s.hemisphere==='R')assert(s.position[0]>=0,`Wrong RAS side ${s.id}`);
}
for(const ref of references){assert(citationGB(ref).includes(String(ref.year)));if(ref.pmid)assert(/^\d+$/.test(ref.pmid));}
for(const hemi of ['l','r'])for(const region of ['precentral','postcentral','hippocampus','amygdala','thalamus'])assert(ids.has(`${region}-${hemi}`),`Missing ${region}-${hemi}`);
for(const [prefix,count] of [['C',8],['T',12],['L',5],['S',5],['Co',1]])for(let i=1;i<=count;i++)assert(ids.has(`spinal-${prefix}${i}`),`Missing cord segment ${prefix}${i}`);
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
for(const mesh of manifest.meshes){
  const bytes=fs.readFileSync(path.join(data,mesh.file));
  if(mesh.sha256)assert.equal(sha(bytes),mesh.sha256,`Mesh hash mismatch ${mesh.file}`);
  const model=JSON.parse(bytes);assert.equal(model.positions.length%3,0);assert.equal(model.indices.length%3,0);
  assert(model.positions.every(Number.isFinite));assert(model.indices.every(i=>i>=0&&i<model.positions.length/3));
}
for(const option of atlasOptions)assert(manifest.atlases[option.id],`Missing atlas metadata ${option.id}`);
for(const [id,atlas] of Object.entries(manifest.atlases)){
  if(!atlas.available)continue;
  assert(['uint8','uint16'].includes(atlas.dtype),`Unsupported atlas dtype ${id}`);
  assert.equal(atlas.order,'x-fastest',`Unsupported array layout ${id}`);
  assert(atlas.shape.length===3&&atlas.shape.every(v=>Number.isInteger(v)&&v>0),`Invalid atlas dimensions ${id}`);
  assert(atlas.affine.length===16&&atlas.affine.every(Number.isFinite),`Invalid atlas affine ${id}`);
  const bytes=fs.readFileSync(path.join(data,atlas.data));
  if(atlas.sha256)assert.equal(sha(bytes),atlas.sha256,`Atlas hash mismatch ${id}`);
  const arr=atlas.dtype==='uint16'?new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2):new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(arr.length,atlas.shape.reduce((a,b)=>a*b,1));
  const labels=new Set(atlas.labels.map(l=>l.id)),present=new Set(arr);
  for(const value of present)assert(value===0||labels.has(value),`Undocumented label ${value} in ${id}`);
  if(Number.isInteger(atlas.positiveLabelCount))assert.equal([...present].filter(v=>v>0).length,atlas.positiveLabelCount,`Positive label coverage ${id}`);
  const volume=prepareVolume(arr,atlas);let tested=0;
  for(let index=0;index<arr.length;index+=173){if(!arr[index])continue;const [nx,ny]=atlas.shape;const x=index%nx,y=Math.floor(index/nx)%ny,z=Math.floor(index/nx/ny);const a=atlas.affine;const world=[a[0]*x+a[1]*y+a[2]*z+a[3],a[4]*x+a[5]*y+a[6]*z+a[7],a[8]*x+a[9]*y+a[10]*z+a[11]];assert.equal(volume.sampleRAS(...world),arr[index],`Affine sampling ${id}`);assert(atlasLabelAt(volume,world)?.name);tested++;}
  assert(tested>0);console.log(`PASS ${id}: ${labels.size} labels; ${tested} affine samples; SHA256 verified`);
}
assert(sliceWorldPoint('z',0,0,.5,true)[0]>0,'Radiological left screen must be R');
assert(sliceWorldPoint('z',0,1,.5,true)[0]<0,'Radiological right screen must be L');
assert(sliceWorldPoint('y',0,0,.5,true)[0]>0,'Coronal left screen must be R');
assert(sliceWorldPoint('x',0,0,.5,true)[1]<0,'Sagittal left screen must be P');
const t1Meta=JSON.parse(fs.readFileSync(path.join(data,'volume.json'),'utf8'));
const t1=fs.readFileSync(path.join(data,t1Meta.data));assert.equal(t1.length,t1Meta.shape.reduce((a,b)=>a*b,1));
if(manifest.template.sha256)assert.equal(sha(t1),manifest.template.sha256);
// Scientific asset regressions: complete DK hemispheres and original annotation IDs.
const dk=manifest.atlases.dk;
assert.equal(dk.labels.length,68);
for(const hemi of ['L','R']){
  assert.equal(dk.labels.filter(l=>l.hemisphere===hemi).length,34);
  assert(dk.labels.find(l=>l.hemisphere===hemi&&l.sourceName==='insula')?.voxels>0);
}
for(const mesh of manifest.meshes.filter(m=>m.id.startsWith('cortex-'))){
  const model=JSON.parse(fs.readFileSync(path.join(data,mesh.file),'utf8'));
  assert.equal(model.vertexLabels.length,model.positions.length/3,'One original annotation per pial vertex');
  assert.equal(new Set(model.vertexLabels.filter(n=>n>0)).size,34,'Every DK label survives decimation');
}
const histology=manifest.atlases['ba-histology'];
const histBytes=fs.readFileSync(path.join(data,histology.data));
const probabilities=fs.readFileSync(path.join(data,histology.probability));
assert.equal(histBytes.length,probabilities.length);
assert.equal(sha(probabilities),histology.probabilitySha256);
for(let i=0;i<histBytes.length;i++)if(histBytes[i])assert(probabilities[i]>=25&&probabilities[i]<=100,'Histological label must meet published threshold');
assert.equal(new Set(histology.labels.map(l=>l.ba)).size,9);
for(const id of ['aal','aal3']){
  const atlas=manifest.atlases[id];assert(atlas.available&&atlas.canViewInNativeSpace,`Native atlas must remain usable: ${id}`);
  assert.equal(atlas.canOverlayOnTarget,false,'Native Colin27 must not be treated as FSL');
  assert.equal(atlas.alignmentStatus,'native-space');
}
for(const [id,count] of [['aal',116],['aal3',166],['aal-registered',116],['aal3-registered',166]]){
  const atlas=manifest.atlases[id];assert.equal(atlas.positiveLabelCount,count);assert.equal(atlas.labels.length,count);
  assert(atlas.labels.every(label=>label.voxels>0),`Empty AAL label: ${id}`);
  assert(atlas.publicRedistributionReady&&atlas.licenseNotice,`Missing AAL publication evidence: ${id}`);
  if(id.endsWith('-registered')){
    assert.equal(atlas.canOverlayOnTarget,true);assert.equal(atlas.alignmentStatus,'registered-estimate');
    assert.equal(atlas.registeredSpace,'MNI152NLin6Asym');assert.equal(atlas.fieldResolutionMm,2);assert.equal(atlas.outputGridResolutionMm,1);
    assert(atlas.limitations?.length&&atlas.review,`Missing estimated-registration limits: ${id}`);
  }
}
const aalReview=JSON.parse(fs.readFileSync(path.join(data,'aal-v3/root-review.json'),'utf8'));
const projections=JSON.parse(fs.readFileSync(path.join(data,'surface-v1/manifest.json'),'utf8'));
for(const [id,projection]of Object.entries(projections.atlases)){
  const atlas=manifest.atlases[id];assert.equal(sha(fs.readFileSync(path.join(data,projection.sourceVolume))),projection.sourceSha256);
  assert.equal(atlas.surfaceProjection,'surface-v1/manifest.json');assert.equal(projection.sourceSha256,atlas.sha256);
  for(const [hemi,entry]of Object.entries(projection.hemispheres)){
    const bytes=fs.readFileSync(path.join(data,entry.file));assert.equal(sha(bytes),entry.sha256);assert.equal(bytes.length,entry.vertices*2);
    const pial=JSON.parse(fs.readFileSync(path.join(data,entry.pialFile),'utf8'));
    assert.equal(sha(fs.readFileSync(path.join(data,entry.pialFile))),entry.pialSha256);assert.equal(sha(fs.readFileSync(path.join(data,entry.whiteFile))),entry.whiteSha256);
    assert.equal(pial.positions.length/3,entry.vertices);const allowed=new Set(entry.allowedLabelIds);let labelled=0;
    for(let i=0;i<entry.vertices;i++){const value=bytes.readUInt16LE(i*2);if(value){assert(allowed.has(value));assert(pial.vertexLabels[i]>0);labelled++;}}
    assert(entry.allowedLabelIds.every(id=>atlas.labels.find(l=>l.id===id)?.name.endsWith(`_${hemi}`)));assert.equal(labelled,entry.ribbonLabelled);
    assert(entry.ribbonLabelled>=entry.pialOnlyLabelled);
  }
}
console.log('PASS shared brain: source-matched AAL surface labels, unchanged pial/white hashes, hemisphere and medial-wall guards');
assert.equal(aalReview.humanValidated,false,'AI visual review is not human anatomical certification');
assert.equal(sha(fs.readFileSync(path.join(data,'aal-v3/sources/colin27-to-fsl-dipy.npz'))),aalReview.fieldSha256);
assert.equal(sha(fs.readFileSync(path.join(data,'aal-v3/registration-qc.png'))),aalReview.observedQcSha256);
assert.equal(sha(fs.readFileSync(path.join(data,'aal-v3/label-resampling-report.json'))),aalReview.labelResamplingReportSha256);
assert.equal(manifest.atlases['ba-legacy'].canOverlayOnTarget,false);assert.equal(manifest.atlases['ba-legacy'].available,false);
for(const file of ['AAL-NOTICE.md','GNU-GPL-3.0.txt','readme_aal_for_SPM12.txt','AAL3-GPL-EVIDENCE.json','SPM12-LICENCE.txt','Colin27-LICENSE.txt'])assert(fs.statSync(path.join(data,'aal-v3/licenses',file)).size>0);
console.log('PASS AAL: native116/166 and estimated FSL116/166, source notices, unchanged reviewed field and explicit limits');
const anatomyFile=path.join(data,'anatomy/manifest.json');
if(fs.existsSync(anatomyFile)){
  const anatomy=JSON.parse(fs.readFileSync(anatomyFile,'utf8'));let genuine=0,schematic=0,remote=0;
  for(const [id,entry] of Object.entries(anatomy.structures)){
    assert(ids.has(id),`Geometry points to missing catalog structure ${id}`);
    if(entry.remoteGeometry){
      assert.equal(entry.geometry,null,'Remote anatomy must not point to a bundled file');
      assert.equal(entry.dataset,'PAM50');assert.equal(entry.remoteGeometry.sha256,entry.sourceSha256);
      assert(entry.remoteGeometry.url.startsWith('https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/609a18235d9143dad0d6bf5bb35e2bff9e55196f/'));
      assert(entry.nativeAffine.length===16&&entry.nativeAffine.every(Number.isFinite));remote++;continue;
    }
    if(!entry.geometry){assert.equal(entry.representation,'schematic');schematic++;continue;}
    const geometryPath=path.join(data,entry.geometry.replace(/^\/data\//,''));
    const bytes=fs.readFileSync(geometryPath);assert.equal(sha(bytes),entry.sha256,`Anatomy hash ${id}`);
    const geometry=JSON.parse(bytes);
    assert(entry.center.length===3&&entry.center.every(Number.isFinite));
    if(geometry.positions){assert(geometry.positions.every(Number.isFinite));assert(geometry.indices.every(i=>i>=0&&i<geometry.positions.length/3));}
    if(geometry.streamlines){for(const line of geometry.streamlines)assert(line.flat().every(Number.isFinite));}
    assert(entry.nativeSpace&&entry.source&&entry.limitations,`Missing provenance ${id}`);genuine++;
  }
  assert.equal(anatomy.structures['spinal-Co1'].representation,'schematic','No invented Co1 parcel');
  console.log(`PASS anatomy: ${genuine} bundled source-derived mappings, ${remote} on-demand source descriptors, ${schematic} explicit gaps; hashes and finite geometry`);
}
assert(structures.every(s=>s.evidence),'Every catalog structure must have an explicit evidence record');
{
  for(const s of structures)for(const field of ['anatomy','function','cognition','clinical']){
    assert(Array.isArray(s.evidence[field]),`Missing evidence field ${s.id} ${field}`);
    for(const item of s.evidence[field])assert(refs.has(item.refId)&&item.claim&&item.scope,`Unresolved evidence reference ${s.id}/${field}/${item.refId}`);
  }
  console.log(`PASS evidence: ${structures.length} structures have four claim-level fields with valid reference links`);
}
console.log('PASS precision: DK68 paired annotations, AAL native/estimated-space guards, BA probability thresholds and unavailable legacy BA');
console.log(`PASS catalog: ${structures.length} structures, ${references.length} references, 31 cord segments, all cross-references and hemispheres valid`);
console.log(`PASS geometry: ${manifest.meshes.length} mesh assets, T1 size/hash, RAS/radiological conventions`);

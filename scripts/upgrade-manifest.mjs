// Combine versioned source manifests without overwriting preserved raw data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),data=path.join(root,'public/data');
const read=p=>JSON.parse(fs.readFileSync(path.join(data,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(data,p),JSON.stringify(v,null,2));
const file='manifest.json',m=read(file);
if(!fs.existsSync(path.join(data,'legacy-manifest-v1.json')))write('legacy-manifest-v1.json',m);
const legacy=read('legacy-manifest-v1.json');
const dk=read('dk-v2/metadata.json'),ba=read('ba-v2/manifest.json');
m.schemaVersion=2;m.generated='2026-10-26';m.version='4.0.0';m.edition='brain-evidence';
m.atlases.dk=dk;
m.atlases['ba-legacy']={...legacy.atlases.ba,available:false,data:null,alignmentStatus:'legacy',canOverlayOnTarget:false,canViewInNativeSpace:false,note:'保留 BrainNet 旧版 BA 41 个编号目录；精确配对 T1 与该版本数据许可尚未确认。待取得原始图谱、配对 T1 和坐标依据后再配准，当前不加载旧二进制。'};
Object.assign(m.atlases,ba.atlases);
m.meshes=m.meshes.filter(x=>!x.id.startsWith('cortex-'));
m.meshes.unshift(...dk.meshes.filter(x=>x.id.startsWith('cortex-')));
const hoStructure={3:'lateral-ventricle-l',4:'thalamus-l',5:'caudate-l',6:'putamen-l',7:'pallidum-l',9:'hippocampus-l',10:'amygdala-l',11:'accumbens-l',14:'lateral-ventricle-r',15:'thalamus-r',16:'caudate-r',17:'putamen-r',18:'pallidum-r',19:'hippocampus-r',20:'amygdala-r',21:'accumbens-r'};
for(const mesh of m.meshes){if(hoStructure[mesh.label])mesh.structureIds=[hoStructure[mesh.label]];}
m.registrationNote='脑内主参考为 FSL MNI152NLin6Asym。DK 分区与配对表面已核对同源模板；其余数据分别记录原作者映射、后续配准或未验证状态。相同 RAS 轴或相同体素网格不能证明解剖配准。';
m.schematicNote='PAM50 脊髓使用原生直化参考，未与脑模板联合配准。原始形态、项目定义分段和示意几何分别标注；无数据的示意默认隐藏。';
if(fs.existsSync(path.join(data,'space/alignment.json'))){
  const a=read('space/alignment.json');m.alignment='space/alignment.json';
  const entries=a.atlases||a.datasets||{};
  for(const [id,item] of Object.entries(entries))if(m.atlases[id]){
    m.atlases[id].alignmentStatus=item.status||item.alignmentStatus||m.atlases[id].alignmentStatus;
    if(typeof item.canOverlayOnTarget==='boolean')m.atlases[id].canOverlayOnTarget=item.canOverlayOnTarget;
  }
}
// Merge after historical alignment overrides: the old AAL entries described
// different files and must not overwrite reviewed native/registered variants.
const aal=read('aal-v3/manifest.json');
for(const id of ['aal','aal3','aal-registered','aal3-registered']){
  const entry=aal.atlases[id];
  if(!entry?.available||!entry.publicRedistributionReady||!entry.data?.startsWith('aal-v3/'))throw Error(`Incomplete AAL release: ${id}`);
  m.atlases[id]=entry;
}
m.aalSourceManifest='aal-v3/manifest.json';m.aalRegistrationReview='aal-v3/root-review.json';
m.atlases.ho.alignmentStatus??='published-template';m.atlases.jhu.alignmentStatus??='published-template';
m.anatomy='anatomy/manifest.json';m.baCoverage='ba-v2/manifest.json';
m.counts=Object.fromEntries(Object.entries(m.atlases).map(([id,atlas])=>[id,atlas.labels?.filter(label=>label.id>0&&label.voxels>0).length||0]));
write(file,m);
if(process.argv.includes('--manifest-only')){
  console.log(`Integrated DK ${dk.labels.length}, AAL ${aal.atlases.aal.positiveLabelCount}, AAL3 ${aal.atlases.aal3.positiveLabelCount}, native and registered variants; asset hashes deferred`);
  process.exit(0);
}
const hashes={generated:m.generated,algorithm:'SHA-256',files:{}};
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())scan(p);else if(entry.name!=='asset-checksums.json')hashes.files[path.relative(data,p).replaceAll('\\','/')]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
scan(data);write('asset-checksums.json',hashes);
console.log(`Integrated DK ${dk.labels.length}, AAL ${aal.atlases.aal.positiveLabelCount}, AAL3 ${aal.atlases.aal3.positiveLabelCount}, BA historical ${ba.historicalNumbers.length}, BA histology ${ba.histologicalNumbers.length} parents; ${Object.keys(hashes.files).length} asset hashes`);

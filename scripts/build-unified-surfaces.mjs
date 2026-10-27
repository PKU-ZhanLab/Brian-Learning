import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareVolume} from '../src/lib/volume.js';
import {projectRibbon,isAalCorticalLabel,RIBBON_DEPTHS} from '../src/lib/surface-projection.js';
const data=path.resolve(import.meta.dirname,'../public/data'),out=path.join(data,'surface-v1');
fs.mkdirSync(out,{recursive:true});
const read=name=>JSON.parse(fs.readFileSync(path.join(data,name),'utf8'));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(data,name))).digest('hex');
const aal=read('aal-v3/manifest.json'),report={schema:1,space:'MNI152NLin6Asym',method:'paired-ribbon-categorical-vote',depths:RIBBON_DEPTHS,background:'ignored; empty ribbons remain unlabelled',tieBreak:'smallest source ID',medialWall:'DK annotation 0 excluded',sourceMethod:'https://nilearn.github.io/stable/modules/generated/nilearn.surface.vol_to_surf.html',note:'Project implementation of categorical ribbon sampling; not an official AAL surface atlas. Registration uncertainty is unchanged.',atlases:{}};
for(const id of ['aal-registered','aal3-registered']){
  const meta=aal.atlases[id],bytes=fs.readFileSync(path.join(data,meta.data));
  const ArrayType=meta.dtype==='uint16'?Uint16Array:Uint8Array;
  const volume=prepareVolume(new ArrayType(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),meta);
  const cortical=meta.labels.filter(isAalCorticalLabel),allowedIds=new Set(cortical.map(l=>l.id));
  const entry={sourceVolume:meta.data,sourceSha256:hash(meta.data),corticalLabelIds:[...allowedIds],excludedFromCorticalSurface:meta.labels.filter(l=>!allowedIds.has(l.id)).map(l=>l.id),hemispheres:{}};
  for(const [side,hemi] of [['left','L'],['right','R']]){
    const pialFile=`dk-v2/cortex-${side}.json`,whiteFile=`dk-v2/white-${side}.json`,pial=read(pialFile),white=read(whiteFile);
    assert.deepEqual(pial.indices,white.indices);assert.equal(pial.positions.length,white.positions.length);
    const hemisphereIds=new Set(cortical.filter(l=>l.name.endsWith(`_${hemi}`)).map(l=>l.id));
    const {labels,support}=projectRibbon({pial:pial.positions,white:white.positions,sample:volume.sampleRAS,allowedIds:hemisphereIds,cortexMask:pial.vertexLabels});
    const file=`surface-v1/${id}-${side}.bin`,supportFile=`surface-v1/${id}-${side}-support.bin`;
    const encoded=Buffer.alloc(labels.length*2);for(let i=0;i<labels.length;i++)encoded.writeUInt16LE(labels[i],i*2);
    fs.writeFileSync(path.join(data,file),encoded);fs.writeFileSync(path.join(data,supportFile),support);
    let eligible=0,before=0,after=0;const counts={};
    for(let i=0;i<labels.length;i++){if(pial.vertexLabels[i]){eligible++;if(hemisphereIds.has(volume.sampleRAS(...pial.positions.slice(i*3,i*3+3))))before++;}if(labels[i]){after++;counts[labels[i]]=(counts[labels[i]]||0)+1;}}
    assert(after>=before);assert(Object.keys(counts).every(x=>hemisphereIds.has(+x)));
    entry.hemispheres[hemi]={file,supportFile,dtype:'uint16-le',vertices:labels.length,sha256:hash(file),pialFile,pialSha256:hash(pialFile),whiteFile,whiteSha256:hash(whiteFile),allowedLabelIds:[...hemisphereIds],eligibleVertices:eligible,pialOnlyLabelled:before,ribbonLabelled:after,unlabelled:eligible-after,labelVertexCounts:counts};
    console.log(`${id} ${hemi}: ${before}/${eligible} -> ${after}/${eligible} (${(100*after/eligible).toFixed(1)}%); geometry unchanged`);
  }
  report.atlases[id]=entry;
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');

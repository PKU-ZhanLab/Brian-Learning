// Source-backed metadata generation shared by the supported manifest rebuild.
// This module does not write files or modify its input. Changed source bytes are
// hashed afresh; missing/mismatched dictionaries and binary digests fail closed.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const fsl = 'https://ftp.nmr.mgh.harvard.edu/pub/dist/freesurfer/tutorial_packages_centos6/OSX/fsl_501/data/atlases/';
const relationPolicy = 'Only source-recorded concept mappings are exact-source. Cross-atlas similarities and unknown relationships are not inferred from names, coordinates or catalog order.';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const xmlLabels = text => new Map([...text.matchAll(/<label\s+[^>]*index="(\d+)"[^>]*>([^<]*)<\/label>/g)].map(m => [Number(m[1]),m[2].trim()]));
const explicitSide = name => /^(Left|Right)\b/.test(name) ? (name.startsWith('Left') ? 'L' : 'R') : /(?:_| )[LR]$/.test(name) ? name.at(-1) : 'U';

export function enrichAtlasIdentities(input, { root = path.resolve(import.meta.dirname, '..') } = {}) {
  const manifest = structuredClone(input);
  const files = new Map();
  const read = file => {
    if (!files.has(file)) files.set(file, fs.readFileSync(path.join(root,file)));
    return files.get(file);
  };
  const text = file => read(file).toString('utf8');
  const json = file => JSON.parse(text(file));
  const evidence = source => ({ ...source,sourceSha256:hash(read(source.sourceFile)) });
  const dkSource = json('data-sources/dk/sources.json').files.find(entry => entry.file === 'label/aparc.annot.ctab');
  assert(dkSource, 'DK source dictionary manifest entry is unavailable');
  const sources = {
    dk:{ sourceFile:'data-sources/dk/label/aparc.annot.ctab',sourceUrl:dkSource.url },
    aal:{ sourceFile:'data-sources/aal-official/aal1-spm12-mirror/ROI_MNI_V4.txt',sourceUrl:'https://github.com/Neurita/std_brains/blob/master/atlases/aal_SPM12/aal/ROI_MNI_V4.txt' },
    aal3:{ sourceFile:'data-sources/aal-official/AAL3_dist/ROI_MNI_V7_1mm_vol.txt',sourceUrl:'https://afni.nimh.nih.gov/pub/dist/atlases/aal/AAL3_dist.tgz' },
    ho:{ sourceFile:'data-sources/raw/HarvardOxford-Subcortical.xml',sourceUrl:fsl+'HarvardOxford-Subcortical.xml' },
    jhu:{ sourceFile:'data-sources/raw/JHU-labels.xml',sourceUrl:fsl+'JHU-labels.xml' },
    ba:{ sourceFile:'data-sources/ba/Talairach.xml',sourceUrl:fsl+'Talairach.xml' },
    'ba-histology':{ sourceFile:'data-sources/ba/Juelich.xml',sourceUrl:fsl+'Juelich.xml' },
    'ba-legacy':{
      sourceFile:'scripts/data_build.py',sourceUrl:'https://github.com/mingruixia/BrainNet-Viewer',status:'original-dictionary-unavailable',
      note:'Source dictionary absent from preserved checkout; script records numeric IDs extracted from original image. Hemisphere and tissue remain unknown.',
    },
  };
  assert.equal(hash(read(sources.dk.sourceFile)),dkSource.sha256,'DK source dictionary digest does not match its pinned source manifest');
  const extraction = text('scripts/dk_build.py');
  const rows = extraction.split('ROWS=[')[1]?.split('\ndef sha')[0];
  assert(rows,'DK extraction mapping is unavailable');
  const dkMappings = new Map([...rows.matchAll(/\('([^']+)'\s*,\s*'([^']+)'/g)].map(m=>[m[1],m[2]]));
  const relations = [];

  for (const [id,atlas] of Object.entries(manifest.atlases)) {
    const base = id.replace('-registered',''), source = sources[base];
    assert(source,`No source dictionary adapter for atlas ${id}`);
    assert(/^[a-f\d]{64}$/i.test(atlas.sha256),`Atlas ${id} has no valid artifact digest`);
    if (atlas.data) {
      const bytes = read(`public/data/${atlas.data}`);
      assert.equal(hash(bytes),atlas.sha256,`Atlas binary digest mismatch: ${id}`);
      const width = { uint8:1,uint16:2 }[atlas.dtype];
      assert(width,`Unsupported atlas dtype: ${id}`);
      assert.equal(bytes.length,atlas.shape.reduce((a,b)=>a*b,1)*width,`Atlas binary shape mismatch: ${id}`);
      const values = new Set();
      for (let i=0;i<bytes.length;i+=width) {
        const value = width===2 ? bytes.readUInt16LE(i) : bytes[i];
        if (value>0) values.add(value);
      }
      assert.deepEqual([...values].sort((a,b)=>a-b),atlas.labels.filter(l=>l.id>0).map(l=>l.id).sort((a,b)=>a-b),`Atlas dictionary IDs mismatch binary values: ${id}`);
    } else assert.equal(atlas.available,false,`Available atlas ${id} has no binary`);
    atlas.atlasId=id;
    atlas.atlasVersion=`sha256:${atlas.sha256}`;
    atlas.upstreamVersion=null;
    atlas.versionBasis='derived-artifact-sha256';
    atlas.upstreamVersionNote='Upstream dataset release version not independently verified; local artifact version uses the actual derived binary digest.';
    atlas.spaceId=atlas.space;
    atlas.labelMetadataSource=evidence(source);

    const sourceText=text(source.sourceFile), lines=sourceText.split(/\r?\n/), xml=xmlLabels(sourceText);
    for (const label of atlas.labels) {
      let locator, hemisphere='U',tissue='unknown';
      let hemisphereBasis='Source dictionary does not specify laterality; no coordinate inference.';
      let tissueBasis='Source dictionary does not encode a tissue category; unknown retained.';
      // A prior generated structureIdSource cannot certify a different input.
      delete label.structureIdSource;
      if (base==='dk') {
        const line=lines.findIndex(s=>s.trim().split(/\s+/)[1]===label.sourceName);
        assert(line>=0,`DK source dictionary annotation is unavailable: ${label.sourceName}`);
        const annotationId=Number(lines[line].trim().split(/\s+/)[0]);
        const offset={L:1000,R:2000}[label.hemisphere];
        assert(offset&&label.sourceId===offset+annotationId,`DK source dictionary hemisphere/ID mismatch: ${label.sourceName}`);
        const slug=dkMappings.get(label.sourceName),expected=`${slug}-${label.hemisphere.toLowerCase()}`;
        assert(slug&&label.structureId===expected,`DK source concept mapping mismatch: ${label.sourceName}`);
        locator=`${source.sourceFile}:line ${line+1}; annotation ${label.sourceName}; sourceId ${label.sourceId}`;
        hemisphere=label.hemisphere;tissue='gray-matter';
        hemisphereBasis=`Recorded ${hemisphere} cortical annotation; original FreeSurfer sourceId ${label.sourceId}; scripts/dk_build.py:73-81`;
        tissueBasis='Cortical aparc annotation extraction only; scripts/dk_build.py:73-81 (not aseg white matter labels).';
        label.structureIdSource=evidence({ sourceFile:'scripts/dk_build.py',sourceUrl:source.sourceUrl,sourceLocator:`scripts/dk_build.py:ROWS ${label.sourceName}; ${locator}; hemisphere ${hemisphere}; structureId ${label.structureId}` });
      } else if (base==='aal'||base==='aal3') {
        const line=lines.findIndex(s=>{const c=s.trim().split(/\s+/);return Number(c[2])===label.id;});
        assert(line>=0&&lines[line].trim().split(/\s+/)[1]===label.name,`Original AAL dictionary mismatch: ${id}:${label.id}`);
        locator=`${source.sourceFile}:line ${line+1}; labelId ${label.id}; ${label.name}`;
        // The suffix is used only after matching the original dictionary row.
        if (/_[LR]$/.test(label.name)) { hemisphere=label.name.at(-1);hemisphereBasis='Explicit _L/_R suffix in the original label dictionary.'; }
      } else if (['ho','jhu','ba-histology'].includes(base)) {
        const index=base==='jhu'?label.id:label.id-1;
        const originalName=xml.get(index);
        assert.equal(originalName,label.name,`Original XML dictionary mismatch: ${id}:${label.id}`);
        locator=`${source.sourceFile}://label[@index="${index}"]; ${label.name}`;
        hemisphere=explicitSide(originalName);
        if (hemisphere!=='U') hemisphereBasis='Explicit Left/Right prefix or L/R suffix in the original dictionary.';
        if (base==='jhu'&&label.id>0) {
          assert(sourceText.includes('White-Matter Labels'),'JHU dictionary tissue header is unavailable');
          tissue='white-matter';tissueBasis='Original XML header: JHU ICBM-DTI-81 White-Matter Labels.';
        }
        if (base==='ba-histology') {
          assert(originalName.startsWith('GM '),'Juelich dictionary does not encode GM');
          tissue='gray-matter';tissueBasis='Explicit GM prefix in original Juelich label.';
        }
        if (base==='ho') {
          if (originalName.includes('White Matter')) { tissue='white-matter';tissueBasis='Explicit White Matter in original label.'; }
          if (originalName.includes('Cerebral Cortex')) { tissue='gray-matter';tissueBasis='Explicit Cerebral Cortex in original label.'; }
          if (/Ventric(le|al)/.test(originalName)) { tissue='csf';tissueBasis='Explicit ventricle label in original dictionary (source spelling preserved).'; }
        }
      } else if (base==='ba') {
        const originals=[...xml.values()].filter(name=>name.endsWith(`.Brodmann area ${label.id}`));
        assert(originals.length,`Original Talairach dictionary BA${label.id} is unavailable`);
        locator=`${source.sourceFile}://label[substring-after(text(),'.Brodmann area ')='${label.id}']; aggregation scripts/ba_build.py:34-45`;
        if (originals.some(s=>s.startsWith('Left '))&&originals.some(s=>s.startsWith('Right '))) {
          hemisphere='B';hemisphereBasis='Original Talairach Left and Right source labels explicitly merged into the same BA integer; scripts/ba_build.py:34-45.';
        }
        if (originals.every(s=>s.includes('.Gray Matter.'))) { tissue='gray-matter';tissueBasis='All aggregated original Talairach labels explicitly identify Gray Matter.'; }
      } else locator=`scripts/data_build.py:149-152; original numeric label ${label.id}; ${label.name}`;
      label.hemisphere=hemisphere;label.tissue=tissue;
      label.labelMetadataSource={ ...atlas.labelMetadataSource,sourceLocator:locator,hemisphereBasis,tissueBasis };
      if (base==='dk') relations.push({
        region:{atlasId:id,atlasVersion:atlas.atlasVersion,labelId:label.id,hemisphere,spaceId:atlas.spaceId},
        conceptId:label.structureId,type:'exact-source',sourceUrl:label.structureIdSource.sourceUrl,sourceLocator:label.structureIdSource.sourceLocator,
        sourceTissue:tissue,targetTissue:'gray-matter',
      });
    }

    const spaceFile=id==='dk'?'public/data/dk-v2/metadata.json':/^aal/.test(id)?'public/data/aal-v3/manifest.json':id==='ba'||id==='ba-histology'?'public/data/ba-v2/manifest.json':'scripts/data_build.py';
    const locator=id==='dk'?`${spaceFile}#/space`:spaceFile.endsWith('.json')?`${spaceFile}#/atlases/${id}/space`:`${spaceFile}${id==='ho'?':144-146':id==='jhu'?':147-148':':149-152'}; original space declaration`;
    const spaceText=text(spaceFile),pointer=locator.split('#/')[1];
    if (pointer) assert.equal(pointer.split('/').reduce((v,k)=>v?.[k],JSON.parse(spaceText)),atlas.spaceId,`Source space declaration mismatch: ${id}`);
    else assert(spaceText.includes(atlas.spaceId),`Source space declaration is unavailable: ${id}`);
    atlas.spaceIdentitySource=evidence({spaceId:atlas.spaceId,sourceUrl:atlas.source,sourceFile:spaceFile,sourceLocator:locator,alignmentStatus:atlas.alignmentStatus,note:'Recorded source-space declaration only. Template uncertainty and registration-estimate status are preserved; this reference does not certify anatomical alignment.'});
  }
  manifest.regionRelations='atlas-region-relations.json';
  return { manifest,relations:{schemaVersion:1,policy:relationPolicy,relations} };
}

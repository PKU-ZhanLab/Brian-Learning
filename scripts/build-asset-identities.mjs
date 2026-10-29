import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file));
const json=file=>JSON.parse(read(file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=json('public/data/manifest.json');
const asset=(file,spaceId=null,version=null)=>{const bytes=read(file),sha256=hash(bytes);return {id:file,version:version||`sha256:${sha256}`,sha256,spaceId};};
const sourceFiles={dk:['data-sources/dk/mri/aparc+aseg_182x218x182.nii.gz','data-sources/dk/mri/orig.mgz','scripts/dk_build.py','data-sources/raw/MNI152_T1_2mm_brain.nii.gz'],ho:['data-sources/raw/HarvardOxford-sub.nii.gz','scripts/data_build.py','data-sources/raw/HarvardOxford-fs-labels.txt'],jhu:['data-sources/raw/JHU.nii.gz','scripts/data_build.py'],ba:['data-sources/ba/Talairach-labels-2mm.nii.gz','scripts/ba_build.py'],'ba-histology':['data-sources/ba/Juelich-maxprob-thr25-2mm.nii.gz','data-sources/ba/Juelich-prob-2mm.nii.gz','scripts/ba_build.py'],aal:['data-sources/aal-official/aal1-spm12-mirror/ROI_MNI_V4.nii.gz','scripts/aal_build.py'],aal3:['data-sources/aal-official/AAL3_dist/AAL3v1_1mm.nii','scripts/aal_build.py']};
const entries={};
for(const [id,metadata] of Object.entries(manifest.atlases)) {
  if(!metadata.available||!metadata.data)continue;
  const file=`public/data/${metadata.data}`,identity=asset(file,metadata.spaceId,metadata.atlasVersion);
  if(identity.sha256!==metadata.sha256)throw Error(`Atlas byte mismatch: ${id}`);
  const base=id.replace('-registered','');
  const sourceIdentities=sourceFiles[base].map(file=>asset(file));
  if(metadata.labelMetadataSource?.sourceFile)sourceIdentities.push(asset(metadata.labelMetadataSource.sourceFile));
  const transforms=[];
  const verificationFiles=[];
  if(metadata.transformFile){
    const transformPath=`public/data/${metadata.transformFile}`,transformIdentity=asset(transformPath);
    transforms.push({id:transformPath,sha256:transformIdentity.sha256});verificationFiles.push({path:metadata.transformFile,sha256:transformIdentity.sha256});
    const intermediate=`public/data/aal-v3/sources/${base}-on-fsl-1mm.nii.gz`;
    const intermediateIdentity=asset(intermediate,metadata.spaceId);
    if(intermediateIdentity.sha256!==metadata.sourceSha256)throw Error(`Registered source byte mismatch: ${id}`);
    sourceIdentities.push(intermediateIdentity,asset(`public/data/${manifest.atlases[base].data}`,manifest.atlases[base].spaceId),asset('data-sources/raw/MNI152_T1_2mm_brain.nii.gz'),asset('data-sources/aal-official/spm12-single_subj_T1.nii'),asset('scripts/aal_apply_registration.py'),asset('scripts/register_volume.py'));
    if(sourceIdentities[0].sha256!==metadata.originalSourceSha256)throw Error(`Original source byte mismatch: ${id}`);
  }else if(metadata.sourceSha256&&sourceIdentities[0].sha256!==metadata.sourceSha256)throw Error(`Source byte mismatch: ${id}`);
  if(metadata.probability){
    const probability=asset(`public/data/${metadata.probability}`,metadata.spaceId);
    if(probability.sha256!==metadata.probabilitySha256)throw Error(`Probability byte mismatch: ${id}`);
    sourceIdentities.push(probability);verificationFiles.push({path:metadata.probability,sha256:probability.sha256});
  }
  entries[metadata.data]={identity,sourceIdentities,transforms,verificationFiles,sourceGrid:{shape:metadata.shape,affine:metadata.affine.flat(),space:metadata.spaceId,order:metadata.order},spatialEvidence:{space:metadata.spaceId,alignmentStatus:metadata.alignmentStatus,canOverlayOnTarget:metadata.canOverlayOnTarget,source:metadata.source,spaceIdentitySource:metadata.spaceIdentitySource,fieldResolutionMm:metadata.fieldResolutionMm??null,outputGridResolutionMm:metadata.outputGridResolutionMm??null,registrationReport:metadata.registrationReport??null,limitations:[metadata.note,...(metadata.limitations||[]),...(metadata.transformFile?['Project estimated transformation; output spacing is not anatomical registration accuracy.']:[])].filter(Boolean),sourceVerification:'Original dependencies hashed from preserved local files during build; received binary and public transform bytes are verified separately at load.'}};
}
for(const metadata of [json('public/data/volume.json'),json('public/data/aal-v3/manifest.json').nativeTemplate]){
  const identity=asset(`public/data/${metadata.data}`,metadata.space);
  if(identity.sha256!==metadata.sha256)throw Error(`Template byte mismatch: ${metadata.data}`);
  const sourceFile=metadata.data==='t1.bin'?'data-sources/raw/MNI152_T1_2mm_brain.nii.gz':'data-sources/aal-official/spm12-single_subj_T1.nii';
  const original=asset(sourceFile);if(original.sha256!==metadata.sourceSha256)throw Error(`Template source mismatch: ${sourceFile}`);
  entries[metadata.data]={identity,sourceIdentities:[original],transforms:[],verificationFiles:[],sourceGrid:{shape:metadata.shape,affine:metadata.affine.flat(),space:metadata.space,order:metadata.order},spatialEvidence:{space:metadata.space,source:metadata.source,limitations:[metadata.normalization].filter(Boolean)}};
}
const output=JSON.stringify({schema:'neuroatlas-asset-identities-v1',hashDefinition:'SHA-256 of exact file bytes; compressed sources remain compressed. Build observations do not certify historical computations or anatomical registration.',assets:entries},null,2)+'\n';
const destination=path.join(root,'public/data/asset-identities.json');
if(process.argv.includes('--check')){if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==output)throw Error('asset-identities.json is missing or stale');console.log(`Verified ${Object.keys(entries).length} volume identities and their cataloged source/transform bytes.`);}else{fs.writeFileSync(destination,output);console.log(`Wrote ${Object.keys(entries).length} volume identities.`);}

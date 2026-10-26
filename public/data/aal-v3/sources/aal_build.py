"""Build source-preserving AAL assets; never silently overlay native Colin27 on FSL."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile
import numpy as np
import nibabel as nib
from nibabel.processing import resample_from_to

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources/aal-official'
OUT=ROOT/'public/data/aal-v3'
SOURCE='https://www.gin.cnrs.fr/en/tools/aal/'


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def dump(path,data):Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')


def labels_from(path):
    labels=[]
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        fields=line.split()
        if len(fields)>=3 and fields[2].isdigit():labels.append({'id':int(fields[2]),'name':fields[1]})
    return labels


def export(key,path,labels):
    im=nib.as_closest_canonical(nib.load(path));data=np.rint(im.get_fdata()).astype(np.uint16)
    assert set(np.unique(data))-{0}=={row['id'] for row in labels}
    dtype=np.dtype('u1') if data.max()<256 else np.dtype('<u2');data=data.astype(dtype)
    file=OUT/(key+'.bin');file.write_bytes(data.tobytes(order='F'))
    enriched=[]
    for row in labels:
        idx=np.argwhere(data==row['id']);center=nib.affines.apply_affine(im.affine,idx.mean(axis=0))
        enriched.append({**row,'voxels':len(idx),'volumeMm3':float(len(idx)*abs(np.linalg.det(im.affine[:3,:3]))),'center':center.round(3).tolist()})
    return {'available':True,'data':file.relative_to(ROOT/'public/data').as_posix(),'shape':list(im.shape),
        'affine':im.affine.ravel().tolist(),'dtype':'uint8' if dtype.itemsize==1 else 'uint16','order':'x-fastest',
        'labels':enriched,'positiveLabelCount':len(enriched),'sha256':sha(file),'sourceSha256':sha(path),
        'voxelSizeMm':nib.affines.voxel_sizes(im.affine).tolist(),'nativeSpace':'Colin27 / MNI single-subject (SPM canonical)',
        'registeredSpace':None,'space':'Colin27 / MNI single-subject','alignmentStatus':'native-space',
        'canOverlayOnTarget':False,'canViewInNativeSpace':True,'coordinateSystem':'RAS','units':'mm'}


def main():
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'sources').mkdir(exist_ok=True);(OUT/'licenses').mkdir(exist_ok=True)
    aal_path=RAW/'aal1-spm12-mirror/ROI_MNI_V4.nii.gz'
    aal3_path=RAW/'AAL3_dist/AAL3v1_1mm.nii'
    a=export('aal-native',aal_path,labels_from(RAW/'aal1-spm12-mirror/ROI_MNI_V4.txt'))
    b=export('aal3-native',aal3_path,labels_from(RAW/'AAL3_dist/ROI_MNI_V7_1mm_vol.txt'))
    a.update({'name':'AAL116 — native Colin27','source':SOURCE,'sourceDistribution':'2015 SPM12 original files preserved by Neurita/std_brains mirror',
        'sourceDownload':'https://github.com/Neurita/std_brains/tree/master/atlases/aal_SPM12/aal',
        'license':'GNU GPL; this distribution elects GPL-3.0 (author README specifies no version)',
        'licenseStatus':'GPL grant in preserved original README; complete available source and full GPL supplied',
        'licenseNotice':'aal-v3/licenses/AAL-NOTICE.md','publicRedistributionReady':True,
        'note':'116 original positive label IDs (2001–9170), preserved without renumbering. Native atlas; no FSL overlay without an explicitly reviewed transform.',
        'citation':'Tzourio-Mazoyer et al. (2002), NeuroImage 15:273–289. DOI:10.1006/nimg.2001.0978'})
    b.update({'name':'AAL3 — native Colin27 (2020 atlas geometry)','source':SOURCE,
        'sourceDistribution':'NIH AFNI distribution of GIN AAL3v1; 2024 AAL3v2 guide states atlas geometry unchanged',
        'sourceDownload':'https://afni.nimh.nih.gov/pub/dist/atlases/aal/AAL3_dist.tgz',
        'license':'GNU GPL; this distribution elects GPL-3.0 (author guide specifies no version)',
        'licenseStatus':'Primary guide states GPL and unchanged v1 geometry; NIH original data and full GPL supplied; exact2024 README not acquired',
        'licenseNotice':'aal-v3/licenses/AAL-NOTICE.md','publicRedistributionReady':True,
        'note':'166 positive regions at 1 mm; original IDs 1–170 with 35,36,81,82 absent. Small nuclei are template labels, not subject-specific localization.',
        'citation':'Rolls et al. (2020), NeuroImage 206:116189. DOI:10.1016/j.neuroimage.2019.116189'})
    t1=nib.as_closest_canonical(nib.load(RAW/'spm12-single_subj_T1.nii'));v=t1.get_fdata()
    v=np.rint(np.clip(v/np.percentile(v[v>0],99.8),0,1)*255).astype(np.uint8)
    (OUT/'colin27-t1.bin').write_bytes(v.tobytes(order='F'))
    template={'name':'SPM12 canonical single_subj_T1 (Colin27)','data':'aal-v3/colin27-t1.bin','shape':list(t1.shape),
        'affine':t1.affine.ravel().tolist(),'dtype':'uint8','order':'x-fastest','space':'Colin27 / MNI single-subject',
        'source':'https://github.com/spm/spm12/blob/main/canonical/single_subj_T1.nii','license':'SPM GPL-2.0-or-later; MNI attribution',
        'sha256':sha(OUT/'colin27-t1.bin'),'sourceSha256':sha(RAW/'spm12-single_subj_T1.nii')}
    for atlas in [a,b]:atlas['nativeTemplate']=template
    x=nib.load(RAW/'AAL3_dist/AAL3v1.nii');y=nib.load(ROOT/'data-sources/raw/AAL3v2.nii.gz')
    comparison={'nihVsPriorBrainNetAAL3':{'voxelArraysExactlyEqual':bool(np.array_equal(x.get_fdata(),y.get_fdata())),
        'affinesExactlyEqual':bool(np.array_equal(x.affine,y.affine)),
        'nihSha256':sha(RAW/'AAL3_dist/AAL3v1.nii'),'priorBrainNetSha256':sha(ROOT/'data-sources/raw/AAL3v2.nii.gz')},
        'authorV2ReleaseNote':{'url':'https://www.gin.cnrs.fr/wp-content/uploads/AAL3_UserGuide_April2024.pdf',
        'observedVia':'Search-indexed primary PDF text, 2026-10-26; direct PDF fetch failed',
        'facts':['2024-04-05 v2 adds GPL notice to README','Atlas geometry unchanged; atlas filenames remain AAL3v1'],
        'downloadedOriginalPdf':False},
        'sourceTemplateIdentity':{'source':'https://www.oxcns.org/papers/607%20Rolls%20Huang%20Lin%20Feng%20Joliot%202020%20AAL3.pdf',
        'support':'Section 2.1 identifies Colin27 as the single-subject T1 used in AAL. SPM canonical single_subj_T1 is the 2mm Colin27 release.',
        'spmIdentitySource':'https://imaging.mrc-cbu.cam.ac.uk/imaging/MniTalairach',
        'gridEqualityIsNotAnatomicalRegistration':True}}
    dump(OUT/'source-audit.json',comparison)
    # The exact archived bytes and the complete available original AAL source are retained.
    shutil.copyfile(RAW/'AAL3_dist.tgz',OUT/'sources/AAL3_dist.tgz')
    shutil.copyfile(aal_path,OUT/'sources/ROI_MNI_V4.nii.gz')
    shutil.copyfile(RAW/'spm12-single_subj_T1.nii',OUT/'sources/spm12-single_subj_T1.nii')
    with zipfile.ZipFile(OUT/'sources/aal1-spm12-mirrored-source.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
        for f in sorted((RAW/'aal1-spm12-mirror').glob('*')):
            if f.is_file():z.write(f,'aal/'+f.name)
    shutil.copyfile(RAW/'aal1-spm12-mirror/readme_aal_for_SPM12.txt',OUT/'licenses/readme_aal_for_SPM12.txt')
    shutil.copyfile(RAW/'spm12-LICENCE.txt',OUT/'licenses/SPM12-LICENCE.txt')
    shutil.copyfile(RAW/'GNU-GPL-3.0.txt',OUT/'licenses/GNU-GPL-3.0.txt')
    for script in ['aal_build.py','aal_prepare_registration.py','aal_apply_registration.py','aal_validate.py','register_volume.py']:
        shutil.copyfile(ROOT/'scripts'/script,OUT/'sources'/script)
    manifest={'schemaVersion':1,'generated':'2026-10-26','targetSpace':'MNI152NLin6Asym','nativeTemplate':template,
        'atlases':{'aal':a,'aal3':b},'sourceAudit':'aal-v3/source-audit.json',
        'policy':'Native viewing and lookup are available. Same world coordinates do not authorize native-to-FSL overlay. Preserve originals and inspect registration QC.',
        'publicRedistributionReady':True,'registrationCli':'scripts/register_volume.py'}
    candidate=RAW/'colin27-spm-to-fsl/registration-report.json'
    if candidate.exists():
        report=json.loads(candidate.read_text());manifest['registrationCandidate']={'report':'aal-v3/registration-report.json',
            'qc':'aal-v3/registration-qc.png','status':report['status'],'numericalChecksPassed':report['numericalChecksPassed'],
            'canOverlayOnTarget':False}
        shutil.copyfile(candidate,OUT/'registration-report.json');shutil.copyfile(candidate.parent/'registration-qc.png',OUT/'registration-qc.png')
        if (candidate.parent/'label-resampling-report.json').exists():
            shutil.copyfile(candidate.parent/'label-resampling-report.json',OUT/'label-resampling-report.json')
            manifest['registrationCandidate']['labelResamplingReport']='aal-v3/label-resampling-report.json'
            review_path=candidate.parent/'root-review.json'
            review=json.loads(review_path.read_text()) if review_path.exists() else None
            reviewed=bool(review and review.get('fieldSha256')==sha(candidate.parent/'mapping.npz')
                and review.get('labelResamplingReportSha256')==sha(candidate.parent/'label-resampling-report.json')
                and review.get('observedQcSha256')==sha(candidate.parent/'registration-qc.png'))
            if reviewed:
                shutil.copyfile(review_path,OUT/'root-review.json')
                manifest['registrationCandidate'].update({'status':'registered-estimate','canOverlayOnTarget':True,
                    'review':'aal-v3/root-review.json','allLabelsRetainedAt1mm':True,
                    'fieldNumericalChecksPassed':all(flag=='one or more source labels absent on output grid' for flag in report['qualityFlags']),
                    'original2mmOutputLostLabelIds':report['lostPositiveLabelIds'],
                    'note':'2mm report has label134 loss; reviewed1mm derivative retains all labels. Field estimated at2mm.'})
            shutil.copyfile(candidate.parent/'mapping.npz',OUT/'sources/colin27-to-fsl-dipy.npz')
            for key,native in [('aal',a),('aal3',b)]:
                path=candidate.parent/(key+'-on-fsl-1mm.nii.gz')
                variant=export(key+'-fsl1mm',path,[{'id':r['id'],'name':r['name']} for r in native['labels']])
                variant.update({'name':native['name'].split(' — ')[0]+' — FSL registration candidate',
                    'space':'MNI152NLin6Asym','nativeSpace':native['nativeSpace'],'registeredSpace':'MNI152NLin6Asym',
                    'alignmentStatus':'registered-estimate' if reviewed else 'registered-unreviewed','canOverlayOnTarget':reviewed,
                    'canViewInNativeSpace':False,'source':native['source'],'license':native['license'],'publicRedistributionReady':True,
                    'licenseNotice':'aal-v3/licenses/AAL-NOTICE.md',
                    'fieldResolutionMm':2,'outputGridResolutionMm':1,
                    'registrationReport':'aal-v3/registration-report.json','registrationQc':'aal-v3/registration-qc.png',
                    'originalSourceSha256':native['sourceSha256'],
                    'transformFile':'aal-v3/sources/colin27-to-fsl-dipy.npz',
                    'note':'项目估计配准：2mm变换场，1mm标签采样；保留全部标签，不代表1mm定位精度。三正交中心切片经AI核图；并非官方变换或人工解剖认证。2mm采样会丢失AAL3标签134。',
                    'limitations':review['limitations'] if reviewed else ['Source/registration review pending.'],
                    'review':'aal-v3/root-review.json' if reviewed else None})
                native['registeredCandidate']=variant
                manifest['atlases'][key+'-registered']=variant
                shutil.copyfile(path,OUT/'sources'/path.name)
        if (RAW/'source-template-identity.json').exists():
            shutil.copyfile(RAW/'source-template-identity.json',OUT/'source-template-identity.json')
            manifest['sourceTemplateIdentity']='aal-v3/source-template-identity.json'
        if (RAW/'Colin27-LICENSE.txt').exists():shutil.copyfile(RAW/'Colin27-LICENSE.txt',OUT/'licenses/Colin27-LICENSE.txt')
    dump(OUT/'manifest.json',manifest)
    dump(OUT/'checksums.json',{f.relative_to(OUT).as_posix():sha(f) for f in OUT.rglob('*') if f.is_file() and f.name!='checksums.json'})
    print(json.dumps({'aal':a['positiveLabelCount'],'aal3':b['positiveLabelCount'],'sourceAudit':comparison['nihVsPriorBrainNetAAL3']},indent=2))


if __name__=='__main__':main()

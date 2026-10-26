"""Check atlas bytes, geometry, IDs, centers and preserved-source equivalence."""
from pathlib import Path
import json
import hashlib
import numpy as np
import nibabel as nib

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/aal-v3'


def main():
    manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    expected={'aal':ROOT/'data-sources/aal-official/aal1-spm12-mirror/ROI_MNI_V4.nii.gz',
              'aal3':ROOT/'data-sources/aal-official/AAL3_dist/AAL3v1_1mm.nii',
              'aal-registered':ROOT/'data-sources/aal-official/colin27-spm-to-fsl/aal-on-fsl-1mm.nii.gz',
              'aal3-registered':ROOT/'data-sources/aal-official/colin27-spm-to-fsl/aal3-on-fsl-1mm.nii.gz'}
    checks=[]
    for key,item in manifest['atlases'].items():
        file=ROOT/'public/data'/item['data'];dtype=np.dtype('u1' if item['dtype']=='uint8' else '<u2')
        values=np.frombuffer(file.read_bytes(),dtype=dtype).reshape(item['shape'],order='F')
        source=nib.as_closest_canonical(nib.load(expected[key]));affine=np.asarray(item['affine']).reshape(4,4)
        assert np.array_equal(values,source.get_fdata())
        assert np.array_equal(affine,source.affine)
        assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256']
        positive=set(np.unique(values))-{0};assert positive=={r['id'] for r in item['labels']}
        assert len(positive)==item['positiveLabelCount']==(116 if key.startswith('aal-') or key=='aal' else 166)
        for row in item['labels']:
            idx=np.argwhere(values==row['id']);center=nib.affines.apply_affine(affine,idx.mean(axis=0))
            assert len(idx)==row['voxels']>0 and np.allclose(center,row['center'],atol=.001)
            if row['name'].endswith('_L'):assert center[0]<0,(key,row['name'],center)
            if row['name'].endswith('_R'):assert center[0]>0,(key,row['name'],center)
        if key.endswith('-registered'):
            assert item['canOverlayOnTarget'] and item['alignmentStatus']=='registered-estimate'
            assert item['registeredSpace']=='MNI152NLin6Asym'
        else:assert item['canViewInNativeSpace'] and not item['canOverlayOnTarget']
        checks.append({'atlas':key,'positiveLabels':len(positive),'bytes':file.stat().st_size,
                       'matchesDeclaredInputVoxelsAndAffine':True,'lateralityAndCentersPassed':True,
                       'inputKind':'registered derivative' if key.endswith('-registered') else 'original native atlas'})
    for file,digest in json.loads((OUT/'checksums.json').read_text()).items():
        assert hashlib.sha256((OUT/file).read_bytes()).hexdigest()==digest,file
    report={'passed':True,'checks':checks,'scope':'Native and registered exports, actual label coverage, laterality, centers and recorded hashes; not human anatomical certification.'}
    (ROOT/'data-sources/aal-official/validation.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()

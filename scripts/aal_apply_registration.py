"""Sample original AAL labels once onto a 1mm FSL-space grid using saved field.

The field is estimated at 2mm; a 1mm label grid does not add registration accuracy.
It avoids deleting the smallest parcels merely through 2mm grid sampling.
"""
from pathlib import Path
import hashlib
import json
import nibabel as nib
import numpy as np
from nibabel.processing import resample_to_output
from register_volume import load_mapping, apply_labels

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources/aal-official'
REG=RAW/'colin27-spm-to-fsl'


def main():
    fixed=nib.as_closest_canonical(nib.load(ROOT/'data-sources/raw/MNI152_T1_2mm_brain.nii.gz'))
    grid=resample_to_output(fixed,voxel_sizes=(1,1,1),order=1)
    mapping=load_mapping(REG/'mapping.npz');source_files={'aal':RAW/'aal1-spm12-mirror/ROI_MNI_V4.nii.gz',
        'aal3':RAW/'AAL3_dist/AAL3v1_1mm.nii'}
    report={'fieldResolutionMm':2,'outputGridResolutionMm':1,'targetSpace':'MNI152NLin6Asym',
        'method':'Saved 2mm affine+SDR field; single nearest-neighbour sampling of original labels onto 1mm grid',
        'status':'registered-unreviewed','canOverlayOnTarget':False,'atlases':{},
        'warning':'1mm output sampling preserves small labels; it does not imply 1mm registration accuracy.'}
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    report['fieldSha256']=sha(REG/'mapping.npz')
    for key,path in source_files.items():
        source=nib.as_closest_canonical(nib.load(path));data,lost=apply_labels(mapping,source,grid)
        out=REG/(key+'-on-fsl-1mm.nii.gz');nib.save(nib.Nifti1Image(data,grid.affine),out)
        source_data=source.get_fdata();sv=abs(np.linalg.det(source.affine[:3,:3]))
        counts=[]
        for label in np.unique(source_data):
            if not label:continue
            before=int((source_data==label).sum());after=int((data==label).sum())
            counts.append({'id':int(label),'sourceVoxels':before,'sourceVolumeMm3':float(before*sv),
                'targetVoxels':after,'targetVolumeMm3':after,'volumeRatio':float(after/(before*sv))})
        assert not lost,'Label disappeared even on1mm grid; inspect before integration'
        report['atlases'][key]={'sourceSha256':sha(path),'outputSha256':sha(out),
            'positiveLabels':len(counts),'lostPositiveLabelIds':lost,'perLabelVolumes':counts}
    (REG/'label-resampling-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:{'positiveLabels':v['positiveLabels'],'lostPositiveLabelIds':v['lostPositiveLabelIds']} for k,v in report['atlases'].items()},indent=2))


if __name__=='__main__':main()

"""Audit Colin27 release identity and prepare a source mask, without relabelling.

The SPM canonical 2mm image samples the original MNI1998 image at RAS minus
(1,1,1) mm. This offset is measured, not a generic MNI transform. The generated
mask is therefore moved +1mm in its header before nearest-neighbour sampling.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
import nibabel as nib
from nibabel.processing import resample_from_to

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources/aal-official'


def main():
    source_path=RAW/'tpl-MNIColin27_T1w.nii.gz'
    mask_path=RAW/'tpl-MNIColin27_desc-brain_mask.nii.gz'
    spm_path=RAW/'spm12-single_subj_T1.nii'
    source=nib.load(source_path);mask=nib.load(mask_path);spm=nib.load(spm_path)
    grid=(spm.shape,spm.affine)
    assert source.shape==mask.shape and np.array_equal(source.affine,mask.affine)
    shifted=source.affine.copy();shifted[:3,3]+=1
    shifted_source=nib.Nifti1Image(source.get_fdata(),shifted)
    shifted_mask=nib.Nifti1Image(mask.get_fdata(),shifted)
    on_spm=resample_from_to(shifted_source,grid,order=1).get_fdata()
    brain=resample_from_to(shifted_mask,grid,order=0).get_fdata()>.5
    reference=spm.get_fdata();coeff=np.polyfit(on_spm[brain],reference[brain],1)
    error=reference[brain]-np.polyval(coeff,on_spm[brain])
    corr=float(np.corrcoef(reference[brain],on_spm[brain])[0,1])
    assert corr>.999,'SPM/Colin27 image identity check failed; do not reuse fixed offset'
    output=RAW/'spm12-colin27-brain-mask-verified-shift.nii.gz'
    nib.save(nib.Nifti1Image(brain.astype(np.uint8),spm.affine),output)
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    report={'source':'TemplateFlow original1998 MNI Colin27','target':'SPM12 canonical single_subj_T1',
        'mniOriginalToSpmRasTranslationMm':[1,1,1],'correlationAfterShift':corr,
        'linearIntensityScaleAndOffset':coeff.tolist(),'absoluteIntensityError95':float(np.percentile(abs(error),95)),
        'sourceSha256':sha(source_path),'spmSha256':sha(spm_path),'sourceMaskSha256':sha(mask_path),
        'preparedMaskSha256':sha(output),'maskMethod':'Apply measured +1mm header shift then nearest-neighbour sampling to SPM grid',
        'limitation':'Establishes T1 and brain-mask pairing only. Atlas-to-specific-Colin27 release pairing still requires source and boundary review.'}
    (RAW/'source-template-identity.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()

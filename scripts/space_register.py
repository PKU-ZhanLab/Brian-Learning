"""Estimate and audit ICBM2009aAsym -> FSL MNI152NLin6Asym registration.

Run with the prepared mne conda environment. Original template files stay intact.
The saved DIPY field is an image pull mapping (target -> source); streamline
points use transform_points_inverse, hence source RAS mm -> target RAS mm.
"""
from pathlib import Path
import hashlib, json, sys
import numpy as np
import nibabel as nib
from nibabel.processing import resample_from_to
from scipy.ndimage import map_coordinates
from dipy.align.imaffine import AffineRegistration, MutualInformationMetric
from dipy.align.transforms import TranslationTransform3D, RigidTransform3D, AffineTransform3D
from dipy.align.imwarp import DiffeomorphicMap, SymmetricDiffeomorphicRegistration
from dipy.align.metrics import CCMetric

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data-sources/space'
OUT = ROOT / 'public/data/space'
FIELD = RAW / 'MNI152NLin2009aAsym_to_MNI152NLin6Asym_dipy.npz'
SOURCE_T1 = RAW / 'tpl-MNI152NLin2009aAsym_res-1_T1w.nii.gz'
SOURCE_MASK = RAW / 'tpl-MNI152NLin2009aAsym_res-1_desc-brain_mask.nii.gz'
TARGET_T1 = ROOT / 'data-sources/raw/MNI152_T1_2mm_brain.nii.gz'

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def dump(path, data): Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def save_mapping(mapping, path=FIELD):
    attrs = ['disp_shape', 'disp_grid2world', 'domain_shape', 'domain_grid2world',
             'codomain_shape', 'codomain_grid2world', 'prealign', 'forward', 'backward', 'is_inverse']
    np.savez_compressed(path, **{key: getattr(mapping, key) for key in attrs})

def load_mapping(path=FIELD):
    data = np.load(path)
    mapping = DiffeomorphicMap(3, data['disp_shape'], data['disp_grid2world'],
                              data['domain_shape'], data['domain_grid2world'],
                              data['codomain_shape'], data['codomain_grid2world'], data['prealign'])
    mapping.forward = data['forward']; mapping.backward = data['backward']
    mapping.is_inverse = bool(data['is_inverse'])
    return mapping

def transform_source_ras_mm(points, mapping=None):
    """HCP1065 native ICBM2009aAsym RAS mm -> target FSL template RAS mm."""
    points = np.asarray(points, dtype=np.float64)
    if points.shape[-1] != 3 or not np.isfinite(points).all():
        raise ValueError('Expected finite N x 3 source RAS millimetres')
    if mapping is None: mapping = load_mapping()
    return mapping.transform_points_inverse(points)

def image_quality(reference, image, reference_mask, mask):
    union = reference_mask | mask
    common = reference_mask & mask
    return {'brainMaskDice': float(2 * common.sum() / (reference_mask.sum() + mask.sum())),
            'pearsonWithinCommonBrain': float(np.corrcoef(reference[common], image[common])[0,1]),
            'pearsonWithinBrainUnion': float(np.corrcoef(reference[union], image[union])[0,1]),
            'brainMaskVolumesMm3': [int(reference_mask.sum()*8), int(mask.sum()*8)]}

def main():
    RAW.mkdir(exist_ok=True, parents=True); OUT.mkdir(exist_ok=True, parents=True)
    target = nib.as_closest_canonical(nib.load(TARGET_T1))
    source = nib.load(SOURCE_T1); mask_image = nib.load(SOURCE_MASK)
    assert source.shape == mask_image.shape and np.allclose(source.affine, mask_image.affine)
    grid = (target.shape, target.affine)
    moving = resample_from_to(source, grid, order=1).get_fdata()
    moving_mask = resample_from_to(mask_image, grid, order=0).get_fdata() > .5
    static = target.get_fdata(); static_mask = static > 0
    moving *= moving_mask
    static /= np.percentile(static[static_mask], 99)
    moving /= np.percentile(moving[moving_mask], 99)
    np.clip(static,0,1.2,out=static); np.clip(moving,0,1.2,out=moving)
    affine = target.affine
    before = image_quality(static, moving, static_mask, moving_mask)
    print('BEFORE', before, flush=True)
    registration = AffineRegistration(metric=MutualInformationMetric(nbins=32, sampling_proportion=None),
                         level_iters=[500, 100, 30], sigmas=[3,1,0], factors=[4,2,1])
    previous = np.eye(4)
    for model in [TranslationTransform3D(), RigidTransform3D(), AffineTransform3D()]:
        result = registration.optimize(static, moving, model, None, static_grid2world=affine,
                         moving_grid2world=affine, starting_affine=previous)
        previous = result.affine
        print(type(model).__name__, previous.tolist(), flush=True)
    affine_moving = result.transform(moving)
    affine_mask = result.transform(moving_mask.astype(float), interpolation='nearest') > .5
    after_affine = image_quality(static, affine_moving, static_mask, affine_mask)
    print('AFFINE', after_affine, flush=True)
    sdr = SymmetricDiffeomorphicRegistration(CCMetric(3, sigma_diff=2.0, radius=2), [50, 25, 10],
                         step_length=.25, inv_iter=30, inv_tol=1e-4)
    mapping = sdr.optimize(static, moving, static_grid2world=affine,
                         moving_grid2world=affine, prealign=previous)
    save_mapping(mapping)
    mapping = load_mapping()  # audit the saved/reloaded representation used by downstream exports
    warped = mapping.transform(moving)
    warped_mask = mapping.transform(moving_mask.astype(float), interpolation='nearest') > .5
    after = image_quality(static, warped, static_mask, warped_mask)
    nib.save(nib.Nifti1Image(warped.astype(np.float32), affine), RAW/'registered_2009aAsym_on_FSL2mm.nii.gz')
    ijk = np.indices(target.shape).reshape(3,-1).T
    xyz = nib.affines.apply_affine(affine, ijk)
    pull = mapping.transform_points(xyz).reshape(*target.shape,3)
    jac = np.empty((*target.shape,3,3))
    for output_axis in range(3):
        for input_axis in range(3):
            jac[...,output_axis,input_axis] = np.gradient(pull[...,output_axis],2.0,axis=input_axis)
    determinant = np.linalg.det(jac)[static_mask]
    source_points = xyz[moving_mask.reshape(-1)][::53]
    transformed = transform_source_ras_mm(source_points,mapping)
    roundtrip = mapping.transform_points(transformed)
    error = np.linalg.norm(roundtrip-source_points,axis=1)
    displacement = np.linalg.norm(transformed-source_points,axis=1)
    # Independent direction check: image warping of RAS coordinate ramps must agree
    # with target-point -> source-point mapping in the interior of the source grid.
    ramp_errors=[]
    interior = static_mask.copy(); interior[:3]=False; interior[-3:]=False
    interior[:,:3]=False; interior[:,-3:]=False; interior[:,:,:3]=False; interior[:,:,-3:]=False
    for axis in range(3):
        ramp=xyz[:,axis].reshape(target.shape).copy()
        warped_ramp=mapping.transform(ramp)
        ramp_errors.append(float(np.max(np.abs(warped_ramp[interior]-pull[...,axis][interior]))))
    report = {'schemaVersion':1,'sourceSpace':'MNI152NLin2009aAsym','targetSpace':'MNI152NLin6Asym',
       'status':'registered','method':'DIPY 1.7.0 mutual-information translation/rigid/affine then symmetric diffeomorphic CC registration',
       'gridResolutionMm':2,'sourceT1':str(SOURCE_T1.relative_to(ROOT)).replace('\\','/'),
       'sourceT1Sha256':sha(SOURCE_T1),'sourceMaskSha256':sha(SOURCE_MASK),'targetT1Sha256':sha(TARGET_T1),
       'sourceHeader':{'shape':list(source.shape),'affine':source.affine.tolist()},
       'targetHeader':{'shape':list(target.shape),'affine':target.affine.tolist()},
       'fieldFile':str(FIELD.relative_to(ROOT)).replace('\\','/'),'fieldSha256':sha(FIELD),
       'affineTargetToSource':previous.tolist(),'before':before,'afterAffine':after_affine,'afterNonlinear':after,
       'jacobianTargetToSourceWithinBrain':{'min':float(determinant.min()),'max':float(determinant.max()),
         'percentile1':float(np.percentile(determinant,1)),'percentile99':float(np.percentile(determinant,99)),
         'nonPositiveVoxels':int((determinant<=0).sum())},
       'sourceToTargetRoundTripMm':{'points':len(error),'median':float(np.median(error)),
         'percentile95':float(np.percentile(error,95)),'max':float(error.max())},
       'pointDisplacementMm':{'median':float(np.median(displacement)),'percentile95':float(np.percentile(displacement,95)),
         'max':float(displacement.max())},'coordinateRampDirectionCheckMaxErrorMm':ramp_errors,
       'pointConvention':'Input source RAS millimetres. Output target RAS millimetres. Use transform_points_inverse; image transform() is a pull map.',
       'estimatedHere':True,'notAnOfficialTransform':True,
       'limitations':'Template-to-template estimate for educational visualization. 2 mm registration cannot validate individual cranial nerve positions or tract endpoints. No clinical validation.',
       'references':['https://brain.labsolver.org/hcp_trk_atlas.html','https://github.com/templateflow/tpl-MNI152NLin2009aAsym',
         'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html']}
    dump(OUT/'hcp1065-registration.json',report)
    print('REPORT',json.dumps(report,indent=2),flush=True)
    assert after['brainMaskDice']>before['brainMaskDice'] and after['brainMaskDice']>.95
    assert after['pearsonWithinCommonBrain']>before['pearsonWithinCommonBrain']
    assert (determinant<=0).sum()==0
    assert np.percentile(error,95)<.5 and max(ramp_errors)<.01
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,axes=plt.subplots(3,3,figsize=(12,12),facecolor='white')
    voxel=nib.affines.apply_affine(np.linalg.inv(affine),[0,-24,8]).round().astype(int)
    for row,axis in enumerate([0,1,2]):
        for col,(label,data) in enumerate([('FSL target',static),('2009a before',moving),('2009a registered',warped)]):
            a=axes[row,col]; sl=np.take(data,voxel[axis],axis=axis).T
            a.imshow(sl,origin='lower',cmap='gray',vmin=0,vmax=1)
            a.contour(np.take(static_mask,voxel[axis],axis=axis).T,levels=[.5],colors=['#ff6565'],linewidths=.6)
            a.set_title(label+f' | axis {axis}'); a.axis('off')
    fig.tight_layout(); fig.savefig(OUT/'hcp1065-registration-qc.png',dpi=120); plt.close(fig)

if __name__=='__main__': main()

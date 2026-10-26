"""Register a paired local T1/label image to a reference T1 with auditable outputs.

Use the prepared mne conda environment. No package installation is performed.
Transforms use RAS millimetres. Image transforms pull fixed locations into moving
space; source points therefore use transform_points_inverse(). Outputs remain
unreviewed; numerical QC cannot establish the provenance of a T1/label pair.
"""
from pathlib import Path
import argparse
import hashlib
import json
import platform
import sys

import dipy
import nibabel as nib
import numpy as np
from nibabel.processing import resample_from_to
from dipy.align.imaffine import AffineRegistration, MutualInformationMetric
from dipy.align.transforms import TranslationTransform3D, RigidTransform3D, AffineTransform3D
from dipy.align.imwarp import DiffeomorphicMap, SymmetricDiffeomorphicRegistration
from dipy.align.metrics import CCMetric


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dump(path, data):
    def native(value):
        if isinstance(value, np.generic):return value.item()
        if isinstance(value, np.ndarray):return value.tolist()
        raise TypeError(f"Not JSON serializable: {type(value).__name__}")
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False, default=native), encoding="utf-8")


def save_mapping(mapping, path):
    attrs = ["disp_shape", "disp_grid2world", "domain_shape", "domain_grid2world",
             "codomain_shape", "codomain_grid2world", "prealign", "forward", "backward", "is_inverse"]
    np.savez_compressed(path, **{key: getattr(mapping, key) for key in attrs})


def load_mapping(path):
    with np.load(path, allow_pickle=False) as data:
        m = DiffeomorphicMap(3, data["disp_shape"], data["disp_grid2world"],
                             data["domain_shape"], data["domain_grid2world"],
                             data["codomain_shape"], data["codomain_grid2world"], data["prealign"])
        m.forward = data["forward"].copy()
        m.backward = data["backward"].copy()
        m.is_inverse = bool(data["is_inverse"])
    return m


def read_image(path, labels=False):
    image = nib.as_closest_canonical(nib.load(path))
    data = image.get_fdata(dtype=np.float32)
    if data.ndim != 3 or not np.isfinite(data).all() or abs(np.linalg.det(image.affine[:3,:3])) < 1e-8:
        raise ValueError(f"Expected finite 3D NIfTI with invertible affine: {path}")
    if labels and (data.min() < 0 or not np.allclose(data, np.rint(data)) or data.max() > 65535):
        raise ValueError("Labels must be nonnegative integers in the uint16 range")
    return image


def normalize(data, mask):
    if mask.sum() < 100 or np.count_nonzero(data[mask] > 0) < 100:
        raise ValueError("Image/mask contains too few positive voxels")
    result = data.astype(np.float64, copy=True)
    result[~mask] = 0
    result /= np.percentile(result[mask & (result > 0)], 99)
    return np.clip(result, 0, 1.2)


def quality(static, moving, smask, mmask, affine):
    common = smask & mmask
    union = smask | mmask
    def corr(mask):
        a, b = static[mask], moving[mask]
        return float(np.corrcoef(a, b)[0,1]) if len(a)>10 and a.std()>0 and b.std()>0 else None
    voxel_volume = abs(np.linalg.det(affine[:3,:3]))
    return {"brainMaskDice":float(2*common.sum() / max(1, smask.sum()+mmask.sum())),
            "pearsonWithinCommonBrain":corr(common), "pearsonWithinBrainUnion":corr(union),
            "maskVolumesMm3":[float(smask.sum()*voxel_volume),float(mmask.sum()*voxel_volume)]}


def mapping_qc(mapping, shape, affine, static_mask, moving_mask):
    ijk = np.indices(shape).reshape(3,-1).T
    xyz = nib.affines.apply_affine(affine, ijk)
    pull = mapping.transform_points(xyz).reshape(*shape,3)
    # Chain rule: d(pull world)/d(index) times d(index)/d(target world).
    # This remains correct for oblique and anisotropic NIfTI affines.
    jac_index = np.empty((*shape,3,3), dtype=np.float64)
    for out_axis in range(3):
        for in_axis in range(3):
            jac_index[...,out_axis,in_axis] = np.gradient(pull[...,out_axis],axis=in_axis)
    jac_world = np.einsum("...ij,jk->...ik",jac_index,np.linalg.inv(affine[:3,:3]))
    determinant = np.linalg.det(jac_world)[static_mask]
    points = xyz[moving_mask.ravel()][::max(1,int(moving_mask.sum()/12000))]
    forward = mapping.transform_points_inverse(points)
    error = np.linalg.norm(mapping.transform_points(forward)-points,axis=1)
    pull_voxels = nib.affines.apply_affine(np.linalg.inv(affine),pull.reshape(-1,3)).reshape(*shape,3)
    interior = static_mask & np.all((pull_voxels>=2)&(pull_voxels<=np.array(shape)-3),axis=-1)
    ramp_errors=[]
    for axis in range(3):
        ramp=xyz[:,axis].reshape(shape).copy()
        warped=mapping.transform(ramp)
        ramp_errors.append(float(np.max(np.abs(warped[interior]-pull[...,axis][interior]))))
    return {"jacobianTargetToSourceWithinMask":{"minimum":float(determinant.min()),
            "maximum":float(determinant.max()),"nonPositiveVoxels":int((determinant<=0).sum()),
            "percentile1":float(np.percentile(determinant,1)),"percentile99":float(np.percentile(determinant,99))},
            "sourceToTargetRoundTripMm":{"points":len(points),"median":float(np.median(error)),
            "percentile95":float(np.percentile(error,95)),"maximum":float(error.max())},
            "coordinateRampDirectionCheckMaxErrorMm":ramp_errors,
            "coordinateRampCheckedVoxels":int(interior.sum())}


def apply_labels(mapping, image, target):
    data = np.asarray(image.dataobj, dtype=np.float64)
    # Direct sampling of the original labels avoids two nearest-neighbour passes.
    result = mapping.transform(data, interpolation="nearest",
        image_world2grid=np.linalg.inv(image.affine), out_shape=target.shape, out_grid2world=target.affine)
    result = np.rint(result).astype(np.uint16)
    source_ids=set(np.unique(data).astype(int)); output_ids=set(np.unique(result).astype(int))
    if not output_ids.issubset(source_ids|{0}):
        raise AssertionError("Nearest-neighbour output introduced unknown labels")
    return result, sorted(source_ids-output_ids-{0})


def render_qc(outdir, static, before, after, labels, affine, mask):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig,axes=plt.subplots(3,4,figsize=(14,10))
    point=np.mean(np.argwhere(mask),axis=0).round().astype(int)
    for row,axis in enumerate([0,1,2]):
        for col,(title,data) in enumerate([("Fixed T1",static),("Moving before",before),
                                          ("Moving registered",after),("Labels on fixed",static)]):
            ax=axes[row,col];ax.imshow(np.take(data,point[axis],axis=axis).T,origin="lower",cmap="gray",vmin=0,vmax=1)
            if col==3:
                overlay=np.take(labels,point[axis],axis=axis).T
                ax.imshow(np.ma.masked_equal(overlay,0),origin="lower",cmap="nipy_spectral",alpha=.45,interpolation="nearest")
            ax.contour(np.take(mask,point[axis],axis=axis).T,levels=[.5],colors=["#ff7878"],linewidths=.5)
            ax.set_title(title+f" | axis {axis}");ax.axis("off")
    fig.tight_layout();fig.savefig(outdir/"registration-qc.png",dpi=150);plt.close(fig)


def self_test(outdir):
    """Known translation, anisotropic oblique grid, direct label sampling and reload."""
    shape=np.array([25,27,29]);a=np.eye(4);a[:3,:3]=[[0,-2,0],[1.5,0,0],[0,0,2.5]];a[:3,3]=[-10,-30,-35]
    pre=np.eye(4);pre[:3,3]=[2,-1.5,2.5]
    m=DiffeomorphicMap(3,shape,a,shape,a,shape,a,pre)
    m.forward=np.zeros((*shape,3),dtype=np.float32);m.backward=np.zeros_like(m.forward)
    outdir.mkdir(parents=True,exist_ok=False);save_mapping(m,outdir/"known-translation.npz");m=load_mapping(outdir/"known-translation.npz")
    ijk=np.indices(shape).reshape(3,-1).T;xyz=nib.affines.apply_affine(a,ijk)
    p=xyz[500:800:11]
    assert np.allclose(m.transform_points(p),p+pre[:3,3])
    assert np.allclose(m.transform_points_inverse(p),p-pre[:3,3])
    mask=np.zeros(shape,dtype=bool);mask[5:-5,5:-5,5:-5]=True
    qc=mapping_qc(m,tuple(shape),a,mask,mask)
    assert max(qc['coordinateRampDirectionCheckMaxErrorMm'])<1e-4
    assert qc['sourceToTargetRoundTripMm']['maximum']<1e-4
    assert abs(qc['jacobianTargetToSourceWithinMask']['minimum']-1)<1e-4
    labels=np.zeros(shape,dtype=np.uint16);labels[12,13,14]=6001
    im=nib.Nifti1Image(labels,a);warped,lost=apply_labels(m,im,im)
    # prealign moves a fixed voxel to source index (-1,-1,+1).
    expected_voxel=np.rint(nib.affines.apply_affine(np.linalg.inv(a),nib.affines.apply_affine(a,[12,13,14])-pre[:3,3])).astype(int)
    assert warped[tuple(expected_voxel)]==6001 and np.count_nonzero(warped)==1 and not lost
    dump(outdir/"self-test.json",{"passed":True,"checks":["known RAS translation direction","saved mapping reload","anisotropic oblique Jacobian","coordinate ramps","nearest original label sampling"],"qc":qc})
    print(json.dumps({"selfTestPassed":True,"output":str(outdir)}))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--moving-t1",type=Path);p.add_argument("--moving-labels",type=Path)
    p.add_argument("--fixed-t1",type=Path);p.add_argument("--outdir",type=Path,required=True)
    p.add_argument("--moving-mask",type=Path);p.add_argument("--fixed-mask",type=Path)
    p.add_argument("--source-space",default="unspecified-native");p.add_argument("--target-space",default="unspecified-reference")
    p.add_argument("--pairing-evidence",default="Not supplied; verify that labels and moving T1 describe the same anatomy and world coordinates.")
    p.add_argument("--level-iters",default="50,25,10",help="SDR iterations, coarse to fine")
    p.add_argument("--self-test",action="store_true")
    args=p.parse_args()
    if args.self_test:return self_test(args.outdir)
    if any(x is None for x in [args.moving_t1,args.moving_labels,args.fixed_t1]):p.error("--moving-t1, --moving-labels and --fixed-t1 are required")
    moving=read_image(args.moving_t1);labels=read_image(args.moving_labels,labels=True);fixed=read_image(args.fixed_t1)
    # Refuse to overwrite earlier transforms or review evidence.
    args.outdir.mkdir(parents=True,exist_ok=False)
    grid=(fixed.shape,fixed.affine);affine=fixed.affine
    initial=resample_from_to(moving,grid,order=1).get_fdata()
    static=fixed.get_fdata()
    mmask=(resample_from_to(read_image(args.moving_mask),grid,order=0).get_fdata()>.5) if args.moving_mask else initial>0
    smask=(resample_from_to(read_image(args.fixed_mask),grid,order=0).get_fdata()>.5) if args.fixed_mask else static>0
    moving_data=normalize(initial,mmask);static=normalize(static,smask)
    before=quality(static,moving_data,smask,mmask,affine)
    print("Before",json.dumps(before),flush=True)
    registration=AffineRegistration(metric=MutualInformationMetric(nbins=32,sampling_proportion=None),
        level_iters=[500,100,30],sigmas=[3,1,0],factors=[4,2,1])
    previous=np.eye(4)
    for model in [TranslationTransform3D(),RigidTransform3D(),AffineTransform3D()]:
        estimate=registration.optimize(static,moving_data,model,None,static_grid2world=affine,
            moving_grid2world=affine,starting_affine=previous)
        previous=estimate.affine
        print(type(model).__name__,previous.tolist(),flush=True)
    affine_quality=quality(static,estimate.transform(moving_data),smask,
        estimate.transform(mmask.astype(float),interpolation="nearest")>.5,affine)
    levels=[int(v) for v in args.level_iters.split(",")]
    if not levels or any(v<1 for v in levels):raise ValueError("SDR iterations must be positive")
    sdr=SymmetricDiffeomorphicRegistration(CCMetric(3,sigma_diff=2,radius=2),levels,step_length=.25,inv_iter=30,inv_tol=1e-4)
    mapping=sdr.optimize(static,moving_data,static_grid2world=affine,moving_grid2world=affine,prealign=previous)
    field=args.outdir/"mapping.npz";save_mapping(mapping,field);mapping=load_mapping(field)
    warped=mapping.transform(moving_data);warped_mask=mapping.transform(mmask.astype(float),interpolation="nearest")>.5
    final_labels,lost=apply_labels(mapping,labels,fixed)
    after=quality(static,warped,smask,warped_mask,affine)
    qc=mapping_qc(mapping,fixed.shape,affine,smask,mmask)
    nib.save(nib.Nifti1Image(warped.astype(np.float32),affine),args.outdir/"moving-on-fixed.nii.gz")
    nib.save(nib.Nifti1Image(final_labels,affine),args.outdir/"labels-on-fixed.nii.gz")
    render_qc(args.outdir,static,moving_data,warped,final_labels,affine,smask)
    flags=[]
    if after['brainMaskDice']<.9:flags.append("mask Dice below 0.90")
    if after['pearsonWithinCommonBrain'] is None or after['pearsonWithinCommonBrain']<.7:flags.append("common-mask correlation below 0.70")
    if qc['jacobianTargetToSourceWithinMask']['nonPositiveVoxels']:flags.append("non-positive Jacobian")
    if qc['sourceToTargetRoundTripMm']['percentile95']>.5:flags.append("roundtrip 95th percentile exceeds 0.5 mm")
    if max(qc['coordinateRampDirectionCheckMaxErrorMm'])>.01:flags.append("coordinate direction check failed")
    if lost:flags.append("one or more source labels absent on output grid")
    report={"schemaVersion":1,"status":"registered-unreviewed","canOverlayOnTarget":False,
        "sourceSpace":args.source_space,"targetSpace":args.target_space,"pairingEvidence":args.pairing_evidence,
        "method":"DIPY mutual-information translation, rigid, affine; symmetric diffeomorphic cross-correlation",
        "software":{"python":platform.python_version(),"numpy":np.__version__,"nibabel":nib.__version__,"dipy":dipy.__version__},
        "parameters":{"affineIterations":[500,100,30],"sdrIterations":levels,"sdrStepLength":.25,"labelInterpolation":"nearest"},
        "sourceHeader":{"shape":list(moving.shape),"affine":moving.affine.tolist()},
        "labelHeader":{"shape":list(labels.shape),"affine":labels.affine.tolist()},
        "targetHeader":{"shape":list(fixed.shape),"affine":affine.tolist()},
        "inputs":{k:{"path":str(v.resolve()),"sha256":sha(v)} for k,v in vars(args).items() if isinstance(v,Path) and k!="outdir"},
        "affineTargetToSource":previous.tolist(),"before":before,"afterAffine":affine_quality,"afterNonlinear":after,
        "qc":qc,"lostPositiveLabelIds":lost,"qualityFlags":flags,"numericalChecksPassed":not flags,
        "humanReview":{"performed":False,"required":["T1 and label pairing provenance","brain extraction","multi-slice boundaries and laterality","small nuclei and label loss"]},
        "pointConvention":"RAS mm; target-to-source = transform_points; source-to-target = transform_points_inverse. Image transform is target-to-source pull.",
        "limitations":"Numerical QC does not establish anatomical truth, label provenance, or subject-specific localization. Template registration does not measure intersubject variability. Small parcels can disappear at the fixed-grid resolution.",
        "outputs":{f.name:{"sha256":sha(f),"bytes":f.stat().st_size} for f in args.outdir.iterdir() if f.is_file()}}
    dump(args.outdir/"registration-report.json",report)
    print(json.dumps({"output":str(args.outdir),"status":report['status'],"numericalChecksPassed":not flags,"qualityFlags":flags},indent=2),flush=True)


if __name__=="__main__":main()

"""Build real atlas surfaces and population tractography for the teaching viewer.

Run with the existing mne conda environment. Source NIfTI/TRK geometry is
preserved in RAS millimetres; no registration, stretching or path drawing occurs.
"""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import zipfile
import numpy as np
import nibabel as nib
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
import pyvista as pv

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data-sources' / 'anatomy'
OUT = ROOT / 'public' / 'data' / 'anatomy'
OUT.mkdir(parents=True, exist_ok=True)
PAM_COMMIT = '609a18235d9143dad0d6bf5bb35e2bff9e55196f'
IDENTITY = np.eye(4).reshape(-1).tolist()

def digest(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024): hasher.update(chunk)
    return hasher.hexdigest()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf8')

def normals(vertices, faces):
    output = np.zeros_like(vertices)
    triangle = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]], vertices[faces[:, 2]] - vertices[faces[:, 0]])
    for corner in range(3): np.add.at(output, faces[:, corner], triangle)
    output /= np.maximum(np.linalg.norm(output, axis=1, keepdims=True), 1e-12)
    return output

def mask_mesh(name, data, affine, threshold=0.5, target=18000):
    foreground = np.argwhere(data > threshold)
    if len(foreground) < 5: raise ValueError(f'No valid mask: {name}')
    low = np.maximum(foreground.min(0) - 2, 0)
    high = np.minimum(foreground.max(0) + 3, data.shape)
    cropped = data[tuple(slice(int(a), int(b)) for a, b in zip(low, high))].astype(np.float32)
    # Low smoothing removes voxel staircasing, without changing template length.
    padded = np.pad(gaussian_filter(cropped, 0.35), 1)
    vertices, faces, _, _ = marching_cubes(padded, level=threshold, allow_degenerate=False)
    vertices = nib.affines.apply_affine(affine, vertices + low - 1)
    if np.linalg.det(affine[:3, :3]) < 0: faces = faces[:, [0, 2, 1]]
    original_faces = len(faces)
    if len(faces) > target:
        poly = pv.PolyData(vertices, np.column_stack([np.full(len(faces), 3), faces]).reshape(-1))
        poly = poly.decimate_pro(1 - target / len(faces), preserve_topology=True, splitting=False)
        vertices = np.asarray(poly.points); faces = np.asarray(poly.faces).reshape(-1, 4)[:, 1:]
    name += '.json'
    write_json(OUT / name, {'kind':'mesh', 'coordinateSystem':'RAS', 'units':'mm', 'positions':np.round(vertices,3).reshape(-1).tolist(), 'indices':faces.reshape(-1).tolist(), 'normals':np.round(normals(vertices,faces),4).reshape(-1).tolist()})
    points = nib.affines.apply_affine(affine, foreground)
    return {'geometry': '/data/anatomy/'+name, 'vertices':len(vertices), 'triangles':len(faces), 'originalTriangles':original_faces,
            'bounds': [vertices.min(0).round(3).tolist(), vertices.max(0).round(3).tolist()], 'center':points.mean(0).round(3).tolist(),
            'threshold': threshold, 'sha256': digest(OUT/name), 'meshMethod':'0.5-level isosurface (or specified threshold), Gaussian sigma 0.35 voxels; topology-preserving decimation where needed'}

def update_manifest(entries, datasets):
    target = OUT / 'manifest.json'
    manifest = json.loads(target.read_text(encoding='utf8')) if target.exists() else {'schemaVersion':1, 'structures':{}, 'datasets':{}}
    manifest['structures'].update(entries)
    manifest['datasets'].update(datasets)
    manifest['coordinatePolicy'] = 'Mesh and streamline vertices are in each source native RAS mm. Identity placement does not prove registration between different templates. Display transformations are declared per record.'
    write_json(target, manifest)

def source_metadata(path):
    receipt = json.loads((path.parent/(path.name+'.source.json')).read_text())
    return {'source':receipt['url'], 'sourceSha256':receipt['sha256']}

def pam():
    root = RAW / 'pam50'
    image = nib.load(root/'template/PAM50_cord.nii.gz')
    affine = image.affine
    cord = np.asarray(image.dataobj)
    levels = np.asarray(nib.load(root/'template/PAM50_spinal_levels.nii.gz').dataobj)
    base = {
      'representation':'atlas-segmentation', 'dataset':'PAM50', 'nativeSpace':'PAM50 straightened template (author ICBM152 alignment)',
      'nativeAffine':affine.reshape(-1).tolist(), 'nativeShape':list(image.shape), 'nativeVoxelSizeMm':list(map(float,image.header.get_zooms()[:3])),
      'displayTransform':IDENTITY, 'targetAlignment':{'target':'MNI152NLin6Asym','verified':False,'method':'native-affine-only','note':'Authors align PAM50 to ICBM152; this project did not verify a nonlinear transform to the FSL NLin6Asym brain.'},
      'license':'Official SCT/PAM50 distribution. SCT software LGPL-3.0; the standalone PAM50 data repository does not provide a separate LICENSE file. Data attribution and retained originals are included; public redistribution requires review of data-specific terms.',
      'citation':'De Leener et al. NeuroImage 2018;165:170-179. PMID 29061527; Levy et al. NeuroImage 2015;119:262-271.',
      'sourceVersion':PAM_COMMIT,
      'limitations':'Straightened reference anatomy, not normal cervical/thoracic curvature. Level boundaries are percentage-based atlas estimates (Frostell 2016), not measured nerve-root boundaries in every subject. No Co1-specific parcel.'
    }
    entries = {}
    names = [f'C{i}' for i in range(1,9)]+[f'T{i}' for i in range(1,13)]+[f'L{i}' for i in range(1,6)]+[f'S{i}' for i in range(1,6)]
    for value, name in enumerate(names, 1):
        mask = (levels == value).astype(np.float32)
        entry = mask_mesh('pam-'+name, mask, affine, target=2400)
        entries['spinal-'+name] = {**base, **entry, **source_metadata(root/'template/PAM50_spinal_levels.nii.gz'), 'coverage':f'PAM50 spinal level {name}; atlas-estimated boundaries', 'nativeLabel':value}
        print('PAM50', name, entry['center'], entry['triangles'], flush=True)
    for key, filename, label in [('spinal-gray','PAM50_gm.nii.gz','Whole spinal gray matter probability mask'), ('spinal-white','PAM50_wm.nii.gz','Whole spinal white matter probability mask')]:
        path = root/'template'/filename; data = np.asarray(nib.load(path).dataobj)
        mesh = mask_mesh('pam-'+key, data, affine, target=24000)
        entries[key] = {**base, **mesh, **source_metadata(path), 'coverage':label+f"; thresholded RAS z extent {mesh['bounds'][0][2]} to {mesh['bounds'][1][2]} mm", 'limitations':base['limitations']+' Thresholded probability surface (p=0.5), not microscopy or subject-specific tissue boundary. The tissue mask ends near z=-522 mm; the newer cord/level mask extends to z=-542 mm. Caudal tissue coverage is incomplete and is not extrapolated.'}
    for atlas_id, key, label in [(30,'spinal-anterior-horn-l','Left ventral horn'),(31,'spinal-anterior-horn-r','Right ventral horn'),(34,'spinal-posterior-horn-l','Left dorsal horn'),(35,'spinal-posterior-horn-r','Right dorsal horn')]:
        path=root/'atlas'/f'PAM50_atlas_{atlas_id:02}.nii.gz'; data=np.asarray(nib.load(path).dataobj)
        mesh = mask_mesh('pam-'+key,data,affine,target=10000)
        entries[key] = {**base, **mesh, **source_metadata(path), 'coverage':label+f" probability mask (p=0.5); RAS z {mesh['bounds'][0][2]} to {mesh['bounds'][1][2]} mm", 'nativeLabel':atlas_id, 'limitations':base['limitations']+' Gray horn masks do not extend through the caudal tip of the newer cord mask; missing tissue is not extrapolated.'}
    entries['spinal-Co1'] = {'representation':'schematic','dataset':None,'geometry':None,'coverage':'No separately labelled Co1 in PAM50 (C1–S5 only)','limitations':'Do not infer Co1 location or morphology from S5. Unavailable in the current real atlas data.','source':'https://spinalcordtoolbox.com/en/latest/overview/concepts/pam50.html','displayPolicy':'schematic-only'}
    entries['spinal-lateral-horn'] = {'representation':'schematic','dataset':None,'geometry':None,'coverage':'PAM50 has intermediate gray zones, not a separately isolated lateral horn label.','limitations':'Intermediate gray zone is not relabelled as the lateral horn.','source':'https://github.com/spinalcordtoolbox/PAM50/blob/master/atlas/info_label.txt','displayPolicy':'schematic-only'}
    points=nib.affines.apply_affine(affine,np.argwhere(cord>.5))
    dataset = {**base, 'source':'https://github.com/spinalcordtoolbox/PAM50', 'nativeBounds':[points.min(0).tolist(),points.max(0).tolist()], 'spinalLevels':names, 'realMappedStructureCount':36}
    update_manifest(entries, {'PAM50':dataset})

HCP_MAPPINGS = {
 'arcuate':'association/AF_{S}.trk.gz', 'uncinate':'association/UF_{S}.trk.gz',
 'inferior-longitudinal':'association/ILF_{S}.trk.gz', 'inferior-fronto-occipital':'association/IFOF_{S}.trk.gz',
 'corticospinal':'projection/CST_{S}.trk.gz', 'fornix':'projection/F_{S}.trk.gz',
 'medial-lemniscus':'projection/ML_{S}.trk.gz','optic-radiation':'projection/OR_{S}.trk.gz',
 'superior-longitudinal':['association/SLF1_{S}.trk.gz','association/SLF2_{S}.trk.gz','association/SLF3_{S}.trk.gz'],
 'cingulum':[f'association/C_{part}_{{S}}.trk.gz' for part in ['FPH','FP','PHP','PH','PO']],
 'cn-optic':'cranial nerve/CNII_{S}.trk.gz', 'cn-oculomotor':'cranial nerve/CNIII_{S}.trk.gz',
 'cn-trigeminal':'cranial nerve/CNV_{S}.trk.gz', 'cn-facial':'cranial nerve/CNVII_{S}.trk.gz',
 'cn-vestibulocochlear':'cranial nerve/CNVIII_{S}.trk.gz',
}

def resample(line, count=40):
    distances=np.concatenate([[0],np.cumsum(np.linalg.norm(np.diff(line,axis=0),axis=1))])
    if distances[-1] <= 1e-8: return None
    queries=np.linspace(0,distances[-1],count)
    return np.column_stack([np.interp(queries,distances,line[:,axis]) for axis in range(3)])

def hcp():
    archive=RAW/'hcp1065_avg_tracts_trk.zip'
    entries={}; source_parts={}
    def read_part(member, limit=220):
        if member in source_parts: return source_parts[member]
        file=RAW/'hcp1065-trk'/member
        file.parent.mkdir(parents=True,exist_ok=True)
        if not file.exists():
            with zipfile.ZipFile(archive) as zipped, zipped.open(member) as source, file.open('wb') as output:
                while chunk:=source.read(1024*1024): output.write(chunk)
        bundle=nib.streamlines.TrkFile.load(str(file),lazy_load=True)
        expected=int(bundle.header['nb_streamlines'])
        chosen=set(np.linspace(0,max(0,expected-1),min(expected,limit),dtype=int).tolist())
        lines=[]; low=np.full(3,np.inf); high=np.full(3,-np.inf); actual=0
        for i,line in enumerate(bundle.tractogram.streamlines):
            # NiBabel applies the TRK voxel-to-RASmm and corner/centre convention.
            if not np.isfinite(line).all(): raise ValueError(f'Invalid streamline {member}:{i}')
            low=np.minimum(low,line.min(0)); high=np.maximum(high,line.max(0)); actual+=1
            if i in chosen:
                result=resample(line)
                if result is not None: lines.append(result)
        if actual!=expected: raise ValueError(f'TRK streamline count mismatch {member}: {actual}/{expected}')
        metadata={'archiveMember':member,'sourceSha256':digest(file),'sourceStreamlines':actual,'renderedStreamlines':len(lines),'nativeBounds':[low.tolist(),high.tolist()], 'sourceVoxelToRAS':bundle.header['voxel_to_rasmm'].reshape(-1).tolist(), 'sourceDimensions':bundle.header['dimensions'].tolist(), 'sourceVoxelOrder':bundle.header['voxel_order'].decode()}
        source_parts[member]=(lines,metadata)
        print('HCP1065',member,actual,'->',len(lines),flush=True)
        return lines,metadata
    mappings={}
    for key,files in HCP_MAPPINGS.items():
        for side in ['L','R']:
            mappings[key+'-'+side.lower()]=[(filename.format(S=side)) for filename in (files if isinstance(files,list) else [files])]
    mappings['corpus-callosum']=['commissural/CC.trk.gz']
    base={
      'representation':'tractography','dataset':'HCP1065','nativeSpace':'ICBM 2009a Nonlinear Asymmetric (HCP1065 Yeh 2022)',
      'displayTransform':IDENTITY,'targetAlignment':{'target':'MNI152NLin6Asym','verified':False,'method':'none','note':'Original RAS coordinates retained. No nonlinear transform from ICBM2009aAsym to FSL NLin6Asym has been applied.'},
      'source':'https://brain.labsolver.org/hcp_trk_atlas.html','download':'https://github.com/data-others/atlas/releases/download/hcp1065/hcp1065_avg_tracts_trk.zip',
      'archiveSha256':digest(archive),'license':'CC BY-SA 4.0; WU-Minn HCP acknowledgement required',
      'citation':'Yeh FC. Population-based tract-to-region connectome of the human brain and its hierarchical topology. Nature Communications. 2022;13:4933. DOI 10.1038/s41467-022-32595-4.',
      'limitations':'Population-averaged diffusion tractography estimate; a streamline is not an axon and streamline counts are not axon counts. Deterministic uniformly indexed subsampling, resampled to 40 points, is for display. Different MNI template versions have not been registered here.'
    }
    for key,members in mappings.items():
        all_lines=[]; metadata=[]
        for member in members:
            lines,info=read_part(member, max(30,240//len(members))); all_lines+=lines; metadata.append(info)
        points=np.concatenate(all_lines)
        filename='hcp-'+key+'.json'
        write_json(OUT/filename,{'kind':'streamlines','coordinateSystem':'RAS','units':'mm','streamlines':[np.round(line,3).reshape(-1).tolist() for line in all_lines]})
        coverage='; '.join(Path(member).name.removesuffix('.trk.gz') for member in members)
        limitations=base['limitations']
        if key.startswith('cn-optic'):
            coverage+='; intracranial CN II atlas trajectory including chiasm-adjacent/optic-pathway portions; not an isolated full orbit-to-chiasm optic nerve'
            limitations+=' This source CN II bundle can include midline/chiasm-neighbourhood and proximal optic-pathway segments; the complete intra-orbital optic nerve is not claimed.'
        if key.startswith('corticospinal'):
            coverage+='; template brain coverage only, not the complete spinal continuation'
        entries[key]={**base,'geometry':'/data/anatomy/'+filename,'sha256':digest(OUT/filename),'sourceParts':metadata,
          'center':np.median(points,axis=0).round(3).tolist(),'bounds':[points.min(0).round(3).tolist(),points.max(0).round(3).tolist()],
          'sourceStreamlines':sum(info['sourceStreamlines'] for info in metadata),'renderedStreamlines':len(all_lines),'pointsPerStreamline':40,'coverage':coverage,'limitations':limitations}
    all_cn=['olfactory','trochlear','abducens','glossopharyngeal','vagus','accessory','hypoglossal']
    for nerve in all_cn:
        for side in ['l','r']:
            entries[f'cn-{nerve}-{side}']={'representation':'schematic','geometry':None,'coverage':'Not included in the available HCP1065 cranial-nerve bundles','source':'https://brain.labsolver.org/hcp_trk_atlas.html','limitations':'No authenticated image-derived geometry for this cranial nerve has been integrated. The optional teaching path is not acquired anatomy.','displayPolicy':'schematic-only'}
    for side in ['l','r']:
        entries[f'spinothalamic-{side}']={'representation':'schematic','geometry':None,'coverage':'No isolated spinothalamic HCP1065 streamline bundle in this release','source':'https://brain.labsolver.org/hcp_trk_atlas.html','limitations':'PAM50 spinal lemniscus labels also include spinoreticular fibres; they are not silently relabelled as an isolated spinothalamic tract.','displayPolicy':'schematic-only'}
    update_manifest(entries,{'HCP1065':{**base,'realMappedStructureCount':31,'cranialNervePairs':['II','III','V','VII','VIII'],'displaySampling':'Up to 240 source streamlines per catalog structure; 40 equally spaced arc-length points per streamline'}})

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('phase',choices=['pam','hcp']); args=parser.parse_args(); globals()[args.phase]()

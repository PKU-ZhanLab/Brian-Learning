"""Build compact RAS browser assets using the existing mne conda environment.

Run after data_fetch.py. Original source bytes are retained under data-sources/raw.
All binary volumes use x-fastest layout (Fortran order) and their own affine.
No nonlinear registration or synthetic atlas boundary is performed here.
"""
from pathlib import Path
import csv
import hashlib
import json
import shutil
import xml.etree.ElementTree as ET
import numpy as np
import nibabel as nib
from scipy.io import loadmat
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'public'/'data'
RAW = ROOT/'data-sources'/'raw'
BN = 'https://github.com/mingruixia/BrainNet-Viewer'
FSL = 'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/atlases.html'
NP = 'https://github.com/neurodata/neuroparc'

def write_json(name, value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def normals_of(vertices, faces):
    normals=np.zeros_like(vertices)
    triangle=np.cross(vertices[faces[:,1]]-vertices[faces[:,0]],vertices[faces[:,2]]-vertices[faces[:,0]])
    for axis in range(3): np.add.at(normals,faces[:,axis],triangle)
    normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
    return normals

def export_mesh(name, vertices, faces):
    vertices=np.asarray(vertices,dtype=np.float64)
    faces=np.asarray(faces,dtype=np.int32)
    write_json(name, {'positions':np.round(vertices,3).reshape(-1).tolist(),
                     'indices':faces.reshape(-1).tolist(),
                     'normals':np.round(normals_of(vertices,faces),4).reshape(-1).tolist()})
    return {'file':name, 'vertices':len(vertices),'triangles':len(faces),
            'bounds':[vertices.min(axis=0).round(2).tolist(),vertices.max(axis=0).round(2).tolist()],
            'sha256':sha(OUT/name)}

def nv_mesh(side):
    file=RAW/f'BrainMesh_ICBM152{side}.nv'
    tokens=' '.join(line for line in file.read_text().splitlines() if not line.startswith('#')).split()
    n=int(tokens[0]); stop=1+n*3
    vertices=np.asarray(tokens[1:stop],dtype=float).reshape(-1,3)
    nf=int(tokens[stop]); faces=np.asarray(tokens[stop+1:],dtype=int).reshape(-1,3)-1
    assert len(faces)==nf and faces.min()==0 and faces.max()<n
    mesh=export_mesh('cortex-'+side.lower()+'.json',vertices,faces)
    mesh.update({'id':'cortex-'+side.lower(),'source':BN,'credit':'Alan C. Evans, MNI; BrainNet Viewer','space':'ICBM152 (BrainNet historical surface)','sourceSha256':sha(file)})
    return mesh

def volume_export(key, image, labels, **metadata):
    image=nib.as_closest_canonical(image)
    data=np.asarray(image.dataobj)
    dtype=np.uint8 if data.max()<=255 else np.dtype('<u2')
    data=np.rint(data).astype(dtype)
    name=key+'.bin'
    (OUT/name).write_bytes(data.tobytes(order='F'))
    # Store centroids calculated from the actual exported volume, not guessed coordinates.
    enriched=[]
    for label in labels:
        idx=np.argwhere(data==label['id'])
        row=dict(label)
        row['voxels']=len(idx)
        if len(idx): row['center']=nib.affines.apply_affine(image.affine,idx.mean(axis=0)).round(2).tolist()
        enriched.append(row)
    return {'available':True,'data':name,'shape':list(data.shape),'affine':image.affine.reshape(-1).tolist(),
            'dtype':'uint8' if data.dtype==np.uint8 else 'uint16','order':'x-fastest','labels':enriched,
            'sha256':sha(OUT/name),**metadata}

def xml_labels(file, offset=0):
    return [{'id':int(el.attrib['index'])+offset,'name':el.text.strip()} for el in ET.parse(RAW/file).findall('.//label')]

def mat_image(prefix, step=2):
    mat=loadmat(RAW/f'BrainNet_{prefix}_Label.mat',simplify_cells=True)
    affine=np.asarray(mat[prefix+'_hdr']['mat'],dtype=float)
    # SPM MATLAB header is one-based. Move origin to NIfTI/JS zero-based voxels.
    affine[:3,3]+=affine[:3,:3]@np.ones(3)
    affine[:3,:3]*=step
    image=nib.Nifti1Image(mat[prefix+'_vol'][::step,::step,::step],affine)
    return mat,image

def segment_mesh(image, labels, name):
    image=nib.as_closest_canonical(image)
    data=np.isin(np.asarray(image.dataobj),labels).astype(float)
    data=gaussian_filter(np.pad(data,1),sigma=0.65)
    vertices,faces,_,_=marching_cubes(data,level=0.45,allow_degenerate=False)
    vertices=nib.affines.apply_affine(image.affine,vertices-1)
    # skimage's default descent convention yields inward triangle winding here.
    # Reverse winding so Three.js back-face culling and lighting see exterior faces.
    return export_mesh(name,vertices,faces[:,[0,2,1]])

def main():
    (OUT/'licenses').mkdir(exist_ok=True)
    shutil.copyfile(RAW/'Neuroparc-LICENSE.md',OUT/'licenses'/'Neuroparc-LICENSE.md')
    manifest={'schemaVersion':1,'coordinateSystem':'RAS','units':'mm','generated':'2026-10-25',
      'registrationNote':'各图谱保留原始 MNI 空间与仿射；本软件未执行不同 MNI 模板版本间的非线性配准。坐标查询是真实体素查表，跨模板边界仅供教学参考。',
      'schematicNote':'脊髓、颅神经及示意纤维路径为教学几何，不属于 MNI152 脑模板，也不代表个体束成像。',
      'meshes':[nv_mesh('Left'),nv_mesh('Right')], 'atlases':{}}
    # FSL template matches the grid used by DK/HO/JHU rather than an unrelated fsaverage surface.
    t1path=RAW/'MNI152_T1_2mm_brain.nii.gz'
    image=nib.as_closest_canonical(nib.load(t1path))
    data=np.asarray(image.dataobj,dtype=float)
    hi=np.percentile(data[data>0],99.6)
    data=np.rint(np.clip(data/hi,0,1)*255).astype(np.uint8)
    (OUT/'t1.bin').write_bytes(data.tobytes(order='F'))
    volume={'shape':list(data.shape),'affine':image.affine.reshape(-1).tolist(),'data':'t1.bin','dtype':'uint8','order':'x-fastest',
      'name':'FSL MNI152 T1 2 mm brain','space':'MNI152NLin6Asym','resolutionMm':2,
      'source':'https://ftp.nmr.mgh.harvard.edu/pub/dist/freesurfer/tutorial_packages_centos6/OSX/fsl_501/data/standard/MNI152_T1_2mm_brain.nii.gz',
      'normalization':'Intensity scaled to 0–255 with 99.6th percentile upper clipping for display only.',
      'sourceSha256':sha(t1path),'sha256':sha(OUT/'t1.bin')}
    write_json('volume.json',volume)
    manifest['template']=volume
    atl=manifest['atlases']
    labels=[{'id':int(row[0]),'name':row[1]} for row in csv.reader((RAW/'Desikan.csv').read_text().splitlines())]
    atl['dk']=volume_export('dk',nib.load(RAW/'Desikan.nii.gz'),labels,source=NP,space='MNI152NLin6',name='Desikan–Killiany-derived (Neuroparc volumetric release)',
      note='Neuroparc 的 Desikan 衍生体积共有70标签：每侧33个皮层标签、白质及胼胝体，附带标签表未收录岛叶。不是完整的标准68皮层区集，也不是DKT；不等同于个体 FreeSurfer 表面分区。',license='Neuroparc Apache-2.0; retain original atlas attribution')
    m,im=mat_image('AAL')
    atl['aal']=volume_export('aal',im,[{'id':i+1,'name':str(n)} for i,n in enumerate(m['AAL_label'])],source=BN,space='AAL MNI single-subject / historical MNI-like grid',name='AAL 116',
      note='AAL116 原始标签，按每隔一个体素采样为 2 mm；并非 MNI152 群体模板的重新分割。',license='Retain GIN / MNI attribution; see source notice')
    labels=[]
    for line in (RAW/'AAL3v2_labels.txt').read_text().splitlines():
        fields=line.split()
        if len(fields)>=3: labels.append({'id':int(fields[2]),'name':fields[1]})
    atl['aal3']=volume_export('aal3',nib.load(RAW/'AAL3v2.nii.gz'),labels,source='https://www.gin.cnrs.fr/en/tools/aal/',space='AAL3v2 MNI',name='AAL3 v2',
      note='AAL3v2 实际标签体积，标签编号可能不连续；核团分区来自原始图谱，不代表每个 MNI152 个体的精确边界。',license='AAL3 copyright GIN / Edmund Rolls et al.; retain attribution')
    ho=nib.load(RAW/'HarvardOxford-sub.nii.gz')
    # The MGH tutorial mirror recoded this atlas to FreeSurfer aseg IDs.
    # Its sibling `labels` file and `relabel` script explicitly document the mapping.
    # Restore the official HO summary-volume IDs so the XML's index+1 is correct.
    fs_ids=[int(x) for x in (RAW/'HarvardOxford-fs-labels.txt').read_text().split()]
    original=np.asarray(ho.dataobj)
    restored=np.zeros(original.shape,dtype=np.uint8)
    assert set(np.unique(original))=={0,*fs_ids}
    for target_id,source_id in enumerate(fs_ids,1): restored[original==source_id]=target_id
    ho=nib.Nifti1Image(restored,ho.affine)
    holabels=xml_labels('HarvardOxford-Subcortical.xml',1)
    atl['ho']=volume_export('ho',ho,holabels,source=FSL,space='FSL MNI152NLin6Asym',name='Harvard–Oxford subcortical',
      note='最大概率图，25% 概率阈值，2 mm；MGH 镜像的 FreeSurfer 编号已按随附 labels 文件恢复为 HO 标准编号。含皮层及白质总区标签，深核边界随阈值改变。',license='CC BY-SA 4.0 (current FSL atlas license); retain attribution')
    atl['jhu']=volume_export('jhu',nib.load(RAW/'JHU.nii.gz'),xml_labels('JHU-labels.xml'),source=FSL,space='JHU ICBM-DTI-81 / FSL MNI grid',name='JHU ICBM-DTI-81 white-matter labels',
      note='JHU 白质区域标签图（48 个正标签），不是连续纤维追踪流线；图谱内的白质区域不等于完整纤维束。',license='FSL non-commercial license; JHU copyright')
    m,im=mat_image('Brodmann')
    ids=sorted(int(i) for i in np.unique(np.asarray(im.dataobj)) if i)
    atl['ba']=volume_export('ba',im,[{'id':i,'name':f'Brodmann area {i}'} for i in ids],source=BN,space='Historical MRIcroN MNI-like Brodmann approximation',name='Brodmann historical digitization',
      note='历史数字化近似：41 个正标签，并不覆盖 BA1–52 全部编号；不代表个体细胞构筑学边界。未收录编号不外推为实体分区。',license='Retain MRIcroN / Chris Rorden / Brodmann attribution; see BrainNet notice')
    # Real subcortical region boundaries at 2 mm, lightly smoothed for teaching visualization.
    for lab in holabels:
        if lab['id'] in [1,2,12,13]: continue  # whole cerebral white matter/cortex are not discrete nuclei
        mesh=segment_mesh(ho,[lab['id']],f"ho-{lab['id']}.json")
        mesh.update({'id':f"ho-{lab['id']}",'atlas':'ho','label':lab['id'],'name':lab['name'],'source':FSL,'space':'FSL MNI152NLin6Asym','method':'Marching cubes of maxprob thr25 label; Gaussian sigma 0.65 voxels'})
        if lab['id']==8:
            mesh['usage']='rendered-envelope-teaching-subdivision'
            mesh['note']='Viewer renders the real whole-brainstem HO envelope, geometrically split at z=-22/-47 for teaching. Midbrain, pons and medulla subdivisions are not verified anatomical segmentations.'
        manifest['meshes'].append(mesh)
    cereb=nib.load(RAW/'Cerebellum.nii.gz')
    mesh=segment_mesh(cereb,list(range(1,29)),'cerebellum.json')
    mesh.update({'id':'cerebellum','source':FSL,'space':'FSL MNI152NLin6Asym','method':'Union of Diedrichsen cerebellar maxprob thr25 labels; 2 mm; smoothed','license':'CC BY-SA 4.0'})
    manifest['meshes'].append(mesh)
    manifest['counts']={key:len([l for l in item['labels'] if l['id'] and l['voxels']]) for key,item in atl.items()}
    write_json('manifest.json',manifest)
    write_json('asset-checksums.json',{p.relative_to(OUT).as_posix():sha(p) for p in OUT.rglob('*') if p.is_file() and p.name!='asset-checksums.json'})
    print(json.dumps({'counts':manifest['counts'],'meshes':len(manifest['meshes']),'t1':volume['shape'],'bytes':sum(p.stat().st_size for p in OUT.glob('*') if p.is_file())},indent=2))

if __name__=='__main__': main()

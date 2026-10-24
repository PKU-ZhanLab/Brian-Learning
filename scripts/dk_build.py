"""Export complete DK68 and its paired FSL-MNI152 cortical surfaces.

Uses published CBIG FreeSurfer reconstruction; no invented atlas labels and no
fitted geometry shift. tkregister RAS is converted by the paired volume header.
"""
from pathlib import Path
import hashlib,json,shutil
import numpy as np
import nibabel as nib
from nibabel.processing import resample_from_to
from scipy.spatial import cKDTree
import pyvista as pv

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources'/'dk'
OUT=ROOT/'public'/'data'/'dk-v2'
SPACE=ROOT/'public'/'data'/'space'
OUT.mkdir(parents=True,exist_ok=True); SPACE.mkdir(parents=True,exist_ok=True)

# Names follow the application's established medical terminology; source names
# and FreeSurfer integers remain separately recorded and recoverable.
ROWS=[
 ('bankssts','bankssts','颞上沟岸','Banks of superior temporal sulcus'),
 ('caudalanteriorcingulate','caudal-anterior-cingulate','尾侧前扣带皮层','Caudal anterior cingulate cortex'),
 ('caudalmiddlefrontal','caudal-middle-frontal','尾侧额中回','Caudal middle frontal gyrus'),
 ('cuneus','cuneus','楔叶','Cuneus'),('entorhinal','entorhinal','内嗅皮层','Entorhinal cortex'),
 ('fusiform','fusiform','梭状回','Fusiform gyrus'),('inferiorparietal','inferior-parietal','顶下小叶','Inferior parietal lobule'),
 ('inferiortemporal','inferior-temporal','颞下回','Inferior temporal gyrus'),
 ('isthmuscingulate','isthmus-cingulate','扣带回峡部','Isthmus of cingulate gyrus'),
 ('lateraloccipital','lateral-occipital','枕叶外侧皮层','Lateral occipital cortex'),
 ('lateralorbitofrontal','lateral-orbitofrontal','外侧眶额皮层','Lateral orbitofrontal cortex'),
 ('lingual','lingual','舌回','Lingual gyrus'),('medialorbitofrontal','medial-orbitofrontal','内侧眶额皮层','Medial orbitofrontal cortex'),
 ('middletemporal','middle-temporal','颞中回','Middle temporal gyrus'),
 ('parahippocampal','parahippocampal','海马旁皮层','Parahippocampal cortex'),
 ('paracentral','paracentral','中央旁小叶','Paracentral lobule'),
 ('parsopercularis','pars-opercularis','额下回盖部','Pars opercularis'),
 ('parsorbitalis','pars-orbitalis','额下回眶部','Pars orbitalis'),
 ('parstriangularis','pars-triangularis','额下回三角部','Pars triangularis'),
 ('pericalcarine','pericalcarine','距状沟周围皮层','Pericalcarine cortex'),
 ('postcentral','postcentral','中央后回','Postcentral gyrus'),
 ('posteriorcingulate','posterior-cingulate','后扣带皮层','Posterior cingulate cortex'),
 ('precentral','precentral','中央前回','Precentral gyrus'),('precuneus','precuneus','楔前叶','Precuneus'),
 ('rostralanteriorcingulate','rostral-anterior-cingulate','吻侧前扣带皮层','Rostral anterior cingulate cortex'),
 ('rostralmiddlefrontal','rostral-middle-frontal','吻侧额中回','Rostral middle frontal gyrus'),
 ('superiorfrontal','superior-frontal','额上回','Superior frontal gyrus'),
 ('superiorparietal','superior-parietal','顶上小叶','Superior parietal lobule'),
 ('superiortemporal','superior-temporal','颞上回','Superior temporal gyrus'),
 ('supramarginal','supramarginal','缘上回','Supramarginal gyrus'),
 ('frontalpole','frontal-pole','额极','Frontal pole'),('temporalpole','temporal-pole','颞极','Temporal pole'),
 ('transversetemporal','transverse-temporal','颞横回','Transverse temporal gyrus'),('insula','insula','岛叶','Insula')]

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def dump(path,data): Path(path).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def normals(vertices,faces):
    out=np.zeros(vertices.shape,dtype=float)
    tri=np.cross(vertices[faces[:,1]]-vertices[faces[:,0]],vertices[faces[:,2]]-vertices[faces[:,0]])
    for axis in range(3): np.add.at(out,faces[:,axis],tri)
    out/=np.maximum(np.linalg.norm(out,axis=1,keepdims=True),1e-12)
    return out

def main():
    sources=json.loads((RAW/'sources.json').read_text())
    for entry in sources['files']: assert sha(RAW/entry['file'])==entry['sha256'],entry['file']
    target=nib.as_closest_canonical(nib.load(ROOT/'data-sources/raw/MNI152_T1_2mm_brain.nii.gz'))
    orig=nib.load(RAW/'mri/orig.mgz')
    tk_to_scanner=orig.affine@np.linalg.inv(orig.header.get_vox2ras_tkr())
    source_parc=nib.load(RAW/'mri/aparc+aseg_182x218x182.nii.gz')
    parc=resample_from_to(source_parc,(target.shape,target.affine),order=0)
    source_labels=np.asarray(parc.dataobj,dtype=np.int32)
    canonical=np.zeros(target.shape,dtype=np.uint8)
    ctab={line.split()[1]:int(line.split()[0]) for line in (RAW/'label/aparc.annot.ctab').read_text().splitlines() if len(line.split())==6}
    labels=[]
    for h,side,word,zh,offset in [('lh','L','Left','左',1000),('rh','R','Right','右',2000)]:
        for index,(source_name,slug,cn,en) in enumerate(ROWS):
            val=index+1+(34 if h=='rh' else 0)
            fs_id=offset+ctab[source_name]
            canonical[source_labels==fs_id]=val
            xyz=np.argwhere(canonical==val)
            assert len(xyz)>0,(side,source_name)
            labels.append({'id':val,'sourceId':fs_id,'sourceName':source_name,'name':f'{word} {en}','zh':zh+cn,
              'hemisphere':side,'structureId':slug+('-l' if h=='lh' else '-r'),'voxels':len(xyz),
              'center':nib.affines.apply_affine(target.affine,xyz.mean(0)).round(3).tolist()})
    assert set(np.unique(canonical))==set(range(69))
    (OUT/'dk68.bin').write_bytes(canonical.tobytes(order='F'))
    nib.save(nib.Nifti1Image(canonical,target.affine),RAW/'dk68_space-MNI152NLin6Asym_res-2mm.nii.gz')

    # Source orig is a conformed intensity-quantized version of the FSL template.
    # Compare anatomy after applying only its documented voxel/world header.
    original_on_target=resample_from_to(orig,(target.shape,target.affine),order=1).get_fdata()
    t1=target.get_fdata(); mask=t1>500
    X=np.c_[original_on_target[mask],np.ones(mask.sum())]
    scale,intercept=np.linalg.lstsq(X,t1[mask],rcond=None)[0]
    residual=t1[mask]-(scale*original_on_target[mask]+intercept)
    comparison={'pearsonR':float(np.corrcoef(t1[mask],original_on_target[mask])[0,1]),
      'brainVoxelsCompared':int(mask.sum()),'mask':'target T1 intensity > 500',
      'normalizedRmseByTargetStd':float(np.sqrt(np.mean(residual**2))/np.std(t1[mask])),
      'intensityFitScale':float(scale),'intensityFitIntercept':float(intercept),
      'sourceInputEvidence':'recon-all.cmd line 2 names FSL 4.1.5 data/standard/MNI152_T1_1mm.nii.gz',
      'interpretation':'Same FSL template anatomy, with FreeSurfer conforming/intensity quantization; this is not a new registration estimate.'}
    assert comparison['pearsonR']>0.995
    meshes=[]
    for h,side in [('lh','left'),('rh','right')]:
        vertices,faces,volume_info=nib.freesurfer.read_geometry(RAW/f'surf/{h}.pial',read_metadata=True)
        ann,_,names=nib.freesurfer.read_annot(RAW/f'label/{h}.aparc.annot')
        assert len(ann)==len(vertices)
        # Metadata gives the same scanner origin as the paired MRI; checked before conversion.
        assert np.allclose(volume_info['cras'],tk_to_scanner[:3,3])
        poly=pv.PolyData(vertices,np.c_[np.full(len(faces),3),faces])
        reduced=poly.decimate_pro(0.72,preserve_topology=True)
        distance,original_index=cKDTree(vertices).query(reduced.points)
        assert distance.max()<1e-7  # decimate_pro retains original points; annotations are exact vertex transfers
        df=reduced.faces.reshape(-1,4)[:,1:]
        transformed=nib.affines.apply_affine(tk_to_scanner,reduced.points)
        fs_to_dk={ctab[row[0]]:i+1+(34 if h=='rh' else 0) for i,row in enumerate(ROWS)}
        vertex_labels=np.array([fs_to_dk.get(int(ann[i]),0) for i in original_index],dtype=np.uint8)
        expected=set(range(1,35)) if h=='lh' else set(range(35,69))
        assert set(vertex_labels)-{0}==expected
        for lab in labels:
            if lab['id'] not in expected: continue
            pts=transformed[vertex_labels==lab['id']]
            lab['surfaceCenter']=pts.mean(0).round(3).tolist()
            # An actual vertex (closest to centroid) is a visible anchor; centroid can lie under cortex.
            lab['surfaceAnchor']=pts[np.argmin(np.linalg.norm(pts-pts.mean(0),axis=1))].round(3).tolist()
        for surface in ['pial','white']:
            if surface=='white':
                white,white_faces=nib.freesurfer.read_geometry(RAW/f'surf/{h}.white')
                assert np.array_equal(white_faces,faces)
                coordinates=nib.affines.apply_affine(tk_to_scanner,white[original_index])
            else: coordinates=transformed
            filename=f'cortex-{side}.json' if surface=='pial' else f'white-{side}.json'
            payload={'positions':np.round(coordinates,3).reshape(-1).tolist(),'indices':df.reshape(-1).tolist(),
              'normals':np.round(normals(coordinates,df),4).reshape(-1).tolist(),'vertexLabels':vertex_labels.tolist(),
              'atlasId':'dk','space':'MNI152NLin6Asym','surface':surface,'hemisphere':'L' if h=='lh' else 'R'}
            dump(OUT/filename,payload)
            meshes.append({'id':f'cortex-{side}' if surface=='pial' else f'white-{side}',
              'file':f'dk-v2/{filename}','source':'https://github.com/ThomasYeoLab/CBIG/tree/'+sources['commit']+'/data/templates/volume/FSL_MNI152_FS4.5.0',
              'space':'MNI152NLin6Asym','surface':surface,'atlasId':'dk','vertexLabels':True,
              'vertices':len(coordinates),'triangles':len(df),'sha256':sha(OUT/filename),
              'processing':'VTK DecimatePro target reduction 0.72, topology preserved; original vertices and annotations retained',
              'maxVertexTransferDistanceMm':float(distance.max()),'annotationLabelsPresent':len(expected)})

    metadata={'schemaVersion':2,'available':True,'data':'dk-v2/dk68.bin','shape':list(target.shape),
      'affine':target.affine.reshape(-1).tolist(),'dtype':'uint8','order':'x-fastest',
      'name':'Desikan–Killiany 68 · FSL MNI152 paired reconstruction','space':'MNI152NLin6Asym',
      'labels':labels,'positiveLabelCount':68,'source':'https://github.com/ThomasYeoLab/CBIG/tree/'+sources['commit']+'/data/templates/volume/FSL_MNI152_FS4.5.0',
      'license':'CBIG MIT; retain FreeSurfer and MNI template attribution',
      'note':'完整34×2 DK皮层区，包含双侧岛叶。来自同一FSL MNI152模板的FreeSurfer分割与配对皮层表面；2mm标签最近邻重采样，顶点标签来自原始aparc.annot。不是个体解剖边界。',
      'alignmentStatus':'verified-native','meshes':meshes,'sha256':sha(OUT/'dk68.bin'),
      'templateComparison':comparison,'tkRasToScannerRas':tk_to_scanner.reshape(-1).tolist(),
      'sourceCommit':sources['commit'],'sourceSha256':sha(RAW/'mri/aparc+aseg_182x218x182.nii.gz')}
    dump(OUT/'metadata.json',metadata)
    dump(OUT/'labels.json',labels)
    shutil.copyfile(RAW/'LICENSE-CBIG.md',OUT/'LICENSE-CBIG.md')
    dump(OUT/'checksums.json',{p.name:sha(p) for p in OUT.glob('*') if p.is_file() and p.name!='checksums.json'})
    dump(SPACE/'template-comparison.json',comparison)
    print(json.dumps({'labels':len(labels),'insula':[x for x in labels if x['sourceName']=='insula'],
      'surfaces':[{k:m[k] for k in ['id','vertices','triangles','annotationLabelsPresent']} for m in meshes],
      'templateComparison':comparison},ensure_ascii=False,indent=2))

if __name__=='__main__': main()

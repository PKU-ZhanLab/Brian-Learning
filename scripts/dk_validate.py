"""Independent integrity/coverage audit of the exported paired DK data."""
from pathlib import Path
import hashlib, json
import numpy as np
import nibabel as nib
from scipy.spatial import cKDTree

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources/dk'; OUT=ROOT/'public/data/dk-v2'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    meta=json.loads((OUT/'metadata.json').read_text(encoding='utf-8'))
    checksums=json.loads((OUT/'checksums.json').read_text(encoding='utf-8'))
    for name,expected in checksums.items(): assert sha(OUT/name)==expected,name
    volume=np.frombuffer((OUT/'dk68.bin').read_bytes(),dtype=np.uint8).reshape(meta['shape'],order='F')
    affine=np.array(meta['affine']).reshape(4,4)
    assert set(np.unique(volume))==set(range(69))
    assert len(meta['labels'])==68 and len({x['structureId'] for x in meta['labels']})==68
    for lab in meta['labels']:
        ijk=np.argwhere(volume==lab['id']); xyz=nib.affines.apply_affine(affine,ijk)
        assert len(ijk)==lab['voxels']
        assert np.allclose(xyz.mean(0),lab['center'],atol=.00051)
        assert xyz.mean(0)[0] * (-1 if lab['hemisphere']=='L' else 1)>0
    matrix=np.array(meta['tkRasToScannerRas']).reshape(4,4)
    orig=nib.load(RAW/'mri/orig.mgz')
    assert np.allclose(matrix,orig.affine@np.linalg.inv(orig.header.get_vox2ras_tkr()))
    meshes=[]
    for descriptor in meta['meshes']:
        path=ROOT/'public/data'/descriptor['file']; data=json.loads(path.read_text(encoding='utf-8'))
        v=np.asarray(data['positions']).reshape(-1,3); f=np.asarray(data['indices']).reshape(-1,3)
        normal=np.asarray(data['normals']).reshape(-1,3); labels=np.asarray(data['vertexLabels'])
        assert len(v)==len(labels)==len(normal)==descriptor['vertices']
        assert len(f)==descriptor['triangles'] and f.min()>=0 and f.max()<len(v)
        assert np.isfinite(v).all() and np.isfinite(normal).all()
        assert np.all(np.linalg.norm(np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]),axis=1)>0)
        hemi='lh' if data['hemisphere']=='L' else 'rh'
        source_vertices,source_faces=nib.freesurfer.read_geometry(RAW/f'surf/{hemi}.{data["surface"]}')
        source_world=nib.affines.apply_affine(matrix,source_vertices)
        distances,indices=cKDTree(source_world).query(v)
        assert distances.max()<.0009
        expected=set(range(1,35)) if hemi=='lh' else set(range(35,69))
        assert set(labels)-{0}==expected
        meshes.append({'file':descriptor['file'],'vertices':len(v),'triangles':len(f),
          'presentLabels':len(expected),'maxDistanceToOriginalVertexMm':float(distances.max()),
          'sha256':sha(path)})
    report={'status':'passed','labelCount':68,'labelsPerHemisphere':34,
      'insulaVoxels':{x['hemisphere']:x['voxels'] for x in meta['labels'] if x['sourceName']=='insula'},
      'sourceHashesVerified':len(json.loads((RAW/'sources.json').read_text(encoding='utf-8'))['files']),
      'outputHashesVerified':len(checksums),'meshes':meshes,
      'checks':['Exact voxel counts and centroids','Hemisphere consistency','All 68 labels nonempty',
        'Both insulae present','No degenerate triangles','All mesh vertices match paired original surfaces',
        'Header-derived tkRAS-to-scannerRAS','Source template intensity agreement recorded separately'],
      'scope':'Data integrity and source agreement; not clinical or expert anatomical certification.'}
    # Re-read raw hashes as an audit, independent of the build invocation.
    for record in json.loads((RAW/'sources.json').read_text(encoding='utf-8'))['files']:
        assert sha(RAW/record['file'])==record['sha256']
    (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__': main()

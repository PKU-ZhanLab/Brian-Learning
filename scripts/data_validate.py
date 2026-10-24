"""Check source integrity, RAS orientation, label coverage and exported topology."""
from pathlib import Path
import hashlib
import json
import numpy as np

ROOT=Path(__file__).resolve().parents[1]/'public'/'data'
RAW=Path(__file__).resolve().parents[1]/'data-sources'/'raw'
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
checks=[]

def check(name,condition):
    if not condition: raise AssertionError(name)
    checks.append(name)

def volume(meta):
    dtype=np.uint8 if meta['dtype']=='uint8' else np.dtype('<u2')
    values=np.frombuffer((ROOT/meta['data']).read_bytes(),dtype=dtype)
    check(meta['data']+' byte length',values.size==np.prod(meta['shape']))
    return values.reshape(meta['shape'],order='F')

def lookup(meta,arr,ras):
    ijk=np.rint((np.linalg.inv(np.array(meta['affine']).reshape(4,4))@np.r_[ras,1])[:3]).astype(int)
    return int(arr[tuple(ijk)])

checksums=json.loads((ROOT/'asset-checksums.json').read_text())
for file,expected in checksums.items():
    check(file+' SHA-256',hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==expected)

for source in json.loads((RAW/'download-manifest.json').read_text()):
    check(source['file']+' preserved original SHA-256',hashlib.sha256((RAW/source['file']).read_bytes()).hexdigest()==source['sha256'])

expected_source_sha={
 'BrainMesh_ICBM152Left.nv':'12c37dc6eb02b4bd037ff9783d47a9748ae3541a54a0609da0e703fa189ab061',
 'BrainMesh_ICBM152Right.nv':'cd94c0719e1f7f8c1a521147167a2552cc3854bbcd3b9092d0a2c1c947a0aabe',
 'BrainNet_AAL_Label.mat':'1fe217ef443cff395884e3c5f672891085cb10858a028048b454d02591316ec9',
 'BrainNet_Brodmann_Label.mat':'ed057cd513391e3aefae46e4ade5dea5b23b72da5b7cdb0064b7ebb44f347f8e',
}
for name,sha in expected_source_sha.items():
    check(name+' upstream pinned SHA',hashlib.sha256((RAW/name).read_bytes()).hexdigest()==sha)

for key,meta in manifest['atlases'].items():
    arr=volume(meta)
    present=set(np.unique(arr).tolist())-{0}
    ids={label['id'] for label in meta['labels']}-{0}
    check(key+' complete label table',present==ids)
    check(key+' no duplicate labels',len(meta['labels'])==len({x['id'] for x in meta['labels']}))
    check(key+' declared positive label count',len(present)==manifest['counts'][key])
    affine=np.array(meta['affine']).reshape(4,4)
    check(key+' invertible RAS affine',np.linalg.det(affine[:3,:3])>0)
    check(key+' axis-aligned declared RAS',np.all(np.diag(affine)[:3]>0) and np.allclose(affine[:3,:3],np.diag(np.diag(affine)[:3])))

ho=manifest['atlases']['ho']; arr=volume(ho)
check('left thalamus landmark',lookup(ho,arr,[-10,-18,6])==4)
check('right thalamus landmark',lookup(ho,arr,[10,-18,6])==15)
check('left putamen landmark',lookup(ho,arr,[-24,0,2])==6)
check('right putamen landmark',lookup(ho,arr,[24,0,2])==17)
for label in ho['labels']:
    if label['name'].startswith('Left '): check(label['name']+' negative RAS x',label['center'][0]<0)
    if label['name'].startswith('Right '): check(label['name']+' positive RAS x',label['center'][0]>0)

for mesh in manifest['meshes']:
    d=json.loads((ROOT/mesh['file']).read_text())
    v=np.array(d['positions']).reshape(-1,3); f=np.array(d['indices']).reshape(-1,3); n=np.array(d['normals']).reshape(-1,3)
    check(mesh['id']+' finite geometry',np.isfinite(v).all() and np.isfinite(n).all())
    check(mesh['id']+' valid triangle indices',f.min()>=0 and f.max()<len(v))
    check(mesh['id']+' normals match vertices',n.shape==v.shape)
    check(mesh['id']+' outward winding',np.median(np.sum((v-v.mean(0))*n,axis=1))>0)
    if mesh['id']=='cortex-left': check('left surface RAS x sign',np.all(v[:,0]<0))
    if mesh['id']=='cortex-right': check('right surface RAS x sign',np.all(v[:,0]>0))

t1=volume(manifest['template'])
check('T1 nonempty brain contrast',np.count_nonzero(t1)>100000 and t1.max()==255)
check('BA explicit missing IDs',not ({12,13,14,15,16,31,33,49,50,51,52}&{x['id'] for x in manifest['atlases']['ba']['labels']}))
check('DK limitation is explicit','未收录岛叶' in manifest['atlases']['dk']['note'])
print(json.dumps({'passed':len(checks),'failed':0,'atlasLabels':manifest['counts'],'meshCount':len(manifest['meshes']),'sourceHashesPinned':len(expected_source_sha)},indent=2))

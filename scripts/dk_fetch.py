"""Fetch a pinned CBIG FSL MNI152 FreeSurfer reconstruction (data only)."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data-sources'/'dk'
OUT.mkdir(parents=True,exist_ok=True)
commit=(OUT/'CBIG-commit.txt').read_text(encoding='utf-8-sig').strip()
BASE=f'https://raw.githubusercontent.com/ThomasYeoLab/CBIG/{commit}/'
PREFIX='data/templates/volume/FSL_MNI152_FS4.5.0/'
files=['mri/aparc+aseg.mgz','mri/aparc+aseg_182x218x182.nii.gz','mri/orig.mgz',
       'mri/norm2mm.nii.gz','surf/lh.pial','surf/rh.pial','surf/lh.white','surf/rh.white',
       'label/lh.aparc.annot','label/rh.aparc.annot','label/aparc.annot.ctab',
       'scripts/recon-all.cmd','scripts/recon-all.log']
items={file:BASE+PREFIX+file for file in files}
items['LICENSE-CBIG.md']=BASE+'LICENSE.md'
def fetch(item):
    name,url=item; path=OUT/name; path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        req=urllib.request.Request(url,headers={'User-Agent':'NeuroAtlas-Teaching/2.0'})
        with urllib.request.urlopen(req,timeout=120) as response: data=response.read()
        part=path.with_suffix(path.suffix+'.part'); part.write_bytes(data); part.replace(path)
    print(name,path.stat().st_size,flush=True)
    return {'file':name,'url':url,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=4) as pool: records=list(pool.map(fetch,items.items()))
    (OUT/'sources.json').write_text(json.dumps({'repository':'ThomasYeoLab/CBIG','commit':commit,'files':records},indent=2),encoding='utf-8')

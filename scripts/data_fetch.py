"""Fetch public, attributed teaching data into the project; never execute downloads."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data-sources' / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
BN = 'https://raw.githubusercontent.com/mingruixia/BrainNet-Viewer/master/'
NP = 'https://raw.githubusercontent.com/neurodata/neuroparc/master/'
FSL = 'https://ftp.nmr.mgh.harvard.edu/pub/dist/freesurfer/tutorial_packages_centos6/OSX/fsl_501/data/atlases/'
ITEMS = {
 'BrainMesh_ICBM152Left.nv': BN+'src/matlab/BrainNetViewer/Data/SurfTemplate/BrainMesh_ICBM152Left.nv',
 'BrainMesh_ICBM152Right.nv': BN+'src/matlab/BrainNetViewer/Data/SurfTemplate/BrainMesh_ICBM152Right.nv',
 'AAL3v2.nii.gz': BN+'resources/atlases/AAL3v2/AAL3v2.nii.gz',
 'AAL3v2_labels.txt': BN+'resources/atlases/AAL3v2/AAL3v2_labels.txt',
 'BrainNet_AAL_Label.mat': BN+'src/matlab/BrainNetViewer/BrainNet_AAL_Label.mat',
 'BrainNet_Brodmann_Label.mat': BN+'src/matlab/BrainNetViewer/BrainNet_Brodmann_Label.mat',
 'Desikan.nii.gz': NP+'atlases/label/Human/Desikan_space-MNI152NLin6_res-2x2x2.nii.gz',
 'Desikan.csv': NP+'atlases/label/Human/Anatomical-labels-csv/Desikan.csv',
 'Desikan-metadata.json': NP+'atlases/label/Human/Metadata-json/Desikan_space-MNI152NLin6_res-2x2x2.json',
 'Neuroparc-LICENSE.md': NP+'LICENSE.md',
 'JHU.nii.gz': FSL+'JHU/JHU-ICBM-labels-2mm.nii.gz',
 'JHU-labels.xml': FSL+'JHU-labels.xml',
 'HarvardOxford-sub.nii.gz': FSL+'HarvardOxford/HarvardOxford-sub-maxprob-thr25-2mm.nii.gz',
 'HarvardOxford-Subcortical.xml': FSL+'HarvardOxford-Subcortical.xml',
 'HarvardOxford-fs-labels.txt': FSL+'HarvardOxford/labels',
 'HarvardOxford-relabel.sh': FSL+'HarvardOxford/relabel',
 'Cerebellum.nii.gz': FSL+'Cerebellum/Cerebellum-MNIfnirt-maxprob-thr25-2mm.nii.gz',
 'Cerebellum.xml': FSL+'Cerebellum_MNIfnirt.xml',
 'MNI152_T1_2mm_brain.nii.gz': FSL.replace('atlases/','standard/')+'MNI152_T1_2mm_brain.nii.gz',
}

def fetch(item):
    name, url = item
    path = RAW/name
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent':'NeuroAtlas-Teaching/1.0'})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
        path.write_bytes(data)
    print(name, path.stat().st_size, flush=True)
    return {'file':name, 'url':url, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes':path.stat().st_size}

if __name__ == '__main__':
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(fetch, ITEMS.items()): results.append(result)
    (RAW/'download-manifest.json').write_text(json.dumps(results,indent=2),encoding='utf-8')

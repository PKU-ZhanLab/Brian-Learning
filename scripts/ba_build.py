"""Build two explicitly distinct BA datasets from original FSL releases.

Use the existing mne conda environment. No packages are installed. Source volumes
are reoriented to RAS only: no new anatomical registration is claimed.
"""
from pathlib import Path
import json, hashlib, re
import xml.etree.ElementTree as ET
import numpy as np
import nibabel as nib

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources/ba'
OUT=ROOT/'public/data/ba-v2'
BASE='https://ftp.nmr.mgh.harvard.edu/pub/dist/freesurfer/tutorial_packages_centos6/OSX/fsl_501/data/atlases/'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,obj): p.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
def export(stem,data,affine,labels,**meta):
    data=data.astype('uint8')
    out=OUT/(stem+'.bin');out.write_bytes(data.tobytes(order='F'))
    present=set(np.unique(data))-{0}
    labels=[x for x in labels if x['id'] in present]
    for row in labels:
        idx=np.argwhere(data==row['id']);row['voxels']=int(len(idx))
        row['center']=nib.affines.apply_affine(affine,idx.mean(axis=0)).round(2).tolist()
    return dict(available=True,data='ba-v2/'+out.name,shape=list(data.shape),affine=affine.ravel().tolist(),
                dtype='uint8',order='x-fastest',labels=labels,sha256=sha(out),**meta)

OUT.mkdir(parents=True,exist_ok=True)
tal=nib.as_closest_canonical(nib.load(RAW/'Talairach-labels-2mm.nii.gz'))
taldata=np.asarray(tal.dataobj,dtype=int)
tal_labels={int(x.attrib['index']):x.text.strip() for x in ET.parse(RAW/'Talairach.xml').findall('.//label')}
# This label-type XML includes background index 0; unlike maxprob it has NO +1 offset.
tal_ba=np.zeros(taldata.shape,dtype='uint8');mapping=[]
for index,label in tal_labels.items():
    match=re.search(r'Brodmann area (\d+)',label)
    if match:
        number=int(match[1]);tal_ba[taldata==index]=number
        mapping.append(dict(sourceId=index,sourceLabel=label,ba=number))
historic=export('talairach-ba',tal_ba,tal.affine,[dict(id=n,name=f'BA{n}',ba=n) for n in range(1,53)],
    name='Brodmann — FSL Talairach historical labels',space='MNI152 (FSL published Lancaster affine)',
    nativeSpace='Talairach digitized atlas',alignmentStatus='published-affine',
    source='https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html#talairach-atlas',
    note='FSL 发布的 Talairach 历史标签，经 Lancaster 2007 校正仿射映射至 MNI152。来源为单脑、粗切片数字化，不是现代组织学群体边界。',
    limitations=['仿射映射不消除局部解剖差异。','左右使用同一 BA 编号；按 RAS 坐标辨别侧别。','空白处表示无标签，不能由邻近标签补齐。'])

jul=nib.as_closest_canonical(nib.load(RAW/'Juelich-maxprob-thr25-2mm.nii.gz'))
juldata=np.asarray(jul.dataobj,dtype=int)
prob=nib.as_closest_canonical(nib.load(RAW/'Juelich-prob-2mm.nii.gz'))
assert np.allclose(jul.affine,prob.affine) and jul.shape==prob.shape[:3]
probdata=np.asarray(prob.dataobj)
jul_labels=[];jul_ba=np.zeros(juldata.shape,dtype='uint8');winning_prob=np.zeros(juldata.shape,dtype='uint8')
for node in ET.parse(RAW/'Juelich.xml').findall('.//label'):
    label=node.text.strip();match=re.search(r'\bBA(\d+)([apb]?)\b',label)
    if not match: continue
    source=int(node.attrib['index']);index=source+1
    mask=juldata==index;jul_ba[mask]=index;winning_prob[mask]=probdata[...,source][mask]
    jul_labels.append(dict(id=index,name=label,ba=int(match[1]),subdivision=match[2],hemisphere=label[-1],probabilityChannel=source))
histology=export('juelich-ba',jul_ba,jul.affine,jul_labels,
    name='Jülich histological BA subset (FSL 5.0.1)',space='MNI152 (FSL Juelich distribution)',
    alignmentStatus='published-template',probability='ba-v2/juelich-ba-probability.bin',thresholdPercent=25,
    source='https://fsl.fmrib.ox.ac.uk/fsl/docs/other/julich.html',
    note='Jülich 尸检组织学概率图的明确 BA 子集，使用 FSL 最大概率图（25% 阈值），保留左右与 3a/3b、4a/4p 亚区。未收录的编号不以脑回推断。',
    limitations=['仅明确含 BA 名称的已发布区域；不等于全部人类细胞构筑学分区。','其他非 BA 名称的 Jülich 区域不自动改名为 BA。','最大概率标签与群体概率不代表个体边界。','该旧版 FSL 数据的精确 MNI152 模板变体未从原始元数据独立确认。'])
(OUT/'juelich-ba-probability.bin').write_bytes(winning_prob.tobytes(order='F'))
histology['probabilitySha256']=sha(OUT/'juelich-ba-probability.bin')
historic_numbers=sorted({x['id'] for x in historic['labels']})
histology_numbers=sorted({x['ba'] for x in histology['labels']})
coverage=[dict(number=n,historical=n in historic_numbers,histological=n in histology_numbers,
               histologicalLabels=[x['name'] for x in histology['labels'] if x['ba']==n],
               status='组织学子集 + 历史标签' if n in histology_numbers else '历史仿射标签' if n in historic_numbers else '无可用空间标签') for n in range(1,53)]
result=dict(generated='2026-10-25',atlases={'ba':historic,'ba-histology':histology},coverage=coverage,
            historicalNumbers=historic_numbers,histologicalNumbers=histology_numbers,
            missingNumbers=[n for n in range(1,53) if n not in historic_numbers and n not in histology_numbers])
save(OUT/'manifest.json',result)
save(RAW/'talairach-ba-label-mapping.json',mapping)
files=[('Talairach.xml','Talairach.xml'),('Talairach-labels-2mm.nii.gz','Talairach/Talairach-labels-2mm.nii.gz'),('Juelich.xml','Juelich.xml'),('Juelich-maxprob-thr25-2mm.nii.gz','Juelich/Juelich-maxprob-thr25-2mm.nii.gz'),('Juelich-prob-2mm.nii.gz','Juelich/Juelich-prob-2mm.nii.gz')]
save(RAW/'source-manifest.json',dict(downloaded='2026-10-25',files=[dict(file=n,url=BASE+remote,sha256=sha(RAW/n),bytes=(RAW/n).stat().st_size) for n,remote in files],license='FSL atlas-specific terms: see https://fsl.fmrib.ox.ac.uk/fsl/docs/license.html'))
assert set(np.unique(tal_ba))-{0}==set(historic_numbers)
assert all(x['voxels']>0 for x in histology['labels'])
assert np.all(winning_prob[jul_ba>0]>=25)
assert all((x['center'][0]<0)==(x['hemisphere']=='L') for x in histology['labels'])
print(json.dumps(dict(historical=len(historic_numbers),historicalNumbers=historic_numbers,histologicalParents=histology_numbers,histologicalBilateralSubdivisions=len(histology['labels']),missing=result['missingNumbers']),ensure_ascii=False))

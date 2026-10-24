"""Record space evidence separately from source labels and UI configuration."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data-sources/space'; OUT=ROOT/'public/data/space'
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

def main():
    dk=read(ROOT/'public/data/dk-v2/metadata.json')
    target='MNI152NLin6Asym'
    atlases={
      'dk':{'status':'verified-native','nativeSpace':target,'canOverlayOnTarget':True,
        'operation':'Paired FSL template FreeSurfer reconstruction; header-derived tkRAS->scannerRAS for surfaces; nearest-neighbour 2mm labels.',
        'evidence':['dk-v2/metadata.json','dk-v2/validation.json','space/template-comparison.json'],
        'source':dk['source'],'newRegistrationEstimated':False,
        'limitations':'Template segmentation, not individual or expert-certified anatomical boundaries.'},
      'aal':{'status':'unverified-template','nativeSpace':'MNI-family; precise template variant and paired image unverified',
        'canOverlayOnTarget':False,'operation':'Header-based grid resampling only. No anatomical registration.',
        'evidence':['data-sources/raw/BrainNet_AAL_Label.mat','data-sources/raw/download-manifest.json'],
        'source':'https://github.com/mingruixia/BrainNet-Viewer',
        'registrationStatus':'unavailable','missingEvidence':'A verified source anatomical template paired with this distributed label image.',
        'limitations':'Matching voxel axes, origin or grid do not establish matching anatomy. Retained as separate atlas data.'},
      'aal3':{'status':'unverified-template','nativeSpace':'AAL3v2 MNI-family; precise template variant and paired image unverified',
        'canOverlayOnTarget':False,'operation':'Header-based grid resampling only. No anatomical registration.',
        'evidence':['data-sources/raw/AAL3v2.nii.gz','data-sources/raw/download-manifest.json'],
        'source':'https://www.gin.cnrs.fr/en/tools/aal/',
        'registrationStatus':'unavailable','missingEvidence':'A verified source anatomical template paired with this distributed label image.',
        'limitations':'The AAL3 source label set is preserved; its MNI designation alone does not prove alignment with FSL NLin6Asym.'},
      'ho':{'status':'published-template','nativeSpace':'FSL Harvard-Oxford MNI152 distribution',
        'canOverlayOnTarget':True,'operation':'Use original authors\' published MNI mapping; RAS array reorientation only here.',
        'evidence':['data-sources/raw/download-manifest.json','data-sources/raw/HarvardOxford-sub.nii.gz'],
        'source':'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html',
        'newRegistrationEstimated':False,'limitations':'Published population atlas; individual morphology and label uncertainty remain.'},
      'jhu':{'status':'published-template','nativeSpace':'JHU ICBM-DTI-81 / FSL-distributed MNI grid',
        'canOverlayOnTarget':True,'operation':'Use published FSL label image in its MNI grid; RAS reorientation only here.',
        'evidence':['data-sources/raw/download-manifest.json','data-sources/raw/JHU.nii.gz'],
        'source':'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html',
        'newRegistrationEstimated':False,
        'limitations':'Published cross-template mapping accepted from the distribution, not independently re-estimated. White-matter labels are not reconstructed fibers.'},
      'ba':{'status':'published-affine','nativeSpace':'Talairach digitized single-brain atlas',
        'canOverlayOnTarget':True,'operation':'FSL-distributed Lancaster 2007 Talairach->MNI152 affine mapping, already applied in source. Not applied twice.',
        'evidence':['ba-v2/manifest.json','data-sources/ba/source-manifest.json'],
        'source':'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html#talairach-atlas',
        'newRegistrationEstimated':False,
        'limitations':'Historical digitization and approximate affine mapping; not modern complete cytoarchitectonic boundaries.'},
      'ba-legacy':{'status':'legacy','nativeSpace':'Historical MRIcroN / BrainNet MNI-like BA; precise variant unverified',
        'canOverlayOnTarget':False,'operation':'Retained historical data; no verified anatomical registration.',
        'evidence':['legacy-manifest-v1.json','data-sources/raw/BrainNet_Brodmann_Label.mat'],
        'source':'https://github.com/mingruixia/BrainNet-Viewer',
        'registrationStatus':'unavailable','limitations':'Do not combine missing legacy numbers with FSL BA as one aligned atlas.'},
      'ba-histology':{'status':'published-template','nativeSpace':'FSL 5.0.1 Juelich MNI152 distribution; exact MNI variant unverified',
        'canOverlayOnTarget':True,'operation':'Use original authors\' FSL-published mapping, 25% max-probability labels. No registration re-estimated here.',
        'evidence':['ba-v2/manifest.json','data-sources/ba/source-manifest.json'],
        'source':'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/julich.html',
        'newRegistrationEstimated':False,
        'limitations':'Overlay uses published FSL template placement. The old distribution\'s exact template variant has not been independently recovered; only explicit BA-named subset is included.'}
    }
    for record in atlases.values(): record['targetSpace']=target
    datasets={
      'cerebellum':{'status':'published-nonlinear','nativeSpace':'Diedrichsen cerebellar atlas, FSL MNI FNIRT distribution',
        'targetSpace':target,'canOverlayOnTarget':True,'operation':'Already normalized by source authors with FNIRT; no further estimated transform here.',
        'source':'https://www.diedrichsenlab.org/imaging/propatlas.htm','evidence':['data-sources/raw/Cerebellum.nii.gz','data-sources/raw/download-manifest.json']},
      'hcp1065':{'status':'registered','nativeSpace':'MNI152NLin2009aAsym','targetSpace':target,
        'canOverlayOnTarget':True,'operation':'This project estimated 2mm MI affine + symmetric diffeomorphic CC template registration. Native streamlines must be transformed through the recorded point transform.',
        'evidence':['space/hcp1065-registration.json','space/hcp1065-registration-qc.png'],
        'geometryApplication':'See anatomy/manifest.json per-structure geometry and targetAlignment; native source JSON remains retained.',
        'source':'https://brain.labsolver.org/hcp_trk_atlas.html','newRegistrationEstimated':True,
        'limitations':'Population tractography and template registration estimate, not individual nerve accuracy. Original and registered paths must remain distinct.'},
      'pam50':{'status':'unverified-cross-template','nativeSpace':'PAM50 straightened spinal template',
        'targetSpace':target,'canOverlayOnTarget':False,'operation':'Native PAM50 anatomy only; no joint brain/spinal registration estimated.',
        'evidence':['anatomy/manifest.json'],'source':'https://github.com/spinalcordtoolbox/PAM50',
        'limitations':'Straightened cord should be shown as a separate atlas reference, not an anatomically continuous registered extension of the FSL brain.'}
    }
    write(OUT/'alignment.json',{'schemaVersion':1,'targetSpace':target,'coordinateSystem':'RAS','units':'mm',
      'targetImage':'data-sources/raw/MNI152_T1_2mm_brain.nii.gz',
      'targetImageSha256':sha(ROOT/'data-sources/raw/MNI152_T1_2mm_brain.nii.gz'),
      'policy':'Reorientation and grid resampling do not constitute anatomical registration. Native, author-mapped, locally registered and unverified data remain distinct.',
      'statusDefinitions':{'verified-native':'Paired anatomy and labels verified against the target template.',
        'published-template':'Published FSL atlas placement accepted; no local registration estimate.',
        'published-affine':'An explicitly documented source affine mapping was already applied.',
        'registered':'A local template-to-template transform was estimated and audited.',
        'unverified-template':'Required source anatomy or mapping evidence unavailable; target overlay disabled.',
        'legacy':'Historical data retained without target alignment proof.'},
      'atlases':atlases,'datasets':datasets})
    commit=(RAW/'TemplateFlow-commit.txt').read_text(encoding='utf-8-sig').strip()
    files=[]
    for name in ['tpl-MNI152NLin2009aAsym_res-1_T1w.nii.gz','tpl-MNI152NLin2009aAsym_res-1_desc-brain_mask.nii.gz']:
        files.append({'file':name,'url':'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin2009aAsym/'+name,
          'sha256':sha(RAW/name),'bytes':(RAW/name).stat().st_size})
    for name,original in [('MNI152NLin2009aAsym-template_description.json','template_description.json'),('LICENSE-MNI.txt','LICENSE')]:
        files.append({'file':name,'url':f'https://raw.githubusercontent.com/templateflow/tpl-MNI152NLin2009aAsym/{commit}/{original}',
          'sha256':sha(RAW/name),'bytes':(RAW/name).stat().st_size})
    write(RAW/'sources.json',{'repository':'templateflow/tpl-MNI152NLin2009aAsym','commit':commit,
      'files':files,'headerNote':'Registration uses each actual NIfTI header. Repository template_description.json contains stale/different generic res shape/origin fields and is not used to place voxels.'})
    (OUT/'LICENSE-MNI.txt').write_bytes((RAW/'LICENSE-MNI.txt').read_bytes())
    assert all(atlases[key]['canOverlayOnTarget'] is False for key in ['aal','aal3','ba-legacy'])
    print('Recorded 8 atlas and 3 additional dataset space policies; AAL/AAL3/legacy BA target overlay disabled.')
if __name__=='__main__': main()

"""Apply the separately audited template-to-template field to real HCP streamlines.

Original native-space files are retained. This estimate is not an official
transform and does not certify individual cranial-nerve/tract endpoint anatomy.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from space_register import load_mapping, transform_source_ras_mm

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/anatomy'
REPORT=ROOT/'public/data/space/hcp1065-registration.json'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,data): path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')

def main():
    report=json.loads(REPORT.read_text())
    if report['status']!='registered' or report['jacobianTargetToSourceWithinBrain']['nonPositiveVoxels']!=0: raise ValueError('Registration QA is not acceptable')
    mapping=load_mapping()
    manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf8'))
    errors=[]; displacements=[]; results=[]
    derived=OUT/'registered-nlin6'; derived.mkdir(exist_ok=True)
    for identifier,entry in manifest['structures'].items():
        if entry.get('dataset')!='HCP1065' or entry.get('representation')!='tractography': continue
        original=entry.get('nativeGeometry',entry['geometry'])
        path=ROOT/'public'/original.lstrip('/')
        data=json.loads(path.read_text())
        lengths=[len(line)//3 for line in data['streamlines']]
        source=np.concatenate([np.asarray(line,dtype=float).reshape(-1,3) for line in data['streamlines']])
        target=transform_source_ras_mm(source,mapping)
        roundtrip=mapping.transform_points(target)
        err=np.linalg.norm(roundtrip-source,axis=1)
        if not np.isfinite(target).all() or np.percentile(err,95)>.25 or np.max(err)>1: raise ValueError(f'Transformed point QA failed for {identifier}: {np.max(err)}')
        error_info={'count':len(err),'median':float(np.median(err)),'percentile95':float(np.percentile(err,95)),'max':float(np.max(err))}
        displacement=np.linalg.norm(target-source,axis=1)
        errors.extend(err.tolist()); displacements.extend(displacement.tolist())
        chunks=np.split(target,np.cumsum(lengths)[:-1])
        filename=path.name
        dump(derived/filename,{**data,'coordinateSystem':'RAS','space':report['targetSpace'],'streamlines':[np.round(chunk,3).reshape(-1).tolist() for chunk in chunks]})
        original_center=entry.get('nativeCenter',entry['center']); original_bounds=entry.get('nativeBounds',entry['bounds'])
        entry.update({
          'nativeGeometry':original,'nativeGeometrySha256':sha(path),'nativeCenter':original_center,'nativeBounds':original_bounds,
          'geometry':'/data/anatomy/registered-nlin6/'+filename,'sha256':sha(derived/filename),
          'displaySpace':report['targetSpace'],'center':np.median(target,axis=0).round(3).tolist(),'bounds':[target.min(0).round(3).tolist(),target.max(0).round(3).tolist()],
          'displayTransform':np.eye(4).reshape(-1).tolist(),'displayTransformDescription':'Nonlinear source-to-target registration is baked into the derived geometry; native geometry and coordinates are retained separately.',
          'targetAlignment':{'target':report['targetSpace'],'verified':True,'verification':'Automated template/field QA, not individual anatomical validation','method':report['method'],'estimatedHere':True,'notAnOfficialTransform':True,'report':'/data/space/hcp1065-registration.json','fieldSha256':report['fieldSha256'],'pointRoundTripMm':error_info},
          'limitations':entry['limitations'].replace('Different MNI template versions have not been registered here.','A project-estimated 2 mm template-to-template warp is applied in the displayed derivative. This does not validate individual nerve positions, submillimetre anatomy or tract endpoints.')
        })
        results.append({'id':identifier,'geometry':entry['geometry'],'sha256':entry['sha256'],'nativeGeometry':original,'center':entry['center'],'pointRoundTripMm':error_info})
    manifest['datasets']['HCP1065']['targetAlignment']={'target':report['targetSpace'],'verified':True,'method':report['method'],'estimatedHere':True,'notAnOfficialTransform':True,'report':'/data/space/hcp1065-registration.json','fieldSha256':report['fieldSha256']}
    manifest['datasets']['HCP1065']['displaySpace']=report['targetSpace']
    manifest['datasets']['HCP1065']['limitations']='Diffusion-derived population tractography, not axons. Display is subsampled. A project-estimated 2 mm template warp has passed image/field/point roundtrip QA but is not an official transform or anatomical validation of nerve/tract endpoints.'
    dump(OUT/'manifest.json',manifest)
    validation={'sourceSpace':report['sourceSpace'],'targetSpace':report['targetSpace'],'fieldSha256':report['fieldSha256'],'structureCount':len(results),'points':len(errors),
      'roundTripMm':{'median':float(np.median(errors)),'percentile95':float(np.percentile(errors,95)),'max':float(np.max(errors))},
      'displacementMm':{'median':float(np.median(displacements)),'percentile95':float(np.percentile(displacements,95)),'max':float(np.max(displacements))},'structures':results}
    dump(OUT/'registered-point-validation.json',validation)
    print(json.dumps({key:value for key,value in validation.items() if key!='structures'},indent=2))

if __name__=='__main__': main()

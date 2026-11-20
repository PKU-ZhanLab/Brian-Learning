import assert from 'node:assert/strict';
import {migrateEvidence,emptyEvidence} from '../../src/lib/evidence-schema.js';
import {validateEvidence} from '../../src/lib/evidence-workspace.js';
import {getBuiltinEvidenceBundle} from '../../src/lib/evidence-package.js';
import {serializeProject,parseProject,validateViewState} from '../../src/lib/workspace-project.js';
import {stageProjectImport} from '../../src/lib/workspace-session.js';

export function syntheticResultEvidence({space='MNI152NLin6Asym',mixed=false}={}){
 const point=(id,xyz,frame,row)=>({id,x:xyz[0],y:xyz[1],z:xyz[2],space:frame,status:'source-checked',label:'peak',sourceTable:'1',sourceRow:row,frameNote:'synthetic frame',sourceUrl:'https://example.org/paper'});
 const coordinates=[...(mixed?[point('private-native-point',[90,10,20],'MNI-unspecified','unknown')]:[]),...[[1,2,3],[-1,2,3]].map((xyz,i)=>point(`private-point-${i}`,xyz,space,String(i+1)))];
 return migrateEvidence({schema:'brain-evidence-v1',references:[{id:'private-paper',title:'Synthetic local paper',url:'https://example.org/paper'}],results:[{id:'private-result',referenceId:'private-paper',finding:'Synthetic local result',condition:'task',sample:'n=2',roiDefinition:'table',direction:'positive',annotator:'unknown',modalities:['fmri'],regionIds:[],sourceUrl:'https://example.org/paper',curationStatus:'draft',limitations:'synthetic',coordinates,figures:[]}],relations:[]}).value;
}
export const syntheticResultLayers=()=>[true,false].map((visible,i)=>({layerId:i?'hidden-private-layer':'private-layer-name',resultId:'private-result',sourceReferenceId:'private-paper',coordinateIds:['private-point-0','private-point-1'],spaceId:'MNI152NLin6Asym',visible,style:{color:'#123456',opacity:.5,size:2}}));
export const syntheticUnknownResultEvidence=()=>syntheticResultEvidence({space:'MNI-unspecified'});
export const syntheticMixedResultEvidence=()=>syntheticResultEvidence({mixed:true});

/** Run the same evidence and transactional project admission used by normal open.
 * This helper is shared with Node tests; it performs no storage publication.
 */
export async function preflightResultLayerProject(input){
 const text=typeof input==='string'?input:await serializeProject(input),parsed=await parseProject(text),knownEvidence=getBuiltinEvidenceBundle();
 const report=validateEvidence(parsed.evidence??emptyEvidence(),{knownReferences:knownEvidence.references,knownResults:knownEvidence.results});assert.equal(report.valid,true,report.errors.join('\n'));
 const current={projectId:'fixture-preflight',revision:0,view:validateViewState({}),evidence:emptyEvidence(),notes:[],drafts:[],volumes:[],roiSnapshot:null,recomputedSnapshot:null};
 const stage=await stageProjectImport(text,{current,knownEvidence});return {text,stage};
}

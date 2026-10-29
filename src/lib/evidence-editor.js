import {normalizeDOI,validateSourceCheckIntent} from './evidence-schema.js';

/** Editor check intent is session state, separate from inherited display fields. */
export function createEvidenceEditorState(record) {
  return {draft:structuredClone(record),reviewIntent:{result:false,coordinateIds:[]},reviewDetails:{actorType:'unknown',actorName:'',date:'',scope:''}};
}

export function updateEvidenceEditorField(state,key,value,{kind='result',coordinateCheckId=null,statusOnly=false}={}) {
  let draft={...state.draft,[key]:value},reviewIntent={...state.reviewIntent,coordinateIds:[...state.reviewIntent.coordinateIds]};
  if(kind==='paper')draft={...draft,verificationStatus:'metadata-only',verified:undefined,...(key==='authors'?{fullAuthorList:undefined}:{})};
  if(kind==='result'){
    if(key==='curationStatus'){reviewIntent.result=value==='source-checked';draft.checkedAt=undefined;}
    else if(!['curationNote','annotator'].includes(key)&&!(key==='coordinates'&&statusOnly)){
      draft={...draft,curationStatus:'draft',checkedAt:undefined};reviewIntent.result=false;
    }
    if(key==='coordinates'){
      reviewIntent.coordinateIds=reviewIntent.coordinateIds.filter(id=>{
        const before=state.draft.coordinates.find(c=>c.id===id),after=value.find(c=>c.id===id);
        return after?.status==='source-checked'&&JSON.stringify(before)===JSON.stringify(after);
      });
      if(coordinateCheckId&&value.some(c=>c.id===coordinateCheckId&&c.status==='source-checked'))reviewIntent.coordinateIds=[...new Set([...reviewIntent.coordinateIds,coordinateCheckId])];
    }
  }
  return {...state,draft,reviewIntent};
}

/** This is the exact record + fresh-intent contract submitted by EvidenceEditor. */
export function prepareEvidenceEditorSubmission(kind,state,{now=new Date().toISOString()}={}) {
  const record={...structuredClone(state.draft),updatedAt:now};
  if(kind==='paper'){record.doi=normalizeDOI(record.doi);if(!record.url&&record.doi)record.url=`https://doi.org/${record.doi}`;}
  let reviewIntent=null;
  if(kind==='result'&&(state.reviewIntent.result||state.reviewIntent.coordinateIds.length)){
    reviewIntent={...state.reviewIntent,...state.reviewDetails};
    validateSourceCheckIntent(reviewIntent,record);
    if(reviewIntent.result){record.checkedAt=reviewIntent.date;record.annotator=reviewIntent.actorName;record.curationNote=reviewIntent.scope;}
  }
  return {record,reviewIntent};
}

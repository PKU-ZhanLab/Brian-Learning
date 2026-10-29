import {boundedJsonStringify} from './workspace-limits.js';

/** Canonical draft admission used by projects and the authoritative W2 envelope. */
export function validateDrafts(value=[],projectId){
  if(!Array.isArray(value)||value.length>30)throw Error('draft-count');
  const drafts=JSON.parse(boundedJsonStringify(value,1024*1024,'draft-json-budget')),ids=new Set();
  for(const d of drafts){
    if(!d||typeof d!=='object'||typeof d.id!=='string'||!d.id||ids.has(d.id)||typeof d.projectId!=='string'||!d.projectId||(projectId!==undefined&&d.projectId!==projectId)||typeof d.kind!=='string'||!d.kind.trim()||!(d.recordId===null||typeof d.recordId==='string')||!d.payload||typeof d.payload!=='object'||Array.isArray(d.payload)||typeof d.updatedAt!=='string'||!Number.isFinite(Date.parse(d.updatedAt)))throw Error('invalid-draft');
    boundedJsonStringify(d.payload,50000,'draft-payload-budget');ids.add(d.id);
  }
  return drafts;
}
const key=d=>JSON.stringify([d.projectId,d.kind,d.recordId]);
export function readDraft(projectId,kind,recordId,session){
  const base=session.getSnapshot();if(base.projectId!==projectId)return null;
  return structuredClone(base.drafts.find(d=>d.projectId===projectId&&d.kind===kind&&d.recordId===recordId)??null);
}
export function saveDraft(record,session){return session.transact(base=>{
  if(record.projectId!==base.projectId)throw Error('draft-project-mismatch');
  const drafts=validateDrafts([...base.drafts.filter(d=>d.id!==record.id&&key(d)!==key(record)),record],base.projectId);
  return {...base,drafts};
});}
/** Recovery retains content but never resurrects E2's transient review authorization. */
export function recoverDraftPayload(record){
  const defaults=record.kind==='result'?{referenceId:'',finding:'',condition:'',sample:'',modalities:[],topics:[],roiDefinition:'',direction:'',regionIds:[],sourceUrl:'',curationNote:'',annotator:'',coordinates:[],figures:[]}:record.kind==='paper'?{title:'',authors:'',journal:'',doi:'',url:''}:record.kind==='relation'?{fromResultId:'',toResultId:'',type:'complementary',rationale:'',annotator:'',sourceUrl:''}:{};
  const payload={...defaults,...structuredClone(record.payload),id:record.recordId??record.payload.id??record.id};delete payload.reviewIntent;delete payload.reviewDetails;
  if(record.kind==='result')for(const name of ['modalities','topics','regionIds','coordinates','figures'])if(!Array.isArray(payload[name]))payload[name]=[];
  if(record.kind==='result'){payload.curationStatus='draft';delete payload.checkedAt;payload.coordinates=(payload.coordinates??[]).map(c=>{const next={...c,status:'draft'};delete next.checkedAt;return next;});}
  if(record.kind==='paper'){payload.verificationStatus='metadata-only';delete payload.verified;}
  return payload;
}
/** Pending edits live above remountable editors. Failed writes retain the complete payload. */
export function createDraftManager(session,{readView}={}){
  const pending=new Map(),listeners=new Set();let generation=0,lastError=null,active=null;
  const emit=()=>{for(const fn of listeners)fn();};
  const getSnapshot=()=>{const base=session.getSnapshot(),rows=new Map(base.drafts.map(d=>[d.id,d]));for(const [id,d]of pending)if(d.projectId===base.projectId)rows.set(id,d);return {records:[...rows.values()],dirty:pending.size>0,error:lastError};};
  const flush=async()=>{
    if(active){await active;return flush();}
    if(!pending.size)return;
    const epoch=generation,batch=[...pending.values()];
    active=session.transact(base=>{
      if(epoch!==generation)throw Error('stale-draft-generation');
      if(batch.some(d=>d.projectId!==base.projectId))throw Error('draft-project-mismatch');
      let drafts=base.drafts;
      for(const d of batch)if(pending.get(d.id)===d)drafts=[...drafts.filter(old=>old.id!==d.id&&key(old)!==key(d)),d];
      return {...base,...(readView?{view:readView()}:{}),drafts:validateDrafts(drafts,base.projectId)};
    });
    try{await active;if(epoch===generation){for(const d of batch)if(pending.get(d.id)===d)pending.delete(d.id);lastError=null;}}
    catch(error){if(epoch===generation)lastError=error.message;throw error;}
    finally{active=null;emit();}
    if(pending.size)await flush();
  };
  const complete=async(id,update=base=>base)=>{
    const epoch=generation;
    await session.transact(base=>{
      if(epoch!==generation)throw Error('stale-draft-generation');
      const next=update(base);return {...next,drafts:next.drafts.filter(d=>d.id!==id)};
    });
    if(epoch===generation){pending.delete(id);lastError=null;emit();}
  };
  session.subscribe(emit);
  return {getSnapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},update(record){if(record.projectId!==session.getSnapshot().projectId)throw Error('draft-project-mismatch');pending.set(record.id,structuredClone(record));lastError=null;emit();},flush,complete,discard:id=>complete(id),reset(){generation++;pending.clear();lastError=null;emit();}};
}
/** Exports must admit current editing before capturing the canonical workspace. */
export async function captureDraftSafeWorkspace(session,manager,capture){
  const projectId=session.getSnapshot().projectId;
  await manager.flush();
  const base=session.getSnapshot();
  if(base.projectId!==projectId||manager.getSnapshot().dirty)throw Error('stale-workspace');
  const captured=capture?capture(base):base;
  if(session.getSnapshot()!==base||captured.projectId!==base.projectId||captured.revision!==base.revision)throw Error('stale-workspace');
  return {base,captured};
}

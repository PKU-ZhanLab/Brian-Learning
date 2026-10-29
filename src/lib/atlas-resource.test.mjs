import test from 'node:test';
import assert from 'node:assert/strict';
import {MAIN_MANIFEST_RESOURCE,ANATOMY_MANIFEST_RESOURCE,BA_COVERAGE_RESOURCE,getResourceState,subscribe,ensureResource,retry,atlasResourceKey} from './atlas-resource.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('three consumers share one manifest request and subscribers unsubscribe',async()=>{
  const original=globalThis.fetch;let calls=0;const wait=deferred();const seen=[];
  globalThis.fetch=async()=>{calls++;return wait.promise;};
  const unsubscribe=subscribe(MAIN_MANIFEST_RESOURCE,state=>seen.push(state.status));
  try{
    const a=ensureResource(MAIN_MANIFEST_RESOURCE),b=ensureResource(MAIN_MANIFEST_RESOURCE),c=ensureResource(MAIN_MANIFEST_RESOURCE);
    assert.strictEqual(a,b);assert.strictEqual(b,c);assert.equal(getResourceState(MAIN_MANIFEST_RESOURCE).status,'loading');
    wait.resolve({ok:true,json:async()=>({atlases:{}})});
    assert.equal((await a).status,'ready');assert.equal(calls,1);assert.deepEqual(seen,['loading','ready']);
    unsubscribe();await ensureResource(MAIN_MANIFEST_RESOURCE);assert.equal(seen.length,2);
  }finally{unsubscribe();globalThis.fetch=original;}
});
test('503 stays observable until retry and failed pending requests are released',async()=>{
  const original=globalThis.fetch;let calls=0;const recovery=deferred();
  globalThis.fetch=async()=>{calls++;return calls===1?{ok:false,status:503}:recovery.promise;};
  try{
    assert.equal((await ensureResource(ANATOMY_MANIFEST_RESOURCE)).status,'error');
    assert.match(getResourceState(ANATOMY_MANIFEST_RESOURCE).error,/503/);
    const pending=retry(ANATOMY_MANIFEST_RESOURCE);
    assert.equal(getResourceState(ANATOMY_MANIFEST_RESOURCE).status,'loading');
    assert.match(getResourceState(ANATOMY_MANIFEST_RESOURCE).error,/503/);
    recovery.resolve({ok:true,json:async()=>({structures:{}})});
    const next=await pending;
    assert.equal(next.status,'ready');assert.equal(next.generation,1);assert.equal(calls,2);
  }finally{globalThis.fetch=original;}
});
test('retry generation wins even when an earlier request ignores cancellation',async()=>{
  const original=globalThis.fetch;const old=deferred(),fresh=deferred();let calls=0;
  globalThis.fetch=async()=>++calls===1?old.promise:fresh.promise;
  try{
    const a=ensureResource(BA_COVERAGE_RESOURCE),b=retry(BA_COVERAGE_RESOURCE);
    fresh.resolve({ok:true,json:async()=>({coverage:['new']})});await b;
    old.resolve({ok:true,json:async()=>({coverage:['old']})});await a;
    assert.deepEqual(getResourceState(BA_COVERAGE_RESOURCE).value,{coverage:['new']});
    assert.equal(getResourceState(BA_COVERAGE_RESOURCE).generation,1);
  }finally{globalThis.fetch=original;}
});
test('atlas resources separate every asset identity component',()=>{
  const identity={id:'aal',version:'v1',sha256:'a'.repeat(64),spaceId:'native'};
  const key=atlasResourceKey(identity);
  for(const change of [{id:'aal3'},{version:'v2'},{sha256:'b'.repeat(64)},{spaceId:'target'}])assert.notEqual(atlasResourceKey({...identity,...change}),key);
});
test('a subscriber joining during loading shares the same in-flight request',async()=>{
  const original=globalThis.fetch;let calls=0,nested,joined=false;
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({coverage:[]})};};
  const off=subscribe(BA_COVERAGE_RESOURCE,state=>{if(state.status==='loading'&&!joined){joined=true;nested=ensureResource(BA_COVERAGE_RESOURCE);}});
  try{const pending=retry(BA_COVERAGE_RESOURCE);await pending;assert.strictEqual(nested,pending);assert.equal(calls,1);}
  finally{off();globalThis.fetch=original;}
});

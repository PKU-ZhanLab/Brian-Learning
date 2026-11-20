import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVolumeMetadata, validateLabelRows, assertWorkspaceBudget, boundedJsonStringify } from './workspace-limits.js';

const MiB=1024*1024;
const smallUsage={assetCount:1,rawPayloadBytes:353,compressedAssetBytes:[40],projectUtf8Bytes:100};
test('shared metadata boundaries',()=>{
  const input={name:'n'.repeat(500),space:'s'.repeat(160),source:'s'.repeat(4096),provenance:'p'.repeat(20000),license:'l'.repeat(10000),note:'n'.repeat(20000),limitations:Array(100).fill('l'.repeat(4000)),labels:[{id:1,name:'x'.repeat(2000),zh:'中'.repeat(2000)}]};
  const copy=structuredClone(input);assert.deepEqual(validateVolumeMetadata(input).labels,input.labels);assert.deepEqual(input,copy);
  for(const [field,max] of [['name',500],['space',160],['source',4096],['provenance',20000],['license',10000],['note',20000]])assert.throws(()=>validateVolumeMetadata({...input,[field]:'x'.repeat(max+1)}),new RegExp(`${field}-too-long`));
  assert.doesNotThrow(()=>validateLabelRows([{id:1,name:'x'.repeat(2000)}]));
  assert.throws(()=>validateLabelRows([{id:1,name:'x'.repeat(2001)}]),/label-name-too-long/);
  assert.throws(()=>validateLabelRows([{id:1,name:'x',zh:'中'.repeat(2001)}]),/label-zh-too-long/);
  assert.doesNotThrow(()=>validateLabelRows(Array.from({length:50000},(_,i)=>({id:i+1,name:'x'}))));
  assert.throws(()=>validateLabelRows(Array.from({length:50001},(_,i)=>({id:i+1,name:'x'}))),/label-count/);
  assert.throws(()=>validateLabelRows(Array.from({length:2200},(_,i)=>({id:i+1,name:'中'.repeat(2000)}))),/label-json-budget/);
  assert.throws(()=>validateVolumeMetadata({...input,limitations:Array(101).fill('x')}),/limitations/);
  assert.throws(()=>validateVolumeMetadata({...input,limitations:['x'.repeat(4001)]}),/limitations/);
});
test('workspace capacity uses exact inclusive safe-integer boundaries without allocating payloads',()=>{
  const boundary={assetCount:50,rawPayloadBytes:256*MiB,compressedAssetBytes:[128*MiB],projectUtf8Bytes:180*MiB};
  assert.doesNotThrow(()=>assertWorkspaceBudget(boundary));
  for(const [key,value,code] of [['assetCount',51,'asset-count'],['rawPayloadBytes',256*MiB+1,'decoded-budget'],['compressedAssetBytes',[128*MiB+1],'compressed-asset-budget'],['projectUtf8Bytes',180*MiB+1,'project-json-budget']])assert.throws(()=>assertWorkspaceBudget({...boundary,[key]:value}),new RegExp(code));
  for(const invalid of [-1,NaN,Infinity,1.1,Number.MAX_SAFE_INTEGER+1])for(const key of ['assetCount','rawPayloadBytes','projectUtf8Bytes'])assert.throws(()=>assertWorkspaceBudget({...smallUsage,[key]:invalid}));
  assert.throws(()=>assertWorkspaceBudget({...smallUsage,compressedAssetBytes:[NaN]}));
});

test('normalized label JSON admits exactly four MiB and rejects the next byte',()=>{
  const rows=[];let bytes=2;
  while(bytes<4*MiB){
    const id=rows.length+1,overhead=JSON.stringify({id,name:''}).length+(rows.length?1:0);
    const length=Math.min(2000,4*MiB-bytes-overhead);
    assert.ok(length>0);rows.push({id,name:'x'.repeat(length)});bytes+=overhead+length;
  }
  assert.equal(new TextEncoder().encode(JSON.stringify(rows)).byteLength,4*MiB);
  assert.doesNotThrow(()=>validateLabelRows(rows));
  rows.at(-1).name+='x';assert.throws(()=>validateLabelRows(rows),/label-json-budget/);
});

test('bounded JSON counts exact escaped UTF-8 and preserves JSON normalization',()=>{
  const input={text:'中😀\n"\\\u0001\ud800',values:[undefined,NaN,Infinity,false,null],omit:undefined,date:new Date('2026-10-29T00:00:00Z')};
  const expected=JSON.stringify(input),bytes=new TextEncoder().encode(expected).byteLength;
  assert.equal(boundedJsonStringify(input,bytes),expected);
  assert.throws(()=>boundedJsonStringify(input,bytes-1),/json-budget/);
  const nested={items:Array(30).fill('中😀\n')};const copy=structuredClone(nested);
  assert.throws(()=>boundedJsonStringify(nested,40),/json-budget/);assert.deepEqual(nested,copy);
  let toJsonCalls=0;assert.equal(boundedJsonStringify({item:{toJSON(){toJsonCalls++;return '中';}}},30),'{"item":"中"}');assert.equal(toJsonCalls,1);
  const cycle={};cycle.self=cycle;assert.throws(()=>boundedJsonStringify(cycle,1000),/circular/i);
});

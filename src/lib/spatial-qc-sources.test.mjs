import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {prepareSpatialQCSources,assertSpatialQCSourcePackageInputs} from '../../scripts/prepare-spatial-qc-sources.mjs';
import {sourceInputPaths} from '../../scripts/public-package.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const commit='6857dfa732de6dd60c94da2f84d0b15ccf316618';
const bytes=Buffer.from('inert source fixture');
const fixture=()=>({schemaVersion:1,repository:'DiedrichsenLab/cerebellar_atlases',commit,cacheRoot:'data-cache/spatial-qc/fixture',files:[{path:'README.md',url:`https://raw.githubusercontent.com/DiedrichsenLab/cerebellar_atlases/${commit}/README.md`,bytes:bytes.length,sha256:sha(bytes)}]});
const isolated=async callback=>{const root=await mkdtemp(path.join(os.tmpdir(),'neuroatlas-qc-cache-'));try{await callback(root);}finally{assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(root).startsWith('neuroatlas-qc-cache-'));await rm(root,{recursive:true,force:true});}};

test('explicit source preparation fetches exact bytes once and safely reuses verified cache',()=>isolated(async root=>{
 const manifest=fixture();let calls=0;
 const fetchImpl=async(url,options)=>{calls++;assert.equal(url,manifest.files[0].url);assert.equal(options.redirect,'error');return new Response(bytes);};
 const result=await prepareSpatialQCSources({root,manifest,fetchImpl});assert.equal(result.downloaded,1);
 assert.deepEqual(await readFile(path.join(root,manifest.cacheRoot,'README.md')),bytes);
 assert.equal((await prepareSpatialQCSources({root,manifest,fetchImpl})).downloaded,0);assert.equal(calls,1);
}));
test('check-only never downloads or creates cache; missing cache gives explicit preparation command',()=>isolated(async root=>{
 let calls=0;await assert.rejects(prepareSpatialQCSources({root,manifest:fixture(),checkOnly:true,fetchImpl:async()=>{calls++;}}),/node scripts\/prepare-spatial-qc-sources\.mjs/);assert.equal(calls,0);
}));
test('decoded source bytes use locked length even when HTTP reports compressed transfer length',()=>isolated(async root=>{
 const result=await prepareSpatialQCSources({root,manifest:fixture(),fetchImpl:async()=>new Response(bytes,{headers:{'content-length':'1','content-encoding':'gzip'}})});assert.equal(result.downloaded,1);
}));
test('mismatched existing cache is preserved, and mismatched download is never stored',()=>isolated(async root=>{
 const manifest=fixture(),destination=path.join(root,manifest.cacheRoot,'README.md');await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,'existing evidence');
 let calls=0;await assert.rejects(prepareSpatialQCSources({root,manifest,fetchImpl:async()=>{calls++;return new Response(bytes);}}),/preserved|mismatch/);assert.equal(calls,0);assert.equal(await readFile(destination,'utf8'),'existing evidence');
 await rm(destination);await assert.rejects(prepareSpatialQCSources({root,manifest,fetchImpl:async()=>new Response('wrong bytes')}),/mismatch|length/);await assert.rejects(readFile(destination),{code:'ENOENT'});
}));
test('preparation refuses unpinned URLs, redirects and cache paths outside data-cache',()=>isolated(async root=>{
 for(const changes of [{cacheRoot:'public/data/candidate'},{files:[{...fixture().files[0],path:'../escape'}]},{files:[{...fixture().files[0],url:'https://example.org/candidate'}]}])await assert.rejects(prepareSpatialQCSources({root,manifest:{...fixture(),...changes},fetchImpl:async()=>{throw Error('must not fetch');}}),/cache|path|URL|pinned/);
 await assert.rejects(prepareSpatialQCSources({root,manifest:fixture(),fetchImpl:async()=>({ok:true,status:200,redirected:true})}),/redirect/);
}));
test('the source-package whitelist closes over every nonbinary QC input and explicit cache lock',async()=>{
 const root=new URL('../../',import.meta.url),registry=JSON.parse(await readFile(new URL('data-sources/spatial-qc/reference-set.json',root))),preparation=JSON.parse(await readFile(new URL('data-sources/spatial-qc/source-preparation.json',root)));
 const allowed=sourceInputPaths();assert.doesNotThrow(()=>assertSpatialQCSourcePackageInputs({registry,preparation,allowedSourceFiles:allowed}));
 for(const file of ['reference-set.json','source-preparation.json','candidate-inspection.json','download-manifest.json']){
  assert(allowed.has('data-sources/spatial-qc/'+file));const incomplete=new Set(allowed);incomplete.delete('data-sources/spatial-qc/'+file);assert.throws(()=>assertSpatialQCSourcePackageInputs({registry,preparation,allowedSourceFiles:incomplete}),/omits|missing/);
 }
 assert(![...allowed].some(file=>file.startsWith('data-cache/')||file.startsWith('output/')));
 assert.throws(()=>assertSpatialQCSourcePackageInputs({registry:{...registry,lockedInputs:[...registry.lockedInputs,{id:'lost',path:'output/ignored.json'}]},preparation,allowedSourceFiles:allowed}),/ignored|unpackaged/);
});

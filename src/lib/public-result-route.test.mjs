import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import registry from '../../data-sources/results/publication-registry.json' with {type:'json'};
import {parsePublicResultRoute,resolvePublicResultRoute,publicResultHref} from './public-result-route.js';
import {buildResultPages,escapeHTML} from '../../scripts/build-result-pages.mjs';

test('every registered result/version resolves exactly, including old fixed content',()=>{
  for(const version of registry.versions)for(const record of version.records){
    const route=resolvePublicResultRoute(`?result=${record.resultId}&version=${version.dataVersion}&lang=en&notes=PRIVATE#fragment`);
    assert.equal(route.kind,'result');assert.equal(route.record.contentHash,record.contentHash);
    assert.equal(route.language,'en');
    assert.equal(route.href,`?result=${record.resultId}&version=${version.dataVersion}&lang=en`);
  }
  assert.equal(parsePublicResultRoute('?mode=research&version='),null);
});

test('only an omitted version redirects; empty, unknown, malformed and duplicates are unavailable',()=>{
  const result='axelrod2015-rffa';
  assert.deepEqual(parsePublicResultRoute(`?result=${result}`),{resultId:result,dataVersion:null});
  const route=resolvePublicResultRoute(`?result=${result}&private=secret`);
  assert.equal(route.kind,'redirect');assert.equal(route.href,`?result=${result}&version=${registry.latest[result]}`);
  for(const query of [
    `?result=${result}&version=`, `?result=${result}&version=2099-01-01.1`,
    `?result=${result}&version=2026-10-30.1&version=2026-10-29.2`,
    `?result=${result}&result=${result}`, '?result=', '?result=private-note',
    '?result=__proto__','?result=toString', '?result=%E0%A4%A',
    `?result=${result}&version=%00`, `?result=${result}&lang=en&lang=zh`,
    `?result=${result}&lang=xx`, `?result=${'a'.repeat(4100)}`,
    '?result=local%20image.nii.gz', '?result=%3Cscript%3Eprivate%3C%2Fscript%3E',
  ])assert.equal(resolvePublicResultRoute(query).kind,'unavailable',query);
  assert.equal(resolvePublicResultRoute('?result=private-note&lang=en').language,'en');
});

test('canonical application addresses retain the Pages base and only allowlisted identity/language',()=>{
  assert.equal(publicResultHref('axelrod2015-rffa','2026-10-29.2',{base:'/Brian-Learning/',language:'en'}),'/Brian-Learning/?result=axelrod2015-rffa&version=2026-10-29.2&lang=en');
  assert.throws(()=>publicResultHref('private','2026-10-30.1'));
  assert.throws(()=>publicResultHref('axelrod2015-rffa','',{base:'/Brian-Learning/'}));
});

test('oversized input is bounded before URL parameter decoding while workspace-only links remain workspace',()=>{
  const NativeParams=globalThis.URLSearchParams;let oversizedDecodes=0;
  globalThis.URLSearchParams=class extends NativeParams{constructor(value){if(typeof value==='string'&&value.length>4096)oversizedDecodes++;super(value);}};
  try{
    assert.throws(()=>parsePublicResultRoute('?result=axelrod2015-rffa&extra='+'x'.repeat(5000)));
    assert.throws(()=>parsePublicResultRoute('?extra='+'x'.repeat(5000)+'&%72esult=axelrod2015-rffa'));
    assert.equal(parsePublicResultRoute('?view='+'x'.repeat(5000)),null);
    assert.equal(oversizedDecodes,0);
  }finally{globalThis.URLSearchParams=NativeParams;}
});

test('static build is deterministic, escaped, script-free, versioned and independently hash verifiable',async()=>{
  assert.equal(escapeHTML('<img src=x onerror="x">&\''),'&lt;img src=x onerror=&quot;x&quot;&gt;&amp;&#39;');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuroatlas-result-pages-'));
  try{
    const manifest=await buildResultPages({outDir:dir,base:'/Brian-Learning/'});
    assert.equal(manifest.records.length,16);
    for(const item of manifest.records){
      assert.match(item.file,/^results\/[a-z0-9-]+\/2026-10-(29\.2|30\.1)\/index(?:\.en)?\.html$/);
      const html=await fs.readFile(path.join(dir,item.file),'utf8');
      assert.equal(crypto.createHash('sha256').update(html).digest('hex'),item.sha256);
      assert.match(html,/<html lang="(?:en|zh-CN)">/);assert.match(html,/<main>/);
      assert.match(html,/<h1>/);assert.match(html,/<cite>/);assert.match(html,/<nav aria-label=/);
      assert.ok(html.includes(item.contentHash));assert.ok(html.includes(item.snapshotSha256));
      assert.ok(html.includes(`rel="canonical" href="/Brian-Learning/${item.file}"`));
      assert.match(html,/MNI-unspecified|空间|space/);
      assert.doesNotMatch(html,/<script|<iframe|<img|fonts\.google|file:|F:\\|PRIVATE/i);
      assert.ok(html.includes(`version=${item.dataVersion}`));
      for(const [,encoded] of html.matchAll(/href="([^"]+)"/g)){
        const href=encoded.replaceAll('&amp;','&'),url=new URL(href,`https://example.invalid/Brian-Learning/${item.file}`);
        if(url.origin!=='https://example.invalid')continue;
        assert.ok(url.pathname.startsWith('/Brian-Learning/'));
        if(url.pathname==='/Brian-Learning/')continue;
        const relative=url.pathname.slice('/Brian-Learning/'.length);
        assert.ok(await fs.stat(path.join(dir,relative.endsWith('/')?relative+'index.html':relative)),relative);
      }
    }
    assert.ok((await fs.readFile(path.join(dir,'results/index.html'),'utf8')).includes('2026-10-29.2'));
    const bytes=await fs.readFile(path.join(dir,'results/manifest.json'),'utf8');
    await buildResultPages({outDir:dir,base:'/Brian-Learning/'});
    assert.equal(await fs.readFile(path.join(dir,'results/manifest.json'),'utf8'),bytes);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('English result pages retain the English directory on both entry routes',async()=>{
 const {renderResultPage}=await import('../../scripts/build-result-pages.mjs');
 const html=renderResultPage({resultId:'axelrod2015-rffa',dataVersion:'2026-10-30.1',language:'en'});
 assert.match(html,/href="\/Brian-Learning\/results\/index.en.html">All public results/);
 const {publicResultDirectoryHref}=await import('./public-result-route.js');
 assert.equal(publicResultDirectoryHref({base:'/Brian-Learning/',language:'en'}),'/Brian-Learning/results/index.en.html');
 assert.equal(publicResultDirectoryHref({base:'/Brian-Learning/',language:'zh'}),'/Brian-Learning/results/');
});

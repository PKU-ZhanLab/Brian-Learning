// Authored for isolated permitted CI; --list only during X11 implementation.
import {test,expect} from '@playwright/test';
import registry from '../../data-sources/results/publication-registry.json' with {type:'json'};
const id='axelrod2015-rffa',old='2026-10-29.2',latest=registry.latest[id];
const base=process.env.PUBLIC_RESULT_E2E_BASE||'/Brian-Learning/';
const resultURL=(version,language='en')=>`${base}?result=${id}${version===undefined?'':`&version=${version}`}&lang=${language}`;
async function guardPrivateStorage(page){
  await page.addInitScript(()=>{
    window.__publicStorageCalls=[];
    for(const method of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[method]=function(){window.__publicStorageCalls.push(method);throw Error('Public route touched private storage');};
    Object.defineProperty(Storage.prototype,'length',{get(){window.__publicStorageCalls.push('length');throw Error('Public route inspected private storage');},configurable:true});
    indexedDB.open=()=>{window.__publicStorageCalls.push('indexedDB.open');throw Error('Public route opened private database');};
  });
}
test('fixed direct-open/refresh preserves old identity, language and base without private startup',async({page})=>{
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await guardPrivateStorage(page);
  await page.goto(resultURL(old)+'&notes=private-text#local-image');
  await expect(page.locator('[data-public-result-state]')).toHaveAttribute('data-public-result-state','result');
  await expect(page).toHaveURL(new RegExp(`/Brian-Learning/\\?result=${id}&version=${old}&lang=en$`));
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  const identity=registry.versions.find(row=>row.dataVersion===old).records.find(row=>row.resultId===id).contentHash;
  await page.getByText('Fixed content hash and review scope',{exact:true}).click();
  await expect(page.locator('.result-record-hash')).toContainText(identity);
  await page.reload();
  await expect(page.locator('.result-record-hash')).toContainText(identity);
  await page.setViewportSize({width:390,height:650});
  await page.getByText('Fixed content hash and review scope',{exact:true}).click();
  await page.locator('.result-record-hash').scrollIntoViewIfNeeded();
  await expect(page.locator('.result-record-hash')).toBeInViewport();
  expect(await page.evaluate(()=>document.scrollingElement.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__publicStorageCalls)).toEqual([]);
  expect(errors).toEqual([]);expect(requests.some(url=>/\/src\/App\.jsx|\/assets\/App-/.test(url))).toBe(false);
  await expect(page.getByRole('link',{name:'Return to workspace',exact:true})).toHaveAttribute('href',base);
  await page.getByRole('link',{name:'中文',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  await expect(page).toHaveURL(new RegExp(`version=${old}$`));
  expect(await page.evaluate(()=>window.__publicStorageCalls)).toEqual([]);
});
test('versionless opens latest only after replacing with its explicit fixed address',async({page})=>{
  await guardPrivateStorage(page);await page.goto(resultURL(undefined));
  await expect(page).toHaveURL(new RegExp(`version=${latest}&lang=en$`));
  await expect(page.locator('[data-public-result-state]')).toHaveAttribute('data-public-result-state','result');
  expect(await page.evaluate(()=>window.__publicStorageCalls)).toEqual([]);
});
test('failed workspace bootstrap offers reload and retains saved storage',async({page})=>{
  await page.route(/\/assets\/App-[^/]+\.js(?:\?|$)/,route=>route.abort(),{times:1});
  await page.addInitScript(()=>{if(!localStorage.getItem('x11-startup-sentinel'))localStorage.setItem('x11-startup-sentinel','retained');});
  await page.goto(`${base}?lang=en`);
  await expect(page.getByRole('alert')).toContainText('Workspace could not load');
  expect(await page.evaluate(()=>localStorage.getItem('x11-startup-sentinel'))).toBe('retained');
  await page.getByRole('button',{name:'重新载入 / Reload',exact:true}).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('x11-startup-sentinel'))).toBe('retained');
});
for(const suffix of [
  `result=${id}&version=`, `result=${id}&version=unknown`,
  `result=${id}&version=${old}&version=${latest}`,
  `result=${id}&result=${id}`, 'result=private-note', 'result=',
  'result=local-image.nii.gz', 'result=%3Cscript%3Esecret%3C%2Fscript%3E',
])test(`unavailable public input remains outside workspace: ${suffix}`,async({page})=>{
  await guardPrivateStorage(page);await page.goto(`${base}?${suffix}&lang=en`);
  await expect(page.locator('[data-public-result-state]')).toHaveAttribute('data-public-result-state','unavailable');
  await expect(page.getByRole('heading',{name:'Result unavailable'})).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__publicStorageCalls)).toEqual([]);
});
test('static fixed page works without JavaScript, refreshes and navigates exact versions/languages',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try{
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:4179${base}results/${id}/${old}/index.en.html`);
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
    await expect(page.locator('cite')).toContainText('Successful Decoding of Famous Faces in the Fusiform Face Area');
    await expect(page.locator('main')).toContainText('MNI-unspecified');
    await expect(page.locator('main')).toContainText('Human review is pending');
    await expect(page.locator('script')).toHaveCount(0);
    await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.getByRole('link',{name:'中文',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
    await expect(page).toHaveURL(new RegExp(`/results/${id}/${old}/index.html$`));
    await page.getByRole('navigation',{name:'固定版本',exact:true}).getByRole('link',{name:latest,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`/results/${id}/${latest}/index.html$`));
  }finally{await context.close();}
});
test('returning from a public page preserves the existing saved workspace bytes',async({page})=>{
  // Make a real saved note in this isolated browser, then leave and return.
  const key='neuroatlas-workspace-current-v1',note='X11 isolated private note';
  await page.goto(`${base}?lang=en`);
  await page.getByRole('button',{name:'Research notes',exact:true}).click();
  await page.locator('#note-draft').fill(note);
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toContain(note);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  const before=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.goto(resultURL(old));
  await expect(page.locator('[data-public-result-state]')).toHaveAttribute('data-public-result-state','result');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
  await page.getByRole('link',{name:'Return to workspace',exact:true}).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  const after=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),original=JSON.parse(before);
  expect(after.projectId).toBe(original.projectId);expect(after.notes).toEqual(original.notes);
  expect(after.evidence).toEqual(original.evidence);expect(after.drafts).toEqual(original.drafts);
});

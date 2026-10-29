import {test,expect} from '@playwright/test';

test('initial manifest 503 retries within the same session and preserves research content',async({page})=>{
  let attempts=0;
  await page.route('**/data/manifest.json',route=>++attempts===1?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto('/?lang=en');
  await expect(page.getByRole('alert').filter({hasText:'manifest:main'})).toBeVisible();
  await page.getByRole('button',{name:'Add a note for this structure',exact:true}).click();
  await page.locator('#note-draft').fill('Retain annotation through manifest retry');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')));
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Retry data loading',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'manifest:main'})).toHaveCount(0);
  await expect(page.locator('.brain-scene canvas').first()).toBeVisible();
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','ready');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')).notes)).toEqual(before.notes);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')).evidence)).toEqual(before.evidence);
  expect(attempts).toBe(2);
});

test('AAL to DK to BA delayed volume completions never publish a stale source',async({page})=>{
  let releaseA,releaseB;
  const a=new Promise(resolve=>{releaseA=resolve;}),b=new Promise(resolve=>{releaseB=resolve;});
  await page.route('**/data/aal-v3/*bin',async route=>{await a;await route.continue();});
  await page.route('**/data/dk-v2/*bin',async route=>{await b;await route.continue();});
  await page.goto('/?lang=en');
  const source=page.getByLabel('Choose an atlas',{exact:true});
  await expect(source.locator('option[value="aal-registered"]')).toHaveCount(1);
  await source.selectOption('aal-registered');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','loading');
  await source.selectOption('dk');
  await source.selectOption('ba');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-atlas','ba');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','ready');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-source','public/data/ba-v2/talairach-ba.bin');
  const final=await page.locator('.voxel-info').innerText();
  const pendingResponses=Promise.all([page.waitForResponse(response=>response.url().includes('/data/aal-v3/')&&response.url().endsWith('.bin')),page.waitForResponse(response=>response.url().includes('/data/dk-v2/')&&response.url().endsWith('.bin'))]);
  releaseA();releaseB();await pendingResponses;
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-atlas','ba');
  await expect(page.locator('.voxel-info')).toHaveText(final);
});

test('moving a slice invalidates a cortical hit',async({page})=>{
  await page.goto('/?lang=en');
  await page.getByLabel('Choose an atlas',{exact:true}).selectOption('aal-registered');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','ready');
  const canvas=page.locator('.brain-scene canvas').first();
  const box=await canvas.boundingBox();
  for(const [x,y] of [[.4,.4],[.5,.35],[.6,.4],[.4,.5],[.6,.5]]){
    await canvas.click({position:{x:box.width*x,y:box.height*y}});
    if(await page.locator('.voxel-info').getAttribute('data-query-method')==='cortical-ribbon')break;
  }
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-method','cortical-ribbon');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-source','public/data/aal-v3/aal-fsl1mm.bin');
  const slider=page.getByLabel('Axial slice position',{exact:true});
  if(!await slider.isVisible())await page.locator('.coordinates-bar button').click();
  await slider.fill('80');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-method','voxel');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate',/80\]$/);
  await expect(page.locator('.voxel-info')).not.toContainText('Selected cortical ribbon label');
  const axial=page.locator('.slice-card').filter({hasText:'Axial'}).locator('canvas');const rect=await axial.boundingBox();
  await axial.click({position:{x:rect.width*.333,y:rect.height*.423}});
  await expect.poll(async()=>JSON.parse(await page.locator('.voxel-info').getAttribute('data-query-coordinate')).some(value=>!Number.isInteger(value))).toBe(true);
});

test('clicks during a new atlas load cannot query the previous volume',async({page})=>{
  let release;const wait=new Promise(resolve=>{release=resolve;});
  await page.route('**/data/aal-v3/*bin',async route=>{await wait;await route.continue();});
  await page.goto('/?lang=en');
  const query=page.locator('.voxel-info');await expect(query).toHaveAttribute('data-query-status','ready');
  await expect(query).toHaveAttribute('data-query-source','public/data/dk-v2/dk68.bin');
  await page.getByLabel('Choose an atlas',{exact:true}).selectOption('aal-registered');
  await expect(query).toHaveAttribute('data-query-status','loading');
  const canvas=page.locator('.brain-scene canvas').first(),box=await canvas.boundingBox();
  await canvas.click({position:{x:box.width*.45,y:box.height*.45}});
  await expect(query).toHaveAttribute('data-query-source','');await expect(query).toHaveAttribute('data-query-label','');
  await expect(page.getByRole('region',{name:'Atlas region details'})).toHaveCount(0);
  release();await expect(query).toHaveAttribute('data-query-status','ready');
  await expect(query).toHaveAttribute('data-query-source','public/data/aal-v3/aal-fsl1mm.bin');
});

test('opening an unmapped paper preserves the independent current-coordinate atlas query',async({page})=>{
  await page.goto('/?lang=en');
  await page.getByLabel('Choose an atlas',{exact:true}).selectOption('aal-registered');
  const query=page.locator('.voxel-info');await expect(query).toHaveAttribute('data-query-status','ready');
  const canvas=page.locator('.brain-scene canvas').first(),box=await canvas.boundingBox();
  for(const [x,y] of [[.4,.4],[.5,.35],[.6,.4],[.4,.5],[.6,.5]]){
    await canvas.click({position:{x:box.width*x,y:box.height*y}});
    if(await query.getAttribute('data-query-method')==='cortical-ribbon'&&await query.getAttribute('data-query-label'))break;
  }
  await expect(query).toHaveAttribute('data-query-method','cortical-ribbon');
  await expect(query).toHaveAttribute('data-query-label',/^\d+$/);
  const attrs=['status','atlas','version','source','label','method','coordinate'];
  const before=await Promise.all(attrs.map(name=>query.getAttribute(`data-query-${name}`)));
  const text=await query.innerText();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Evidence library',exact:true}).click();
  await page.getByLabel('Search papers, authors or regions',{exact:true}).fill('Schaum');
  await page.locator('.paper-card').filter({hasText:'Schaum'}).locator('.paper-open').click();
  await expect(query).toHaveAttribute('data-query-status','ready');
  expect(await Promise.all(attrs.map(name=>query.getAttribute(`data-query-${name}`)))).toEqual(before);
  await expect(query).toHaveText(text);
  await page.getByRole('button',{name:'Close evidence library',exact:true}).click();
  await expect(query).toHaveAttribute('data-query-status','ready');
  expect(await Promise.all(attrs.map(name=>query.getAttribute(`data-query-${name}`)))).toEqual(before);
  await expect(page.getByRole('region',{name:'Atlas region details'})).toHaveCount(0);
  await expect(page.locator('.structure-row.selected')).toHaveCount(0);
});

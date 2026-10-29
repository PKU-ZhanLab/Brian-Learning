// Authored for an isolated permitted CI runner. Desktop verification belongs to root CUA.
import {test,expect} from '@playwright/test';

const navigator=page=>page.getByRole('group',{name:'Main coordinate navigation',exact:true});
async function navigate(page,text,{space,convention}={}) {
  if(await page.locator('.coordinate-navigation-disclosure').getAttribute('open')===null)await page.getByRole('navigation',{name:'Research tasks',exact:true}).getByRole('button',{name:'Enter coordinates',exact:true}).click();
  const nav=navigator(page);
  if(space!==undefined)await nav.getByLabel('Reference space',{exact:true}).fill(space);
  if(convention)await nav.getByLabel('Input convention',{exact:true}).selectOption(convention);
  await nav.getByLabel('Coordinates (mm)',{exact:true}).fill(text);
  await nav.getByRole('button',{name:'Go to coordinate',exact:true}).click();
}
test.beforeEach(async({page})=>{await page.goto('/?lang=en');});

test('decimal navigation links exact query, readout and all three slice positions across main atlases',async({page})=>{
  await navigate(page,'-38.25, -20.5, 54.1');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[-38.25,-20.5,54.1]');
  await expect(navigator(page).locator('output.coordinate-current')).toContainText('-38.25, -20.5, 54.1');
  if(!await page.locator('.slice-views').isVisible())await page.locator('.coordinates-bar button').click();
  for(const text of ['X = -38.25 mm','Y = -20.5 mm','Z = 54.1 mm'])await expect(page.locator('.slice-card-header').filter({hasText:text})).toHaveCount(1);
  for(const atlas of ['dk','aal-registered','aal3-registered']){
    await page.getByLabel('Choose an atlas',{exact:true}).selectOption(atlas);
    await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','ready');
    await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-atlas',atlas);
    await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[-38.25,-20.5,54.1]');
  }
});
test('LPS and batch paste convert explicitly and visit points without truncation',async({page})=>{
  await navigate(page,'[10,20,30]',{convention:'LPS'});
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[-10,-20,30]');
  await navigate(page,'1.25,2.5,3.75\n10,20,30',{convention:'RAS'});
  await navigator(page).getByLabel('Batch point',{exact:true}).selectOption('1');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[10,20,30]');
});
test('missing space and invalid/oversized batch inputs keep the current coordinate and show field errors',async({page})=>{
  const before=await page.locator('.voxel-info').getAttribute('data-query-coordinate');
  await navigate(page,'1,2,3',{space:''});await expect(navigator(page).getByRole('alert')).toContainText('reference space');
  await navigate(page,'1,NaN,3',{space:'MNI152NLin6Asym'});await expect(navigator(page).getByRole('alert')).toContainText('finite');
  await navigate(page,Array(1001).fill('1,2,3').join('\n'));await expect(navigator(page).getByRole('alert')).toContainText('1,000');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate',before);
});
test('outside-template input stays exact, axis stepping does not clip, and center is explicit',async({page})=>{
  await navigate(page,'1000.25, -20.5, 54.1');
  await expect(navigator(page)).toContainText('Outside the displayed template bounds');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[1000.25,-20.5,54.1]');
  await navigator(page).getByLabel('Step (mm)',{exact:true}).fill('0.1');
  await navigator(page).getByRole('button',{name:'Increase X',exact:true}).click();
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[1000.35,-20.5,54.1]');
  await navigator(page).getByRole('button',{name:'Return to center',exact:true}).click();
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[0,0,0]');
});
test('unknown and unregistered references enter independent context and remain independent after reload',async({page})=>{
  await navigate(page,'10.25,20.5,30.75',{space:'MNI unspecified'});
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','idle');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-source','');
  await expect(navigator(page).locator('output.coordinate-current')).toContainText('MNI unspecified');
  // Save and restore through the existing named-view flow before testing reload.
  await page.getByRole('button',{name:'Projects & views',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Save and share',exact:true});
  await dialog.getByLabel('View name',{exact:true}).fill('Independent coordinates');
  await dialog.getByRole('button',{name:'Save view',exact:true}).click();
  await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
  await navigate(page,'0,0,0',{space:'MNI152NLin6Asym'});
  await page.getByRole('button',{name:'Projects & views',exact:true}).click();
  await dialog.getByRole('button',{name:/Independent coordinates/}).click();
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[10.25,20.5,30.75]');
  await page.reload();
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate','[10.25,20.5,30.75]');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','idle');
});
test('a typed internal context name cannot authorize main-template lookup',async({page})=>{
  await navigate(page,'10.25,20.5,30.75',{space:'brain'});
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','idle');
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-source','');
  await expect(navigator(page).locator('output.coordinate-current')).toContainText('brain · RAS');
});
test('native slices share precise input while keeping their source reference and main position separate',async({page})=>{
  const before=await page.locator('.voxel-info').getAttribute('data-query-coordinate');
  await page.getByLabel('Choose an atlas',{exact:true}).selectOption('aal-registered');
  await page.getByRole('button',{name:'Original T1 slices',exact:true}).click();
  const native=page.getByRole('group',{name:'Native coordinate navigation',exact:true});
  await expect(native.getByLabel('Reference space',{exact:true})).toHaveValue('Colin27 / MNI single-subject');
  await expect(native.getByLabel('Reference space',{exact:true})).toHaveAttribute('readonly','');
  await native.getByLabel('Coordinates (mm)',{exact:true}).fill('-38.25, -20.5, 54.1');
  await native.getByRole('button',{name:'Go to coordinate',exact:true}).click();
  await expect(native.locator('output.coordinate-current')).toContainText('-38.25, -20.5, 54.1');
  await expect(page.locator('.atlas-slice-card header').filter({hasText:'X = -38.25 mm'})).toHaveCount(1);
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-coordinate',before);
});
test('ROI slice navigation preserves computed selections and does not trigger another computation',async({page})=>{
  const workers=[];page.on('worker',worker=>{if(/roi[.-]worker/.test(worker.url()))workers.push(worker.url());});
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'ROI comparison',exact:true}).click();
  for(const side of ['A','B']){
    await page.getByLabel(`ROI ${side} atlas`,{exact:true}).selectOption('aal3-registered');
    await expect(page.getByLabel(`ROI ${side} label`,{exact:true}).locator('option[value="134"]')).toHaveCount(1);
    await page.getByLabel(`ROI ${side} label`,{exact:true}).selectOption('134');
  }
  await page.getByLabel('ROI shared grid spacing',{exact:true}).selectOption('1');
  await page.getByRole('button',{name:'Compute ROI overlap',exact:true}).click();
  const roi=page.getByRole('group',{name:'ROI coordinate navigation',exact:true});
  await expect(roi).toBeVisible();expect(workers).toHaveLength(1);
  await roi.getByLabel('Coordinates (mm)',{exact:true}).fill('10.25,20.5,30.75');
  await roi.getByRole('button',{name:'Go to coordinate',exact:true}).click();
  await expect(roi.locator('output.coordinate-current')).toContainText('MNI152NLin6Asym · RAS · 10.25, 20.5, 30.75');
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['134']);
  await expect(page.getByLabel('ROI B label',{exact:true})).toHaveValues(['134']);
  await expect(page.locator('.roi-result .roi-metrics strong').first()).toHaveText('1.0000');expect(workers).toHaveLength(1);
});
test('task entries focus existing flows, and the example can be skipped',async({page})=>{
  const tasks=page.getByRole('navigation',{name:'Research tasks',exact:true});
  await tasks.getByRole('button',{name:'Enter coordinates',exact:true}).click();
  await expect(navigator(page).getByLabel('Coordinates (mm)',{exact:true})).toBeFocused();
  await tasks.getByRole('button',{name:'Search regions',exact:true}).click();
  await expect(page.getByLabel('Search regions, functions or conditions',{exact:true})).toBeFocused();
  await tasks.getByRole('button',{name:'Import image',exact:true}).click();
  await expect(page.getByLabel('Import NIfTI file',{exact:true})).toBeFocused();
  await tasks.getByRole('button',{name:'Find papers',exact:true}).click();
  await expect(page.getByLabel('Search papers, authors or regions',{exact:true})).toBeVisible();
  await tasks.getByRole('button',{name:'Skip example',exact:true}).click();
  await expect(tasks.getByRole('button',{name:'Try coordinate example',exact:true})).toHaveCount(0);
});

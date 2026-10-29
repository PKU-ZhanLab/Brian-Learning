import {test,expect} from '@playwright/test';
import {exportNifti} from '../../src/lib/nifti.js';
const nav=page=>page.getByRole('navigation',{name:'Main navigation'});
async function selectTwo(page,atlas='aal3-registered'){
  await nav(page).getByRole('button',{name:'Atlas labels',exact:true}).click();
  await page.getByLabel('Atlas explorer source',{exact:true}).selectOption(atlas);
  await page.getByLabel('Search atlas labels',{exact:true}).fill('Thal_Re');
  await page.locator('.atlas-label-list button').filter({hasText:'Thal_Re_R'}).click();
  await page.getByRole('checkbox',{name:'Show Thal_Re_L',exact:true}).check();
  await expect(page.getByRole('region',{name:'Selection basket'})).toContainText('2 selected');
}
test('the real explorer delivers every chosen label to A while B/settings survive, and B can be targeted',async({page})=>{
  await page.goto('/?lang=en&mode=roi');
  await page.getByLabel('ROI B atlas',{exact:true}).selectOption('aal3-registered');
  await page.getByLabel('ROI B label',{exact:true}).selectOption('134');
  await page.getByLabel('ROI shared grid spacing',{exact:true}).selectOption('1');
  await selectTwo(page);
  await page.getByRole('button',{name:'Set selection as ROI A',exact:true}).click();
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['133','134']);
  await expect(page.getByLabel('ROI B label',{exact:true})).toHaveValues(['134']);
  await expect(page.getByLabel('ROI shared grid spacing',{exact:true})).toHaveValue('1');
  await selectTwo(page);await page.getByRole('button',{name:'Set selection as ROI B',exact:true}).click();
  await expect(page.getByLabel('ROI B label',{exact:true})).toHaveValues(['133','134']);
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['133','134']);
});
test('native multi labels remain browseable with explicit blocked comparison handoff',async({page})=>{
  await page.goto('/?lang=en');await selectTwo(page,'aal3');
  await expect(page.getByRole('button',{name:'Set selection as ROI A',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Set selection as ROI B',exact:true})).toBeDisabled();
  await page.getByRole('region',{name:'Selection basket'}).getByRole('button',{name:/Remove .*133/}).click();
  await expect(page.getByRole('region',{name:'Selection basket'})).toContainText('1 selected');
});
test('back and forward restore comparison/paper context and both panels scroll without recomputing',async({page})=>{
  await page.addInitScript(()=>{window.__roiComputations=0;const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message,...rest){if(message?.volumeA&&message?.volumeB)window.__roiComputations++;return post.call(this,message,...rest);};});
  await page.goto('/?lang=en&mode=roi');
  await page.getByLabel('ROI A atlas',{exact:true}).selectOption('aal3-registered');
  await page.getByLabel('ROI A label',{exact:true}).selectOption(['133','134']);
  await page.getByLabel('ROI B atlas',{exact:true}).selectOption('aal3-registered');
  await page.getByLabel('ROI B label',{exact:true}).selectOption('134');
  await page.locator('.left-panel').evaluate(el=>{el.scrollTop=190;});
  const roiScroll=await page.locator('.left-panel').evaluate(el=>el.scrollTop);
  await nav(page).getByRole('button',{name:'Evidence library',exact:true}).click();
  await page.locator('.paper-open').first().click();
  await page.locator('.literature-scroll').evaluate(el=>{el.scrollTop=200;});
  const paperTitle=await page.locator('.paper-detail h2').innerText(),paperScroll=await page.locator('.literature-scroll').evaluate(el=>el.scrollTop);
  await page.getByRole('button',{name:'Research back',exact:true}).click();
  // First back returns to the paper list; second returns to ROI.
  await expect(page.locator('.paper-detail')).toHaveCount(0);
  await page.getByRole('button',{name:'Research back',exact:true}).click();
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['133','134']);
  await expect(page.getByLabel('ROI B label',{exact:true})).toHaveValues(['134']);
  await expect.poll(()=>page.locator('.left-panel').evaluate(el=>el.scrollTop)).toBe(roiScroll);
  await page.getByRole('button',{name:'Research forward',exact:true}).click();
  await page.getByRole('button',{name:'Research forward',exact:true}).click();
  await expect(page.locator('.paper-detail h2')).toHaveText(paperTitle);
  await expect.poll(()=>page.locator('.literature-scroll').evaluate(el=>el.scrollTop)).toBe(paperScroll);
  await expect(page.getByRole('button',{name:'Compute ROI overlap',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>window.__roiComputations)).toBe(0);
});

for(const kind of ['statistic','probability'])test(`cleared ${kind} B threshold stays missing and blocked after explorer multi-label A handoff`,async({page})=>{
  await page.goto('/?lang=en&mode=roi');
  await page.getByLabel('ROI A atlas',{exact:true}).selectOption('aal3-registered');
  await page.getByLabel('ROI A label',{exact:true}).selectOption('134');
  await page.locator('.roi-import>summary').click();
  const volume={kind,shape:[2,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],data:Float32Array.of(.8,.3)};
  await page.getByLabel('Import NIfTI file',{exact:true}).setInputFiles({name:`blank-B-${kind}.nii`,mimeType:'application/octet-stream',buffer:Buffer.from(exportNifti(volume))});
  await page.getByLabel('Imported image kind',{exact:true}).selectOption(kind);
  await page.getByLabel('Imported reference space',{exact:true}).selectOption('MNI152NLin6Asym');
  await page.getByLabel('Imported image provenance',{exact:true}).fill('Synthetic isolated regression image; declared test alignment.');
  await page.getByLabel('Confirm already aligned to FSL template',{exact:true}).check();
  await page.getByRole('button',{name:'Import local NIfTI',exact:true}).click();
  await expect(page.getByLabel('ROI B atlas',{exact:true})).toHaveValue(/^custom-/);
  const bAtlas=await page.getByLabel('ROI B atlas',{exact:true}).inputValue();
  await page.getByLabel('ROI B threshold',{exact:true}).fill('0.75');
  if(kind==='statistic')await page.getByLabel('ROI B tail',{exact:true}).selectOption('negative');
  await expect(page.getByRole('button',{name:'Compute ROI overlap',exact:true})).toBeEnabled();
  await page.getByLabel('ROI B threshold',{exact:true}).fill('');
  await expect(page.getByRole('button',{name:'Compute ROI overlap',exact:true})).toBeDisabled();
  await selectTwo(page);
  await page.getByRole('button',{name:'Set selection as ROI A',exact:true}).click();
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['133','134']);
  await expect(page.getByLabel('ROI B atlas',{exact:true})).toHaveValue(bAtlas);
  await expect(page.getByLabel('ROI B threshold',{exact:true})).toHaveValue('');
  if(kind==='statistic')await expect(page.getByLabel('ROI B tail',{exact:true})).toHaveValue('negative');
  await expect(page.getByRole('button',{name:'Compute ROI overlap',exact:true})).toBeDisabled();
});

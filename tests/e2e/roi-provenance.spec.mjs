import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

async function choose(page,spacing){
  await page.goto('/?lang=en');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'ROI comparison',exact:true}).click();
  for(const side of ['A','B']){
    await page.getByLabel(`ROI ${side} atlas`,{exact:true}).selectOption('aal3-registered');
    const select=page.getByLabel(`ROI ${side} label`,{exact:true});await expect(select.locator('option[value="134"]')).toHaveCount(1);await select.selectOption('134');
  }
  await page.getByLabel('ROI shared grid spacing',{exact:true}).selectOption(String(spacing));
  await page.getByRole('button',{name:'Compute ROI overlap',exact:true}).click();
  if(spacing===2)await page.getByRole('button',{name:'Confirm ROI sampling loss',exact:true}).click();
  await expect(page.locator('.roi-result')).toBeVisible();
}
async function download(page,name){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return fs.readFile(await(await pending).path(),'utf8');}
function parseCSV(text){return text.replace(/^\ufeff/,'').trim().split('\r\n').map(row=>{const cells=[];let cell='',quoted=false;for(let i=0;i<row.length;i++){const c=row[i];if(c==='"'){if(quoted&&row[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(cell);cell='';}else cell+=c;}expect(quoted).toBe(false);return [...cells,cell];});}
for(const spacing of [1,2])test(`${spacing} mm JSON and CSV downloads preserve exact source bytes, transforms, grid and sampling`,async({page})=>{
  await choose(page,spacing);
  const json=JSON.parse(await download(page,'Export ROI provenance JSON'));
  const csv=Object.fromEntries(parseCSV(await download(page,'Export ROI overlap metrics CSV')).slice(1).map(([key,value])=>[key,JSON.parse(value)]));
  expect(json.schema).toBe('neuroatlas-computation-v1');
  for(const field of ['manifest','metrics','probabilityMetrics','sampling'])expect(csv[field]).toEqual(json[field]);
  const {manifest,metrics,sampling}=json;
  expect(manifest.inputs[0]).toEqual(manifest.inputs[1]);expect(manifest.labelSets).toEqual([[134],[134]]);
  const expectedHash=createHash('sha256').update(await fs.readFile(new URL('../../public/data/aal-v3/aal3-fsl1mm.bin',import.meta.url))).digest('hex');
  expect(manifest.inputs[0].sha256).toBe(expectedHash);
  const fieldHash=createHash('sha256').update(await fs.readFile(new URL('../../public/data/aal-v3/sources/colin27-to-fsl-dipy.npz',import.meta.url))).digest('hex');
  expect(manifest.transforms).toEqual([{id:'public/data/aal-v3/sources/colin27-to-fsl-dipy.npz',sha256:fieldHash},{id:'public/data/aal-v3/sources/colin27-to-fsl-dipy.npz',sha256:fieldHash}]);
  expect(manifest.sourceGrids[0].shape).toEqual([181,217,181]);expect(manifest.targetGrid.shape).toEqual(spacing===1?[181,217,181]:[91,109,91]);
  expect(manifest.interpolation).toEqual(['nearest-neighbour','nearest-neighbour']);expect(manifest.thresholds[0]).toEqual({kind:'label',threshold:0,tail:'positive'});
  expect(sampling.A.sourceVoxels).toBe(7);expect(sampling.A.targetVoxels).toBe(spacing===1?7:0);expect(metrics.dice).toBe(spacing===1?1:null);
  expect(sampling.A.lostLabelIds).toEqual(spacing===1?[]:[134]);
  expect(manifest.inputs.slice(2).some(input=>input.id.endsWith('AAL3v1_1mm.nii'))).toBe(true);
  const preserved=JSON.stringify(manifest);
  await page.getByLabel('ROI A label',{exact:true}).selectOption('133');
  expect(JSON.stringify(json.manifest)).toBe(preserved);await expect(page.locator('.roi-result')).toHaveCount(0);
});

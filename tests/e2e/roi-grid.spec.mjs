import {test, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {parseNifti} from '../../src/lib/nifti.js';

async function chooseSmallROI(page) {
  await page.goto('/?lang=en');
  await page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name:'ROI comparison', exact:true}).click();
  for (const side of ['A','B']) {
    await page.getByLabel(`ROI ${side} atlas`, {exact:true}).selectOption('aal3-registered');
    const labels = page.getByLabel(`ROI ${side} label`, {exact:true});
    await expect(labels.locator('option[value="134"]')).toHaveCount(1);
    await labels.selectOption('134');
  }
  await expect(page.getByRole('button', {name:'Compute ROI overlap', exact:true})).toBeEnabled();
}

test('2 mm real label loss requires confirmation and stays distinct from an empty intersection', async ({page}) => {
  await chooseSmallROI(page);
  await expect(page.getByLabel('ROI shared grid spacing', {exact:true})).toHaveValue('2');
  await page.getByRole('button', {name:'Compute ROI overlap', exact:true}).click();
  const sampling = page.getByRole('region', {name:'ROI sampling report', exact:true});
  await expect(sampling).toContainText('91 × 109 × 91');
  await expect(sampling).toContainText('Labels lost in sampling: 134');
  await expect(sampling.getByRole('row').filter({hasText:'ROI A'}).getByRole('cell').nth(1)).toHaveText('7 / 7');
  await expect(sampling.getByRole('row').filter({hasText:'ROI A'}).getByRole('cell').nth(2)).toHaveText('0 / 0');
  await expect(page.locator('.roi-result')).toHaveCount(0);
  await page.getByRole('button', {name:'Cancel ROI sampling preflight', exact:true}).click();
  await expect(sampling).toHaveCount(0);
  await expect(page.locator('.roi-result')).toHaveCount(0);
  await page.getByRole('button', {name:'Compute ROI overlap', exact:true}).click();
  await page.getByRole('button', {name:'Confirm ROI sampling loss', exact:true}).click();
  await expect(page.locator('.roi-result')).toBeVisible();
  await expect(page.locator('.roi-result .roi-metrics strong').first()).toHaveText('—');
  await expect(page.locator('.roi-result')).not.toContainText('The intersection is empty; the separate regions remain available.');
  await expect(sampling).toContainText('Labels lost in sampling: 134');
  await page.getByLabel('ROI shared grid spacing', {exact:true}).selectOption('1');
  await expect(page.locator('.roi-result')).toHaveCount(0);
});

test('1 mm self comparison preserves label 134 and mask export uses the selected grid', async ({page}) => {
  await chooseSmallROI(page);
  await page.getByLabel('ROI shared grid spacing', {exact:true}).selectOption('1');
  await expect(page.getByText(/1 mm is output spacing, not 1 mm localization accuracy/)).toBeVisible();
  await page.getByRole('button', {name:'Compute ROI overlap', exact:true}).click();
  const result = page.locator('.roi-result');
  await expect(result).toBeVisible();
  await expect(result.locator('.roi-metrics strong').first()).toHaveText('1.0000');
  const sampling = result.getByRole('region', {name:'ROI sampling report', exact:true});
  await expect(sampling).toContainText('181 × 217 × 181');
  await expect(sampling.getByRole('row').filter({hasText:'ROI A'}).getByRole('cell').nth(2)).toHaveText('7 / 7');
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('button', {name:'Export ROI A NIfTI mask', exact:true}).click();
  const bytes = new Uint8Array(await fs.readFile(await (await downloadReady).path()));
  const mask = await parseNifti(bytes.buffer, {kind:'mask'});
  expect(mask.shape).toEqual([181,217,181]);
  expect(mask.affine).toEqual([1,0,0,-90,0,1,0,-126,0,0,1,-72,0,0,0,1]);
  expect(mask.data.reduce((sum,value) => sum+value, 0)).toBe(7);
  // A nonempty disjoint pair has a true zero intersection, with both labels retained.
  await page.getByLabel('ROI A label', {exact:true}).selectOption('133');
  await page.getByRole('button', {name:'Compute ROI overlap', exact:true}).click();
  await expect(result).toContainText('The intersection is empty; the separate regions remain available.');
  await expect(result.locator('.roi-metrics strong').first()).toHaveText('0.0000');
});

test('late real-worker messages cannot commit a cancelled computation', async ({page}) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.__roiDelivered = 0;
    window.__roiScheduled = 0;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) { super(url, options); this.isROI = String(url).includes('roi.worker'); }
      set onmessage(callback) {
        super.onmessage = this.isROI ? event => { window.__roiScheduled++; setTimeout(() => { window.__roiDelivered++; callback?.(event); }, 1200); } : callback;
      }
    };
  });
  await chooseSmallROI(page);
  await page.getByLabel('ROI shared grid spacing', {exact:true}).selectOption('1');
  await page.getByRole('button', {name:'Compute ROI overlap', exact:true}).click();
  await expect.poll(() => page.workers().some(worker => worker.url().includes('roi.worker'))).toBe(true);
  // Let the real worker finish while delivery is delayed, then cancel the UI generation.
  await page.waitForFunction(() => window.__roiScheduled >= 2 && window.__roiDelivered === 0);
  await page.getByRole('button', {name:'Cancel ROI computation', exact:true}).click();
  await expect(page.locator('.roi-result')).toHaveCount(0);
  await page.getByLabel('ROI shared grid spacing', {exact:true}).selectOption('2');
  await expect.poll(() => page.evaluate(() => window.__roiDelivered)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.roi-result')).toHaveCount(0);
});

import {test,expect} from '@playwright/test';

// Isolated CI browser only. The desktop scene is verified separately through CUA.
test('mapping: opening Silani locates only the supported right hemisphere',async({page})=>{
  await page.goto('/?lang=en&mode=research');
  const workspace=page.getByRole('region',{name:'Literature workspace'});
  await workspace.getByRole('textbox',{name:'Search papers, authors or regions'}).fill('Silani');
  await workspace.locator('.paper-open').click();
  const selected=page.locator('.structure-row.selected');
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(/右缘上回|right supramarginal/i);
  const left=workspace.locator('details[data-target-region="supramarginal-l"]');
  await expect(left).toHaveAttribute('data-support','context');
  await expect(left.getByRole('button')).not.toBeVisible();
  await left.locator('summary').click();
  await expect(left).toContainText('not evidence for the same intervention result');
  await expect(left).toContainText('right supramarginal gyrus');
  await left.getByRole('button',{name:/Locate context/}).click();
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(/左缘上回|left supramarginal/i);
});

test('mapping: scalp ERP links require explicit contextual navigation',async({page})=>{
  await page.goto('/?lang=en&mode=research');
  const workspace=page.getByRole('region',{name:'Literature workspace'});
  await workspace.getByRole('textbox',{name:'Search papers, authors or regions'}).fill('Bentin');
  await workspace.locator('.paper-open').click();
  await expect(page.locator('.structure-row.selected')).toHaveCount(0);
  await expect(workspace.locator('[data-support="direct"]')).toHaveCount(0);
  const contextual=workspace.locator('[data-mapping-id="reading:bentin1996:fusiform-l"]');
  await contextual.locator('summary').click();
  await expect(contextual).toContainText('Scalp electrodes are not source coordinates');
  await expect(contextual).toContainText('posterior temporal scalp electrodes (N170)');
});

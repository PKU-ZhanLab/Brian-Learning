import {test, expect} from '@playwright/test';

test('nested atlas and save dialogs close one at a time and restore their openers', async ({page}) => {
  await page.goto('/?lang=en');
  const opener = page.getByRole('navigation', {name: 'Main navigation'}).getByRole('button', {name: 'Atlas labels', exact: true});
  await opener.focus();
  await page.keyboard.press('Enter');
  const atlas = page.getByRole('dialog', {name: 'Atlas label explorer', exact: true});
  await expect(atlas).toBeVisible();
  const save = atlas.getByRole('button', {name: 'Save and share', exact: true});
  await save.focus();
  await page.keyboard.press('Space');
  const files = page.getByRole('dialog', {name: 'Save and share', exact: true});
  await expect(files).toBeVisible();
  // Repeated Tab/Shift+Tab must never reach the covered atlas or application.
  for (const key of ['Tab', 'Shift+Tab', ...Array(16).fill('Tab')]) {
    await page.keyboard.press(key);
    await expect.poll(() => files.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(files).toHaveCount(0);
  await expect(atlas).toBeVisible();
  await expect(save).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(atlas).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('JSON import opens from Enter and Space and cancel returns to its button', async ({page}) => {
  await page.goto('/?lang=en&mode=research');
  const importer = page.getByRole('button', {name: 'Import JSON', exact: true});
  for (const key of ['Enter', 'Space']) {
    await importer.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press(key);
    const filechooser = await chooser;
    // Playwright intercepts the native chooser; desktop cancellation is a CUA check.
    await filechooser.setFiles([]);
    await expect(importer).toBeFocused();
  }
});

test('structure visibility is visible on keyboard focus and input keeps slash', async ({page}) => {
  await page.goto('/?lang=en');
  const visibility = page.locator('.structure-row > button:last-child').first();
  await visibility.focus();
  await expect(visibility).toBeFocused();
  await expect(visibility).toHaveCSS('opacity', '1');
  await expect(visibility).toHaveAttribute('aria-pressed', /true|false/);
  await page.getByRole('button', {name: 'Projects & views', exact: true}).click();
  const name = page.getByRole('textbox', {name: 'View name', exact: true});
  await name.fill('motor');
  await name.press('/');
  await expect(name).toHaveValue('motor/');
});

test('English page has no React unique-key warnings after localization', async ({page}) => {
  const warnings = [];
  page.on('console', message => {
    if (/unique.*key|same key/i.test(message.text())) warnings.push(message.text());
  });
  await page.goto('/?lang=en');
  await expect(page.getByRole('navigation', {name: 'Main navigation'})).toBeVisible();
  await page.getByRole('button', {name: 'Projects & views', exact: true}).click();
  await page.keyboard.press('Escape');
  expect(warnings).toEqual([]);
});

test('the focused canvas exposes existing standard views to the keyboard', async ({page}) => {
  await page.goto('/?lang=en');
  const canvas = page.locator('.brain-scene > div canvas').first();
  await canvas.focus();
  await canvas.press('2');
  const views = page.getByRole('group', {name: 'Standard views'});
  await expect(views.getByRole('button', {name: 'Sagittal', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await canvas.press('Home');
  await expect(views.getByRole('button', {name: '3D', exact: true})).toHaveAttribute('aria-pressed', 'true');
});

test('a nonmodal coordinate panel explicitly returns focus and can be entered again', async ({page}) => {
  await page.goto('/?lang=en&mode=research');
  const workspace = page.getByRole('region', {name: 'Literature workspace'});
  await workspace.getByRole('textbox', {name: 'Search papers, authors or regions'}).fill('Schaum');
  await workspace.locator('.paper-open').click();
  const source = workspace.getByRole('button', {name: 'View reported result coordinates', exact: true}).first();
  await source.focus();
  await source.press('Enter');
  const panel = page.getByRole('dialog', {name: 'Paper result coordinates', exact: true});
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute('aria-modal', 'true');
  await panel.getByRole('button', {name: 'Return to workspace', exact: true}).click();
  await expect(source).toBeFocused();
  await expect(panel).toBeVisible();
  await source.press('Enter');
  await expect.poll(() => panel.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(source).toBeFocused();
});

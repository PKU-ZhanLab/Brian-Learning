import {test, expect} from '@playwright/test';

for (const locale of [
  {lang: 'zh', documentLang: 'zh-CN', navigation: '主要导航', anatomy: '解剖探索'},
  {lang: 'en', documentLang: 'en', navigation: 'Main navigation', anatomy: 'Anatomy'},
]) {
  test(`baseline page loads in ${locale.lang}`, async ({page}) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const manifestResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/data/manifest.json');
    const response = await page.goto(`/?lang=${locale.lang}`);
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/NeuroAtlas/);
    await expect(page.locator('html')).toHaveAttribute('lang', locale.documentLang);
    await expect(page.locator('.app-shell')).toBeVisible();
    const navigation = page.getByRole('navigation', {name: locale.navigation});
    await expect(navigation.getByRole('button', {name: locale.anatomy, exact: true})).toBeVisible();
    const manifest = await manifestResponse;
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).atlases.dk.available).toBe(true);
    // Loading a page must not crash React; this does not certify anatomy or layout.
    expect(errors).toEqual([]);
  });
}

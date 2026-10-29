import {defineConfig, devices} from '@playwright/test';

// Only an isolated test browser may use this harness. Desktop acceptance uses CUA.
// A fixed private origin plus reuseExistingServer:false prevents attaching to a
// user's running application, browser profile or research storage.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {timeout: 15_000},
  outputDir: 'output/e2e-results',
  reporter: [['list'], ['html', {outputFolder: 'output/e2e-report', open: 'never'}]],
  use: {
    baseURL: 'http://127.0.0.1:4179',
    storageState: {cookies: [], origins: []},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}}],
  webServer: {
    command: 'npm run dev -- --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

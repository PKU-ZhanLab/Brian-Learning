import config from '../../playwright.config.mjs';

// Build first with npm run build:public. This separate isolated harness checks
// the actual GitHub Pages subpath and generated no-script landing files.
export default {
  ...config,
  testDir:'.',testMatch:'public-result-page.spec.mjs',testIgnore:[],
  outputDir:'../../output/e2e-public-results',
  reporter:[['list'],['html',{outputFolder:'output/e2e-public-report',open:'never'}]],
  use:{...config.use,baseURL:'http://127.0.0.1:4179/Brian-Learning/'},
  webServer:{...config.webServer,command:'npm run preview -- --port 4179 --strictPort --outDir dist-public --base /Brian-Learning/',url:'http://127.0.0.1:4179/Brian-Learning/'},
};

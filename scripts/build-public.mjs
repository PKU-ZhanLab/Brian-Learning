import {build} from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';
import {projectRoot,preparePublicData} from './public-package.mjs';
import {buildResultPages} from './build-result-pages.mjs';
process.env.VITE_BASE_PATH=process.env.VITE_BASE_PATH||'/Brian-Learning/';
await build({root:projectRoot,base:process.env.VITE_BASE_PATH,build:{outDir:'dist-public',emptyOutDir:true}});
const report=await preparePublicData(path.join(projectRoot,'public/data'),path.join(projectRoot,'dist-public/data'));
const resultPages=await buildResultPages({outDir:path.join(projectRoot,'dist-public'),base:process.env.VITE_BASE_PATH});
await fs.writeFile(path.join(projectRoot,'dist-public','.nojekyll'),'');
// Keep original license/data bytes intact when this build is committed on Windows.
await fs.writeFile(path.join(projectRoot,'dist-public','.gitattributes'),'* -text\n');
console.log(`Public build: ${report.files} hashed data assets; ${report.onDemandPAM50Structures} official-source descriptors; no bundled PAM50 meshes.`);
console.log(`Result pages: ${resultPages.records.length} fixed language/version pages; results/manifest.json.`);

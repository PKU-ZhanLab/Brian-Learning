// Authored for permitted isolated CI only. G1 discovered these tests; no browser run occurred.
import {test,expect} from '@playwright/test';
import {serializeProject,parseProject} from '../../src/lib/workspace-project.js';
import {validateEvidencePackageClosure} from '../../src/lib/evidence-package.js';
import {exportNifti} from '../../src/lib/nifti.js';

const nav=page=>page.getByRole('navigation',{name:'Main navigation',exact:true});
async function downloaded(download){const stream=await download.createReadStream(),parts=[];for await(const part of stream)parts.push(part);return Buffer.concat(parts).toString('utf8');}
async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function open(page,text){const dialog=await files(page);await dialog.locator('input[type=file]').setInputFiles({name:'synthetic-journey.neuroatlas',mimeType:'application/json',buffer:Buffer.from(text)});await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();}
async function project(page){const dialog=await files(page);await dialog.getByRole('button',{name:'Export project',exact:true}).click();const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const text=await downloaded(await pending);await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();return {text,value:await parseProject(text)};}
async function reopenInFreshStorage(browser,baseURL,text,assertions){const context=await browser.newContext({baseURL,storageState:{cookies:[],origins:[]}});try{const next=await context.newPage();await next.goto('/?lang=en');await open(next,text);await assertions(next);}finally{await context.close();}}
async function calculate(page){await page.getByRole('button',{name:'Compute ROI overlap',exact:true}).click();const confirm=page.getByRole('button',{name:'Confirm ROI sampling loss',exact:true});if(await confirm.isVisible())await confirm.click();await expect(page.locator('.roi-result')).toBeVisible();}

test('source coordinate keeps unknown space blocked; explicit template probe, paper export and fresh project restore remain explainable',async({page,browser,baseURL})=>{
 await page.goto('/?lang=en');await page.getByRole('navigation',{name:'Research tasks',exact:true}).getByRole('button',{name:'Enter coordinates',exact:true}).click();
 const coordinate=page.getByRole('group',{name:'Main coordinate navigation',exact:true});
 await coordinate.getByLabel('Reference space',{exact:true}).fill('MNI-unspecified');
 await coordinate.getByLabel('Coordinates (mm)',{exact:true}).fill('39,-52,-16');await coordinate.getByRole('button',{name:'Go to coordinate',exact:true}).click();
 await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','idle');
 // Separate synthetic template probe: this is not a registration of the paper coordinate.
 await coordinate.getByLabel('Reference space',{exact:true}).fill('MNI152NLin6Asym');await coordinate.getByLabel('Coordinates (mm)',{exact:true}).fill('5,-9,-4');await coordinate.getByRole('button',{name:'Go to coordinate',exact:true}).click();
 for(const atlas of ['dk','aal3-registered']){await page.getByLabel('Choose an atlas',{exact:true}).selectOption(atlas);await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','ready');}
 await nav(page).getByRole('button',{name:'Evidence library',exact:true}).click();const workspace=page.getByRole('region',{name:'Literature workspace'});await workspace.getByRole('checkbox',{name:/Current region only/}).uncheck();await workspace.getByRole('textbox',{name:'Search papers, authors or regions'}).fill('Axelrod');await workspace.locator('[data-reference-id="axelrod2015"] .paper-open').click();await expect(workspace.locator('.paper-detail')).toContainText('MNI-unspecified');
 const pending=page.waitForEvent('download');await workspace.getByRole('button',{name:'Export this paper’s evidence package JSON',exact:true}).click();const evidence=JSON.parse(await downloaded(await pending));expect(validateEvidencePackageClosure(evidence).valid).toBe(true);expect(evidence.locations.every(row=>row.sourceSpaceId==='MNI-unspecified')).toBe(true);expect(evidence.sourceArtifacts.length).toBeGreaterThan(0);
 const saved=await project(page);await reopenInFreshStorage(browser,baseURL,saved.text,async next=>{await nav(next).getByRole('button',{name:'Evidence library',exact:true}).click();await expect(next.locator('.paper-detail')).toContainText('Successful Decoding');});
});

test('two atlas label groups compare, export full provenance, reopen without recompute and return to source controls',async({page,browser,baseURL})=>{
 await page.goto('/?lang=en&mode=roi');
 for(const [side,atlas,labels] of [['A','dk',['1','2']],['B','aal3-registered',['133','134']]]){await page.getByLabel(`ROI ${side} atlas`,{exact:true}).selectOption(atlas);await expect(page.getByLabel(`ROI ${side} label`,{exact:true}).locator('option')).not.toHaveCount(0);await page.getByLabel(`ROI ${side} label`,{exact:true}).selectOption(labels);}
 await page.getByLabel('ROI shared grid spacing',{exact:true}).selectOption('1');await calculate(page);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export ROI provenance JSON',exact:true}).click();const independent=JSON.parse(await downloaded(await pending));expect(JSON.stringify(independent)).toContain('sha256');expect(JSON.stringify(independent)).toContain('targetGrid');
 const saved=await project(page);expect(saved.value.roiSnapshot.manifest.inputs).toHaveLength(2);expect(saved.value.roiSnapshot.manifest.appVersion).toBe('4.2.0');
 await reopenInFreshStorage(browser,baseURL,saved.text,async next=>{await expect(next.getByLabel('ROI A label',{exact:true})).toHaveValues(['1','2']);await expect(next.getByLabel('ROI B label',{exact:true})).toHaveValues(['133','134']);await expect(next.getByRole('region',{name:'Saved computation',exact:true})).toBeVisible();await expect(next.getByRole('button',{name:'Open source comparison',exact:true})).toBeVisible();const again=await project(next);expect(again.value.roiSnapshot).toEqual(saved.value.roiSnapshot);});
});

test('synthetic statistic retains file-specific space, threshold, sampling and image identity through independent export and recovery',async({page,browser,baseURL})=>{
 await page.goto('/?lang=en&mode=roi');await page.getByLabel('ROI A atlas',{exact:true}).selectOption('aal3-registered');await page.getByLabel('ROI A label',{exact:true}).selectOption('134');await page.locator('.roi-import>summary').click();
 const raw=exportNifti({kind:'statistic',shape:[2,1,1],affine:[1,0,0,5,0,1,0,-9,0,0,1,-4,0,0,0,1],data:Float32Array.of(3,0)});
 await page.getByLabel('Import NIfTI file',{exact:true}).setInputFiles({name:'synthetic-source.nii',mimeType:'application/octet-stream',buffer:Buffer.from(raw)});await page.getByLabel('Imported image kind',{exact:true}).selectOption('statistic');await page.getByLabel('Imported reference space',{exact:true}).selectOption('MNI152NLin6Asym');await page.getByLabel('Imported image provenance',{exact:true}).fill('Synthetic known-grid acceptance fixture; no empirical/anatomical claim.');await page.getByLabel('Confirm already aligned to FSL template',{exact:true}).check();await page.getByRole('button',{name:'Import local NIfTI',exact:true}).click();await expect(page.getByLabel('ROI B atlas',{exact:true})).toHaveValue(/^custom-/);await page.getByLabel('ROI B threshold',{exact:true}).fill('2.5');await page.getByLabel('ROI shared grid spacing',{exact:true}).selectOption('1');await calculate(page);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export ROI provenance JSON',exact:true}).click();expect(JSON.stringify(JSON.parse(await downloaded(await pending)))).toContain('sourceGrid');
 const saved=await project(page);expect(saved.value.volumes).toHaveLength(1);expect(saved.value.roiSnapshot.sampling.B.sourceVoxels).toBe(1);expect(saved.value.roiSnapshot.manifest.inputs.some(row=>row.sha256)).toBe(true);
 await reopenInFreshStorage(browser,baseURL,saved.text,async next=>{await expect(next.getByLabel('ROI B threshold',{exact:true})).toHaveValue('2.5');const again=await project(next);expect(again.value.volumes[0].data).toEqual(saved.value.volumes[0].data);expect(again.value.roiSnapshot).toEqual(saved.value.roiSnapshot);await expect(next.locator('.roi-provenance')).toContainText('Synthetic known-grid');});
});

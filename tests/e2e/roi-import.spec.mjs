import {test,expect} from '@playwright/test';
import {exportNifti} from '../../src/lib/nifti.js';

// Only synthetic in-memory data; run in an explicitly permitted isolated runner.
const image=(name='same.nii',value=1)=>({name,mimeType:'application/octet-stream',buffer:Buffer.from(exportNifti({kind:'label',shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],data:Uint8Array.of(value)}))});
const labels={name:'A-labels.csv',mimeType:'text/csv',buffer:Buffer.from('id,name\n1,A only label')};
async function openImport(page){
 await page.goto('/?lang=en');await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'ROI comparison',exact:true}).click();
 await page.locator('.roi-import>summary').click();return page.locator('.roi-import');
}
async function declareA(panel){
 await panel.getByLabel('Import NIfTI file',{exact:true}).setInputFiles(image());
 await panel.getByLabel('Imported image kind',{exact:true}).selectOption('mask');
 await panel.getByLabel('Imported reference space',{exact:true}).selectOption('MNI152NLin6Asym');
 await panel.getByLabel('Import label names',{exact:true}).setInputFiles(labels);
 await panel.getByLabel('Imported image provenance',{exact:true}).fill('Synthetic A registration evidence');
 await panel.getByLabel('Confirm already aligned to FSL template',{exact:true}).check();
}
for(const name of ['B.nii','same.nii'])test(`choosing ${name} resets its declaration and actual label input`,async({page})=>{
 const panel=await openImport(page);await declareA(panel);
 await expect(panel.getByLabel('Image import summary')).toContainText('A-labels.csv');
 await panel.getByLabel('Import NIfTI file',{exact:true}).setInputFiles(image(name,2));
 await expect(panel.getByLabel('Imported image kind',{exact:true})).toHaveValue('label');
 await expect(panel.getByLabel('Imported reference space',{exact:true})).toHaveValue('native-unverified');
 await expect(panel.getByLabel('Imported image provenance',{exact:true})).toHaveValue('');
 expect(await panel.getByLabel('Import label names',{exact:true}).evaluate(input=>input.files.length)).toBe(0);
 await expect(panel.getByLabel('Image import summary')).toContainText(name);await expect(panel.getByLabel('Image import summary')).toContainText('None');await expect(panel.getByLabel('Image import summary')).not.toContainText('A-labels.csv');
 await panel.getByLabel('Imported reference space',{exact:true}).selectOption('MNI152NLin6Asym');await expect(panel.getByLabel('Confirm already aligned to FSL template',{exact:true})).not.toBeChecked();
 await panel.getByLabel('Imported reference space',{exact:true}).selectOption('native-unverified');
 await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText(`${name} · Integer labels · native-unverified · No label table`);
 await expect(page.locator('.roi-imported-volumes')).toContainText('Alignment unverified');
});
test('missing evidence and failed decoding preserve this file declaration for correction',async({page})=>{
 const panel=await openImport(page);await declareA(panel);await panel.getByLabel('Imported image provenance',{exact:true}).fill('');
 await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Enter the source and alignment evidence');
 await expect(panel.getByLabel('Confirm already aligned to FSL template',{exact:true})).toBeChecked();await expect(panel.getByLabel('Image import summary')).toContainText('A-labels.csv');
 await panel.getByLabel('Import NIfTI file',{exact:true}).setInputFiles({name:'broken.nii',mimeType:'application/octet-stream',buffer:Buffer.from([1,2])});
 await panel.getByLabel('Imported image provenance',{exact:true}).fill('Keep correction evidence');await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();
 await expect(panel.getByRole('alert')).toContainText('header is truncated');await expect(panel.getByLabel('Imported image provenance',{exact:true})).toHaveValue('Keep correction evidence');await expect(panel.getByLabel('Image import summary')).toContainText('broken.nii');
});

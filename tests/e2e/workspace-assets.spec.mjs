// Synthetic isolated runner only. Desktop imports and browser execution require
// the coordinator's permission path; authoring this test is not browser acceptance.
import {test,expect} from '@playwright/test';
import {serializeProject} from '../../src/lib/workspace-project.js';
import {emptyEvidence} from '../../src/lib/evidence-schema.js';

const volume=id=>({id,name:id,kind:'label',space:'native-unverified',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],labels:[]});
const project=(id,volumes)=>serializeProject({projectId:id,view:{language:'en',atlas:'dk',mode:'anatomy',roi:{aAtlas:volumes[0].id,aLabels:[1],bAtlas:'dk',bLabels:[2],computed:false}},notes:[{id:'note',text:`Note ${id}`}],evidence:emptyEvidence(),volumes,roiSnapshot:{id:`snapshot-${id}`,A:{atlasId:volumes[0].id},manifest:null,metrics:{dice:.42}}});
const storage=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function open(dialog,text){await dialog.locator('input[type=file]').setInputFiles({name:'synthetic.neuroatlas',mimeType:'application/json',buffer:Buffer.from(text)});await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();}
async function downloadProject(page,dialog){const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const stream=await(await event).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString());}

test('A to B scoped export lists exactly its downloaded assets; removal retains historical values and exports again',async({page})=>{
 await page.goto('/?lang=en');const dialog=await files(page);
 await open(dialog,await project('A',[volume('custom-a-private')]));await open(dialog,await project('B',[volume('custom-b-used'),volume('custom-b-extra')]));
 const assets=dialog.getByRole('region',{name:'Project assets',exact:true});await expect(assets.locator('[data-asset-id]')).toHaveCount(2);await expect(assets).not.toContainText('custom-a-private');
 const before=await storage(page);await assets.getByRole('checkbox',{name:'Export asset: custom-b-used',exact:true}).uncheck();await assets.getByRole('combobox',{name:'Export dependency policy'}).selectOption('detach');await assets.getByRole('button',{name:'Export selected content'}).click();
 const preview=dialog.getByRole('region',{name:'Asset action preview'});await expect(preview.locator('.workspace-export-assets li')).toHaveCount(1);await expect(preview).toContainText('roi.aAtlas');await expect(preview).toContainText('roiSnapshot');expect(await storage(page)).toEqual(before);
 const exported=await downloadProject(page,dialog);expect(exported.projectId).toBe('B');expect(exported.volumes.map(v=>v.id)).toEqual(['custom-b-extra']);expect(exported.roiSnapshot.metrics.dice).toBe(.42);expect(exported.roiSnapshot.status).toBe('missing-input');expect(await storage(page)).toEqual(before);
 await assets.getByRole('button',{name:'Remove asset: custom-b-used',exact:true}).click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(await storage(page)).toEqual(before);
 await assets.getByRole('button',{name:'Remove asset: custom-b-used',exact:true}).click();await dialog.getByRole('button',{name:'Confirm removal'}).click();await expect(assets.locator('[data-asset-id]')).toHaveCount(1);await expect(assets).toContainText('Historical records have missing inputs');
 await dialog.getByRole('button',{name:'Export project',exact:true}).click();const recovered=await downloadProject(page,dialog);expect(recovered.volumes.map(v=>v.id)).toEqual(['custom-b-extra']);expect(recovered.notes[0].text).toBe('Note B');expect(recovered.roiSnapshot.metrics.dice).toBe(.42);expect(recovered.missingAssetIds).toEqual(['custom-b-used']);
});

test('quota failure keeps the asset list, export selection and all research storage',async({page})=>{
 await page.goto('/?lang=en');const dialog=await files(page);await open(dialog,await project('B',[volume('custom-used'),volume('custom-extra')]));
 const extra=dialog.getByRole('checkbox',{name:'Export asset: custom-extra',exact:true});await extra.uncheck();const before=await storage(page);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='neuroatlas-workspace-current-v1')throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,key,value);};});
 await dialog.getByRole('button',{name:'Remove asset: custom-used',exact:true}).click();await dialog.getByRole('button',{name:'Confirm removal'}).click();await expect(dialog.getByText('Browser storage is full. Free space, then retry saving; current edits remain available.',{exact:true})).toBeVisible();await expect(extra).not.toBeChecked();await expect(dialog.locator('[data-asset-id]')).toHaveCount(2);expect(await storage(page)).toEqual(before);
});

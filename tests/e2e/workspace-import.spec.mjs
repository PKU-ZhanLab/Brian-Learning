import {test,expect} from '@playwright/test';
import {serializeProject} from '../../src/lib/workspace-project.js';
import {emptyEvidence} from '../../src/lib/evidence-schema.js';

const key='neuroatlas-workspace-current-v1';
const ownedVolume={id:'custom-owned',name:'Synthetic owned label',kind:'label',space:'native-unverified',shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],data:Uint8Array.of(1),labels:[]};
const project=async(id,extra={})=>serializeProject({projectId:id,view:{language:'en',atlas:'dk',selectedIds:['precentral-l'],camera:{position:[100,50,100],target:[0,0,0],zoom:1}},notes:[{id:'note',text:`Note ${id}`,structureId:'precentral-l'}],evidence:emptyEvidence(),drafts:[],volumes:[],...extra});
const storage=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function upload(dialog,text,mode='open'){
 await dialog.getByRole('button',{name:mode==='merge'?'Merge into current project':'Open project file',exact:true}).click({trial:true});
 // The isolated runner supplies a synthetic file; native chooser cancellation is a separate desktop acceptance.
 await dialog.locator('input[type=file]').setInputFiles({name:'synthetic.neuroatlas',mimeType:'application/json',buffer:Buffer.from(text)});
}
async function openProject(page,text){const dialog=await files(page);await upload(dialog,text);await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();await dialog.getByRole('button',{name:'Close save dialog'}).click();}

test('failed project and preview cancellation preserve every key and the ongoing note edit',async({page})=>{
 await page.goto('/?lang=en');await openProject(page,await project('A',{volumes:[ownedVolume]}));
 await page.getByRole('button',{name:'Research notes',exact:true}).click();const draft=page.locator('#note-draft');await draft.fill('Unsaved research edit');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 const before=await storage(page);const canvas=page.locator('.scene-canvas, canvas').first();await canvas.evaluate(node=>{window.__workspaceCanvas=node;});
 const dialog=await files(page);const missing=JSON.parse(await project('B'));missing.view.atlas='custom-absent';await upload(dialog,JSON.stringify(missing));await expect(dialog.getByRole('status')).toContainText('missing-asset');expect(await storage(page)).toEqual(before);
 await upload(dialog,await project('B'));await expect(dialog.getByRole('region',{name:'Project import preview'})).toBeVisible();expect(await storage(page)).toEqual(before);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(await storage(page)).toEqual(before);
 await dialog.getByRole('button',{name:'Close save dialog'}).click();await page.getByRole('button',{name:'Research notes',exact:true}).click();await expect(draft).toHaveValue('Unsaved research edit');await expect.poll(()=>canvas.evaluate(node=>node===window.__workspaceCanvas)).toBe(true);
});

test('opening a second project replaces its assets and evidence ownership; explicit merge preserves both',async({page})=>{
 await page.goto('/?lang=en');await openProject(page,await project('A',{volumes:[ownedVolume]}));
 const dialog=await files(page);await upload(dialog,await project('B'));await expect(dialog.getByRole('region',{name:'Project import preview'})).toContainText('custom-owned');await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();await expect(dialog).toContainText('This project contains 0 imported volumes.');
 let saved=JSON.parse((await storage(page))[key]);expect(saved.projectId).toBe('B');expect(saved.notes[0].text).toBe('Note B');expect(saved).not.toHaveProperty('volumes');
 // Use the real merge trigger to bind picker mode, intercepting its native chooser.
 const chooser=page.waitForEvent('filechooser');await dialog.getByRole('button',{name:'Merge into current project',exact:true}).click();await (await chooser).setFiles({name:'merge.neuroatlas',mimeType:'application/json',buffer:Buffer.from(await project('C'))});
 await expect(dialog.getByRole('region',{name:'Project import preview'})).toContainText('note');await dialog.getByRole('button',{name:'Confirm merge',exact:true}).click();saved=JSON.parse((await storage(page))[key]);expect(saved.projectId).toBe('B');expect(saved.notes.map(n=>n.text)).toEqual(['Note B','Note C']);
});

test('quota errors leave notes, the editor and every persistent key untouched',async({page})=>{
 await page.goto('/?lang=en');await openProject(page,await project('A'));
 await page.getByRole('button',{name:'Research notes',exact:true}).click();await page.locator('#note-draft').fill('Must survive quota error');const before=await storage(page);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name==='neuroatlas-workspace-current-v1')throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,name,value);};});
 await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#note-draft')).toHaveValue('Must survive quota error');await expect(page.getByText('Browser storage is full. Free space, then retry saving; current edits remain available.',{exact:true})).toBeVisible();expect(await storage(page)).toEqual(before);
});

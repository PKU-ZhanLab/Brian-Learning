// Isolated CI only. Native picker cancellation and actual 200% zoom remain separate manual gates.
import {test,expect} from '@playwright/test';
import {serializeProject,parseProject} from '../../src/lib/workspace-project.js';
import {emptyEvidence} from '../../src/lib/evidence-schema.js';
async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function choose(dialog,text){await dialog.locator('input[type=file]').setInputFiles({name:'synthetic-recovery.neuroatlas',mimeType:'application/json',buffer:Buffer.from(text)});}
async function open(page,text){const dialog=await files(page);await choose(dialog,text);await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();}
async function exported(page){const dialog=await files(page);await dialog.getByRole('button',{name:'Export project',exact:true}).click();const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const stream=await(await pending).createReadStream(),parts=[];for await(const part of stream)parts.push(part);return parseProject(Buffer.concat(parts).toString('utf8'));}

test('a separate browser storage restores a chosen project and v1 migrates without invented numerical history',async({browser,baseURL})=>{
 const legacy=JSON.stringify({schema:'neuroatlas-project-v1',view:{language:'en',mode:'roi',roi:{aAtlas:'dk',aLabels:[1],bAtlas:'aal3-registered',bLabels:[134],computed:true}},notes:[],evidence:emptyEvidence(),volumes:[]});
 const context=await browser.newContext({baseURL,storageState:{cookies:[],origins:[]}});try{const page=await context.newPage();await page.goto('/?lang=en');await open(page,legacy);await expect(page.getByRole('region',{name:'Saved computation',exact:true})).toContainText('No historical numerical result was saved');const migrated=await exported(page);expect(migrated.provenanceStatus).toBe('missing-provenance');expect(migrated.roiSnapshot).toBeNull();expect(migrated.recomputedSnapshot).toBeNull();expect(migrated.view.roi.computed).toBe(false);}finally{await context.close();}
});

test('malformed chosen project cannot replace an existing synthetic project',async({page})=>{
 const text=await serializeProject({projectId:'g1-preserve',view:{language:'en',mode:'roi'},notes:[],evidence:emptyEvidence(),volumes:[]});await page.goto('/?lang=en');await open(page,text);const before=await exported(page);await page.getByRole('button',{name:'Close save dialog',exact:true}).click();const dialog=await files(page);await choose(dialog,'{"schema":"neuroatlas-project-v2","volumes":"BROKEN"}');await expect(dialog.getByRole('button',{name:'Confirm open',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();const after=await exported(page);expect(after.projectId).toBe(before.projectId);expect(after.notes).toEqual(before.notes);expect(after.evidence).toEqual(before.evidence);expect(after.volumes).toEqual(before.volumes);
});

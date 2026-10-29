import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {migrateEvidence} from '../../src/lib/evidence-schema.js';
import {validateViewState,serializeProject} from '../../src/lib/workspace-project.js';

// Authored for isolated CI only. No desktop/browser execution is claimed by X5.
const key='neuroatlas-workspace-current-v1';
const finding=id=>({id,referenceId:'x5-paper',finding:`Synthetic ${id}`,condition:'task A versus B',sample:'n=1 synthetic',roiDefinition:'source ROI',direction:'positive',annotator:'test fixture',modalities:['fmri'],regionIds:[],sourceUrl:'https://example.org/x5',curationStatus:'draft',limitations:'synthetic only',coordinates:[{id:`${id}-coord`,x:1,y:2,z:3,space:'MNI-unspecified',status:'draft',label:'peak',sourceTable:'Table 1',sourceRow:id,frameNote:'unknown template variant',sourceUrl:'https://example.org/x5'}],figures:[]});
const evidence=migrateEvidence({schema:'brain-evidence-v1',references:[{id:'x5-paper',title:'Synthetic X5 local paper',authors:'Fixture',year:2026,url:'https://example.org/x5'}],results:[finding('x5-r1'),finding('x5-r2')],relations:[{id:'x5-relation',fromResultId:'x5-r1',toResultId:'x5-r2',type:'complementary',rationale:'Different synthetic conditions',annotator:'test fixture',sourceUrl:'https://example.org/x5'}]}).value;
const initial={schema:key,projectId:'X5-A',revision:0,notes:[],evidence,drafts:[],view:validateViewState({language:'en',mode:'research',literature:{paperId:'x5-paper',compared:[],query:'',scope:false}})};
const work=page=>page.getByRole('region',{name:'Literature workspace'});
const editor=page=>work(page).locator('.evidence-editor');
const textInput=page=>editor(page).locator('textarea').first();
async function setup(page){await page.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));},{key,initial});await page.goto('/?lang=en&mode=research');await expect(work(page).getByRole('button',{name:'Add finding',exact:true})).toBeVisible();}
async function startDraft(page,text){await work(page).getByRole('button',{name:'Add finding',exact:true}).click();await textInput(page).fill(text);}
async function resume(page,text){await work(page).getByRole('button',{name:`Resume draft: ${text}`,exact:true}).click();await expect(textInput(page)).toHaveValue(text);}

test('half a finding survives filter, Anatomy/Evidence library and refresh with stable draft identity',async({page})=>{
 await setup(page);const text='Half entered finding, unchanged across views';await startDraft(page,text);
 await work(page).getByRole('textbox',{name:'Search papers, authors or regions'}).fill('different filter');await expect(editor(page)).toHaveCount(0);await resume(page,text);
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Anatomy',exact:true}).click();
 await page.getByRole('button',{name:'Evidence library',exact:true}).click();await resume(page,text);
 const id=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drafts[0].recordId,key);
 await page.reload();await resume(page,text);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drafts[0].recordId,key)).toBe(id);
 await expect(editor(page).getByRole('combobox',{name:'Curation status',exact:true})).toHaveValue('draft');
});

test('quota failure keeps editing and prevents destructive leave; retry and discard clear dirty state',async({page})=>{
 await setup(page);await page.evaluate(()=>{const original=Storage.prototype.setItem;window.__x5Quota=true;Storage.prototype.setItem=function(name,value){if(name==='neuroatlas-workspace-current-v1'&&window.__x5Quota)throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,name,value);};});
 const text='Keep my incomplete finding';await startDraft(page,text);await expect(editor(page).getByRole('alert')).toContainText('Browser storage is full');await expect(textInput(page)).toHaveValue(text);
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Anatomy',exact:true}).click();await expect(textInput(page)).toHaveValue(text);
 await page.evaluate(()=>{window.__x5Quota=false;});await textInput(page).fill(text+' retry');await expect(editor(page).getByRole('status')).toHaveText('Draft saved');
 await editor(page).getByRole('button',{name:'Discard this draft',exact:true}).click();await expect(editor(page)).toHaveCount(0);await expect(work(page).getByRole('button',{name:/Resume draft:/})).toHaveCount(0);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drafts,key)).toEqual([]);
});

test('saving formal metadata removes only its draft in the same durable publication',async({page})=>{
 await setup(page);await work(page).getByRole('button',{name:'Add paper',exact:true}).click();await editor(page).getByLabel('Title',{exact:true}).fill('X5 newly saved paper');await editor(page).getByLabel('Source URL',{exact:true}).fill('https://example.org/new');await expect(editor(page).getByRole('status')).toHaveText('Draft saved');
 await editor(page).getByRole('button',{name:'Save to local evidence',exact:true}).click();await expect(editor(page)).toHaveCount(0);
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);expect(stored.drafts).toEqual([]);expect(stored.evidence.references.some(r=>r.title==='X5 newly saved paper')).toBe(true);
});

test('one deletion preview and undo restore the paper, structured findings, relations and artifacts',async({page})=>{
 await setup(page);const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).evidence,key);
 await work(page).getByRole('button',{name:'Remove local paper and its findings',exact:true}).click();const preview=work(page).getByRole('region',{name:'Deletion impact'});await expect(preview).toContainText('results: 2');await expect(preview).toContainText('relations: 1');await preview.getByRole('button',{name:'Confirm removal',exact:true}).click();
 await expect(work(page).locator('.evidence-result')).toHaveCount(0);await work(page).locator('summary').filter({hasText:'Recent actions'}).click();await work(page).getByRole('button',{name:'Undo: Synthetic X5 local paper',exact:true}).click();await expect(work(page).locator('.evidence-result')).toHaveCount(2);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).evidence,key)).toEqual(before);
});

test('failed imports preserve current draft; successful project replacement clears editor and undo ownership',async({page})=>{
 await setup(page);const text='Only belongs to project A';await startDraft(page,text);await expect(editor(page).getByRole('status')).toHaveText('Draft saved');
 await page.getByRole('button',{name:'Projects & views',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Save and share',exact:true});const input=dialog.locator('input[type=file]');
 await input.setInputFiles({name:'bad.neuroatlas',mimeType:'application/json',buffer:Buffer.from('{')});await expect(dialog.getByRole('status').last()).not.toHaveText('');await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();await expect(textInput(page)).toHaveValue(text);
 await page.getByRole('button',{name:'Projects & views',exact:true}).click();await input.setInputFiles({name:'B.neuroatlas',mimeType:'application/json',buffer:Buffer.from(await serializeProject({projectId:'X5-B',view:initial.view,evidence,notes:[],drafts:[],volumes:[]}))});await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 await expect(editor(page)).toHaveCount(0);await expect(work(page).getByRole('button',{name:/Resume draft:/})).toHaveCount(0);await expect(work(page).getByRole('button',{name:/^Undo:/})).toHaveCount(0);
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);expect(stored.projectId).toBe('X5-B');expect(stored.drafts).toEqual([]);
});

test('project export admits the current draft before its delayed autosave timer fires',async({page})=>{
 await setup(page);
 // Hold only the 300 ms autosave timer to make the pre-debounce window deterministic.
 await page.evaluate(()=>{const original=window.setTimeout;window.setTimeout=function(callback,delay,...args){return original.call(this,callback,delay===300?60000:delay,...args);};});
 const text='Pending before debounce must be exported';await startDraft(page,text);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drafts.length,key)).toBe(0);
 await page.getByRole('button',{name:'Projects & views',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Save and share',exact:true});await dialog.getByRole('button',{name:'Export project',exact:true}).click();await expect(dialog.getByRole('button',{name:'Confirm download',exact:true})).toBeVisible();
 const downloaded=page.waitForEvent('download');await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const payload=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));expect(payload.drafts).toHaveLength(1);expect(payload.drafts[0].payload.finding).toBe(text);
});

test('project export refuses an oversized failed autosave and preserves the current editor',async({page})=>{
 await setup(page);const text='x'.repeat(50021);await startDraft(page,text);await expect(editor(page).getByRole('alert')).toContainText('The draft is too large to save');
 const downloads=[];page.on('download',download=>downloads.push(download));await page.getByRole('button',{name:'Projects & views',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Save and share',exact:true});await dialog.getByRole('button',{name:'Export project',exact:true}).click();await expect(dialog.getByRole('alert').last()).toContainText('The draft is too large to save');await expect(dialog.getByRole('button',{name:'Confirm download',exact:true})).toHaveCount(0);expect(downloads).toHaveLength(0);
 await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();await expect(textInput(page)).toHaveValue(text);
});

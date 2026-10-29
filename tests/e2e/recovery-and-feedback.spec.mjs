// Authored for isolated CI only. X8 does not execute a browser or claim desktop acceptance.
import {test,expect} from '@playwright/test';
import {serializeProject} from '../../src/lib/workspace-project.js';
import {buildEvidencePackage,getBuiltinEvidenceBundle} from '../../src/lib/evidence-package.js';
import {mergeEvidence} from '../../src/lib/evidence-workspace.js';
import {emptyEvidence} from '../../src/lib/evidence-schema.js';

const key='neuroatlas-workspace-current-v1';
const work=page=>page.getByRole('region',{name:'Literature workspace'});
const durable=page=>page.evaluate(key=>localStorage.getItem(key),key);
const upload=(locator,text,name='fixture.json')=>locator.setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
const paper={id:'x8-private-paper',title:'X8 private title',authors:'Fixture',year:2026,url:'https://example.org/x8'};
const image={id:'custom-x8-retained',name:'X8 retained image',kind:'label',space:'native-unverified',data:Uint8Array.of(7),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],labels:[]};
const draft={id:'draft-x8',projectId:'X8',kind:'paper',recordId:paper.id,payload:{...paper,title:'Retained draft text'},updatedAt:'2026-10-30T00:00:00.000Z'};
async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function localProject(page){
  const evidence={...emptyEvidence(),references:[paper]};
  const text=await serializeProject({projectId:'X8',view:{language:'en',atlas:'dk',coordinateSpace:'private-x8-frame',coordinate:[1.25,2.5,3.75],coordinateOrigin:{kind:'private',explorerSensitive:true},atlasExplorer:{atlas:'dk',slicePoint:[7,8,9]},literature:{paperId:paper.id,compared:[paper.id]}},evidence,notes:[{id:'note-x8',text:'Retained private note'}],drafts:[draft],volumes:[image],roiSnapshot:{id:'historic-x8',manifest:null,metrics:{dice:.42}}});
  const dialog=await files(page);await upload(dialog.locator('input[type=file]'),text,'x8.neuroatlas');await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();return dialog;
}

test('mounted ROI consumers recover from first manifest failure when resource identity appears at generation zero, retaining A and B',async({page})=>{
  let manifests=0;
  await page.route('**/data/manifest.json',route=>++manifests===1?route.fulfill({status:503,body:'synthetic first manifest failure'}):route.continue());
  // Isolated component fixture: the actual ROICompare stays mounted with the
  // same selected A/B props while manifest metadata changes from null to ready.
  // This deliberately avoids App's later project-restore remount masking I1.
  await page.route('**/src/App.jsx',route=>route.fulfill({contentType:'application/javascript',body:`
    import React,{useEffect,useState} from '/node_modules/.vite/deps/react.js';
    import ROICompare from '/src/components/ROICompare.jsx';
    import {MAIN_MANIFEST_RESOURCE,resourceValue,retry,getResourceState,atlasResourceKey} from '/src/lib/atlas-resource.js';
    import {atlasIdentityFor} from '/src/lib/volume.js';
    const initial={aAtlas:'dk',aLabels:[2,3],bAtlas:'ba-histology',bLabels:[14],computed:false,snapshot:'none'};
    export default function Fixture(){
      const [manifest,setManifest]=useState(null),[failed,setFailed]=useState(false);
      useEffect(()=>{resourceValue(MAIN_MANIFEST_RESOURCE).then(setManifest).catch(()=>setFailed(true));},[]);
      const recover=async()=>{await retry(MAIN_MANIFEST_RESOURCE);const value=await resourceValue(MAIN_MANIFEST_RESOURCE);window.__x8SourceGenerations=['dk','ba-histology'].map(id=>getResourceState(atlasResourceKey(atlasIdentityFor(value.atlases[id]))).generation);setManifest(value);setFailed(false);};
      return React.createElement(React.Fragment,null,
        failed&&React.createElement('button',{onClick:recover},'Retry manifest fixture'),
        React.createElement(ROICompare,{language:'en',manifest,initialState:initial,workspaceProjectId:'X8-mounted',workspaceEpoch:0,onStateChange:state=>{window.__x8MountedROI=state;}}));
    }
  `}));
  await page.goto('/?lang=en&mode=roi');
  await expect.poll(()=>page.evaluate(()=>window.__x8MountedROI?.aLabels)).toEqual([2,3]);
  await expect.poll(()=>page.evaluate(()=>window.__x8MountedROI?.bLabels)).toEqual([14]);
  await page.getByRole('button',{name:'Retry manifest fixture',exact:true}).click();
  expect(await page.evaluate(()=>window.__x8SourceGenerations)).toEqual([0,0]);
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['2','3']);
  await expect(page.getByLabel('ROI B label',{exact:true})).toHaveValues(['14']);
  await expect(page.getByLabel('ROI A label',{exact:true})).toBeEnabled();await expect(page.getByLabel('ROI B label',{exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Compute ROI overlap',exact:true})).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);expect(manifests).toBe(2);
});

test('successful undo preserves user paper titles containing Quota and Unexpected verbatim',async({page})=>{
  await page.goto('/?lang=en&mode=research');const library=work(page);
  for(const title of ['Quota study','Unexpected observations']){
    await library.getByRole('button',{name:'Add paper',exact:true}).click();const editor=library.locator('.evidence-editor');
    await editor.getByRole('textbox',{name:'Title',exact:true}).fill(title);await editor.getByRole('textbox',{name:'Source URL',exact:true}).fill('https://example.org/title');
    await editor.getByRole('button',{name:'Save to local evidence',exact:true}).click();await expect(editor).toHaveCount(0);
    await expect.poll(async()=>JSON.parse(await durable(page)).evidence.references.some(row=>row.title===title)).toBe(true);
    const history=library.locator('details').filter({has:page.locator('summary').filter({hasText:'Recent actions'})});await history.locator('summary').click();
    await history.getByRole('button',{name:`Undo: ${title}`,exact:true}).click();
    await expect(page.locator('.toast')).toHaveText(`Undone: ${title}`);
    expect(JSON.parse(await durable(page)).evidence.references.some(row=>row.title===title)).toBe(false);
    await expect(page.locator('.toast')).not.toContainText('Browser storage is full');await expect(page.locator('.toast')).not.toContainText('valid project JSON');
  }
});

test('structured baseline, matching denominator and clearing filters stay distinct in both languages',async({page})=>{
  await page.goto('/?lang=en&mode=research');const library=work(page);
  await expect(library.locator('[data-evidence-counts]')).toContainText('3 papers · 4 findings · 8 coordinates');
  await expect(library.locator('[data-evidence-counts]')).toContainText('118 bibliographic records');
  await library.getByRole('textbox',{name:'Search papers, authors or regions'}).fill('x8-no-such-query');
  await expect(library.locator('.literature-toolbar')).toContainText('Matching: 0 papers · 0 findings · 0 coordinates');
  await library.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(library.locator('.paper-card')).toHaveCount(118);
  await page.getByRole('button',{name:'切换为中文',exact:true}).click();await expect(page.locator('[data-evidence-counts]')).toContainText('3 篇论文 · 4 条结果 · 8 个坐标');
});

test('first manifest failure and single atlas failure recover using Retry while full local project remains intact',async({page})=>{
  let manifests=0,atlases=0;
  await page.route('**/data/manifest.json',route=>++manifests===1?route.fulfill({status:503,body:'synthetic failure'}):route.continue());
  await page.route('**/data/ba-v2/talairach-ba.bin',route=>++atlases===1?route.fulfill({status:503,body:'synthetic atlas failure'}):route.continue());
  await page.goto('/?lang=en');
  await page.locator('.slice-error').getByRole('button',{name:'Retry data loading',exact:true}).first().click();
  await expect(page.getByLabel('Choose an atlas',{exact:true})).toBeEnabled();
  const dialog=await localProject(page);await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
  await page.getByRole('navigation',{name:'Research tasks',exact:true}).getByRole('button',{name:'Enter coordinates',exact:true}).click();const nav=page.getByRole('group',{name:'Main coordinate navigation',exact:true});await nav.getByLabel('Reference space',{exact:true}).fill('MNI152NLin6Asym');await nav.getByLabel('Coordinates (mm)',{exact:true}).fill('1.25,2.5,3.75');await nav.getByRole('button',{name:'Go to coordinate',exact:true}).click();
  await page.getByLabel('Choose an atlas',{exact:true}).selectOption('ba-histology');
  const retryButton=page.locator('.slice-error').getByRole('button',{name:'Retry data loading',exact:true}).first();await expect(retryButton).toBeVisible();await retryButton.click();
  await expect(page.locator('.voxel-info')).toHaveAttribute('data-query-status','ready');expect(atlases).toBe(2);
  const saved=JSON.parse(await durable(page));expect(saved.drafts[0].payload.title).toBe('Retained draft text');expect(saved.notes[0].text).toBe('Retained private note');
  const reopened=await files(page);await expect(reopened.locator('[data-asset-id="custom-x8-retained"]')).toHaveCount(1);
});

test('public-link omission feedback is specific without private text and full download preview equals actual staged bytes',async({page})=>{
  await page.goto('/?lang=en');const dialog=await localProject(page);
  await dialog.getByRole('button',{name:'Copy view link',exact:true}).click();
  const status=dialog.getByRole('status').filter({hasText:'Omitted:'});await expect(status).toContainText('local reading selections');await expect(status).toContainText('positions');await expect(status).toContainText('full local project file');
  await expect(status).not.toContainText(paper.id);await expect(status).not.toContainText(paper.title);await expect(status).not.toContainText('Retained draft text');
  await dialog.getByRole('button',{name:'Export project',exact:true}).click();
  const preview=dialog.getByRole('region',{name:'Asset action preview'}),text=await preview.innerText();
  const bytes=Number(text.match(/Project download: ([\d,]+) bytes/)[1].replaceAll(',',''));expect(bytes).toBeGreaterThan(0);
  await expect(preview).toContainText('1 images');await expect(preview).toContainText('raw image bytes');
  const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const stream=await(await event).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const actual=Buffer.concat(chunks);expect(actual.byteLength).toBe(bytes);
  const restored=JSON.parse(actual.toString());expect(restored.roiSnapshot.metrics.dice).toBe(.42);expect(restored.drafts[0].payload.title).toBe('Retained draft text');expect(restored.volumes[0].id).toBe(image.id);
});

test('failed title-conflict import removes previous success feedback and preserves exact saved evidence',async({page})=>{
  await page.goto('/?lang=en&mode=research');const library=work(page),evidence={...emptyEvidence(),references:[paper]};
  await upload(library.locator('input[type=file]'),JSON.stringify(evidence));await expect(library.getByRole('status')).toContainText('Imported 1 papers');const before=await durable(page);
  const original=buildEvidencePackage({paperIds:['axelrod2015'],bundle:getBuiltinEvidenceBundle()}),base={...emptyEvidence(),references:original.references.map(row=>({...row,id:'x8-canonical-axelrod'}))};
  const conflicting=buildEvidencePackage({paperIds:['x8-canonical-axelrod'],bundle:mergeEvidence(base,original),includePrivate:true});conflicting.references[0].title+=' changed before returning to original library';
  await upload(library.locator('input[type=file]'),JSON.stringify(conflicting));
  await expect(library.getByRole('alert')).toContainText('title conflicts');await expect(library.getByRole('status').filter({hasText:'Imported 1 papers'})).toHaveCount(0);expect(await durable(page)).toBe(before);
});

test('native quota failure gives one contextual editor error and retains the complete draft until retry',async({page})=>{
  await page.goto('/?lang=en&mode=research');const library=work(page);await library.getByRole('button',{name:'Add paper',exact:true}).click();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;window.__x8Quota=true;Storage.prototype.setItem=function(key,value){if(key==='neuroatlas-workspace-current-v1'&&window.__x8Quota)throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value);};});
  const editor=library.locator('.evidence-editor');await editor.getByRole('textbox',{name:'Title',exact:true}).fill('Retain every letter after quota failure');
  await expect(editor.getByRole('alert')).toHaveCount(1);await expect(editor.getByRole('alert')).toContainText('Browser storage is full');await expect(editor.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Retain every letter after quota failure');
  await page.evaluate(()=>{window.__x8Quota=false;});const dialog=await files(page);await dialog.getByRole('button',{name:'Retry saving drafts',exact:true}).click();await expect(dialog.getByRole('alert')).toHaveCount(0);
  expect(JSON.parse(await durable(page)).drafts[0].payload.title).toBe('Retain every letter after quota failure');
});

test('computation cancellation retains chosen labels and durable project while late worker messages cannot publish',async({page})=>{
  await page.goto('/?lang=en&mode=roi');
  for(const side of ['A','B']){await page.getByLabel(`ROI ${side} atlas`,{exact:true}).selectOption('aal3-registered');const labels=page.getByLabel(`ROI ${side} label`,{exact:true});await expect(labels.locator('option[value="134"]')).toHaveCount(1);await labels.selectOption('134');}
  // Delay only synthetic runner worker delivery so the cancellation boundary is deterministic.
  await page.evaluate(()=>{const Original=window.Worker;window.Worker=class extends Original{addEventListener(type,callback,...args){return super.addEventListener(type,type==='message'?event=>setTimeout(()=>callback(event),500):callback,...args);}set onmessage(callback){super.onmessage=callback?event=>setTimeout(()=>callback(event),500):null;}};});
  const before=await durable(page);await page.getByRole('button',{name:'Compute ROI overlap',exact:true}).click();await page.getByRole('button',{name:'Cancel ROI computation',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Computation cancelled.'})).toBeVisible();for(const side of ['A','B'])await expect(page.getByLabel(`ROI ${side} label`,{exact:true})).toHaveValues(['134']);
  await expect(page.locator('.roi-result')).toHaveCount(0);expect(await durable(page)).toBe(before);
});

test('overlong escaped reference is rejected before navigation and input remains editable',async({page})=>{
  await page.goto('/?lang=en');await page.getByRole('navigation',{name:'Research tasks',exact:true}).getByRole('button',{name:'Enter coordinates',exact:true}).click();
  const nav=page.getByRole('group',{name:'Main coordinate navigation',exact:true}),reference='independent:'+'"'.repeat(480),before=await nav.locator('output.coordinate-current').innerText();
  await nav.getByLabel('Reference space',{exact:true}).fill(reference);await nav.getByLabel('Coordinates (mm)',{exact:true}).fill('1.25,2.5,3.75');await nav.getByRole('button',{name:'Go to coordinate',exact:true}).click();
  await expect(nav.getByRole('alert')).toContainText('too long to save completely');await expect(nav.getByLabel('Reference space',{exact:true})).toHaveValue(reference);await expect(nav.locator('output.coordinate-current')).toHaveText(before);
});

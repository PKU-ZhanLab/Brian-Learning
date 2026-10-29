// Isolated, synthetic runner only. Authored here; browser/upload execution awaits
// the coordinator's permission path and is not desktop acceptance.
import {test,expect} from '@playwright/test';
import {OrthographicCamera,Vector3} from 'three';
import {serializeProject} from '../../src/lib/workspace-project.js';
import {syntheticResultEvidence as evidence,syntheticResultLayers as layers,syntheticUnknownResultEvidence,syntheticMixedResultEvidence,preflightResultLayerProject} from '../fixtures/result-layer-fixtures.mjs';
import {curatedEvidence} from '../../src/data/results.js';

async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function open(dialog,text){await preflightResultLayerProject(text);await dialog.locator('input[type=file]').setInputFiles({name:'synthetic.neuroatlas',mimeType:'application/json',buffer:Buffer.from(text)});await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();}
const storage=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])));
const snapshot=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')));
const resolved=page=>page.evaluate(async()=>{const {resolveResultLayers}=await import('/src/lib/result-layers.js');const s=JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1'));return resolveResultLayers(s.view.resultLayers,{evidence:s.evidence});});

test('two points and a hidden layer survive named-view and local-project restoration with their source identities',async({page})=>{
 await page.goto('/?lang=en');let dialog=await files(page);const original=layers();await open(dialog,await serializeProject({projectId:'synthetic-layers',view:{language:'en',resultLayers:original},evidence:evidence(),volumes:[]}));
 expect((await snapshot(page)).view.resultLayers).toEqual(original);let markers=(await resolved(page)).markers;expect(markers.map(m=>m.position)).toEqual([[1,2,3],[-1,2,3]]);expect(markers.every(m=>m.sourceReferenceId==='private-paper')).toBe(true);
 await dialog.getByRole('textbox',{name:'View name'}).fill('Two points and hidden layer');await dialog.getByRole('button',{name:'Save view',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-saved-views')));expect(saved[0].view.resultLayers).toEqual(original);expect(saved[0].projectId).toBe('synthetic-layers');
 await dialog.getByRole('button',{name:'Two points and hidden layer'}).click();await expect(dialog).not.toBeVisible();await page.reload();expect((await snapshot(page)).view.resultLayers).toEqual(original);expect((await resolved(page)).markers.map(m=>m.position)).toEqual([[1,2,3],[-1,2,3]]);
 dialog=await files(page);const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Export project',exact:true}).click();await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const artifact=await download,stream=await artifact.createReadStream(),parts=[];for await(const part of stream)parts.push(part);const exported=JSON.parse(Buffer.concat(parts).toString('utf8'));expect(exported.view.resultLayers).toEqual(original);await open(dialog,JSON.stringify(exported));expect((await snapshot(page)).view.resultLayers).toEqual(original);
});

test('public links omit local result contents and missing-coordinate named restore retains dialog, input and storage',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/?lang=en');const dialog=await files(page);await open(dialog,await serializeProject({projectId:'synthetic-private',view:{language:'en',resultLayers:layers()},evidence:evidence(),volumes:[]}));
 await dialog.getByRole('button',{name:'Copy view link',exact:true}).click();const url=await page.evaluate(()=>navigator.clipboard.readText()),encoded=new URLSearchParams(new URL(url).hash.slice(1)).get('view');const decoded=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));expect(decoded.resultLayers).toEqual([]);expect(JSON.stringify(decoded)).not.toMatch(/private-result|private-layer-name|private-point|private-paper/);
 await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1'));const bad=structuredClone(s.view);bad.resultLayers[0].coordinateIds=['missing-coordinate'];localStorage.setItem('neuroatlas-saved-views',JSON.stringify([{id:'bad-view',name:'Broken synthetic view',projectId:s.projectId,createdAt:new Date().toISOString(),view:bad}]));});
 const next=await files(page);await next.getByRole('textbox',{name:'View name'}).fill('Unfinished name');const before=await storage(page);await next.getByRole('button',{name:'Broken synthetic view'}).click();await expect(next).toBeVisible();await expect(next.getByRole('status')).toContainText('invalid-coordinate-reference');await expect(next.getByRole('textbox',{name:'View name'})).toHaveValue('Unfinished name');expect(await storage(page)).toEqual(before);
});

test('a bundled public result restores stable public references while preserving its unavailable source frame',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);const result=curatedEvidence.results[0],locations=curatedEvidence.locations.filter(l=>result.locationIds.includes(l.id)),spaceId=locations[0].sourceSpaceId,layer={layerId:'private-user-chosen-layer-name',resultId:result.id,sourceReferenceId:result.referenceId,coordinateIds:locations.filter(l=>l.sourceSpaceId===spaceId).map(l=>l.id),spaceId,visible:false,style:{color:'#123456',opacity:.5,size:2}};
 await page.goto('/?lang=en');const dialog=await files(page);await open(dialog,await serializeProject({projectId:'synthetic-public-view',view:{language:'en',resultLayers:[layer]},evidence:null,volumes:[]}));await dialog.getByRole('button',{name:'Copy view link',exact:true}).click();const url=await page.evaluate(()=>navigator.clipboard.readText()),encoded=new URLSearchParams(new URL(url).hash.slice(1)).get('view'),decoded=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));expect(decoded.resultLayers).toEqual([{...layer,layerId:'public-layer-1'}]);expect(JSON.stringify(decoded)).not.toContain('private-user-chosen-layer-name');
 await open(dialog,await serializeProject({projectId:'independent-public-destination',view:{language:'en'},evidence:null,volumes:[]}));await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();await page.goto(url);await expect.poll(async()=>(await snapshot(page))?.view.resultLayers).toEqual(decoded.resultLayers);expect((await snapshot(page)).projectId).toBe('independent-public-destination');
 const restored=await page.evaluate(async()=>{const {resolveResultLayers}=await import('/src/lib/result-layers.js'),{curatedEvidence}=await import('/src/data/results.js'),s=JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1'));return resolveResultLayers(s.view.resultLayers,{evidence:s.evidence,publicEvidence:curatedEvidence});});expect(restored.markers).toEqual([]);expect(restored.unavailable.every(u=>u.reason==='unavailable-space')).toBe(true);
});

test('named view ownership rejects A to B reused-ID substitution and unknown-origin layer views without changing dialog or storage',async({page})=>{
 await page.goto('/?lang=en');let dialog=await files(page);await open(dialog,await serializeProject({projectId:'A',view:{language:'en',resultLayers:layers()},evidence:evidence(),volumes:[]}));
 await dialog.getByRole('textbox',{name:'View name'}).fill('A coordinates');await dialog.getByRole('button',{name:'Save view',exact:true}).click();
 const independent=evidence();independent.locations[0].xyz=[99,2,3];await open(dialog,await serializeProject({projectId:'B',view:{language:'en'},evidence:independent,volumes:[]}));
 await dialog.getByRole('textbox',{name:'View name'}).fill('Unfinished B view');const before=await storage(page);await dialog.getByRole('button',{name:'A coordinates'}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('status')).toContainText('named-view-project-mismatch');await expect(dialog.getByRole('textbox',{name:'View name'})).toHaveValue('Unfinished B view');expect(await storage(page)).toEqual(before);expect((await snapshot(page)).evidence.locations[0].xyz).toEqual([99,2,3]);
 await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('neuroatlas-saved-views'));delete saved[0].projectId;localStorage.setItem('neuroatlas-saved-views',JSON.stringify(saved));});
 dialog=await files(page);await dialog.getByRole('textbox',{name:'View name'}).fill('Still unfinished');const unknownBefore=await storage(page);await dialog.getByRole('button',{name:'A coordinates'}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('status')).toContainText('named-view-project-mismatch');await expect(dialog.getByRole('textbox',{name:'View name'})).toHaveValue('Still unfinished');expect(await storage(page)).toEqual(unknownBefore);
});

test('visiting paper B retains layer A and a real brain point returns to A’s exact finding and source',async({page})=>{
 const local=evidence();local.references.push({id:'other-paper',title:'Synthetic unrelated paper B',url:'https://example.org/b'});
 local.reviewEvents.push({...local.reviewEvents[0],id:'synthetic-result-check',subjectId:'private-result',recordVersion:'legacy-v1',scope:'Synthetic fixture only; not a scientific source audit'});
 await page.goto('/?lang=en');const dialog=await files(page);
 await open(dialog,await serializeProject({projectId:'source-return',view:{language:'en',mode:'research',atlas:'dk',visibleCategories:['cortex'],opacity:.2,layout:{preset:'evidence',panels:{modelWidth:440,active:'evidence'}},literature:{paperId:'private-paper'},camera:{position:[1,202,83],target:[1,2,3],up:[0,0,1],zoom:1,frameExtent:100},resultLayers:[]},evidence:local,volumes:[]}));
 await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 await page.getByRole('button',{name:'View reported result coordinates',exact:true}).click();await page.getByRole('dialog',{name:'Paper result coordinates',exact:true}).getByRole('button',{name:'Save layer and show on brain',exact:true}).click();
 await expect.poll(async()=>(await snapshot(page)).view.resultLayers.length).toBe(1);const original=(await snapshot(page)).view.resultLayers;expect(original[0].resultId).toBe('private-result');expect(original[0].coordinateIds).toEqual(['private-point-0','private-point-1']);
 await page.getByRole('button',{name:'Back to papers',exact:true}).click();await page.locator('[data-reference-id="other-paper"] .paper-open').click();
 await expect(page.locator('.paper-detail h2')).toHaveText('Synthetic unrelated paper B');
 const bar=page.locator('.result-layer-bar');await expect(bar).toContainText('private-result');await expect(bar).toContainText('Synthetic local paper');expect((await snapshot(page)).view.resultLayers).toEqual(original);
 const canvas=page.locator('.scene-wrap canvas').first();await expect(canvas).toBeVisible();const bounds=await canvas.boundingBox();await canvas.click({position:{x:bounds.width/2,y:bounds.height/2}});
 const panel=page.getByRole('dialog',{name:'Paper result coordinates',exact:true});await expect(panel.locator('[data-result-id="private-result"]')).toBeVisible();await expect(panel).toContainText('Synthetic local result');await expect(panel).toContainText('Synthetic local paper');
 await panel.getByRole('button',{name:'Locate result point private-point-0',exact:true}).click();await expect(panel.locator('tr[aria-selected="true"]')).toContainText('private-point-0');
 await panel.getByRole('button',{name:'Open source paper',exact:true}).click();await expect(page.locator('.paper-detail h2')).toHaveText('Synthetic local paper');await expect(panel.locator('[data-result-id="private-result"]')).toBeVisible();
 await panel.getByRole('button',{name:'Close result coordinates',exact:true}).click();
 await bar.getByRole('button',{name:`Hide layer ${original[0].layerId}`,exact:true}).click();await expect.poll(async()=>(await snapshot(page)).view.resultLayers[0].visible).toBe(false);expect((await snapshot(page)).view.atlas).toBe('dk');
 await bar.getByRole('button',{name:`Show layer ${original[0].layerId}`,exact:true}).click();await expect.poll(async()=>(await resolved(page)).markers.length).toBe(2);
});

test('clearing layers after selecting a private point preserves source restrictions in the shared view',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/?lang=en');let dialog=await files(page);
 await open(dialog,await serializeProject({projectId:'private-clear',view:{language:'en',atlas:'aal3-registered',resultLayers:layers()},evidence:evidence(),volumes:[]}));await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 await page.getByRole('button',{name:'Open result private-result',exact:true}).first().click();const panel=page.getByRole('dialog',{name:'Paper result coordinates',exact:true});await panel.getByRole('button',{name:'Locate result point private-point-0',exact:true}).click();await panel.getByRole('button',{name:'Close result coordinates',exact:true}).click();
 await page.getByRole('button',{name:'Clear result layers',exact:true}).click();await expect.poll(async()=>(await snapshot(page)).view.resultLayers).toEqual([]);const current=(await snapshot(page)).view;expect(current.atlas).toBe('aal3-registered');expect(current.coordinateOrigin.resultId).toBe('private-result');expect(current.coordinateOrigin.cameraSensitive).toBe(true);expect(current.coordinateOrigin.explorerSensitive).toBe(true);
 dialog=await files(page);await dialog.getByRole('button',{name:'Copy view link',exact:true}).click();const url=await page.evaluate(()=>navigator.clipboard.readText()),encoded=new URLSearchParams(new URL(url).hash.slice(1)).get('view'),shared=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
 expect(shared.resultLayers).toEqual([]);expect(shared.camera).toBe(null);expect(shared.coordinate).not.toEqual([1,2,3]);expect(JSON.stringify(shared)).not.toMatch(/private-result|private-point|private-paper/);
});

test('native and unknown frames expose source coordinates without a main brain overlay action',async({page})=>{
 const local=syntheticUnknownResultEvidence();
 await page.goto('/?lang=en');const dialog=await files(page);await open(dialog,await serializeProject({projectId:'unknown-frame',view:{language:'en',resultLayers:[{...layers()[0],spaceId:'MNI-unspecified'}]},evidence:local,volumes:[]}));await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 await expect(page.locator('.result-layer-bar')).toContainText('Independent coordinates');await page.getByRole('button',{name:'Open result private-result',exact:true}).click();const panel=page.getByRole('dialog',{name:'Paper result coordinates',exact:true});await expect(panel).toContainText('MNI-unspecified');await expect(panel.getByRole('button',{name:'Save layer and show on brain',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Save result layer',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Locate result point private-point-0',exact:true})).toBeVisible();
});

test('compact layer disclosure keeps source, visibility, removal and clear controls reachable without color',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?lang=en');const dialog=await files(page);await open(dialog,await serializeProject({projectId:'compact-layer-controls',view:{language:'en',resultLayers:layers()},evidence:evidence(),volumes:[]}));await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 const bar=page.locator('.result-layer-bar');await expect(bar).not.toHaveAttribute('open');await expect(bar.locator('summary')).toContainText('private-result');await bar.locator('summary').click();
 for(const name of ['Hide layer private-layer-name','Open result private-result','Remove layer private-layer-name','Clear result layers']){const control=bar.getByRole('button',{name,exact:true}).first();await expect(control).toBeVisible();const rect=await control.boundingBox();expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(390);}
 await bar.getByRole('button',{name:'Remove layer private-layer-name',exact:true}).click();await expect.poll(async()=>(await snapshot(page)).view.resultLayers.map(l=>l.layerId)).toEqual(['hidden-private-layer']);await bar.getByRole('button',{name:'Clear result layers',exact:true}).click();await expect(bar).toHaveCount(0);
});

test('a mixed-space marker opens its own MNI frame and selected point, updates for the next marker, and survives source return',async({page})=>{
 const local=syntheticMixedResultEvidence();
 const original=[{...layers()[0],style:{color:'#123456',opacity:1,size:6}}],camera={position:[1,202,83],target:[1,2,3],up:[0,0,1],zoom:1,frameExtent:100};
 await page.goto('/?lang=en');const dialog=await files(page);await open(dialog,await serializeProject({projectId:'mixed-space-point-return',view:{language:'en',mode:'anatomy',atlas:'dk',visibleCategories:['cortex'],opacity:.2,camera,resultLayers:original},evidence:local,volumes:[]}));await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();
 const canvas=page.locator('.scene-wrap canvas').first();await expect(canvas).toBeVisible();const bounds=await canvas.boundingBox();await canvas.click({position:{x:bounds.width/2,y:bounds.height/2}});
 const panel=page.getByRole('dialog',{name:'Paper result coordinates',exact:true});await expect(panel.getByRole('combobox',{name:'Reported coordinate frame',exact:true})).toHaveValue('1');await expect(panel.locator('tr[aria-selected="true"]')).toContainText('private-point-0');await expect(panel.getByRole('button',{name:'Locate result point private-native-point',exact:true})).toHaveCount(0);
 const aspect=bounds.width/bounds.height,projection=new OrthographicCamera(-100*aspect,100*aspect,100,-100,.1,2000);projection.position.fromArray(camera.position);projection.up.fromArray(camera.up);projection.lookAt(new Vector3(...camera.target));projection.updateMatrixWorld();const screen=new Vector3(-1,2,3).project(projection);
 await canvas.click({position:{x:(screen.x*.5+.5)*bounds.width,y:(-.5*screen.y+.5)*bounds.height}});await expect(panel.locator('tr[aria-selected="true"]')).toContainText('private-point-1');
 await panel.getByRole('button',{name:'Open source paper',exact:true}).click();await expect(page.locator('.paper-detail h2')).toHaveText('Synthetic local paper');await expect(panel.getByRole('combobox',{name:'Reported coordinate frame',exact:true})).toHaveValue('1');await expect(panel.locator('tr[aria-selected="true"]')).toContainText('private-point-1');
});

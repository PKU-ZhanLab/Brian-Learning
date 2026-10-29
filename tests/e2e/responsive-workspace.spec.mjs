// Isolated CI only. This file was authored without launching a browser.
// Root's desktop CUA owns real browser zoom, touch/AT and visual acceptance.
import {test,expect} from '@playwright/test';
import {validateViewState} from '../../src/lib/workspace-project.js';
import {syntheticResultEvidence,syntheticResultLayers,preflightResultLayerProject} from '../fixtures/result-layer-fixtures.mjs';

const storageKey='neuroatlas-workspace-current-v1';
const longTitle='X7 synthetic research title: '+('Cross-modal localization and careful interpretation of source evidence — ').repeat(7);
const tail='X7 LIMITATION TAIL: source uncertainty remains explicit.';
const longLimit=('Synthetic limitation, not scientific evidence. '.repeat(75))+tail;
const work=page=>page.getByRole('region',{name:'Literature workspace',exact:true});
const settingsButton=page=>page.locator('.header-actions').getByRole('button',{name:'Display settings',exact:true});
const settingsDialog=page=>page.getByRole('dialog',{name:'Display settings',exact:true});

async function setup(page,{mode='research',layers=false,comparison=false,atlas='dk',layoutPreset='evidence'}={}){
  const evidence=syntheticResultEvidence();
  evidence.references[0].title=longTitle;
  evidence.results[0].finding='X7 long synthetic finding: '+('An observation with a precisely identified source. '.repeat(12));
  evidence.results[0].limitations=[longLimit];
  evidence.results[0].legacyV1.limitations=longLimit;
  evidence.references.push({id:'x7-second-paper',title:'X7 second synthetic title '+('Long comparison title. '.repeat(8)),url:'https://example.org/x7-second'});
  const view=validateViewState({language:'en',mode,atlas,hiddenIds:['precentral-l'],showSlices:true,layout:{preset:comparison?'compare':layoutPreset,panels:{active:layoutPreset==='model'?'model':'evidence',modelWidth:440}},literature:{paperId:comparison?null:'private-paper',compared:comparison?['private-paper','x7-second-paper']:[],showCompare:comparison},resultLayers:layers?syntheticResultLayers():[]});
  // The same transactional admission used by the normal project open path.
  await preflightResultLayerProject({projectId:'x7-isolated',view,evidence,notes:[],volumes:[]});
  const initial={schema:storageKey,projectId:'x7-isolated',revision:0,notes:[],drafts:[],view,evidence};
  await page.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));},{key:storageKey,initial});
  await page.goto(`/?lang=en&mode=${mode}`);
  await expect(settingsButton(page)).toBeVisible();
}

async function noPageOverflow(page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
}

async function recordViewport(page,testInfo,name){
  await testInfo.attach(`${name}-viewport`,{body:JSON.stringify(await page.evaluate(()=>({innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio,media:Object.fromEntries([649,650,651].map(width=>[width,matchMedia(`(max-width:${width}px)`).matches]))})),null,2),contentType:'application/json'});
  await page.screenshot({path:testInfo.outputPath(`${name}.png`),fullPage:true});
}

for(const width of [390,649,650,651])test(`a wide-open settings drawer remains operable after resizing to ${width}`,async({page},testInfo)=>{
  await page.setViewportSize({width:1366,height:768});
  await setup(page,{mode:'anatomy'});
  await settingsButton(page).click();
  const drawer=settingsDialog(page),opacity=drawer.getByRole('slider',{name:'Cortical opacity',exact:true});
  await opacity.focus();await opacity.press('Home');
  for(let step=0;step<30;step++)await opacity.press('ArrowRight');
  await drawer.getByRole('switch',{name:'Separate hemispheres',exact:true}).check();
  await page.setViewportSize({width,height:844});
  await expect(drawer).toBeVisible();
  await expect(opacity).toHaveValue('0.34');
  for(const name of ['Separate hemispheres','Floating labels','Show schematic structures','Clinical context']){
    const control=drawer.getByRole('switch',{name,exact:true});
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    if(name!=='Separate hemispheres')await control.check();
    await expect(control).toBeChecked();
  }
  const restore=drawer.getByRole('button',{name:'Restore hidden structures (1)',exact:true});
  await restore.click();
  await expect(drawer.getByRole('button',{name:'Restore hidden structures (0)',exact:true})).toBeDisabled();
  await noPageOverflow(page);
  await recordViewport(page,testInfo,`settings-${width}`);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(settingsButton(page)).toBeFocused();
  await page.setViewportSize({width:1366,height:768});
  await page.locator('.display-controls>summary').click();
  await expect(page.locator('.display-controls').getByRole('slider',{name:'Cortical opacity',exact:true})).toHaveValue('0.34');
  await expect(page.locator('.display-controls').getByRole('switch',{name:'Floating labels',exact:true})).toBeChecked();
});

for(const size of [{width:390,height:844},{width:650,height:844},{width:1366,height:768},{width:683,height:384}])test(`long source content and project actions remain reachable at ${size.width}×${size.height}`,async({page},testInfo)=>{
  // 683×384 is the CSS reflow equivalent of a 1366×768 desktop at 200%.
  // It is explicitly not a claim that browser-level zoom has been exercised.
  await page.setViewportSize(size);await setup(page,{layers:true});
  await expect(work(page).locator('.paper-detail h2')).toHaveText(longTitle);
  const limitation=work(page).locator('.evidence-result .evidence-note').filter({hasText:tail});
  await limitation.scrollIntoViewIfNeeded();
  await expect(limitation).toBeVisible();
  // Scroll the END, not just the top of a paragraph taller than the viewport.
  const tailVisible=await limitation.evaluate(element=>{
    const textNode=element.lastChild,range=document.createRange();
    range.setStart(textNode,Math.max(0,textNode.textContent.length-80));range.setEnd(textNode,textNode.textContent.length);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    element.scrollIntoView({block:'end'});
    const r=range.getBoundingClientRect(),owner=element.closest('.literature-scroll').getBoundingClientRect();
    selection.removeAllRanges();return r.bottom<=Math.min(innerHeight,owner.bottom)+2&&r.bottom>Math.max(0,owner.top);
  });
  expect(tailVisible).toBe(true);
  await noPageOverflow(page);
  await settingsButton(page).click();
  await expect(settingsDialog(page).getByRole('switch',{name:'Clinical context',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.workspace-actions>summary').click();
  const actions=page.locator('.workspace-actions>div');
  await expect(actions.getByRole('button')).toHaveCount(3);
  for(const button of await actions.getByRole('button').all()){
    await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();
    expect(await button.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
  }
  expect(await actions.locator('.count-badge').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
  await page.getByRole('button',{name:'Projects & views',exact:true}).click();
  const files=page.getByRole('dialog',{name:'Save and share',exact:true});
  await expect(files.getByRole('button',{name:'Export project',exact:true})).toBeVisible();
  await files.getByRole('button',{name:'Copy view link',exact:true}).scrollIntoViewIfNeeded();
  await expect(files.getByRole('button',{name:'Copy view link',exact:true})).toBeInViewport();
  await page.keyboard.press('Escape');
  const bar=page.locator('.result-layer-bar');
  if(!await bar.evaluate(element=>element.open))await bar.locator('summary').click();
  await bar.getByRole('button',{name:'Open result private-result',exact:true}).first().click();
  const result=page.getByRole('dialog',{name:'Paper result coordinates',exact:true});
  await result.getByRole('link',{name:'Check the source finding',exact:false}).scrollIntoViewIfNeeded();
  await expect(result.getByRole('link',{name:'Check the source finding',exact:false})).toBeInViewport();
  await recordViewport(page,testInfo,`source-${size.width}x${size.height}`);
});

test('full comparison retains its sticky dimension and scrollable long content at 390',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await setup(page,{comparison:true});
  const matrix=work(page).getByRole('region',{name:'Paper comparison table',exact:true});
  await expect(matrix).toBeVisible();
  const scroll=await matrix.evaluate(element=>{element.scrollLeft=element.scrollWidth;element.scrollTop=element.scrollHeight;return {x:element.scrollLeft,y:element.scrollTop};});
  expect(scroll.x).toBeGreaterThan(0);expect(scroll.y).toBeGreaterThan(0);
  await expect(matrix.locator('tbody tr').last()).toContainText(tail);
  expect(await matrix.locator('th').first().evaluate(element=>getComputedStyle(element).position)).toBe('sticky');
  await noPageOverflow(page);await recordViewport(page,testInfo,'comparison-390');
});

test('settings and grouped save controls retain a pending research draft',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);
  await work(page).getByRole('button',{name:'Add finding',exact:true}).click();
  const draft=work(page).locator('.evidence-editor textarea').first();
  await draft.fill('X7 unfinished source interpretation');
  await settingsButton(page).click();
  await settingsDialog(page).getByRole('switch',{name:'Clinical context',exact:true}).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Projects & views',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(draft).toHaveValue('X7 unfinished source interpretation');
  await expect(page.getByRole('button',{name:'Model first',exact:true})).toBeDisabled();
});

test('anatomy tree scroll returns through the existing research history',async({page})=>{
  await page.setViewportSize({width:1366,height:768});await setup(page,{mode:'anatomy'});
  const tree=page.locator('.structure-tree');
  await expect(tree.locator('.structure-row').first()).toBeVisible();
  const expected=await tree.evaluate(element=>{element.scrollTop=180;return element.scrollTop;});
  expect(expected).toBeGreaterThan(0);
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Evidence library',exact:true}).click();
  await expect(work(page)).toBeVisible();
  await page.getByRole('button',{name:'Research back',exact:true}).click();
  await expect(tree).toBeVisible();
  await expect.poll(()=>tree.evaluate(element=>element.scrollTop)).toBe(expected);
});

test('ordinary research text contrast, compact exceptions and selected/focus boundaries are measurable',async({page},testInfo)=>{
  await page.setViewportSize({width:1366,height:768});await setup(page);
  const selectors=['.main-nav button','.header-actions>button','.paper-detail h2','.evidence-result h4','.evidence-result .evidence-note','.paper-authors','.app-footer'];
  const measurements=await page.evaluate(selectors=>{
    const color=value=>value.match(/[\d.]+/g).map(Number);
    const blend=(fg,bg)=>{const a=fg[3]??1;return fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a));};
    const background=element=>{const chain=[];for(let node=element;node;node=node.parentElement)chain.unshift(node);return chain.reduce((bg,node)=>blend(color(getComputedStyle(node).backgroundColor),bg),[255,255,255]);};
    const lum=rgb=>rgb.map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    return selectors.map(selector=>{const element=document.querySelector(selector),style=getComputedStyle(element),bg=background(element),fg=blend(color(style.color),bg),a=lum(fg),b=lum(bg);return {selector,fontSize:parseFloat(style.fontSize),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
  },selectors);
  for(const value of measurements){expect(value.fontSize,value.selector).toBeGreaterThanOrEqual(12);expect(value.contrast,value.selector).toBeGreaterThanOrEqual(4.5);}
  await testInfo.attach('computed-reading-styles',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Anatomy',exact:true}).click();
  const count=page.locator('.group-count').first();await expect(count).toBeVisible();
  expect(await count.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
  const selected=page.locator('.structure-row.selected').first();
  await expect(selected.getByRole('button').first()).toHaveAttribute('aria-pressed','true');
  expect(await selected.evaluate(element=>parseFloat(getComputedStyle(element).borderLeftWidth))).toBeGreaterThanOrEqual(2);
  const controls=[settingsButton(page),page.getByRole('button',{name:'Projects & views',exact:true}),page.locator('.structure-row>button:last-child').first()];
  for(const [index,control]of controls.entries()){
    await control.focus();await expect(control).toBeFocused();
    const box=await control.boundingBox();expect(box.height).toBeGreaterThanOrEqual(index===2?24:40);expect(box.width).toBeGreaterThanOrEqual(index===2?24:40);
    expect(await control.evaluate(element=>getComputedStyle(element).outlineStyle)).not.toBe('none');
  }
});

test('atlas close, handoff and resize do not invoke a disposed canvas',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1366,height:768});await setup(page,{mode:'anatomy'});
  const open=page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Atlas labels',exact:true});
  for(const width of [390,1366,650]){
    await open.click();const atlas=page.getByRole('dialog',{name:'Atlas label explorer',exact:true});
    await expect(atlas.locator('.atlas-model-canvas canvas')).toBeVisible();
    await page.setViewportSize({width,height:768});
    await atlas.getByRole('button',{name:'Close atlas explorer',exact:true}).click();
    await page.setViewportSize({width:1366,height:768});
    await expect(atlas).toHaveCount(0);
  }
  await open.click();const atlas=page.getByRole('dialog',{name:'Atlas label explorer',exact:true});
  await expect(atlas.locator('.atlas-label-list button').first()).toBeVisible();
  await atlas.locator('.atlas-label-list button').first().click();
  await atlas.getByRole('button',{name:'Set selection as ROI A',exact:true}).click();
  await expect(atlas).toHaveCount(0);await page.setViewportSize({width:390,height:844});
  expect(errors.filter(message=>/getBoundingClientRect|ResizeObserver|disposed|null/i.test(message))).toEqual([]);
});

// X7 I2 RED at 05c7306: the last action extended below the overflow-hidden
// canvas, and its center hit Enter coordinates instead of its own button.
for(const mode of ['anatomy','research'])for(const size of [{width:1366,height:768},{width:390,height:844},{width:683,height:384}])test(`all model action centers hit their own controls in ${mode} at ${size.width}×${size.height}`,async({page},testInfo)=>{
  // 683×384 checks 200% reflow equivalence; real browser zoom belongs to root CUA.
  await page.setViewportSize(size);await setup(page,{mode,layoutPreset:'model'});
  const tools=page.locator('.viewer-tools');
  await expect(tools.getByRole('button')).toHaveCount(6);
  const controls=[...await tools.getByRole('button').all(),page.locator('.model-data-notes')];
  const measurements=[];
  for(const control of controls){
    await control.scrollIntoViewIfNeeded();await control.focus();await expect(control).toBeFocused();
    const result=await control.evaluate(button=>{
      const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=document.elementFromPoint(x,y);
      const notes=document.querySelector('.model-data-notes'),notesRect=notes.getBoundingClientRect();
      const overlap=button===notes?0:Math.max(0,Math.min(rect.right,notesRect.right)-Math.max(rect.left,notesRect.left))*Math.max(0,Math.min(rect.bottom,notesRect.bottom)-Math.max(rect.top,notesRect.top));
      return {name:button.getAttribute('aria-label')||button.textContent.trim(),width:rect.width,height:rect.height,x,y,ownCenter:hit!==null&&button.contains(hit),hitName:hit?.closest('button,summary')?.getAttribute('aria-label')||hit?.closest('button,summary')?.textContent.trim(),overlapWithNotes:overlap};
    });
    measurements.push(result);
    // Browser/device scaling may round a CSS 40px target by a fraction of a px.
    expect(result.width,result.name).toBeGreaterThanOrEqual(39.5);expect(result.height,result.name).toBeGreaterThanOrEqual(39.5);
    expect(result.ownCenter,JSON.stringify(result)).toBe(true);
    expect(result.overlapWithNotes,result.name).toBe(0);
  }
  await testInfo.attach('model-control-center-hit-tests',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
  await noPageOverflow(page);await recordViewport(page,testInfo,`model-controls-${mode}-${size.width}`);
});

// X7 I1: source identity and interpretation stay beside the model even when
// research layout hides the atlas sidebar and the right-hand voxel information.
// A native AAL restore follows the existing S3 usable-atlas guard to DK; it does
// not leave an ineligible native overlay active in the main research model.
for(const layoutPreset of ['model','evidence'])for(const source of [
  {atlas:'aal-registered',method:'Cortical ribbon labels'},
  {atlas:'ho',method:'Volume atlas'},
  {atlas:'aal',expectedAtlas:'dk',method:'Volume atlas',relationship:'Matched native template verified'},
])test(`research ${layoutPreset} restores ${source.expectedAtlas||source.atlas} provenance for requested ${source.atlas}`,async({page},testInfo)=>{
  await page.setViewportSize({width:1366,height:768});await setup(page,{atlas:source.atlas,layoutPreset});
  const context=page.locator('.model-provenance'),summary=context.locator('summary');
  await expect(page.locator('.left-panel')).toBeHidden();
  await expect(page.locator('.right-panel>.voxel-info')).toBeHidden();
  await expect(context).toHaveAttribute('data-atlas-context',source.expectedAtlas||source.atlas);
  await expect(summary).toContainText(source.method);
  await summary.scrollIntoViewIfNeeded();await expect(summary).toBeInViewport();
  await summary.focus();await summary.press('Enter');
  await expect(context).toHaveAttribute('open');
  await expect(context).toContainText('Model reference');await expect(context).toContainText('MNI152NLin6Asym · RAS · mm');
  await expect(context).toContainText('Atlas reference');await expect(context).toContainText('Spatial relationship');
  if(source.relationship){await expect(context).toContainText(source.relationship);await expect(context.locator('.model-provenance-warning')).toHaveCount(0);}
  await expect(context).toContainText('Atlas version');await expect(context).toContainText('sha256:');
  await summary.press('Enter');await expect(context).not.toHaveAttribute('open');
  // Resize the same model/provenance context, then use the existing panel switch.
  await page.setViewportSize({width:683,height:384});
  await page.getByRole('group',{name:'Visible panel',exact:true}).getByRole('button',{name:'Model',exact:true}).click();
  await summary.scrollIntoViewIfNeeded();await expect(summary).toBeInViewport();await expect(summary).toContainText(source.method);
  await summary.focus();await summary.press('Enter');await expect(context).toContainText('Atlas reference');
  await expect(context).toHaveAttribute('data-atlas-context',source.expectedAtlas||source.atlas);
  if(source.relationship)await expect(context).toContainText(source.relationship);
  await noPageOverflow(page);await recordViewport(page,testInfo,`provenance-${layoutPreset}-${source.atlas}-reflow`);
});

// X7 round2 RED: at1366 two default-expanded layers consumed236px and left
// only273px for reading; collapsing the same disclosure restored468px.
test('two-layer reading starts with compact source context and preserves the reclaimed paper space',async({page},testInfo)=>{
  await page.setViewportSize({width:1366,height:768});await setup(page,{layers:true});
  await page.evaluate(()=>document.fonts.ready);
  const bar=page.locator('.result-layer-bar'),summary=bar.locator('summary');
  await expect(bar).not.toHaveAttribute('open');
  await expect(summary).toContainText('private-result');await expect(summary).toContainText(longTitle);
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).view.resultLayers,storageKey);
  const measure=()=>page.evaluate(()=>({readingHeight:document.querySelector('.workspace-layout>.right-panel').getBoundingClientRect().height,headingY:document.querySelector('.paper-detail h2').getBoundingClientRect().top,layerHeight:document.querySelector('.result-layer-bar').getBoundingClientRect().height}));
  const compact=await measure();
  // Measure actual available reading area and heading position, not a CSS string.
  expect(compact.readingHeight).toBeGreaterThanOrEqual(400);
  expect(compact.headingY).toBeLessThan(768-100);
  await summary.click();await expect(bar).toHaveAttribute('open');
  await expect(bar.locator('.result-layer-content').getByRole('button')).toHaveCount(7);
  const expanded=await measure();
  expect(compact.readingHeight-expanded.readingHeight).toBeGreaterThan(100);
  expect(expanded.headingY-compact.headingY).toBeGreaterThan(100);
  await summary.click();await expect(bar).not.toHaveAttribute('open');
  const restored=await measure();
  expect(Math.abs(restored.readingHeight-compact.readingHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(restored.headingY-compact.headingY)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).view.resultLayers,storageKey)).toEqual(before);
  await testInfo.attach('two-layer-reading-space',{body:JSON.stringify({compact,expanded,restored},null,2),contentType:'application/json'});
  await recordViewport(page,testInfo,'compact-two-layer-reading-1366');
});

for(const width of [390,650,651,1366])test(`layer source summary defaults compact at ${width} and user choice survives narrowing/widening`,async({page})=>{
  await page.setViewportSize({width,height:844});await setup(page,{layers:true});
  const bar=page.locator('.result-layer-bar'),summary=bar.locator('summary');
  await expect(bar).not.toHaveAttribute('open');
  await expect(summary).toContainText('private-result');await expect(summary).toContainText(longTitle);
  await expect(bar.locator('.result-layer-content').getByRole('button')).toHaveCount(0);
  for(const next of [390,1366]){await page.setViewportSize({width:next,height:844});await expect(bar).not.toHaveAttribute('open');}
  await summary.click();await expect(bar).toHaveAttribute('open');
  for(const next of [390,650,1366]){await page.setViewportSize({width:next,height:844});await expect(bar).toHaveAttribute('open');}
  await expect(bar.getByRole('button',{name:'Hide layer private-layer-name',exact:true})).toBeVisible();
  await expect(bar.getByRole('button',{name:'Clear result layers',exact:true})).toBeVisible();
  await summary.click();await expect(bar).not.toHaveAttribute('open');
  for(const next of [390,1366]){await page.setViewportSize({width:next,height:844});await expect(bar).not.toHaveAttribute('open');}
});

test('long comparison titles leave a hit-testable body in a short viewport and open their full source titles by keyboard',async({page},testInfo)=>{
  // Same admitted two-paper/long-title/long-limit fixture as compare-long.neuroatlas.
  // Keep it generated by the existing isolated fixture helper, without relying
  // on an ignored controller-output file being present in a clean CI checkout.
  await page.setViewportSize({width:683,height:384});await setup(page,{comparison:true,layers:true});
  await page.evaluate(()=>document.fonts.ready);
  const matrix=work(page).getByRole('region',{name:'Paper comparison table',exact:true});
  await matrix.scrollIntoViewIfNeeded();
  await matrix.evaluate(element=>{element.scrollTop=384;element.scrollLeft=120;});
  const geometry=await matrix.evaluate(element=>{
    const bounds=element.getBoundingClientRect(),headers=[...element.querySelectorAll('thead th')].map(cell=>cell.getBoundingClientRect()),header={height:Math.max(...headers.map(rect=>rect.height)),bottom:Math.max(...headers.map(rect=>rect.bottom))},dimension=element.querySelector('tbody th').getBoundingClientRect();
    const clip={left:Math.max(0,bounds.left,dimension.right),right:Math.min(innerWidth,bounds.right),top:Math.max(0,bounds.top,header.bottom),bottom:Math.min(innerHeight,bounds.bottom)};
    const cells=[...element.querySelectorAll('tbody td')].map(cell=>{
      const rect=cell.getBoundingClientRect(),left=Math.max(clip.left,rect.left),right=Math.min(clip.right,rect.right),top=Math.max(clip.top,rect.top),bottom=Math.min(clip.bottom,rect.bottom);
      if(right-left<16||bottom-top<16)return null;
      const x=(left+right)/2,y=(top+bottom)/2,hit=document.elementFromPoint(x,y);
      return {text:cell.textContent.trim().slice(0,100),x,y,width:right-left,height:bottom-top,fontSize:parseFloat(getComputedStyle(cell).fontSize),ownCell:hit!==null&&cell.contains(hit),insideHead:Boolean(hit?.closest('thead'))};
    }).filter(Boolean);
    return {clientHeight:element.clientHeight,scrollTop:element.scrollTop,scrollLeft:element.scrollLeft,headerHeight:header.height,visibleBodyHeight:clip.bottom-clip.top,dimensionPosition:getComputedStyle(element.querySelector('tbody th')).position,cells};
  });
  expect(geometry.scrollTop).toBeGreaterThan(0);expect(geometry.scrollLeft).toBeGreaterThan(0);
  expect(geometry.headerHeight).toBeLessThan(geometry.clientHeight*.6);
  expect(geometry.visibleBodyHeight).toBeGreaterThanOrEqual(80);
  expect(geometry.dimensionPosition).toBe('sticky');
  expect(geometry.cells.length).toBeGreaterThan(0);
  for(const cell of geometry.cells){expect(cell.ownCell,JSON.stringify(cell)).toBe(true);expect(cell.insideHead).toBe(false);expect(cell.fontSize).toBeGreaterThanOrEqual(15);}
  await testInfo.attach('short-comparison-body-hit-tests',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
  await recordViewport(page,testInfo,'comparison-short-readable');

  const sourceTitles=await matrix.locator('.comparison-paper-open>span').allTextContents();
  expect(sourceTitles).toHaveLength(2);expect(sourceTitles[0]).toBe(longTitle);
  for(let index=0;index<sourceTitles.length;index++){
    const title=sourceTitles[index],opener=matrix.locator('.comparison-paper-open').nth(index);
    await matrix.evaluate((element,column)=>{element.scrollLeft=column===0?0:element.scrollWidth-element.clientWidth;},index);
    await expect(opener).toHaveAccessibleName(`Open paper findings: ${title.trim()}`);
    await opener.scrollIntoViewIfNeeded();await opener.focus();await expect(opener).toBeFocused();
    const ownCenter=await opener.evaluate(button=>{const rect=button.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return hit!==null&&button.contains(hit);});
    expect(ownCenter).toBe(true);
    await opener.press('Enter');await expect(work(page).locator('.paper-detail h2')).toHaveText(title);
    await work(page).getByRole('button',{name:'Back to comparison',exact:true}).click();
    await expect(matrix).toBeVisible();await expect(matrix.locator('thead th')).toHaveCount(3);
  }
  await expect(matrix.locator('tbody tr').last()).toContainText(tail);
  await noPageOverflow(page);
});

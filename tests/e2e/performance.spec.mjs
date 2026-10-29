import {test,expect} from '@playwright/test';
import {exportNifti} from '../../src/lib/nifti.js';

// Authoring only: execution requires an explicitly permitted isolated CI browser.
// Browser-clock measurements live inside the page; driver/CUA call duration is
// never reported as rendering, cancellation, interaction or cold-start latency.
const affine=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const small={name:'small.nii',mimeType:'application/octet-stream',buffer:Buffer.from(exportNifti({kind:'label',shape:[64,64,64],affine,data:new Int16Array(64**3)}))};
async function openImport(page){
 await page.goto('/?lang=en');await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'ROI comparison',exact:true}).click();
 await page.locator('.roi-import>summary').click();return page.locator('.roi-import');
}

test('optional fonts may fail while layout and navigation remain usable',async({page},testInfo)=>{
 await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort());
 await page.addInitScript(()=>{window.__x9Shifts=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__x9Shifts.push(entry.value);}).observe({type:'layout-shift',buffered:true});});
 const panel=await openImport(page);await expect(panel.getByLabel('Import NIfTI file',{exact:true})).toBeVisible();
 const observation=await page.evaluate(()=>({fontFamily:getComputedStyle(document.documentElement).fontFamily,viewport:{width:innerWidth,height:innerHeight},layoutShift:window.__x9Shifts.reduce((a,b)=>a+b,0),documentWidth:document.documentElement.scrollWidth}));
 expect(observation.fontFamily).toContain('sans-serif');expect(observation.documentWidth).toBeLessThanOrEqual(observation.viewport.width);
 await testInfo.attach('blocked-font-observation',{body:JSON.stringify(observation),contentType:'application/json'});
});

test('optional panel download failure leaves the workspace and navigation available',async({page})=>{
 await page.route('**/src/components/ROICompare.jsx*',route=>route.abort());await page.goto('/?lang=en');
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'ROI comparison',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'This panel could not be loaded.'})).toBeVisible();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Anatomy',exact:true}).click();await expect(page.locator('.app-shell')).toBeVisible();
});

test('cancel before worker completion registers nothing and retains the declaration for retry',async({page})=>{
 let delay=true;
 // Hold only the dedicated worker request, never a user's browser/storage.
 await page.route('**/src/workers/nifti.worker.js*',async route=>{if(delay)await new Promise(resolve=>setTimeout(resolve,1500));await route.continue();});
 const panel=await openImport(page);await panel.getByLabel('Import NIfTI file',{exact:true}).setInputFiles(small);
 await panel.getByLabel('Imported image provenance',{exact:true}).fill('Retain this declaration');
 await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();
 await panel.getByRole('button',{name:'Cancel NIfTI import',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Image import cancelled.'})).toBeVisible();
 await expect(page.locator('.roi-imported-volumes')).toHaveCount(0);
 await expect(panel.getByLabel('Imported image provenance',{exact:true})).toHaveValue('Retain this declaration');
 delay=false;await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('small.nii');await expect(page.locator('.roi-imported-volumes')).toContainText('small');
});

test('worker error cannot replace an admitted image; retry uses the same stage path',async({page})=>{
 const panel=await openImport(page);await panel.getByLabel('Import NIfTI file',{exact:true}).setInputFiles(small);
 await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();await expect(page.locator('.roi-imported-volumes')).toContainText('small');
 const before=await page.evaluate(()=>localStorage.getItem('neuroatlas-workspace-current-v1'));
 await page.route('**/src/workers/nifti.worker.js*',route=>route.abort());
 await panel.getByLabel('Import NIfTI file',{exact:true}).setInputFiles({...small,name:'retry.nii'});await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();
 await expect(panel.getByRole('alert')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('neuroatlas-workspace-current-v1'))).toBe(before);
 await expect(page.locator('.roi-imported-volumes')).not.toContainText('retry');
 await page.unroute('**/src/workers/nifti.worker.js*');await panel.getByRole('button',{name:'Import local NIfTI',exact:true}).click();await expect(page.locator('.roi-imported-volumes')).toContainText('retry');
});

test('actual worker tasks under CPU throttling preserve bytes and cancel without a partial result',async({page},testInfo)=>{
 test.setTimeout(120_000);await page.goto('/?lang=en');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const observation=await page.evaluate(async()=>{
  const {parseNiftiInWorker,exportNiftiInWorker}=await import('/src/lib/nifti-worker-client.js');
  const {exportNifti}=await import('/src/lib/nifti.js');
  const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  const samples=[];
  for(const edge of [64,128,400]){
   const bytes=exportNifti({name:`synthetic-${edge}`,kind:'label',shape:[edge,edge,edge],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],data:new Int16Array(edge**3)}),sha256=await digest(bytes);
   let at=performance.now();const volume=await parseNiftiInWorker(bytes,{}),parseMs=performance.now()-at;
   const originalDataLength=volume.data.byteLength,originalDataHash=await digest(volume.data);
   at=performance.now();const output=await exportNiftiInWorker(volume,{}),exportMs=performance.now()-at;
   const controller=new AbortController();let cancelAt,cancelMs,published=false;
   try{await parseNiftiInWorker(bytes,{}, {signal:controller.signal,onProgress:({phase})=>{if(phase==='parsing'){cancelAt=performance.now();controller.abort();}}});published=true;}
   catch(error){if(error.name!=='AbortError')throw error;cancelMs=performance.now()-cancelAt;}
   samples.push({edge,fileBytes:bytes.byteLength,sha256,parseMs,exportMs,cancelMs,published,outputBytes:output.bytes.byteLength,inputUnchanged:(await digest(bytes))===sha256,dataUnchanged:volume.data.byteLength===originalDataLength&&(await digest(volume.data))===originalDataHash});
  }
  return {measurementScope:'browser-worker-only',method:'Browser performance.now; parser-phase abort. Does not measure end-to-end admission or UI cancel feedback.',environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,cpuThrottleRate:4,origin:location.origin},samples,peakHeapBytes:null,reason:'No browser peak heap sampler; worker-isolate memory is not captured by window.performance.memory'};
 });
 for(const sample of observation.samples){expect(sample.published).toBe(false);expect(sample.inputUnchanged).toBe(true);expect(sample.dataUnchanged).toBe(true);expect(sample.cancelMs).toBeLessThanOrEqual(1000);}
 await testInfo.attach('browser-worker-measurements',{body:JSON.stringify(observation,null,2),contentType:'application/json'});
});

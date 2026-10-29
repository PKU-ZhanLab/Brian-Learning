// Authored for the isolated, permitted CI runner only. This file has not been executed.
import {test,expect} from '@playwright/test';
import {serializeProject,parseProject} from '../../src/lib/workspace-project.js';
import {emptyEvidence} from '../../src/lib/evidence-schema.js';
import {prepareLocalVolumeProvenance,makeComparisonManifest} from '../../src/lib/computation-manifest.js';
import {compareROIs,normalizeROISelection} from '../../src/lib/roi.js';
import {exportNifti} from '../../src/lib/nifti.js';

const grid={shape:[2,2,1],affine:[2,0,0,-90,0,2,0,-126,0,0,2,-72,0,0,0,1],space:'MNI152NLin6Asym',order:'x-fastest'};
const target={...grid,shape:[91,109,91]};
async function fixture(drift=true){
 const volumes=await Promise.all(['a','b'].map(async(side)=>{const volume={...grid,id:`custom-${side}`,name:`Synthetic ${side}`,kind:'mask',dtype:'uint8',data:Uint8Array.of(1,1,0,1),canOverlayOnTarget:true,alignmentStatus:'user-declared',provenance:'Synthetic fixture; declared aligned for this isolated test.',labels:[]};return prepareLocalVolumeProvenance(volume,exportNifti(volume),{id:`synthetic-${side}.nii`});}));
 const [a,b]=volumes,sa=normalizeROISelection(a,{}),sb=normalizeROISelection(b,{}),manifest=makeComparisonManifest(a,sa,b,sb,target);
 const raw=compareROIs(a,sa,b,sb,target,{A:{atlasId:a.id},B:{atlasId:b.id},manifest});
 const snapshot={...raw,id:'historical-computation',manifest:{...manifest,algorithmVersion:drift?'historical-algorithm':manifest.algorithmVersion}};
 const project={projectId:'synthetic-reproducibility',view:{language:'en',mode:'roi',atlas:'dk',roi:{aAtlas:a.id,bAtlas:b.id,aLabels:[],bLabels:[],computed:true,resolutionMm:2,display:{mode:'B',opacityB:.3}}},notes:[],drafts:[],evidence:emptyEvidence(),volumes,roiSnapshot:snapshot};
 return {text:await serializeProject(project),snapshot};
}
async function files(page){await page.getByRole('button',{name:'Projects & views',exact:true}).click();return page.getByRole('dialog',{name:'Save and share',exact:true});}
async function open(page,text){const dialog=await files(page);await dialog.locator('input[type=file]').setInputFiles({name:'synthetic.neuroatlas',mimeType:'application/json',buffer:Buffer.from(text)});await dialog.getByRole('button',{name:'Confirm open',exact:true}).click();await dialog.getByRole('button',{name:'Close save dialog',exact:true}).click();}
async function exported(page){const dialog=await files(page);await dialog.getByRole('button',{name:'Export project',exact:true}).click();const next=page.waitForEvent('download');await dialog.getByRole('button',{name:'Confirm download',exact:true}).click();const stream=await(await next).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return parseProject(Buffer.concat(chunks).toString());}
function roiWorkers(page){const starts=[];page.on('worker',worker=>{if(/roi[.-]worker/.test(worker.url()))starts.push(worker.url());});return starts;}

test('version drift restores saved numerical geometry without worker calls; explicit recompute adds a distinct snapshot',async({page})=>{
 const {text,snapshot}=await fixture(),starts=roiWorkers(page);await page.goto('/?lang=en');await open(page,text);
 const history=page.getByRole('region',{name:'Saved computation',exact:true});await expect(history.locator('[data-provenance-status]')).toHaveAttribute('data-provenance-status','mismatch');await expect(history.getByRole('table',{name:'Computation provenance differences'})).toContainText('algorithmVersion');await expect(history).toContainText('historical-algorithm');expect(starts).toHaveLength(0);
 await expect(page.getByRole('combobox',{name:'ROI display mode',exact:true})).toHaveValue('B');await expect(page.getByRole('slider',{name:'ROI B opacity',exact:true})).toHaveValue('0.3');
 await page.getByRole('button',{name:'Compute ROI overlap',exact:true}).click();await expect(history.getByRole('button',{name:'Inspect recomputed ROI result',exact:true})).toBeVisible();expect(starts).toHaveLength(1);
 const reopened=await exported(page);expect(reopened.roiSnapshot.id).toBe(snapshot.id);expect(reopened.roiSnapshot.metrics).toEqual(snapshot.metrics);expect(reopened.roiSnapshot.manifest).toEqual(snapshot.manifest);expect(reopened.roiSnapshot.classes).toEqual(snapshot.classes);expect(reopened.recomputedSnapshot.id).not.toBe(snapshot.id);expect(reopened.recomputedSnapshot.metrics).toEqual(snapshot.metrics);
});

test('matching identities permit inspection and same-operand recomputation without replacing original history',async({page})=>{
 const {text,snapshot}=await fixture(false),starts=roiWorkers(page);await page.goto('/?lang=en');await open(page,text);
 await expect(page.locator('[data-provenance-status="matched"]')).toBeVisible();expect(starts).toHaveLength(0);await page.getByRole('button',{name:'Compute ROI overlap',exact:true}).click();await expect(page.getByRole('button',{name:'Inspect recomputed ROI result',exact:true})).toBeVisible();
 const reopened=await exported(page);expect(reopened.roiSnapshot.id).toBe(snapshot.id);expect(reopened.recomputedSnapshot.metrics).toEqual(snapshot.metrics);expect(reopened.recomputedSnapshot.id).not.toBe(reopened.roiSnapshot.id);
});

test('legacy computed=true reports absent history and cannot silently create a worker or a new provenance record',async({page})=>{
 const starts=roiWorkers(page);await page.goto('/?lang=en');await open(page,JSON.stringify({schema:'neuroatlas-project-v1',view:{language:'en',mode:'roi',roi:{aAtlas:'dk',aLabels:[1],bAtlas:'ba-histology',bLabels:[1],computed:true}},notes:[],evidence:emptyEvidence(),volumes:[]}));
 await expect(page.getByRole('region',{name:'Saved computation',exact:true})).toContainText('No historical numerical result was saved');expect(starts).toHaveLength(0);
 const reopened=await exported(page);expect(reopened.provenanceStatus).toBe('missing-provenance');expect(reopened.roiSnapshot).toBeNull();expect(reopened.recomputedSnapshot).toBeNull();expect(reopened.view.roi.computed).toBe(false);
});

test('a missing source preserves saved numbers and classes for inspection without any automatic worker',async({page})=>{
 const {text,snapshot}=await fixture(),detached=JSON.parse(text);detached.volumes=detached.volumes.filter(v=>v.id!=='custom-a');detached.missingAssetIds=['custom-a'];detached.view.roi.aAtlas='';detached.roiSnapshot.status='missing-input';detached.roiSnapshot.missingAssetIds=['custom-a'];
 const starts=roiWorkers(page);await page.goto('/?lang=en');await open(page,JSON.stringify(detached));const history=page.getByRole('region',{name:'Saved computation',exact:true});await expect(history.locator('[data-provenance-status]')).toHaveAttribute('data-provenance-status','missing-input');await expect(history).toContainText('custom-a');await expect(page.getByRole('button',{name:'Compute ROI overlap',exact:true})).toBeDisabled();expect(starts).toHaveLength(0);
 const reopened=await exported(page);expect(reopened.roiSnapshot.status).toBe('missing-input');expect(reopened.roiSnapshot.metrics).toEqual(snapshot.metrics);expect(reopened.roiSnapshot.classes).toEqual(snapshot.classes);expect(reopened.recomputedSnapshot).toBeNull();
});

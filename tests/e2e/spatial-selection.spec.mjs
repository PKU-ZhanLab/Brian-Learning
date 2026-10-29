import {test, expect} from '@playwright/test';

async function pick(page, atlas, label) {
  await page.getByRole('navigation', {name:'Main navigation'}).getByRole('button',{name:'Atlas labels',exact:true}).click();
  await page.getByLabel('Atlas explorer source',{exact:true}).selectOption(atlas);
  await page.getByLabel('Search atlas labels',{exact:true}).fill(label);
  await page.locator('.atlas-label-list button').filter({hasText:label}).click();
  await page.getByRole('button',{name:'Use atlas label',exact:true}).click();
  await expect(page.getByRole('region',{name:'Atlas region details'})).toContainText(label);
}

test('unlinked actual label supports exact annotation and ROI entry without concept evidence', async ({page}) => {
  await page.goto('/?lang=en');
  await pick(page,'aal-registered','Frontal_Sup_L');
  await expect(page.getByRole('region',{name:'Atlas region details'})).toContainText('No linked concepts or research results yet.');
  await page.getByRole('button',{name:'Annotate atlas label',exact:true}).click();
  await page.locator('#note-draft').fill('Independent actual-label annotation');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')||'null')?.notes?.at(-1)?.text)).toBe('Independent actual-label annotation');
  const note = await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')).notes.at(-1));
  expect(note.regionRef).toMatchObject({atlasId:'aal-registered',labelId:2101,hemisphere:'L'});
  expect(note.structureId).toBeUndefined();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Compare selected atlas label',exact:true}).click();
  await expect(page.getByLabel('ROI A atlas',{exact:true})).toHaveValue('aal-registered');
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['2101']);
});

test('temporal labels stay independent and deep native labels do not trigger a cortical overlay', async ({page}) => {
  await page.goto('/?lang=en');
  for (const [atlas, first, second, ids] of [['aal-registered','Temporal_Pole_Sup_L','Temporal_Pole_Mid_L',[8121,8211]],['aal3-registered','Temporal_Pole_Sup_L','Temporal_Pole_Mid_L',[87,91]]]) {
    await pick(page,atlas,first);
    const before=await page.getByRole('region',{name:'Atlas region details'}).getAttribute('data-region-key');
    await page.getByRole('button',{name:'Annotate atlas label',exact:true}).click();
    await page.locator('#note-draft').fill(`${atlas} first temporal label`);
    await page.getByRole('button',{name:'Save note',exact:true}).click();
    await page.keyboard.press('Escape');
    await pick(page,atlas,second);
    const after=await page.getByRole('region',{name:'Atlas region details'}).getAttribute('data-region-key');
    expect(before).not.toBe(after);
    await expect(page.getByRole('region',{name:'Atlas region details'})).not.toContainText(`${atlas} first temporal label`);
    await page.getByRole('button',{name:'Annotate atlas label',exact:true}).click();
    await page.locator('#note-draft').fill(`${atlas} second temporal label`);
    await page.getByRole('button',{name:'Save note',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')||'null')?.notes?.at(-1)?.text)).toBe(`${atlas} second temporal label`);
    const notes=await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')).notes.slice(-2));
    expect(notes.map(note=>note.regionRef.labelId)).toEqual(ids);
    await page.keyboard.press('Escape');
    await pick(page,atlas,first);
    await expect(page.getByRole('region',{name:'Atlas region details'})).toContainText(`${atlas} first temporal label`);
    await expect(page.getByRole('region',{name:'Atlas region details'})).not.toContainText(`${atlas} second temporal label`);
  }
  await pick(page,'aal3','LC_L');
  await expect(page.getByRole('region',{name:'Atlas region details'})).toContainText('aal3');
  await expect(page.getByRole('button',{name:'Compare selected atlas label',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Choose an atlas',{exact:true})).not.toHaveValue('aal3');
});

// Supplementary component interaction. The App/project container integration
// still belongs to W6; this mounts the real ROICompare against the real atlases.
test('unresolved A reference survives grid, B and threshold edits until explicit A reselection',async({page})=>{
  await page.goto('/?lang=en');
  await page.evaluate(async()=>{
    const main=await(await fetch('/src/main.jsx')).text();
    const modulePath=name=>{
      const path=main.match(new RegExp(`from\\s*["']([^"']*/${name}\\.js[^"']*)["']`))?.[1];
      if(!path)throw Error(`Vite dependency URL unavailable: ${name}`);
      return path;
    };
    const [{default:React},{createRoot},{default:ROICompare},{makeAtlasRegionRef},{registerCustomVolume},{prepareVolume}]=await Promise.all([
      import(modulePath('react')),import(modulePath('react-dom_client')),import('/src/components/ROICompare.jsx'),import('/src/lib/atlas-identity.js'),import('/src/lib/custom-volumes.js'),import('/src/lib/volume.js'),
    ]);
    const manifest=await(await fetch('/data/manifest.json')).json();
    const a=makeAtlasRegionRef('aal-registered',manifest.atlases['aal-registered'],8121);
    const b=makeAtlasRegionRef('aal3-registered',manifest.atlases['aal3-registered'],87);
    registerCustomVolume(prepareVolume(new Float32Array([1]),{shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],space:'MNI152NLin6Asym',order:'x-fastest',kind:'statistic',name:'Threshold fixture',canOverlayOnTarget:true,alignmentStatus:'user-declared'}),{id:'custom-s2-threshold-fixture'});
    document.getElementById('root').hidden=true;
    const host=document.createElement('div');host.dataset.s2RoiFixture='';document.body.append(host);
    window.__s2ROIState=null;
    createRoot(host).render(React.createElement(ROICompare,{manifest,language:'en',initialState:{aAtlas:'aal-registered',aLabels:[8121],aRegionRefs:[{...a,atlasVersion:'saved-unavailable-version'}],bAtlas:'aal3-registered',bLabels:[87],bRegionRefs:[b],resolutionMm:2,computed:false},onStateChange:value=>{window.__s2ROIState=value;}}));
  });
  const fixture=page.locator('[data-s2-roi-fixture]');
  const warning=fixture.getByRole('alert').filter({hasText:'Saved atlas label identity is unavailable or has changed.'});
  const compute=fixture.getByRole('button',{name:'Compute ROI overlap',exact:true});
  const assertBlocked=async()=>{
    await expect(warning).toBeVisible();await expect(compute).toBeDisabled();
    await expect.poll(()=>page.evaluate(()=>window.__s2ROIState?.aRegionRefs?.[0]?.atlasVersion)).toBe('saved-unavailable-version');
  };
  await assertBlocked();
  await fixture.getByLabel('ROI shared grid spacing',{exact:true}).selectOption('1');await assertBlocked();
  await fixture.getByLabel('ROI B label',{exact:true}).selectOption('91');await assertBlocked();
  await fixture.getByLabel('ROI B atlas',{exact:true}).selectOption('custom-s2-threshold-fixture');await assertBlocked();
  await fixture.getByLabel('ROI B threshold',{exact:true}).fill('0.7');await assertBlocked();
  await fixture.getByLabel('ROI B tail',{exact:true}).selectOption('negative');await assertBlocked();
  await fixture.getByLabel('ROI A label',{exact:true}).selectOption('8211');
  await expect(warning).toHaveCount(0);await expect(compute).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>window.__s2ROIState?.aRegionRefs?.[0]?.labelId)).toBe(8211);
  expect(await page.evaluate(()=>window.__s2ROIState.aRegionRefs[0].atlasVersion)).not.toBe('saved-unavailable-version');
});

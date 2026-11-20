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
  await page.getByRole('button',{name:'Use as ROI A',exact:true}).click();
  await expect(page.getByLabel('ROI A atlas',{exact:true})).toHaveValue('aal-registered');
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['2101']);
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Anatomy',exact:true}).click();
  await pick(page,'aal3-registered','Temporal_Pole_Mid_L');
  await page.getByRole('button',{name:'Use as ROI B',exact:true}).click();
  await expect(page.getByLabel('ROI A label',{exact:true})).toHaveValues(['2101']);
  await expect(page.getByLabel('ROI B atlas',{exact:true})).toHaveValue('aal3-registered');
  await expect(page.getByLabel('ROI B label',{exact:true})).toHaveValues(['91']);
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
  for(const side of ['A','B'])await expect(page.getByRole('button',{name:`Use as ROI ${side}`,exact:true})).toBeDisabled();
  await expect(page.getByLabel('Choose an atlas',{exact:true})).not.toHaveValue('aal3');
});

// Supplementary component interaction. The App/project container integration
// still belongs to W6; this mounts the real ROICompare against the real atlases.
test('unresolved A reference survives grid, B and threshold edits until explicit A reselection',async({page})=>{
  await page.route('**/src/App.jsx', route => route.fulfill({
    contentType:'application/javascript',
    body:"export {UnresolvedROIFixture as default} from '/tests/fixtures/roi-browser.jsx';"
  }));
  await page.goto('/?lang=en');  const fixture=page.locator('[data-s2-roi-fixture]');
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

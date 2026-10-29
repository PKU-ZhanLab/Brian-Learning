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
  const note = await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-notes')).at(-1));
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
    const notes=await page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-notes')).slice(-2));
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

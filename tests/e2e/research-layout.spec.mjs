// Authored for isolated, permitted CI. Desktop verification belongs to root CUA.
import {test,expect} from '@playwright/test';
const workspace=page=>page.getByRole('region',{name:'Literature workspace',exact:true});
const basket=page=>page.getByRole('region',{name:'Comparison basket',exact:true});
async function selectPapers(page,count=3){
  const cards=workspace(page).locator('.paper-card');
  await expect(cards.first()).toBeVisible();
  const ids=[];
  for(let i=0;i<count;i++){const card=cards.nth(i);ids.push(await card.getAttribute('data-reference-id'));await card.locator('.compare-paper').click();await expect(card.locator('.compare-paper')).toHaveAttribute('aria-pressed','true');}
  return ids;
}
test.beforeEach(async({page})=>{await page.goto('/?lang=en&mode=research');});

test('fourth selection keeps the original three until explicit replace/remove',async({page})=>{
  const ids=await selectPapers(page),fourth=workspace(page).locator('.paper-card').nth(3);
  const nextId=await fourth.getAttribute('data-reference-id');
  await fourth.locator('.compare-paper').click();
  await expect(basket(page).getByRole('status')).toContainText('Three papers selected');
  expect(await basket(page).locator('[data-basket-reference]').evaluateAll(nodes=>nodes.map(n=>n.dataset.basketReference))).toEqual(ids);
  await expect(fourth.locator('.compare-paper')).toHaveAttribute('aria-pressed','false');
  await basket(page).getByRole('button',{name:/^Replace /}).nth(1).click();
  expect(await basket(page).locator('[data-basket-reference]').evaluateAll(nodes=>nodes.map(n=>n.dataset.basketReference))).toEqual([ids[0],nextId,ids[2]]);
  await basket(page).locator('[data-basket-reference]').first().getByRole('button',{name:/^Remove/}).click();
  await expect(basket(page).locator('[data-basket-reference]')).toHaveCount(2);
});

for(const size of [{width:1366,height:768},{width:1920,height:1080}])for(const count of [2,3])test(`${count} papers use the main canvas and retain headers, dimensions and history at ${size.width}`,async({page})=>{
  await page.setViewportSize(size);
  const ids=await selectPapers(page,count);
  await basket(page).getByRole('button',{name:'Open comparison',exact:true}).click();
  await expect(page.locator('.workspace-layout')).toHaveAttribute('data-layout','compare');
  await expect(page.locator('.center-panel')).not.toBeVisible();
  const matrix=workspace(page).getByRole('region',{name:'Paper comparison table',exact:true});
  await expect(matrix.locator('thead th')).toHaveCount(count+1);
  expect(await matrix.boundingBox().then(r=>r.width)).toBeGreaterThan(size.width*.85);
  const dimensions=matrix.locator('tbody th').first(),header=matrix.locator('thead th').nth(1);
  const before=await dimensions.boundingBox();
  await matrix.evaluate(el=>{el.scrollLeft=240;el.scrollTop=180;});
  const expectedScroll=await matrix.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
  expect((await dimensions.boundingBox()).x).toBeCloseTo(before.x,0);
  expect((await header.boundingBox()).y).toBeLessThan((await matrix.boundingBox()).y+4);
  await workspace(page).getByRole('button',{name:'Open paper findings',exact:true}).first().click();
  await expect(workspace(page).locator('.paper-detail')).toBeVisible();
  await page.getByRole('button',{name:'Research back',exact:true}).click();
  await expect(matrix).toBeVisible();
  expect(await basket(page).locator('[data-basket-reference]').evaluateAll(nodes=>nodes.map(n=>n.dataset.basketReference))).toEqual(ids);
  await expect.poll(()=>matrix.evaluate(el=>el.scrollLeft)).toBe(expectedScroll.left);
  await expect.poll(()=>matrix.evaluate(el=>el.scrollTop)).toBe(expectedScroll.top);
  const bodySize=await matrix.locator('td').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(bodySize).toBeGreaterThanOrEqual(15);
});

test('width changes persist through the workspace codec, reset and history restore',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  const slider=page.getByRole('slider',{name:'Model panel width',exact:true});
  await slider.fill('390');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('neuroatlas-workspace-current-v1')).view.layout.panels.modelWidth)).toBe(390);
  await page.reload();
  await expect(slider).toHaveValue('390');
  await workspace(page).locator('.paper-open').first().click();
  await expect(workspace(page).locator('.paper-detail')).toBeVisible();
  await slider.fill('500');
  await expect(slider).toHaveValue('500');
  await page.getByRole('button',{name:'Research back',exact:true}).click();
  await expect(workspace(page).locator('.paper-card').first()).toBeVisible();
  await expect(slider).toHaveValue('390');
  await page.getByRole('button',{name:'Research forward',exact:true}).click();
  await expect(workspace(page).locator('.paper-detail')).toBeVisible();
  await expect(slider).toHaveValue('500');
  await page.getByRole('button',{name:'Model first',exact:true}).click();
  await expect(page.locator('.workspace-layout')).toHaveAttribute('data-layout','model');
  await page.getByRole('button',{name:'Evidence first',exact:true}).click();
  await expect(page.locator('.workspace-layout')).toHaveAttribute('data-layout','evidence');
  await page.getByRole('button',{name:'Reset widths',exact:true}).click();
  await expect(slider).not.toHaveValue('390');
});

test('the explicit Back to comparison restores outer and matrix scroll while keeping current membership and evidence edits',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  const ids=await selectPapers(page,3);
  await basket(page).getByRole('button',{name:'Open comparison',exact:true}).click();
  const matrix=workspace(page).getByRole('region',{name:'Paper comparison table',exact:true});
  await matrix.evaluate(el=>{el.scrollTop=180;el.scrollLeft=240;});
  await workspace(page).locator('.literature-scroll').evaluate(el=>{el.scrollTop=800;});
  const firstPaper=basket(page).locator('[data-basket-reference]').first().locator('.basket-paper-title');
  const expected=await workspace(page).evaluate(el=>({outer:el.querySelector('.literature-scroll').scrollTop,x:el.querySelector('.evidence-matrix').scrollLeft,y:el.querySelector('.evidence-matrix').scrollTop}));
  expect(expected.outer).toBeGreaterThan(0);
  await firstPaper.click();
  await workspace(page).getByRole('button',{name:'Edit metadata',exact:true}).click();
  const editedTitle='X3 current metadata retained after explicit comparison return';
  await workspace(page).locator('.evidence-editor').getByLabel('Title',{exact:true}).fill(editedTitle);
  await workspace(page).locator('.evidence-editor').getByRole('button',{name:/Save/,exact:false}).click();
  await workspace(page).getByRole('button',{name:'Back to comparison',exact:true}).click();
  await expect(matrix).toBeVisible();
  await expect(matrix.locator('thead')).toContainText(editedTitle);
  await expect.poll(()=>workspace(page).locator('.literature-scroll').evaluate(el=>el.scrollTop)).toBe(expected.outer);
  await expect.poll(()=>matrix.evaluate(el=>el.scrollLeft)).toBe(expected.x);
  await expect.poll(()=>matrix.evaluate(el=>el.scrollTop)).toBe(expected.y);
  expect(await basket(page).locator('[data-basket-reference]').evaluateAll(nodes=>nodes.map(n=>n.dataset.basketReference))).toEqual(ids);
  await basket(page).locator('[data-basket-reference]').first().locator('.basket-paper-title').click();
  await basket(page).locator('[data-basket-reference]').last().getByRole('button',{name:/^Remove/}).click();
  await workspace(page).getByRole('button',{name:'Back to comparison',exact:true}).click();
  await expect(matrix.locator('thead th')).toHaveCount(3);
  expect(await basket(page).locator('[data-basket-reference]').evaluateAll(nodes=>nodes.map(n=>n.dataset.basketReference))).toEqual(ids.slice(0,2));
  await expect(matrix.locator('thead')).toContainText(editedTitle);
});

for(const width of [390,650,768])test(`evidence, editing and model controls stay reachable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await expect(workspace(page)).toBeVisible();
  await workspace(page).locator('.paper-open').first().click();
  await workspace(page).getByRole('button',{name:'Add finding',exact:true}).click();
  await expect(workspace(page).locator('.evidence-editor')).toBeVisible();
  await expect(page.getByRole('button',{name:'Model first',exact:true})).toBeDisabled();
  await expect(workspace(page).locator('.evidence-editor textarea').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await workspace(page).getByRole('button',{name:'Cancel editing',exact:true}).click();
  await page.getByRole('group',{name:'Visible panel',exact:true}).getByRole('button',{name:'Model',exact:true}).click();
  await expect(page.locator('.center-panel')).toBeVisible();
  await page.getByRole('button',{name:'Anatomy controls',exact:true}).click();
  await expect(page.locator('.left-panel')).toBeVisible();
});

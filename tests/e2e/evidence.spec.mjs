import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {buildEvidenceSearchIndex,searchEvidence} from '../../src/lib/evidence-search.js';
import {curatedEvidence} from '../../src/data/results.js';
import {literaturePapers} from '../../src/data/literature.js';
import {references} from '../../src/data/references.js';
import {additionalReferences} from '../../src/data/references-expanded.js';
import {additionalLiteratureReferences} from '../../src/data/literature.js';
import {structures} from '../../src/data/catalog.js';

test('search: bilingual aliases keep paper methods separate from recorded results',async({page})=>{
  const aliases=JSON.parse(await readFile(new URL('../../data-sources/results/search-aliases.json',import.meta.url),'utf8'));
  const index=buildEvidenceSearchIndex({...curatedEvidence,references:[...references,...additionalReferences,...additionalLiteratureReferences,...curatedEvidence.references],readings:literaturePapers},{aliases,regions:structures});
  await page.goto('/?lang=en&mode=research');
  const workspace=page.getByRole('region',{name:'Literature workspace'});
  const search=workspace.getByRole('textbox',{name:'Search papers, authors or regions'});
  await workspace.getByRole('checkbox',{name:/Current region only/}).uncheck();
  for(const query of ['pre-SMA','pre SMA','BA44','BA44/45','停止','inhibitory']){
    await search.fill(query);
    const expected=searchEvidence(index,{query}).map(hit=>hit.referenceId).sort();
    await expect(workspace.locator('.paper-card')).toHaveCount(expected.length);
    expect((await workspace.locator('.paper-card').evaluateAll(cards=>cards.map(card=>card.dataset.referenceId))).sort()).toEqual(expected);
    await page.getByRole('button',{name:'切换为中文',exact:true}).click();
    const chinese=page.getByRole('region',{name:'文献工作台'});
    expect((await chinese.locator('.paper-card').evaluateAll(cards=>cards.map(card=>card.dataset.referenceId))).sort()).toEqual(expected);
    await page.getByRole('button',{name:'Switch to English',exact:true}).click();
  }
  await search.fill('pre-SMA');
  await workspace.getByRole('combobox',{name:'Filter by research topic'}).selectOption('control');
  await workspace.getByRole('combobox',{name:'Paper methods',exact:true}).selectOption('fMRI');
  const expected=searchEvidence(index,{query:'pre-SMA',topic:'control',paperModality:'fMRI'});
  await expect(workspace.locator('.paper-card')).toHaveCount(expected.length);
  await workspace.locator('[data-reference-id="schaum2021"] .paper-open').click();
  const result=workspace.locator('[data-result-id="schaum2021-meg-stop"]');
  await expect(result).toHaveCount(1);
  await expect(result.locator('.modality-tags')).toContainText('MEG');
  await expect(result.locator('.modality-tags')).not.toContainText('fMRI');
  expect(await workspace.locator('.evidence-result').evaluateAll(results=>results.map(result=>result.dataset.resultId))).toEqual(expected.find(hit=>hit.referenceId==='schaum2021').resultIds);
  await expect(workspace.locator('[data-support="direct"][data-target-region*="sma"]')).toHaveCount(0);
  await workspace.getByRole('combobox',{name:'Recorded result methods',exact:true}).selectOption('fMRI');
  await expect(workspace.locator('[data-reference-id="schaum2021"]')).toHaveCount(0);
  await workspace.getByRole('combobox',{name:'Recorded result methods',exact:true}).selectOption('MEG');
  await expect(workspace.locator('[data-reference-id="schaum2021"]')).toHaveCount(1);
});

// Isolated CI browser only. The desktop scene is verified separately through CUA.
test('mapping: opening Silani locates only the supported right hemisphere',async({page})=>{
  await page.goto('/?lang=en&mode=research');
  const workspace=page.getByRole('region',{name:'Literature workspace'});
  await workspace.getByRole('textbox',{name:'Search papers, authors or regions'}).fill('Silani');
  await workspace.locator('.paper-open').click();
  const selected=page.locator('.structure-row.selected');
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(/右缘上回|right supramarginal/i);
  const left=workspace.locator('details[data-target-region="supramarginal-l"]');
  await expect(left).toHaveAttribute('data-support','context');
  await expect(left.getByRole('button')).not.toBeVisible();
  await left.locator('summary').click();
  await expect(left).toContainText('not evidence for the same intervention result');
  await expect(left).toContainText('right supramarginal gyrus');
  await left.getByRole('button',{name:/Locate context/}).click();
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(/左缘上回|left supramarginal/i);
});

test('mapping: scalp ERP links require explicit contextual navigation',async({page})=>{
  await page.goto('/?lang=en&mode=research');
  const workspace=page.getByRole('region',{name:'Literature workspace'});
  await workspace.getByRole('textbox',{name:'Search papers, authors or regions'}).fill('Bentin');
  await workspace.locator('.paper-open').click();
  await expect(page.locator('.structure-row.selected')).toHaveCount(0);
  await expect(workspace.locator('[data-support="direct"]')).toHaveCount(0);
  const contextual=workspace.locator('[data-mapping-id="reading:bentin1996:fusiform-l"]');
  await contextual.locator('summary').click();
  await expect(contextual).toContainText('Scalp electrodes are not source coordinates');
  await expect(contextual).toContainText('posterior temporal scalp electrodes (N170)');
});

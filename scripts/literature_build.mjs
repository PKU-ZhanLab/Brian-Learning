/** Rebuild the bilingual reading library from curated annotations and cached records. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {references} from '../src/data/references.js';
import {additionalReferences} from '../src/data/references-expanded.js';
import {evidenceByStructureId,atlasEvidence,evidenceFields} from '../src/data/evidence.js';
import {paperAnnotations} from '../data-sources/literature-upgrade/curation.mjs';
import {literatureTopics,literatureModalities,studyTypeLabels,associationLabels,speciesLabels,populationOverrides,newPaperMappings,paperScopeOverrides,literatureDebates,curatedFigures} from '../data-sources/literature-upgrade/discovery.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceDir=path.join(root,'data-sources/literature-upgrade');
const metadata=JSON.parse(await readFile(path.join(sourceDir,'metadata.json'),'utf8'));
const verification=JSON.parse(await readFile(path.join(root,'data-sources/literature/verification.json'),'utf8'));
const b=(zh,en)=>({zh,en});
const sha=s=>createHash('sha256').update(s).digest('hex');
if(metadata.records.some(r=>r.status!=='verified'))throw Error('New bibliography contains unresolved records.');
const additionalLiteratureReferences=metadata.records.map(({reference:r})=>({...r,summaryEn:paperAnnotations[r.id].en,...(r.id==='parvizi2012'?{verificationNoteEn:'PubMed contains Witthoft/Withoft spelling records for the same author. The full author list follows the publisher/Crossref list of seven authors.'}:{})}));
const allRefs=[...references,...additionalReferences,...additionalLiteratureReferences];
const refById=Object.fromEntries(allRefs.map(r=>[r.id,r]));
const inverse=new Map();
for(const [structureId,e] of Object.entries(evidenceByStructureId))for(const field of evidenceFields)for(const item of e[field]||[]){
  if(!inverse.has(item.refId))inverse.set(item.refId,new Map());
  const maps=inverse.get(item.refId);
  if(!maps.has(structureId))maps.set(structureId,{structureId,sourceFields:[],scopes:[]});
  const m=maps.get(structureId);if(!m.sourceFields.includes(field))m.sourceFields.push(field);if(!m.scopes.includes(item.scope))m.scopes.push(item.scope);
}
const atlasInverse={};
for(const [atlasId,entries] of Object.entries(atlasEvidence))for(const e of entries)(atlasInverse[e.refId]??=[]).push(atlasId);
const anatomyTypes=new Set(['atlas','anatomical-study','methods-study']);
const synthesisTypes=new Set(['review','meta-analysis']);
const backgroundTypes=new Set(['book','documentation','clinical-standard']);
const limits={
  anatomical:b('解剖名称、样本概率或模板对应不证明整个脑区的独占功能；本页不提供个体定位。','Anatomical names, sample probabilities and template correspondence do not establish an exclusive function for a whole region or individual localization.'),
  synthesis:b('这是既有研究的综合；任务、亚区、物种和左右侧应分别核对，不能将宏观标签视为功能边界。','This synthesizes previous studies. Tasks, subregions, species and hemispheres must be checked separately; gross-anatomy labels are not functional boundaries.'),
  perturbational:b('干预的电流、刺激范围、网络传播和样本限制决定推论；不能外推到完整脑回或任一个体。','Current, stimulation spread, network effects and sampling constrain the inference; results do not generalize to a whole gyrus or every individual.'),
  'lesion-informed':b('病灶往往跨越多个结构及连接；症状关联不能自动证明单一区域的唯一作用。','Lesions often span several structures and connections; symptom associations do not automatically establish a unique role for one region.'),
  correlational:b('支持特定任务和样本中的关联；不能单独证明因果必要性、整个脑区功能均一或个体诊断。','Supports an association under the studied task and sampling conditions, not causal necessity, uniform function across a whole region or individual diagnosis.'),
  background:b('这是教材、标准或背景资料；不能替代当前脑区的专门原始研究或临床评估。','A book, standard or background source does not replace an original study of this region or a clinical assessment.'),
  theoretical:b('这是计算或概念解释框架；区分理论需要检验其预测，单个激活点不足以裁决。','A computational or conceptual framework must be assessed through tests of its predictions; a single activation point cannot adjudicate it.'),
};
function strength(type){return anatomyTypes.has(type)?'anatomical':synthesisTypes.has(type)?'synthesis':backgroundTypes.has(type)?'background':type==='theory'?'theoretical':['stimulation-study','clinical-intervention'].includes(type)?'perturbational':type==='lesion-study'?'lesion-informed':'correlational';}
function relation(type){return anatomyTypes.has(type)?'anatomy':synthesisTypes.has(type)||backgroundTypes.has(type)||type==='theory'?'review-association':type==='lesion-study'?'lesion':['stimulation-study','clinical-intervention'].includes(type)?'stimulation':type==='functional-localizer'?'functional-localizer':'task-association';}
async function sourceInfo(id){
  const newer=metadata.records.find(r=>r.id===id);
  if(newer)return {abstract:newer.abstract,mesh:newer.mesh,sources:newer.sources};
  let abstract='',mesh=[];
  try {const raw=JSON.parse(await readFile(path.join(root,'data-sources/literature/raw',`${id}.europepmc.json`),'utf8'));const results=JSON.parse(raw.raw).resultList?.result||[];const ep=results.find(x=>x.source==='MED'&&(!refById[id].pmid||x.id===String(refById[id].pmid)));abstract=ep?.abstractText||'';mesh=ep?.meshHeadingList?.meshHeading||[];}catch{}
  return {abstract,mesh,sources:(verification.records.find(r=>r.id===id)?.sources||[]).filter(s=>s.ok!==false).map(({url,sha256,retrievedAt})=>({url,sha256,retrievedAt}))};
}
function inferredSpecies(info){const names=(info.mesh||[]).map(m=>m.descriptorName);const human=names.includes('Humans');const animal=names.includes('Animals');return human&&animal?'mixed':human?'human':animal?'mixed':'unspecified';}
const figureAudit=[];
const figuresByRef={};
for(const fig of curatedFigures){
  const raw=JSON.parse(await readFile(path.join(sourceDir,'raw',`${fig.referenceId}.fulltext.json`),'utf8'));
  if(!raw.ok||sha(raw.raw)!==raw.sha256)throw Error(`Invalid full-text cache: ${fig.referenceId}`);
  if(!raw.raw.includes(`<article-id pub-id-type="pmcid">${fig.pmcid}</article-id>`)||!new RegExp(`<fig\\b[^>]*\\bid="${fig.figureId}"`).test(raw.raw))throw Error(`Figure/PMCID mismatch: ${fig.referenceId}/${fig.figureId}`);
  if(fig.license.startsWith('CC BY')&&!raw.raw.includes(fig.licenseUrl.replace(/^https:/,'http:'))&&!raw.raw.includes(fig.licenseUrl))throw Error(`Missing license: ${fig.referenceId}`);
  const url=`https://pmc.ncbi.nlm.nih.gov/articles/${fig.pmcid}/#${fig.figureId}`;
  const entry={...fig,label:b(fig.label.replace('Figure','图'),fig.label),url,source:url,canEmbed:false,verifiedAt:'2026-10-25',verification:{source:raw.url,sha256:raw.sha256,retrievedAt:raw.retrievedAt}};
  (figuresByRef[fig.referenceId]??=[]).push(entry);
  figureAudit.push({...entry,verificationScope:'Figure identifier, article identity and article license checked in source XML; captions are short editorial paraphrases. No figure asset is redistributed.'});
}
const noCoordinates=b('本条没有可直接用于当前模板的已核验坐标；三维关联只定位阅读区域。','No verified coordinates directly usable in the current template are attached; 3D links locate regions for reading only.');
const contextualSides={dubois2006:'r',badre2005:'r',badre2007:'r',paulesu1993:'r',silani2013:'l',critchley2004:'l',dronkers2007:'r'};
const literaturePapers=[];
for(const r of allRefs){
  const a=paperAnnotations[r.id];if(!a)throw Error(`Missing bilingual annotation: ${r.id}`);
  const info=await sourceInfo(r.id);
  const studyType=a.studyType||'review';const associationStrength=strength(studyType);
  const modalities=a.modalities||['review-mixed'];const species=a.species||inferredSpecies(info);
  const paperLimit=paperScopeOverrides[r.id]||a.scope||limits[associationStrength];
  const baseMaps=[...(inverse.get(r.id)?.values()||[])];
  let mappedRegions=baseMaps.map(m=>{
    const contextual=contextualSides[r.id]&&m.structureId.endsWith(`-${contextualSides[r.id]}`);
    return {structureId:m.structureId,relation:contextual?'review-association':relation(studyType),space:null,coordinates:null,source:r.url,sourceKind:'curated-region-reading',sourceFields:m.sourceFields,directEvidence:!contextual&&!['synthesis','background','theoretical'].includes(associationStrength),limitations:b([...m.scopes,paperLimit.zh,noCoordinates.zh].join(' '),`${paperLimit.en} ${noCoordinates.en}`)};
  });
  if(newPaperMappings[r.id])mappedRegions=newPaperMappings[r.id].flatMap(m=>m.structureIds.map(structureId=>({structureId,relation:m.relation,space:null,coordinates:null,source:m.source||r.url,sourceKind:m.sourceKind,sourceFields:['function'],directEvidence:m.relation!=='review-association',limitations:b(`${m.limitations.zh} ${noCoordinates.zh}`,`${m.limitations.en} ${noCoordinates.en}`)})));
  for(const m of mappedRegions)if(!evidenceByStructureId[m.structureId])throw Error(`Unknown region: ${r.id}/${m.structureId}`);
  const population=populationOverrides[r.id]||b(`${speciesLabels[species].zh}；${studyTypeLabels[studyType].zh}。具体样本与纳入范围见原文。`,`${speciesLabels[species].en}; ${studyTypeLabels[studyType].en.toLowerCase()}. See the source for exact sampling and inclusion criteria.`);
  const sourceFields=[...new Set(mappedRegions.flatMap(m=>m.sourceFields))];
  const claimField=anatomyTypes.has(studyType)?'anatomy':studyType==='clinical-standard'?'clinical':sourceFields.includes('function')?'function':sourceFields.includes('cognition')?'cognition':sourceFields.includes('clinical')?'clinical':'result';
  literaturePapers.push({id:r.id,referenceId:r.id,modalities,topics:a.topics,species,speciesLabel:speciesLabels[species],studyType,studyTypeLabel:studyTypeLabels[studyType],population,associationStrength,associationStrengthLabel:associationLabels[associationStrength],mappedRegions,atlasAssociations:atlasInverse[r.id]||[],resultSummaries:b(r.summary,a.en),figures:figuresByRef[r.id]||[],claims:[{regionIds:mappedRegions.map(m=>m.structureId),field:claimField,text:b(r.summary,a.en),source:r.url,limitations:paperLimit}],methodProvenance:{source:r.url,sourceKind:info.abstract?'abstract-plus-curation':'title-record-plus-curation',metadataSources:info.sources,verifiedAt:'2026-10-25'},coordinateStatus:'not-extracted',limitations:paperLimit});
}
const exports={additionalLiteratureReferences,literatureTopics,literatureModalities,literaturePapers,literatureDebates};
const output='// Generated by scripts/literature_build.mjs from verified records and bilingual editorial annotations.\n// Region links are reading associations, not extracted activation coordinates.\n'+Object.entries(exports).map(([key,value])=>`export const ${key} = ${JSON.stringify(value,null,2)};\n`).join('\n')+'\nexport const literatureByReferenceId = Object.fromEntries(literaturePapers.map(p => [p.referenceId, p]));\n';
await writeFile(path.join(root,'src/data/literature.js'),output);
await writeFile(path.join(sourceDir,'figure-audit.json'),JSON.stringify({verifiedAt:'2026-10-25',figures:figureAudit},null,2)+'\n');
console.log(JSON.stringify({papers:literaturePapers.length,newReferences:additionalLiteratureReferences.length,regionLinks:literaturePapers.reduce((n,p)=>n+p.mappedRegions.length,0),topics:literatureTopics.length,modalities:literatureModalities.length,debates:literatureDebates.length,verifiedFigureLinks:figureAudit.length,coordinates:0}));

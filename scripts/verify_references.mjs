/** Reproducible metadata audit. Native Node only; never installs packages. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { references as existingReferences } from '../src/data/references.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'data-sources/literature');
const auditDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(process.argv.includes('--check')) {
  const {structures}=await import('../src/data/catalog.js');
  const {additionalReferences}=await import('../src/data/references-expanded.js');
  const {evidenceByStructureId,atlasEvidence,evidenceFields,evidenceReferenceIds}=await import('../src/data/evidence.js');
  const refs=[...existingReferences,...additionalReferences];const refIds=new Set(refs.map(r=>r.id));
  const v=JSON.parse(await readFile(path.join(out,'verification.json'),'utf8'));
  const cache=await Promise.all((await readdir(path.join(out,'raw'))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(path.join(out,'raw',f),'utf8'))));
  const failures=[];
  for(const raw of cache.filter(r=>r.ok)) if(createHash('sha256').update(raw.raw).digest('hex')!==raw.sha256) failures.push('Raw cache hash mismatch: '+raw.url);
  for(const row of v.records) for(const source of row.sources||[]) if(source.ok!==false&&!cache.some(c=>c.ok&&c.url===source.url&&c.sha256===source.sha256)) failures.push('Missing audited cache: '+row.id);
  for(const s of structures) if(!evidenceByStructureId[s.id]) failures.push('Missing structure evidence: '+s.id);
  for(const [id,e] of Object.entries(evidenceByStructureId)) {
    for(const f of evidenceFields) if(!Array.isArray(e[f])) failures.push('Missing field: '+id+'/'+f);
    for(const ref of evidenceReferenceIds(e)) if(!refIds.has(ref)) failures.push('Unknown ref: '+id+'/'+ref);
    for(const c of evidenceFields.flatMap(f=>e[f]||[])) if(!c.claim||!c.scope) failures.push('Missing claim or scope: '+id);
    if(!e.gaps?.length) failures.push('Missing interpretation limits: '+id);
  }
  for(const [id,claims] of Object.entries(atlasEvidence)) for(const c of claims) if(!refIds.has(c.refId)) failures.push('Unknown atlas ref: '+id+'/'+c.refId);
  for(const r of additionalReferences) if(!r.title||!r.authors||!r.year||!r.doi||!r.metadataSources?.length) failures.push('Incomplete metadata: '+r.id);
  if(refIds.size!==refs.length) failures.push('Duplicate reference IDs');
  const summary={structures:structures.length,evidenceRecords:Object.keys(evidenceByStructureId).length,references:refs.length,rawRecords:cache.length,fieldCoverage:Object.fromEntries(evidenceFields.map(f=>[f,Object.values(evidenceByStructureId).filter(e=>e[f].length).length])),levels:Object.values(evidenceByStructureId).reduce((s,e)=>(s[e.level]=(s[e.level]||0)+1,s),{}),failures};
  console.log(JSON.stringify(summary,null,2));process.exit(failures.length?1:0);
}
await mkdir(path.join(out, 'raw'), { recursive: true });
const candidates = JSON.parse(await readFile(path.join(out, 'candidates.json'), 'utf8'));
const extra = [
  {id:'lancaster2000',title:'Automated Talairach atlas labels for functional brain mapping',doi:'10.1002/1097-0193(200007)10:3<120::aid-hbm30>3.0.co;2-8',type:'anatomy',summary:'验证 Talairach Daemon 的坐标标签检索；其历史 BA 标签不等于现代概率细胞构筑学分区。'},
  {id:'lancaster2007',title:'Bias between MNI and Talairach coordinates analyzed using the ICBM-152 brain template',doi:'10.1002/hbm.20345',type:'anatomy',summary:'量化 MNI 与 Talairach 坐标的参考框架及尺度差异，支持显式空间转换而非直接混用。'},
  {id:'amunts1999',title:"Broca's region revisited: cytoarchitecture and intersubject variability",doi:'10.1002/(sici)1096-9861(19990920)412:2<319::aid-cne10>3.0.co;2-7',type:'anatomy',method:'人体尸检组织学',summary:'定量划分人脑44/45区并显示明显个体差异；细胞构筑边界不能仅由脑沟外观确定。'},
  {id:'geyer2000',title:'Areas 3a, 3b, and 1 of human primary somatosensory cortex. Part 2. Spatial normalization to standard anatomical space',doi:'10.1006/nimg.2000.0548',type:'anatomy',method:'人体组织学概率图',summary:'将3a、3b、1区组织学分区带入标准空间，描述10个人脑的区域变异与重叠概率。'},
  {id:'grefkes2001',title:'Human somatosensory area 2: observer-independent cytoarchitectonic mapping, interindividual variability, and population map',doi:'10.1006/nimg.2001.0858',type:'anatomy',method:'人体组织学概率图',summary:'以观察者无关方法定义人类体感2区，提供10个人脑的空间概率分布和个体变异。'},
  {id:'geyer1996',title:'Two different areas within the primary motor cortex of man',doi:'10.1038/382805a0',type:'anatomy',method:'人体组织学、受体分布与PET',summary:'根据细胞构筑、递质结合位点和功能影像将人类初级运动皮层分为4a和4p。'},
  {id:'amunts2000',title:"Brodmann's areas 17 and 18 brought into stereotaxic space-where and how variable?",doi:'10.1006/nimg.1999.0516',type:'anatomy',method:'人体组织学概率图',summary:'重建人类17/18区并量化半球和个体差异；Talairach中历史近似BA位置不等于组织学精确边界。'},
  {id:'geyer2004',title:'The microstructural border between the motor and the cognitive domain in the human cerebral cortex',doi:'10.1007/978-3-642-18910-4',type:'anatomy',method:'人体微结构分区综述',summary:'分析运动与前额叶认知区域之间的微结构边界，提供人类6区及邻近区域的解剖依据。'},
  {id:'rupp2026',title:'International Standards for Neurological Classification of Spinal Cord Injury: 9th edition 2026',doi:'10.46292/sci26-00067',type:'review',method:'人体临床检查分类标准',summary:'介绍脊髓损伤的标准化感觉与运动检查及神经学分类；临床神经节段、椎骨水平与影像坐标须分别识别。'},
  {id:'gibo1981',title:'Microsurgical anatomy of the middle cerebral artery',doi:'10.3171/jns.1981.54.2.0151',type:'anatomy',method:'人体标本显微解剖',summary:'基于 50 个大脑半球描述大脑中动脉分段、分支和变异；不是个体血管模型。'},
  {id:'traylor2022',title:'Cranial Nerve Anatomy',doi:'10.1016/j.nic.2022.04.004',type:'anatomy',summary:'按各颅神经介绍功能和全程走行，并讨论 MRI 与骨性孔道 CT 的不同用途。'},
  {id:'haller2016',title:'Imaging of Neurovascular Compression Syndromes: Trigeminal Neuralgia, Hemifacial Spasm, Vestibular Paroxysmia, and Glossopharyngeal Neuralgia',doi:'10.3174/ajnr.A4683',type:'review',summary:'综述三叉、面、前庭蜗及舌咽神经血管压迫综合征；神经血管接触并不自动构成有症状压迫。'},
  {id:'romano2019',title:'Imaging of cranial nerves: a pictorial overview',doi:'10.1186/s13244-019-0719-5',type:'review',summary:'提供颅神经走行和病变的图像综述，支持逐神经的基础功能与临床定位教学。'},
];
const all = [...existingReferences.filter(r=>!candidates.some(c=>c.id===r.id)&&!extra.some(c=>c.id===r.id)),...candidates,...extra];
const normalize = s => String(s||'').normalize('NFKD').replace(/<[^>]*>/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const hash = s => createHash('sha256').update(s).digest('hex');
async function request(id, service, url) {
  const filename = path.join(out,'raw',`${id}.${service}.json`);
  try { const saved=JSON.parse(await readFile(filename,'utf8')); if(saved.url===url&&saved.ok) return saved; } catch {}
  let record;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{headers:{'User-Agent':'BrainModelEvidenceAudit/1.0 (educational bibliography verification)','Accept':'application/json'},signal:AbortSignal.timeout(30000)});
      const raw=await response.text();
      record={url,retrievedAt:new Date().toISOString(),status:response.status,ok:response.ok,sha256:hash(raw),raw};
      if(response.ok||response.status===404) break;
    } catch(error) { record={url,retrievedAt:new Date().toISOString(),ok:false,error:error.message}; }
  }
  await writeFile(filename,JSON.stringify(record,null,2)+'\n');
  return record;
}
function crossrefMeta(record) {
  if(!record?.ok) return null;
  try {const m=JSON.parse(record.raw).message;const title=m.title?.[0]||'';const subtitle=m.subtitle?.[0];return {...m,title:subtitle&&!normalize(title).includes(normalize(subtitle))?`${title}: ${subtitle}`:title};}catch{return null;}
}
async function crossref(id,doi,suffix='crossref') { return request(id,suffix,`https://api.crossref.org/works/${encodeURIComponent(doi)}`); }
async function europe(id,query,suffix='europepmc') { return request(id,suffix,'https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+new URLSearchParams({query,format:'json',resultType:'core',pageSize:'10'})); }
async function audit(candidate) {
  const row={id:candidate.id,requestedTitle:candidate.title,requestedDoi:candidate.doi||null,verifiedAt:auditDate,sources:[],issues:[]};
  if(!candidate.doi&&!candidate.pmid&&(candidate.kind==='book'||candidate.kind==='web')) {
    const r=await request(candidate.id,'official',candidate.url);
    row.sources.push({service:'official',url:r.url,sha256:r.sha256,retrievedAt:r.retrievedAt});
    row.status=r.ok?'official-source-retrieved':'unresolved';row.reference=candidate;return row;
  }
  let crRaw=candidate.doi?await crossref(candidate.id,candidate.doi):null;
  let cr=crossrefMeta(crRaw);
  const crMatches=cr&&normalize(cr.title)===normalize(candidate.title);
  if(cr&&!crMatches) row.issues.push(`Requested DOI title mismatch: ${cr.title}`);
  const query=candidate.pmid?`EXT_ID:${candidate.pmid} AND SRC:MED`:crMatches?`DOI:"${candidate.doi}"`:`TITLE:"${candidate.title.replaceAll('"','')}"`;
  let epRaw=await europe(candidate.id,query);
  const results=epRaw.ok?JSON.parse(epRaw.raw).resultList?.result||[]:[];
  let ep=results.find(r=>normalize(r.title)===normalize(candidate.title))||results.find(r=>candidate.pmid&&r.id===String(candidate.pmid));
  if(!ep&&crMatches) ep=results.find(r=>normalize(r.doi)===normalize(candidate.doi));
  if(ep?.doi&&(!crMatches||normalize(cr?.DOI)!==normalize(ep.doi))) {
    crRaw=await crossref(candidate.id,ep.doi,'crossref-resolved');cr=crossrefMeta(crRaw);
  }
  for(const [service,r] of [['crossref',crRaw],['europepmc',epRaw]]) if(r) row.sources.push({service,url:r.url,sha256:r.sha256,retrievedAt:r.retrievedAt,ok:r.ok});
  const exact=ep?normalize(ep.title)===normalize(candidate.title):cr?normalize(cr.title)===normalize(candidate.title):false;
  if(!exact) {row.status='unresolved';row.possibleMatches=results.map(r=>({title:r.title,pmid:r.id,doi:r.doi}));return row;}
  const journal=ep?.journalInfo?.journal?.title||cr?.['container-title']?.[0]||'';
  const volume=ep?.journalInfo?.volume||cr?.volume||'';
  const issue=ep?.journalInfo?.issue||cr?.issue||'';
  const fullAuthors=ep?.authorList?.author?.map(a=>a.fullName||`${a.lastName} ${a.initials}`)||cr?.author?.map(a=>[a.family,a.given].filter(Boolean).join(' '))||[];
  const doi=ep?.doi||cr?.DOI||candidate.doi||null;
  const pmid=ep?.source==='MED'?ep.id:null;
  const year=Number(ep?.pubYear||cr?.published?.['date-parts']?.[0]?.[0]);
  const authors=fullAuthors.slice(0,3).join(', ')+(fullAuthors.length>3?', et al.':'');
  row.status=ep&&cr&&normalize(ep.title)===normalize(cr.title)?'cross-verified':'single-registry-verified';
  row.crossCheck={title:ep&&cr?normalize(ep.title)===normalize(cr.title):null,doi:ep?.doi&&cr?.DOI?normalize(ep.doi)===normalize(cr.DOI):null,firstAuthor:ep&&cr?normalize(ep.authorList?.author?.[0]?.lastName)===normalize(cr.author?.[0]?.family):null,year:ep&&cr?year===Number((cr['published-print']||cr.published)?.['date-parts']?.[0]?.[0]):null,volume:ep&&cr?String(ep.journalInfo?.volume||'')===String(cr.volume||''):null,pages:ep&&cr?{europepmc:ep.pageInfo||'',crossref:cr.page||cr['article-number']||''}:null};
  row.reference={...candidate,title:(ep?.title||cr.title).replace(/\.$/,''),authors,year,journal,volume:String(volume)+(issue?`(${issue})`:''),pages:ep?.pageInfo||cr?.page||cr?.['article-number']||'',pmid,doi,url:pmid?`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`:`https://doi.org/${doi}`,verified:row.verifiedAt,verificationStatus:row.status,fullAuthorList:fullAuthors,metadataSources:row.sources.map(s=>s.url)};
  if(candidate.id==='limousin1995'&&cr?.DOI?.toLowerCase()==='10.1016/s0140-6736(95)90062-4'&&pmid==='7815888') {
    row.status='cross-verified-with-title-variant';
    row.reference.title=cr.title;row.reference.verificationStatus=row.status;
    row.reference.verificationNote='Crossref/出版社题名为 Effect on；PubMed/Europe PMC 转录为 Effect of。DOI、作者、年份、卷页一致，采用出版社题名。';
  }
  const variations={
    schmahmann1998:'卷期格式不同：Crossref 为121(4)，PubMed 为121 (Pt 4)，属于同一期。',
    melzack1965:'Crossref另含说明性副标题；采用PubMed及常用书目中的主标题。',
    dubois2006:'姓氏前缀拆分不同：Crossref列Boisgueheneuc，PubMed列du Boisgueheneuc；采用PubMed完整姓氏。',
    craig2009:'Crossref将昵称(Bud)列入family；采用PubMed的Craig AD，保留原始记录。',
    gazzaniga2000:'卷期格式不同：Crossref为123(7)，PubMed为123 (Pt 7)，采用标准卷(期)格式。',
    geyer2000:'Crossref题名省略Part 2及其副标题；DOI、作者、年份和卷页一致，采用PubMed完整题名。',
    geyer2004:'Crossref作为专著注册，PubMed作为Advances in Anatomy, Embryology and Cell Biology第174卷索引；采用专著类型。',
  };
  if(variations[candidate.id]) {row.status='cross-verified-with-metadata-variant';row.reference.verificationStatus=row.status;row.reference.verificationNote=variations[candidate.id];}
  if(['schmahmann1998','gazzaniga2000'].includes(candidate.id)) row.reference.volume=`${cr.volume}(${cr.issue})`;
  if(candidate.id==='geyer2004') Object.assign(row.reference,{kind:'book',place:'Berlin, Heidelberg',journal:'Springer',volume:'Advances in Anatomy, Embryology and Cell Biology, 174',series:'Advances in Anatomy, Embryology and Cell Biology',isbn:cr.ISBN});
  if(['hafting2005','padoaschioppa2006','graziano2002'].includes(candidate.id)) row.reference.type='physiology';
  if(candidate.id==='limousin1995') row.reference.type='intervention';
  return row;
}
const rows=[];let next=0;
await Promise.all(Array.from({length:3},async()=>{while(next<all.length){const c=all[next++];try{const row=await audit(c);rows.push(row);console.log(`${rows.length}/${all.length} ${c.id}: ${row.status}`);}catch(error){rows.push({id:c.id,status:'unresolved',error:error.message});console.log(`${c.id}: ERROR ${error.message}`);}}}));
rows.sort((a,b)=>all.findIndex(c=>c.id===a.id)-all.findIndex(c=>c.id===b.id));
const bad=rows.filter(r=>r.status==='unresolved');
const auditPayload=JSON.stringify({generatedAt:new Date().toISOString(),policy:'Crossref DOI-first then Europe PMC metadata; exact normalized title required in at least one registry; explicit metadata variations retained; no inferred PMID; abstracts are not full-text audits.',records:rows},null,2)+'\n';
await writeFile(path.join(out,bad.length?'verification-attempt.json':'verification.json'),auditPayload);
const baseIds=new Set(existingReferences.map(r=>r.id));
const added=rows.filter(r=>r.reference&&!baseIds.has(r.id)).map(r=>r.reference);
if(!bad.length) await writeFile(path.join(root,'src/data/references-expanded.js'),'// Generated from cached primary metadata by scripts/verify_references.mjs.\n// Metadata verification is not full-text or human clinical validation.\nexport const additionalReferences = '+JSON.stringify(added,null,2)+';\n');
console.log(JSON.stringify({total:rows.length,added:added.length,unresolved:bad.map(r=>r.id)},null,2));
if(bad.length)process.exitCode=2;

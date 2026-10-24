/** Native-Node fetcher; stores successful primary records without installing packages. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data-sources/literature-upgrade');
await mkdir(path.join(dir,'raw'),{recursive:true});
const input=JSON.parse(await readFile(path.join(dir,'candidates.json'),'utf8'));
const norm=s=>String(s||'').normalize('NFKD').replace(/<[^>]+>/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const sha256=s=>createHash('sha256').update(s).digest('hex');
async function fetchRecord(id,kind,url) {
  const filename=path.join(dir,'raw',`${id}.${kind}.json`);
  try {const p=JSON.parse(await readFile(filename,'utf8'));if(p.url===url&&p.ok)return p;}catch{}
  let record;
  for(let attempt=0;attempt<3;attempt++) {
    try {const response=await fetch(url,{headers:{'User-Agent':'BrainLearningLiterature/1.0 (educational citation audit)'},signal:AbortSignal.timeout(30000)});const raw=await response.text();record={url,retrievedAt:new Date().toISOString(),status:response.status,ok:response.ok,sha256:sha256(raw),raw};if(response.ok||response.status===404)break;}
    catch(error){record={url,retrievedAt:new Date().toISOString(),ok:false,error:error.message};}
  }
  await writeFile(filename,JSON.stringify(record,null,2)+'\n');return record;
}
const records=[];
for(const c of input) {
  const crRaw=await fetchRecord(c.id,'crossref',`https://api.crossref.org/works/${encodeURIComponent(c.doi)}`);
  const cr=crRaw.ok?JSON.parse(crRaw.raw).message:null;
  const query=c.pmid?`EXT_ID:${c.pmid} AND SRC:MED`:`DOI:"${c.doi}"`;
  const epRaw=await fetchRecord(c.id,'europepmc','https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+new URLSearchParams({query,format:'json',resultType:'core',pageSize:'10'}));
  const results=epRaw.ok?JSON.parse(epRaw.raw).resultList?.result||[]:[];
  const ep=results.find(r=>r.source==='MED'&&(r.id===c.pmid||norm(r.doi)===norm(c.doi)));
  const titleMatch=!!ep&&norm(ep.title)===norm(c.title);const doiMatch=!!cr&&norm(cr.DOI)===norm(ep?.doi);
  if(!titleMatch||!doiMatch) {records.push({id:c.id,status:'unresolved',requested:c,crossrefTitle:cr?.title,europepmc:results});console.log(c.id+': unresolved');continue;}
  let fulltext=null;
  if(ep.pmcid) fulltext=await fetchRecord(c.id,'fulltext',`https://www.ebi.ac.uk/europepmc/webservices/rest/${ep.pmcid}/fullTextXML`);
  let authors=ep.authorList?.author?.map(a=>a.fullName)||[];
  if(c.id==='parvizi2012'&&cr?.author?.length) authors=cr.author.map(a=>`${a.family} ${(a.given||'').split(/[\s.-]+/).filter(Boolean).map(p=>p[0]).join('')}`);
  const ji=ep.journalInfo||{};
  const reference={...c,authors:authors.slice(0,3).join(', ')+(authors.length>3?', et al.':''),fullAuthorList:authors,year:Number(ep.pubYear),title:ep.title.replace(/\.$/,''),journal:ji.journal?.title||cr['container-title']?.[0]||'',volume:(ji.volume||'')+(ji.issue?`(${ji.issue})`:''),pages:ep.pageInfo||cr.page||'',doi:ep.doi,pmid:ep.id,pmcid:ep.pmcid||null,url:`https://pubmed.ncbi.nlm.nih.gov/${ep.id}/`,verified:'2026-10-25',verificationStatus:'cross-verified',metadataSources:[crRaw.url,epRaw.url]};
  if(c.id==='parvizi2012') reference.verificationNote='PubMed中Witthoft/Withoft存在同一作者的拼写记录；作者全表采用Crossref/出版社的7名作者。';
  records.push({id:c.id,status:'verified',reference,abstract:ep.abstractText||'',publicationTypes:ep.pubTypeList?.pubType||[],mesh:ep.meshHeadingList?.meshHeading||[],sources:[crRaw,epRaw].map(({url,retrievedAt,sha256})=>({url,retrievedAt,sha256})),fulltext:fulltext?{url:fulltext.url,ok:fulltext.ok,sha256:fulltext.sha256,pmcid:ep.pmcid}:null});
  console.log(`${c.id}: verified; fulltext ${fulltext?.ok?'available':'not retrieved'}`);
}
// Explicitly open-license sources already in the base bibliography; retain exact XML for figure audit.
const extraFulltexts=[['herbet2018',null],['shenhav2013',null],['romano2019',null],['haller2016',null],['seghier2013',null]];
for(const [id,pmcid] of extraFulltexts) {
  let trueId=pmcid;
  try {const r=JSON.parse(await readFile(path.join(root,'data-sources/literature/raw',`${id}.europepmc.json`),'utf8'));const ep=JSON.parse(r.raw).resultList.result.find(x=>x.source==='MED');trueId=ep?.pmcid||pmcid;}catch{}
  if(trueId)await fetchRecord(id,'fulltext',`https://www.ebi.ac.uk/europepmc/webservices/rest/${trueId}/fullTextXML`);
}
const unresolved=records.filter(r=>r.status==='unresolved');
await writeFile(path.join(dir,unresolved.length?'metadata-attempt.json':'metadata.json'),JSON.stringify({generatedAt:new Date().toISOString(),records},null,2)+'\n');
console.log(JSON.stringify({total:records.length,verified:records.length-unresolved.length,unresolved:unresolved.map(r=>r.id)}));
if(unresolved.length)process.exitCode=2;

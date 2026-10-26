// Read-only acquisition of bibliographic metadata and selected source-table audit extracts.
import {writeFile, readFile, mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = new URL('./', import.meta.url);
const refresh = process.argv.includes('--refresh');
const entries = [
  {id:'schaum2021',doi:'10.7554/eLife.61679',url:'https://elifesciences.org/articles/61679'},
  {id:'bosco2008',doi:'10.1523/JNEUROSCI.2869-08.2008',pmcid:'PMC6671632',url:'https://www.jneurosci.org/content/28/46/12071'},
  {id:'axelrod2015',doi:'10.1371/journal.pone.0117126',pmcid:'PMC4340964'},
];
const get = async url => { const r=await fetch(url); if(!r.ok)throw new Error(`${r.status}: ${url}`); return r; };
const clean = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&#x2212;/g,'−').trim();
await mkdir(dir,{recursive:true});
for (const e of entries) {
  const crossrefURL=`https://api.crossref.org/works/${encodeURIComponent(e.doi)}`;
  const crossref=(await (await get(crossrefURL)).json()).message;
  const europeURL=`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`DOI:${e.doi}`)}&format=json&resultType=core`;
  const epmc=(await (await get(europeURL)).json()).resultList.result[0];
  const fullURL=e.url || `https://www.ebi.ac.uk/europepmc/webservices/rest/${e.pmcid}/fullTextXML`;
  let full; try {full=await (await get(fullURL)).text();}catch(error){ console.log(e.id,error.message); continue; }
  const tables=[...full.matchAll(/<(?:table-wrap|table)(?:\s[^>]*)?>[\s\S]*?<\/(?:table-wrap|table)>/g)].map(x=>clean(x[0]));
  let tableURL;
  const expanded=full.match(/data-table-url="([^"]+)"/);
  if (!tables.length && expanded) { tableURL=new URL(expanded[1].replaceAll('&amp;','&'),fullURL).href; tables.push(clean(await (await get(tableURL)).text())); }
  const samples=[...full.matchAll(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/g)].map(x=>clean(x[0])).filter(x=>/subjects|participants|MNI|Talairach|license/i.test(x));
  const figures=[...full.matchAll(/(?:https?:[^\s"<>]+(?:\.jpg|\.png|\.webp)[^\s"<>]*|<graphic[^>]+>)/g)].slice(0,15).map(x=>x[0]);
  const metadata={id:e.id,doi:e.doi,checkedAt:new Date().toISOString(),crossrefURL,europeURL,sourceURL:fullURL,tableURL,crossref:{title:crossref.title,author:crossref.author,published:crossref.published,journal:crossref['container-title'],volume:crossref.volume,issue:crossref.issue,page:crossref.page,license:crossref.license},europepmc:{title:epmc.title,authorString:epmc.authorString,pubYear:epmc.pubYear,id:epmc.id,pmcid:epmc.pmcid,doi:epmc.doi}};
  const savedURL=new URL(`${e.id}-metadata.json`,dir);
  if (refresh) await writeFile(savedURL,JSON.stringify(metadata,null,2)+'\n');
  else {
    const saved=JSON.parse(await readFile(savedURL,'utf8'));
    assert.deepEqual(metadata.crossref.title,saved.crossref.title,`${e.id}: title metadata changed`);
    assert.deepEqual(metadata.crossref.author.map(a=>[a.given,a.family]),saved.crossref.author.map(a=>[a.given,a.family]),`${e.id}: author metadata changed`);
    assert.equal(metadata.europepmc.doi,saved.europepmc.doi,`${e.id}: DOI metadata changed`);
    assert.equal(metadata.europepmc.pubYear,saved.europepmc.pubYear,`${e.id}: year metadata changed`);
  }
  console.log(JSON.stringify({id:e.id,title:crossref.title,authors:epmc.authorString,year:epmc.pubYear,pmid:epmc.id,tables:tables.slice(0,1),samples:samples.filter(x=>/([Ff]ifty|[Ss]ixteen|[Ee]ighteen|[Ss]eventeen|[Ss]ixty|[Ss]ubjects\.|[Pp]articipants\.|subjects took part|subjects participated|volunteers|\bmean MNI\b)/i.test(x)).slice(0,5),figures:figures.filter(x=>/fig2|g003/.test(x)).slice(0,2)}));
}

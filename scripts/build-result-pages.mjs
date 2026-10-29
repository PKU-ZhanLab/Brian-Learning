import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import registry from '../data-sources/results/publication-registry.json' with {type:'json'};
import {getPublishedResultRecord,getPublishedSourceDetails,getResultCorrections,buildPublicResultExport} from '../src/lib/result-publication.js';
import {publicResultHref,publicResultDirectoryHref} from '../src/lib/public-result-route.js';
import {safeSourceURL} from '../src/lib/evidence-schema.js';

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=(value,language)=>typeof value==='string'?value:value?.[language]||value?.en||value?.zh||'';
const fileFor=(id,version,language)=>`results/${id}/${version}/index${language==='en'?'.en':''}.html`;
const style=`:root{font-family:system-ui,sans-serif;color:#19372b;background:#f6f7f5}body{margin:0}main{max-width:860px;margin:auto;padding:32px 24px;line-height:1.65;overflow-wrap:anywhere}h1{font-size:1.7rem;line-height:1.4}h2{font-size:1.2rem}a{color:#185b48}nav{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}dt{font-weight:650}dd{margin:0 0 12px}code{font-size:.85rem}li{margin:8px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #bccbc1}a:focus-visible{outline:3px solid #2b6d5c;outline-offset:3px}@media(max-width:650px){main{padding:20px 16px}h1{font-size:1.4rem}}`;
function documentHTML({language,title,description,canonical,body}){
  const e=escapeHTML;
  return `<!doctype html>\n<html lang="${language==='en'?'en':'zh-CN'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${e(description)}"><title>${e(title)} · NeuroAtlas</title><link rel="canonical" href="${e(canonical)}"><style>${style}</style></head><body><main>${body}</main></body></html>\n`;
}

// Identities, citation metadata and minimal source cells come only from E6.
export function renderResultPage({resultId,dataVersion,language='zh',base='/Brian-Learning/'}){
  const record=getPublishedResultRecord({resultId,dataVersion}),sources=getPublishedSourceDetails({resultId,dataVersion});
  const publication=registry.versions.find(row=>row.dataVersion===dataVersion);
  const reference=buildPublicResultExport({resultId,dataVersion}).evidence.references.find(row=>row.id===record.result.referenceId);
  const t=(zh,en)=>language==='en'?en:zh,e=escapeHTML,title=text(record.result.finding,language);
  const link=(url,label)=>`<a href="${e(url)}">${e(label)}</a>`;
  const versions=registry.versions.filter(row=>row.records.some(item=>item.resultId===resultId));
  const corrections=getResultCorrections(resultId);
  const field=value=>value?.state==='reported'?JSON.stringify(value.value):value?.reason||'—';
  const body=`<nav aria-label="${t('结果导航','Result navigation')}">${link(base,t('返回工作区','Return to workspace'))}${link(publicResultDirectoryHref({base,language}),t('全部公开结果','All public results'))}${link(base+fileFor(resultId,dataVersion,language==='en'?'zh':'en'),language==='en'?'中文':'English')}${link(publicResultHref(resultId,dataVersion,{base,language}),t('打开交互记录','Open interactive record'))}</nav>
<h1>${e(title)}</h1>
<p><cite>${e(reference.title)}</cite> · ${e(reference.authors)} · ${e(reference.journal)} (${e(reference.year)}) ${safeSourceURL(reference.url)?link(reference.url,'DOI / '+(reference.doi||reference.id)):''}</p>
<dl><dt>${t('固定结果 / 数据版本','Fixed result / data version')}</dt><dd><code>${e(resultId)}</code> · ${e(dataVersion)}</dd><dt>SHA-256</dt><dd><code>${e(record.contentHash)}</code></dd><dt>${t('来源快照 SHA-256','Source snapshot SHA-256')}</dt><dd><code>${e(publication.sha256)}</code></dd><dt>${t('任务 / 对比','Task / contrast')}</dt><dd>${e(text(record.result.contrast,language))}</dd><dt>${t('样本：招募 / 纳入 / 本分析','Sample: enrolled / included / analysis')}</dt><dd>${e(['enrolled','included','perAnalysis'].map(key=>field(record.result.sample?.[key])).join(' / '))}</dd></dl>
<h2>${t('空间与定位','Space and localization')}</h2><p>${t('保留原始来源空间；MNI-unspecified 不代表已确认模板或配准。','Original source spaces are retained; MNI-unspecified does not establish an exact template or registration.')}</p><ul>${record.locations.map(row=>`<li>${e(text(row.sourceLabel,language))}: ${e(row.xyz.join(', '))} mm · ${e(row.sourceSpaceId||t('未知','Unknown'))}</li>`).join('')}</ul>
<h2>${t('来源','Sources')}</h2><ul>${sources.map(source=>`<li>${safeSourceURL(source.sourceUrl)?link(source.sourceUrl,source.id):e(source.id)} · ${e(source.sourceVersion)} · ${e(source.locator)}<p>${e(source.rights)}</p><code>SHA-256 ${e(source.sha256)}</code></li>`).join('')}</ul>
<h2>${t('核对范围与局限','Review scope and limitations')}</h2><p>${t('人工审阅未完成。AI 辅助来源核对仅限列出的记录、版本和原文单元。','Human review is pending. AI-assisted source checks apply only to the listed records, versions and source cells.')}</p><ul>${record.reviewState.events.map(event=>`<li>${e(event.actorName)} · ${e(event.date)} · ${e(event.scope)}</li>`).join('')}${record.limitations.map(item=>`<li>${e(text(item,language))}</li>`).join('')}</ul>
<h2>${t('版本与补充勘误','Versions and corrections')}</h2><nav aria-label="${t('固定版本','Fixed versions')}">${versions.map(version=>link(base+fileFor(resultId,version.dataVersion,language),version.dataVersion)).join('')}</nav>${corrections.length?`<ul>${corrections.map(row=>`<li>${link(base+fileFor(resultId,row.fromVersion,language),row.fromVersion)} → ${link(base+fileFor(resultId,row.toVersion,language),row.toVersion)} · ${e(row.date)}<p>${e(row.reason)}</p></li>`).join('')}</ul>`:`<p>${t('无补充勘误记录。','No corrections recorded.')}</p>`}<p>${t('勘误链可随新记录补充；固定版本内容摘要保持不变。版本在本地登记，生成页面不证明已公网发布。','The correction chain may receive additions; fixed record content hashes remain unchanged. Versions are registered locally; generated pages do not establish public deployment.')}</p>`;
  return documentHTML({language,title,description:`${title} · ${dataVersion} · ${t('来源、空间、核对范围与局限','Sources, space, review scope and limitations')}`,canonical:base+fileFor(resultId,dataVersion,language),body});
}

export async function buildResultPages({outDir,base='/Brian-Learning/'}){
  // Validate base even if a future registry happens to be empty.
  publicResultHref(registry.versions[0].records[0].resultId,registry.versions[0].dataVersion,{base});
  const manifest={schema:'public-result-pages-v1',base,releaseStatus:registry.releaseStatus,records:[],files:[]};
  const write=async(file,content)=>{const target=path.join(outDir,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content);return crypto.createHash('sha256').update(content).digest('hex');};
  for(const version of registry.versions)for(const item of version.records)for(const language of ['zh','en']){
    const file=fileFor(item.resultId,version.dataVersion,language);
    const sha256=await write(file,renderResultPage({resultId:item.resultId,dataVersion:version.dataVersion,language,base}));
    manifest.records.push({resultId:item.resultId,dataVersion:version.dataVersion,language,file,contentHash:item.contentHash,snapshotSha256:version.sha256,sha256});
  }
  for(const language of ['zh','en']){
    const file=`results/index${language==='en'?'.en':''}.html`,title=language==='en'?'Public research results':'公开研究结果';
    const body=`<nav aria-label="${language==='en'?'Navigation':'导航'}"><a href="${escapeHTML(base)}">${language==='en'?'Return to workspace':'返回工作区'}</a> <a href="${escapeHTML(base)}results/index${language==='en'?'':'.en'}.html">${language==='en'?'中文':'English'}</a></nav><h1>${title}</h1><ul>${manifest.records.filter(row=>row.language===language).map(row=>`<li><a href="${escapeHTML(base+row.file)}">${escapeHTML(text(getPublishedResultRecord(row).result.finding,language))} · ${row.dataVersion}</a></li>`).join('')}</ul>`;
    manifest.files.push({file,sha256:await write(file,documentHTML({language,title,description:title,canonical:base+file,body}))});
  }
  await write('results/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const outDir=path.resolve(process.argv[2]||'dist-public');
  const manifest=await buildResultPages({outDir,base:process.env.VITE_BASE_PATH||'/Brian-Learning/'});
  console.log(`Result pages: ${manifest.records.length} fixed language/version pages.`);
}

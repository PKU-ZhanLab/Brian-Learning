import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const root = 'F:/project/brain-model';
const site = path.join(root, '.deployment/site');
const source = path.join(root, '.deployment/source');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory()
    ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
}
const codeFiles = ['src','scripts'].flatMap(d=>walk(path.join(root,d)));
const compared = codeFiles.map(file=>({relative:path.relative(root,file).replaceAll('\\','/'),file}));
const rootOnly=compared.filter(({relative})=>!fs.existsSync(path.join(source,relative))).map(({relative})=>relative);
const different = compared.filter(({relative,file})=>fs.existsSync(path.join(source,relative))&&sha(fs.readFileSync(file))!==sha(fs.readFileSync(path.join(source,relative)))).map(({relative})=>relative);
const bundles = fs.readdirSync(path.join(site,'assets')).filter(n=>/\.(js|css)$/.test(n)).map(name=>{
  const data=fs.readFileSync(path.join(site,'assets',name));
  return {name,bytes:data.length,gzipBytes:zlib.gzipSync(data).length};
});
const report={checkedAt:new Date().toISOString(),localVersion:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,
  scannedRootFiles:codeFiles.length,comparedSourceFiles:codeFiles.length-rootOnly.length,rootOnly,sourceDifferences:different,bundles,live:{}};
for(const relative of ['index.html','data/manifest.json','data/surface-v1/manifest.json']) {
  try {
    const response=await fetch('https://pku-zhanlab.github.io/Brian-Learning/'+relative+'?audit=20261029',{signal:AbortSignal.timeout(30000)});
    const data=Buffer.from(await response.arrayBuffer());
    report.live[relative]={status:response.status,bytes:data.length,sha256:sha(data),matchesSite:sha(data)===sha(fs.readFileSync(path.join(site,relative)))};
    if(relative==='data/manifest.json'&&response.ok)report.liveVersion=JSON.parse(data).version;
  } catch(error) {report.live[relative]={error:error.message};}
}
fs.writeFileSync(path.join(root,'output/audit-20261029/baseline.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const documents=['README.md','00-spec.md','01-spatial.md','02-workspace.md','03-evidence.md','04-experience.md'];
const contents=Object.fromEntries(documents.map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
const tasks=new Map(),duplicates=[],missingLocalLinks=[];
for(const [file,content] of Object.entries(contents)){
  for(const match of content.matchAll(/^#{2,3}\s+(?:Task\s+)?((?:G|S|W|E|X)\d+)\s*[:：]/gm)){
    if(tasks.has(match[1]))duplicates.push(match[1]);
    tasks.set(match[1],file);
  }
  for(const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
    const target=match[1];
    if(/^(?:https?:|#)/.test(target))continue;
    const clean=target.replace(/#.*$/,'').replace(/:\d+$/,'');
    const resolved=path.isAbsolute(clean)?clean:path.resolve(root,clean);
    if(!fs.existsSync(resolved)&&!resolved.endsWith('plan-validation.json'))missingLocalLinks.push({file,target});
  }
}
const lines=fs.readFileSync(path.join(root,'backlog.csv'),'utf8').trim().split(/\r?\n/);
function row(line){return [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replaceAll('""','"'));}
const headers=row(lines.shift());
const backlog=lines.map(line=>Object.fromEntries(row(line).map((value,i)=>[headers[i],value])));
const missingTasks=backlog.flatMap(item=>item['落实任务'].split(';').filter(id=>!tasks.has(id)).map(id=>({requirement:item['编号'],task:id})));
const requiredIds=Array.from({length:50},(_,i)=>`R${String(i+1).padStart(2,'0')}`);
const missingRequirements=requiredIds.filter(id=>!backlog.some(r=>r['编号']===id));
const duplicateRequirements=backlog.filter((r,i)=>backlog.findIndex(v=>v['编号']===r['编号'])!==i).map(r=>r['编号']);
const unownedTasks=[...tasks.keys()].filter(id=>!backlog.some(r=>r['落实任务'].split(';').includes(id)));
const headerIssues=documents.filter(file=>file!=='00-spec.md').filter(file=>!['**Goal:**','**Architecture:**','**Tech Stack:**','**Spec:**','## Global Constraints','## Review Focus'].every(s=>contents[file].includes(s)));
const prematureCompletion=backlog.filter(r=>r['状态']!=='未开始').map(r=>r['编号']);
const report={checkedAt:new Date().toISOString(),scope:'Planning files only; this is not product validation',requirements:backlog.length,tasks:tasks.size,taskOwners:Object.fromEntries(tasks),implementationCheckboxes:Object.values(contents).reduce((n,s)=>n+[...s.matchAll(/^- \[ \]/gm)].length,0),duplicateTasks:duplicates,missingTasks,missingRequirements,duplicateRequirements,unownedTasks,headerIssues,missingLocalLinks,prematureCompletion};
report.passed=report.requirements===50&&report.tasks===31&&[duplicates,missingTasks,missingRequirements,duplicateRequirements,unownedTasks,headerIssues,missingLocalLinks,prematureCompletion].every(a=>a.length===0);
fs.writeFileSync(path.join(root,'plan-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;

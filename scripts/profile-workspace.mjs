// Read measurement artifacts only. Never opens a browser, connects to a browser
// profile, clears storage, or treats automation round-trip time as UI latency.
import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
const baselinePath=resolve(option('--baseline')||'output/x9-profile/baseline-node-and-bundle.json');
const output=resolve(option('--out')||'output/x9-profile/workspace-profile.json');
const bundle=resolve(option('--dist')||'dist/assets');
const baseline=JSON.parse(await readFile(baselinePath,'utf8'));
const measurements=[];
for(let index=0;index<args.length;index++)if(args[index]==='--measurements'){
 const path=resolve(args[++index]),bytes=await readFile(path),value=JSON.parse(bytes);
 if(!value.measurementScope)throw Error(`Missing measurementScope: ${path}`);
 measurements.push({path:relative(process.cwd(),path),sha256:createHash('sha256').update(bytes).digest('hex'),value});
}
const metrics=['coldStartMs','warmAtlasSwitchP95Ms','interactionP95Ms','cancelFeedbackMs','peakHeapBytes'];
const browser=Object.fromEntries(metrics.map(key=>[key,null]));
browser.reason='No permitted browser measurements supplied. Node worker timing is not browser responsiveness or heap.';
const browserRuns=measurements.filter(record=>record.value.measurementScope==='browser');
if(browserRuns.length){
 // Keep runs separate: combining different devices, inputs, network or methods
 // would create a misleading comparison. The last run is the current display.
 const run=browserRuns.at(-1).value;
 if(!run.environment||!run.inputs||!run.method||!run.evidence)throw Error('Browser observations require environment, inputs, method and evidence');
 for(const key of metrics){const value=run.browser?.[key];if(value!==null&&value!==undefined&&(!Number.isFinite(value)||value<0))throw Error(`Invalid browser metric: ${key}`);browser[key]=value??null;}
 browser.reason=metrics.some(key=>browser[key]===null)?(run.reason||'Some browser metrics were not measured in this run.'):null;
 browser.provenance={environment:run.environment,inputs:run.inputs,method:run.method,evidence:run.evidence};
}
const assets=[];
for(const name of await readdir(bundle))if(/\.(js|css)$/.test(name))assets.push({name,bytes:(await stat(resolve(bundle,name))).size});
assets.sort((a,b)=>b.bytes-a.bytes);
const entry=assets.find(asset=>/^index-.*\.js$/.test(asset.name));
const previous=baseline.assets?.find(asset=>/^index-.*\.js$/.test(asset.name));
const report={generatedAt:new Date().toISOString(),measurementScope:'Measurement artifact summary; no browser or storage control',baseline,measurements,assets,entryComparison:{beforeBytes:previous?.bytes??null,afterBytes:entry?.bytes??null,reductionFraction:entry&&previous?1-entry.bytes/previous.bytes:null},browser,targets:{cancelFeedbackMs:1000,interactionP95Ms:200},acceptance:{browserMeasured:browserRuns.length>0,cancelWithinTarget:browser.cancelFeedbackMs===null?null:browser.cancelFeedbackMs<=1000,interactionWithinTarget:browser.interactionP95Ms===null?null:browser.interactionP95Ms<=200},limitations:['NIfTI parser limits do not imply durable browser quota or end-to-end staging capacity.','Node process-wide RSS is not browser peak heap.','Bundle sizes alone do not establish cold-start latency.']};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({output,entryComparison:report.entryComparison,browser:report.browser,acceptance:report.acceptance})+'\n');

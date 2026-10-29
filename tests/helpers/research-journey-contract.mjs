import assert from 'node:assert/strict';
import fs from 'node:fs';

// Independent expectations use the committed catalog, including source closure.
export function journeyOperands(){
 const catalog=JSON.parse(fs.readFileSync(new URL('../../public/data/manifest.json',import.meta.url),'utf8'));
 const assets=JSON.parse(fs.readFileSync(new URL('../../public/data/asset-identities.json',import.meta.url),'utf8')).assets;
 return ['dk','aal3-registered'].map(id=>({...catalog.atlases[id],...assets[catalog.atlases[id].data]}));
}
export function assertJourneyManifestInputs(manifest){
 const operands=journeyOperands();
 assert.deepEqual(manifest.inputs.slice(0,2),operands.map(volume=>volume.identity),'Both ordered operand identities must match the committed catalog');
 const closure=[...new Map(operands.flatMap(volume=>volume.sourceIdentities).map(identity=>[JSON.stringify(identity),identity])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(manifest.inputs.slice(2),closure,'All unique source dependencies must survive export and restore');
}

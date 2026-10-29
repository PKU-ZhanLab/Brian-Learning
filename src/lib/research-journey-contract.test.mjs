import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeComparisonManifest} from './computation-manifest.js';
import {makeComparisonGrid} from './roi-grid.js';
import {assertJourneyManifestInputs,journeyOperands} from '../../tests/helpers/research-journey-contract.mjs';

test('I6 real journey manifest retains both operands and the full catalog source closure',()=>{
 const [a,b]=journeyOperands(),target=makeComparisonGrid(JSON.parse(fs.readFileSync('public/data/volume.json','utf8')),1);
 const m=makeComparisonManifest(a,{kind:'label',labels:[1,2],threshold:0,tail:'positive'},b,{kind:'label',labels:[133,134],threshold:0,tail:'positive'},target);
 assertJourneyManifestInputs(m);assert.ok(m.inputs.length>2);
 for(const inputs of [m.inputs.slice(0,2),m.inputs.slice(1),[m.inputs[1],m.inputs[0],...m.inputs.slice(2)],[...m.inputs,m.inputs[2]]])assert.throws(()=>assertJourneyManifestInputs({...m,inputs}));
 const corrupt=structuredClone(m);corrupt.inputs[2].sha256='0'.repeat(64);assert.throws(()=>assertJourneyManifestInputs(corrupt));
});

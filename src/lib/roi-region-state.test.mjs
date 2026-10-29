import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeAtlasRegionRef} from './atlas-identity.js';
import {updateROIRegionExpectation,roiRegionIdentityMismatch} from './roi-region-state.js';

const manifest=JSON.parse(await readFile(new URL('../../public/data/manifest.json',import.meta.url)));
const a=makeAtlasRegionRef('aal-registered',manifest.atlases['aal-registered'],8121);
const b=makeAtlasRegionRef('aal3-registered',manifest.atlases['aal3-registered'],87);

test('changed A version remains unresolved through grid, threshold, tail and B source/label edits',()=>{
  const expected={A:[{...a,atlasVersion:'saved-unavailable-version'}],B:[b]};
  const original=structuredClone(expected),current={A:[a],B:[b]};
  let next=expected;
  for(const edit of [{kind:'grid'},{kind:'threshold',side:'A'},{kind:'tail',side:'A'},{kind:'threshold',side:'B'},{kind:'labels',side:'B'},{kind:'source',side:'B'}]) {
    next=updateROIRegionExpectation(next,edit);
    assert.deepEqual(next.A,original.A);
    assert(roiRegionIdentityMismatch(next,current,{A:true,B:true}));
  }
  assert.deepEqual(expected,original,'saved expectations are immutable');
  assert.equal(next.B,null,'explicit B source/label reselection only accepts B');
});

test('only explicit A source or label reselection accepts the current A identity',()=>{
  for(const kind of ['source','labels']) {
    const expected={A:[{...a,atlasVersion:'saved-unavailable-version'}],B:[b]};
    const next=updateROIRegionExpectation(expected,{kind,side:'A'});
    assert.equal(next.A,null);
    assert.deepEqual(next.B,[b]);
    assert.equal(roiRegionIdentityMismatch(next,{A:[a],B:[b]},{A:true,B:true}),false);
  }
});

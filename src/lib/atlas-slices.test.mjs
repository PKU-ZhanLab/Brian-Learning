import test from 'node:test';
import assert from 'node:assert/strict';
import {sliceWorldPoint,sliceOverlayAllowed,nativeAtlasId,unifiedAtlasId} from './volume.js';
import {encodeView,decodeView,validateViewState} from './workspace-project.js';
test('native T1 pair permits only its own labels without upgrading alignment',()=>{
 const native={canOverlayOnTarget:false,sliceReference:'aal-colin27'};
 assert(sliceOverlayAllowed({sliceReference:'aal-colin27'},native));
 assert(!sliceOverlayAllowed({},native));assert(!sliceOverlayAllowed({sliceReference:'different'},native));
 assert(!sliceOverlayAllowed({sliceReference:'aal-colin27'},{canOverlayOnTarget:true}));
 assert.equal(native.canOverlayOnTarget,false);
});
test('three views use RAS with radiological left/right and consistent crosshair coordinates',()=>{
 assert.deepEqual(sliceWorldPoint('z',12,0,0),[100,100,12]);
 assert.deepEqual(sliceWorldPoint('y',-20,1,1),[-100,-20,-80]);
 assert.deepEqual(sliceWorldPoint('x',-38,0,0),[-38,-140,120]);
});
test('view links retain native source, slice coordinates and overlay opacity',()=>{
 const input={atlas:'aal3-registered',atlasExplorerOpen:true,atlasExplorer:{atlas:'aal3',display:'slices',slicePoint:[-32,-10,23],sliceOpacity:.25,selected:[1,134]}};
 const view=decodeView(encodeView(input).encoded);assert.equal(view.atlas,'aal3-registered');assert.equal(view.atlasExplorer.atlas,'aal3');assert.equal(view.atlasExplorer.display,'slices');assert.deepEqual(view.atlasExplorer.slicePoint,[-32,-10,23]);assert.equal(view.atlasExplorer.sliceOpacity,.25);
 assert.deepEqual(validateViewState({atlasExplorer:{slicePoint:[999,-999,999]}}).atlasExplorer.slicePoint,[100,-140,120]);
 assert.equal(nativeAtlasId('aal-registered'),'aal');assert.equal(unifiedAtlasId('aal3'),'aal3-registered');assert.equal(nativeAtlasId('dk'),null);
});

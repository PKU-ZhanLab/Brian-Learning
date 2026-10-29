import test from 'node:test';
import assert from 'node:assert/strict';
import {validateViewState,serializeProject,parseProject} from './workspace-project.js';
import {parseCoordinateInput, stepCoordinate, coordinateOutsideBounds, formatCoordinate, coordinateNavigationSpace, coordinateReferenceSpace, nextCoordinateOrigin} from './coordinate-input.js';

const options={spaceId:'MNI152NLin6Asym',convention:'RAS',maxPoints:1000};
test('reference admission prevents canonical view/project codecs dropping long or escaped source identity',async()=>{
  for(const reference of ['x'.repeat(501),'independent:'+ 'x'.repeat(480),'independent:'+ '"'.repeat(480)]){
    const result=parseCoordinateInput('1.25,2.5,3.75',{...options,spaceId:reference});
    assert.deepEqual(result.points,[]);assert.equal(result.errors[0].field,'spaceId');assert.equal(result.errors[0].code,'space-too-long');
  }
  for(const reference of ['x'.repeat(500),'independent:'+ 'x'.repeat(476),'"'.repeat(500)]){
    const parsed=parseCoordinateInput('1.25,2.5,3.75',{...options,spaceId:reference});assert.equal(parsed.errors.length,0);
    const view={coordinateSpace:coordinateNavigationSpace(reference),coordinate:parsed.points[0]};
    for(const saved of [validateViewState(view),(await parseProject(await serializeProject({view,volumes:[]}))).view])assert.equal(coordinateReferenceSpace(saved.coordinateSpace),reference);
  }
});
test('decimal RAS input survives single and batch paste without rounding or clamping',()=>{
  assert.deepEqual(parseCoordinateInput('-38.25, -20.5, 54.1',options),{points:[[-38.25,-20.5,54.1]],errors:[]});
  assert.deepEqual(parseCoordinateInput('-38.25 -20.5 54.1\n1000, 2000, -3000',options).points,[[-38.25,-20.5,54.1],[1000,2000,-3000]]);
  assert.equal(coordinateOutsideBounds([1000,0,0],{x:[-100,100],y:[-140,100],z:[-80,120]}),true);
});
test('LPS explicitly converts both horizontal axes into internal RAS',()=>{
  assert.deepEqual(parseCoordinateInput('[10,20,30]',{...options,convention:'LPS'}),{points:[[-10,-20,30]],errors:[]});
  assert.deepEqual(parseCoordinateInput('[[10,20,30],[-10.25,2.5,0]]',{...options,convention:'LPS'}).points,[[-10,-20,30],[10.25,-2.5,0]]);
});
test('missing space, invalid convention, empty, incomplete and nonfinite values have field errors',()=>{
  assert.equal(parseCoordinateInput('1,2,3',{...options,spaceId:null}).errors[0].field,'spaceId');
  assert.equal(parseCoordinateInput('1,2,3',{...options,convention:'LAS'}).errors[0].field,'convention');
  for(const value of ['', '1,2', '1,,3', '1,2,3,4', '1,NaN,3', 'Infinity,2,3', '1,0x10,3', '[1,null,3]']) {
    const result=parseCoordinateInput(value,options);assert.deepEqual(result.points,[],value);assert.equal(result.errors[0].field,'coordinates',value);
  }
  const batch=parseCoordinateInput('1,2,3\n4,NaN,6',options);
  assert.deepEqual(batch.points,[]);assert.equal(batch.errors[0].line,2);
});
test('exactly 1000 points are accepted; 1001 gives an explicit field error and no partial navigation',()=>{
  assert.equal(parseCoordinateInput(Array(1000).fill('1,2,3').join('\n'),options).points.length,1000);
  const result=parseCoordinateInput(Array(1001).fill('1,2,3').join('\n'),options);
  assert.deepEqual(result.points,[]);assert.equal(result.errors[0].code,'too-many-points');assert.equal(result.errors[0].field,'coordinates');
});
test('axis steps preserve other decimal axes, reject invalid steps and never clamp',()=>{
  assert.deepEqual(stepCoordinate([-38.25,-20.5,54.1],0,.1),[-38.15,-20.5,54.1]);
  assert.deepEqual(stepCoordinate([100,0,0],0,1),[101,0,0]);
  assert.equal(stepCoordinate([.1234567890123456,0,0],0,1e-16)[0],.1234567890123456+1e-16);
  assert.throws(()=>stepCoordinate([1,2,3],0,NaN));
  assert.throws(()=>stepCoordinate([1,2,3],4,1));
});
test('copy text carries the exact reference, RAS convention and full decimal values',()=>{
  assert.equal(formatCoordinate([-38.25,-20.5,54.1],'Colin27 / MNI single-subject'),'Colin27 / MNI single-subject · RAS · -38.25, -20.5, 54.1 mm');
});
test('only the canonical reference enters the main context; a typed internal sentinel stays independent',()=>{
  assert.equal(coordinateNavigationSpace('MNI152NLin6Asym'),'brain');
  assert.equal(coordinateReferenceSpace('brain'),'MNI152NLin6Asym');
  assert.notEqual(coordinateNavigationSpace('brain'),'brain');
  assert.equal(coordinateReferenceSpace(coordinateNavigationSpace('brain')),'brain');
  assert.notEqual(coordinateNavigationSpace('brain'),coordinateNavigationSpace('independent:brain'));
  for(const reference of ['MNI','MNI unspecified','Colin27 / MNI single-subject','unknown','brain','independent:brain','independent:independent:brain',null]){
    assert.notEqual(coordinateNavigationSpace(reference),'brain');assert.equal(coordinateReferenceSpace(coordinateNavigationSpace(reference)),reference);
  }
});
test('new manual points release coordinate provenance without clearing an earlier private camera taint',()=>{
  const manual={kind:'manual',cameraSensitive:false,imported:false};
  const privateOrigin=nextCoordinateOrigin(manual,{kind:'private',cameraSensitive:false});assert.equal(privateOrigin.kind,'private');assert.equal(privateOrigin.cameraSensitive,true);
  const entered=nextCoordinateOrigin(privateOrigin,{kind:'manual',cameraSensitive:false,imported:false});assert.equal(entered.kind,'manual');assert.equal(entered.cameraSensitive,true);assert.equal(entered.imported,false);
  const stepped=nextCoordinateOrigin(privateOrigin,privateOrigin);assert.equal(stepped.kind,'private');assert.equal(stepped.cameraSensitive,true);
  const reset={...privateOrigin,cameraSensitive:false};assert.equal(nextCoordinateOrigin(reset,{kind:'manual'}).cameraSensitive,false);
});
test('X1-R1 main manual navigation and reset cannot release independent explorer provenance',()=>{
  const imported={kind:'manual',imported:true,cameraSensitive:true,explorerSensitive:true};
  const manual=nextCoordinateOrigin(imported,{kind:'manual',imported:false,explorerSensitive:false});
  assert.equal(manual.explorerSensitive,true);
  const mainReset={...manual,cameraSensitive:false};assert.equal(mainReset.explorerSensitive,true);
  assert.equal(nextCoordinateOrigin(mainReset,{kind:'manual',imported:false}).explorerSensitive,true);
});
test('X1-R2 typed legacy context names preserve raw identity and batch parent handshake',()=>{
  assert.equal(coordinateReferenceSpace('pam50'),'PAM50 native straightened');
  assert.equal(coordinateReferenceSpace('schematic'),'schematic');
  for(const rawSpace of ['pam50','schematic','PAM50 native straightened']){
    const parsed=parseCoordinateInput('10.25,20.5,30.75\n40.25,50.5,60.75',{...options,spaceId:rawSpace});assert.equal(parsed.points.length,2);
    const context=coordinateNavigationSpace(rawSpace);assert.notEqual(context,'brain');
    if(['pam50','schematic'].includes(rawSpace))assert.notEqual(context,rawSpace);
    const returnedReference=coordinateReferenceSpace(context);assert.equal(returnedReference,rawSpace);
    assert.equal(JSON.stringify([parsed.points[0],returnedReference]),JSON.stringify([parsed.points[0],rawSpace]));
    assert.equal(formatCoordinate(parsed.points[1],returnedReference),`${rawSpace} · RAS · 40.25, 50.5, 60.75 mm`);
  }
});

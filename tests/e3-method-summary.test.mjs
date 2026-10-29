import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {emptyEvidence,missing,reported} from '../src/lib/evidence-schema.js';

test('workbench method detail renders distinct states and source reasons in the existing definition',async()=>{
  // SSR only: no browser, network listener, storage, or file import is used.
  const server=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,watch:null,ws:false},optimizeDeps:{noDiscovery:true}});
  try{
    const {default:LiteratureWorkspace}=await server.ssrLoadModule('/src/components/LiteratureWorkspace.jsx');
    const states=[['not-reported','未报告','Not reported'],['not-extracted','尚未摘录','Not extracted'],['uncertain','不确定','Uncertain'],['not-applicable','不适用','Not applicable']];
    for(const language of ['zh','en'])for(const [state,zh,en] of states){
      const reference={id:'method-fixture',title:'Method fixture',url:'https://example.org/paper',studyModalities:missing('Reason retained from source',state)};
      const markup=renderToStaticMarkup(React.createElement(LiteratureWorkspace,{language,references:[reference],initialEvidence:emptyEvidence(),initialState:{paperId:reference.id}}));
      const summary=markup.match(/<dl class="paper-methods">([\s\S]*?)<\/dl>/)?.[1];
      assert.ok(summary,'Opened paper has a method definition');
      assert.ok(summary.includes(`<dd>${language==='zh'?zh:en} · Reason retained from source</dd>`),`${language}/${state}`);
    }
    const reference={id:'reported-fixture',title:'Reported fixture',url:'https://example.org/paper',studyModalities:reported(['MEG','fMRI'],['https://example.org/methods'])};
    const markup=renderToStaticMarkup(React.createElement(LiteratureWorkspace,{language:'en',references:[reference],initialEvidence:emptyEvidence(),initialState:{paperId:reference.id}}));
    assert.match(markup,/<dl class="paper-methods"><dt>Paper methods<\/dt><dd>MEG[^<]*fMRI<\/dd>/);
  }finally{await server.close();}
});

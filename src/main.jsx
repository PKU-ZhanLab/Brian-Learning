import React, {lazy,Suspense,useEffect} from 'react';
import { createRoot } from 'react-dom/client';
import ResultRecordPage from './components/ResultRecordPage.jsx';
import {resolvePublicResultRoute,publicResultHref} from './lib/public-result-route.js';
import './styles.css';

const base=import.meta.env.BASE_URL;
// Decide before importing App: its startup owns private workspace/storage.
// A malformed public route must never be interpreted as a workspace request.
const route=resolvePublicResultRoute(window.location.search);
const root=createRoot(document.getElementById('root'));
class WorkspaceStartupBoundary extends React.Component{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <main className="public-result-entry" role="alert"><h1>工作区未能载入 / Workspace could not load</h1><p>请重新载入，已保存的项目仍保留。 / Reload to retry. Saved projects are retained.</p><button type="button" onClick={()=>window.location.reload()}>重新载入 / Reload</button></main>;
    return this.props.children;
  }
}
function PublicResultEntry({route}){
  const en=route.language==='en',t=(zh,english)=>en?english:zh;
  useEffect(()=>{
    document.documentElement.lang=en?'en':'zh-CN';
    document.title=route.record?`${route.record.result.finding?.[en?'en':'zh']||route.resultId} · ${route.dataVersion} · NeuroAtlas`:t('结果不可获取 · NeuroAtlas','Result unavailable · NeuroAtlas');
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content=t('固定版本结果、来源、空间与核对范围。','Fixed result version, sources, space and review scope.');
    if(route.kind==='result'){
      const href=publicResultHref(route.resultId,route.dataVersion,{base,language:route.language});
      window.history.replaceState(null,'',href);
      const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=new URL(href,window.location.origin).href;document.head.append(canonical);
      return()=>canonical.remove();
    }
  },[en,route]);
  return <main className="public-result-entry" data-public-result-state={route.kind}>
    <nav aria-label={t('结果导航','Result navigation')}><a href={base}>{t('返回工作区','Return to workspace')}</a><a href={`${base}results/`}>{t('全部公开结果','All public results')}</a>{route.kind==='result'&&<a href={publicResultHref(route.resultId,route.dataVersion,{base,language:en?'zh':'en'})}>{en?'中文':'English'}</a>}</nav>
    {route.kind==='result'?<ResultRecordPage resultId={route.resultId} dataVersion={route.dataVersion} language={route.language} standalone/>:<><h1>{route.kind==='redirect'?t('正在打开固定版本…','Opening fixed version…'):t('结果不可获取','Result unavailable')}</h1><p>{route.kind==='redirect'?t('将转到带明确版本的公开地址。','Redirecting to an explicitly versioned public address.'):t('未找到该公开结果或固定版本。','This public result or fixed version is unavailable.')}</p>{route.kind==='redirect'&&<a href={base+route.href}>{t('打开固定版本','Open fixed version')}</a>}</>}
  </main>;
}
if(route){
  if(route.kind==='redirect')window.location.replace(base+route.href);
  root.render(<PublicResultEntry route={route}/>);
}else{
  const App=lazy(()=>import('./App.jsx'));
  root.render(<WorkspaceStartupBoundary><Suspense fallback={<p role="status">正在载入… / Loading…</p>}><App/></Suspense></WorkspaceStartupBoundary>);
}

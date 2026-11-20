import React,{useState} from 'react';
import {taskEntryUI} from '../i18n/ui.js';

export default function TaskEntryPoints({language='zh',onCoordinates,onSearch,onImport,onPapers,onExample}) {
  const t=taskEntryUI[language==='en'?'en':'zh'],[showExample,setShowExample]=useState(true);
  return <nav className="task-entry-points" aria-label={t.tasks}>
    <button onClick={onCoordinates}>{t.coordinates}</button><button onClick={onSearch}>{t.search}</button><button onClick={onImport}>{t.import}</button><button onClick={onPapers}>{t.papers}</button>
    {showExample&&<span className="task-example"><button onClick={onExample}>{t.example}</button><button onClick={()=>setShowExample(false)}>{t.skip}</button></span>}
  </nav>;
}

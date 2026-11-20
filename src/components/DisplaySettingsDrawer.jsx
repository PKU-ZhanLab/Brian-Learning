import React, {useId} from 'react';
import {Eye, X} from 'lucide-react';

/** Desktop and drawer controls consume the same App-owned values. */
export function DisplaySettingsControls({settings,onChange,onRestoreHidden,language='zh'}) {
  const id=useId(),en=language==='en',t=(zh,english)=>en?english:zh;
  const switches=[['exploded',t('半球分离','Separate hemispheres')],['labels',t('悬浮标签','Floating labels')],['showSchematic',t('显示结构示意','Show schematic structures')],['clinical',t('临床拓展','Clinical context')]];
  return <div className="display-settings-fields">
    <label className="slider-label" htmlFor={`${id}-opacity`}>{t('皮层透明度','Cortical opacity')}<output htmlFor={`${id}-opacity`}>{Math.round(settings.opacity*100)}%</output></label>
    <input id={`${id}-opacity`} aria-label={t('皮层透明度','Cortical opacity')} type="range" min="0.04" max="1" step=".01" value={settings.opacity} onChange={event=>onChange({opacity:Number(event.target.value)})}/>
    {switches.map(([key,label])=><label className="display-settings-switch" key={key}><span>{label}</span><input type="checkbox" role="switch" checked={settings[key]} onChange={event=>onChange({[key]:event.target.checked})}/></label>)}
    <button className="restore-hidden" disabled={!settings.hiddenCount} onClick={onRestoreHidden}><Eye size={16}/>{en?`Restore hidden structures (${settings.hiddenCount})`:`恢复隐藏结构（${settings.hiddenCount}）`}</button>
  </div>;
}

export default function DisplaySettingsDrawer({settings,onChange,onRestoreHidden,onClose,language='zh'}) {
  const en=language==='en';
  return <div className="display-settings-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="display-settings-drawer">
      <header><h2>{en?'Display settings':'显示设置'}</h2><button aria-label={en?'Close display settings':'关闭显示设置'} onClick={onClose}><X size={20}/></button></header>
      <div className="display-settings-scroll"><DisplaySettingsControls settings={settings} onChange={onChange} onRestoreHidden={onRestoreHidden} language={language}/></div>
    </section>
  </div>;
}

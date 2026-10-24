import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadAnatomyVolume, loadAtlas, makeSliceCanvas, sliceWorldPoint } from '../lib/volume.js';
import { positiveLabels, ROI_COLORS, ROI_DEFAULT_DISPLAY, serializableVolume } from '../lib/roi.js';
import './ROICompare.css';

const TEXT = {
  zh: {
    title: 'ROI 空间重叠', subtitle: '比较同一参考空间内的两个实际体素标签。', close: '关闭', atlas: '图谱', label: '区域标签', choose: '请选择区域', loading: '载入实际标签…', compare: '计算重叠', computing: '正在重采样与计算…', clear: '清除叠加', blocked: '空间未核验，不能比较', noAtlases: '尚无已核验空间的图谱可比较。', empty: '此图谱没有正值标签。', sourceError: '图谱文件加载失败，请重试。', computeError: '计算失败，请检查数据或改选区域。', 'unaligned-atlas': '该图谱空间未核验，已停止比较。', 'empty-label': '这个标签在实际数据中没有体素。', 'surface-too-large': '该标签的边界过大，请选择更小的区域。', waiting: '选择两个区域后计算，将显示仅 A、仅 B 和交集。', grid: '共同网格', voxels: '体素', volume: '体积 mm³', part: '区域', A: 'A 全部', B: 'B 全部', aOnly: '仅 A', bOnly: '仅 B', intersection: '交集', union: '并集', dice: 'Dice', jaccard: 'Jaccard', coveredA: 'A 被 B 覆盖', coveredB: 'B 被 A 覆盖', view: '三维显示', parts: '三部分', overlap: '只看交集', opacityA: 'A 不透明度', opacityB: 'B 不透明度', opacityOverlap: '交集不透明度', xray: '穿透查看（忽略前方遮挡）', depthHint: '透明表面仍可能相互遮挡；切片可核对内部重叠。', anatomyHint: '查看内部 ROI 时，可降低主视图皮层的不透明度。', sliceTitle: '交叉切片', sagittal: '矢状', coronal: '冠状', axial: '轴位', sliceHint: '点击切片移动交点。左右按放射学方向显示。', source: '来源空间', native: '同源模板', published: '原作者模板映射', affine: '已发表仿射映射', registered: '项目配准', approx: '含近似仿射映射：重叠值受模板和变换误差影响。', categorical: '计算二值标签掩模；最大概率标签的重叠不等于概率图重叠，也不表示功能相同。', exclusive: '同一互斥分区图谱的不同标签通常不会重叠。', noOverlap: '当前两区域交集为 0；仅显示各自区域。', emptyTarget: '至少一个标签在共同网格内为空，相关比值显示为 —。', method: '按仿射在目标体素中心最近邻采样；这一步不估计新的解剖配准。', export: '导出指标 CSV', resampled: '已重采样', sameGrid: '原网格一致', threshold: '源最大概率阈值', notLoaded: '正在读取图谱清单…', retry: '重试', resolution: '每体素', selectionChanged: '已更改选择，请重新计算。', target: '目标', sourceCount: '源标签体素', alphaLabel: '不透明度', showControls: '显示与透明度', downloadName: 'ROI-overlap',
  },
  en: {
    title: 'ROI overlap', subtitle: 'Compare two actual voxel labels in a shared reference space.', close: 'Close', atlas: 'Atlas', label: 'Region label', choose: 'Choose a region', loading: 'Loading actual labels…', compare: 'Compute overlap', computing: 'Resampling and computing…', clear: 'Clear overlay', blocked: 'Alignment unverified; comparison disabled', noAtlases: 'No atlases with accepted target alignment are available.', empty: 'This atlas has no positive labels.', sourceError: 'The atlas could not be loaded. Please retry.', computeError: 'Comparison failed. Check the data or choose another region.', 'unaligned-atlas': 'Atlas alignment is unverified; comparison stopped.', 'empty-label': 'This label has no voxels in the actual data.', 'surface-too-large': 'This label has too many boundary faces. Choose a smaller region.', waiting: 'Choose two regions to show A only, B only, and their intersection.', grid: 'Shared grid', voxels: 'Voxels', volume: 'Volume mm³', part: 'Region', A: 'All of A', B: 'All of B', aOnly: 'A only', bOnly: 'B only', intersection: 'Intersection', union: 'Union', dice: 'Dice', jaccard: 'Jaccard', coveredA: 'A covered by B', coveredB: 'B covered by A', view: '3D display', parts: 'Three parts', overlap: 'Intersection only', opacityA: 'A opacity', opacityB: 'B opacity', opacityOverlap: 'Intersection opacity', xray: 'X-ray view (ignore foreground occlusion)', depthHint: 'Transparent surfaces may still occlude each other; use slices to check interior overlap.', anatomyHint: 'Lower the main cortex opacity to see interior ROIs.', sliceTitle: 'Linked slices', sagittal: 'Sagittal', coronal: 'Coronal', axial: 'Axial', sliceHint: 'Click a slice to move the crosshair. Left and right follow radiological convention.', source: 'Source space', native: 'Matched native template', published: 'Published template mapping', affine: 'Published affine mapping', registered: 'Project registration', approx: 'Includes approximate affine mapping: overlap depends on template and transform error.', categorical: 'These are binary label masks. Overlap of maximum-probability labels is not overlap of probability maps or proof of shared function.', exclusive: 'Different labels in one exclusive parcellation usually have no overlap.', noOverlap: 'The intersection is empty; the separate regions remain available.', emptyTarget: 'At least one label is empty on the shared grid. Undefined ratios are shown as —.', method: 'Nearest-neighbour sampling at target voxel centres using declared affines. No new anatomical registration is estimated.', export: 'Export metrics CSV', resampled: 'Resampled', sameGrid: 'Identical source grid', threshold: 'Source max-probability threshold', notLoaded: 'Loading atlas manifest…', retry: 'Retry', resolution: 'Per voxel', selectionChanged: 'Selection changed; compute again.', target: 'Target', sourceCount: 'Source label voxels', alphaLabel: 'Opacity', showControls: 'Display and opacity', downloadName: 'ROI-overlap',
  },
};
const ATLAS_NAMES = { dk: 'Desikan–Killiany (DK)', ho: 'Harvard–Oxford', jhu: 'JHU ICBM-DTI-81', ba: 'Talairach BA → MNI', 'ba-histology': 'Jülich BA', aal: 'AAL', aal3: 'AAL3', 'ba-legacy': 'Legacy BA' };
const alignmentKey = status => status === 'verified-native' ? 'native' : status === 'published-affine' ? 'affine' : status === 'registered' ? 'registered' : 'published';
const localizedLabel = (label, language) => language === 'zh' && label?.zh ? label.zh : label?.name;
const safeCSV = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const formatRatio = value => value == null ? '—' : value.toFixed(4);
const formatPercent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

function useSource(atlasId) {
  const [state, setState] = useState({ loading: true, volume: null, labels: [], error: null });
  useEffect(() => {
    let active = true;
    setState({ loading: true, volume: null, labels: [], error: null });
    if (!atlasId) { setState({ loading: false, volume: null, labels: [], error: null }); return () => { active = false; }; }
    loadAtlas(atlasId).then(volume => {
      if (!volume || volume.canOverlayOnTarget !== true) throw new Error('unaligned-atlas');
      if (active) setState({ loading: false, volume, labels: positiveLabels(volume), error: null });
    }).catch(error => { if (active) setState({ loading: false, volume: null, labels: [], error: error.message }); });
    return () => { active = false; };
  }, [atlasId]);
  return state;
}

function SlicePreview({ axis, title, anatomy, comparison, point, onPoint }) {
  const ref = useRef(null);
  const axisIndex = ['x', 'y', 'z'].indexOf(axis);
  useEffect(() => {
    if (!anatomy || !ref.current || !comparison) return;
    const canvas = makeSliceCanvas(anatomy, axis, point[axisIndex], { size: 192, radiological: true, crosshair: point, roiComparison: comparison });
    ref.current.width = canvas.width; ref.current.height = canvas.height;
    ref.current.getContext('2d').drawImage(canvas, 0, 0);
  }, [anatomy, comparison, axis, axisIndex, point]);
  return <div className="roi-slice"><div><span>{title}</span><span>{axis.toUpperCase()} {point[axisIndex].toFixed(1)}</span></div><div className="roi-slice-image"><canvas ref={ref} aria-label={`${axis === 'x' ? 'Sagittal' : axis === 'y' ? 'Coronal' : 'Axial'} ROI overlap slice`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onPoint(sliceWorldPoint(axis, point[axisIndex], (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, true)); }}/><span className="roi-orientation-left">{axis === 'x' ? 'P' : 'R'}</span><span className="roi-orientation-right">{axis === 'x' ? 'A' : 'L'}</span></div></div>;
}

export default function ROICompare({ language = 'zh', manifest, onComparisonChange, onClose }) {
  const t = TEXT[language === 'en' ? 'en' : 'zh'];
  const callbacks = useRef({ onComparisonChange }); callbacks.current.onComparisonChange = onComparisonChange;
  const [aAtlas, setAAtlas] = useState('dk'), [bAtlas, setBAtlas] = useState('ba-histology');
  const [aLabel, setALabel] = useState(''), [bLabel, setBLabel] = useState('');
  const sourceA = useSource(aAtlas), sourceB = useSource(bAtlas);
  const [comparison, setComparison] = useState(null), [display, setDisplay] = useState({ ...ROI_DEFAULT_DISPLAY });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [anatomy, setAnatomy] = useState(null), [point, setPoint] = useState([0, 0, 0]);
  const worker = useRef(null), sequence = useRef(0);
  const atlases = useMemo(() => Object.entries(manifest?.atlases || {}).filter(([, meta]) => meta.available && (meta.data || meta.metadata || meta.file)), [manifest]);
  const allowed = atlases.filter(([, meta]) => meta.canOverlayOnTarget === true).map(([id]) => id);
  useEffect(() => {
    if (!allowed.length) return;
    if (!allowed.includes(aAtlas)) setAAtlas(allowed[0]);
    if (!allowed.includes(bAtlas)) setBAtlas(allowed.includes('ba-histology') ? 'ba-histology' : allowed[1] || allowed[0]);
  }, [allowed.join('|'), aAtlas, bAtlas]);
  useEffect(() => { if (sourceA.labels.length) setALabel(current => sourceA.labels.some(label => String(label.id) === current) ? current : String((sourceA.labels.find(label => /left precentral/i.test(label.name)) || sourceA.labels[0]).id)); }, [sourceA.labels]);
  useEffect(() => { if (sourceB.labels.length) setBLabel(current => sourceB.labels.some(label => String(label.id) === current) ? current : String((sourceB.labels.find(label => /BA4a L$/.test(label.name)) || sourceB.labels[0]).id)); }, [sourceB.labels]);
  useEffect(() => {
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setError(''); setComparison(null); callbacks.current.onComparisonChange?.(null);
  }, [aAtlas, bAtlas, aLabel, bLabel]);
  useEffect(() => () => { sequence.current++; worker.current?.terminate(); }, []);

  async function compute() {
    if (!sourceA.volume || !sourceB.volume || !aLabel || !bLabel) return;
    const requestId = ++sequence.current;
    worker.current?.terminate(); setBusy(true); setError('');
    try {
      const target = await loadAnatomyVolume();
      if (requestId !== sequence.current) return;
      setAnatomy(target);
      const current = new Worker(new URL('../lib/roi.worker.js', import.meta.url), { type: 'module' }); worker.current = current;
      current.onmessage = ({ data }) => {
        if (requestId !== sequence.current || data.requestId !== requestId) return;
        setBusy(false); current.terminate(); worker.current = null;
        if (data.error) { setError(data.error); return; }
        const result = { ...data.comparison, display: { ...display } };
        setComparison(result); setPoint(result.center || [0, 0, 0]); callbacks.current.onComparisonChange?.(result);
      };
      current.onerror = () => { if (requestId === sequence.current) { setBusy(false); setError('computeError'); current.terminate(); worker.current = null; } };
      current.postMessage({ requestId, volumeA: serializableVolume(sourceA.volume), volumeB: serializableVolume(sourceB.volume), labelA: +aLabel, labelB: +bLabel, target: { shape: target.shape, affine: target.affine, space: target.space }, descriptors: { A: { atlasId: aAtlas, name: sourceA.labels.find(label => label.id === +aLabel)?.name }, B: { atlasId: bAtlas, name: sourceB.labels.find(label => label.id === +bLabel)?.name } } });
    } catch (problem) { if (requestId === sequence.current) { setBusy(false); setError(problem.message); } }
  }
  function changeDisplay(patch) {
    const next = { ...display, ...patch }; setDisplay(next);
    if (comparison) { const value = { ...comparison, display: next }; setComparison(value); callbacks.current.onComparisonChange?.(value); }
  }
  function clear() { sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setComparison(null); callbacks.current.onComparisonChange?.(null); }
  function exportMetrics() {
    if (!comparison) return;
    const lines = [['metric', 'value'], ...Object.entries(comparison.metrics), ['A atlas', comparison.A.atlasId], ['A label ID', comparison.A.labelId], ['A label name', comparison.A.name], ['A alignment', comparison.A.alignmentStatus], ['B atlas', comparison.B.atlasId], ['B label ID', comparison.B.labelId], ['B label name', comparison.B.name], ['B alignment', comparison.B.alignmentStatus], ['target space', comparison.grid.space], ['voxel volume mm3', comparison.grid.voxelVolumeMm3], ['shape', comparison.grid.shape.join(' × ')], ['affine row-major', comparison.grid.affine.join(' ')], ['method', comparison.method]];
    const blob = new Blob(['\ufeff' + lines.map(row => row.map(safeCSV).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `${t.downloadName}-${comparison.A.atlasId}-${comparison.A.labelId}-${comparison.B.atlasId}-${comparison.B.labelId}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const sourceBlock = (key, atlasId, setAtlas, labelId, setLabel, source) => <fieldset className={`roi-source roi-source-${key.toLowerCase()}`}><legend>ROI {key}</legend><label><span>{t.atlas}</span><select aria-label={`ROI ${key} atlas`} value={atlasId} onChange={event => { setLabel(''); setAtlas(event.target.value); }}>{atlases.map(([id, meta]) => <option key={id} value={id} disabled={meta.canOverlayOnTarget !== true}>{ATLAS_NAMES[id] || meta.name || id}{meta.canOverlayOnTarget !== true ? ` · ${t.blocked}` : ''}</option>)}</select></label><label><span>{t.label}</span><select aria-label={`ROI ${key} label`} value={labelId} disabled={source.loading || !source.labels.length} onChange={event => setLabel(event.target.value)}><option value="" disabled>{source.loading ? t.loading : t.choose}</option>{source.labels.map(label => <option key={label.id} value={label.id}>{label.id} · {localizedLabel(label, language)} ({label.voxels.toLocaleString()} {t.voxels})</option>)}</select></label>{source.volume && <p className="roi-source-space">{t[alignmentKey(source.volume.alignmentStatus)]} · {source.volume.space}</p>}{source.error && <p role="alert" className="roi-error">{t[source.error] || t.sourceError}</p>}{!source.loading && !source.error && !source.labels.length && <p className="roi-note">{t.empty}</p>}</fieldset>;

  return <section className="roi-compare" aria-label="ROI overlap comparison"><header className="roi-header"><div><h2>{t.title}</h2><p>{t.subtitle}</p></div>{onClose && <button type="button" className="roi-close" onClick={onClose} aria-label="Close ROI comparison" title={t.close}>×</button>}</header>
    {!manifest ? <p role="status">{t.notLoaded}</p> : !allowed.length ? <p role="status">{t.noAtlases}</p> : <>
      <div className="roi-selectors">{sourceBlock('A', aAtlas, setAAtlas, aLabel, setALabel, sourceA)}{sourceBlock('B', bAtlas, setBAtlas, bLabel, setBLabel, sourceB)}</div>
      <div className="roi-actions"><button type="button" className="roi-primary" onClick={compute} disabled={busy || sourceA.loading || sourceB.loading || !sourceA.volume || !sourceB.volume || !aLabel || !bLabel} aria-label="Compute ROI overlap">{busy ? t.computing : t.compare}</button>{comparison && <><button type="button" onClick={clear} aria-label="Clear ROI overlay">{t.clear}</button><button type="button" onClick={exportMetrics} aria-label="Export ROI overlap metrics CSV">{t.export}</button></>}</div>
      {error && <p role="alert" className="roi-error">{t[error] || t.computeError}</p>}
      {!comparison && !busy && <p className="roi-empty">{t.waiting}</p>}
      {busy && <p className="roi-note" role="status">{t.computing}</p>}
      {comparison && <div className="roi-result" aria-live="polite"><div className="roi-metrics"><div><span>Dice</span><strong>{formatRatio(comparison.metrics.dice)}</strong><small>2|A ∩ B| / (|A| + |B|)</small></div><div><span>Jaccard</span><strong>{formatRatio(comparison.metrics.jaccard)}</strong><small>|A ∩ B| / |A ∪ B|</small></div><div><span>{t.coveredA}</span><strong>{formatPercent(comparison.metrics.aCoveredByB)}</strong></div><div><span>{t.coveredB}</span><strong>{formatPercent(comparison.metrics.bCoveredByA)}</strong></div></div>
        <p className="roi-grid"><strong>{t.grid}</strong> {comparison.grid.space} · {comparison.grid.shape.join(' × ')} · {t.resolution} {comparison.grid.voxelVolumeMm3.toLocaleString()} mm³</p>
        <table className="roi-counts"><thead><tr><th>{t.part}</th><th>{t.voxels}</th><th>{t.volume}</th></tr></thead><tbody>{[['A','aVoxels','aMm3'],['B','bVoxels','bMm3'],['intersection','intersectionVoxels','intersectionMm3'],['aOnly','aOnlyVoxels','aOnlyMm3'],['bOnly','bOnlyVoxels','bOnlyMm3'],['union','unionVoxels','unionMm3']].map(([key,count,volume]) => <tr key={key}><td>{ROI_COLORS[key] && <i style={{background:ROI_COLORS[key]}}/>}{t[key]}</td><td>{comparison.metrics[count].toLocaleString()}</td><td>{comparison.metrics[volume].toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>)}</tbody></table>
        {comparison.metrics.intersectionVoxels === 0 && <p className="roi-note">{t.noOverlap}</p>}{(!comparison.metrics.aVoxels || !comparison.metrics.bVoxels) && <p className="roi-warning">{t.emptyTarget}</p>}
        <fieldset className="roi-display"><legend>{t.showControls}</legend><label className="roi-mode"><span>{t.view}</span><select aria-label="ROI display mode" value={display.mode} onChange={event => changeDisplay({mode:event.target.value})}>{['parts','overlap','A','B'].map(mode=><option key={mode} value={mode}>{t[mode]}</option>)}</select></label><div className="roi-opacity">{[['opacityA','A'],['opacityB','B'],['opacityOverlap','intersection']].map(([key,color])=><label key={key}><span><i style={{background:ROI_COLORS[color]}}/>{t[key]}<output>{Math.round(display[key]*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={display[key]} onChange={event=>changeDisplay({[key]:+event.target.value})} aria-label={key==='opacityA'?'ROI A opacity':key==='opacityB'?'ROI B opacity':'ROI intersection opacity'}/></label>)}</div><label className="roi-xray"><input type="checkbox" checked={display.xray} onChange={event=>changeDisplay({xray:event.target.checked})} aria-label="ROI X-ray view"/>{t.xray}</label><p className="roi-note">{t.depthHint} {t.anatomyHint}</p></fieldset>
        {anatomy && <div className="roi-slices"><h3>{t.sliceTitle}</h3><div>{[['x','sagittal'],['y','coronal'],['z','axial']].map(([axis,title])=><SlicePreview key={axis} axis={axis} title={t[title]} anatomy={anatomy} comparison={comparison} point={point} onPoint={setPoint}/>)}</div><p className="roi-note">{t.sliceHint}</p></div>}
        <div className="roi-provenance">{[comparison.A,comparison.B].map((source,index)=><p key={index}><strong>ROI {index?'B':'A'}</strong> · {t[alignmentKey(source.alignmentStatus)]} · {source.resampled?t.resampled:t.sameGrid}{source.thresholdPercent!=null?` · ${t.threshold} ${source.thresholdPercent}%`:''}</p>)}{[comparison.A,comparison.B].some(source=>source.alignmentStatus==='published-affine')&&<p className="roi-warning">{t.approx}</p>}<p>{t.categorical}</p>{aAtlas===bAtlas&&aLabel!==bLabel&&<p>{t.exclusive}</p>}<p>{t.method}</p></div>
      </div>}
    </>}
  </section>;
}


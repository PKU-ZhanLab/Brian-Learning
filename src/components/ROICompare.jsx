import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadAnatomyVolume, loadAtlas, makeSliceCanvas, sliceWorldPoint } from '../lib/volume.js';
import { positiveLabels, ROI_COLORS, ROI_DEFAULT_DISPLAY, serializableVolume, comparisonMaskVolume } from '../lib/roi.js';
import { parseNifti, exportNifti, parseLabelTable, MAX_NIFTI_FILE_BYTES } from '../lib/nifti.js';
import { registerCustomVolume, getCustomVolume, listCustomVolumes, subscribeCustomVolumes } from '../lib/custom-volumes.js';
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
Object.assign(TEXT.zh, {
  subtitle:'比较图谱区域与论文结果、掩膜或连续图的空间重叠。', importTitle:'导入本地 NIfTI', localOnly:'文件仅在当前浏览器内读取，不上传。支持三维 .nii / .nii.gz，最多 128 MiB 文件、6400 万体素。', file:'影像文件', kind:'数据类型', labelKind:'整数标签图', maskKind:'二值掩膜（0/1）', statisticKind:'统计图', probabilityKind:'概率图（0–1）', reference:'确切参考空间', nativeSpace:'原生或尚未核实', otherSpace:'其他参考空间', exactReference:'参考空间的完整名称', aligned:'我确认该文件已与当前 FSL MNI152NLin6Asym 模板配准', provenance:'来源及配准依据（DOI、处理流程、变换文件等）', provenanceHint:'仅有 NIfTI 仿射或“MNI”名称不能证明模板一致。此声明会保存并随指标导出。', labelsFile:'标签名称表（可选 CSV / JSON）', labelsHint:'CSV 列为 id,name,zh；JSON 为标签数组或 ID 到名称的映射。', importButton:'导入影像', importing:'正在检查影像…', importDone:'已导入', nativeImport:'空间尚未核实，可在原生空间查看；不能与当前模板计算重叠。', declared:'用户声明已对齐（未独立核验）', conflict:'文件的 sform 与 qform 不一致；本次按 sform 读取，请核对来源。', combine:'选择多个标签求并集（按住 Ctrl / ⌘ 多选）', thresholdValue:'阈值（包含边界）', positive:'正值：v ≥ 阈值', negative:'负值：v ≤ −阈值', absolute:'绝对值：|v| ≥ 阈值', tail:'统计方向', range:'数值范围', binary:'阈值后二值指标', probabilityTitle:'概率权重重叠（不受二值阈值影响）', fuzzyDice:'模糊 Dice', fuzzyJaccard:'模糊 Jaccard', probabilityHint:'先将两张概率图三线性采样到共同网格，再对完整概率权重求 min/max；不代表独立事件联合概率。下方体素数与三维表面仍来自各自阈值后的二值掩膜。', probabilityOne:'概率权重指标需要 A、B 都是概率图；当前仅报告二值阈值结果。', maskExport:'导出 NIfTI 掩膜', thresholdHint:'连续图先三线性采样再阈值；源网格外为 0，零背景始终排除。', maskHint:'使用所有非零体素。', 'invalid-threshold':'阈值必须为有限非负数；概率阈值须在 0–1。', 'invalid-probability-range':'概率数据必须在 0–1 内。', 'invalid-values':'数据包含非有限数值。', provenanceRequired:'请填写来源及配准依据。', importError:'无法读取影像，请检查 NIfTI 文件。',
});
Object.assign(TEXT.en, {
  subtitle:'Compare atlas regions with paper results, masks, and continuous maps.', importTitle:'Import local NIfTI', localOnly:'Files stay in this browser; no upload. Supports 3D .nii / .nii.gz, up to 128 MiB per file and 64 million voxels.', file:'Image file', kind:'Data type', labelKind:'Integer labels', maskKind:'Binary mask (0/1)', statisticKind:'Statistical map', probabilityKind:'Probability map (0–1)', reference:'Exact reference space', nativeSpace:'Native / unverified', otherSpace:'Other reference space', exactReference:'Full reference-space name', aligned:'I confirm this file is already aligned to the current FSL MNI152NLin6Asym template', provenance:'Source and alignment evidence (DOI, processing steps, transform file, etc.)', provenanceHint:'A NIfTI affine or the name “MNI” alone does not establish template identity. This declaration is saved and exported with metrics.', labelsFile:'Label names (optional CSV / JSON)', labelsHint:'CSV columns: id,name,zh. JSON: label array or ID-to-name mapping.', importButton:'Import image', importing:'Checking image…', importDone:'Imported', nativeImport:'Reference alignment is unverified. Available in the native viewer; comparison with the current template is disabled.', declared:'User-declared alignment (not independently verified)', conflict:'The sform and qform disagree. The sform is used; check the source.', combine:'Union of selected labels (hold Ctrl / ⌘ to select several)', thresholdValue:'Threshold (inclusive)', positive:'Positive: v ≥ threshold', negative:'Negative: v ≤ −threshold', absolute:'Absolute: |v| ≥ threshold', tail:'Statistical tail', range:'Value range', binary:'Thresholded binary metrics', probabilityTitle:'Probability-weight overlap (independent of binary thresholds)', fuzzyDice:'Fuzzy Dice', fuzzyJaccard:'Fuzzy Jaccard', probabilityHint:'Both full probability maps are trilinearly sampled on the shared grid, then compared using min/max weights. This is not the joint probability of independent events. Voxel counts and surfaces below use the thresholded binary masks.', probabilityOne:'Probability-weight metrics require two probability maps. Only binary thresholded results are reported here.', maskExport:'Export NIfTI mask', thresholdHint:'Continuous maps are trilinearly sampled before thresholding; outside-source values are zero. Zero background is always excluded.', maskHint:'Uses all nonzero voxels.', 'invalid-threshold':'Use a finite nonnegative threshold; probability thresholds must be in 0–1.', 'invalid-probability-range':'Probabilities must lie within 0–1.', 'invalid-values':'The data contain non-finite values.', provenanceRequired:'Enter the source and alignment evidence.', importError:'Could not read the image. Check the NIfTI file.',
});
const NIFTI_ERRORS = {
  'nifti-truncated-header':['文件头不完整。','The file header is truncated.'], 'nifti-unsupported-header':['仅支持 NIfTI-1。','Only NIfTI-1 is supported.'], 'nifti-single-file-required':['请选择单文件 .nii / .nii.gz，不支持 hdr/img 配对。','Use a single-file .nii / .nii.gz, not a hdr/img pair.'], 'nifti-4d-unsupported':['不支持四维或更高维影像，请先提取单个三维图。','4D or higher images are unsupported; extract a single 3D map first.'], 'nifti-invalid-dimensions':['三维尺寸无效。','Invalid 3D dimensions.'], 'nifti-too-many-voxels':['影像超过 6400 万体素上限。','The image exceeds 64 million voxels.'], 'nifti-file-too-large':['文件超过 128 MiB 上限。','The file exceeds 128 MiB.'], 'nifti-decoded-too-large':['解压后数据超过内存上限。','The decompressed data exceed the size limit.'], 'nifti-unsupported-datatype':['不支持此数据类型或位深不匹配。','Unsupported datatype or mismatched bit depth.'], 'nifti-unknown-spatial-units':['空间单位未定义，不能按毫米推测。','Spatial units are undefined; millimetres cannot be assumed.'], 'nifti-missing-affine':['文件没有有效的 sform / qform。','The file has no valid sform / qform.'], 'nifti-invalid-affine':['仿射矩阵无效或超出坐标范围。','Invalid affine or coordinates outside supported bounds.'], 'nifti-invalid-qform':['qform 旋转或体素间距无效。','Invalid qform rotation or voxel spacing.'], 'nifti-invalid-offset':['影像数据偏移无效。','Invalid image-data offset.'], 'nifti-truncated-data':['数据长度与文件头尺寸不符。','Data are truncated for the declared image dimensions.'], 'nifti-invalid-extension':['NIfTI 扩展块损坏。','Invalid NIfTI extension block.'], 'nifti-invalid-scaling':['数据缩放系数无效。','Invalid intensity scaling.'], 'nifti-nonfinite-data':['影像含 NaN、无穷或超范围数值。','The image contains NaN, infinity, or out-of-range values.'], 'nifti-invalid-labels':['标签图必须为非负整数；连续图请选择统计图。','Labels must be nonnegative integers; choose statistical map for continuous data.'], 'nifti-not-binary':['掩膜包含 0/1 之外的值。','The mask contains values other than 0 and 1.'], 'nifti-probability-range':['概率图必须为 0–1；请先转换百分比数据。','Probabilities must be in 0–1; convert percentage data first.'], 'nifti-invalid-gzip':['gzip 压缩文件损坏。','Invalid gzip data.'], 'nifti-gzip-unavailable':['此浏览器不支持 gzip，请使用解压后的 .nii。','This browser cannot decompress gzip; use an uncompressed .nii.'], 'labels-invalid-table':['标签表须含唯一正整数 id 与非空 name。','Label tables require unique positive integer IDs and nonempty names.'],
};
TEXT.zh.surfaceOmitted = '部分三维表面超过大小上限，已略去；精确指标、交叉切片和掩膜导出仍有效。';
TEXT.en.surfaceOmitted = 'Some 3D surfaces exceed the size limit and are omitted. Exact metrics, linked slices, and mask exports remain available.';
TEXT.zh.continuousMethod = '标签和掩膜采用最近邻采样；连续图先三线性采样后阈值。没有估计新的解剖配准。';
TEXT.en.continuousMethod = 'Labels and masks use nearest-neighbour sampling; continuous maps use trilinear sampling before thresholding. No new anatomical registration is estimated.';
TEXT.zh.viewNative = '独立查看';
TEXT.en.viewNative = 'View native volume';
TEXT.zh.importedVolumes = '已导入影像';
TEXT.en.importedVolumes = 'Imported images';
TEXT.zh.cancelCompute = '取消计算';
TEXT.en.cancelCompute = 'Cancel computation';
TEXT.zh.restoreAborted = '先前的 ROI 对照未能完整恢复；请核对来源与选择后重新计算。';
TEXT.en.restoreAborted = 'The previous ROI comparison could not be fully restored. Check the sources and selections, then compute again.';
const alignmentKey = status => status === 'user-declared' ? 'declared' : status === 'verified-native' ? 'native' : status === 'published-affine' ? 'affine' : status === 'registered' ? 'registered' : 'published';
const localizedLabel = (label, language) => language === 'zh' && label?.zh ? label.zh : label?.name;
const safeCSV = value => {
  const raw = String(value ?? '');
  // Imported labels and provenance are text, even when they start like spreadsheet formulas.
  const text = typeof value === 'string' && /^[=+@\-\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
};
const formatRatio = value => value == null ? '—' : value.toFixed(4);
const formatPercent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

function useSource(atlasId, version) {
  const [state, setState] = useState({ loading: true, volume: null, labels: [], error: null });
  useEffect(() => {
    let active = true;
    setState({ loading: true, volume: null, labels: [], error: null });
    if (!atlasId) { setState({ loading: false, volume: null, labels: [], error: null }); return () => { active = false; }; }
    Promise.resolve(getCustomVolume(atlasId) || loadAtlas(atlasId)).then(volume => {
      if (!volume || volume.canOverlayOnTarget !== true) throw new Error('unaligned-atlas');
      if (active) setState({ loading: false, atlasId, volume, labels: !volume.kind || volume.kind === 'label' ? positiveLabels(volume) : [], error: null });
    }).catch(error => { if (active) setState({ loading: false, atlasId, volume: null, labels: [], error: error.message }); });
    return () => { active = false; };
  }, [atlasId, version]);
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

function download(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ROICompare({ language = 'zh', manifest, onComparisonChange, onClose, initialState, onStateChange, customVolumes, onViewNative, onRestoreAborted }) {
  const t = TEXT[language === 'en' ? 'en' : 'zh'];
  const callbacks = useRef({}); callbacks.current = { onComparisonChange, onStateChange, onRestoreAborted };
  const [registryVersion, setRegistryVersion] = useState(0);
  useEffect(() => subscribeCustomVolumes(() => { abortRestore('registry-changed'); invalidateWork(); setRegistryVersion(v => v + 1); }), []);
  const [aAtlas, setAAtlas] = useState(initialState?.aAtlas || 'dk'), [bAtlas, setBAtlas] = useState(initialState?.bAtlas || 'ba-histology');
  const [aLabels, setALabels] = useState(initialState?.aLabels || []), [bLabels, setBLabels] = useState(initialState?.bLabels || []);
  const [aThreshold, setAThreshold] = useState(initialState?.aThreshold ?? .5), [bThreshold, setBThreshold] = useState(initialState?.bThreshold ?? .5);
  const [aTail, setATail] = useState(initialState?.aTail || 'positive'), [bTail, setBTail] = useState(initialState?.bTail || 'positive');
  const sourceA = useSource(aAtlas, registryVersion), sourceB = useSource(bAtlas, registryVersion);
  const aLabelIds = useMemo(() => new Set(sourceA.labels.map(label => label.id)), [sourceA.labels]);
  const bLabelIds = useMemo(() => new Set(sourceB.labels.map(label => label.id)), [sourceB.labels]);
  const [comparison, setComparison] = useState(null), [display, setDisplay] = useState({ ...ROI_DEFAULT_DISPLAY, ...initialState?.display });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [anatomy, setAnatomy] = useState(null), [point, setPoint] = useState([0, 0, 0]);
  const [importFile, setImportFile] = useState(null), [labelFile, setLabelFile] = useState(null), [importKind, setImportKind] = useState('label');
  const [importSpace, setImportSpace] = useState('native-unverified'), [otherSpace, setOtherSpace] = useState(''), [aligned, setAligned] = useState(false), [provenance, setProvenance] = useState('');
  const [importBusy, setImportBusy] = useState(false), [importError, setImportError] = useState(''), [importMessage, setImportMessage] = useState(null);
  const worker = useRef(null), sequence = useRef(0), restore = useRef(!!initialState?.computed), lastInitial = useRef(initialState), displayRef = useRef(display);
  const restoringRequest = useRef(false), previousRegistryVersion = useRef(registryVersion);
  const [restoreEpoch, setRestoreEpoch] = useState(0);
  const [restoreWarning, setRestoreWarning] = useState('');
  displayRef.current = display;
  const atlases = useMemo(() => {
    const entries = new Map(Object.entries(manifest?.atlases || {}).filter(([, meta]) => meta.available && (meta.data || meta.metadata || meta.file || meta.custom)));
    for (const volume of [...(customVolumes || []), ...listCustomVolumes()]) entries.set(volume.id, volume);
    return [...entries];
  }, [manifest, customVolumes, registryVersion]);
  const allowed = atlases.filter(([, meta]) => meta.canOverlayOnTarget === true).map(([id]) => id);
  const importedVolumes = atlases.filter(([, meta]) => meta.custom);
  function abortRestore(reason) {
    const active = restore.current || restoringRequest.current;
    restore.current = false; restoringRequest.current = false;
    if (active) {
      if (!['selection-changed','cancelled'].includes(reason)) setRestoreWarning(reason);
      callbacks.current.onRestoreAborted?.(reason);
    }
  }
  function invalidateWork() {
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setComparison(null); callbacks.current.onComparisonChange?.(null);
  }
  function changeSelection(update) {
    abortRestore('selection-changed'); invalidateWork(); setRestoreWarning(''); update();
  }
  useEffect(() => {
    if (lastInitial.current === initialState) return;
    lastInitial.current = initialState;
    if (!initialState) return;
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setComparison(null); callbacks.current.onComparisonChange?.(null);
    restoringRequest.current = false;
    setRestoreWarning('');
    restore.current = !!initialState.computed;
    setAAtlas(initialState.aAtlas || 'dk'); setBAtlas(initialState.bAtlas || 'ba-histology');
    setALabels(initialState.aLabels || []); setBLabels(initialState.bLabels || []);
    setAThreshold(initialState.aThreshold ?? .5); setBThreshold(initialState.bThreshold ?? .5);
    setATail(initialState.aTail || 'positive'); setBTail(initialState.bTail || 'positive');
    setDisplay({ ...ROI_DEFAULT_DISPLAY, ...initialState.display });
    setRestoreEpoch(value => value + 1);
  }, [initialState]);
  useEffect(() => {
    if (!allowed.length || !manifest) return;
    if (!allowed.includes(aAtlas) || !allowed.includes(bAtlas)) abortRestore('source-unavailable');
    if (!allowed.includes(aAtlas)) setAAtlas(allowed[0]);
    if (!allowed.includes(bAtlas)) setBAtlas(allowed.includes('ba-histology') ? 'ba-histology' : allowed[1] || allowed[0]);
  }, [allowed.join('|'), aAtlas, bAtlas, manifest]);
  useEffect(() => {
    if (sourceA.labels.length) {
      if (aLabels.some(id => !aLabelIds.has(+id))) abortRestore('label-unavailable');
      setALabels(current => { const valid = current.filter(id => aLabelIds.has(+id)); return valid.length ? valid : [(sourceA.labels.find(label => /left precentral/i.test(label.name)) || sourceA.labels[0]).id]; });
    }
  }, [sourceA.labels, aLabelIds]);
  useEffect(() => {
    if (sourceB.labels.length) {
      if (bLabels.some(id => !bLabelIds.has(+id))) abortRestore('label-unavailable');
      setBLabels(current => { const valid = current.filter(id => bLabelIds.has(+id)); return valid.length ? valid : [(sourceB.labels.find(label => /BA4a L$/.test(label.name)) || sourceB.labels[0]).id]; });
    }
  }, [sourceB.labels, bLabelIds]);
  const selectionKey = JSON.stringify([aAtlas, bAtlas, aLabels, bLabels, aThreshold, bThreshold, aTail, bTail]);
  useEffect(() => {
    if (previousRegistryVersion.current !== registryVersion) abortRestore('registry-changed');
    previousRegistryVersion.current = registryVersion;
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setError(''); setComparison(null); callbacks.current.onComparisonChange?.(null);
  }, [selectionKey, registryVersion]);
  useEffect(() => {
    if ((sourceA.error && sourceA.atlasId === aAtlas) || (sourceB.error && sourceB.atlasId === bAtlas)) abortRestore('source-load-failed');
  }, [sourceA.error, sourceA.atlasId, sourceB.error, sourceB.atlasId, aAtlas, bAtlas]);
  useEffect(() => {
    for (const [source, atlasId, labels, ids] of [[sourceA,aAtlas,aLabels,aLabelIds],[sourceB,bAtlas,bLabels,bLabelIds]]) {
      if (source.atlasId === atlasId && !source.loading && source.volume && (source.volume.kind || 'label') === 'label' && (!labels.length || labels.some(id => !ids.has(+id)))) abortRestore('label-unavailable');
    }
  }, [selectionKey, sourceA, sourceB, aLabelIds, bLabelIds]);
  useEffect(() => () => { sequence.current++; worker.current?.terminate(); }, []);
  useEffect(() => {
    callbacks.current.onStateChange?.({ aAtlas, bAtlas, aLabels, bLabels, aThreshold, bThreshold, aTail, bTail, display, computed: !!comparison || restore.current || restoringRequest.current });
  }, [selectionKey, display, comparison, busy, restoreWarning]);

  const ready = sourceA.atlasId === aAtlas && sourceB.atlasId === bAtlas && sourceA.volume && sourceB.volume && !sourceA.loading && !sourceB.loading && ((sourceA.volume.kind || 'label') !== 'label' || (aLabels.length && aLabels.every(id => aLabelIds.has(+id)))) && ((sourceB.volume.kind || 'label') !== 'label' || (bLabels.length && bLabels.every(id => bLabelIds.has(+id))));
  const missingThreshold = (['statistic','probability'].includes(sourceA.volume?.kind) && aThreshold === '') || (['statistic','probability'].includes(sourceB.volume?.kind) && bThreshold === '');
  async function compute() {
    if (!ready) return;
    setRestoreWarning('');
    restoringRequest.current = restore.current;
    restore.current = false;
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
        if (data.error) { abortRestore('compute-failed'); setError(data.error); return; }
        restoringRequest.current = false;
        const result = { ...data.comparison, display: { ...displayRef.current } };
        setComparison(result); setPoint(result.center || [0, 0, 0]); callbacks.current.onComparisonChange?.(result);
      };
      current.onerror = () => { if (requestId === sequence.current) { abortRestore('worker-failed'); setBusy(false); setError('computeError'); current.terminate(); worker.current = null; } };
      const describe = (source, atlasId, labels) => ({ atlasId, name: source.labels.length ? source.labels.filter(label => labels.includes(label.id)).map(label => label.name).join(' + ') : source.volume.name });
      current.postMessage({ requestId, volumeA: serializableVolume(sourceA.volume), volumeB: serializableVolume(sourceB.volume), selectionA: { labels: aLabels, threshold: aThreshold, tail: aTail }, selectionB: { labels: bLabels, threshold: bThreshold, tail: bTail }, target: { shape: target.shape, affine: target.affine, space: target.space }, descriptors: { A: describe(sourceA, aAtlas, aLabels), B: describe(sourceB, bAtlas, bLabels) } });
    } catch (problem) { if (requestId === sequence.current) { abortRestore('compute-failed'); setBusy(false); setError(problem.message); } }
  }
  useEffect(() => { if (restore.current && ready && !busy) compute(); }, [ready, selectionKey, sourceA.volume, sourceB.volume, restoreEpoch]);
  function changeDisplay(patch) {
    const next = { ...display, ...patch }; setDisplay(next);
    if (comparison) { const value = { ...comparison, display: next }; setComparison(value); callbacks.current.onComparisonChange?.(value); }
  }
  function clear() { abortRestore('cancelled'); invalidateWork(); setRestoreWarning(''); }
  function exportMetrics() {
    if (!comparison) return;
    const lines = [['metric', 'value'], ...Object.entries(comparison.metrics)];
    if (comparison.probabilityMetrics) lines.push(...Object.entries(comparison.probabilityMetrics).map(([key, value]) => [`probability ${key}`, value]));
    for (const key of ['A', 'B']) {
      const source = comparison[key];
      lines.push([`${key} atlas`, source.atlasId], [`${key} label ID`, source.labelId], [`${key} label IDs`, source.labelIds.join(' + ')], [`${key} label name`, source.name], [`${key} alignment`, source.alignmentStatus], [`${key} space`, source.space], [`${key} source`, source.source], [`${key} provenance`, source.provenance], [`${key} selection`, JSON.stringify(source.selection)], [`${key} interpolation`, source.interpolation], [`${key} source voxel count`, source.sourceLabelVoxels]);
    }
    lines.push(['target space', comparison.grid.space], ['voxel volume mm3', comparison.grid.voxelVolumeMm3], ['shape', comparison.grid.shape.join(' × ')], ['affine row-major', comparison.grid.affine.join(' ')], ['method', comparison.method]);
    download('\ufeff' + lines.map(row => row.map(safeCSV).join(',')).join('\r\n'), `${t.downloadName}-${comparison.A.atlasId}-${comparison.B.atlasId}.csv`, 'text/csv;charset=utf-8');
  }
  async function importVolume() {
    if (!importFile || importBusy) return;
    setImportBusy(true); setImportError(''); setImportMessage(null);
    try {
      const space = importSpace === 'other' ? otherSpace.trim() || 'native-unverified' : importSpace;
      const accepted = space === 'MNI152NLin6Asym' && aligned;
      if (accepted && !provenance.trim()) throw new Error('provenanceRequired');
      if (importFile.size > MAX_NIFTI_FILE_BYTES) throw new Error('nifti-file-too-large');
      const volume = await parseNifti(await importFile.arrayBuffer(), { name: importFile.name.replace(/\.nii(\.gz)?$/i, ''), kind: importKind, space });
      if (labelFile) {
        if (labelFile.size > 2 * 1024 * 1024) throw new Error('labels-invalid-table');
        volume.labels = parseLabelTable(await labelFile.text(), /\.json$/i.test(labelFile.name) ? 'json' : 'csv');
      }
      Object.assign(volume, { canOverlayOnTarget: accepted, alignmentStatus: accepted ? 'user-declared' : 'unverified', provenance: provenance.trim(), source: importFile.name, metadata: { ...volume.metadata, userDeclaredAligned: accepted, referenceSpace: space } });
      const id = registerCustomVolume(volume);
      if (accepted) { setBAtlas(id); setBLabels([]); setBThreshold(importKind === 'probability' ? .5 : 0); }
      setImportMessage({ name: volume.name, aligned: accepted, conflict: volume.metadata.affineConflict });
    } catch (problem) { setImportError(problem.message); }
    finally { setImportBusy(false); }
  }
  const errorText = code => NIFTI_ERRORS[code]?.[language === 'en' ? 1 : 0] || t[code] || t.importError;
  const sourceBlock = (key, atlasId, setAtlas, labels, setLabels, threshold, setThreshold, tail, setTail, source) => {
    const kind = source.volume?.kind || 'label';
    return <fieldset className={`roi-source roi-source-${key.toLowerCase()}`}><legend>ROI {key}</legend>
      <label><span>{t.atlas}</span><select aria-label={`ROI ${key} atlas`} value={atlasId} onChange={event => changeSelection(() => { setLabels([]); setAtlas(event.target.value); })}>{atlases.map(([id, meta]) => <option key={id} value={id} disabled={meta.canOverlayOnTarget !== true}>{ATLAS_NAMES[id] || meta.name || id}{meta.canOverlayOnTarget !== true ? ` · ${t.blocked}` : ''}</option>)}</select></label>
      {kind === 'label' && <label><span>{t.label}</span><select multiple size={5} aria-label={`ROI ${key} label`} value={labels.map(String)} disabled={source.loading || !source.labels.length} onChange={event => changeSelection(() => setLabels([...event.target.selectedOptions].map(option => +option.value)))}>{source.labels.map(label => <option key={label.id} value={label.id}>{label.id} · {localizedLabel(label, language)} ({label.voxels.toLocaleString()} {t.voxels})</option>)}</select><small className="roi-note">{t.combine}</small></label>}
      {['statistic', 'probability'].includes(kind) && <><label><span>{t.thresholdValue}</span><input type="number" min="0" max={kind === 'probability' ? '1' : undefined} step="any" value={threshold} aria-label={`ROI ${key} threshold`} onChange={event => changeSelection(() => setThreshold(event.target.value === '' ? '' : +event.target.value))} /></label>{kind === 'statistic' && <label><span>{t.tail}</span><select aria-label={`ROI ${key} tail`} value={tail} onChange={event => changeSelection(() => setTail(event.target.value))}>{['positive','negative','absolute'].map(value => <option key={value} value={value}>{t[value]}</option>)}</select></label>}<p className="roi-note">{t.thresholdHint}</p></>}
      {kind === 'mask' && <p className="roi-note">{t.maskHint}</p>}
      {source.volume && <p className="roi-source-space">{t[alignmentKey(source.volume.alignmentStatus)]} · {source.volume.space}{source.volume.metadata && <> · {t.range}: {source.volume.metadata.min} – {source.volume.metadata.max}</>}</p>}
      {source.loading && <p className="roi-note" role="status">{t.loading}</p>}{source.error && <p role="alert" className="roi-error">{t[source.error] || t.sourceError}</p>}{kind === 'label' && !source.loading && !source.error && !source.labels.length && <p className="roi-note">{t.empty}</p>}
    </fieldset>;
  };
  return <section className="roi-compare" aria-label="ROI overlap comparison"><header className="roi-header"><div><h2>{t.title}</h2><p>{t.subtitle}</p></div>{onClose && <button type="button" className="roi-close" onClick={onClose} aria-label="Close ROI comparison" title={t.close}>×</button>}</header>
    <details className="roi-import"><summary>{t.importTitle}</summary><p className="roi-note">{t.localOnly}</p><div className="roi-import-grid">
      <label><span>{t.file}</span><input type="file" accept=".nii,.nii.gz" aria-label="Import NIfTI file" onChange={event => { setImportFile(event.target.files[0] || null); setImportMessage(null); }} /></label>
      <label><span>{t.kind}</span><select value={importKind} aria-label="Imported image kind" onChange={event => setImportKind(event.target.value)}>{['label','mask','statistic','probability'].map(kind => <option key={kind} value={kind}>{t[`${kind}Kind`]}</option>)}</select></label>
      <label><span>{t.reference}</span><select value={importSpace} aria-label="Imported reference space" onChange={event => { setImportSpace(event.target.value); setAligned(false); }}><option value="native-unverified">{t.nativeSpace}</option><option value="MNI152NLin6Asym">FSL MNI152NLin6Asym</option><option value="MNI152NLin2009cAsym">MNI152NLin2009cAsym</option><option value="other">{t.otherSpace}</option></select></label>
      {importSpace === 'other' && <label><span>{t.exactReference}</span><input value={otherSpace} onChange={event => setOtherSpace(event.target.value)} /></label>}
      <label><span>{t.labelsFile}</span><input type="file" accept=".csv,.json" aria-label="Import label names" onChange={event => setLabelFile(event.target.files[0] || null)} /><small>{t.labelsHint}</small></label>
    </div><label className="roi-import-provenance"><span>{t.provenance}</span><textarea rows={2} value={provenance} aria-label="Imported image provenance" onChange={event => setProvenance(event.target.value)} /></label>
      {importSpace === 'MNI152NLin6Asym' && <label className="roi-xray"><input type="checkbox" checked={aligned} aria-label="Confirm already aligned to FSL template" onChange={event => setAligned(event.target.checked)} />{t.aligned}</label>}
      <p className="roi-note">{t.provenanceHint}</p><div className="roi-actions"><button onClick={importVolume} disabled={!importFile || importBusy} aria-label="Import local NIfTI">{importBusy ? t.importing : t.importButton}</button></div>
      {importError && <p role="alert" className="roi-error">{errorText(importError)}</p>}{importMessage && <p className="roi-note" role="status">{t.importDone}: {importMessage.name} · {importMessage.aligned ? t.declared : t.nativeImport}{importMessage.conflict && <> · {t.conflict}</>}</p>}
    </details>
    {!!importedVolumes.length && <div className="roi-imported-volumes"><h3>{t.importedVolumes}</h3>{importedVolumes.map(([id, volume]) => <div key={id}><span><strong>{volume.name || id}</strong><small>{volume.space} · {volume.canOverlayOnTarget === true ? t.declared : t.blocked}</small>{volume.metadata?.affineConflict && <small className="roi-imported-warning">{t.conflict}</small>}</span>{onViewNative && <button type="button" onClick={() => onViewNative(id)} aria-label={`${t.viewNative}: ${volume.name || id}`}>{t.viewNative}</button>}</div>)}</div>}
    {!manifest ? <p role="status">{t.notLoaded}</p> : !allowed.length ? <p role="status">{t.noAtlases}</p> : <>
      <div className="roi-selectors">{sourceBlock('A', aAtlas, setAAtlas, aLabels, setALabels, aThreshold, setAThreshold, aTail, setATail, sourceA)}{sourceBlock('B', bAtlas, setBAtlas, bLabels, setBLabels, bThreshold, setBThreshold, bTail, setBTail, sourceB)}</div>
      <div className="roi-actions"><button type="button" className="roi-primary" onClick={compute} disabled={busy || !ready || missingThreshold} aria-label="Compute ROI overlap">{busy ? t.computing : t.compare}</button>{busy && <button type="button" onClick={clear} aria-label="Cancel ROI computation">{t.cancelCompute}</button>}{comparison && <><button type="button" onClick={clear} aria-label="Clear ROI overlay">{t.clear}</button><button type="button" onClick={exportMetrics} aria-label="Export ROI overlap metrics CSV">{t.export}</button></>}</div>
      {restoreWarning && <p role="alert" className="roi-warning">{t.restoreAborted}</p>}{error && <p role="alert" className="roi-error">{t[error] || t.computeError}</p>}{!comparison && !busy && <p className="roi-empty">{t.waiting}</p>}{busy && <p className="roi-note" role="status">{t.computing}</p>}
      {comparison && <div className="roi-result" aria-live="polite"><h3>{t.binary}</h3><div className="roi-metrics"><div><span>Dice</span><strong>{formatRatio(comparison.metrics.dice)}</strong><small>2|A ∩ B| / (|A| + |B|)</small></div><div><span>Jaccard</span><strong>{formatRatio(comparison.metrics.jaccard)}</strong><small>|A ∩ B| / |A ∪ B|</small></div><div><span>{t.coveredA}</span><strong>{formatPercent(comparison.metrics.aCoveredByB)}</strong></div><div><span>{t.coveredB}</span><strong>{formatPercent(comparison.metrics.bCoveredByA)}</strong></div></div>
        {comparison.probabilityMetrics ? <div className="roi-probability"><h3>{t.probabilityTitle}</h3><div className="roi-metrics"><div><span>{t.fuzzyDice}</span><strong>{formatRatio(comparison.probabilityMetrics.fuzzyDice)}</strong><small>2Σmin(p,q) / (Σp + Σq)</small></div><div><span>{t.fuzzyJaccard}</span><strong>{formatRatio(comparison.probabilityMetrics.fuzzyJaccard)}</strong><small>Σmin(p,q) / Σmax(p,q)</small></div></div><p className="roi-note">{t.probabilityHint}</p></div> : [comparison.A,comparison.B].some(source => source.selection.kind === 'probability') && <p className="roi-note">{t.probabilityOne}</p>}
        <p className="roi-grid"><strong>{t.grid}</strong> {comparison.grid.space} · {comparison.grid.shape.join(' × ')} · {t.resolution} {comparison.grid.voxelVolumeMm3.toLocaleString()} mm³</p>
        <table className="roi-counts"><thead><tr><th>{t.part}</th><th>{t.voxels}</th><th>{t.volume}</th></tr></thead><tbody>{[['A','aVoxels','aMm3'],['B','bVoxels','bMm3'],['intersection','intersectionVoxels','intersectionMm3'],['aOnly','aOnlyVoxels','aOnlyMm3'],['bOnly','bOnlyVoxels','bOnlyMm3'],['union','unionVoxels','unionMm3']].map(([key,count,volume]) => <tr key={key}><td>{ROI_COLORS[key] && <i style={{background:ROI_COLORS[key]}}/>}{t[key]}</td><td>{comparison.metrics[count].toLocaleString()}</td><td>{comparison.metrics[volume].toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>)}</tbody></table>
        <div className="roi-actions roi-export-masks"><span>{t.maskExport}</span>{['A','B','intersection','union'].map(part => <button key={part} aria-label={`Export ROI ${part} NIfTI mask`} onClick={() => download(exportNifti(comparisonMaskVolume(comparison, part)), `ROI-${part}.nii`, 'application/octet-stream')}>{t[part]}</button>)}</div>
        {!!comparison.surfaceWarnings?.length && <p className="roi-warning">{t.surfaceOmitted} ({comparison.surfaceWarnings.map(key => t[key]).join(', ')})</p>}
        {comparison.metrics.intersectionVoxels === 0 && <p className="roi-note">{t.noOverlap}</p>}{(!comparison.metrics.aVoxels || !comparison.metrics.bVoxels) && <p className="roi-warning">{t.emptyTarget}</p>}
        <fieldset className="roi-display"><legend>{t.showControls}</legend><label className="roi-mode"><span>{t.view}</span><select aria-label="ROI display mode" value={display.mode} onChange={event => changeDisplay({mode:event.target.value})}>{['parts','overlap','A','B'].map(mode=><option key={mode} value={mode}>{t[mode]}</option>)}</select></label><div className="roi-opacity">{[['opacityA','A'],['opacityB','B'],['opacityOverlap','intersection']].map(([key,color])=><label key={key}><span><i style={{background:ROI_COLORS[color]}}/>{t[key]}<output>{Math.round(display[key]*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={display[key]} onChange={event=>changeDisplay({[key]:+event.target.value})} aria-label={key==='opacityA'?'ROI A opacity':key==='opacityB'?'ROI B opacity':'ROI intersection opacity'}/></label>)}</div><label className="roi-xray"><input type="checkbox" checked={display.xray} onChange={event=>changeDisplay({xray:event.target.checked})} aria-label="ROI X-ray view"/>{t.xray}</label><p className="roi-note">{t.depthHint} {t.anatomyHint}</p></fieldset>
        {anatomy && <div className="roi-slices"><h3>{t.sliceTitle}</h3><div>{[['x','sagittal'],['y','coronal'],['z','axial']].map(([axis,title])=><SlicePreview key={axis} axis={axis} title={t[title]} anatomy={anatomy} comparison={comparison} point={point} onPoint={setPoint}/>)}</div><p className="roi-note">{t.sliceHint}</p></div>}
        <div className="roi-provenance">{[comparison.A,comparison.B].map((source,index)=><p key={index}><strong>ROI {index?'B':'A'}</strong> · {source.name} · {t[alignmentKey(source.alignmentStatus)]} · {source.resampled?t.resampled:t.sameGrid}{source.thresholdPercent!=null?` · ${t.threshold} ${source.thresholdPercent}%`:''}{source.provenance && <> · {source.provenance}</>}</p>)}{[comparison.A,comparison.B].some(source=>source.alignmentStatus==='published-affine')&&<p className="roi-warning">{t.approx}</p>}<p>{t.categorical}</p>{aAtlas===bAtlas&&sourceA.volume?.kind!=='probability'&&sourceA.volume?.kind!=='statistic'&&<p>{t.exclusive}</p>}<p>{t.continuousMethod}</p></div>
      </div>}
    </>}
  </section>;
}

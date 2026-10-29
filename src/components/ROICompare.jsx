import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CoordinateNavigator from './CoordinateNavigator.jsx';
import WorkspaceStatus from './WorkspaceStatus.jsx';
import {normalizeWorkspaceError} from '../lib/workspace-status.js';
import {atlasIdentityFor} from '../lib/volume.js';
import {atlasResourceKey,getResourceState,subscribe,retry} from '../lib/atlas-resource.js';
import { makeAtlasRegionRef } from '../lib/atlas-identity.js';
import { serializeAtlasSelection } from '../lib/atlas-selection.js';
import { updateROIRegionExpectation, roiRegionIdentityMismatch, createComparisonExportTasks } from '../lib/roi-region-state.js';
import { loadAnatomyVolume, loadAtlas, makeSliceCanvas, sliceWorldPoint, SLICE_BOUNDS } from '../lib/volume.js';
import { positiveLabels, ROI_COLORS, ROI_DEFAULT_DISPLAY, serializableVolume, comparisonMaskVolume, normalizeROISelection } from '../lib/roi.js';
import { prepareComparisonManifest, makeComputationManifest, compareComputationManifest, exportComparisonBundle } from '../lib/computation-manifest.js';
import {restoreComputation,createComputationSnapshot} from '../lib/saved-computation.js';
import { makeComparisonGrid } from '../lib/roi-grid.js';
import {parseNiftiInWorker,exportNiftiInWorker} from '../lib/nifti-worker-client.js';
import { newImportDraft, reduceImportDraft, stageVolumeImport } from '../lib/roi-import-state.js';
import { getCustomVolume, listCustomVolumes, subscribeCustomVolumes } from '../lib/custom-volumes.js';
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
Object.assign(TEXT.zh, {provenanceDetails:'计算来源', 'computation-provenance-required':'缺少源文件身份或变换记录，无法核对本次计算。', 'calculation-volume-byte-digest-mismatch':'当前体积数据与记录的摘要不一致，请重新载入来源。', 'result-manifest-mismatch':'计算来源与当前输入不一致，请重新计算。'});
Object.assign(TEXT.en, {provenanceDetails:'Computation sources', 'computation-provenance-required':'Source-file identities or transform records are missing; this comparison cannot be verified.', 'calculation-volume-byte-digest-mismatch':'Volume data differ from their recorded digest. Reload the source.', 'result-manifest-mismatch':'Computation provenance differs from the current inputs. Compute again.'});
Object.assign(TEXT.zh, {
  spacing:'采样间距', gridHint:'1 mm 是输出采样间距，不代表 1 mm 定位精度；AAL/AAL3 配准场估计于 2 mm。', sampling:'采样检查', sourceSample:'源网格：体素 / mm³', targetSample:'共同网格：体素 / mm³', lostLabels:'采样后消失的标签', absentLabels:'源数据不存在的标签', 'retained':'所选标签均有保留', 'partial-loss':'部分所选标签缺失', 'empty-target':'源区域存在，但在共同网格内为空', 'empty-source':'源选择没有体素，已停止计算', confirmLoss:'确认采样损失并计算', lossWarning:'共同网格未保留全部所选区域。确认后将生成带此警示的结果。', cancelPreflight:'取消采样检查', sourceMissing:'源选择缺少标签，已停止计算。', 'unsupported-reference-grid':'此参考网格不在支持的 NLin6Asym 标准网格中。',
});
Object.assign(TEXT.en, {
  spacing:'Sampling spacing', gridHint:'1 mm is output spacing, not 1 mm localization accuracy; AAL/AAL3 transform fields were estimated at 2 mm.', sampling:'Sampling check', sourceSample:'Source grid: voxels / mm³', targetSample:'Shared grid: voxels / mm³', lostLabels:'Labels lost in sampling', absentLabels:'Labels absent from source', retained:'All selected labels retained', 'partial-loss':'Some selected labels are missing', 'empty-target':'Source region exists but is empty on the shared grid', 'empty-source':'Source selection has no voxels; computation stopped', confirmLoss:'Confirm sampling loss and compute', lossWarning:'The shared grid does not retain every selected region. Confirm to compute a result carrying this warning.', cancelPreflight:'Cancel sampling check', sourceMissing:'Selected labels are absent from the source; computation stopped.', 'unsupported-reference-grid':'This reference is not a supported NLin6Asym standard grid.',
});
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
TEXT.zh.imageProcessingError = '影像处理模块未能完成任务。当前输入仍保留，请重试。';
TEXT.en.imageProcessingError = 'The image processing module could not complete the task. Your inputs are retained; please retry.';
TEXT.zh.restoreAborted = '先前的 ROI 对照未能完整恢复；请核对来源与选择后重新计算。';
TEXT.en.restoreAborted = 'The previous ROI comparison could not be fully restored. Check the sources and selections, then compute again.';
const alignmentKey = status => status === 'user-declared' ? 'declared' : status === 'verified-native' ? 'native' : status === 'published-affine' ? 'affine' : status === 'registered' ? 'registered' : 'published';
const localizedLabel = (label, language) => language === 'zh' && label?.zh ? label.zh : label?.name;
const formatRatio = value => value == null ? '—' : value.toFixed(4);
const formatPercent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

function useSource(atlasId, version, metadata) {
  const key=useMemo(()=>{try{return metadata?atlasResourceKey(atlasIdentityFor(metadata)):null;}catch{return null;}},[metadata]);
  const [generation,setGeneration]=useState(0);
  useEffect(()=>{if(!key)return;const update=()=>setGeneration(getResourceState(key).generation);const off=subscribe(key,update);update();return off;},[key]);
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
  }, [atlasId, version, key, generation]);
  return {...state,retry:key?()=>retry(key):undefined};
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
  return <div className="roi-slice"><div><span>{title}</span><span>{axis.toUpperCase()} {point[axisIndex]}</span></div><div className="roi-slice-image"><canvas ref={ref} aria-label={`${axis === 'x' ? 'Sagittal' : axis === 'y' ? 'Coronal' : 'Axial'} ROI overlap slice`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onPoint(sliceWorldPoint(axis, point[axisIndex], (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, true)); }}/><span className="roi-orientation-left">{axis === 'x' ? 'P' : 'R'}</span><span className="roi-orientation-right">{axis === 'x' ? 'A' : 'L'}</span></div></div>;
}

function download(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ROICompare({ language = 'zh', manifest, onComparisonChange, onComputedResult, onClose, initialState, savedSnapshot, recomputedSnapshot, provenanceStatus, onStateChange, onRestoreReady, customVolumes, onViewNative, onRestoreAborted, onImportVolume, onManageAssets, workspaceProjectId, workspaceEpoch, imageTaskIntent, onImportInputReady, onOpenComparisonViewer }) {
  const [paired,setPaired]=useState(initialState?.paired);
  const t = TEXT[language === 'en' ? 'en' : 'zh'];
  const callbacks = useRef({}); callbacks.current = { onComparisonChange, onComputedResult, onStateChange, onRestoreAborted };
  const initialSaved=useRef(initialState?.snapshot==='none'?null:initialState?.snapshot==='original'?savedSnapshot:initialState?.snapshot==='recomputed'?recomputedSnapshot:recomputedSnapshot??savedSnapshot),preserveSelections=useRef(!!initialState||!!initialSaved.current);
  if(initialState?.snapshotId&&initialSaved.current?.id!==initialState.snapshotId)initialSaved.current=null;
  const [inspectedSnapshot,setInspectedSnapshot]=useState(null),[inspectWhich,setInspectWhich]=useState(initialState?.snapshot==='original'?'original':initialState?.snapshot==='recomputed'?'recomputed':recomputedSnapshot?'recomputed':'original');
  const [currentManifest,setCurrentManifest]=useState(null),[provenanceError,setProvenanceError]=useState('');
  const selectedSaved=inspectWhich==='recomputed'?recomputedSnapshot:savedSnapshot;
  const requestedSnapshotMissing=initialState?.snapshotId&&![savedSnapshot?.id,recomputedSnapshot?.id].includes(initialState.snapshotId);
  const historical=useMemo(()=>restoreComputation(selectedSaved,{currentManifest,geometry:false}),[selectedSaved,currentManifest]);
  const [registryVersion, setRegistryVersion] = useState(0);
  useEffect(() => subscribeCustomVolumes(() => { abortRestore('registry-changed'); invalidateWork(); setRegistryVersion(v => v + 1); }), []);
  const [aAtlas, setAAtlas] = useState(initialState?.aAtlas ?? 'dk'), [bAtlas, setBAtlas] = useState(initialState?.bAtlas ?? 'ba-histology');
  const [aLabels, setALabels] = useState(initialState?.aLabels || []), [bLabels, setBLabels] = useState(initialState?.bLabels || []);
  const [expectedRegionRefs,setExpectedRegionRefs] = useState({A:initialState?.aRegionRefs ?? null,B:initialState?.bRegionRefs ?? null});
  const [aThreshold, setAThreshold] = useState(initialState?.aThreshold ?? .5), [bThreshold, setBThreshold] = useState(initialState?.bThreshold ?? .5);
  const [aTail, setATail] = useState(initialState?.aTail || 'positive'), [bTail, setBTail] = useState(initialState?.bTail || 'positive');
  const [resolutionMm, setResolutionMm] = useState(initialState?.resolutionMm === 1 ? 1 : 2);
  const [preflight, setPreflight] = useState(null);
  const sourceA = useSource(aAtlas, registryVersion, manifest?.atlases?.[aAtlas]), sourceB = useSource(bAtlas, registryVersion, manifest?.atlases?.[bAtlas]);
  const aLabelIds = useMemo(() => new Set(sourceA.labels.map(label => label.id)), [sourceA.labels]);
  const bLabelIds = useMemo(() => new Set(sourceB.labels.map(label => label.id)), [sourceB.labels]);
  const [comparison, setComparison] = useState(null), [display, setDisplay] = useState({ ...ROI_DEFAULT_DISPLAY, ...initialState?.display });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [anatomy, setAnatomy] = useState(null), [point, setPoint] = useState(initialState?.point??[0, 0, 0]);
  const restoredScroll=useRef(false),resultRef=useRef(null);
  const [computationNotice,setComputationNotice]=useState('');
  useEffect(()=>{if(!restoredScroll.current&&!sourceA.loading&&!sourceB.loading&&sourceA.volume&&sourceB.volume){restoredScroll.current=true;onRestoreReady?.();}},[sourceA,sourceB,onRestoreReady]);
  const [importFile, setImportFile] = useState(null), [importDraft, setImportDraft] = useState(()=>newImportDraft(null));
  const importDraftRef=useRef(importDraft),labelInput=useRef(null),imageInput=useRef(null);
  useLayoutEffect(()=>{if(imageTaskIntent)onImportInputReady?.(imageTaskIntent,imageInput.current);},[imageTaskIntent,onImportInputReady]);
  const {kind:importKind,spaceId:importSpace,otherSpace,aligned,provenance}=importDraft;
  const [importBusy, setImportBusy] = useState(false), [importError, setImportError] = useState(''), [importMessage, setImportMessage] = useState(null);
  const importGeneration=useRef(0),importMounted=useRef(true),importController=useRef(null);
  const [exportTasks]=useState(()=>createComparisonExportTasks());
  const [imageExportBusy,setImageExportBusy]=useState(false),[imageNotice,setImageNotice]=useState('');
  useEffect(()=>{importMounted.current=true;return()=>{importMounted.current=false;importGeneration.current++;importController.current?.abort();exportTasks.invalidate();};},[]);
  function changeImportDraft(action){
    importGeneration.current++;
    importController.current?.abort();importController.current=null;
    const next=reduceImportDraft(importDraftRef.current,action);importDraftRef.current=next;setImportDraft(next);
    setImportBusy(false);setImportError('');setImportMessage(null);
    if(action.type==='file-changed'&&labelInput.current)labelInput.current.value='';
  }
  const worker = useRef(null), sequence = useRef(0), restore = useRef(false), lastInitial = useRef(initialState), displayRef = useRef(display);
  const restoringRequest = useRef(false), previousRegistryVersion = useRef(registryVersion);
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
  function invalidateMaskExport(){exportTasks.invalidate();setImageExportBusy(false);}
  function replaceComparison(value){invalidateMaskExport();setComparison(value);}
  function invalidateWork() {
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setPreflight(null); setInspectedSnapshot(null); replaceComparison(null); callbacks.current.onComparisonChange?.(null);
  }
  function changeSelection(update) {
    abortRestore('selection-changed'); invalidateWork(); setRestoreWarning('');setComputationNotice(''); update();
  }
  function reselectRegion(side,kind,update) {
    preserveSelections.current=false;
    setExpectedRegionRefs(current=>updateROIRegionExpectation(current,{side,kind}));
    changeSelection(update);
  }
  useEffect(() => {
    if (lastInitial.current === initialState) return;
    lastInitial.current = initialState;
    invalidateMaskExport();
    if (!initialState) return;
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setPreflight(null); replaceComparison(null); callbacks.current.onComparisonChange?.(null);
    restoringRequest.current = false;
    setRestoreWarning('');
    restore.current = false;
    setPaired(initialState.paired);
    setAAtlas(initialState.aAtlas ?? 'dk'); setBAtlas(initialState.bAtlas ?? 'ba-histology');
    setALabels(initialState.aLabels || []); setBLabels(initialState.bLabels || []);
    setExpectedRegionRefs({A:initialState.aRegionRefs ?? null,B:initialState.bRegionRefs ?? null});
    setAThreshold(initialState.aThreshold ?? .5); setBThreshold(initialState.bThreshold ?? .5);
    setATail(initialState.aTail || 'positive'); setBTail(initialState.bTail || 'positive');
    setResolutionMm(initialState.resolutionMm === 1 ? 1 : 2);
    setDisplay({ ...ROI_DEFAULT_DISPLAY, ...initialState.display });
  }, [initialState]);
  useEffect(() => {
    if (!allowed.length || !manifest || preserveSelections.current) return;
    if (!allowed.includes(aAtlas) || !allowed.includes(bAtlas)) abortRestore('source-unavailable');
    if (aAtlas && !allowed.includes(aAtlas)) setAAtlas(allowed[0]);
    if (bAtlas && !allowed.includes(bAtlas)) setBAtlas(allowed.includes('ba-histology') ? 'ba-histology' : allowed[1] || allowed[0]);
  }, [allowed.join('|'), aAtlas, bAtlas, manifest]);
  useEffect(() => {
    if (sourceA.labels.length && !preserveSelections.current) {
      if (aLabels.some(id => !aLabelIds.has(+id))) abortRestore('label-unavailable');
      setALabels(current => { const valid = current.filter(id => aLabelIds.has(+id)); return valid.length ? valid : [(sourceA.labels.find(label => /left precentral/i.test(label.name)) || sourceA.labels[0]).id]; });
    }
  }, [sourceA.labels, aLabelIds]);
  useEffect(() => {
    if (sourceB.labels.length && !preserveSelections.current) {
      if (bLabels.some(id => !bLabelIds.has(+id))) abortRestore('label-unavailable');
      setBLabels(current => { const valid = current.filter(id => bLabelIds.has(+id)); return valid.length ? valid : [(sourceB.labels.find(label => /BA4a L$/.test(label.name)) || sourceB.labels[0]).id]; });
    }
  }, [sourceB.labels, bLabelIds]);
  const selectionKey = JSON.stringify([aAtlas, bAtlas, aLabels, bLabels, aThreshold, bThreshold, aTail, bTail, resolutionMm]);
  const refsFor = (id,source,labels) => source.atlasId === id && source.volume?.atlasVersion && source.volume?.spaceIdentitySource ? labels.map(label => makeAtlasRegionRef(id,source.volume,+label)) : [];
  const currentRegionRefs = useMemo(()=>{
    try { return {A:refsFor(aAtlas,sourceA,aLabels),B:refsFor(bAtlas,sourceB,bLabels)}; }
    catch { return {A:[],B:[]}; }
  },[selectionKey,sourceA,sourceB]);
  const identityMismatch = roiRegionIdentityMismatch(expectedRegionRefs,currentRegionRefs,{A:sourceA.volume,B:sourceB.volume});
  useEffect(()=>{if(identityMismatch){abortRestore('region-version-unavailable');if(!inspectedSnapshot)invalidateWork();}},[identityMismatch]);
  useLayoutEffect(() => {
    invalidateMaskExport();
    if (previousRegistryVersion.current !== registryVersion) abortRestore('registry-changed');
    previousRegistryVersion.current = registryVersion;
    sequence.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setPreflight(null); setError('');
    if(!inspectedSnapshot){replaceComparison(null);callbacks.current.onComparisonChange?.(null);}
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
    const snapshot=inspectedSnapshot?inspectWhich:comparison?.id!=null&&comparison.id===savedSnapshot?.id?'original':comparison?.id!=null&&comparison.id===recomputedSnapshot?.id?'recomputed':'none';
    callbacks.current.onStateChange?.({ aAtlas, bAtlas, aLabels, bLabels, aRegionRefs:serializeAtlasSelection(expectedRegionRefs.A ?? currentRegionRefs.A), bRegionRefs:serializeAtlasSelection(expectedRegionRefs.B ?? currentRegionRefs.B), aThreshold, bThreshold, aTail, bTail, resolutionMm, display, paired,snapshot,snapshotId:inspectedSnapshot?.id??comparison?.id??null,point, computed: !identityMismatch && (!!comparison || restore.current || restoringRequest.current) });
  }, [selectionKey, display, comparison, inspectedSnapshot, inspectWhich, savedSnapshot?.id, recomputedSnapshot?.id, busy, restoreWarning, currentRegionRefs, expectedRegionRefs, identityMismatch,point,paired]);

  const ready = !identityMismatch && sourceA.atlasId === aAtlas && sourceB.atlasId === bAtlas && sourceA.volume && sourceB.volume && !sourceA.loading && !sourceB.loading && ((sourceA.volume.kind || 'label') !== 'label' || (aLabels.length && aLabels.every(id => aLabelIds.has(+id)))) && ((sourceB.volume.kind || 'label') !== 'label' || (bLabels.length && bLabels.every(id => bLabelIds.has(+id))));
  const missingThreshold = (['statistic','probability'].includes(sourceA.volume?.kind) && aThreshold === '') || (['statistic','probability'].includes(sourceB.volume?.kind) && bThreshold === '');
  // Observe actual current identities for comparison, without ROI resampling or worker work.
  useEffect(()=>{
    let cancelled=false;setCurrentManifest(null);setProvenanceError('');
    if(!ready||missingThreshold)return;
    (async()=>{try{
      const target=await loadAnatomyVolume(),grid=makeComparisonGrid(target,resolutionMm);
      const a=normalizeROISelection(sourceA.volume,{labels:aLabels,threshold:aThreshold,tail:aTail}),b=normalizeROISelection(sourceB.volume,{labels:bLabels,threshold:bThreshold,tail:bTail});
      const value=await prepareComparisonManifest(sourceA.volume,a,sourceB.volume,b,grid);
      if(!cancelled){setAnatomy(target);setCurrentManifest(value);}
    }catch(problem){if(!cancelled)setProvenanceError(problem.message);}})();
    return()=>{cancelled=true;};
  },[ready,missingThreshold,selectionKey,sourceA.volume,sourceB.volume]);
  function inspectSaved(snapshot=selectedSaved,restoredDisplay=snapshot?.display){
    if(!snapshot)return;
    invalidateWork();setError('');setInspectedSnapshot(snapshot);
    try{
      const restored=restoreComputation(snapshot,{currentManifest});
      if(restored.geometryError)setError(restored.geometryError);
      if(restored.comparison){const value={...restored.comparison,display:{...ROI_DEFAULT_DISPLAY,...restoredDisplay}};setDisplay(value.display);replaceComparison(value);setPoint(initialState?.point??value.center??[0,0,0]);callbacks.current.onComparisonChange?.(value,{inspection:true});}
    }catch(problem){setError(problem.message);}
  }
  useEffect(()=>{if(initialSaved.current)inspectSaved(initialSaved.current,initialState?.display??initialSaved.current.display);},[]);
  async function compute() {
    if (!ready) return;
    setRestoreWarning('');setComputationNotice('');
    restoringRequest.current = restore.current;
    restore.current = false;
    const requestId = ++sequence.current;
    worker.current?.terminate(); setBusy(true); setPreflight(null); setInspectedSnapshot(null); replaceComparison(null); callbacks.current.onComparisonChange?.(null); setError('');
    try {
      const target = await loadAnatomyVolume();
      if (requestId !== sequence.current) return;
      setAnatomy(target);
      const grid = makeComparisonGrid(target, resolutionMm);
      const selectionA = normalizeROISelection(sourceA.volume, { labels: aLabels, threshold: aThreshold, tail: aTail });
      const selectionB = normalizeROISelection(sourceB.volume, { labels: bLabels, threshold: bThreshold, tail: bTail });
      const manifest = await prepareComparisonManifest(sourceA.volume, selectionA, sourceB.volume, selectionB, grid);
      if (requestId !== sequence.current) return;
      if(!restoreComputation(selectedSaved,{currentManifest:manifest,decision:'recompute',geometry:false}).shouldRecompute)return;
      const current = new Worker(new URL('../lib/roi.worker.js', import.meta.url), { type: 'module' }); worker.current = current;
      current.onmessage = async ({ data }) => {
        if (requestId !== sequence.current || data.requestId !== requestId) return;
        if (data.phase === 'preflight' && !data.error) {
          setPreflight(data);
          if (data.blocked) { abortRestore('empty-source'); setBusy(false); current.terminate(); worker.current = null; }
          return;
        }
        current.terminate(); worker.current = null;
        if (data.error) { setBusy(false);abortRestore('compute-failed'); setError(data.error); return; }
        if (!compareComputationManifest(manifest, data.comparison?.manifest).matches) { setBusy(false);abortRestore('compute-failed'); setError('result-manifest-mismatch'); return; }
        restoringRequest.current = false;
        setPreflight(null);
        try{
          const result=createComputationSnapshot({ ...data.comparison, manifest: makeComputationManifest(data.comparison.manifest), display: { ...displayRef.current } });
          await callbacks.current.onComputedResult?.(result,{isCurrent:()=>requestId===sequence.current,projectId:workspaceProjectId,epoch:workspaceEpoch});
          if(requestId!==sequence.current)return;
          setBusy(false);setInspectWhich(savedSnapshot?'recomputed':'original');replaceComparison(result);setPoint(result.center||[0,0,0]);callbacks.current.onComparisonChange?.(result);
        }catch(problem){if(requestId===sequence.current){setBusy(false);setError(problem.message);}}
      };
      current.onerror = () => { if (requestId === sequence.current) { abortRestore('worker-failed'); setBusy(false); setError('computeError'); current.terminate(); worker.current = null; } };
      const describe = (source, atlasId, labels) => ({ atlasId, regionRefs:refsFor(atlasId,source,labels), name: source.labels.length ? source.labels.filter(label => labels.includes(label.id)).map(label => label.name).join(' + ') : source.volume.name });
      current.postMessage({ requestId, volumeA: serializableVolume(sourceA.volume), volumeB: serializableVolume(sourceB.volume), selectionA, selectionB, target: grid, manifest, descriptors: { A: describe(sourceA, aAtlas, aLabels), B: describe(sourceB, bAtlas, bLabels) } });
    } catch (problem) { if (requestId === sequence.current) { abortRestore('compute-failed'); setBusy(false); setError(problem.message); } }
  }
  function changeDisplay(patch) {
    const next = { ...display, ...patch }; setDisplay(next);
    if (comparison) { const value = { ...comparison, display: next }; setComparison(value); callbacks.current.onComparisonChange?.(value); }
  }
  function clear() { if(busy)setComputationNotice(language==='en'?'Computation cancelled. Current selections and saved results are retained.':'计算已取消。当前选择与已保存结果仍保留。');abortRestore('cancelled'); invalidateWork(); setRestoreWarning(''); }
  function confirmSamplingLoss() {
    if (!preflight?.requiresConfirmation || preflight.requestId !== sequence.current || !worker.current) return;
    worker.current.postMessage({requestId:preflight.requestId, action:'confirm'});
    setPreflight(null);
  }
  function exportMetrics(format = 'csv') {
    const value=inspectedSnapshot||comparison;if(!value)return;
    try{
      // S5 owns complete manifest exports. Incomplete history exports its recorded facts verbatim.
      let bundle;
      let complete=false;try{makeComputationManifest(value.manifest);complete=true;}catch{/* Export incomplete recorded facts below. */}
      if(complete&&value.sampling){bundle=exportComparisonBundle(value);}
      else{const fields={schema:'neuroatlas-computation-v1',id:value.id??null,manifest:value.manifest??null,metrics:value.metrics??null,probabilityMetrics:value.probabilityMetrics??null,grid:value.grid??null,status:restoreComputation(value,{currentManifest,geometry:false}).status};const cell=n=>'"'+String(n).replaceAll('"','""')+'"';bundle={json:JSON.stringify(fields,null,2),csv:'field,value\r\n'+Object.entries(fields).map(([key,n])=>`${cell(key)},${cell(JSON.stringify(n))}`).join('\r\n')+'\r\n'};}
      download((format==='csv'?'\ufeff':'')+bundle[format],`${t.downloadName}-${value.A?.atlasId||'A'}-${value.B?.atlasId||'B'}.${format}`,format==='json'?'application/json':'text/csv;charset=utf-8');
    }catch(problem){setError(problem.message);}
  }
  async function importVolume() {
    if (!importFile || importBusy) return;
    const request=++importGeneration.current,projectId=workspaceProjectId,epoch=workspaceEpoch,draft=importDraftRef.current;
    const isCurrent=()=>importMounted.current&&request===importGeneration.current&&draft===importDraftRef.current;
    const controller=new AbortController();importController.current=controller;
    setImportBusy(true); setImportError(''); setImportMessage(null);setImageNotice('');
    try {
      const imported=await stageVolumeImport(draft,{file:importFile,isCurrent,signal:controller.signal,parseVolume:parseNiftiInWorker,stage:async(volume,summary,{isCurrent:check})=>{
        if(!onImportVolume)throw Error('workspace-session-unavailable');
        // App retains W2 revision admission and the final atomic commit guard.
        const id=await onImportVolume(volume,{projectId,epoch,isCurrent:check});
        return {id,volume,summary};
      }});
      if(!isCurrent())return;
      const {id,volume,summary}=imported,accepted=summary.alignmentStatus==='user-declared';
      if (accepted) reselectRegion('B','source',() => { setBAtlas(id); setBLabels([]); setBThreshold(summary.kind === 'probability' ? .5 : 0); });
      setImportMessage({summary,aligned:accepted,conflict:volume.metadata.affineConflict});
    } catch (problem) { if(isCurrent())setImportError(problem.message); }
    finally { if(isCurrent()){setImportBusy(false);importController.current=null;} }
  }
  function cancelImport(){
    importGeneration.current++;importController.current?.abort();importController.current=null;setImportBusy(false);
    setImageNotice(language==='en'?'Image import cancelled. Your file declaration is retained.':'影像导入已取消，当前文件声明仍保留。');
  }
  async function exportMask(part){
    if(imageExportBusy||!comparison)return;
    const task=exportTasks.begin(comparison);setImageExportBusy(true);setImageNotice('');
    try{
      const result=await exportNiftiInWorker(comparisonMaskVolume(task.comparison,part),{gzip:false},{signal:task.signal});
      if(importMounted.current&&exportTasks.isCurrent(task))download(result.bytes,`ROI-${part}${result.extension}`,'application/octet-stream');
    }catch(problem){if(importMounted.current&&exportTasks.isCurrent(task))setError(problem.message);}
    finally{if(importMounted.current&&exportTasks.finish(task))setImageExportBusy(false);}
  }
  function cancelExport(){
    invalidateMaskExport();
    setImageNotice(language==='en'?'Image export cancelled.':'影像导出已取消。');
  }
  const processingErrorText = code => /^nifti-worker-/.test(code)?t.imageProcessingError:null;
  const errorText = code => processingErrorText(code) || NIFTI_ERRORS[code]?.[language === 'en' ? 1 : 0] || t[code] || (/too-long|budget/.test(code)?(language==='en'?'The file or declaration exceeds the supported size limit.':'文件或声明超过支持的长度上限。'):t.importError);
  const sourceBlock = (key, atlasId, setAtlas, labels, setLabels, threshold, setThreshold, tail, setTail, source) => {
    const kind = source.volume?.kind || 'label';
    return <fieldset className={`roi-source roi-source-${key.toLowerCase()}`}><legend>ROI {key}</legend>
      <label><span>{t.atlas}</span><select aria-label={`ROI ${key} atlas`} value={atlasId} onChange={event => reselectRegion(key,'source',() => { setLabels([]); setAtlas(event.target.value); })}><option value="">{language==='en'?'Choose a source':'请选择来源'}</option>{atlases.map(([id, meta]) => <option key={id} value={id} disabled={meta.canOverlayOnTarget !== true}>{ATLAS_NAMES[id] || meta.name || id}{meta.canOverlayOnTarget !== true ? ` · ${t.blocked}` : ''}</option>)}</select></label>
      {kind === 'label' && <label><span>{t.label}</span><select multiple size={5} aria-label={`ROI ${key} label`} value={labels.map(String)} disabled={source.loading || !source.labels.length} onChange={event => reselectRegion(key,'labels',() => setLabels([...event.target.selectedOptions].map(option => +option.value)))}>{source.labels.map(label => <option key={label.id} value={label.id}>{label.id} · {localizedLabel(label, language)} ({label.voxels.toLocaleString()} {t.voxels})</option>)}</select><small className="roi-note">{t.combine}</small></label>}
      {['statistic', 'probability'].includes(kind) && <><label><span>{t.thresholdValue}</span><input type="number" min="0" max={kind === 'probability' ? '1' : undefined} step="any" value={threshold} aria-label={`ROI ${key} threshold`} onChange={event => changeSelection(() => setThreshold(event.target.value === '' ? '' : +event.target.value))} /></label>{kind === 'statistic' && <label><span>{t.tail}</span><select aria-label={`ROI ${key} tail`} value={tail} onChange={event => changeSelection(() => setTail(event.target.value))}>{['positive','negative','absolute'].map(value => <option key={value} value={value}>{t[value]}</option>)}</select></label>}<p className="roi-note">{t.thresholdHint}</p></>}
      {kind === 'mask' && <p className="roi-note">{t.maskHint}</p>}
      {source.volume && <p className="roi-source-space">{t[alignmentKey(source.volume.alignmentStatus)]} · {source.volume.space}{source.volume.metadata && <> · {t.range}: {source.volume.metadata.min} – {source.volume.metadata.max}</>}</p>}
      <WorkspaceStatus status={{phase:source.loading?'loading':source.error?'error':'ready',message:source.loading?t.loading:source.error?(t[source.error]||t.sourceError):'',retryLabel:t.retry}} onRetry={source.retry}/>{kind === 'label' && !source.loading && !source.error && !source.labels.length && <p className="roi-note">{t.empty}</p>}
    </fieldset>;
  };
  const samplingBlock = (sampling, grid) => <section className="roi-sampling" aria-label="ROI sampling report">
    <h3>{t.sampling}</h3>
    <p className="roi-grid"><strong>{t.grid}</strong> {grid.space} · {grid.shape.join(' × ')} · {grid.affine[0]} mm · RAS · [{[grid.affine[3],grid.affine[7],grid.affine[11]].join(', ')}]</p>
    <table className="roi-counts"><thead><tr><th>{t.part}</th><th>{t.sourceSample}</th><th>{t.targetSample}</th></tr></thead><tbody>{['A','B'].flatMap(key => {
      const report = sampling[key];
      return [<tr key={key}><td>ROI {key}</td><td>{report.sourceVoxels.toLocaleString()} / {report.sourceMm3.toLocaleString()}</td><td>{report.targetVoxels.toLocaleString()} / {report.targetMm3.toLocaleString()}</td></tr>, ...(report.labels.length > 1 ? report.labels.map(label => <tr key={`${key}-${label.labelId}`}><td>{key} · {label.labelId}</td><td>{label.sourceVoxels.toLocaleString()} / {label.sourceMm3.toLocaleString()}</td><td>{label.targetVoxels.toLocaleString()} / {label.targetMm3.toLocaleString()}</td></tr>) : [])];
    })}</tbody></table>
    {['A','B'].map(key => <p key={key} className={sampling[key].status === 'retained' ? 'roi-note' : 'roi-warning'}>ROI {key}: {t[sampling[key].status]}{!!sampling[key].lostLabelIds.length && <> · {t.lostLabels}: {sampling[key].lostLabelIds.join(', ')}</>}{!!sampling[key].absentLabelIds.length && <> · {t.absentLabels}: {sampling[key].absentLabelIds.join(', ')}</>}</p>)}
  </section>;
  const completeComparisonManifest=useMemo(()=>{try{return makeComputationManifest(comparison?.manifest);}catch{return null;}},[comparison?.manifest]);
  const hasDetailedResult=completeComparisonManifest&&comparison?.A?.selection&&comparison?.B?.selection&&['A','B'].every(key=>comparison.sampling?.[key]&&['labels','lostLabelIds','absentLabelIds'].every(field=>Array.isArray(comparison.sampling[key][field]))&&['sourceVoxels','sourceMm3','targetVoxels','targetMm3'].every(field=>Number.isFinite(comparison.sampling[key][field])))&&Number.isFinite(comparison.grid?.voxelVolumeMm3)&&['aVoxels','bVoxels','intersectionVoxels','unionVoxels','aOnlyVoxels','bOnlyVoxels','aMm3','bMm3','intersectionMm3','unionMm3','aOnlyMm3','bOnlyMm3'].every(key=>Number.isFinite(comparison.metrics?.[key]));
  const statusText=language==='en'?{
    'missing-input':'Missing input. Saved values are retained; the listed source files are unavailable.',
    'missing-provenance':'Missing historical provenance. Saved values are retained; their original identities were not recorded.',
    unverified:'Current inputs are unavailable or still loading. Saved provenance has not been verified.',
    matched:'Saved provenance matches the current inputs and settings.',
    mismatch:'Saved values are retained. Current inputs or settings differ from the saved computation.',
  }:{
    'missing-input':'缺少输入影像。已保留保存时的数值，以下来源文件不可用。',
    'missing-provenance':'缺少历史计算来源。已保留保存时的数值，原始身份未记录。',
    unverified:'当前输入不可用或仍在载入，尚未核对保存的计算来源。',
    matched:'保存的计算来源与当前输入和设置一致。',
    mismatch:'已保留保存时的数值；当前输入或设置与保存的计算不同。',
  };
  const fact=value=>value===undefined?(language==='en'?'Not recorded':'未记录'):JSON.stringify(value);
  return <section className="roi-compare" aria-label="ROI overlap comparison"><header className="roi-header"><div><h2>{t.title}</h2><p>{t.subtitle}</p></div>{onClose && <button type="button" className="roi-close" onClick={onClose} aria-label="Close ROI comparison" title={t.close}>×</button>}</header>
    <div className="roi-actions"><button type="button" aria-haspopup="dialog" aria-label="Open source comparison" onClick={()=>onOpenComparisonViewer?.({left:{assetId:aAtlas,labels:aLabels,threshold:aThreshold,tail:aTail},right:{assetId:bAtlas,labels:bLabels,threshold:bThreshold,tail:bTail},initialState:paired,onStateChange:setPaired})}>{language==='en'?'Compare source views':'并排查看来源'}</button></div>
    {(savedSnapshot||recomputedSnapshot||provenanceStatus==='missing-provenance'||initialState?.computed||requestedSnapshotMissing)&&<section aria-label="Saved computation" className="roi-provenance">
      {requestedSnapshotMissing&&<p role="alert" className="roi-warning">{language==='en'?'The result from this visit is no longer in the saved computation slots. Inputs are restored; choose an available saved result or explicitly recompute.':'此访问对应的结果已不在保存的计算位置中。已恢复输入；可选择现有保存结果，或明确重新计算。'}</p>}
      <p role="status" data-provenance-status={historical.status}>{selectedSaved?statusText[historical.status]:(language==='en'?'No historical numerical result was saved. Choose inputs and explicitly compute a new result.':'未保存历史数值结果。请选择输入并明确计算新结果。')}</p>
      {comparison&&<p>{comparison.id===savedSnapshot?.id?(language==='en'?'Viewing original saved result':'正在查看原始保存结果'):comparison.id===recomputedSnapshot?.id?(language==='en'?'Viewing recomputed result':'正在查看重新计算结果'):(language==='en'?'Viewing current computation':'正在查看本次计算结果')}</p>}
      {historical.overlayUnavailableReason&&<p>{language==='en'?`Saved grid space: ${selectedSaved.grid.space}. Numerical results remain available; this space cannot overlay the main brain.`:`保存的网格空间：${selectedSaved.grid.space}。仍可查看数值；此空间不能叠加到主脑。`}</p>}
      {!!historical.missingAssetIds.length&&<ul>{historical.missingAssetIds.map(id=><li key={id}><code>{id}</code></li>)}</ul>}
      <div className="roi-actions">{savedSnapshot&&<button type="button" aria-label="Inspect original saved ROI result" aria-pressed={comparison?.id===savedSnapshot.id||inspectedSnapshot?.id===savedSnapshot.id} onClick={()=>{setInspectWhich('original');inspectSaved(savedSnapshot);}}>{language==='en'?'View original saved result':'查看原始保存结果'}</button>}{recomputedSnapshot&&<button type="button" aria-label="Inspect recomputed ROI result" aria-pressed={comparison?.id===recomputedSnapshot.id||inspectedSnapshot?.id===recomputedSnapshot.id} onClick={()=>{setInspectWhich('recomputed');inspectSaved(recomputedSnapshot);}}>{language==='en'?'View recomputed result':'查看重新计算结果'}</button>}</div>
      {selectedSaved&&<details><summary>{language==='en'?'Saved result and identities':'保存的数值与身份'}</summary><p style={{overflowWrap:'anywhere'}}><code>{selectedSaved.id??(language==='en'?'ID not recorded':'未记录 ID')}</code></p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({metrics:selectedSaved.metrics??null,probabilityMetrics:selectedSaved.probabilityMetrics??null,manifest:selectedSaved.manifest??null},null,2)}</pre></details>}
      {!!historical.differences.length&&<details open><summary>{language==='en'?'Changed computation fields':'计算差异字段'}</summary><table className="roi-counts" aria-label="Computation provenance differences"><thead><tr><th>{language==='en'?'Field':'字段'}</th><th>{language==='en'?'Saved':'保存时'}</th><th>{language==='en'?'Current':'当前'}</th></tr></thead><tbody>{historical.differences.map((difference,index)=><tr key={index}>{[difference.path,fact(difference.saved),fact(difference.current)].map((value,i)=><td key={i} style={{overflowWrap:'anywhere',maxWidth:220}}><code>{value}</code></td>)}</tr>)}</tbody></table></details>}
      {inspectedSnapshot&&!hasDetailedResult&&<div className="roi-actions"><button type="button" onClick={()=>exportMetrics('csv')} aria-label="Export ROI overlap metrics CSV">{t.export}</button><button type="button" onClick={()=>exportMetrics('json')} aria-label="Export ROI provenance JSON">{language==='en'?'Export provenance JSON':'导出来源 JSON'}</button></div>}
      {provenanceError&&<p role="alert" className="roi-warning">{t[provenanceError]||provenanceError}</p>}
    </section>}
    <details className="roi-import"><summary>{t.importTitle}</summary><p className="roi-note">{t.localOnly}</p><div className="roi-import-grid">
      <label><span>{t.file}</span><input ref={imageInput} id="roi-import-file" type="file" accept=".nii,.nii.gz" aria-label="Import NIfTI file" onChange={event => { const file=event.target.files[0]||null;setImportFile(file);changeImportDraft({type:'file-changed',fileToken:file?crypto.randomUUID():null});event.target.value=''; }} /></label>
      <label><span>{t.kind}</span><select value={importKind} aria-label="Imported image kind" onChange={event => changeImportDraft({type:'kind-changed',value:event.target.value})}>{['label','mask','statistic','probability'].map(kind => <option key={kind} value={kind}>{t[`${kind}Kind`]}</option>)}</select></label>
      <label><span>{t.reference}</span><select value={importSpace} aria-label="Imported reference space" onChange={event => changeImportDraft({type:'space-changed',value:event.target.value})}><option value="native-unverified">{t.nativeSpace}</option><option value="MNI152NLin6Asym">FSL MNI152NLin6Asym</option><option value="MNI152NLin2009cAsym">MNI152NLin2009cAsym</option><option value="other">{t.otherSpace}</option></select></label>
      {importSpace === 'other' && <label><span>{t.exactReference}</span><input value={otherSpace} aria-label="Imported reference space name" onChange={event => changeImportDraft({type:'other-space-changed',value:event.target.value})} /></label>}
      <label><span>{t.labelsFile}</span><input ref={labelInput} type="file" accept=".csv,.json" aria-label="Import label names" disabled={!importFile} onChange={event => changeImportDraft({type:'label-file-changed',file:event.target.files[0]||null,fileToken:importDraft.fileToken})} /><small>{t.labelsHint}</small></label>
    </div><label className="roi-import-provenance"><span>{t.provenance}</span><textarea rows={2} value={provenance} aria-label="Imported image provenance" onChange={event => changeImportDraft({type:'provenance-changed',value:event.target.value})} /></label>
      {importSpace === 'MNI152NLin6Asym' && <label className="roi-xray"><input type="checkbox" checked={aligned} aria-label="Confirm already aligned to FSL template" onChange={event => changeImportDraft({type:'alignment-changed',value:event.target.checked})} />{t.aligned}</label>}
      {importFile&&<dl className="roi-import-summary" aria-label="Image import summary"><div><dt>{t.file}</dt><dd>{importFile.name}</dd></div><div><dt>{t.kind}</dt><dd>{t[`${importKind}Kind`]}</dd></div><div><dt>{t.reference}</dt><dd>{importSpace==='other'?otherSpace||t.nativeSpace:importSpace==='native-unverified'?t.nativeSpace:importSpace}</dd></div><div><dt>{t.labelsFile}</dt><dd>{importDraft.labelFile?.file.name||(language==='en'?'None':'无')}</dd></div></dl>}
      <p className="roi-note">{t.provenanceHint}</p><div className="roi-actions"><button onClick={importVolume} disabled={!importFile || importBusy} aria-label="Import local NIfTI">{importBusy ? t.importing : t.importButton}</button>{importBusy&&<button type="button" onClick={cancelImport} aria-label="Cancel NIfTI import">{language==='en'?'Cancel import':'取消导入'}</button>}</div>
      {importError && <p role="alert" className="roi-error">{errorText(importError)}</p>}{importMessage && <p className="roi-note" role="status">{t.importDone}: {importMessage.summary.fileName} · {t[`${importMessage.summary.kind}Kind`]} · {importMessage.summary.spaceId} · {importMessage.summary.labelFileName||(language==='en'?'No label table':'无标签表')} · {importMessage.aligned ? t.declared : t.nativeImport}{importMessage.conflict && <> · {t.conflict}</>}</p>}
    </details>
    {imageNotice&&<p role="status" className="roi-note">{imageNotice}</p>}
    {!!importedVolumes.length && <div className="roi-imported-volumes"><h3>{t.importedVolumes}</h3>{onManageAssets&&<button type="button" onClick={onManageAssets}>{language==='en'?'Manage project assets':'管理项目影像'}</button>}{importedVolumes.map(([id, volume]) => <div key={id}><span><strong>{volume.name || id}</strong><small>{volume.space} · {volume.canOverlayOnTarget === true ? t.declared : t.blocked}</small>{volume.metadata?.affineConflict && <small className="roi-imported-warning">{t.conflict}</small>}</span>{onViewNative && <button type="button" onClick={() => onViewNative(id)} aria-label={`${t.viewNative}: ${volume.name || id}`}>{t.viewNative}</button>}</div>)}</div>}
    {!manifest ? <p role="status">{t.notLoaded}</p> : !allowed.length ? <p role="status">{t.noAtlases}</p> : <>
      <div className="roi-selectors">{sourceBlock('A', aAtlas, setAAtlas, aLabels, setALabels, aThreshold, setAThreshold, aTail, setATail, sourceA)}{sourceBlock('B', bAtlas, setBAtlas, bLabels, setBLabels, bThreshold, setBThreshold, bTail, setBTail, sourceB)}</div>
      {identityMismatch&&<p className="roi-warning" role="alert">{language==='en'?'Saved atlas label identity is unavailable or has changed. Select the source labels again.':'保存的图谱标签身份不可用或版本已改变。请重新选择来源标签。'}</p>}
      <label className="roi-grid"><strong>{t.grid}</strong> <select aria-label="ROI shared grid spacing" value={resolutionMm} onChange={event => changeSelection(() => setResolutionMm(+event.target.value))}><option value="2">2 mm · 91 × 109 × 91</option><option value="1">1 mm · 181 × 217 × 181</option></select></label>
      <p className="roi-note">{t.gridHint}</p>
      <div className="roi-actions"><button type="button" className="roi-primary" onClick={compute} disabled={busy || !ready || missingThreshold} aria-label="Compute ROI overlap">{busy?t.computing:(savedSnapshot||recomputedSnapshot||initialState?.computed)?(language==='en'?'Recompute with current data':'按当前数据重新计算'):t.compare}</button>{busy && <button type="button" onClick={clear} aria-label="Cancel ROI computation">{t.cancelCompute}</button>}{comparison && <><button type="button" onClick={clear} aria-label="Clear ROI overlay">{t.clear}</button>{hasDetailedResult&&<><button type="button" onClick={() => exportMetrics('csv')} aria-label="Export ROI overlap metrics CSV">{t.export}</button><button type="button" onClick={() => exportMetrics('json')} aria-label="Export ROI provenance JSON">{language === 'en' ? 'Export provenance JSON' : '导出来源 JSON'}</button></>}</>}</div>
      {preflight && <div aria-live="polite">{samplingBlock(preflight.sampling, preflight.grid)}{preflight.blocked && <p className="roi-warning" role="alert">{t.sourceMissing}</p>}{preflight.requiresConfirmation && <><p className="roi-warning" role="alert">{t.lossWarning}</p><div className="roi-actions"><button type="button" className="roi-primary" aria-label="Confirm ROI sampling loss" onClick={confirmSamplingLoss}>{t.confirmLoss}</button><button type="button" aria-label="Cancel ROI sampling preflight" onClick={clear}>{t.cancelPreflight}</button></div></>}</div>}
      {restoreWarning && <p role="alert" className="roi-warning">{t.restoreAborted}</p>}{error && <WorkspaceStatus status={{phase:'error',message:processingErrorText(error)||(normalizeWorkspaceError(error,language)!==error?normalizeWorkspaceError(error,language):t[error]||t.computeError)}}/>}{!comparison && !busy && <p className="roi-empty">{t.waiting}</p>}<WorkspaceStatus status={{phase:busy?'loading':'ready',message:busy?t.computing:computationNotice,resultLabel:language==='en'?'View result':'查看结果'}} onOpenResult={hasDetailedResult?()=>{resultRef.current?.scrollIntoView({block:'nearest'});resultRef.current?.focus();}:undefined}/>
      {hasDetailedResult && <div ref={resultRef} tabIndex={-1} className="roi-result" aria-live="polite">{samplingBlock(comparison.sampling, comparison.grid)}<h3>{t.binary}</h3><div className="roi-metrics"><div><span>Dice</span><strong>{formatRatio(comparison.metrics.dice)}</strong><small>2|A ∩ B| / (|A| + |B|)</small></div><div><span>Jaccard</span><strong>{formatRatio(comparison.metrics.jaccard)}</strong><small>|A ∩ B| / |A ∪ B|</small></div><div><span>{t.coveredA}</span><strong>{formatPercent(comparison.metrics.aCoveredByB)}</strong></div><div><span>{t.coveredB}</span><strong>{formatPercent(comparison.metrics.bCoveredByA)}</strong></div></div>
        {comparison.probabilityMetrics ? <div className="roi-probability"><h3>{t.probabilityTitle}</h3><div className="roi-metrics"><div><span>{t.fuzzyDice}</span><strong>{formatRatio(comparison.probabilityMetrics.fuzzyDice)}</strong><small>2Σmin(p,q) / (Σp + Σq)</small></div><div><span>{t.fuzzyJaccard}</span><strong>{formatRatio(comparison.probabilityMetrics.fuzzyJaccard)}</strong><small>Σmin(p,q) / Σmax(p,q)</small></div></div><p className="roi-note">{t.probabilityHint}</p></div> : [comparison.A,comparison.B].some(source => source.selection.kind === 'probability') && <p className="roi-note">{t.probabilityOne}</p>}
        <p className="roi-grid"><strong>{t.grid}</strong> {comparison.grid.space} · {comparison.grid.shape.join(' × ')} · {t.resolution} {comparison.grid.voxelVolumeMm3.toLocaleString()} mm³</p>
        <table className="roi-counts"><thead><tr><th>{t.part}</th><th>{t.voxels}</th><th>{t.volume}</th></tr></thead><tbody>{[['A','aVoxels','aMm3'],['B','bVoxels','bMm3'],['intersection','intersectionVoxels','intersectionMm3'],['aOnly','aOnlyVoxels','aOnlyMm3'],['bOnly','bOnlyVoxels','bOnlyMm3'],['union','unionVoxels','unionMm3']].map(([key,count,volume]) => <tr key={key}><td>{ROI_COLORS[key] && <i style={{background:ROI_COLORS[key]}}/>}{t[key]}</td><td>{comparison.metrics[count].toLocaleString()}</td><td>{comparison.metrics[volume].toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>)}</tbody></table>
        <div className="roi-actions roi-export-masks"><span>{t.maskExport}</span>{['A','B','intersection','union'].map(part => <button key={part} disabled={imageExportBusy} aria-label={`Export ROI ${part} NIfTI mask`} onClick={()=>exportMask(part)}>{t[part]}</button>)}{imageExportBusy&&<><span role="status">{language==='en'?'Exporting image…':'正在导出影像…'}</span><button type="button" onClick={cancelExport} aria-label="Cancel NIfTI export">{language==='en'?'Cancel export':'取消导出'}</button></>}</div>
        <details className="roi-provenance"><summary>{t.provenanceDetails}</summary><p>{comparison.manifest.appVersion} · {comparison.manifest.algorithmVersion}</p>{comparison.manifest.inputs.slice(0,2).map((input,index)=><p key={index} style={{overflowWrap:'anywhere'}}><strong>{index?'B':'A'}</strong> · {input.id}<br/><code>SHA-256 {input.sha256}</code></p>)}</details>
        {!!comparison.surfaceWarnings?.length && <p className="roi-warning">{t.surfaceOmitted} ({comparison.surfaceWarnings.map(key => t[key]).join(', ')})</p>}
        {comparison.metrics.aVoxels > 0 && comparison.metrics.bVoxels > 0 && comparison.metrics.intersectionVoxels === 0 && <p className="roi-note">{t.noOverlap}</p>}{(!comparison.metrics.aVoxels || !comparison.metrics.bVoxels) && <p className="roi-warning">{t.emptyTarget}</p>}
        <fieldset className="roi-display"><legend>{t.showControls}</legend><label className="roi-mode"><span>{t.view}</span><select aria-label="ROI display mode" value={display.mode} onChange={event => changeDisplay({mode:event.target.value})}>{['parts','overlap','A','B'].map(mode=><option key={mode} value={mode}>{t[mode]}</option>)}</select></label><div className="roi-opacity">{[['opacityA','A'],['opacityB','B'],['opacityOverlap','intersection']].map(([key,color])=><label key={key}><span><i style={{background:ROI_COLORS[color]}}/>{t[key]}<output>{Math.round(display[key]*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={display[key]} onChange={event=>changeDisplay({[key]:+event.target.value})} aria-label={key==='opacityA'?'ROI A opacity':key==='opacityB'?'ROI B opacity':'ROI intersection opacity'}/></label>)}</div><label className="roi-xray"><input type="checkbox" checked={display.xray} onChange={event=>changeDisplay({xray:event.target.checked})} aria-label="ROI X-ray view"/>{t.xray}</label><p className="roi-note">{t.depthHint} {t.anatomyHint}</p></fieldset>
        {anatomy && <div className="roi-slices"><h3>{t.sliceTitle}</h3><CoordinateNavigator point={point} spaceId={comparison.grid.space||null} lockedSpace context="roi" language={language} bounds={SLICE_BOUNDS} onNavigate={p=>setPoint(p)}/><div>{[['x','sagittal'],['y','coronal'],['z','axial']].map(([axis,title])=><SlicePreview key={axis} axis={axis} title={t[title]} anatomy={anatomy} comparison={comparison} point={point} onPoint={setPoint}/>)}</div><p className="roi-note">{t.sliceHint}</p></div>}
        <div className="roi-provenance">{[comparison.A,comparison.B].map((source,index)=><p key={index}><strong>ROI {index?'B':'A'}</strong> · {source.name} · {t[alignmentKey(source.alignmentStatus)]} · {source.resampled?t.resampled:t.sameGrid}{source.thresholdPercent!=null?` · ${t.threshold} ${source.thresholdPercent}%`:''}{source.provenance && <> · {source.provenance}</>}</p>)}{[comparison.A,comparison.B].some(source=>source.alignmentStatus==='published-affine')&&<p className="roi-warning">{t.approx}</p>}<p>{t.categorical}</p>{aAtlas===bAtlas&&sourceA.volume?.kind!=='probability'&&sourceA.volume?.kind!=='statistic'&&<p>{t.exclusive}</p>}<p>{t.continuousMethod}</p></div>
      </div>}
    </>}
  </section>;
}

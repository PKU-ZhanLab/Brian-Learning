import React from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { atlasEvidence } from '../data/evidence.js';
import { localizeEvidence, localizeEvidenceItem, evidenceLevelLabelsEn } from '../i18n/evidence-en.js';

const statusNames = {
  'verified-native': ['同源模板已核对', 'Matched native template verified'],
  'published-affine': ['原作者仿射映射', 'Published affine mapping'],
  'published-template': ['原作者模板空间', 'Published template space'],
  registered: ['已配准并校验', 'Registered and validated'],
  'registered-affine': ['仿射配准', 'Affine registration'],
  'registered-nonlinear': ['非线性配准', 'Nonlinear registration'],
  'registered-estimate': ['项目估计配准', 'Project-estimated registration'],
  'user-declared': ['用户声明已对齐', 'User-declared alignment'],
  'resampled-only': ['仅重采样，未解剖配准', 'Resampled only; no anatomical registration'],
  unverified: ['空间关系待确认', 'Spatial relationship unverified'],
  independent: ['独立参考空间', 'Independent reference space'],
  legacy: ['历史数据，空间未验证', 'Historical data; space unverified'],
  'unverified-template': ['模板未验证，暂停叠加', 'Template unverified; overlay disabled'],
};
export const alignmentLabel = (value, language = 'zh') => statusNames[value]?.[language === 'en' ? 1 : 0] || value || (language === 'en' ? 'Spatial relationship unverified' : '空间关系待确认');
const fields = { anatomy: ['解剖', 'Anatomy'], function: ['生理功能', 'Physiology'], cognition: ['认知', 'Cognition'], clinical: ['临床', 'Clinical relevance'] };
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const hasCjk = value => /[\u3400-\u9fff]/.test(String(value));
const atlasNamesEn = { dk: 'Desikan–Killiany · DK', aal: 'AAL', aal3: 'AAL3', ho: 'Harvard–Oxford', jhu: 'JHU white-matter atlas', ba: 'BA · FSL historical labels', 'ba-histology': 'BA · Jülich histological subset', 'ba-legacy': 'BA · BrainNet legacy (unaligned)' };
const atlasNotesEn = {
  dk: 'All 34 × 2 DK cortical regions, including both insulae. FreeSurfer labels and paired surfaces come from the same FSL MNI152 reconstruction. The 2 mm volume uses nearest-neighbor resampling; vertex labels come from the original aparc.annot. These are not individual anatomical boundaries.',
  aal: 'Original AAL116 labels sampled every other voxel to 2 mm; this is not a new segmentation of the MNI152 population template.',
  aal3: 'The actual AAL3v2 label volume may use nonconsecutive IDs. Nuclear subdivisions come from the original atlas and are not exact boundaries in every individual.',
  ho: 'Maximum-probability map at a 25% threshold and 2 mm resolution. FreeSurfer IDs in the MGH mirror were restored to standard HO IDs using the accompanying label file. Includes whole cortex and white-matter labels; deep-nucleus boundaries depend on threshold.',
  jhu: 'JHU white-matter region labels (48 positive labels), not continuous tractography streamlines. A labeled white-matter region is not necessarily a complete tract.',
  ba: 'FSL Talairach historical labels mapped to MNI152 using the published Lancaster 2007 correction affine. Derived from coarse-slice digitization of one brain, not modern population histological boundaries.',
  'ba-legacy': 'Preserves 41 BrainNet legacy BA IDs. The original MNI variant is unverified and no anatomical registration was performed; these are not precise boundaries on the main template.',
  'ba-histology': 'An explicitly BA-named subset of Jülich postmortem histological probability maps, using the FSL maximum-probability map at a 25% threshold. Retains hemisphere and 3a/3b and 4a/4p subdivisions; missing IDs are not inferred from gyri.',
};
const limitationsEn = {
  '仿射映射不消除局部解剖差异。': 'Affine mapping does not remove local anatomical differences.',
  '左右使用同一 BA 编号；按 RAS 坐标辨别侧别。': 'Both hemispheres use the same BA number; determine side from RAS coordinates.',
  '空白处表示无标签，不能由邻近标签补齐。': 'Blank locations have no label and cannot be filled from neighboring labels.',
  '仅明确含 BA 名称的已发布区域；不等于全部人类细胞构筑学分区。': 'Includes only published regions explicitly named as BA; not all human cytoarchitectonic regions.',
  '其他非 BA 名称的 Jülich 区域不自动改名为 BA。': 'Other Jülich regions without BA names are not automatically renamed as BA.',
  '最大概率标签与群体概率不代表个体边界。': 'Maximum-probability labels and population probabilities are not individual boundaries.',
  '该旧版 FSL 数据的精确 MNI152 模板变体未从原始元数据独立确认。': 'The exact MNI152 variant of this older FSL dataset has not been independently confirmed from original metadata.',
};
const englishMetadata = (value, fallback) => limitationsEn[value] || (hasCjk(value) ? fallback : value);

export function ClaimEvidence({ evidence, field, referenceMap, language = 'zh' }) {
  const en = language === 'en';
  const items = evidence?.[field] || [];
  if (!items.length) return <small className="claim-gap">{en ? `Dedicated evidence for ${fields[field]?.[1].toLowerCase() || field} is still needed.` : `${fields[field]?.[0] || field}的专门证据待补充。`}</small>;
  return <details className="claim-evidence"><summary>{en ? 'Evidence and scope' : '依据与适用范围'} · {items.length}</summary>{items.map((original, i) => {
    const item = localizeEvidenceItem(original, language);
    const ref = referenceMap[item.refId];
    return <div key={i}><p>{item.claim}</p><small>{item.scope}</small>{ref && <a href={ref.url || (ref.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/` : `https://doi.org/${ref.doi}`)} target="_blank" rel="noreferrer">{ref.authors?.split(',')[0]} · {ref.year} <ExternalLink size={10}/></a>}</div>;
  })}</details>;
}

export function EvidenceOverview({ evidence, language = 'zh' }) {
  const en = language === 'en';
  if (!evidence) return <p className="evidence-note">{en ? 'Item-level evidence for this structure is still being assembled.' : '本结构的逐项证据尚待整理。'}</p>;
  const names = en ? evidenceLevelLabelsEn : { 'region-specific': '有区域相关研究', 'system-level': '系统/通路层面证据', textbook: '教材层面', unresolved: '证据待补' };
  const localized = localizeEvidence(evidence, undefined, language);
  return <div className="evidence-overview"><strong>{names[evidence.level] || evidence.level}</strong>{localized.gaps?.length > 0 && <ul>{localized.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>}</div>;
}

export function GeometryProvenance({ selected, anatomy, manifest, showSchematic, remoteLoaded = false, language = 'zh' }) {
  if (!selected) return null;
  const en = language === 'en';
  const t = (zh, english) => en ? english : zh;
  const data = anatomy?.structures?.[selected.id];
  let title, body, space;
  if (selected.category === 'cortex') {
    title = t('同源 DK 曲面与顶点标签', 'Matched DK surfaces and vertex labels');
    body = t('34 区/侧；表面注释和体素标签来自同一 FreeSurfer 重建。', '34 regions per hemisphere; surface annotations and voxel labels come from the same FreeSurfer reconstruction.');
    space = 'MNI152NLin6Asym';
  } else if (data) {
    title = ({ 'atlas-segmentation': t('图谱分割网格', 'Atlas segmentation mesh'), tractography: t('真实数据的纤维追踪估计', 'Tractography estimate from measured data'), schematic: t('尚无真实几何', 'Measured geometry unavailable') })[data.representation] || t('真实解剖数据', 'Measured anatomical data');
    body = data.coverage || data.note || list(data.limitations)[0];
    space = data.displaySpace || data.nativeSpace;
    if (data.dataset === 'HCP1065') body = selected.category === 'cranial'
      ? t('HCP1065 颅神经图谱中可用的颅内通路范围；不包含完整颅外分支。视神经条目包含视交叉邻近通路。', 'Available intracranial pathways in the HCP1065 cranial-nerve atlas; complete extracranial branches are not included. The optic-nerve entry includes pathways near the optic chiasm.')
      : t(`HCP1065 群体通路图谱 · 原始束标签 ${data.coverage || ''}`, `HCP1065 population pathway atlas · original tract label: ${englishMetadata(data.coverage || '', 'see source dataset')}`);
    if (data.dataset === 'PAM50') body = t('PAM50 图谱分割。保留原生直化形态；节段边界为图谱估计，Co1 无独立分区，灰白质和前后角最尾端未完全覆盖。', 'PAM50 atlas segmentation retains native straightened geometry. Segment boundaries are atlas estimates; Co1 has no separate parcel, and the caudal ends of gray/white matter and anterior/posterior horns are not fully covered.');
    if (data.remoteGeometry) {
      title = remoteLoaded ? t('浏览器从官方源重建的体素边界', 'Voxel boundary generated from the official source') : t('官方源可按需加载', 'Official source available on request');
      body += t(' 公开站点不镜像 PAM50 文件。加载后显示源体素分辨率下的单元边界，未平滑。', ' The public site does not mirror PAM50 files. Once loaded, source-resolution voxel-cell boundaries are shown without smoothing.');
    }
    if (data.representation === 'schematic') body = showSchematic
      ? t('尚无可独立映射的真实几何；当前只显示结构示意。', 'No independently mappable measured geometry is available; a schematic structure is displayed.')
      : t('尚无可独立映射的真实几何；示意默认隐藏。', 'No independently mappable measured geometry is available; the schematic is hidden by default.');
    if (typeof body === 'object') body = JSON.stringify(body);
    if (en) body = englishMetadata(body, 'Geometry comes from the named source dataset. Its coverage and registration status must be interpreted separately; the display does not establish individual anatomical boundaries.');
  } else {
    const geometricPartition = ['brainstem', 'cerebellum'].includes(selected.category);
    const mesh = manifest?.meshes?.find(m => m.id === selected.id || m.structureIds?.includes(selected.id) || (selected.category === 'brainstem' && m.id === 'ho-8') || (selected.category === 'cerebellum' && m.id === 'cerebellum'));
    title = mesh ? (geometricPartition ? t('真实外表面 + 示意切分', 'Measured outer surface + illustrative partition') : t('标签提取网格', 'Label-derived mesh')) : t('结构示意 / 尚无独立实测几何', 'Schematic structure / no independent measured geometry');
    body = mesh ? (geometricPartition
      ? t('整体表面来自真实标签；脑干三部分或小脑中线带的边界为几何切分，尚未得到独立解剖分区验证。', 'The outer surface comes from measured labels. Boundaries between the three brainstem divisions or the cerebellar midline band are geometric cuts, not independently validated anatomical parcels.')
      : t('由公开解剖标签提取。', 'Extracted from public anatomical labels.'))
      : showSchematic ? t('当前允许显示示意；不代表实测形态。', 'Schematics are enabled; they do not represent measured morphology.') : t('示意默认隐藏，仍可阅读该结构知识卡。', 'Schematics are hidden by default; the structure’s knowledge card remains available.');
    space = mesh?.space;
  }
  return <details className="geometry-provenance"><summary><Info size={12}/>{t('几何来源', 'Geometry source')} · {title}</summary>
    {space && <p>{t('空间：', 'Space: ')}{en ? englishMetadata(space, 'See source space metadata') : space}</p>}<p>{body}</p>
    {data?.targetAlignment && <p>{data.targetAlignment.verified
      ? t('已用本项目估计的 2 mm 模板变换映射至主脑模板。', 'Mapped to the main brain template using the 2 mm template transform estimated in this project.')
      : t('尚未与主脑模板完成解剖配准；联合显示仅作空间概览。', 'Anatomical registration to the main brain template is incomplete; combined display provides a spatial overview only.')}</p>}
    {data?.dataset === 'HCP1065' && <p>{t('流线是弥散 MRI 的群体估计，不是轴突；显示抽样和模板配准不能验证个体神经位置、细小末端或亚毫米精度。', 'Streamlines are population diffusion-MRI estimates, not axons. Display subsampling and template registration do not validate individual nerve positions, fine endings, or submillimeter accuracy.')}</p>}
    {data?.dataset === 'PAM50' && <p>{t('直化模板不表示正常脊髓曲率，不能用于同名椎骨或个体神经根定位。', 'The straightened template does not represent normal spinal curvature and cannot localize same-named vertebrae or individual nerve roots.')}</p>}
    {data?.limitations && <details><summary>{t('原始数据范围记录', 'Source coverage notes')}</summary>{list(data.limitations).map((limit, i) => <p key={i}>{en ? englishMetadata(limit, 'The source dataset has additional coverage limits. Use its documented labels and registration status; absence of a label does not establish anatomical absence.') : limit}</p>)}</details>}
    {data?.source && <a href={typeof data.source === 'string' ? data.source : data.source.url} target="_blank" rel="noreferrer">{t('原始数据', 'Source data')} <ExternalLink size={10}/></a>}
  </details>;
}

export default function DataProvenance({ manifest, atlasOptions, alignment, anatomy, baCoverage, referenceMap = {}, language = 'zh' }) {
  const en = language === 'en';
  const t = (zh, english) => en ? english : zh;
  return <>
    <p className="intro-text">{t('以 FSL MNI152NLin6Asym 为脑内主参考，逐项显示空间、来源与尚未解决的差异。', 'FSL MNI152NLin6Asym is the main intracranial reference. Space, provenance, and unresolved differences are shown for each dataset.')}</p>
    <div className="notice"><Info size={18}/><p>{en
      ? 'Matching RAS axes across templates does not establish anatomical alignment. Data are marked aligned only when supported by provenance or transformation evidence. The viewer now focuses on the brain; the spinal module has been removed.'
      : `${manifest?.registrationNote || '不同模板的 RAS 轴一致不等于解剖对齐。只有有来源或转换证据的数据才标记为对齐。'} 当前查看器聚焦脑结构，脊髓模块已移除。`}</p></div>
    <h3>{t('图谱与空间', 'Atlases and spaces')}</h3><div className="atlas-table">{atlasOptions.map(atlas => {
      const data = manifest?.atlases?.[atlas.id];
      const aligned = alignment?.atlases?.[atlas.id] || alignment?.datasets?.[atlas.id];
      return <div key={atlas.id}><div><strong>{en ? atlasNamesEn[atlas.id] || englishMetadata(atlas.label, atlas.id) : atlas.label}</strong><span className={`data-badge ${data?.available ? 'available' : ''}`}>{alignmentLabel(data?.alignmentStatus || aligned?.status, language)}</span></div>
        <p>{en ? atlasNotesEn[atlas.id] || 'Atlas labels must be interpreted in their documented native space and coverage.' : data?.note || atlas.description}</p>
        <small>{data?.positiveLabelCount || data?.labels?.filter(label => label.id > 0).length || 0} {data?.available?t('个体素标签', 'voxel labels'):t('条目录标签 · 无可用影像', 'catalog labels · no available volume')} · {data?.space || t('空间未确认', 'Space unverified')}</small>
        {data?.limitations?.map((limit, i) => <p className="data-limit" key={i}>{en ? englishMetadata(limit, 'Additional source coverage limits apply; see the original dataset and the alignment status above.') : limit}</p>)}
        {data?.source && <a href={typeof data.source === 'string' ? data.source : data.source.url} target="_blank" rel="noreferrer">{t('来源', 'Source')} <ExternalLink size={11}/></a>}
      </div>;
    })}</div>
    <h3>{t('BA1–52 覆盖索引', 'BA1–52 coverage index')}</h3>
    <p className="data-copy">{t('组织学子集保留 3a/3b、4a/4p 和侧别。历史标签来自数字化单脑与已发表仿射；两种证据不合并为一套精确边界。未覆盖编号继续保留检索条目。', 'The histological subset preserves 3a/3b, 4a/4p, and hemisphere. Historical labels come from a digitized single brain and a published affine. These evidence types are not merged into one set of precise boundaries. Uncovered IDs remain searchable.')}</p>
    <div className="ba-coverage-grid">{baCoverage?.map(row => <div key={row.number} className={row.histological ? 'histological' : row.historical ? 'historical' : 'missing'} title={row.histologicalLabels?.join('\n')}><strong>BA{row.number}</strong><span>{row.histological ? t('组织学 + 历史', 'Histology + historical') : row.historical ? t('历史标签', 'Historical label') : t('无空间标签', 'No spatial label')}</span></div>)}</div>
    <details className="claim-evidence"><summary>{t('BA 组织学分区与历史映射的原始文献', 'Primary sources for BA histology and historical mapping')}</summary>{Object.entries(atlasEvidence).filter(([key]) => key.startsWith('ba')).map(([key, items]) => <div key={key}><strong>{key === 'baTalairach' ? t('历史标签与空间变换', 'Historical labels and spatial transforms') : key.toUpperCase()}</strong>{items.map(original => {
      const item = localizeEvidenceItem(original, language);
      const ref = referenceMap[item.refId];
      return ref ? <p key={item.refId}><a href={ref.url} target="_blank" rel="noreferrer">{ref.authors.split(',')[0]} · {ref.year} · {ref.title}</a><small>{item.scope}</small></p> : null;
    })}</div>)}</details>
    <h3>{t('真实形态与未覆盖结构', 'Measured morphology and uncovered structures')}</h3>
    <p className="data-copy">{t('DK 使用配套皮层曲面。HCP1065 流线为弥散 MRI 图谱估计，不是逐根神经轴突。每个结构卡片列出具体范围。无真实几何的颅神经等条目，只有打开“显示结构示意”才显示相应示意。', 'DK uses paired cortical surfaces. HCP1065 streamlines are diffusion-MRI atlas estimates, not individual axons. Structure cards state specific coverage. Entries without measured geometry, including some cranial nerves, show illustrative shapes only when schematic structures are enabled.')}</p>
    {anatomy?.datasets && <p className="data-copy">{en
      ? `Connected geometry: ${anatomy.datasets.HCP1065?.realMappedStructureCount || 0} brain-tract/cranial-nerve entries.`
      : `已接入 ${anatomy.datasets.HCP1065?.realMappedStructureCount || 0} 项脑纤维/颅神经几何。`}</p>}
    <p className="data-copy">{t('毫米坐标用于读取相应图谱。解剖图谱命名、功能关联与损伤证据分别列出，区域论文不自动证明整个脑回或所有侧别具有同一功能。', 'Millimeter coordinates query the corresponding atlas. Anatomical labels, functional associations, and lesion evidence are listed separately. A regional paper does not establish one uniform function across an entire gyrus or both hemispheres.')}</p>
  </>;
}

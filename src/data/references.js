// Bibliographic metadata checked against PubMed / primary publisher records, 2026-10-25.
// A null PMID is intentional: historical papers and books may not have a PubMed record.
const ref = (id, authors, year, title, journal, volume, pages, pmid, type, summary, doi, extra = {}) => ({
  id, authors, year, title, journal, volume, pages, pmid, type, summary, doi,
  url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : doi ? `https://doi.org/${doi}` : '',
  verified: '2026-10-25', ...extra,
});

export const references = [
  ref('desikan2006', 'Desikan R S, Ségonne F, Fischl B, et al.', 2006, 'An automated labeling system for subdividing the human cerebral cortex on MRI scans into gyral based regions of interest', 'NeuroImage', '31(3)', '968-980', '16530430', 'anatomy', '以脑回和沟为界定义每侧 34 个皮层区域；支持解剖命名，不等同于功能边界。', '10.1016/j.neuroimage.2006.01.021'),
  ref('tzourio2002', 'Tzourio-Mazoyer N, Landeau B, Papathanassiou D, et al.', 2002, 'Automated anatomical labeling of activations in SPM using a macroscopic anatomical parcellation of the MNI MRI single-subject brain', 'NeuroImage', '15(1)', '273-289', '11771995', 'anatomy', 'AAL 建立在标准化单个受试者脑的宏观解剖分区上；不能与群体平均模板视为同一解剖。', '10.1006/nimg.2001.0978'),
  ref('rolls2020', 'Rolls E T, Huang C C, Lin C P, et al.', 2020, 'Automated anatomical labelling atlas 3', 'NeuroImage', '206', '116189', '31521825', 'anatomy', 'AAL3 细分丘脑和前扣带，并增加伏隔核、黑质等小核团；原作者提示谨慎解释小区域。', '10.1016/j.neuroimage.2019.116189'),
  ref('mori2008', 'Mori S, Oishi K, Jiang H, et al.', 2008, 'Stereotaxic white matter atlas based on diffusion tensor imaging in an ICBM template', 'NeuroImage', '40(2)', '570-582', '18255316', 'anatomy', '基于 DTI 构建 ICBM 白质解剖图谱；区域标签不是个体纤维追踪结果。', '10.1016/j.neuroimage.2007.12.035'),
  ref('fonov2011', 'Fonov V, Evans A C, Botteron K, et al.', 2011, 'Unbiased average age-appropriate atlases for pediatric studies', 'NeuroImage', '54(1)', '313-327', '20656036', 'anatomy', '描述无偏非线性模板构建方法，包含成人 ICBM152 模板；不同模板版本需要区分。', '10.1016/j.neuroimage.2010.07.033'),
  ref('penfield1937', 'Penfield W, Boldrey E', 1937, 'Somatic motor and sensory representation in the cerebral cortex of man as studied by electrical stimulation', 'Brain', '60(4)', '389-443', null, 'physiology', '人类术中电刺激奠定中央前后回躯体定位的经典证据；代表区具有重叠和个体差异。', '10.1093/brain/60.4.389', {method:'人体电刺激', evidenceRole:'经典生理定位', verificationNote:'历史论文；使用出版社 DOI，无虚构 PMID'}),
  ref('scoville1957', 'Scoville W B, Milner B', 1957, 'Loss of recent memory after bilateral hippocampal lesions', 'Journal of Neurology, Neurosurgery & Psychiatry', '20(1)', '11-21', '13406589', 'lesion', '双侧内侧颞叶切除病例显示严重新记忆形成障碍；病灶包含海马周围结构，不能归因于单一孤立核团。', '10.1136/jnnp.20.1.11'),
  ref('squire2004', 'Squire L R, Stark C E L, Clark R E', 2004, 'The medial temporal lobe', 'Annual Review of Neuroscience', '27', '279-306', '15217334', 'review', '综述海马、内嗅及海马旁皮层组成的陈述性记忆系统，区分记忆系统与一般知觉功能。', '10.1146/annurev.neuro.27.070203.144130'),
  ref('adolphs1994', 'Adolphs R, Tranel D, Damasio H, et al.', 1994, 'Impaired recognition of emotion in facial expressions following bilateral damage to the human amygdala', 'Nature', '372(6507)', '669-672', '7990957', 'lesion', '双侧杏仁核损伤病例出现恐惧面孔识别障碍；支持特定情绪线索加工，不意味着所有情绪由此单独产生。', '10.1038/372669a0'),
  ref('raichle2001', 'Raichle M E, MacLeod A M, Snyder A Z, et al.', 2001, 'A default mode of brain function', 'Proceedings of the National Academy of Sciences', '98(2)', '676-682', '11209064', 'fmri', '利用 PET 生理基线与任务去激活发现默认模式；内侧前额叶和后扣带等参与分布式系统。', '10.1073/pnas.98.2.676', {method:'PET 与功能影像', evidenceRole:'经典网络研究'}),
  ref('raichle2007', 'Raichle M E, Snyder A Z', 2007, 'A default mode of brain function: a brief history of an evolving idea', 'NeuroImage', '37(4)', '1083-1090', '17719799', 'review', '回顾默认模式概念及内在脑活动的意义；静息状态并不等于大脑停止工作。', '10.1016/j.neuroimage.2007.02.041'),
  ref('seeley2007', 'Seeley W W, Menon V, Schatzberg A F, et al.', 2007, 'Dissociable intrinsic connectivity networks for salience processing and executive control', 'Journal of Neuroscience', '27(9)', '2349-2356', '17329432', 'fmri', '静息态连接区分以背侧前扣带和前岛叶为核心的突显网络与额顶执行网络。', '10.1523/JNEUROSCI.5587-06.2007'),
  ref('kanwisher1997', 'Kanwisher N, McDermott J, Chun M M', 1997, 'The fusiform face area: a module in human extrastriate cortex specialized for face perception', 'Journal of Neuroscience', '17(11)', '4302-4311', '9151747', 'fmri', '个体功能定位发现梭状回部分区域对面孔反应更强；FFA 并不等同于整个梭状回。', '10.1523/JNEUROSCI.17-11-04302.1997'),
  ref('kanwisher2006', 'Kanwisher N, Yovel G', 2006, 'The fusiform face area: a cortical region specialized for the perception of faces', 'Philosophical Transactions of the Royal Society B', '361(1476)', '2109-2128', '17118927', 'review', '梳理面孔选择性与视觉专长的证据和争论，适合与原始 fMRI 研究配套阅读。', '10.1098/rstb.2006.1934'),
  ref('hubel1962', 'Hubel D H, Wiesel T N', 1962, "Receptive fields, binocular interaction and functional architecture in the cat's visual cortex", 'Journal of Physiology', '160', '106-154', '14449617', 'physiology', '猫视觉皮层电生理揭示朝向选择性和双眼整合；这是动物机制证据，不是人类 BA17 的精确坐标图。', '10.1113/jphysiol.1962.sp006837', {method:'猫单细胞电生理',evidenceRole:'经典生理机制'}),
  ref('dronkers2007', 'Dronkers N F, Plaisant O, Iba-Zizen M T, et al.', 2007, "Paul Broca's historic cases: high resolution MR imaging of the brains of Leborgne and Lelong", 'Brain', '130(5)', '1432-1441', '17405763', 'lesion', '重新检查 Broca 经典病例，发现损伤超出额下回表面；持续失语不能只由一个皮层小区解释。', '10.1093/brain/awm042'),
  ref('deheer2017', 'de Heer W A, Huth A G, Griffiths T L, et al.', 2017, 'The Hierarchical Cortical Organization of Human Speech Processing', 'Journal of Neuroscience', '37(27)', '6539-6557', '28588065', 'fmri', '自然语音 fMRI 建模显示从听觉声谱到语义表征的层级变化，并观察到双侧颞叶贡献。', '10.1523/JNEUROSCI.3267-16.2017'),
  ref('miller2001', 'Miller E K, Cohen J D', 2001, 'An integrative theory of prefrontal cortex function', 'Annual Review of Neuroscience', '24', '167-202', '11283309', 'review', '提出前额叶通过维持目标与规则影响其他系统的信息处理，是执行控制的网络理论。', '10.1146/annurev.neuro.24.1.167'),
  ref('alexander1986', 'Alexander G E, DeLong M R, Strick P L', 1986, 'Parallel organization of functionally segregated circuits linking basal ganglia and cortex', 'Annual Review of Neuroscience', '9', '357-381', '3085570', 'review', '阐述基底节—丘脑—皮层的平行环路；运动、眼动及认知环路部分分离而相互作用。', '10.1146/annurev.ne.09.030186.002041'),
  ref('schultz1997', 'Schultz W, Dayan P, Montague P R', 1997, 'A neural substrate of prediction and reward', 'Science', '275(5306)', '1593-1599', '9054347', 'review', '联系灵长类多巴胺神经元反应与奖励预测误差学习理论；多巴胺不是简单的“快乐信号”。', '10.1126/science.275.5306.1593'),
  ref('schmahmann1998', 'Schmahmann J D, Sherman J C', 1998, 'The cerebellar cognitive affective syndrome', 'Brain', '121(4)', '561-579', '9577385', 'lesion', '局限小脑病变患者的认知与情感异常提示小脑后叶和蚓部参与非运动环路。', '10.1093/brain/121.4.561'),
  ref('ahmadian2019', 'Ahmadian N, van Baarsen K, van Zandvoort M, et al.', 2019, 'The Cerebellar Cognitive Affective Syndrome-a Meta-analysis', 'Cerebellum', '18(5)', '941-950', '31392563', 'review', '汇总孤立小脑病变的神经心理结果，支持执行、语言和视觉空间功能受损的群体证据。', '10.1007/s12311-019-01060-2'),
  ref('melzack1965', 'Melzack R, Wall P D', 1965, 'Pain mechanisms: a new theory', 'Science', '150(3699)', '971-979', '5320816', 'review', '闸门控制理论强调脊髓感觉输入的调制；现代疼痛模型还包括广泛的脑内与下行机制。', '10.1126/science.150.3699.971'),
  ref('purves2001', 'Purves D, Augustine G J, Fitzpatrick D, et al.', 2001, 'Neuroscience', 'Sinauer Associates', '2nd ed.', '', null, 'textbook', '本科教材背景阅读；用于理解感觉、运动、脑干与脊髓的组织原则。', null, {kind:'book', place:'Sunderland (MA)',url:'https://www.ncbi.nlm.nih.gov/books/NBK10799/',evidenceRole:'配套教材'}),
  ref('hoDocumentation', 'FMRIB Software Library', 2026, 'Harvard-Oxford cortical and subcortical structural atlases', 'FSL atlas documentation', '', '', null, 'anatomy', 'Harvard–Oxford 图谱的正式分发及标签资料；具体坐标标签应由体素文件与其仿射矩阵查询。', null, {kind:'web',url:'https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html',evidenceRole:'图谱说明'}),
];
export const referenceById = Object.fromEntries(references.map(r => [r.id, r]));

/** GB/T 7714-2015 sequential reference-list rendering; retrieval date is explicit. */
export function citationGB(r, index) {
  const n = Number.isInteger(index) ? `[${index + 1}] ` : '';
  const authors = r.authors.replace(/\.$/, '');
  if (r.kind === 'book') return `${n}${authors}. ${r.title}[M]. ${r.volume}. ${r.place}: ${r.journal}, ${r.year}.`;
  if (r.kind === 'web') return `${n}${authors}. ${r.title}[EB/OL]. [2026-10-25]. ${r.url}.`;
  return `${n}${authors}. ${r.title}[J]. ${r.journal}, ${r.year}, ${r.volume}${r.pages ? ': ' + r.pages : ''}.${r.doi ? ' DOI: ' + r.doi + '.' : ''}`;
}

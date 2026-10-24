const b=(zh,en)=>({zh,en});
const option=(id,zh,en,descriptionZh,descriptionEn)=>({id,label:b(zh,en),description:b(descriptionZh,descriptionEn)});
export const literatureTopics=[
  option('motor','运动','Motor','动作、躯体感觉与运动回路。','Action, somatosensation and motor circuits.'),
  option('dmn','默认模式','Default mode','内部认知、基线及默认模式网络。','Internally directed cognition, baseline activity and default-mode networks.'),
  option('salience','突显','Salience','行为重要性、突显处理与内在网络。','Behavioral significance, salience processing and intrinsic networks.'),
  option('visual','视觉','Vision','视觉表征、物体与场景加工。','Visual representations and object or scene processing.'),
  option('auditory','听觉','Audition','声音分析及听觉通路。','Sound analysis and auditory pathways.'),
  option('limbic','情感与边缘系统','Affect and limbic systems','情绪、内稳态及相关回路。','Emotion, homeostasis and related circuits.'),
  option('memory','记忆','Memory','情景、语义与工作记忆。','Episodic, semantic and working memory.'),
  option('pain','疼痛','Pain','伤害性感受和疼痛调节。','Nociception and pain modulation.'),
  option('language','语言','Language','言语、音韵、语义及语言网络。','Speech, phonology, semantics and language networks.'),
  option('control','认知控制','Cognitive control','目标、规则、监控及行动选择。','Goals, rules, monitoring and action selection.'),
  option('attention','注意','Attention','目标导向与刺激驱动的选择。','Goal-directed and stimulus-driven selection.'),
  option('reward','奖赏与价值','Reward and value','奖励期待、价值判断及强化学习。','Reward anticipation, valuation and reinforcement learning.'),
  option('social','社会认知','Social cognition','社会线索、情绪判断与人物信息。','Social cues, emotional judgments and person information.'),
  option('face','面孔','Faces','面孔选择性、身份和视觉经验。','Face selectivity, identity and visual experience.'),
  option('spatial','空间与导航','Space and navigation','空间编码、定向及导航。','Spatial coding, orientation and navigation.'),
  option('interoception','内感受','Interoception','身体内部状态与觉察。','Internal bodily states and awareness.'),
  option('consciousness','觉醒与意识','Arousal and consciousness','睡眠、觉醒及意识理论。','Sleep, wakefulness and theories of consciousness.'),
  option('learning','学习与专长','Learning and expertise','训练、经验及专长差异。','Training, experience and expertise differences.'),
  option('anatomy','解剖与图谱','Anatomy and atlases','解剖描述、组织学与分区来源。','Anatomical descriptions, histology and parcellation sources.'),
  option('methods','方法与定位','Methods and localization','模板、坐标及多模态比较。','Templates, coordinates and multimodal comparisons.'),
  option('clinical','临床关联','Clinical associations','病灶、检查、疾病与干预。','Lesions, examination, disease and intervention.'),
];
export const literatureModalities=[
  option('fMRI','功能磁共振','fMRI','血氧等功能信号与空间模式。','Functional MRI signals and spatial patterns.'),
  option('MEG','脑磁图','MEG','磁场时间信号；传感器不等于皮层点。','Magnetic-field time series; sensors are not cortical locations.'),
  option('EEG','头皮脑电','Scalp EEG','头皮电位及事件相关成分。','Scalp potentials and event-related components.'),
  option('iEEG','颅内记录','Intracranial recording','皮层表面或深部电极记录。','Recordings from cortical-surface or depth electrodes.'),
  option('single-unit','单细胞记录','Single-unit recording','分离的神经元或单元放电。','Spikes from isolated neurons or units.'),
  option('PET','正电子发射成像','PET','代谢或血流相关成像。','Metabolic or blood-flow-related imaging.'),
  option('structural-MRI','结构磁共振','Structural MRI','组织结构、体积、模板与病灶。','Tissue structure, volume, templates and lesions.'),
  option('diffusion-MRI','弥散成像','Diffusion MRI','白质微结构和通路估计。','White-matter microstructure and estimated pathways.'),
  option('histology','组织学','Histology','组织切片及微结构测量。','Tissue sections and microstructural measurements.'),
  option('dissection','标本解剖','Dissection','宏观或显微标本解剖。','Gross or microsurgical specimen dissection.'),
  option('electrical-stimulation','电刺激','Electrical stimulation','直接刺激；效应受电流和扩散影响。','Direct stimulation; effects depend on current and spread.'),
  option('TMS','经颅磁刺激','TMS','非侵入性磁刺激干预。','Noninvasive magnetic stimulation.'),
  option('lesion','病灶证据','Lesion evidence','病变、切除及相应表现。','Damage, resection and associated behavior.'),
  option('behavior','行为测量','Behavior','任务表现及神经心理测量。','Task performance and neuropsychological measures.'),
  option('computational','计算分析/模型','Computation and models','模型、坐标或理论计算。','Models, coordinate analysis or theoretical computation.'),
  option('review-mixed','综述／多方法','Review / mixed methods','综合既有研究，不视为新实施的单一实验。','Synthesis of previous studies, not a newly performed single-method experiment.'),
  option('documentation','教材／标准／说明','Books / standards / documentation','背景、官方资料和检查标准。','Background, official resources and examination standards.'),
  option('unspecified','方法待核对','Method not specified','当前已核对来源不足以确认具体方法。','The checked source does not establish the specific method.'),
];
export const studyTypeLabels={
  atlas:b('图谱构建','Atlas construction'),'anatomical-study':b('解剖研究','Anatomical study'),'methods-study':b('方法研究','Methods study'),
  'original-study':b('原始研究','Original study'),'connectivity-study':b('连接研究','Connectivity study'),'functional-localizer':b('功能定位','Functional localizer'),
  'lesion-study':b('病灶研究','Lesion study'),'stimulation-study':b('刺激研究','Stimulation study'),'clinical-intervention':b('临床干预','Clinical intervention'),
  'clinical-correlation':b('临床相关研究','Clinical correlation'),'training-study':b('训练研究','Training study'),'expertise-study':b('专长组比较','Expertise comparison'),
  review:b('综述','Review'),'meta-analysis':b('荟萃分析','Meta-analysis'),theory:b('理论/模型','Theory / model'),book:b('专著/教材','Book / textbook'),documentation:b('官方说明','Official documentation'),'clinical-standard':b('临床检查标准','Clinical examination standard'),
};
export const associationLabels={anatomical:b('解剖对应','Anatomical correspondence'),perturbational:b('干预证据','Perturbational evidence'),'lesion-informed':b('病灶线索','Lesion-informed evidence'),correlational:b('相关证据','Correlational evidence'),synthesis:b('综合证据','Evidence synthesis'),background:b('背景来源','Background source'),theoretical:b('理论解释','Theoretical account')};
export const speciesLabels={human:b('人类','Human'),'nonhuman-primate':b('非人灵长类','Nonhuman primate'),rat:b('大鼠','Rat'),cat:b('猫','Cat'),rodent:b('主要啮齿类','Mainly rodents'),mixed:b('跨物种/混合','Mixed / cross-species'),unspecified:b('来源未明确','Not specified in the checked source'),'not-applicable':b('不适用','Not applicable')};

export const populationOverrides={
  cichy2014:b('人类 MEG/fMRI；并比较既有猕猴 IT 单细胞数据。','Human MEG/fMRI, with comparison to previously collected macaque IT single-unit data.'),
  liu2002:b('完成面孔分类和身份识别相关实验的人类参与者。','Human participants in face categorization and identity-related experiments.'),
  bentin1996:b('接受头皮 ERP 记录的正常志愿者。','Healthy volunteers recorded with scalp ERPs.'),
  allison1999:b('系列报告共98名接受难治性癫痫监测的患者；本篇分析皮层表面视觉电位。','The report series involved 98 patients monitored for intractable epilepsy; this paper analyzes visual cortical-surface potentials.'),
  parvizi2012:b('1名右侧颞叶植入皮层表面电极的患者。','One patient implanted with right temporal cortical-surface electrodes.'),
  quiroga2005:b('接受临床颅内监测的人类患者；内侧颞叶单元采样。','Patients undergoing clinical intracranial monitoring, with medial-temporal unit sampling.'),
  tsao2006:b('2只猕猴的 fMRI 定位与单细胞记录。','fMRI localization and single-unit recordings in two macaques.'),
  gauthier1999:b('接受新物体 Greeble 训练的人类参与者。','Human participants trained with novel Greeble objects.'),
  gauthier2000:b('汽车与鸟类识别专家组及相应行为专长测量。','Car and bird experts, with independent behavioral measures of expertise.'),
  haxby2001:b('观看面孔、动物、物体和控制图像的人类参与者。','Human participants viewing faces, animals, objects and control images.'),
};
const mapping=(structureIds,relation,zh,en,source=null,sourceKind='abstract-region-association')=>({structureIds,relation,limitations:b(zh,en),source,sourceKind});
export const newPaperMappings={
  cichy2014:[mapping(['pericalcarine-l','pericalcarine-r','inferior-temporal-l','inferior-temporal-r'],'task-association','论文功能ROI为 V1 与 IT；映射到宏观脑区仅用于区域阅读，不是精确 DK 边界或标准坐标。','The paper’s functional ROIs are V1 and IT. These gross-anatomy links support regional reading, not exact DK boundaries or standardized coordinates.','https://pmc.ncbi.nlm.nih.gov/articles/PMC4261693/#F4','full-text-functional-roi')],
  liu2002:[mapping(['fusiform-l','fusiform-r'],'review-association','仅作为面孔网络的时间过程对照。论文 MEG 成分不构成当前 DK 梭状回的直接定位。','A temporal-processing comparison for the face network only. The MEG components do not directly localize the current DK fusiform parcels.','https://web.mit.edu/bcs/nklab/media/pdfs/LiuHarrisKanwisherNN02.pdf','contextual-reading')],
  bentin1996:[mapping(['fusiform-l','fusiform-r','inferior-temporal-l','inferior-temporal-r'],'review-association','头皮 N170 的分布及与颅内 N200 的讨论只能提供背景对照；不把头皮电极当作这些脑区的源坐标。','Scalp N170 topography and comparison with intracranial N200 provide context only. Scalp electrodes are not source coordinates for these regions.',null,'contextual-reading')],
  allison1999:[mapping(['middle-temporal-l','middle-temporal-r'],'task-association','摘要明确报告外侧颞中回的面孔相关表面电位；临床电极采样不覆盖整个脑回。','The abstract explicitly reports lateral middle-temporal face-related surface potentials. Clinical electrode sampling does not cover the whole gyrus.'),mapping(['fusiform-l','fusiform-r'],'review-association','腹侧枕颞 N200 与梭状回研究相关；该宏观标签关联不表示所有记录点均位于完整 DK 梭状回。','Ventral occipitotemporal N200 is relevant to fusiform research; this gross-anatomy link does not place every recorded site inside a complete DK fusiform parcel.',null,'contextual-reading')],
  parvizi2012:[mapping(['fusiform-r'],'stimulation','单例患者的右 mFus/pFus 功能位点；电流可能影响局部网络，不能推广为左侧或整个梭状回。','Right mFus/pFus functional sites in one patient. Current can affect a local network; the finding does not generalize to the left side or the entire fusiform gyrus.')],
  quiroga2005:[mapping(['hippocampus-l','hippocampus-r'],'task-association','出版社图1/2明确显示左右海马单元例子；稀疏临床采样不表示每个海马细胞都具有同样选择性。','Publisher figures 1 and 2 show examples from the left and right hippocampus. Sparse clinical sampling does not imply the same selectivity in every hippocampal neuron.','https://www.nature.com/articles/nature03687','publisher-figure-caption')],
  tsao2006:[mapping(['fusiform-l','fusiform-r','inferior-temporal-l','inferior-temporal-r'],'review-association','实际记录来自猕猴颞上沟附近的面孔斑块；人类脑区链接仅供跨物种比较，不是经验证的同源性或定位。','Recordings came from macaque face patches near the STS. Links to human regions are cross-species comparisons, not verified homology or localization.','https://pmc.ncbi.nlm.nih.gov/articles/PMC2678572/','cross-species-context')],
  gauthier1999:[mapping(['fusiform-r'],'task-association','右侧面孔偏好功能区域的 Greeble 训练效应；不等同于整个梭状回，也不证明面孔选择性不存在。','Greeble-training effects in right face-preferring functional regions, not the entire fusiform gyrus and not evidence that face selectivity is absent.')],
  gauthier2000:[mapping(['fusiform-r','lateral-occipital-r'],'task-association','右 FFA/OFA 的专长效应；功能局部区与宏观梭状回/外侧枕叶只有近似对应。','Expertise effects in right FFA/OFA; these local functional areas correspond only approximately to gross fusiform/lateral-occipital labels.')],
  haxby2001:[mapping(['fusiform-l','fusiform-r','parahippocampal-l','parahippocampal-r','inferior-temporal-l','inferior-temporal-r'],'task-association','腹侧颞叶模式分析涉及多个功能区域；宏观脑区链接不表示这些完整 DK 标签均被逐一测试或具有同样权重。','Ventral temporal pattern analysis spans multiple functional regions. These gross-anatomy links do not mean each whole DK parcel was independently tested or equally informative.')],
};

export const paperScopeOverrides={
  doeller2010:b('包含大鼠单细胞与人体 fMRI；人体六重对称信号不是直接人类网格细胞记录。','Includes rat single-unit data and human fMRI; the human sixfold signal is not a direct recording of human grid cells.'),
  raichle2001:b('主要原始测量是 PET 生理量；文中对 fMRI 的解释不是本研究采集了所有被讨论的 fMRI 数据。','The primary original measurements are PET physiological quantities; discussion of fMRI is not evidence that all discussed fMRI data were newly acquired here.'),
  dubois2006:b('原始病灶研究是左额上回；右侧入口仅为比较阅读，不是右侧直接病灶证据。','The original lesion study concerns the left superior frontal gyrus; a right-sided entry is comparative reading, not direct right-sided lesion evidence.'),
  badre2005:b('原始结果主要涉及左腹外侧前额叶；右侧脑区链接仅作系统背景。','The original effects primarily concern left VLPFC; right-sided links provide system context only.'),
  badre2007:b('该综述聚焦左腹外侧前额叶；不直接证明右侧相同作用。','This review focuses on left VLPFC and does not directly establish the same role on the right.'),
  paulesu1993:b('报告左侧音韵保持相关定位；右缘上回关联仅作跨侧比较。','Reports left-lateralized phonological-store findings; a right supramarginal link is comparative only.'),
  silani2013:b('原始干预位于右缘上回；左侧条目不是同一干预结果的证据。','The original intervention targets right supramarginal gyrus; a left-sided entry is not evidence for the same intervention result.'),
  critchley2004:b('关键心搏觉察结果涉及右前岛；岛叶整体或左侧不能自动获得同样结论。','The key heartbeat-awareness findings concern right anterior insula; they do not automatically generalize to the entire insula or the left side.'),
  dronkers2007:b('左半球历史病例的重建；病灶超过局部脑回，不是右半球语言定位证据。','Reconstruction of historic left-hemisphere cases; lesions exceed one gyrus and do not establish right-hemisphere language localization.'),
  amunts1999:b('组织学边界有显著个体差异；不能仅凭脑沟或 DK 名称确定 BA44/45。','Cytoarchitectonic borders vary substantially; sulci or DK names alone cannot establish BA44/45.'),
  gibo1981:b('采用标本显微解剖；该方法标签不应写为组织学切片，也不验证用户个体血管。','Uses microsurgical specimen dissection, not histological sectioning, and does not validate an individual person’s vessels.'),
};

export const literatureDebates=[
  {id:'face-specificity-expertise',title:b('面孔选择性与视觉专长','Face selectivity and visual expertise'),topic:'face',regionIds:['fusiform-l','fusiform-r','lateral-occipital-r'],status:'active-debate',papers:[
    {referenceId:'kanwisher1997',modality:'fMRI',claim:b('局部梭状回对面孔相较常见物体有更强反应。','A local fusiform region responds more to faces than common comparison objects.')},
    {referenceId:'gauthier1999',modality:'fMRI',claim:b('新物体训练增强右侧面孔偏好区域对训练物体的反应。','Novel-object training increases responses to trained objects in right face-preferring regions.')},
    {referenceId:'gauthier2000',modality:'fMRI',claim:b('汽车/鸟类专长与右 FFA/OFA 的非面孔类别反应有关。','Car/bird expertise relates to responses to nonface categories in right FFA/OFA.')},
    {referenceId:'kanwisher2006',modality:'review-mixed',claim:b('综述评估领域专门性、经验和控制条件等解释。','The review evaluates domain specificity, experience and experimental controls.')},
  ],interpretation:b('这些研究使用的刺激、训练经历和任务不同。较强的面孔偏好可与非面孔专长效应并存；“选择性”并不等于“只响应面孔”。这里呈现经典争论的不同可检验解释，不宣布某一研究已彻底否定另一方。','Stimuli, training histories and tasks differ. Strong face preference can coexist with expertise effects for nonfaces; selectivity does not mean responding only to faces. These are historically debated, testable interpretations rather than a declaration that one study definitively refutes another.'),sources:['https://pubmed.ncbi.nlm.nih.gov/9151747/','https://doi.org/10.1038/9224','https://doi.org/10.1038/72140','https://pubmed.ncbi.nlm.nih.gov/17118927/']},
  {id:'local-selectivity-distributed-coding',title:b('局部选择性与分布式表征','Local selectivity and distributed coding'),topic:'visual',regionIds:['fusiform-l','fusiform-r','inferior-temporal-l','inferior-temporal-r'],status:'different-conditions',papers:[
    {referenceId:'kanwisher1997',modality:'fMRI',claim:b('用平均反应差异找到面孔偏好功能局部区。','Mean-response contrasts identify face-preferring local regions.')},
    {referenceId:'haxby2001',modality:'fMRI',claim:b('去除最强偏好体素后，分布式模式仍保留类别信息。','Distributed patterns retain category information after maximally selective voxels are removed.')},
    {referenceId:'tsao2006',modality:'single-unit',claim:b('猕猴定位斑块中采样到高比例的面孔选择细胞。','Targeted macaque patches contain a high proportion of sampled face-selective cells.')},
    {referenceId:'parvizi2012',modality:'electrical-stimulation',claim:b('单例右梭状回局部刺激改变面孔外观知觉。','Local right-fusiform stimulation alters face appearance in one patient.')},
  ],interpretation:b('平均活动、体素模式、细胞放电和刺激效应回答不同问题，空间尺度和物种也不同。局部区域可较偏好面孔，同时信息仍分布在更广网络；模式可解码不等于每个体素具有相同功能或因果必要性。','Mean activity, voxel patterns, cell firing and stimulation effects answer different questions at different spatial scales and sometimes in different species. A region can prefer faces while information remains distributed across a wider network. Decodability does not give every voxel the same function or causal necessity.'),sources:['https://pubmed.ncbi.nlm.nih.gov/9151747/','https://pubmed.ncbi.nlm.nih.gov/11577229/','https://pubmed.ncbi.nlm.nih.gov/16456083/','https://pubmed.ncbi.nlm.nih.gov/23100414/']},
  {id:'acc-conflict-value-control',title:b('前扣带：冲突监控与控制价值','Anterior cingulate: conflict and control value'),topic:'control',regionIds:['caudal-anterior-cingulate-l','caudal-anterior-cingulate-r'],status:'active-debate',papers:[
    {referenceId:'botvinick2001',modality:'computational',claim:b('以信息加工冲突作为需要提高控制的监测信号。','Processing conflict is proposed as a signal that more control is needed.')},
    {referenceId:'shenhav2013',modality:'computational',claim:b('以收益、努力成本和控制效能共同决定控制分配。','Control allocation depends jointly on benefits, effort costs and efficacy.')},
    {referenceId:'bush2000',modality:'review-mixed',claim:b('前扣带的认知与情绪相关作用存在组织差异。','Anterior cingulate contributions vary across cognitive and emotional contexts.')},
  ],interpretation:b('这是不同计算解释与功能组织框架的比较，而不是相同条件下两个相反的定位结果。dACC 的研究范围与 DK 尾侧前扣带边界不同；判断理论优劣需要针对模型预测的实验，不能由单个激活点决定。','This compares computational explanations and organizational frameworks, not opposite localizations under identical conditions. Research dACC regions do not equal the DK caudal anterior cingulate boundary. Adjudicating the theories requires experiments testing their predictions, not a single activation point.'),sources:['https://pubmed.ncbi.nlm.nih.gov/11488380/','https://pubmed.ncbi.nlm.nih.gov/23889930/','https://pubmed.ncbi.nlm.nih.gov/10827444/']},
];

export const curatedFigures=[
  {referenceId:'cichy2014',figureId:'F1',label:'Figure 1',caption:b('MEG 图像解码的流程和随时间变化的可区分信息。','MEG image-decoding workflow and time-varying discriminability.'),license:'Nature author-manuscript terms; link only',licenseUrl:'https://www.nature.com/authors/editorial_policies/license.html#terms',pmcid:'PMC4261693'},
  {referenceId:'cichy2014',figureId:'F4',label:'Figure 4',caption:b('比较 MEG 的时间表征与 V1、IT 的 fMRI 表征相似性。','Comparison of time-resolved MEG representations with fMRI representations in V1 and IT.'),license:'Nature author-manuscript terms; link only',licenseUrl:'https://www.nature.com/authors/editorial_policies/license.html#terms',pmcid:'PMC4261693'},
  {referenceId:'herbet2018',figureId:'F2',label:'Figure 2',caption:b('下纵束的候选功能通路综述图；作者将其标为假说性示意。','A review schematic of proposed ILF functional pathways, explicitly presented as putative.'),license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',pmcid:'PMC6156142'},
  {referenceId:'romano2019',figureId:'Fig1',label:'Figure 1',caption:b('正常颅神经脑池段的多幅 MRI 图像，覆盖不同神经对。','MRI panels of normal cisternal cranial-nerve segments across different nerve pairs.'),license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',pmcid:'PMC6420596'},
  {referenceId:'romano2019',figureId:'Fig3',label:'Figure 3',caption:b('颅神经运动、感觉与自主核群的纵向组织示意。','A schematic of longitudinal motor, sensory and autonomic cranial-nerve nuclear organization.'),license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',pmcid:'PMC6420596'},
  {referenceId:'seghier2013',figureId:'fig2-1073858412440596',label:'Figure 2',caption:b('角回相关白质联系的简化综述示意；不表示精确通路范围。','A simplified review schematic of angular-gyrus white-matter connections, not their exact extent.'),license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',pmcid:'PMC4107834'},
];


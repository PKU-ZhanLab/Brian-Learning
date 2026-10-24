/** Claim-level reading map. Bibliographic verification is not clinical certification.
 * Sources can support a subregion or a larger circuit without validating a DK boundary.
 * An empty field means no suitable source has been attached, not absence of function.
 */
const E = (refId, claim, scope = '区域相关综述；结论受研究任务、亚区和个体差异限制。') => ({refId, claim, scope});
const record = (level, anatomy, fun = [], cognition = [], clinical = [], gaps = []) => ({
  level, anatomy, function: fun, cognition, clinical, gaps, verifiedAt:'2026-10-25',
  verificationScope:'题录经官方记录核验；关联摘要与经典结论用于教学，未逐篇完成人工全文审定。',
});
const dk = E('desikan2006','按脑沟和脑回边界定义该 DK 宏观皮层标签。','人体 MRI 解剖分区；不提供该标签的独占功能、精确 BA 边界或病灶因果证据。');
const human = '人体功能影像；支持任务相关活动，不能单独证明必要性或整个脑回功能均一。';
const system = '系统或网络层面证据；不能把论文中的功能区直接等同于当前宏观解剖标签。';
const textbook = '神经科学教材中的组织原则；不是该结构的单独原始实验或个体定位依据。';
const laterality = '左右侧共用阅读来源不表示功能完全对称；侧化须按每条证据的研究对象和任务判断。';
const cortex = {
  bankssts: record('region-specific',[dk],
    [E('allison2000','颞上沟区域处理凝视、生物运动等社会视觉线索。','人及非人灵长类综述；颞上沟亚区与 DK 沟岸并非一一对应。')],
    [E('deheer2017','语音表征沿双侧颞叶呈层级组织。',system)],[],['尚未建立该 DK 沟岸标签独立的病灶—症状证据。']),
  'caudal-anterior-cingulate': record('system-level',[dk],
    [E('botvinick2001','前扣带活动可用于冲突监控与控制调节的理论解释。',system)],
    [E('shenhav2013','背侧前扣带的控制分配可联系预期收益、努力与任务需求。',system)],[],['背侧前扣带研究区不等于 DK 尾侧前扣带；启动困难等临床概括尚缺该标签特异来源。']),
  'caudal-middle-frontal': record('system-level',[dk],
    [E('corbetta1998','额顶区域在注意和眼动任务中有共同活动。',human)],
    [E('miller2001','前额叶以目标和规则表征影响分布式信息处理。',system)],[],['研究中的眼动和执行区未与 DK 尾侧额中回逐体素对应；缺少局灶临床来源。']),
  cuneus: record('system-level',[dk],
    [E('wandell2007','枕叶内侧视觉场图具有视网膜拓扑组织。','人体功能视觉图综述；地图可跨越楔叶/距状沟边界。')],[],[],['未把视觉注意、场景分析或特定视野缺损归因到整个楔叶；相关陈述需要进一步分区定位。']),
  entorhinal: record('region-specific',[dk],
    [E('hafting2005','内嗅皮层网格细胞呈规则空间放电结构。','大鼠单细胞记录；不是人体细胞记录或人脑 DK 边界验证。')],
    [E('doeller2010','人类导航中发现与网格编码一致的六重对称 fMRI 信号。',human),E('squire2004','内嗅皮层是内侧颞叶记忆系统的一部分。',system)],[],['未补入内嗅皮层阿尔茨海默病早期病理的专门原始研究。']),
  fusiform: record('region-specific',[dk],
    [E('kanwisher1997','梭状回局部区域对面孔呈相对较强的活动。','人体 fMRI 功能定位；FFA 只覆盖梭状回的一部分，不能代表整回或所有视觉类别。')],
    [E('kanwisher2006','面孔选择性与视觉专长等假说可由多类实验比较。')],
    [E('kanwisher2006','面孔失认及腹侧视觉损伤研究用于讨论面孔加工系统。','综合综述；不能用单个 DK 梭状回标签诊断面孔失认。')],['文字、物体等其他梭状回亚区尚未逐类补入原始定位研究。']),
  'inferior-parietal': record('system-level',[dk],
    [E('seghier2013','角回相关区域涉及多模态整合且可分为多个功能亚区。','角回综述；角回与 DK 顶下小叶边界并不相同。')],
    [E('binder2009','语义研究汇总显示顶叶参与分布式语义系统。',system)],
    [E('corbetta2002','空间忽略与注意网络损伤相关。','网络综述；尤其需要区分右侧注意系统，不能推广为任一侧顶下小叶的必然症状。')],['读写计算障碍的优势半球病灶链尚未针对该 DK 标签单独核对。']),
  'inferior-temporal': record('region-specific',[dk],
    [E('tanaka1996','下颞视觉皮层表征复杂物体特征。','主要来自非人灵长类的机制综述；人类颞下回只是部分解剖对应。')],
    [E('dicarlo2012','腹侧视觉系统形成对物体外观变化具有容忍性的表征。',system)],[],['缺少与单一左右侧颞下回 DK 标签相匹配的临床损伤来源。']),
  'isthmus-cingulate': record('system-level',[dk],
    [E('vann2009','压后区域连接记忆和空间定向系统。','压后皮层综述；DK 扣带峡部与组织学压后皮层不等同。')],
    [E('maguire2001','人体影像和病例支持压后系统参与导航。',system)],
    [E('maguire2001','压后病变病例可出现地形定向障碍。','病灶综述；相当部分证据涉及右侧，不能自动双侧泛化。')],['尚未验证 DK 峡部和论文压后区域的空间重叠比例。']),
  'lateral-occipital': record('region-specific',[dk],
    [E('malach1995','外侧枕叶局部区域对完整物体相较控制刺激反应较强。',human)],
    [E('grillspector2001','外侧枕叶复合体参与物体形状识别。','LOC 综述；LOC 不等于完整 DK 外侧枕叶区域。')],[],['临床视觉失认的特定病灶链尚未按当前标签核对。']),
  'lateral-orbitofrontal': record('system-level',[dk],
    [E('kringelbach2004','眶额皮层整合奖励、惩罚与行为调整，内外侧具有差异。')],
    [E('kringelbach2004','结果价值及其变化参与决策调整。')],
    [E('bechara1994','腹内侧前额叶病灶患者在决策任务中偏向即时收益。','人体病灶原始研究；病灶不是孤立的外侧眶额 DK 区，仅作系统级临床对照。')],['缺少孤立外侧眶额分区的临床因果验证。']),
  lingual: record('system-level',[dk],
    [E('wandell2007','枕叶腹内侧包含多个视觉场图。','视觉图综述；并非舌回功能均一的证据。')],
    [E('zeki1991','颜色与运动任务可招募不同视觉皮层区域。','人体 PET；颜色相关激活与整个舌回不能画等号。')],[],['舌回整体的视觉记忆、场景和颜色障碍概括仍缺少标签特异的病灶链。']),
  'medial-orbitofrontal': record('system-level',[dk],
    [E('padoaschioppa2006','眶额神经元活动与选择中的经济价值有关。','猕猴单细胞记录；不能直接映射成人内侧眶额 DK 分区。')],
    [E('kringelbach2004','人类眶额研究关联结果价值及情绪行为调节。')],
    [E('bechara1994','腹内侧前额叶损伤与决策任务异常有关。','人体病例；病灶超出单个内侧眶额标签。')],['动物记录点、人体 vmPFC 病灶与 DK 内侧眶额边界尚未做空间对应。']),
  'middle-temporal': record('system-level',[dk],
    [E('deheer2017','自然语音研究显示颞叶声学到语义信息的层级表征。',human)],
    [E('binder2009','语义加工涉及中颞等分布式区域。','人类功能影像荟萃分析；任务和左右侧分布有差异。')],
    [E('hickok2007','语言障碍的解释需要考虑听觉—语言双通路网络。',system)],['优势半球命名障碍尚未建立限定于 DK 颞中回的独立病例链。']),
  parahippocampal: record('region-specific',[dk],
    [E('epstein1998','海马旁局部区域对视觉场景呈选择性反应。','人体 fMRI；PPA 不是整个海马旁回或 DK 标签。')],
    [E('aminoff2013','海马旁皮层参与场景、情境关联和记忆。')],[],['未附与当前标签独立对应的地形定向障碍原始病例。']),
  paracentral: record('system-level',[dk],
    [E('penfield1937','中央沟周围感觉运动皮层具有躯体定位组织。','人体术中刺激的经典证据；不精确描绘现代 DK 中央旁标签。')],
    [E('nachev2008','内侧额叶运动区参与动作控制。','SMA/pre-SMA 综述；与中央旁小叶只是邻近或部分重叠关系。')],[],['下肢局部表征可作教学联系；排尿控制和特定步态障碍仍缺独立标签证据。']),
  'pars-opercularis': record('system-level',[dk],
    [E('hickok2007','额颞语言网络支持发音与语音感觉运动转换。',system)],
    [E('deheer2017','语音信息表征分布于多个皮层层级。',human)],
    [E('dronkers2007','Broca 经典病例损伤超出额下回表面。','左半球经典病例 MRI；不能当作右侧盖部或孤立 BA44 损伤的证据。')],['右盖部的抑制等作用需要另行建立特异证据；未把盖部等同于单一语言模块。']),
  'pars-orbitalis': record('system-level',[dk],
    [E('badre2005','腹外侧前额叶活动可区分受控提取和选择过程。','人体 fMRI，主要为左侧；论文功能区不等于 DK 眶部。')],
    [E('badre2007','左腹外侧前额叶参与记忆内容的受控提取。','左侧网络综述；右侧条目仅提供跨侧比较背景。')],[],['右侧眶部及独立局灶临床证据尚未补齐。']),
  'pars-triangularis': record('system-level',[dk],
    [E('badre2005','腹外侧前额叶不同部位与提取、竞争选择相关。','人体 fMRI，主要左侧；不是 DK 三角部的精确分界。')],
    [E('badre2007','左腹外侧前额叶支持记忆和语义的认知控制。','左侧综述；不意味着右侧功能相同。')],
    [E('dronkers2007','经典失语病例涉及额下回以外的结构。','左半球历史病例；用来限制简单局部定位。')],['尚未单独建立右侧三角部功能与病灶的证据链。']),
  pericalcarine: record('region-specific',[dk],
    [E('wandell2007','人类早期视觉皮层可由视网膜拓扑功能定位。','人体视觉图综述；V1 与 DK 距状沟周围皮层存在近似关系而非精确等同。'),E('hubel1962','视觉皮层神经元具有朝向和双眼反应特性。','猫电生理；属于机制证据，不能用作人类 BA17 的精确定位。')],[],[],['尚未附人体孤立 V1 病灶与视野对应的原始临床研究。']),
  postcentral: record('region-specific',[dk],
    [E('penfield1937','人体中央后皮层刺激与身体部位感觉有关。','人体术中刺激；经典躯体定位具有重叠和个体差异。')],
    [E('kaas1993','灵长类体感皮层存在多重表征及功能分区。','比较灵长类综述；不是单一 BA3/1/2 与整个中央后回等价。')],[],['当前阅读链未单独覆盖所有触觉、位置觉及皮层感觉障碍表型。']),
  'posterior-cingulate': record('region-specific',[dk],
    [E('raichle2001','后扣带等区域构成任务去激活与基线活动相关网络。','人体 PET 与网络研究；不等同于静息时完全关闭或独占某一功能。')],
    [E('leech2014','后扣带参与记忆、内部认知与注意调节，亚区具有差异。')],
    [E('leech2014','多种疾病涉及后扣带及其网络改变。','综述中的疾病关联不支持由局部影像直接诊断。')],['默认网络与 DK 后扣带边界尚未逐体素匹配。']),
  precentral: record('region-specific',[dk],
    [E('penfield1937','人体中央前皮层刺激可引发躯体运动。','人体术中刺激；运动表征有重叠与个体差异。')],
    [E('graziano2002','较长时程皮层微刺激可诱发复杂动作。','猕猴微刺激；不能直接推广为人类整个中央前回的自然动作编码。')],[],['现代人类病灶与运动亚区的细化证据尚未逐项加入。']),
  precuneus: record('region-specific',[dk],
    [E('margulies2009','楔前叶内在功能连接存在不同子区。','人和猕猴功能连接；连接相关不等于因果功能。')],
    [E('cavanna2006','楔前叶与视觉空间意象、情景记忆和自我相关加工有关。')],[],['尚未针对左右楔前叶各自建立孤立病灶临床链；不能与全部 DMN 等同。']),
  'rostral-anterior-cingulate': record('system-level',[dk],
    [E('bush2000','前扣带的情绪与认知相关作用具有组织差异。',system)],
    [E('shenhav2013','前扣带控制理论综合任务需求与价值。','主要讨论背侧前扣带；用于系统对照，不是吻侧 DK 分区专属结论。')],[],['吻侧/尾侧 DK 标签不能直接替代情感/认知功能分区；临床病灶链尚缺。']),
  'rostral-middle-frontal': record('system-level',[dk],
    [E('goldmanrakic1995','前额叶持续活动为工作记忆提供细胞机制解释。','主要非人灵长类证据；与人类 DK 吻侧额中回并非直接一一对应。')],
    [E('miller2001','目标与规则维持可调节分布式认知处理。',system)],[],['尚未建立吻侧额中回左右侧特异的临床损伤证据。']),
  'superior-frontal': record('region-specific',[dk],
    [E('nachev2008','额叶内侧 SMA/pre-SMA 参与动作控制。','功能亚区综述；不能扩展为整个额上回的同一功能。')],
    [E('dubois2006','左额上回病灶与工作记忆相关缺陷有关。','人体左侧病灶研究；不能直接当作右额上回证据。')],
    [E('dubois2006','局灶左额上回损伤提示工作记忆的部分必要机制。','左侧患者研究；具体病灶位置与任务决定适用范围。')],['右侧额上回缺少匹配的单独病灶研究；SMA 研究范围与宏观标签不同。']),
  'superior-parietal': record('system-level',[dk],
    [E('corbetta1998','额顶区域参与空间注意和眼动。',human)],
    [E('corbetta2002','背侧与腹侧注意系统支持不同注意过程。',system)],
    [E('corbetta2002','注意障碍涉及网络水平的损伤。',system)],['未把感觉运动转换或忽略症状专门定位到整个顶上小叶。']),
  'superior-temporal': record('region-specific',[dk],
    [E('deheer2017','双侧颞叶语音处理包含从声学到语义的层级表征。',human)],
    [E('hickok2007','言语感知和感觉运动整合由不同但相互作用的通路支持。',system),E('zatorre2002','听觉皮层在音乐和言语的时间/谱分析中有分工。')],
    [E('hickok2007','失语及听觉语言障碍需结合双侧与优势半球网络。',system)],['经典 Wernicke 区与整个颞上回不是同一边界。']),
  supramarginal: record('region-specific',[dk],
    [E('paulesu1993','言语工作记忆中的音韵保持涉及左顶叶区域。','人体 PET；左侧音韵回路证据，不能直接双侧泛化。')],
    [E('silani2013','右缘上回参与克服情绪判断中的自我中心偏向。','人体 fMRI 与干预证据；特定任务、右侧区域，不是左缘上回的直接证据。')],[],['左右缘上回的阅读链有不同侧化任务；工具使用和失用临床链尚未单独补齐。']),
  'frontal-pole': record('region-specific',[dk],
    [E('koechlin1999','前额极相关活动与同时维持多个行为目标有关。',human)],
    [E('burgess2007','吻侧前额叶可协调面向内部与外部信息的注意。','理论与综述；BA10、前额极和 DK 额极边界不能自动等同。')],[],['元认知及现实任务障碍尚未各自配置独立原始研究。']),
  'temporal-pole': record('region-specific',[dk],
    [E('olson2007','颞极与高级感知及社会情绪信息的整合有关。')],
    [E('olson2007','颞极研究涉及社会概念、情绪及人物知识等过程。')],
    [E('olson2007','前颞叶病变为社会情绪和语义功能提供临床线索。','综述；许多疾病影响双侧和邻近区域，不能归因于单个 DK 颞极。')],['尚未分别核对每种前颞叶退行性表型的原始病理证据。']),
  'transverse-temporal': record('region-specific',[dk,E('morosan2001','人类初级听觉皮层具有细胞构筑亚区及个体变异。','人体组织学概率图；Heschl 回形态与初级听觉边界不是精确等同。')],
    [E('zatorre2002','听觉皮层处理时间与频谱信息，音乐和言语任务有不同要求。')],
    [E('deheer2017','听觉声谱表征属于语音处理层级的早期阶段。',human)],[],['尚未附双侧皮层性耳聋的专门原始病例。']),
  insula: record('region-specific',[dk],
    [E('critchley2004','岛叶等区域活动与内感受觉察有关。',human)],
    [E('craig2009','前岛与整合身体状态和主观觉察有关。'),E('seeley2007','前岛参与突显网络的内在功能连接。','静息态连接；不是岛叶每个亚区都有相同功能。')],[],['味觉、后岛与自主调节的具体临床损伤链尚未分别补齐。']),
};

export const evidenceByStructureId = {};
const both = (base, value) => {
  for (const side of ['l','r']) evidenceByStructureId[`${base}-${side}`] = {...value, laterality:side==='l'?'left':'right',gaps:[...value.gaps,laterality]};
};
for(const [id,value] of Object.entries(cortex)) both(id,value);

const deep = {
  thalamus: record('system-level',[E('rolls2020','AAL3 细分丘脑核群的解剖标签。','图谱证据；不证明各核群功能。')],[E('sherman2007','丘脑除中继外还参与皮层间信息调节。','核团和回路综述；不同核团作用不同。')],[E('sherman2007','丘脑—皮层回路可影响感觉与高阶信息处理。',system)],[],['丘脑痛、卒中性意识和记忆障碍尚未按核团配置病灶证据。']),
  hippocampus: record('region-specific',[E('squire2004','海马与周围内侧颞叶结构组成记忆系统。')],[E('squire2004','海马参与信息关联与陈述性记忆形成。')],[E('scoville1957','双侧内侧颞叶损伤可严重影响新记忆形成。','人体手术病例；病灶包含海马周围组织。')],[E('scoville1957','双侧内侧颞叶切除后的顺行性遗忘是经典临床证据。','双侧广泛病灶；不是单侧海马或所有记忆损害的充分证据。')],['阿尔茨海默病、缺氧和癫痫的具体病理链未逐项附入。']),
  amygdala: record('region-specific',[E('purves2001','杏仁核是由多个核群组成的内侧颞叶结构。',textbook)],[E('adolphs1994','双侧杏仁核损伤影响特定面孔情绪线索识别。','人体病例；任务主要涉及恐惧表情。')],[E('adolphs1994','恐惧面孔识别可受到双侧杏仁核损伤影响。','不表示所有情绪均依赖单一核团。')],[E('adolphs1994','双侧损伤病例为恐惧表情识别提供因果线索。','单例/小样本临床证据，不能外推为单侧所有功能。')],['威胁学习和情绪记忆的多核团机制仍需补充其他原始研究。']),
  caudate: record('region-specific',[E('alexander1986','尾状核参与皮层—基底节—丘脑平行环路。')],[E('grahn2008','尾状核参与目标导向的行为和认知控制。')],[E('grahn2008','尾状核与学习、规则和行为选择相关。')],[],['亨廷顿病及孤立尾状核病灶的临床原始证据尚未单列。']),
  putamen: record('system-level',[E('alexander1986','壳核是多个皮层—基底节环路中的纹状体节点。')],[E('delong1990','基底节运动环路异常可改变运动输出。','非人灵长类模型与回路解释；不是壳核孤立病灶证据。')],[E('alexander1986','不同基底节环路支持部分分离的运动和认知处理。',system)],[E('delong1990','灵长类疾病模型支持基底节运动障碍的回路解释。','动物模型；临床映射需要额外人类证据。')],['习惯学习及人类单独壳核病灶尚缺特异原始研究。']),
  pallidum: record('system-level',[E('alexander1986','苍白球亚部参与基底节输入/输出回路。')],[E('delong1990','苍白球相关通路的活动变化参与运动控制。','灵长类模型；内外侧部需要分别解释。')],[E('alexander1986','动作和认知处理分布于多个基底节环路。',system)],[E('delong1990','运动障碍可在基底节环路模型中理解。','并非每种临床运动障碍都来自孤立苍白球。')],['尚未分别补入内、外侧部的人体病灶或干预研究。']),
  accumbens: record('region-specific',[E('rolls2020','AAL3 提供伏隔核解剖标签。','解剖图谱，不提供奖赏功能证明。')],[E('knutson2001','人体伏隔核在金钱奖励期待时表现相关活动。',human)],[E('knutson2001','奖励期待的活动随奖励水平变化。','fMRI 特定任务；不能概括为所有快乐或动机。')],[],['成瘾及动机障碍的原始临床链尚未补齐。']),
  hypothalamus: record('region-specific',[E('purves2001','下丘脑由多个内稳态和自主调节核群构成。',textbook)],[E('saper2005','下丘脑回路参与睡眠、觉醒和昼夜节律调节。','综合机制综述，包含动物证据；并不覆盖每个下丘脑核团。')],[E('brown2012','睡眠与觉醒由多节点神经系统调节。',system)],[],['摄食、体温、水盐和内分泌的逐核团原始证据未全部加入。']),
  subthalamic: record('system-level',[E('alexander1986','丘脑底核参与基底节的平行回路。')],[E('delong1990','丘脑底相关通路改变可影响基底节运动环路。','非人灵长类模型。')],[],[E('limousin1995','双侧丘脑底核刺激可改变帕金森病运动症状。','人体电刺激治疗研究；干预效果不等于局部损伤表现，也不证明认知功能。')],['行动停止、偏身投掷样运动及孤立病灶证据尚未单独核对。']),
  'substantia-nigra': record('system-level',[E('alexander1986','黑质网状部参与基底节输出回路。')],[E('schultz1997','灵长类多巴胺神经元活动与奖励预测误差有关。','动物记录与计算理论；主要讨论多巴胺系统，不能代表全部黑质。')],[E('schultz1997','奖励预测误差信号可联系强化学习。',system)],[E('delong1990','帕金森样运动障碍可用基底节回路变化研究。','灵长类模型，不是人类黑质致密部完整病理链。')],['致密部与网状部须分开；帕金森病的广泛病理证据尚未单列。']),
  'red-nucleus': record('system-level',[E('purves2001','红核位于中脑被盖并与运动相关通路联系。',textbook)],[E('lemon2008','红核等脑干下行系统与皮质脊髓系统共同参与运动。','比较物种综述；人类红核功能不可直接照搬模式动物。')],[],[],['人类孤立红核病变的临床证据不足；复合中脑综合征不能仅归因于红核。']),
};
for(const [id,value] of Object.entries(deep)) both(id,value);

for(const id of ['midbrain','pons','medulla']) evidenceByStructureId[id] = record('system-level',
  [E('purves2001','脑干的纵向分段包含多种核群和上、下行通路。',textbook),E('deleener2018','PAM50 提供脑干—脊髓多模态参考模板。','人体模板构建；具体覆盖与标签以载入文件为准，不能证明当前所有可视结构边界。')],
  [E('brown2012','脑干与其他区域共同调节睡眠和觉醒状态。','跨区域、多物种回路综述；不是单个脑干分段的统一功能。')],
  [E('parvizi2001','意识研究需要考虑脑干对觉醒和整体状态的支持。','综合理论与解剖综述；不把某个分段等同于意识中枢。')],[],
  ['当前分段内的眼动、呼吸、自主反射和交叉综合征尚未逐核团补入临床原始证据。']);

for(const id of ['cerebellum-l','cerebellum-r','cerebellar-vermis']) evidenceByStructureId[id] = record('system-level',
  [E('purves2001','小脑包括半球、蚓部及多个功能环路。',textbook)],
  [E('stoodley2009','人类功能影像荟萃分析显示小脑运动与非运动任务存在区域差异。','人体影像荟萃分析；目前模型没有据此划分全部小叶功能区。')],
  [E('schmahmann1998','小脑病变患者可出现执行、语言、空间和情绪改变。','人类病例；不同病灶范围不可统一推广到任一侧小脑或整个蚓部。')],
  [E('ahmadian2019','孤立小脑病变的神经心理结果支持认知情感障碍的群体证据。','临床荟萃分析；不据此预测单个患者。')],
  ['需进一步连接小叶、深核及左右交叉环路；当前证据为小脑系统级。']);

const ventricularClaims = {
  'lateral-ventricle-l':'侧脑室经室间孔与第三脑室相通。',
  'lateral-ventricle-r':'侧脑室经室间孔与第三脑室相通。',
  'third-ventricle':'第三脑室经中脑导水管连接第四脑室。',
  'cerebral-aqueduct':'中脑导水管是第三、第四脑室之间的通路。',
  'fourth-ventricle':'第四脑室与蛛网膜下腔及脊髓中央管相关通路相接。',
};
for(const [id,claim] of Object.entries(ventricularClaims)) evidenceByStructureId[id]=record('system-level',
  [E('sakka2011',claim,'脑脊液系统解剖与生理综述；不验证个体脑室形状。')],
  [E('sakka2011','脑室系统参与脑脊液循环及相关稳态。')],[],
  [E('sakka2011','脑脊液循环异常可导致脑积水等病理状态。','系统级病理解释；病因及梗阻位置需额外影像和临床证据。')],
  ['脑室是腔隙结构，不把它列为独立认知加工区；具体梗阻病例链尚未逐位置加入。']);

const tractAtlas = E('catani2008','束成像图谱描述宏观白质通路与空间关系。','人体弥散 MRI；估计的流线不是单条轴突，也不验证当前显示曲线。');
const tracts={
  corticospinal:record('region-specific',[tractAtlas,E('mori2008','ICBM 白质图谱提供皮质脊髓相关区域标签。','DTI 图谱，需检查实际标签覆盖。')],
    [E('lemon2008','皮质脊髓及脑干下行系统协作参与运动控制。','人及动物研究综述；起始皮层与交叉位置需要区分。')],[],[],['尚未按皮质、内囊、脑干和脊髓各段补齐病灶证据。']),
  cingulum:record('region-specific',[E('bubb2018','扣带束含多个分段和不同纤维联系。')],
    [E('bubb2018','扣带束为内侧额、顶与颞叶系统提供连接。')],
    [E('bubb2018','不同扣带束分段与记忆和情绪功能相关。')],
    [E('bubb2018','病变和疾病研究提示扣带束异常的功能联系。','综合综述；关联不意味着每个分段产生同一种症状。')],['当前可视束没有重建所有分段；未进行个体纤维追踪。']),
  fornix:record('region-specific',[tractAtlas],
    [E('squire2004','穹隆属于海马相关记忆联系系统。',system)],
    [E('tsivilis2008','穹隆和乳头体系统与回忆相比熟悉性识别关系更突出。','人类结构—行为病例研究；不能把两个结构的共同证据视为孤立穹隆因果。')],
    [E('tsivilis2008','临床结构损伤与记忆表现提供系统关联。','病灶相关研究；单侧和双侧损伤不可互换。')],['目前未独立解析穹隆各分支和双侧损伤效应。']),
  uncinate:record('region-specific',[E('vonderheide2013','钩束连接前颞与眶额等区域。')],
    [E('vonderheide2013','钩束为前颞—额叶互动提供联系。')],
    [E('vonderheide2013','钩束的记忆、语义和社会情绪解释仍有争议。')],
    [E('vonderheide2013','损伤与疾病观察需要结合邻近通路和网络。','证据与假说综述，不给出单一症状预测。')],['当前模型不包含个体连接与争议假说的直接检验。']),
  'superior-longitudinal':record('system-level',[tractAtlas],
    [E('catani2008','束成像可显示额顶长程联合联系。','结构推断，不是注意或认知功能的直接因果实验。')],
    [E('corbetta2002','额顶网络参与目标导向注意。','网络背景，不能直接归因于整条上纵束。')],[],['尚缺上纵束各分支的特异刺激或病灶研究；不能把所有上纵束分支与弓状束等同。']),
  arcuate:record('system-level',[E('catani2005','外侧裂周围束成像显示直接和间接语言相关联系。','人体 DTI；流线推断不等于组织学轴突验证。')],
    [E('catani2005','额颞及顶叶间的连接构成多路径结构系统。','结构证据支持潜在通讯通路，不单独证明语言功能。')],
    [E('hickok2007','背侧语言通路参与声音到发音的转换。','网络综述；需分别看左右侧和不同纤维分支。')],[],['传导性失语等临床标签尚未对应到当前弓状束原始病例链。']),
  'inferior-longitudinal':record('region-specific',[E('catani2003','人体束成像显示枕颞长程联系。','弥散 MRI 结构估计。')],
    [E('herbet2018','下纵束连接视觉枕叶与颞叶区域。')],
    [E('herbet2018','下纵束与视觉、语义和情绪信息处理有关。','解剖、病灶和刺激证据的综合综述。')],
    [E('herbet2018','视觉识别障碍等病例为下纵束功能提供线索。','临床效应需考虑左右侧、分支和邻近损伤。')],['尚未将当前可视通路分支与各原始病例逐一空间核对。']),
  'inferior-fronto-occipital':record('system-level',[tractAtlas],
    [E('wandell2016','白质通路支撑分布式区域之间的信息联系。','白质系统综述；只提供背景，不证明该束特定认知功能。')],[],[],['下额枕束特异的语义、刺激和局灶病变原始研究尚未补齐。']),
  'optic-radiation':record('system-level',[tractAtlas],
    [E('wandell2016','视觉白质结构可与视觉系统功能相联系。','白质综述；视辐射分支与视网膜拓扑需额外定位。')],[],
    [E('purves2001','视觉通路不同位置的损伤可产生不同视野缺损。',textbook)],['Meyer 环及上下视野分支尚未提供个体或病例特异证据。']),
  'medial-lemniscus':record('textbook',[E('purves2001','内侧丘系属于躯体感觉上行系统。',textbook)],
    [E('purves2001','后索—内侧丘系参与精细触觉和本体感觉传递。',textbook)],[],[],['尚未建立该束独立的现代原始解剖及局灶损伤来源。']),
  spinothalamic:record('system-level',[E('purves2001','脊髓丘脑通路属于前外侧上行系统。',textbook)],
    [E('todd2010','脊髓后角回路调节伤害性感受信息及上行输出。','主要啮齿类机制综述；不等于人体整条脊髓丘脑束。')],[],[],['闸门控制和后角回路不能替代整条束的走行验证；人体束特异临床链尚缺。']),
};
for(const [id,value] of Object.entries(tracts)) both(id,value);
evidenceByStructureId['corpus-callosum']=record('region-specific',[E('mori2008','ICBM 白质图谱包含胼胝体相关区域标签。','DTI 图谱，不等于个体跨半球纤维追踪。')],
  [E('gazzaniga2000','胼胝体支持两半球间的信息交流。')],
  [E('gazzaniga2000','裂脑研究显示半球专门化和跨半球整合的关系。')],
  [E('gazzaniga2000','连合切断病例提供跨半球通讯的临床机制线索。','临床与理论综述；切断范围和患者差异影响结论。')],['未逐分段列出额、运动、视觉等胼胝体纤维连接。']);

const cranial = [
  ['olfactory','嗅神经','嗅觉受体信息经嗅神经进入嗅球。','嗅觉下降需区分外周、嗅球和更中枢病变。'],
  ['optic','视神经','视网膜神经节细胞输出经视神经进入视觉通路。','视神经病变的视觉症状须结合视交叉及后续通路定位。'],
  ['oculomotor','动眼神经','支配多条眼外肌并携带部分瞳孔与调节的副交感纤维。','眼位、上睑和瞳孔体征需结合具体受累分支解释。'],
  ['trochlear','滑车神经','运动纤维支配上斜肌。','复视的方向和头位代偿需与其他眼动系统鉴别。'],
  ['trigeminal','三叉神经','承担面部主要一般感觉并支配咀嚼肌。','三叉神经痛与神经根、血管关系及其他病因有关。'],
  ['abducens','展神经','运动纤维支配外直肌。','外展障碍的病灶可位于核、束段或周围走行。'],
  ['facial','面神经','支配面部表情肌，并携带味觉和副交感等纤维。','面肌无力需区分中枢与周围损伤；痉挛并不等同于麻痹。'],
  ['vestibulocochlear','前庭蜗神经','蜗神经和前庭神经分别传递听觉与头部运动相关信息。','听觉或平衡障碍需辨别耳蜗、前庭、神经及中枢病变。'],
  ['glossopharyngeal','舌咽神经','携带舌后部感觉/味觉、部分咽部运动与副交感纤维。','舌咽神经痛和吞咽相关体征需要综合定位。'],
  ['vagus','迷走神经','参与咽喉运动、内脏感觉及胸腹部副交感调节。','声音和吞咽异常可涉及多神经或中枢网络。'],
  ['accessory','副神经','脊髓副神经纤维支配胸锁乳突肌和斜方肌。','肩抬举和转头无力需结合肌肉与周围神经检查。'],
  ['hypoglossal','舌下神经','主要支配舌肌运动。','舌无力、偏斜和萎缩需区分上运动神经元与周围损害。'],
];
for(const [id,name,fun,clinical] of cranial) {
  const clinicalSources=[E('romano2019',clinical,'颅神经影像与解剖病理综述；不是本应用的诊断规则。')];
  if(['trigeminal','facial','vestibulocochlear','glossopharyngeal'].includes(id)) clinicalSources.push(E('haller2016',`${name}的部分症状可与神经血管压迫综合征有关。`,'综合影像综述；单纯接触不等于有症状压迫，需结合形态和临床。'));
  both(`cn-${id}`,record('system-level',
    [E('traylor2022',`${name}的全程走行、相邻结构和功能有逐神经解剖描述。`,'综述中的真实解剖不能自动验证本应用当前神经曲线或起止点。')],
    [E('traylor2022',fun,'逐神经临床解剖综述，适用于基础组织原则。')],[],clinicalSources,
    ['未逐对配置独立原始实验/病例队列；颅神经不作为独立高级认知中心。']));
}

for(const [prefix,count] of [['C',8],['T',12],['L',5],['S',5],['Co',1]]) for(let n=1;n<=count;n++) {
  const segment=`${prefix}${n}`;
  const noStandardKeyPoint=segment==='C1'||segment==='Co1';
  evidenceByStructureId[`spinal-${segment}`]=record('system-level',
    [E('purves2001',`脊髓 ${segment} 属于神经节段序列，神经节段与同名椎骨并非同一位置。`,textbook)],
    [E('purves2001','节段性神经元及经过纤维共同参与感觉、运动和反射。',textbook)],[],
    [E('rupp2026',noStandardKeyPoint?'标准脊髓损伤检查需区分可测关键感觉/肌群水平与解剖节段名称。':'标准脊髓损伤分类分别评估感觉、运动及最低骶段保留。','国际临床检查标准；不是 MRI 节段分割或任一节段的唯一皮节、肌节证明。')],
    [`尚未为 ${segment} 独立配置原始病灶队列；临床分类标准只提供系统框架。`,noStandardKeyPoint?'该节段没有独立的 ISNCSCI 常规关键感觉点，不能据名字推算评分。':'皮节、肌节存在重叠；该条目不自动给出单一神经根的症状或标准评分。','PAM50 的椎体/节段覆盖必须读取数据标签，不能因有模板论文就声称全31节段均已定位。']);
}
evidenceByStructureId['spinal-gray']=record('system-level',
  [E('rexed1952','脊髓灰质可按细胞构筑层板描述。','历史猫组织学；不能直接视为人脊髓灰质精确层板图。'),E('deleener2018','PAM50 提供脊髓多模态空间模板及组织参考。','需以具体数据文件确认灰质标签。')],
  [E('grillner2006','局部神经回路可生成和调节运动模式。','多种动物的机制综述；不代表人类所有节段具有相同回路。')],[],[],['尚未覆盖所有灰质层板、节段或人类局灶临床证据。']);
evidenceByStructureId['spinal-white']=record('system-level',
  [E('deleener2018','PAM50 为脊髓白质等组织提供标准模板背景。','人体 MRI 模板；组织掩膜及覆盖以实际载入数据为准。'),E('purves2001','脊髓白质包含上、下行及固有联系纤维。',textbook)],
  [E('lemon2008','脊髓下行通路参与运动控制。','下行运动系统综述，只覆盖白质通路的一部分。')],[],[],['未把白质整体视为功能均一结构；缺少逐束、逐节段的完整临床证据链。']);
both('spinal-anterior-horn',record('system-level',
  [E('purves2001','前角包含躯体运动神经元及相关局部回路。',textbook)],
  [E('grillner2006','脊髓运动网络通过局部和下行输入组织运动输出。','主要动物机制综述；不等于某一个人类节段或单一前角。')],[],[],['运动神经元疾病及人类局灶前角损伤的原始病例链尚未单列。']));
both('spinal-posterior-horn',record('region-specific',
  [E('rexed1952','后角属于脊髓灰质的层板组织。','历史猫组织学。')],
  [E('todd2010','后角细胞回路参与伤害性感受加工与调制。','主要啮齿类回路综述。'),E('melzack1965','疼痛信息可在脊髓入口受到调制。','历史闸门控制理论；不是全部现代疼痛机制或高级认知中心的证明。')],
  [],[],['人体后角不同层板和局灶临床病变还需要专门证据。']));
evidenceByStructureId['spinal-lateral-horn']=record('textbook',
  [E('purves2001','侧角与部分自主神经节前神经元群有关，分布具有节段差异。',textbook)],
  [E('purves2001','脊髓自主神经输出参与内脏调节。',textbook)],[],[],['未配置单独的人体侧角组织学和病灶研究；不能把胸腰段与骶段自主神经元的组织位置混为一谈。']);
both('middle-cerebral-artery',record('region-specific',
  [E('gibo1981','大脑中动脉可按 M1–M4 描述，并有多种分支变异。','50个大脑半球的人体标本研究；不代表当前模型或个体血管走行。')],
  [E('gibo1981','大脑中动脉分支供应大脑外侧面及部分深部结构。','人体解剖；供血范围存在变异。')],[],
  [E('purves2001','缺血症状取决于受影响的脑组织和供血范围。',textbook)],['未加入患者级血管影像或按分支分层的卒中原始研究；血管本身不作为认知处理区。']));

/** Atlas methodology reading list; anatomical provenance, not functional evidence. */
export const atlasEvidence = {
  dk:[E('desikan2006','DK 皮层脑回标签的原始方法。','MRI宏观解剖，不是细胞构筑学或功能图。')],
  baTalairach:[E('lancaster2000','Talairach Daemon 的历史标签检索方法。','历史近似 BA 标签，不等于当代组织学概率图。'),E('lancaster2007','MNI 与 Talairach 坐标存在系统差异。','空间变换方法不能保证每个个体的精确对应。')],
  ba1:[E('geyer2000','人体1区的组织学概率定位。','10个人脑组织学及标准化。')],
  ba2:[E('grefkes2001','人体2区的组织学概率定位。','10个人脑组织学及个体变异。')],
  ba3:[E('geyer2000','人体3a/3b区的组织学概率定位。','3a、3b不应合成单一均一功能区。')],
  ba4:[E('geyer1996','人体4a/4p分区的微结构与功能依据。','组织学、受体分布与PET；不能覆盖全部运动功能。')],
  ba6:[E('geyer2004','运动与前额叶认知皮层之间的微结构界线。','微结构分区资料；不是所有前运动亚区的完整功能证据。')],
  ba17:[E('amunts2000','人体17区的组织学概率空间定位。','反映样本概率和变异，不是每个个体的边界。')],
  ba18:[E('amunts2000','人体18区的组织学概率空间定位。','反映样本概率和变异，不是每个个体的边界。')],
  ba44:[E('amunts1999','人体44区的细胞构筑边界和个体差异。','宏观脑沟不可靠地决定44区边界。')],
  ba45:[E('amunts1999','人体45区的细胞构筑边界和个体差异。','不能把45区与整个额下回三角部直接等同。')],
};

export const evidenceLevelLabels = {'region-specific':'区域相关研究','system-level':'系统或网络证据',textbook:'教材背景',unresolved:'尚待建立证据'};
export const evidenceFields = ['anatomy','function','cognition','clinical'];
export const evidenceReferenceIds = entry => [...new Set(evidenceFields.flatMap(field=>(entry?.[field]||[]).map(item=>item.refId)))];

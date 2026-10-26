import { references as baseReferences, citationGB } from './references.js';
import { additionalReferences } from './references-expanded.js';
import { evidenceByStructureId } from './evidence.js';
const references=[...baseReferences,...additionalReferences];
const referenceById=Object.fromEntries(references.map(r=>[r.id,r]));
export { references, referenceById, citationGB };

export const categories = [
  {id:'cortex',label:'皮层分区',color:'#d8aaa0'},
  {id:'subcortical',label:'皮层下核团',color:'#b5a4ca'},
  {id:'tract',label:'白质纤维束',color:'#b8c7b4'},
  {id:'ventricle',label:'脑室系统',color:'#8fb9cc'},
  {id:'brainstem',label:'脑干',color:'#cfb28d'},
  {id:'cerebellum',label:'小脑',color:'#b3c0a6'},
  {id:'cranial',label:'颅神经',color:'#d5bb78'},
  {id:'spinal',label:'脊髓与灰质',color:'#c9b5a5'},
  {id:'vessel',label:'脑血管',color:'#cb8c8a'},
];
export const networks = [
  {id:'motor',label:'运动网络'}, {id:'dmn',label:'默认模式网络 DMN'},
  {id:'salience',label:'突显网络'}, {id:'visual',label:'视觉通路'},
  {id:'auditory',label:'听觉通路'}, {id:'limbic',label:'边缘系统'},
  {id:'memory',label:'记忆环路'}, {id:'pain',label:'疼痛通路'},
];
export const atlasOptions = [
  {id:'dk',label:'Desikan–Killiany · DK',description:'每侧 34 个脑回分区。DK 命名与功能区不是一一对应；是否有体素数据以数据源面板为准。'},
  {id:'aal',label:'AAL',description:'基于标准化单个受试者脑的宏观解剖图谱。'},
  {id:'aal3',label:'AAL3',description:'扩展丘脑、前扣带和中脑核团；小核团的空间解释需谨慎。'},
  {id:'ho',label:'Harvard–Oxford',description:'皮层下解剖标签；概率阈值及模板版本取决于具体数据文件。'},
  {id:'jhu',label:'JHU 白质图谱',description:'白质区域标签与概率通路；不等同于个体纤维追踪。'},
  {id:'ba',label:'BA · FSL 历史标签',description:'42 个 BA 历史编号，经原作者仿射映射至 MNI152。'},
  {id:'ba-histology',label:'BA · Jülich 组织学子集',description:'9 个 BA 编号、22 个双侧亚区；25% 概率阈值。'},
  {id:'ba-legacy',label:'BA · BrainNet 旧版（未对齐）',description:'保留旧版 41 个编号；来源空间变体未确认，仅供历史对照。'},
];

const colors={frontal:'#d9b1a1',parietal:'#bfc5a4',temporal:'#c5b1ca',occipital:'#a7becb',limbic:'#d2bd9a',insula:'#d2a7ad'};
// These are descriptive teaching anchors, not atlas centroids or a cross-atlas registration.
const cortexRows = [
  ['bankssts','颞上沟岸','Banks of superior temporal sulcus',[55,-40,10],'temporal',['auditory'],'颞上沟的两侧沟壁，位于颞上回与颞中回之间。','整合复杂听觉与视觉社会线索。','参与语音、动态社会刺激和多模态加工；不同子区功能不同。','相关网络受损可影响语言或社会线索理解，不能由单一沟岸标签预测。',[],['deheer2017']],
  ['caudal-anterior-cingulate','尾侧前扣带皮层','Caudal anterior cingulate',[6,12,31],'limbic',['salience','pain','motor'],'扣带回前部较后方，靠近内侧额叶运动区。','整合动作选择、自主反应与行为监控。','参与冲突、努力和突显信息处理。','病变可出现动机或行为启动困难；表现受病灶范围影响。',[24,32],['seeley2007']],
  ['caudal-middle-frontal','尾侧额中回','Caudal middle frontal gyrus',[36,10,48],'frontal',['motor'],'额中回后段，邻近中央前沟。','参与动作准备与眼动控制。','支持工作记忆、注意和任务规则维持。','损伤可影响执行控制和动作计划。',[6,8,9],['miller2001']],
  ['cuneus','楔叶','Cuneus',[10,-80,31],'occipital',['visual'],'顶枕沟与距状沟之间的枕叶内侧区域。','处理视觉空间信息，包含早期与高阶视觉区域。','参与视觉注意和场景的空间分析。','损伤可影响视野或视觉整合，须结合距状沟及视辐射。',[18,19],['hubel1962']],
  ['entorhinal','内嗅皮层','Entorhinal cortex',[22,-7,-29],'limbic',['memory','limbic'],'海马旁回前内侧，连接新皮层与海马形成。','承担海马系统的重要输入和输出。','支持情境、空间及情景记忆编码。','早期阿尔茨海默病常累及该区；萎缩不单独构成诊断。',[28,34],['squire2004']],
  ['fusiform','梭状回','Fusiform gyrus',[35,-48,-19],'temporal',['visual'],'颞枕叶腹侧，位于下颞沟与侧副沟之间。','参与复杂视觉形状和类别加工。','局部功能区参与面孔、文字与物体知觉；FFA 只占其中一部分。','腹侧枕颞网络损伤可出现失认，部分病例有面孔失认。',[20,37],['kanwisher1997','kanwisher2006']],
  ['inferior-parietal','顶下小叶','Inferior parietal lobule',[45,-64,39],'parietal',['dmn'],'顶叶外侧下部；DK 的分区边界与传统角回命名并不完全相同。','整合体感、视觉和听觉信息。','参与语义、数加工、情景提取及注意重定向。','优势半球损伤可影响读写计算；右侧网络损伤可伴空间忽略。',[39,40],['raichle2001','purves2001']],
  ['inferior-temporal','颞下回','Inferior temporal gyrus',[49,-32,-23],'temporal',['visual'],'颞叶外侧下部，延伸至颞枕交界。','参与高级视觉表征。','支持物体识别和视觉语义加工。','相关网络损伤可影响视觉识别，需与视力和语言问题区分。',[20],['purves2001']],
  ['isthmus-cingulate','扣带回峡部','Isthmus of cingulate gyrus',[8,-47,6],'limbic',['dmn','memory'],'胼胝体压部后下方，连接扣带回与海马旁回。','连接内侧顶叶与内侧颞叶。','参与情景记忆及空间定向网络。','病变可影响定向或情景记忆；不能等同于整个压后皮层。',[29,30],['squire2004','raichle2001']],
  ['lateral-occipital','枕叶外侧皮层','Lateral occipital cortex',[40,-81,9],'occipital',['visual'],'枕叶外侧面，包含多个视觉联合区域。','整合形状、边界与物体结构信息。','支持物体知觉及视觉注意。','损伤可出现视觉识别障碍；具体症状取决于功能亚区。',[18,19],['purves2001']],
  ['lateral-orbitofrontal','外侧眶额皮层','Lateral orbitofrontal cortex',[32,31,-13],'frontal',['limbic','salience'],'额叶眶面外侧，位于眶沟周围。','整合感官、奖励及惩罚信息。','参与结果价值更新和行为调整。','损伤可影响决策和社会行为，具有明显个体差异。',[11,47],['miller2001']],
  ['lingual','舌回','Lingual gyrus',[15,-70,-7],'occipital',['visual'],'距状沟下方的枕叶内侧腹面。','参与视觉特征、颜色与场景信息处理。','支持视觉记忆及复杂图像分析。','损伤可伴视觉场景或颜色加工异常。',[18,19],['purves2001']],
  ['medial-orbitofrontal','内侧眶额皮层','Medial orbitofrontal cortex',[8,40,-17],'frontal',['limbic','dmn'],'额叶眶面内侧，邻近腹内侧前额叶。','整合内在状态及结果价值。','参与价值判断、情感调节和自我相关加工。','损伤可影响价值决策和情绪行为调节。',[10,11],['miller2001']],
  ['middle-temporal','颞中回','Middle temporal gyrus',[58,-32,-7],'temporal',['auditory'],'颞上沟与颞下沟之间。','参与语义及多模态信息整合。','支持语言理解、概念提取与动作知识。','优势半球病变可伴命名或语义理解困难。',[21,37],['deheer2017']],
  ['parahippocampal','海马旁皮层','Parahippocampal cortex',[24,-34,-17],'limbic',['memory','visual'],'内侧颞叶海马旁回后部，邻近海马。','编码空间场景和情境信息。','参与情景记忆的情境组织。','受损可影响场景识别、地形定向或情境记忆。',[35,36],['squire2004']],
  ['paracentral','中央旁小叶','Paracentral lobule',[7,-25,65],'parietal',['motor'],'中央沟两侧皮层延伸至大脑内侧面的区域。','包含下肢运动与躯体感觉表征。','参与步态及下肢感觉运动控制。','病变可出现对侧下肢运动/感觉障碍；内侧额叶大病灶可影响排尿控制。',[4,6,1,2,3],['penfield1937']],
  ['pars-opercularis','额下回盖部','Pars opercularis',[49,13,17],'frontal',['motor','auditory'],'额下回后部，位于外侧裂升支之后。','参与发音、动作序列及控制。','优势半球常参与语言产生和音系加工。','优势半球及其连接受损可伴非流利性失语；经典病灶通常更广。',[44],['dronkers2007','deheer2017']],
  ['pars-orbitalis','额下回眶部','Pars orbitalis',[46,31,-9],'frontal',['limbic','auditory'],'额下回腹侧部分，接近眶额皮层。','参与多模态信息与价值处理。','参与语义提取及选择。','病变可影响受控语义提取或行为调整。',[47],['miller2001','deheer2017']],
  ['pars-triangularis','额下回三角部','Pars triangularis',[49,28,8],'frontal',['auditory'],'外侧裂水平支与升支之间的额下回部分。','参与信息选择和语言网络调控。','优势半球常参与语义和句法加工。','与额下回其他区及白质共同受损可伴失语。',[45],['dronkers2007','deheer2017']],
  ['pericalcarine','距状沟周围皮层','Pericalcarine cortex',[10,-83,6],'occipital',['visual'],'沿距状沟上下壁分布，通常涵盖初级视觉皮层的重要部分。','接收外侧膝状体经视辐射传入的视觉信息。','建立视网膜拓扑表征，分析基础视觉特征。','单侧损伤可出现对侧同向视野缺损；双侧广泛损伤可伴皮质盲。',[17],['hubel1962']],
  ['postcentral','中央后回','Postcentral gyrus',[39,-29,52],'parietal',['motor','pain'],'中央沟后方，属于顶叶。','初级躯体感觉处理，含触觉和本体感觉表征。','支持身体部位定位、触觉辨别与感觉运动整合。','损伤可出现对侧皮层感觉障碍，如两点辨别或实体觉异常。',[1,2,3],['penfield1937']],
  ['posterior-cingulate','后扣带皮层','Posterior cingulate cortex',[7,-36,32],'limbic',['dmn','memory'],'胼胝体后部上方的内侧皮层。','连接多个内侧与外侧联合皮层系统。','参与自我相关加工、情景记忆及内在注意。','网络功能改变见于多种疾病；影像差异不能单独定位症状。',[23,31],['raichle2001','raichle2007']],
  ['precentral','中央前回','Precentral gyrus',[38,-16,56],'frontal',['motor'],'中央沟前方，属于额叶。','初级运动皮层的重要解剖载体，发出下行运动信号。','参与随意运动执行，尤其是精细肢体运动。','损伤可出现对侧无力及上运动神经元体征，依损伤范围而异。',[4,6],['penfield1937']],
  ['precuneus','楔前叶','Precuneus',[9,-61,46],'parietal',['dmn','memory'],'顶叶内侧，位于中央旁小叶后方及顶枕沟前方。','整合视觉空间与内在表征。','参与情景回忆、想象及自我相关加工；不同亚区网络归属不同。','病变可影响空间定向或记忆；并非所有楔前叶都属于 DMN。',[7,31],['raichle2001','raichle2007']],
  ['rostral-anterior-cingulate','吻侧前扣带皮层','Rostral anterior cingulate cortex',[6,36,12],'limbic',['limbic','salience'],'扣带回前部较前方，围绕胼胝体膝。','整合情感、内脏和自主调节信息。','参与情绪评价、动机与情感调节。','损伤或网络异常可影响动机与情绪，表现并不特异。',[24,32,33],['seeley2007']],
  ['rostral-middle-frontal','吻侧额中回','Rostral middle frontal gyrus',[35,40,28],'frontal',[],'额中回前段，属于外侧前额叶。','维持目标和任务规则。','参与工作记忆、规划与认知控制。','病变可出现工作记忆和执行功能困难。',[9,46],['miller2001']],
  ['superior-frontal','额上回','Superior frontal gyrus',[14,28,48],'frontal',['motor','dmn'],'额叶上部，跨外侧与内侧面，范围较广。','包含前额叶控制和部分内侧运动相关区域。','参与工作记忆、任务控制及内在加工；不能赋予单一功能。','受损可能影响执行功能、行为启动或运动准备，需考虑具体亚区。',[6,8,9,10],['miller2001']],
  ['superior-parietal','顶上小叶','Superior parietal lobule',[22,-58,60],'parietal',['motor','visual'],'顶内沟上方的顶叶区域。','整合视觉和本体感觉，形成身体空间表征。','参与空间注意及眼手协调。','双侧顶枕网络病变可影响视觉引导动作和空间注意。',[5,7],['purves2001']],
  ['superior-temporal','颞上回','Superior temporal gyrus',[56,-21,7],'temporal',['auditory'],'外侧裂下方，延伸至颞顶交界。','处理听觉与复杂声学信息。','参与语音理解、声音与社会线索加工。','优势侧后部及其连接损伤可伴语言理解障碍。',[22,42],['deheer2017']],
  ['supramarginal','缘上回','Supramarginal gyrus',[53,-37,36],'parietal',['auditory','motor'],'环绕外侧裂后端的顶下小叶前部。','整合体感与动作信息。','参与音韵保持、工具使用和感觉运动转换。','优势半球病变可伴失用或音韵加工障碍。',[40],['deheer2017']],
  ['frontal-pole','额极','Frontal pole',[11,64,0],'frontal',['dmn'],'额叶最前端。','协调当前目标与未来行为。','参与前瞻记忆、多任务和元认知等过程。','受损可能影响复杂计划和现实任务组织。',[10],['miller2001']],
  ['temporal-pole','颞极','Temporal pole',[35,13,-30],'temporal',['limbic','memory'],'颞叶最前端，与边缘和联合皮层相连。','整合高级感知与情绪信息。','参与语义和社会概念知识。','前颞叶退行性病变可伴语义知识丧失；常为双侧网络疾病。',[38],['squire2004']],
  ['transverse-temporal','颞横回','Transverse temporal gyrus',[42,-22,10],'temporal',['auditory'],'颞上面、外侧裂深处，又称 Heschl 回。','包含初级听觉皮层的重要部分，具有频率拓扑。','参与声学特征及时间信息分析。','双侧听觉皮层或通路广泛损伤可致严重皮层听觉障碍。',[41,42],['deheer2017']],
  ['insula','岛叶','Insula',[34,0,4],'insula',['salience','pain','limbic'],'位于外侧裂深处，被额、顶、颞盖遮盖。','整合内感受、味觉与内脏感觉。','前岛参与突显处理；后岛更偏体感和内感受。','损伤可影响味觉、自主调节或情绪感知；单一标签不能概括所有亚区。',[],['seeley2007']],
];

const sideLabels={L:{zh:'左',en:'Left',sign:-1,suffix:'l'},R:{zh:'右',en:'Right',sign:1,suffix:'r'}};
const defaultEvidence='解剖命名可追溯；功能为教学概括，尚未对每条陈述建立分区特异的原始证据链。';
const bilateral = (base) => ['L','R'].map(side=>{
  const s=sideLabels[side];
  return {...base,id:`${base.id}-${s.suffix}`,name:`${s.zh}${base.name}`,en:`${s.en} ${base.en}`,
    aliases:[base.name,base.en,...(base.aliases||[])],hemisphere:side,
    position:[Math.abs(base.position[0])*s.sign,base.position[1],base.position[2]],
    atlasLabels:Object.fromEntries(Object.entries(base.atlasLabels||{}).map(([k,v])=>[k,v.replaceAll('{side}',side).replaceAll('{Side}',s.en)])),
    atlasRelation:'teaching-reference',evidenceStatus:base.evidenceStatus||defaultEvidence,
    geometryStatus:'schematic',...(base.path?{path:base.path.map(p=>[Math.abs(p[0])*s.sign,p[1],p[2]])}:{})};
});

const cortical=cortexRows.flatMap(([id,name,en,position,lobe,net,anatomy,fun,cognition,clinical,ba,refs])=>bilateral({
  id,name,en,position,category:'cortex',lobe,color:colors[lobe],size:[10,10,8],networks:net,
  anatomy,function:fun,cognition,clinical,aliases:[...ba.map(n=>`BA${n}`),...(id==='precentral'?['M1','初级运动皮层']:[]),...(id==='postcentral'?['S1','初级躯体感觉皮层']:[]),...(id==='pericalcarine'?['V1','初级视觉皮层']:[])],
  references:['desikan2006',...refs],atlasLabels:{dk:id.replaceAll('-',''),...(ba.length?{ba:ba.map(n=>`BA${n}`).join(' / ')+'（大致解剖关联）'}:{})},
}));

const deepRows=[
 ['thalamus','丘脑','Thalamus',[12,-17,8],[12,17,11],['motor','visual','auditory','pain'],'位于第三脑室两侧，由多个功能不同的核群组成。','中继与调节感觉、运动和皮层间信息。','不同核群参与注意、觉醒、记忆与认知控制。','丘脑卒中可出现感觉障碍、丘脑痛、意识或记忆异常，取决于核团与血管分布。',['alexander1986','rolls2020'],'Thalamus'],
 ['hippocampus','海马','Hippocampus',[26,-22,-14],[10,21,9],['memory','limbic'],'内侧颞叶，沿侧脑室下角弯曲，与内嗅皮层相连。','参与信息关联及情景记忆的形成。','支持新情景编码、空间情境表征和后续巩固；不是所有记忆的唯一储存处。','双侧内侧颞叶严重损伤可致顺行性遗忘；阿尔茨海默病、缺氧及颞叶癫痫也可累及。',['scoville1957','squire2004'],'Hippocampus'],
 ['amygdala','杏仁核','Amygdala',[23,-4,-19],[8,10,8],['limbic','salience','memory'],'内侧颞叶前部，位于海马头前上方，由多个核群构成。','参与生物学重要性评价及自主反应学习。','支持情绪线索加工、威胁学习与情绪记忆调节。','双侧损伤部分病例对恐惧面孔识别受损；不能简单称为“恐惧中枢”。',['adolphs1994','squire2004'],'Amygdala'],
 ['caudate','尾状核','Caudate nucleus',[13,8,15],[7,19,11],['motor'],'沿侧脑室弯曲的基底节结构，包含头、体、尾。','参与皮层—基底节环路的动作选择。','参与目标导向学习及规则转换。','损伤可影响执行和动作控制；亨廷顿病可伴纹状体退变。',['alexander1986'],'Caudate'],
 ['putamen','壳核','Putamen',[25,1,3],[9,16,14],['motor'],'豆状核外侧部，与尾状核共同构成背侧纹状体。','接受运动相关皮层输入，参与动作控制。','支持熟练动作和习惯学习。','基底节环路异常与运动迟缓、肌张力或不随意运动有关，病变不局限壳核。',['alexander1986'],'Putamen'],
 ['pallidum','苍白球','Globus pallidus',[18,-3,1],[6,10,8],['motor'],'豆状核内侧部，分内、外侧部。','调节基底节输出及丘脑运动环路。','间接参与动作选择与行动抑制。','环路受损可出现运动障碍；不同亚部作用不同。',['alexander1986'],'Pallidum'],
 ['accumbens','伏隔核','Nucleus accumbens',[9,10,-7],[5,7,5],['limbic','salience'],'腹侧纹状体的重要组成，位于尾状核与壳核前腹侧交界。','整合动机、奖励和动作选择信号。','参与强化学习和努力分配，不能等同于单一快乐中心。','奖赏环路异常与成瘾和动机症状相关；关联不是局部病灶诊断依据。',['rolls2020','schultz1997'],'Accumbens'],
 ['hypothalamus','下丘脑','Hypothalamus',[5,-4,-13],[5,8,6],['limbic'],'丘脑下方，形成第三脑室下部侧壁与底部。','调节内稳态、自主神经及内分泌。','参与摄食、体温、昼夜节律与动机状态调节。','受损可出现内分泌、体温、摄食或水盐平衡紊乱，依核团而异。',['purves2001'],null],
 ['subthalamic','丘脑底核','Subthalamic nucleus',[10,-13,-7],[4,5,4],['motor'],'丘脑腹侧、中脑吻侧的间脑小核团。','参与基底节间接及超直接运动控制环路。','参与行动停止和决策调控。','单侧损伤典型可伴对侧偏身投掷样运动，但临床表现存在变异。',['alexander1986'],null],
 ['substantia-nigra','黑质','Substantia nigra',[10,-18,-16],[5,9,4],['motor','limbic'],'中脑腹侧，分致密部和网状部。','致密部提供多巴胺调制，网状部属于基底节输出系统。','参与动作选择与强化学习。','帕金森病累及黑质致密部等广泛系统；黑质整体不是单一多巴胺核团。',['schultz1997','alexander1986'],null],
 ['red-nucleus','红核','Red nucleus',[5,-20,-11],[4,4,5],['motor'],'中脑被盖内，小脑输出通路附近。','参与运动相关通路与小脑联系。','与运动协调有关，其在人类中的具体作用不同于其他动物。','中脑病变累及附近通路可出现震颤、共济失调等组合体征。',['purves2001'],null],
];
const subcortical=deepRows.flatMap(([id,name,en,position,size,net,anatomy,fun,cognition,clinical,refs,label],i)=>bilateral({id,name,en,position,size,networks:net,anatomy,function:fun,cognition,clinical,category:'subcortical',color:['#b7a5c7','#c5a7be','#d0a99f','#aabec9','#beb2cd'][i%5],references:refs,atlasLabels:label?{ho:'{Side} '+label,...(label!=='Accumbens'?{aal:label+'_{side}',aal3:label+'_{side}'}:{aal3:'N_Acc_{side}'})}:{},aliases:[],evidenceStatus:id==='hippocampus'?'经典损伤研究与综述；三维标记位置为教学锚点。':defaultEvidence}));

const single=(x)=>({hemisphere:'M',aliases:[],networks:[],references:['purves2001'],atlasLabels:{},atlasRelation:'teaching-reference',evidenceStatus:defaultEvidence,geometryStatus:'schematic',...x});
const brainstem=[
 single({id:'midbrain',name:'中脑',en:'Midbrain',category:'brainstem',position:[0,-23,-18],size:[15,15,14],color:'#c6b399',networks:['motor','visual','auditory'],anatomy:'脑干最上部，连接间脑与脑桥，内含中脑导水管。',function:'包含上下丘、眼动相关核团、长传导束及觉醒相关结构。',cognition:'参与定向反应、觉醒及行动调节。',clinical:'病变可组合出现眼动异常、对侧无力或共济失调，定位须结合具体结构。'}),
 single({id:'pons',name:'脑桥',en:'Pons',category:'brainstem',position:[0,-31,-35],size:[19,17,15],color:'#cdbb9f',networks:['motor','auditory'],anatomy:'位于中脑与延髓之间，腹侧隆起，背侧邻近第四脑室。',function:'连接皮层与小脑，包含颅神经核及呼吸调节相关网络。',cognition:'经脑桥—小脑通路参与运动学习及多种认知环路。',clinical:'广泛腹侧脑桥损伤可致闭锁综合征；并非所有脑桥损伤均如此。'}),
 single({id:'medulla',name:'延髓',en:'Medulla oblongata',category:'brainstem',position:[0,-42,-59],size:[10,11,18],color:'#c8b29b',networks:['motor','pain'],anatomy:'脑干最下部，向下延续为脊髓；腹侧有锥体。',function:'包含呼吸、循环调节网络及吞咽等反射核团，长传导束在此通过。',cognition:'主要为生命维持及感觉运动传导提供基础。',clinical:'延髓病变可出现吞咽、构音、自主功能及交叉性感觉运动异常。'}),
];
const cerebellum=bilateral({id:'cerebellum',name:'小脑半球',en:'Cerebellar hemisphere',category:'cerebellum',position:[27,-62,-35],size:[25,27,22],color:'#b2bea5',networks:['motor'],anatomy:'位于后颅窝、脑干背侧，表面有细密小脑叶片。',function:'校准运动的时间与精度，参与平衡和误差学习。',cognition:'后叶经皮层环路参与执行、语言与视觉空间加工。',clinical:'损伤常表现同侧肢体共济失调；后叶病变可伴认知情感综合征。',references:['schmahmann1998','ahmadian2019'],atlasLabels:{ho:'{Side} Cerebellum'}});
cerebellum.push(single({id:'cerebellar-vermis',name:'小脑蚓部',en:'Cerebellar vermis',category:'cerebellum',position:[0,-63,-31],size:[7,23,19],color:'#c0c8ad',networks:['motor','limbic'],anatomy:'小脑正中部，连接两侧半球。',function:'参与轴向姿势、平衡与眼动协调。',cognition:'部分蚓部环路参与情感调节。',clinical:'病变可出现躯干和步态共济失调，具体表现依部位与范围而异。',references:['schmahmann1998','ahmadian2019']}));

const ventricleBase={category:'ventricle',color:'#8fb9cc',networks:[],references:['purves2001'],function:'容纳和输送脑脊液；脉络丛产生大部分脑脊液。',cognition:'主要提供液体环境和缓冲条件，不直接承担某种认知模块。',clinical:'通路梗阻或脑脊液动力学异常可导致脑积水，症状取决于病因与进展。'};
const ventricles=[
 ...bilateral({...ventricleBase,id:'lateral-ventricle',name:'侧脑室',en:'Lateral ventricle',position:[13,-14,16],size:[8,30,10],anatomy:'左右各一，呈弯曲形态，分前角、体部、后角及下角，经室间孔通第三脑室。',atlasLabels:{ho:'{Side} Lateral Ventricle'}}),
 single({...ventricleBase,id:'third-ventricle',name:'第三脑室',en:'Third ventricle',position:[0,-9,3],size:[2,13,9],anatomy:'间脑正中狭窄腔隙，两侧邻丘脑与下丘脑。'}),
 single({...ventricleBase,id:'cerebral-aqueduct',name:'中脑导水管',en:'Cerebral aqueduct',position:[0,-25,-15],size:[1.3,1.3,11],anatomy:'贯穿中脑，连接第三和第四脑室，管径较细。'}),
 single({...ventricleBase,id:'fourth-ventricle',name:'第四脑室',en:'Fourth ventricle',position:[0,-46,-38],size:[7,8,12],anatomy:'位于脑桥、延髓背侧与小脑之间，经正中孔及外侧孔与蛛网膜下腔相通。'}),
];

const tractRows=[
 ['corticospinal','皮质脊髓束','Corticospinal tract',[17,-18,-4],['motor'],'由运动及相关皮层发出，经内囊、大脑脚、脑桥和延髓下行，大多数纤维在锥体交叉。','将皮层控制信号传至脊髓运动网络。','支持随意运动，尤其是手指精细运动。','损伤可导致无力及上运动神经元体征；交叉上下的侧别关系不同。',[[33,-15,52],[20,-9,12],[10,-21,-20],[7,-34,-47],[3,-42,-70],[5,-40,-135]],'Corticospinal tract'],
 ['cingulum','扣带束','Cingulum',[10,-17,31],['memory','dmn','limbic'],'沿扣带回及海马旁回走行的联合纤维系统。','连接内侧额顶叶与内侧颞叶的多个区域。','参与情景记忆、内在加工和情绪相关网络。','损伤可能影响多种网络功能，不宜归为单一综合征。',[[10,32,14],[12,5,36],[12,-36,32],[15,-51,7],[24,-28,-12]],'Cingulum'],
 ['fornix','穹隆','Fornix',[6,-10,11],['memory','limbic'],'海马的重要输出纤维，经穹隆体与柱联系乳头体和隔区等。','传递海马系统输出。','参与情景记忆及海马—间脑环路。','双侧损伤可出现记忆障碍；影响与其他边缘通路共同决定。',[[24,-29,-14],[18,-39,3],[5,-23,18],[5,1,12],[5,-1,-10]],'Fornix'],
 ['uncinate','钩束','Uncinate fasciculus',[30,9,-18],['limbic','memory'],'经岛阈下方弯曲，连接前颞叶与眶额区域。','连接颞额联合与边缘皮层。','参与语义、情绪及人物相关记忆网络。','损伤可能影响相关认知，症状并非该束特异。',[[35,7,-28],[28,-1,-17],[29,13,-11],[27,32,-10]],'Uncinate fasciculus'],
 ['superior-longitudinal','上纵束','Superior longitudinal fasciculus',[35,-11,31],['motor','visual','auditory'],'额顶叶间的长联合纤维系统，有多个分支。','连接额叶与顶叶的感觉运动及注意网络。','支持空间注意、工作记忆及动作规划。','损伤可能伴忽略或动作计划异常；不能把所有语言障碍归于该束。',[[31,30,29],[34,1,39],[37,-32,41],[40,-58,33]],'Superior longitudinal fasciculus'],
 ['arcuate','弓状束','Arcuate fasciculus',[39,-30,22],['auditory'],'额颞之间弯曲走行的联合通路，分支与命名因分区法而异。','连接语言相关颞叶与额叶区域。','支持语音与发音系统间的转换。','优势侧语言网络损伤可能出现复述障碍；传导性失语并非只由单束损伤决定。',[[48,16,18],[39,-8,35],[40,-40,30],[50,-46,4],[52,-25,-3]],null],
 ['inferior-longitudinal','下纵束','Inferior longitudinal fasciculus',[34,-43,-13],['visual','memory'],'沿颞枕叶腹侧走行的长联合纤维。','连接枕叶视觉区域与颞叶联合皮层。','参与视觉识别和视觉语义加工。','损伤可能影响物体或面孔识别，表现取决于网络范围。',[[27,-84,-4],[34,-58,-13],[37,-28,-18],[35,6,-25]],null],
 ['inferior-fronto-occipital','下额枕束','Inferior fronto-occipital fasciculus',[28,-17,-1],['visual','auditory'],'通过深部白质联系额叶与后部颞顶枕联合区域。','提供前后联合皮层间的长程联系。','参与语义和视觉信息整合。','损伤可能影响语义处理或视觉关联功能。',[[25,39,-6],[24,4,0],[28,-33,1],[28,-78,4]],null],
 ['optic-radiation','视辐射','Optic radiation',[28,-56,3],['visual'],'由外侧膝状体投射至距状沟周围皮层，含颞叶前绕的 Meyer 袢。','传导视网膜拓扑组织的视觉信息。','为早期视觉皮层提供输入。','局部损伤可造成对侧同向象限盲或偏盲。',[[23,-25,-1],[30,-19,-11],[34,-51,-5],[18,-81,6]],null],
 ['medial-lemniscus','内侧丘系','Medial lemniscus',[5,-30,-30],['motor'],'薄束核和楔束核换元、交叉后的上行体感通路。','传递躯干肢体精细触觉、振动觉和意识性本体感觉。','支持身体知觉及感觉运动控制。','脑干以上通路损伤可致对侧相关感觉障碍。',[[3,-42,-64],[5,-33,-41],[6,-25,-20],[10,-16,3]],'Medial lemniscus'],
 ['spinothalamic','脊髓丘脑束','Spinothalamic tract',[5,-40,-120],['pain'],'脊髓前外侧系统的重要组成；多数纤维在入髓后数节段内交叉。','传递伤害性感觉、温度及部分粗触觉信息。','为疼痛的感知和反应提供上行输入。','脊髓半侧损伤可出现对侧痛温觉障碍，常从病灶下方若干节段开始。',[[5,-38,-360],[5,-39,-190],[6,-39,-75],[8,-28,-25],[13,-18,4]],null],
];
const tracts=tractRows.flatMap(([id,name,en,position,net,anatomy,fun,cognition,clinical,path,jhu])=>bilateral({id,name,en,position,size:[4,8,4],category:'tract',color:'#aebfa7',networks:net,anatomy,function:fun,cognition,clinical,path,atlasLabels:jhu?{jhu:`${jhu} {side}`}:{},references:id==='fornix'?['squire2004','mori2008']:id==='spinothalamic'?['melzack1965','purves2001']:['mori2008','purves2001']}));
tracts.push(single({id:'corpus-callosum',name:'胼胝体',en:'Corpus callosum',category:'tract',color:'#c7c9aa',position:[0,-7,23],size:[24,34,6],networks:[],anatomy:'最大的大脑半球间连合纤维，分嘴、膝、体和压部。',function:'连接左右半球的广泛皮层区域。',cognition:'支持半球间感觉、运动与认知信息交换。',clinical:'离断可出现半球间信息传递障碍；需根据具体纤维和行为任务解释。',references:['mori2008','purves2001'],atlasLabels:{jhu:'Genu / Body / Splenium of corpus callosum'}}));

const cranialRows=[
 [1,'olfactory','嗅神经','Olfactory nerve',[13,31,-16],'嗅丝穿筛板至嗅球；嗅球和嗅束属于中枢组成。','传导嗅觉信息。','参与气味识别并与情绪记忆联系。','损伤可致嗅觉减退或缺失；嗅觉症状的病因多样。',['limbic','memory']],
 [2,'optic','视神经','Optic nerve',[13,7,-24],'视网膜神经节细胞轴突汇集形成，为中枢神经系统延伸；经视交叉续为视束。','传导视觉信息及瞳孔光反射传入。','为视觉知觉提供输入。','损伤可致同侧视力或视野异常；视交叉与视束损伤模式不同。',['visual']],
 [3,'oculomotor','动眼神经','Oculomotor nerve',[6,-17,-28],'由中脑腹侧脚间窝出脑，含躯体运动及副交感纤维。','支配多数眼外肌、提上睑肌及瞳孔收缩相关通路。','实现眼位控制，支持视觉定向。','损伤可伴上睑下垂、眼位异常、复视或瞳孔异常。',['visual','motor']],
 [4,'trochlear','滑车神经','Trochlear nerve',[7,-31,-24],'由中脑背侧出脑并绕至腹侧，出脑前交叉。','支配上斜肌。','支持垂直及旋转眼位控制。','损伤常出现特定注视方向加重的垂直复视。',['visual','motor']],
 [5,'trigeminal','三叉神经','Trigeminal nerve',[22,-26,-36],'由脑桥外侧出入脑，分眼、上颌和下颌支。','传递面部感觉并支配咀嚼肌。','支持口面体感与咀嚼控制。','损伤可出现面部感觉或咀嚼异常；三叉神经痛不等同于核团损伤。',['pain','motor']],
 [6,'abducens','展神经','Abducens nerve',[5,-34,-44],'由脑桥延髓沟内侧出脑。','支配外直肌使眼球外展。','支持双眼协调注视。','损伤可出现外展受限和水平复视。',['visual','motor']],
 [7,'facial','面神经','Facial nerve',[16,-34,-44],'由脑桥延髓交界外侧出脑，含运动、味觉与副交感成分。','支配面部表情肌，传递舌前部味觉并参与泪液和唾液分泌。','参与表情产生、交流及味觉加工。','周围性损伤常累及同侧上下半面；中枢损伤模式需结合其他体征。',['motor','limbic']],
 [8,'vestibulocochlear','前庭蜗神经','Vestibulocochlear nerve',[24,-37,-43],'从内耳进入脑桥延髓交界，含前庭和蜗神经。','传递听觉、头部运动和平衡信息。','支持声音分析、空间定向及眼头协调。','损伤可表现听力异常、耳鸣、眩晕或平衡障碍。',['auditory','motor']],
 [9,'glossopharyngeal','舌咽神经','Glossopharyngeal nerve',[12,-42,-51],'从延髓橄榄后沟上部出脑。','传递咽部感觉、舌后部味觉及颈动脉窦信息，参与吞咽和腮腺分泌。','为内感受和吞咽控制提供输入输出。','损伤可伴吞咽或咽反射异常，应区分感觉与运动成分。',['motor']],
 [10,'vagus','迷走神经','Vagus nerve',[13,-44,-57],'从延髓橄榄后沟出脑，广泛分布于颈、胸及腹部。','参与发声、吞咽和内脏副交感调节，含大量内脏传入纤维。','支持内感受与脑—身体状态调节。','损伤可出现声音嘶哑、吞咽或自主功能异常。',['limbic']],
 [11,'accessory','副神经','Accessory nerve',[11,-45,-67],'脊髓根起于上颈髓，向上入颅后经颈静脉孔出颅。','主要支配胸锁乳突肌和斜方肌。','支持头颈姿势与肩带运动。','损伤可出现转头或耸肩无力。',['motor']],
 [12,'hypoglossal','舌下神经','Hypoglossal nerve',[8,-38,-60],'由延髓锥体与橄榄之间出脑。','支配大多数舌肌。','支持言语构音与吞咽。','周围性单侧损伤可见舌肌萎缩及伸舌偏向患侧。',['motor']],
];
const romans=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const cranial=cranialRows.flatMap(([number,id,name,en,position,anatomy,fun,cognition,clinical,net])=>bilateral({id:`cn-${id}`,name:`${name}（${romans[number-1]}）`,en,position,size:[2,7,2],category:'cranial',color:'#ccb87c',networks:net,anatomy,function:fun,cognition,clinical,aliases:[`CN${number}`,`CN ${romans[number-1]}`,`第${number}对颅神经`,name],cranialNumber:number,references:['purves2001'],evidenceStatus:'教材级解剖概括；颅外走行采用示意线，未建立逐神经原始病例链。'}));

const spinalGroups=[
 {prefix:'C',name:'颈髓',en:'Cervical',count:8,start:-84,end:-181,radius:6.4,fun:'支配颈部及上肢相关感觉运动；C3–C5 参与膈神经运动支配。',clinical:'较高颈髓严重损伤可影响四肢和呼吸；症状依节段及完整性而定。'},
 {prefix:'T',name:'胸髓',en:'Thoracic',count:12,start:-200,end:-405,radius:4.8,fun:'参与躯干感觉运动；胸腰段中间外侧柱含交感节前神经元。',clinical:'病变可出现躯干感觉平面、下肢运动及自主功能异常。'},
 {prefix:'L',name:'腰髓',en:'Lumbar',count:5,start:-423,end:-467,radius:6.8,fun:'参与下肢感觉、运动及相应节段反射。',clinical:'病变可影响下肢运动感觉；脊髓节段与同名椎骨高度不同。'},
 {prefix:'S',name:'骶髓',en:'Sacral',count:5,start:-478,end:-501,radius:4.5,fun:'参与下肢远端、会阴及盆腔功能；S2–S4 含骶副交感节前神经元。',clinical:'病变可伴会阴感觉、排尿排便或性功能异常，需区分圆锥与马尾受累。'},
 {prefix:'Co',name:'尾髓',en:'Coccygeal',count:1,start:-509,end:-509,radius:2.3,fun:'参与尾部局限区域的感觉传入；位于脊髓圆锥最尾侧。',clinical:'局部受累的表现通常需与骶髓或神经根病变一起解释。'},
];
const spinal=spinalGroups.flatMap(g=>Array.from({length:g.count},(_,i)=>single({
 id:`spinal-${g.prefix}${i+1}`,name:`${g.name} ${g.prefix}${i+1} 节段`,en:`${g.en} spinal cord segment ${g.prefix}${i+1}`,category:'spinal',
 position:[0,-42+5*Math.sin((g.start+(g.end-g.start)*i/Math.max(1,g.count-1))/140),g.start+(g.end-g.start)*i/Math.max(1,g.count-1)],
 size:[g.radius,g.radius*.8,g.count>1?Math.abs(g.end-g.start)/(g.count-1)*.46:4],color:['#c9b5a5','#bcbdab','#b2bca8','#b8adc4','#c5b3bb'][spinalGroups.indexOf(g)],
 networks:['motor','pain'],aliases:[`${g.prefix}${i+1}`,g.name,g.en,'spinal cord','脊髓'],spinalSegment:`${g.prefix}${i+1}`,
 anatomy:`${g.name}第 ${i+1} 节段；节段按相应脊神经根定义，并非同名椎骨的位置。成人脊髓末端通常位于 L1–L2 椎骨水平。`,
 function:`本节段所属${g.name}的总体作用：${g.fun} 各节段具体支配有重叠，不能把整个区域作用归于单一节段。`,cognition:'通过上行和下行通路与脑相连，承担局部反射和感觉运动整合。',clinical:g.clinical,
 evidenceStatus:'脊髓全段采用独立教学比例示意，未配准到 MNI152 或 PAM50；所列毫米数不是可用于定位的脊髓坐标。',
})));
spinal.push(
 single({id:'spinal-gray',name:'脊髓灰质',en:'Spinal gray matter',category:'spinal',position:[0,-42,-252],size:[3.5,3,180],color:'#b998aa',networks:['motor','pain'],anatomy:'位于脊髓中央，横断面呈蝶形；包括前角、后角及部分节段的侧角。',function:'容纳局部中间神经元、感觉处理与运动/自主输出细胞群。',cognition:'完成反射和局部感觉运动整合，并受到脑内下行控制。',clinical:'灰质损伤表现依受累细胞群与节段分布而异。'}),
 ...bilateral({id:'spinal-anterior-horn',name:'脊髓前角',en:'Anterior horn of spinal cord',category:'spinal',position:[2.3,-39,-150],size:[1.8,2,20],color:'#c99591',networks:['motor'],anatomy:'脊髓灰质腹侧，含躯体运动神经元；颈膨大与腰骶膨大较发达。',function:'下运动神经元经前根输出至骨骼肌。',cognition:'执行局部反射和来自上位中枢的运动指令。',clinical:'受累可出现节段性无力、萎缩及腱反射减弱；运动神经元病涉及更广网络。',references:['purves2001']}),
 ...bilateral({id:'spinal-posterior-horn',name:'脊髓后角',en:'Posterior horn of spinal cord',category:'spinal',position:[2.1,-44,-150],size:[1.2,2,20],color:'#9eb3c5',networks:['pain'],anatomy:'脊髓灰质背侧，接收后根传入并按层板组织。',function:'处理和调制触觉、痛温觉等传入。',cognition:'构成疼痛上行与下行调制的早期整合环节。',clinical:'受累可引起节段性感觉异常；疼痛并不由后角单独决定。',references:['melzack1965','purves2001']}),
 single({id:'spinal-lateral-horn',name:'脊髓侧角',en:'Lateral horn of spinal cord',category:'spinal',position:[3.5,-41,-265],size:[1,1.5,90],color:'#c4acba',networks:[],anatomy:'胸腰段 T1–L2/上 L3 灰质外侧可见较明显侧角；骶副交感细胞位于 S2–S4 中间带。',function:'容纳交感节前神经元，参与内脏运动输出。',cognition:'通过自主调节维持身体状态。',clinical:'相关通路损伤可出现自主功能异常；侧角不沿全脊髓等量分布。'}),
);

const vessels=bilateral({id:'middle-cerebral-artery',name:'大脑中动脉',en:'Middle cerebral artery',category:'vessel',position:[29,2,-2],size:[2,10,2],color:'#c58785',networks:[],anatomy:'颈内动脉分支，沿外侧裂走行，供应大脑半球外侧广泛区域。',function:'为相应皮层与深部结构供血。',cognition:'认知作用取决于供血区域；血管本身不承担认知计算。',clinical:'闭塞可造成偏瘫、感觉障碍，优势侧可伴失语，非优势侧可伴忽略。',references:['purves2001'],evidenceStatus:'可选血管走行示意；不包含个体血管变异或完整脑血管树。'});

spinal.push(single({id:'spinal-white',name:'脊髓白质',en:'Spinal white matter',category:'spinal',position:[0,-46,-300],size:[5,4,180],color:'#c8cfb9',networks:['motor','pain'],anatomy:'脊髓灰质外围的白质，分前索、侧索和后索，含长程及节段间纤维。',function:'传递上行感觉、下行运动调节以及脊髓节段间信息。',cognition:'连接脊髓局部回路与脑内网络；白质整体不对应单一认知功能。',clinical:'损伤表现取决于受累纤维束、侧别与节段。',references:['purves2001']}));
export const structures=[...cortical,...subcortical,...brainstem,...cerebellum,...ventricles,...tracts,...cranial,...spinal,...vessels].map(s=>({...s,evidence:evidenceByStructureId[s.id]}));
export const structureById=Object.fromEntries(structures.map(s=>[s.id,s]));

const baKnown={1:['初级躯体感觉皮层','postcentral'],2:['初级躯体感觉皮层','postcentral'],3:['初级躯体感觉皮层','postcentral'],4:['初级运动皮层','precentral'],5:['顶叶躯体感觉联合皮层','superior-parietal'],6:['前运动/辅助运动相关皮层','caudal-middle-frontal'],7:['顶叶联合皮层','superior-parietal'],8:['额叶眼动及控制相关皮层','caudal-middle-frontal'],9:['背外侧前额叶相关皮层','rostral-middle-frontal'],10:['额极','frontal-pole'],11:['眶额皮层','medial-orbitofrontal'],17:['初级视觉皮层','pericalcarine'],18:['视觉联合皮层','cuneus'],19:['视觉联合皮层','lateral-occipital'],20:['颞下回相关皮层','inferior-temporal'],21:['颞中回相关皮层','middle-temporal'],22:['颞上回相关皮层','superior-temporal'],23:['后扣带皮层','posterior-cingulate'],24:['前扣带皮层','caudal-anterior-cingulate'],25:['膝下扣带区',null],26:['压后区相关历史分区',null],27:['前下托相关区',null],28:['内嗅皮层','entorhinal'],29:['颗粒型压后皮层','isthmus-cingulate'],30:['无颗粒型压后皮层','isthmus-cingulate'],31:['后扣带联合区','posterior-cingulate'],32:['前扣带/内侧前额区','rostral-anterior-cingulate'],33:['扣带沟旁狭窄区域','rostral-anterior-cingulate'],34:['背侧内嗅相关皮层','entorhinal'],35:['嗅周相关皮层','parahippocampal'],36:['外嗅相关皮层','parahippocampal'],37:['颞枕联合区','fusiform'],38:['颞极','temporal-pole'],39:['角回相关区','inferior-parietal'],40:['缘上回相关区','supramarginal'],41:['初级听觉相关皮层','transverse-temporal'],42:['听觉联合相关皮层','superior-temporal'],43:['中央下区',null],44:['额下回盖部相关区','pars-opercularis'],45:['额下回三角部相关区','pars-triangularis'],46:['外侧前额叶相关区','rostral-middle-frontal'],47:['眶额/额下回眶部相关区','pars-orbitalis'],52:['岛旁区历史分区',null]};
export const brodmannIndex=Array.from({length:52},(_,i)=>{
 const number=i+1; const known=baKnown[number];
 return {id:`BA${number}`,number,name:known?.[0]||'历史编号：物种与后续定义存在差异',targetId:known?.[1]?`${known[1]}-l`:null,
   note:'BA 与脑回不是一一对应。搜索定位为相关教学结构；实际边界和可用范围请分别查阅历史与组织学图谱。'+(!known?' 本项不自动映射到人脑结构。':'')};
});

export const teachingNotes={
 coordinates:'脑内空间采用 RAS 毫米坐标：x 向右、y 向前、z 向上为正。RAS 坐标与放射学切片显示习惯是不同概念。',
 atlas:'术语关联不等于图谱空间映射。坐标标签应查询各图谱实际体素和仿射矩阵；无空间数据的图谱仅提供知识索引。',
 networks:'网络筛选表示教学关联，脑回与功能网络不一一对应；同一结构可参与多个网络。',
 spinal:'脊髓与颅神经采用结构示意，完整脊髓不包含在 MNI152 脑模板中。脊髓节段与椎骨节段不能混用。',
 evidence:'损伤症状是常见教学例子，取决于侧别、病变范围、连接及个体差异；临床扩展默认关闭。',
};

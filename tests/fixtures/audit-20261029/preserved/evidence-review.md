# 文献与脑区证据审查（2026-10-29）

范围：科研人员的脑区定位、图谱比较、结果追溯。只读审查当前工作区，未改生产代码，未运行生成器，未进行浏览器操作。已运行 `node scripts/literature_validate.mjs`、`node scripts/verify_references.mjs --check`，均通过；以下另行检查其科学语义与覆盖范围。

## 实测基线

直接通过 Node 导入当前数据计算：118 篇参考文献和 115 个阅读记录均为完整文献库口径，包含仅关联隐藏脊髓目录的来源；`F:/project/brain-model/src/App.jsx:25` 只排除了脊髓结构，并未从 `allReferences` 中删除相关论文。115 个阅读记录中，99 个有当前脑结构关联，4 个仅有隐藏脊髓关联（Melzack 1965、Rexed 1952、Grillner 2006、Rupp 2026），12 个没有结构映射（其中包含图谱/方法文献）。另有 4 个阅读记录同时关联当前脑结构和隐藏脊髓。

后台完整数据有 512 个结构阅读关联，其中当前 150 个脑结构对应 **433 个关联**，已隐藏的 38 个脊髓结构对应 **79 个关联**；482 个 `curated-region-reading`、115 个 `claims`（每篇正好一个）和 105/115 个通用样本描述也均为完整库口径。188 是完整结构数，不能当成当前脑界面的结构数。

3/118 篇论文有结构化结果（占完整文献库 2.5%），共 4 条结果、8 个坐标，全部关联当前脑界面，覆盖 7/150 个脑结构（4.7%），不含隐藏脊髓。8/8 坐标为 `MNI-unspecified`，当前可直接叠加的内置论文坐标为 0。可重复检查：运行 `node output/audit-20261029/evidence-probes.mjs`；结果保存在 `F:/project/brain-model/output/audit-20261029/evidence-probes.json`，包含分母分拆、来源代码哈希和下文功能区检索复现。

### 已确认问题

1. **P1：自动生成的直接证据标记没有检查物种。**
   - 位置：`F:/project/brain-model/scripts/literature_build.mjs:77`；物种事实在 `F:/project/brain-model/data-sources/literature-upgrade/curation.mjs:21`、`:37`、`:48`、`:57`、`:95`。
   - **当前脑界面对应 8 个关联**仍为 `directEvidence:true`：Hubel 猫→双侧距状沟周围皮层（2）；Hafting 鼠→双侧内嗅（2）；Padoa-Schioppa 猴→双侧内侧眶额（2）；Graziano 猴→双侧中央前回（2）。**后台完整数据为 11 个**，另外 3 个来自 Rexed 猫→脊髓灰质和双侧后角；这 3 个结构已被当前脑界面排除，不能算成当前脑界面的受影响关联。原文来源及现有文字本已明确物种；错误来自生成规则仅按研究类型和侧化例外判断。
   - 对照：`F:/project/brain-model/data-sources/literature-upgrade/discovery.mjs:76` 对 Tsao 2006 的 4 个同类跨物种关联正确设为 `cross-species-context`、`directEvidence:false`。同一库存在不一致语义。
   - 风险：后续使用这个机器字段进行直接证据筛选、计数或强度着色时，动物机制证据会被升级成人脑特定标签的直接证据。
   - 修复与验收：分开记录“原研究为直接测量”和“对当前目标结构的直接支持”；跨物种映射默认背景/待验证同源，保留原物种和原结构名。验收当前脑目录的 8 项不再作为人体直接定位证据，并统一修正后台包含脊髓在内的 11 项；生成后测试针对所有动物物种执行，不能只对 Tsao 写特例。
   - 原始来源：[Hafting et al., Nature 2005](https://www.nature.com/articles/nature03721)（原文图例明确大鼠）；[Hubel & Wiesel, Journal of Physiology 1962](https://physoc.onlinelibrary.wiley.com/doi/10.1113/jphysiol.1962.sp006837)（研究对象在原始题名中已明确为猫）。

2. **P1：定位交互丢弃已有的直接/背景/侧化区别。**
   - 位置：`F:/project/brain-model/src/components/LiteratureWorkspace.jsx:48`、`:51`；源映射规则在 `F:/project/brain-model/data-sources/literature-upgrade/discovery.mjs:85`—`:90`。
   - `openPaper` 把全部 `mappedRegions` 送入定位，脑区按钮只展示结构名；没有使用 `directEvidence`、`sourceKind`、每条 `limitations`。例如 Silani 2013 的左缘上回明确是背景关联、原干预在右侧，但打开论文仍把左右两侧同样送入定位。Dronkers 的右侧语言关联、Bentin 的头皮 EEG 背景关联同理。
   - 这是代码路径确认，未声称完成浏览器复现。总摘要中的侧化提醒存在，不能替代每个定位按钮上的证据语义。
   - 修复与验收：定位入口显式显示原文结果区域/背景比较/跨物种、支持类型及来源；默认只定位直接支持的区域，背景可主动展开。Silani 默认定位只含右侧；左侧仍可作为说明充分的背景阅读入口。

3. **P2：已录入的功能区和坐标无法被科研检索找到。**
   - 位置：`F:/project/brain-model/src/components/LiteratureWorkspace.jsx:35`、`:36`；`F:/project/brain-model/src/data/results.js:16`、`:21`。
   - 按当前检索表达式在 Node 中重建：`pre-SMA`、`BA44` 在中英文界面均为 0 篇，尽管 Schaum 记录中已经有 `pre-SMA` 和 `rIFG BA44/45` 坐标标签。检索没有包含坐标标签、原始行名、ROI 定义、结构别名和另一语言的正文。
   - Schaum 论文仅有 `attention` 主题；筛选 `control` 会排除该运动抑制研究。论文层模态由唯一的 MEG 结果推得，所以筛选 fMRI 也排除这篇 MEG/fMRI 论文；结果模态和整篇研究模态尚未分开。
   - 修复与验收：建立包含功能区名、缩写、脑图谱术语、原始坐标行名和双语文本的索引；论文方法与已摘录结果方法分开。`pre-SMA`、`BA44/45`、`停止` 在任意语言模式能找到 Schaum；控制主题与 fMRI 论文筛选亦能找到，MEG 结果仍保持自身模态。
   - 原始论文明确采用 MEG/fMRI：[Schaum et al., eLife 2021](https://elifesciences.org/articles/61679)。

4. **P2：结构化结果的“原文核对”缺少可离线复核的原文证据。**
   - 位置：`F:/project/brain-model/data-sources/results/verify-sources.mjs:19`、`:27`、`:29`；`F:/project/brain-model/scripts/literature_validate.mjs:113`、`:121`。
   - results 目录只有三个书目 JSON、转录后的结果 JSON、坐标审计 JSON 和脚本；没有三个原始表格/方法段的保存文本或哈希。脚本获取全文并提取表格后只输出到终端，保存的 metadata 仅含书目信息和来源 URL。验证器把 results.js 中的八个数值与另一个人工整理 JSON 比较，不能据此复核原始表格。
   - 当前没有发现抽样坐标错误：本次从原文重新核对 Schaum 四个峰值及 Bosco 两个刺激点一致；这一检查不覆盖全部 118 篇。
   - 修复与验收：每条结果保存公开原文版本、访问日期、表格/段落标识、最小合法证据摘录及校验和；转录记录引用该 source artifact。断网时仍可从原始来源摘录重查每个数值和条件；修改摘录应使完整性检查失败，修改转录值应使语义对照待复核。

5. **P2：导出阅读论文的“证据”不会包含其脑区关联和 claims。**
   - 位置：`F:/project/brain-model/src/components/LiteratureWorkspace.jsx:43`；`F:/project/brain-model/src/lib/evidence-workspace.js:5`。
   - `exportEvidence(selectedPaper)` 仅序列化 references/results/relations。对 Kanwisher 1997 等 115 个阅读记录中的大多数，结果数组为空，阅读摘要、claim、regionIds、映射类型、限制和方法来源都不进入文件。可在同版本应用中依赖内置记录重建，但导出文件本身不能表达研究者当时引用了什么证据或哪版映射。
   - 修复与验收：允许导出独立的阅读证据记录，或将 claim 与关联统一纳入有版本的证据 schema。验收导出的 Kanwisher 条目包含其具体脑区关系、限定词、原文来源和数据版本，其他工具无需依赖本应用内置库即可解释。

### 科研路线图缺口（不是把现有防护改弱）

6. **P1：真正可用于结果定位的覆盖仍很小，尚未闭合“论文→坐标→当前图谱”。**
   - 位置：`F:/project/brain-model/src/data/results.js:7`、`:13`、`:15`；`F:/project/brain-model/src/components/ResultCoordinates.jsx:11`；`F:/project/brain-model/src/App.jsx:152`。
   - 实测 3/118 篇、4 条结果、8 个坐标、7/150 个脑结构；8 个坐标全部留在独立坐标轴视图，没有可直接叠加到 NLin6Asym 的内置结果。把不明 MNI 变体拒绝叠加是正确的安全边界，不应为了“看上去完整”改成未经证明的 MNI 等价。
   - 实施方向：先选一个明确研究主题扩充可追溯结果集，优先原始统计图/ROI mask、明确模板版本的坐标，建立 source space→target space 的变换记录、误差和逆向追溯；同时区分未摘录、原文没坐标、空间未知、已可靠转换。
   - 验收：至少一个真实科研案例从原文结果定位到图谱标签/ROI比较，再回到原表/方法；全链保留来源空间、变换、版本和不确定性，现有不明空间记录仍不直接叠加。

7. **P2：证据粒度和定量字段尚不支持严谨的跨论文比较。**
   - 位置：`F:/project/brain-model/scripts/literature_build.mjs:81`、`:84`；`F:/project/brain-model/src/lib/evidence-workspace.js:47`；`F:/project/brain-model/src/data/results.js:19`、`:32`。
   - 115 篇阅读记录各只有一个由整篇 summary 生成的 claim；105 篇样本描述仍是占位性“见原文”。四条结构化结果的样本、ROI、方向/统计也主要是自由文本，没有效应量、方差、校正方法、时间窗、频段、定位精度的可验证结构。
   - 原文中已经存在但未进入结构化记录的例子：Schaum 表1的峰值统计量以及图2的频段/时间窗；Bosco 表1每个刺激点的坐标标准差。当前图中的同样大小标记无法展示这些不同含义的不确定性。
   - 修复与验收：拆成 experiment→contrast/result→location；为样本、检验、校正、效应、时间频率和定位不确定性设单位明确的字段，并允许“原文未报告”。每个结果能独立追至原表/段；比较表显示关键可比条件及缺失，而不是仅比较整篇摘要。不得用录入数量自动计算证据强度。

## 本次原文抽样与边界

- [Schaum et al.](https://elifesciences.org/articles/61679)：四个选定坐标与 Table 1 一致，研究样本和 MEG/fMRI 描述有原文支持。未重新评估整篇分析质量。
- [Axelrod & Yovel](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0117126)：原文支持 20 体素 ROI 和左 FFA 未通过校正的表述，本次未把两个 ROI 表格坐标都作为独立完成核验项目。
- [Bosco et al. 原文 PMC 镜像](https://pmc.ncbi.nlm.nih.gov/articles/PMC6671632/)：两个协议1刺激点、样本和实际刺激均值含义与 Table 1/方法一致；出版社 URL 本次抓取返回 403，PMC 原文可读取。这是本次获取限制，不能据此判定普通浏览器中的链接失效。
- 书目完整性检查通过并不等于所有题名、结论、坐标或全文都经过本次独立审定；图像链接也未做浏览器逐一呈现验证。

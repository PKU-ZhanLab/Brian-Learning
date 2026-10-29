# 可追溯案例验收

2026-10-30。建议专题仍是 `proposed`：优先运动抑制/控制（Schaum），备选面孔感知（Axelrod）及动作知觉/TMS（Bosco）。用户未选定专题。按链路完整性验收，不设新增论文数量门槛。

当前原始基线是三篇、四条结果、八个位置；八点均为 `MNI-unspecified`，直接叠加资格为0。`curation-scope.json` 保存命名基线，后续新增记录由版本清单约束。

| 案例 | 原文与来源 | 空间 / 图谱或 ROI | 保存、恢复与独立导出 | 判定 |
| --- | --- | --- | --- | --- |
| 来源坐标：Schaum MEG停止对比 | `schaum2021-v1` 的最小原文单元离线核对通过；Table1四个峰值、方法和统计来源可返回原文 | 原文未明确模板变体；四点保持独立坐标系。精确空间、精确图谱标签映射待完成 | E6固定版本导出可独立检查来源、坐标、审阅范围及内容摘要；既有W5/X4独立结果层及项目保存路径有软件测试。E6新增页面/下载的桌面操作未运行 | **pending**：不能把软件链通过写成来源空间通过 |
| 实际标签 / ROI：AAL3 registered label134，`Thal_Re_R` | 原始图谱、字典、变换与原文件身份见 `public/data/asset-identities.json`；它是图谱软件案例，没有与所选论文原始ROI建立来源链 | 既有S4/S5真实操作：1mm网格源7/目标7体素，Dice1；2mm源7/目标0，丢失标签并提示确认，Dice为null。间距不是定位精度；这是项目估计配准 | 既有W6真实操作保留原1mm结果及显式重算的2mm结果，恢复后原快照保持完全相同；当前设置差异仍可见。JSON/CSV、NIfTI与计算清单有原下载核对记录 | **软件步骤通过，论文来源闭环pending**；不把标签ROI当论文的功能ROI |
| 实际原图：Martin2023 / NV13064 image787769 | 正式论文§2.6外链绑定集合；原图CC0及原压缩字节SHA256已有获取记录。不是DOI检索命中 | 原网格 `[74,88,67]`、体素约 `[2.488,2.488,2.75]` mm与sform保留。`sourceSpaceId=null`；作者代码指向NLin6Asym，但缺特定上传字节的执行/导出绑定。无派生图、变换或图谱ROI资格 | 本轮只登记原生影像来源与可携带事实；没有将原图导入应用并完成保存/恢复/导出。源影像不作为包内隐式依赖 | **pending**：上传模板、正式协变量模型对应、阈值冲突和影像操作链均未完成 |

表中的既有桌面操作来自root先前的AI操作和字节核对，不是人类领域审阅。S3源构建为 `2912228` / 修复 `2644ab3`；S5为 `955c37cda809b04a19d5f9590f95db693827d404`；W6为 `a30cc08c33d449db65d85c031a1c5b63693411ff`。原始收据保留于执行工作区的 `output/s3-cua/`、`output/s4-cua/`、`output/s5-cua/`、`output/w6-cua/`，不随公开源码分发。表内总结不表示本轮重新运行或解剖准确性验证。

## 原文返回与来源边界

- [Schaum Table1及方法](https://elifesciences.org/articles/61679#table1)：原始四个MEG峰值与新获取的fMRI图不是同一种结果。Schaum原T图/mask已另行下载，但精确模板和数据再分发权利未解决；不进入公开源码包。
- [Axelrod原文](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0117126)：右FFA结果通过原文校正，左FFA未通过。两侧分析n不同；ROI均值不是解码峰值。v2增加18人招募、排除1人的依据；纳入17人这一数值保持不变，明确为18−1推导，并记录9人与先前论文重叠。
- [Bosco原文](https://www.jneurosci.org/content/28/46/12071)：保留刺激位置组均值及SD；SD不等同定位误差。补充材料的存在不证明已取得原始统计影像。
- [Martin正式论文§2.6](https://pmc.ncbi.nlm.nih.gov/articles/PMC10615837/)指向 [NV13064](https://neurovault.org/collections/13064/)。[逐图API](https://neurovault.org/api/images/787769/)称已阈值化，集合/论文称未阈值化；`thresholdState=conflicting`。T[29]/N30与无协变量模型相容，正式方法列age、age²、GMV、TIV；不能据此宣称正式模型复现或显著刺激效应。

[官方API文档](https://neurovault.org/api-docs/)当前仍列大写 `DOI` 和集合影像端点。实际Schaum请求返回100条不相关记录、count18055且有后页。这是**查找未完成/过滤完整性失败**，不是已验证无图。查询接口只在全部受限页完成、DOI及集合核对完成后返回候选；超预算、循环、网络错误或中止均拒绝，不提交部分候选。

Martin原图压缩文件SHA256为 `c311087c48b191237734ddff0d2949d2051530b30364ecc3fb86d83b1919d8b0`，251697bytes；[原始下载地址](https://neurovault.org/media/images/13064/FPM_WPM_active_sham.nii.gz)。`upstream-assets.json`、`source-facts/`保存出处、代码固定提交、版本时间戳、网格和冲突。源码包不含该影像、论文全文或完整代码缓存；离线检查验证事实记录的已固定字节，不重新证明未随包携带的原图。重新取得原图必须显式获取并比较上述长度/哈希，不能由检查命令隐式下载。

## 固定结果版本与独立交付

`publication-registry.json`只登记不可变内置快照。当前状态是本地准备完成，尚未公网部署；日期不是历史部署日期。`?result=<id>&version=<dataVersion>`固定到该快照，显式未知版本报错；省略version由后续X11路由跳转到固定版本。局部同ID修改、public标志及私有自由文本不能进入公开投影。

`published/2026-10-29.2.json`保留旧字节与摘要。`2026-10-30.1`增加Axelrod样本出处说明，原纳入数17未改变；旧记录的内容摘要不变。后续补充链在页面单独显示，不能改写旧记录的内容。

结果页中的“导出固定版本与勘误来源”生成 `public-result-export-v1`：所选固定结果、对应书目/实验/位置/claims/mappings/最小来源资产闭包、后续补充条目、各端点的固定结果与闭包、原快照SHA256身份引用。`validatePublicResultExport`独立检查内容摘要、来源摘录/记录摘要、E2/E5图闭包和勘误端点，不读取内置目录或网络。unsigned导出文件只能证明内部一致性；快照SHA256引用不冒充未包含的整个源快照已重新验字节，也不认证发布者或科学结论。

普通“证据包”仍是可编辑证据图，由E5负责；不宣称携带完整发布/勘误历史。公开版本导出使用独立入口，避免导入/合并时悄悄丢失发布来源。

## 验收状态

可在源码包离线运行 `node --test src/lib/statmap-source.test.mjs src/lib/result-publication.test.mjs`、`node scripts/evidence-audit.mjs --offline` 和 `node scripts/literature_validate.mjs`；发布清单、来源事实摘要均随包携带。没有人类审阅者、日期、范围或结论：`reviewer=null`、`date=null`、`scope=null`、`status=pending`。没有专家认证。本轮未运行桌面浏览器操作；新增页面、下载按钮、窄屏/缩放与路由真实交互均未验收。X11路由和G1实际发布另外负责。

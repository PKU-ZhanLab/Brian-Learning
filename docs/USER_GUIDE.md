# NeuroAtlas 使用指南 / User Guide

[中文](#中文) · [English](#english) · [在线入口](https://pku-zhanlab.github.io/Brian-Learning/)

本文对应 v4 研究工作流；在线部署版本以页面标识为准。

## 中文

### 在结构、切片和图谱之间定位

用右上角 **中文 / EN** 切换界面和内容。点击三维模型或左侧目录选择结构；也可搜索中英文名称、功能、疾病或 BA 编号。按 `/` 聚焦搜索。

左键拖动旋转，滚轮缩放，右键拖动平移；Shift + 点击可多选。眼睛按钮控制显隐，工具栏提供重置、定位和框选。“常用视图”可切换皮层、深部结构、脑干与小脑等观察范围。

知识卡区分解剖、生理、认知和临床关联。“依据与适用范围”列出来源、研究对象和解释限制。目录中的 150 个宏观结构是知识索引，不等同于任一图谱的全部标签；缺少几何数据的条目仍可阅读知识内容。

**切片工作台** 提供三正交 MRI。拖动滑块或点击切片移动交点；开启三维切片平面后，可按住 Alt 拖动切面。切片采用放射学显示，以 R/L/A/P/S/I 标记辨认方向。

**图谱分区** 读取所选体积实际包含的全部非零标签：

- 点击标签名称单独显示，勾选可组合显示；搜索后点击“显示筛选结果”显示匹配标签。
- 点击三维分区查看标签、原始体素数、体积和质心。质心是几何统计，不是论文激活坐标。
- 单选分区使用原始体素边界。多区概览可能抽样显示；若小区被抽样漏掉，按提示单独选择。
- 原生空间图谱和未确认配准的导入影像使用独立视图；符合当前参考空间条件的标签可“送入 ROI 对比”。

脑内主参考为 FSL MNI152NLin6Asym。DK68 使用同源重建的曲面、体素和顶点标签；HCP1065 通路使用本项目估计的模板变换。流线是群体弥散 MRI 的估计，不是单根轴突。

AAL116 与 AAL3 的原生标签、项目估计配准到 FSL 的衍生标签分开标识。选择时查看来源、空间和变换说明；配准衍生数据不是原作者直接发布的 FSL 版本。详见 [AAL 接入说明](AAL_INTEGRATION.md)。

### 从脑区阅读论文结果

选中结构后点击 **按脑区查文献**，或直接进入 **文献工作台**。取消“仅当前脑区”可检索整个库；关键词、主题与模态筛选同时生效。

现有 118 篇来源覆盖 21 个主题和 18 类方法，包括 fMRI、MEG、EEG、颅内记录和单细胞记录。精选库不代表穷尽性综述。勾选 **仅显示含结构化结果的论文**，可查看当前 3 篇原始研究中的 4 条结果和 8 个表格坐标。

打开论文后，宏观脑区标签可定位对应结构。结构化结果分别列出任务与对比、样本、ROI 定义、效应方向、限制、原文来源与整理者。**查看论文结果坐标**保留峰值、ROI 均值或刺激靶点等不同含义。当前八个坐标的 MNI 模板变体未明确，因此在独立坐标视图查看，不推断其与主模板的精确对应。

在论文卡片或详情中加入比较，可并列查看最多三篇论文。比较表保留任务、样本、模态、ROI 定义和未提取字段；不能用论文数量替代证据判断。比较页可手工标注两条结果的一致、不同、互补或不可直接比较关系，并填写理由、标注者和来源。

### 添加论文、结果与图片

1. 在 **在线查找 DOI / 标题并导入元数据** 中输入查询，选择 Crossref 或 Europe PMC。网络失败可切换来源，或使用 **添加论文** 手工录入。
2. 元数据导入只创建书目记录，不创建结论、脑区关联或坐标。打开论文后选择 **添加研究结果**，填写任务、样本、方法和原始来源。
3. 手工添加脑区关联。坐标需填写数值、空间、原文表 / 段、行与定位限制。仅报告“MNI”时选 `MNI-unspecified`。
4. 结果图可填写原文页、外部图片地址、图注、许可与署名。点击图像使用手工脑区关联，不从图像像素推断坐标；图像载入失败时仍可打开原文链接。
5. 完成原文核对后再选择“已对照来源”。编辑结论或坐标后会恢复为待核对。书目核对、结果核对和研究质量分别判断；AI 辅助整理不等于人工认证。

**导出证据 JSON** 可备份整个结构化结果库；**导出本篇结构化证据**仅包含当前论文与其结果。导入先校验再按 ID 更新，DOI 相同的论文合并。BibTeX 导出所选比较论文，未选择时导出筛选结果。完整字段说明和可导入示例见[结果整理流程](RESULTS_WORKFLOW.md)。

### 导入影像与比较 ROI

进入 **ROI 对比 → 导入本地 NIfTI**。支持单个三维 NIfTI-1 `.nii` / `.nii.gz`：整数标签、0/1 掩膜、0–1 概率图或统计图；可另附 CSV / JSON 标签名。单文件上限 128 MiB、6400 万体素；四维数据需先提取单个三维图。文件在浏览器中读取，不上传。

填写确切空间和来源。有效 sform / qform 只说明文件的坐标映射，不能证明与 FSL MNI152NLin6Asym 模板配准一致。两者不一致时界面提示并使用 sform。

- **空间未确认**：导入后选择 **查看原生影像**，进入独立图谱查看器，可查看标签、掩膜或阈值后的连续图。与主模板的重叠计算保持禁用。
- **已对齐主模板**：填写处理步骤 / 变换等依据，并明确确认后方可参与比较；界面保留“用户声明，未独立验证”的状态。

比较步骤：

1. 为 A、B 选择可比较数据。标签图可以多选构成并集；统计图设置阈值和正值 / 负值 / 绝对值方向，概率图设置 0–1 阈值。
2. 点击 **计算重叠**。共同网格为当前 2 mm 脑模板；标签和掩膜最近邻采样，连续图三线性采样后阈值化。没有估计新的解剖配准。
3. 查看 A、B、交集、独占部分、并集的体素数、体积、双向覆盖率、Dice 和 Jaccard。若两份输入都是概率图，还报告完整概率权重的 Fuzzy Dice / Jaccard，独立于二值阈值。
4. 调整 A、B 和交集的不透明度，切换显示范围；用“穿透查看”和三正交切片核对内部重叠。较大的表面可能因显示上限而省略，数值指标、切片与掩膜导出仍可用。
5. 导出指标 CSV，或导出 A、B、交集、并集的 NIfTI 掩膜。更换数据、标签或阈值后重新计算。

Dice = 2 × 交集 / (A + B)，Jaccard = 交集 / 并集。空间重叠不等于功能相同；概率权重重叠也不是独立事件的联合概率。

### 保存与分享

无需账号。**项目与视图** 提供以下方式：

| 方式 | 保存内容 | 跨设备使用 |
| --- | --- | --- |
| 命名视图 | 相机、显示、切片、ROI 和工作区设置；本浏览器最多 30 个 | 自定义影像仍需项目文件 |
| 完整项目文件 | 当前视图、批注、本地证据和导入影像的可恢复数据 | 将项目文件交给对方并“打开项目文件” |
| 视图链接 | 公开数据的相机、显隐、透明度、切片、ROI 与公共筛选设置 | 对方需能访问相同公开数据；不包含批注、自由检索词、本地论文内容或影像文件 |
| 证据 JSON | 论文元数据、结构化结果及关系 | 导入时校验并合并 |

打开项目文件会恢复其中视图，并用文件中的批注和本地证据替换当前内容；切换前可先导出当前项目。浏览器存储按浏览器与网站地址隔离，清理浏览器数据会删除本地记录。导入影像仅在当前会话中可用，离开前导出项目以便恢复。图片视图可另存 PNG。

## English

### Navigate structures, slices, and atlas parcels

Use **中文 / EN** to switch language. Select structures in the 3D model or catalog, or search names, functions, conditions, or BA IDs. Press `/` to focus search. Left-drag rotates, scrolling zooms, right-drag pans, and Shift + click adds a selection. Visibility controls, focus, reset, box selection, and common views support exploration.

Structure cards separate anatomy, physiology, cognition, and clinical associations. **Evidence and scope** records sources, populations, and interpretation limits. The 150 macroscopic catalog entries are a knowledge index, distinct from the labels in any particular atlas.

**Slices** provides three orthogonal MRI views. Move the crosshair with sliders or slice clicks. With 3D slice planes enabled, Alt-drag moves a plane. Read the R/L/A/P/S/I orientation markers; slices use radiological display convention.

**Atlas label explorer** reads every nonzero label present in the selected volume. Click a label name to isolate it, check multiple labels to combine them, or show search matches. The detail panel reports source voxel counts, volume, and geometric centroid; a centroid is not a published activation coordinate. Single parcels use source voxel boundaries. Overviews may be sampled, with warnings for omitted small labels; isolate a small label to inspect it fully.

Native atlases and images without confirmed alignment appear in an independent viewer. Eligible labels can be sent to **ROI comparison**. The main brain reference is FSL MNI152NLin6Asym. DK68 surfaces and labels use a matched reconstruction; HCP1065 pathways use a transform estimated in this project. Native AAL / AAL3 and estimated FSL derivatives are separate datasets; consult their source and transform notes in [AAL integration](AAL_INTEGRATION.md).

### Move between regions and findings

Select **Explore papers for this region**, or open **Evidence library**. Clear **Current region only** to search the complete collection. Keyword, topic, and modality filters combine. The 118 sources span 21 topics and 18 method categories; the collection is not exhaustive.

Select **Only papers with structured findings** to see the current 4 findings and 8 table coordinates from 3 primary papers. Finding cards preserve tasks, samples, ROI definitions, effect direction, limitations, sources, and annotators. Coordinate meanings distinguish statistical peaks, ROI means, and stimulation targets. The eight initial coordinates report MNI without an established template variant, so they use an independent coordinate view rather than a precise placement on the main anatomy.

Compare up to three papers using the matrix. Missing extractions remain unavailable. An explicit relation between two findings can record agreement, disagreement, complementary evidence, or noncomparability, together with conditions, rationale, annotator, and source. Relations do not constitute an automatic meta-analysis.

### Add papers, findings, and figures

Use **Look up DOI / title and import metadata** with Crossref or Europe PMC, or **Add paper** for manual entry. Metadata import never creates a conclusion, region link, or coordinate. Open a paper and choose **Add finding** to record the experimental conditions and evidence.

Coordinates require values in millimetres, frame, original table or paragraph, row, source URL, and localization notes. Choose `MNI-unspecified` for an unqualified MNI report. Figures can use a source page and optional external image URL with caption, attribution, and license. Figure clicks follow manual region links, not inferred pixel coordinates; failed images retain source links.

Select **Source-checked** only after comparing the record with its source. Editing findings or coordinates resets their curation status. Metadata checks, source checks, and study quality remain distinct; AI-assisted source extraction is not human certification.

Export evidence JSON for the full structured library or the current paper. Imports validate before merging matching IDs and DOI records. BibTeX exports comparison selections or, if none are selected, the filtered papers. See the [finding workflow and importable example](RESULTS_WORKFLOW.md).

### Import images and compare ROIs

Open **ROI comparison → Import local NIfTI**. Supported inputs are single 3D NIfTI-1 `.nii` / `.nii.gz` label maps, 0/1 masks, 0–1 probability maps, or statistical maps, optionally with CSV / JSON label names. Limits are 128 MiB and 64 million voxels per file. Extract one 3D map from 4D data first. Files are read locally in the browser.

Provide the exact reference space and provenance. An affine, sform, qform, or generic “MNI” name alone cannot establish alignment with FSL MNI152NLin6Asym. A conflicting sform / qform is flagged, and sform is used.

Images with unverified alignment can be opened with **View native volume** for independent label, mask, or thresholded-map inspection. Comparison with the main template remains disabled. Already aligned images require an explicit declaration and processing / transform evidence; their status remains user-declared, not independently verified.

Choose datasets A and B, label unions or continuous-map thresholds, and a positive / negative / absolute tail where applicable. **Compute overlap** samples a shared 2 mm template grid: nearest-neighbor for labels and masks, trilinear followed by thresholding for continuous maps. It does not estimate anatomical registration.

Inspect counts, volumes, coverage, Dice, and Jaccard for A, B, intersection, exclusive parts, and union. Two probability maps additionally receive full probability-weight Fuzzy Dice / Jaccard metrics independent of binary thresholds. Use opacity, X-ray viewing, and orthogonal slices to inspect interior overlap. Oversized surfaces can be omitted while metrics, slices, and mask exports remain available.

Export metrics CSV or NIfTI masks for A, B, intersection, and union. Recompute after changing inputs, labels, or thresholds. Spatial overlap does not establish shared function; probability-weight overlap is not an event joint probability.

### Save and share

No account is required. **Projects & views** provides:

- **Named views:** up to 30 in this browser, retaining camera, display, slice, ROI, and workspace settings.
- **Project files:** view state, notes, local evidence, and recoverable imported volume data. Transfer the file to restore custom images on another device.
- **View links:** camera, visibility, opacity, slices, ROI, and public filters for public data. Notes, free-text queries, local paper content, and image files are excluded.
- **Evidence JSON:** portable paper, finding, and relation records that validate and merge on import.

Opening a project restores its view and replaces the current notes and local evidence with the file's contents; export the current project first if needed. Browser storage is separate for each browser and site address and is lost when that data is cleared. Imported images are available in the current session; export a project before leaving to restore them later. Views can also be saved as PNG.

## 数据来源与许可 / Sources and licenses

各数据资产保留其上游许可、署名和修改记录；部分数据受非商业使用条件约束。 / Assets retain their upstream licenses, attribution, and modification records; some have noncommercial-use conditions.

[数据许可 / Data notice](../public/data/licenses/NOTICE-DATA.md) · [空间说明 / Spatial alignment](SPACE_ALIGNMENT.md) · [AAL / AAL3](AAL_INTEGRATION.md) · [结果整理 / Findings](RESULTS_WORKFLOW.md) · [逐区证据 / Regional evidence](EVIDENCE_COVERAGE.md)


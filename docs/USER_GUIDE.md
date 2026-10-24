# NeuroAtlas 使用指南 / User Guide

[中文说明](#中文) · [English](#english) · [在线地址 / Online address](https://pku-zhanlab.github.io/Brian-Learning/)

## 中文

### 选择结构与切换语言

右上角 **中文 / EN** 同时切换界面、知识卡和文献解读。点击三维模型或左侧目录选择结构，也可搜索中英文名称、功能、疾病或 BA 编号；按 `/` 聚焦搜索。

左键拖动旋转，滚轮缩放，右键拖动平移。Shift + 点击可多选；眼睛按钮控制显隐，工具栏提供重置、定位与框选。教学预设可切换脑、脑干及全中枢概览。

知识卡分别展示解剖、生理、认知与临床关联。展开每项“依据与适用范围”，查看支撑文献、研究对象和解释限制。临床扩展默认关闭；未覆盖结构保留知识条目，教学示意需手动开启。

### 在脑区与文献之间往返

选中结构后点击 **按脑区查文献**。在 **文献工作台** 中取消“仅当前脑区”，可检索整个库；主题、方法和关键词筛选同时生效。现有 115 篇来源覆盖 21 个主题和 18 类方法，包括 fMRI、MEG、EEG、颅内记录和单细胞记录。

打开论文查看结果、样本、研究设计及定位依据，点击区域标签定位三维结构。最多选择三篇并列阅读，先比较任务、物种、样本、方法和 ROI 定义，再解释结果异同。库内三组研究讨论提供进一步对照；这是入门精选库，不是穷尽性综述。

六个已核验原文图链接直接打开出版来源，并附简短释义。图链接不表示网站转载了图片。论文关联高亮表示阅读关联；未给出已核验空间坐标的论文不会显示为精确激活点。

可导出所选或当前筛选文献的 BibTeX、单篇证据 JSON，以及参考文献总目录的 GB/T 7714 文本。

### 比较 ROI 的实际重叠

1. 打开 **ROI 对比**，分别为 A、B 选择允许比较的图谱及区域标签。
2. 点击 **计算重叠**。计算使用实际标签掩模，在共同的 2 mm 脑模板网格上按已有仿射最近邻采样。
3. 查看 A 全部、B 全部、交集、仅 A、仅 B、并集的体素数和体积，以及双向覆盖率。
4. 在“三部分”“只看交集”“A 全部”“B 全部”之间切换；分别调整 A、B、交集的不透明度。内部区域被遮挡时，降低皮层不透明度或使用“穿透查看”，再用三正交切片核对。
5. 点击 **导出指标 CSV** 保存指标、标签、网格与来源信息。更换图谱或标签后需重新计算。

**Dice = 2 × 交集 / (A + B)**；**Jaccard = 交集 / 并集**。同一互斥图谱的不同标签通常没有交集。最大概率标签按二值掩模比较，其重叠不等于概率分布重叠，也不证明功能相同。重采样不进行新的解剖配准；当前不提供任意 NIfTI 导入。

### 切片、脑与脊髓空间

“切片工作台”展示三正交 MRI。拖动滑块或点击切片移动交点；开启三维切片平面后，可按住 Alt 拖动切面。切片采用放射学显示，以 R/L/A/P/S/I 标记辨认方向。

脑内主参考为 FSL MNI152NLin6Asym。DK68 的曲面、体素与顶点标签来自同源重建；31 个 HCP1065 通路 / 颅神经条目经过本项目估计的模板变换。流线是群体弥散 MRI 估计，不是单根轴突或个体临床定位。

公开版脊髓按需从固定版本的官方 GitHub 源加载 PAM50，由浏览器 Worker 生成 0.5 mm 体素边界表面；网站不镜像源数据。首次加载需要网络。PAM50 保持独立直化参考，脑切片不随其坐标联动。它不表示正常脊髓曲率，节段不能等同于同名椎骨；全中枢概览不构成联合配准的人体模板。

公开版的 AAL、AAL3 和旧版 BA 仅提供目录与来源说明，体积叠加与 ROI 比较停用。各结构的“几何来源”和“数据说明”列出实际覆盖、未覆盖部分与空间状态。

### 保存与分享

批注保存在当前浏览器，导出 JSON 可备份或转移。导出视图生成 PNG；测验提供结构名称与功能题。分享链接保存语言、图谱、所选结构和工作区模式，不保存相机位姿、ROI 选择或批注。

## English

### Select structures and switch language

Use **中文 / EN** to switch the interface, structure cards, and literature explanations together. Select a structure in the model or left catalog, or search Chinese/English names, functions, conditions, or BA numbers. Press `/` to focus search.

Drag with the left mouse button to rotate, scroll to zoom, and drag with the right button to pan. Shift + click selects multiple structures. Eye buttons control visibility; the toolbar provides reset, focus, and box selection. Teaching presets switch among brain, brainstem, and CNS overview displays.

Structure cards separate anatomy, physiology, cognition, and clinical associations. Expand **Evidence and scope** for sources, study populations, and interpretation limits. Clinical extensions are off by default. Uncovered structures retain knowledge entries; teaching schematics must be enabled explicitly.

### Move between regions and papers

Select a structure and choose **Explore papers for this region**. In the **Evidence library**, clear **Current region only** to search the full collection. Topic, modality, and keyword filters combine. The 115 sources cover 21 topics and 18 method categories, including fMRI, MEG, EEG, intracranial recording, and single-cell recording.

Open a paper for findings, samples, study design, and localization basis. Click a region tag to locate its structure in 3D. Compare up to three papers, first checking tasks, species, samples, methods, and ROI definitions. Three curated debates support further comparison. This is an introductory collection, not an exhaustive review.

Six verified figure links open the original publication and include brief explanations. Figures are linked, not reproduced. Highlighted structures indicate reading associations; papers without verified spatial coordinates are not plotted as exact activations.

Export selected or filtered papers as BibTeX, an individual evidence record as JSON, or the reference catalog as GB/T 7714 text.

### Compare actual ROI overlap

1. Open **ROI comparison** and select an eligible atlas and region label for A and B.
2. Choose **Compute overlap**. Actual label masks are sampled on the shared 2 mm brain-template grid using their existing affines and nearest-neighbor sampling.
3. Inspect voxel counts and volumes for all of A, all of B, intersection, A only, B only, and union, together with both coverage percentages.
4. Switch among **Three parts**, **Intersection only**, **All of A**, and **All of B**. Adjust A, B, and intersection opacity separately. For hidden internal regions, lower cortex opacity or enable **X-ray view**, then check the linked orthogonal slices.
5. Choose **Export metrics CSV** to save metrics, labels, grid, and provenance. Changing the atlas or label requires a new calculation.

**Dice = 2 × intersection / (A + B)**; **Jaccard = intersection / union**. Different labels in one exclusive parcellation usually do not intersect. Maximum-probability labels are compared as binary masks; their overlap is not overlap of probability distributions or proof of shared function. Resampling does not estimate new anatomical registration. Arbitrary NIfTI import is not provided.

### Slices, brain space, and spinal space

The **Slices** workspace shows three orthogonal MRI views. Move their intersection with sliders or by clicking a slice. With 3D slice planes enabled, hold Alt while dragging a plane to move it. Slices follow radiological convention; use the R/L/A/P/S/I markers for orientation.

The main brain reference is FSL MNI152NLin6Asym. DK68 surfaces, voxels, and vertex labels come from a matched reconstruction. The 31 HCP1065 pathway / cranial-nerve entries use a template transform estimated in this project. Streamlines are population diffusion-MRI estimates, not individual axons or clinical localization.

The public app loads PAM50 on demand from a pinned official GitHub source. A browser Worker generates boundary surfaces from 0.5 mm voxels; the site does not mirror the source data. Initial loading requires network access. PAM50 retains an independent straightened reference, and brain slices do not track its coordinates. It does not represent normal cord curvature; neurological segments are not same-named vertebrae. The CNS overview is not a jointly registered human template.

AAL, AAL3, and legacy BA provide catalog and provenance metadata only in the public package; volume overlays and ROI comparison are disabled. **Geometry source** and the data panel describe actual coverage, gaps, and spatial status.

### Save and share

Notes stay in the current browser; export JSON for backup or transfer. Export views as PNG, or use the name/function quizzes for teaching. Share links preserve language, atlas, selected structure, and workspace mode. They do not preserve camera pose, ROI selections, or notes.

## 范围与许可 / Scope and licenses

本教学包按非商业用途组织；第三方数据按各自上游条款使用。题录核验、空间指标和教学说明不等于全文审定或临床认证。

This package is assembled for noncommercial teaching; each third-party dataset retains its upstream terms. Bibliographic checks, spatial metrics, and teaching descriptions do not constitute full-text review or clinical certification.

[数据许可 / Data notice](../public/data/licenses/NOTICE-DATA.md) · [数据来源 / Data sources](DATA_SOURCES.md) · [空间说明 / Spatial alignment](SPACE_ALIGNMENT.md) · [文献范围 / Literature scope](LITERATURE_RESEARCH.md) · [逐区证据 / Regional evidence](EVIDENCE_COVERAGE.md)


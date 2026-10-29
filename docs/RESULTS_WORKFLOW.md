# 结果与证据 / Results and evidence · 4.2.0

按脑区、双语功能别名、论文方法或已记录结果模态检索。论文方法筛选与结果模态分别表达；论文数、发现数、坐标数和匹配数使用各自分母。比较篮最多三篇；返回研究历史时恢复筛选、阅读、比较和滚动位置。

Search by region, bilingual functional aliases, paper methods or recorded result modality. Paper methods and result modalities are distinct filters. The comparison basket holds at most three papers; return through research history to preserve context.

结果记录保存实验边界、对比、样本层次、统计/校正、位置、来源与审阅事件。未知、未摘录和已报告值不混为一类。直接测量、背景关联、原研究物种与当前人体目标的支持分别显示；背景定位必须主动选择。结果层可隐藏、移除、返回原论文/结果；换论文不会暗改旧层来源。

A result retains experiment/contrast, sample levels, statistics/correction, locations, sources and review events. Missing values are explicit. Direct measurement, contextual links, species and laterality remain separate. Use a layer's source action to return to its recorded result.

单篇或筛选集的证据 JSON 包含书目、reading、claims、映射、结果、坐标、来源最小摘录/哈希及限制，可脱离内置库解释。项目还保存本地编辑、草稿、资产与视图。CSV/NIfTI 用于数值/掩膜，PNG 用于展示，BibTeX 用于引用；这些都不能单独恢复完整项目。私有笔记、影像和自由文本不进入公开链接。

Export one paper or a filtered set as a standalone evidence JSON with bibliography, readings, claims, mappings, results, coordinates, minimal source cells/hashes and limitations. CSV, NIfTI, PNG and BibTeX serve narrower purposes; use a project to restore the entire study. Public views omit private content.

固定结果地址携带 result 与 version；省略版本可跳到明确的最新地址，显式未知/空版本显示不可获取。静态 results/ 目录有中英文页面，包含引用、内容摘要、来源版本与补充勘误；旧快照保持不变。应用版本 4.2.0 与证据 dataVersion（如 2026-10-30.1）是不同身份。

Fixed result addresses retain result and version. An omitted version may redirect to an explicit latest version; an unknown or empty explicit version is unavailable. Static bilingual result pages carry citations, content hashes, source versions and additive corrections. Application and evidence versions are separate.

当前专题保留八个 MNI-unspecified 论文坐标，不能直接叠加为已配准结果。Martin 上传图的确切模板/代码字节绑定仍未解决；Schaum 原始图的再分发范围未确定，二者原始图均未擅自打包。AI 来源核对不是人工认证。见[专题验收](evidence-case-acceptance.md)、[量化方法决定](evidence-quantification-evaluation.md)、[当前矩阵](acceptance/STATUS.md)。

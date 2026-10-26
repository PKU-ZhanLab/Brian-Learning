# 论文结果与脑区工作流

文献工作台按主题、模态和脑区检索论文。勾选“仅显示含结构化结果的论文”，可直接查看带任务、样本、ROI 定义和来源坐标的记录。精选库是可扩展的起点，不代表穷尽性综述。

## 添加与编辑

1. 在“在线查找 DOI / 标题并导入元数据”输入 DOI 或标题，选择 Crossref 或 Europe PMC。只有查询词发给所选公共服务。网络失败时可切换来源或使用“添加论文”。
2. 导入后的论文只有书目信息，不会自动获得研究结论、脑区关联或坐标。
3. 打开论文，选择“添加研究结果”。填写结论、任务与对比、样本、模态、ROI 定义、效应方向、解释限制、原文来源和整理者。
4. 添加手工脑区关联。脑区标签用于阅读导航，不等于精确的实验定位。
5. 只有确实逐项核对过来源的记录才标记为“已对照来源”。这是整理状态，不是研究质量评级，也不自动代表人工认证。修改内容后会恢复为待核对。

## 坐标与结果图

每个坐标记录数值（毫米）、含义、原文表格或段落、具体行、来源链接、坐标空间和定位限制。峰值、ROI 均值、刺激靶点和电极位置分别记录。

原文只写 MNI 时，选 `MNI-unspecified`。不要根据“MNI”推断成 `MNI152NLin6Asym`；Talairach、个体原生空间也不能直接替换图谱空间。没有可靠变换时使用独立坐标视图。未核对坐标不会成为已核对的结果点。

结果图保存原文页面链接、可选的外部图片链接、许可、署名与图注。图片点击使用整理者手工指定的脑区关联，不从像素推断实验坐标。外部图片载入失败时保留原文图链接。库不下载或托管出版方图像；许可不明确时仅放原文链接。

## 比较研究

在论文卡片点击比较图标，可并列查看最多三篇论文的任务、样本、模态、ROI 定义、效应方向、结果、整理依据与限制。尚未提取的字段显示为空缺，不自动补写。

比较页可添加两条具体结果之间的“一致 / 不同 / 互补 / 不可直接比较”关系。填写可比较条件、理由、标注者和来源。它记录整理者的判断，不是自动生成的元分析或论文票数共识。

## 本地保存、迁移和共享

保存使用当前浏览器的本地存储，无账号。不同浏览器或网站地址的存储相互独立；清除浏览器数据会删除本地修改。

“导出证据 JSON”包含内置结构化结果及本地论文、结果、关系；“导出本篇结构化证据”只包含当前论文及其结果，关系仅在两个端点均被包含时导出。BibTeX 导出所选比较论文，未选择时导出筛选结果。

“导入 JSON”先校验再合并：同一记录 ID 更新，DOI 相同的论文合并到已有 ID，并修正结果引用。无效文件不写入本地存储。导入已有 ID 前可先导出备份。

## 文件格式

```json
{
  "schema": "brain-evidence-v1",
  "references": [],
  "results": [],
  "relations": []
}
```

`references` 使用 `id, title, authors, year, journal, doi, url` 等书目字段。`results` 必须有 `id, referenceId, finding, condition, sample, modalities, roiDefinition, direction, regionIds, sourceUrl, curationStatus, annotator, coordinates, figures`；已核对结果还需 `curationNote`。正文文本可为字符串或 `{ "zh": "…", "en": "…" }`。

`coordinates` 每项包含 `id, label, x, y, z, space, kind, sourceTable, sourceRow, sourceUrl, status, frameNote`。`figures` 每项包含 `url, sourceUrl, caption, license, regionIds` 和可选 `imageUrl`。`relations` 每项包含 `id, fromResultId, toResultId, type, rationale, annotator, sourceUrl`。

完整可导入示例为 [curated-results.json](../data-sources/results/curated-results.json)。校验函数不提升整理状态；草稿保持草稿。保存和合并遇到无效数据时抛出具体错误，读取本地损坏数据时返回 `storageError` 并保留原文件内容。

## 内置结果来源

当前纳入三篇原始研究、四条结构化结果和八个表格坐标，覆盖 MEG、fMRI、TMS 及行为测量。全部坐标保留 `MNI-unspecified`。书目字段已对照 Crossref 与 Europe PMC；坐标、样本及解释范围以开放原文为依据，由 AI 辅助整理。

- [Schaum 等，2021，表 1](https://elifesciences.org/articles/61679#table1)：四个 MEG beta 源功率峰值。
- [Axelrod 与 Yovel，2015，表 1](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0117126#pone.0117126.t001)：左右 FFA 的平均 ROI 位置；左右结果分别保留多重比较结论。
- [Bosco 等，2008，表 1](https://www.jneurosci.org/content/28/46/12071#T1)：协议 1 的右 TPJ 和 hMT/V5+ 平均刺激位置。

字段级摘录与元数据文件哈希见 [source-audit.json](../data-sources/results/source-audit.json)。公开接口可能发生停机、限流或跨域策略变动；手工编辑和 JSON 迁移不依赖在线服务。

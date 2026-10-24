# BA 数据与覆盖

主脑参考为 FSL MNI152NLin6Asym。BA 不按 DK 脑回边界推算；保留两套不同证据来源。

| 数据 | 实际覆盖 | 空间与含义 |
| --- | --- | --- |
| FSL Talairach BA | 42 个历史编号 | FSL 已用 Lancaster 2007 校正仿射将数字化 Talairach 标签映射到 MNI152。原始粗切片与单脑局限仍存在。 |
| FSL Jülich 组织学子集 | BA1、2、3、4、6、17、18、44、45；22 个双侧亚区 | 25% 阈值的最大概率图，保留 3a/3b、4a/4p 与左右。另保留获胜标签的原始概率。旧版数据的精确 MNI152 变体未独立确认。 |
| BrainNet 旧版 BA | 原有 41 个编号 | 保留作历史对照，未确认模板变体，不能作为已对齐数据。 |

FSL 历史数据中无 BA12、14、15、16、26、48、49、50、51、52。旧版 BrainNet 含部分其他历史编号，不将其拼接进 FSL 图谱。某些编号的物种、历史定义不同，界面不制造缺失边界。完整逐编号覆盖见 `public/data/ba-v2/manifest.json`。

`scripts/ba_build.py` 只进行 RAS 重排和标签提取，未重复应用 FSL 已执行的配准。Talairach 的 Label XML 含背景 0，按原值查询；Jülich 的 maxprob 编号为 XML index + 1。构建时校验左右、非空标签、概率阈值和体素编号。原始文件、SHA-256、下载地址保存在 `data-sources/ba/source-manifest.json`。

来源：[FSL 图谱与映射说明](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html)、[Jülich 各区原始研究](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/julich.html)、[FSL 许可证](https://fsl.fmrib.ox.ac.uk/fsl/docs/license.html)。下载自 MGH 提供的 FSL 5.0.1 原始分发镜像。适用原始图谱条款；原始来源与作者署名随数据保留。

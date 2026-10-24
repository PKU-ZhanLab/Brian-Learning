# 脑区与研究文献

文献库包含 **115 篇来源、21 个主题、18 类方法和 512 个脑区阅读关联**。188 个解剖结构都可反查阅读资料；反向也可从论文找到关联区域。115 篇包括原有105篇及新增10篇面孔、物体识别与多模态研究。题录核验日期为 **2026-10-25**。

每篇提供中英文结果摘要、研究设计、样本说明、方法分类和解释限制。可按主题、fMRI、MEG、EEG、颅内记录、单细胞记录等筛选，也可比较同一脑区的不同研究。综述仍标为综述，讨论某种方法不等于该综述新采集了该类数据。

## 位置与证据的含义

三维高亮表示**区域阅读关联**。功能ROI、DK脑回、Brodmann区、病灶范围和动物记录部位不能直接画等号。本次没有加入可在当前模板直接使用的已核验激活坐标，因此没有用脑区中心或头皮电极位置伪装研究坐标。

跨物种、背景阅读及侧化限制保留在单篇记录中。例如 Tsao 2006 来自猕猴面孔斑块；Bentin 1996 是头皮ERP；Parvizi 2012 的直接刺激记录仅关联右梭状回。解剖图谱来源不作为整个标签功能的证明，文献关联也不代表临床诊断。

## 研究差异

库内整理三组可对照阅读的经典问题：

- **面孔选择性与视觉专长**：比较局部面孔偏好、Greeble训练、汽车/鸟类专长。刺激与任务不同，非面孔专长效应不自动消除面孔选择性。
- **局部选择性与分布式表征**：比较平均fMRI反应、分布式模式、猕猴单细胞及单例刺激。它们涉及不同尺度和推论，并非简单互相否定。
- **前扣带的冲突监控与控制价值**：比较计算解释及功能组织框架；判断理论需要检验预测，不能由一个激活点决定。

这些条目是有明确来源的入门阅读集，不是覆盖所有研究的系统综述；目前新增MEG、EEG、颅内及单细胞原始研究主要集中在视觉与面孔主题。

## 原文图

目前核验了下列6个独立图链接。页面显示原文入口及简短中英文释义，未转载图片。论文开放阅读不自动等于图片可任意再分发。

| 来源 | 图 | 用途 | 原文许可 |
|---|---|---|---|
| Cichy 2014 | [Figure 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC4261693/#F1) | MEG解码流程与时间信息 | Nature作者稿条款，仅链接 |
| Cichy 2014 | [Figure 4](https://pmc.ncbi.nlm.nih.gov/articles/PMC4261693/#F4) | MEG与V1/IT的fMRI表征比较 | Nature作者稿条款，仅链接 |
| Herbet 2018 | [Figure 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC6156142/#F2) | 下纵束候选功能通路示意 | CC BY 4.0 |
| Romano 2019 | [Figure 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC6420596/#Fig1) | 颅神经脑池段MRI | CC BY 4.0 |
| Romano 2019 | [Figure 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC6420596/#Fig3) | 颅神经核群组织 | CC BY 4.0 |
| Seghier 2013 | [Figure 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC4107834/#fig2-1073858412440596) | 角回白质联系概览 | CC BY 3.0 |

## 来源与维护

新增题录先查询 Crossref DOI，再与 Europe PMC 的 PubMed记录核对。保留来源URL、获取时间、原始响应及SHA-256。作者表存在跨来源差异时保留说明；例如 Parvizi 2012 的完整作者表采用出版社/Crossref 的7名作者。题录核验不等于逐篇全文审定或人工临床认证。

数据在 `src/data/literature.js`；人工整理的中英注释和研究对照在 `data-sources/literature-upgrade/`。仅用于图核验的完整论文XML不纳入公开仓库。图标识、许可及源文件哈希保存在 `figure-audit.json`。

```text
node scripts/literature_fetch.mjs       # 联网补充或恢复原始元数据及本地图核验材料
node scripts/literature_build.mjs       # 从已核验记录与整理注释生成文献库
node scripts/literature_validate.mjs    # 离线检查链接关系、双语字段、方法与来源哈希
```

English interface fields are supplied for all 115 records. Region links are curated reading associations, not extracted activation coordinates. Coverage is an introductory collection rather than a systematic review; figure links lead to the original source, with redistribution disabled.

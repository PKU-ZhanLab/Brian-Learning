# 解剖几何与来源

本地交互模型使用原始图谱导出的曲面和群体扩散流线。完整逐结构来源、坐标、覆盖范围与 SHA-256 见 `public/data/anatomy/manifest.json`；未接入真实几何的条目保留在目录中，示意层默认关闭。

| 来源 | 已接入 | 坐标与处理 |
| --- | --- | --- |
| [PAM50](https://github.com/spinalcordtoolbox/PAM50) | C1–C8、T1–T12、L1–L5、S1–S5；灰质、白质、双侧前角与后角，共 36 个曲面 | 原始 0.5 mm NIfTI 仿射转 RAS mm；概率阈值 0.5、轻度平滑及保拓扑减面。保留拉直脊髓模板长度，没有弯曲或拼接到脑干。 |
| [HCP1065 / Yeh 2022](https://brain.labsolver.org/hcp_trk_atlas.html) | 21 个大脑纤维束条目；II、III、V、VII、VIII 五对脑神经，共 31 个流线集合 | NiBabel 按 TRK 头转换原生 ICBM2009aAsym RAS mm；每条目最多 240 条流线，每条 40 个等弧长点。显示副本应用项目估计的 2009aAsym → NLin6Asym 配准；原生几何单独保留。 |

PAM50 固定来源版本为 `609a18235d9143dad0d6bf5bb35e2bff9e55196f`。脊髓节段边界来自图谱估计，不等同于每个人的神经根边界。源数据没有独立 Co1 或侧角分区；中间灰质没有改称侧角。灰质、白质及角区的尾端覆盖比新版整脊髓分割短，缺失部分未外推。PAM50 与当前 FSL 脑模板之间的联合配准尚未核验，界面分别标记参考空间。

HCP1065 是扩散追踪所得的群体路径估计，流线数不代表轴突数。CN II 源集合包含视交叉附近及近端视觉通路，不能解释为完整且独立的眶内视神经；皮质脊髓束仅覆盖脑模板，未声称延伸到全部脊髓。I、IV、VI、IX、X、XI、XII 对脑神经和独立脊髓丘脑束尚无已接入的真实几何。

显示用配准采用 DIPY 互信息仿射及 2 mm 对称微分同胚形变。图像、形变场与 283,000 个流线点的往返检查已运行；点误差中位数 0.008 mm，95 百分位 0.036 mm，最大值 0.266 mm。它是本项目估计的模板变换，不能替代个体神经位置、端点或亚毫米解剖验证。图像指标与场校验见 `public/data/space/hcp1065-registration.json`，点校验见 `public/data/anatomy/registered-point-validation.json`。

皮层采用同一 FSL MNI152 模板的 FreeSurfer 曲面及原始 DK 顶点注释。其他体积图谱按精确位置查询，无标签处保持中性颜色，不按最近脑回补标。HO 脑干使用真实整体外表面，其中脑、脑桥、延髓界线仍为教学分段；小脑左右侧是整体图谱表面的中线几何分侧。

## 再生成与核验

使用已准备好的 `mne` conda 环境；没有向默认环境安装包。原始下载、解压数据及下载收据位于 `data-sources/anatomy/`。按以下顺序运行；重新生成原生 HCP 清单后，需要再次执行变换步骤。

```powershell
conda run -n mne python scripts/anatomy_fetch.py inspect
conda run -n mne python scripts/anatomy_fetch.py pam
conda run -n mne python scripts/anatomy_fetch.py hcp
conda run -n mne python scripts/anatomy_build.py pam
conda run -n mne python scripts/anatomy_build.py hcp
# 使用已生成且通过检查的配准场，参见 scripts/space_register.py
conda run -n mne python scripts/anatomy_warp.py
node scripts/anatomy_validate.mjs
npm run build
```

核验脚本检查源文件与派生文件哈希、有限坐标、索引与计数、包围范围、脊髓节段顺序、角区左右侧、空间元数据和配准记录，结果写入 `public/data/anatomy/validation.json`。

## 引用与许可

- PAM50：De Leener et al. *NeuroImage* 2018;165:170–179，PMID 29061527；脊髓图谱另参见 Levy et al. *NeuroImage* 2015;119:262–271。独立 PAM50 仓库当前未提供单独 LICENSE 文件；SCT 软件的 LGPL-3.0 不能自动视为数据专用许可。这里保留来源和原始文件，公开再发布前需核实数据条款。
- HCP1065：Yeh FC. Population-based tract-to-region connectome of the human brain and its hierarchical topology. *Nature Communications* 2022;13:4933. [doi:10.1038/s41467-022-32595-4](https://doi.org/10.1038/s41467-022-32595-4)。图谱为 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，显示副本经抽样、重采样与模板形变，须保留署名、许可与修改说明，并遵守 [WU-Minn HCP 数据条款](https://www.humanconnectome.org/study/hcp-young-adult/document/wu-minn-hcp-consortium-open-access-data-use-terms)。

HCP 要求的致谢：

> Data were provided in part by the Human Connectome Project, WU-Minn Consortium (Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657) funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for Neuroscience Research; and by the McDonnell Center for Systems Neuroscience at Washington University.

## 公开版的 PAM50 加载方式

公开发布包排除 PAM50 源 NIfTI 和预计算曲面，保留来源描述。用户点击加载后，浏览器直接从官方固定版本下载相应文件，并在本地 Worker 中验证 SHA-256、解压 NIfTI、核对维度和 sform，生成临时曲面。节段使用一次源下载，灰质、白质和角区按需另取；网络或校验失败会显示不可用状态，不替换为真实外观的示意形状。

浏览器曲面使用源分辨率的体素单元边界，不平滑、不估计新配准，与本地预计算减面曲面的显示处理不同。节段文件的 NIfTI 空间单位字段为空；仅对这份固定哈希源，使用 PAM50 元数据中明确的毫米网格，并同时核对源仿射。其余组织文件的头部直接声明毫米单位。

数据许可与来源说明位于 `public/data/anatomy/licenses/`。这种官方源直取方式没有赋予新的数据许可，公开版不重托管 PAM50 源数据或派生曲面。

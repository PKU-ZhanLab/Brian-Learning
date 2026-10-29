# 当前空间边界 / Current space boundaries · 4.2.0

主模板为明确的 MNI152NLin6Asym；原生 Colin27 T1/标签独立。AAL/AAL3 估计配准资产保留原始/派生身份、变换链、离散标签及限制。共用脑形的表面投影用于显示，不能当作体积原始标签或配准精度。未知 MNI 变体保留 MNI-unspecified，重采样不冒充配准。

The main reference is MNI152NLin6Asym. Native Colin27 remains separate. Registered estimates retain original/derived identities and transforms; discrete labels are never averaged or filled to create coverage. Surface projection is a display operation. Resampling does not establish registration.

采样输出可为 1/2 mm，必须报告源/目标网格和逐标签损失。原生 AAL3-134 历史记录为 8 个 1 mm³ 体素；共享模板配准标签例为 7 个，2 mm 可全部丢失。这是不同来源/阶段，不是原始八个被覆盖。S6 当前空间验证 partial、humanValidated=false、14 项覆盖缺口、零合格替换分割源；示意几何未据此升级。见[科研流程](acceptance/RESEARCH_WORKFLOWS.md)与[验收](acceptance/STATUS.md)。

---

以下为保留的历史记录 / Retained historical record. Earlier pass/deployment claims apply only to their dated versions.

# 空间与配准

脑内主参考为 **FSL MNI152NLin6Asym、RAS 毫米坐标、2 mm 网格**。逐数据集证据与显示限制见 `public/data/space/alignment.json`。原始数据保存在 `data-sources/`；将图像转成 RAS 或重采样到相同网格，本身不能证明解剖对齐。

| 数据 | 当前处理与显示 |
| --- | --- |
| DK68、配对 pial / white | 来自同一 FSL MNI152 FreeSurfer 重建；体素、顶点标签及头信息已核验。见 `DK_DATA.md`。 |
| Harvard–Oxford、JHU | 使用 FSL 分发的已发表模板坐标；没有在本项目重新估计配准。JHU 分区标签与实际纤维追踪分开。 |
| 小脑 | 使用源作者已执行 FNIRT 的 MNI 版本。 |
| FSL Talairach BA | 使用源分发中已执行的 Lancaster 仿射映射；历史粗切片和单脑局限保留。 |
| Jülich BA 子集 | 使用 FSL 已发表的 MNI152 放置与 25% 最大概率图；旧版精确 MNI 变体未独立核实。 |
| HCP1065 白质束与脑神经流线 | 从其原生 ICBM2009a 非线性非对称空间，经本项目估计的仿射与非线性变换进入主脑空间；原生文件与配准文件分别保留。 |
| AAL、AAL3、旧版 BrainNet BA | 缺少与具体分发标签配对的已核验源模板或变换；保留原始标签，禁止当作已对齐图谱叠加主脑。 |
| PAM50 脊髓 | 保留原生直化模板，作为独立参考；尚未与主脑完成联合配准。 |

## HCP1065 的模板配准

[HCP1065 原作者说明](https://brain.labsolver.org/hcp_trk_atlas.html)指定 ICBM2009a Nonlinear Asymmetric。使用 [TemplateFlow 的精确 2009a 非对称 T1 与脑掩模](https://github.com/templateflow/tpl-MNI152NLin2009aAsym)，以当前 FSL T1 为目标，在既有 `mne` 环境用 DIPY 1.7.0 估计互信息平移、刚体、仿射，再进行对称微分同胚互相关配准。注册网格为 2 mm；实际 NIfTI 头确定空间。TemplateFlow 描述文件中的通用尺寸字段与实物不同，未用于坐标放置。

脑掩模 Dice 由 **0.96799** 提升至 **0.98442**；共同脑区强度相关由 **0.80921** 提升至 **0.95797**。脑内变换 Jacobian 均为正，最小 0.28227；4,450 个源空间点的往返误差中位数 0.0121 mm、95 百分位 0.0548 mm、最大 0.1800 mm。坐标斜坡图像与点变换的独立方向检查最大误差小于 0.00002 mm。这些数值衡量配准一致性，不证明每条细小脑神经的解剖位置准确。

`scripts/space_register.py` 保存双向场至 `data-sources/space/MNI152NLin2009aAsym_to_MNI152NLin6Asym_dipy.npz`。下游调用 `transform_source_ras_mm`，输入和输出均为 RAS 毫米；图像重采样是反向取样，不能直接把图像变换方向当作流线点的变换方向。报告 `public/data/space/hcp1065-registration.json` 保留参数、头信息、输入与变换哈希；同目录 `hcp1065-registration-qc.png` 展示三平面图像核对。

该变换由本项目估计，**不是官方变换**。模板配准与群体平均流线适合教学展示，不能视为个体神经走行或临床定位的验证。脊髓和未确认源空间的图谱不因这一步而自动完成对齐。

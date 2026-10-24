# 公开数据发布策略

核对日期：2026-10-25。适用于本项目的免费、无财务回报的教学 GitHub / Pages 发布。代码许可证不能覆盖第三方图谱；数据按下表分别保留许可、署名、修改说明和可取得的原始文件。这里记录发布依据和打包要求，不把仓库的软件许可证当成所有借入数据的授权。

| 资产 | 核实的依据 | 本次打包策略 |
| --- | --- | --- |
| `dk-v2/` DK68 与 pial / white | [CBIG 固定提交的 MIT](https://github.com/ThomasYeoLab/CBIG/blob/634f676630929a71297852d01dd92a287103e861/LICENSE.md)覆盖 CBIG 提供部分；[FreeSurfer Part B](https://surfer.nmr.mgh.harvard.edu/fswiki/FreeSurferSoftwareLicense)明确包括 MGH 有权许可的软件与数据，并允许修改、展示和分发，要求完整 Part B、规定前言、署名和修改标识。原输入为 FSL MNI152，另保留其模板条件。 | 可以随非商业教学包发布；并列保留 CBIG、FreeSurfer、MNI/FSL 条款，不能只标 MIT。公开构建脚本、原始配对来源清单与哈希。 |
| FSL MNI152 T1、其显示体积及 DK 所用模板 | [FSL 模板索引](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html)明确将所列模板和图谱的许可指向[主许可](https://fsl.fmrib.ox.ac.uk/fsl/docs/license.html)，并说明此模板由 Andrew Janke 提供。 | 按 FSL 非商业分发条件保守发布；附原始 T1、转换脚本和许可。不能用 2009a 或第六代**对称**模板的许可替代这个精确非对称版本。 |
| `ho.bin`、HO 衍生深部结构、侧脑室、脑干表面；小脑表面 | FSL 当前许可专门说明 Harvard–Oxford 与 Cerebellum 为 **CC BY-SA 4.0**。旧 FSL 5.0.1 包中的许可仍写非商业，两份原文均保留。 | 本次免费发布同时满足旧条款；衍生数据明确保留 CC BY-SA 4.0、来源与修改说明，不能给这些数据追加统一的“禁止商用”限制。 |
| `jhu.bin`、`ba-v2/juelich-*` | FSL 当前许可明确写明 JHU、Juelich 经所有者要求按主 FSL 许可发布。 | 可以非商业分发；保留条款、原始 NIfTI/XML 和构建源码。不得将它们重新标为 MIT、CC BY 或 CC BY-SA。 |
| `ba-v2/talairach-ba.bin` | FSL 模板索引将包含 Talairach 的整张清单指向主许可，并说明其数字化数据由 Lancaster / Tordesillas Gutiérrez 提供。 | 只按 **FSL 分发版本及其非商业条件**发布，附原始 NIfTI/XML 与转换源码。[Talairach 原网站](https://www.talairach.org/)保留版权，未找到可额外推断为公有领域的依据。 |
| HCP1065 原生及配准流线 | [原作者的该数据页面](https://brain.labsolver.org/hcp_trk_atlas.html)明确为 CC BY-SA 4.0，并要求 HCP 致谢。 | 可以发布，衍生 JSON 仍为 CC BY-SA 4.0；使用 [`HCP1065-NOTICE.md`](../public/data/anatomy/licenses/HCP1065-NOTICE.md)中的完整署名、变更与 HCP 致谢。 |
| 2009aAsym 配准报告和 QC 图 | [TemplateFlow 精确模板许可](https://github.com/templateflow/tpl-MNI152NLin2009aAsym/blob/master/LICENSE)及 [MNI 原作者页面](https://nist.mni.mcgill.ca/icbm-152-nonlinear-atlases-2009/)允许保留版权通知后使用、修改、分发。QC 同时含 FSL 目标图像。 | 可以放入非商业发布包；同时保留 MNI 通知和 FSL 条件。2009a 的许可不用于覆盖其他模板。 |
| AAL116 / AAL3v2 旧二进制 | [GIN 2024 AAL3 指南](https://www.gin.cnrs.fr/wp-content/uploads/AAL3_UserGuide_April2024.pdf)明确 AAL3 包采用 GNU GPL；当前借自 BrainNet 的精确包装未附其配套 README / GPL 版本。BrainNet 的 [Inspect 通知](https://github.com/mingruixia/BrainNet-Viewer/blob/master/NOTICE_INSPECT_ATLASES.md)只给来源，明确不改变 atlas 条款。 | 本次不打包已停用的 `aal.bin`、`aal3.bin`；保留目录说明。将来启用前恢复原作者包的精确数据与 GPL 文本、修改说明及对应源文件。 |
| 旧 BrainNet 皮层网格、旧 `ba.bin`、旧 Neuroparc `dk.bin` | BrainNet GPL 与 Neuroparc Apache-2.0 主要提供软件仓库许可；[BrainNet 曲面通知](https://github.com/mingruixia/BrainNet-Viewer/blob/master/NOTICE_SURFACE_TEMPLATES.md)保留 Evans / MNI 等来源，但不构成所有确切借入文件的独立授权。 | 本次不打包未使用的旧资产；保留来源通知及本地原件。新 DK68 已替代旧 DK/皮层网格。 |
| PAM50 本地预计算网格 | 未核实独立数据再分发许可；SCT 软件 LGPL 不能替代数据许可。 | 从公开 Git 与 Pages 中排除。按需加载官方源数据的实现及其状态由 [`PAM50-LICENSE-STATUS.md`](../public/data/anatomy/licenses/PAM50-LICENSE-STATUS.md)说明；这不意味着已取得再分发权。 |

## 打包时必须执行

1. 随网站发布 [`public/data/licenses/NOTICE-DATA.md`](../public/data/licenses/NOTICE-DATA.md)、其链接的完整许可证，以及 HCP 的专门通知。页面应提供可访问的“数据许可与来源”入口。
2. 公开原始 FSL 输入和转换脚本：至少包括 `MNI152_T1_2mm_brain.nii.gz`、`JHU.nii.gz` / XML、HO / 小脑 NIfTI / XML、Talairach NIfTI / XML、Juelich 最大概率 / 概率 NIfTI / XML，以及实际使用的 `data_build.py`、`dk_build.py`、`ba_build.py`。FSL 原文要求非收费转交附带原始与修改源码；本项目不分发 FSL 可执行程序，将原 atlas 数据和处理脚本一并提供是对应的数据复现包。
3. 每个 CC BY-SA 衍生数据继续适用 CC BY-SA；每个 FSL 非商业数据继续适用 FSL 条件；项目代码另行许可。数据可作为分别许可的集合发布，不能将全体资产统一重新许可。
4. 构建排除规则同时覆盖 Git 跟踪、部署目录和历史 ZIP；仅从 UI 隐藏 PAM50 / 旧图谱不够。原始本地材料保留，发布目录使用明确的允许清单。

硬性阻断是把未有独立数据授权的 PAM50 本地衍生网格公开打包、移除必要通知、把 FSL 非商业数据标作任意商业复用，或不提供当前许可证所要求的源材料。其余已列资产满足各行条件后可用于这次免费教学发布。FSL 不以组织是否非营利作为唯一判断，而以实际是否获得财务回报等条款界定商业使用。

## 保存的许可证据

`public/data/licenses/` 包含 CBIG MIT、完整 FreeSurfer 2011 协议、含指定前言的完整 Part B、FSL 当前与旧分发 HTML / 纯文本、MNI 2009a 许可、CC BY-SA 4.0 原文，以及之前保留的 BrainNet / Neuroparc 通知。来源 URL、日期和 SHA-256 见 `license-evidence.json`。`MNI152NLin6Asym-template-license-metadata.json` 仅记录该模板身份；它的 “See LICENSE file” 不是独立授权依据。

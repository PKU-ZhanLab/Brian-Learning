# AAL / AAL3 数据与配准

本地现已提供 AAL116 和 AAL3 的原生图谱，以及明确标为“项目估计配准”的 FSL 空间版本。原生版本用于查看作者分区；估计配准版本可与项目主脑参考及论文坐标对照。两者不能混用编号或空间。

| 项目 | 原生数据 | FSL 衍生数据 |
| --- | --- | --- |
| AAL116 | SPM12 2015 ROI_MNI_V4，2 mm，116 个原始非连续编号（2001–9170） | 116 个标签，1 mm 输出网格 |
| AAL3 | NIH 分发的 AAL3v1，1 mm，166 个正标签；35、36、81、82 空缺 | 166 个标签，1 mm 输出网格 |
| 空间 | Colin27 / MNI 单人脑 | MNI152NLin6Asym；项目估计变换 |
| 配准状态 | 未直接叠加到主脑 | `registered-estimate`，保留限定说明 |

入口为 `public/data/aal-v3/manifest.json`。`aal`、`aal3` 保留原生数据；`aal-registered`、`aal3-registered` 为估计配准版本。所有二进制均按自身 `shape`、`affine`、`dtype`、`order` 读取，不假定共用网格。原生数据仅做 RAS 轴重排，未改变边界；导出逐标签核验了体素数、质心、左右及 SHA-256。

## 来源与许可

AAL116 使用 [SPM12 原始包的镜像](https://github.com/Neurita/std_brains/tree/master/atlases/aal_SPM12/aal)，保留原始 NIfTI、标签表、MATLAB 程序及 README。README 明确采用 GNU GPL。AAL3 使用 [NIH AFNI 原始分发](https://afni.nimh.nih.gov/pub/dist/atlases/aal/AAL3_dist.tgz)；其 2 mm 体素和仿射与之前本地名为 AAL3v2 的文件完全一致。

[GIN 2024 指南](https://www.gin.cnrs.fr/wp-content/uploads/AAL3_UserGuide_April2024.pdf)明确 AAL3 采用 GPL，并说明 v2 只补充许可、图谱不变，文件仍称 AAL3v1。本次通过原始指南的搜索索引核对该说明；GIN 直连发生 TLS/HTTP502 错误，没有声称已下载 2024 压缩包。镜像及 NIH 分发不因原站连接失败而自动失去作者已给出的 GPL 许可。完整 GPLv3、原始 README、证据记录、署名、修改说明及对应源数据见 `public/data/aal-v3/licenses/` 和 `sources/`。作者未指定 GPL 版本，本分发选择 GPLv3。

SPM Colin27 模板、原始 MNI Colin27 模板和 FSL 目标 T1 的通知分别保留；GPL 图谱许可不用于覆盖 FSL 图像。精确源文件列表及哈希在 `public/data/aal-v3/source-package-allowlist.json`。原论文 PDF 和网页核对缓存不属于该发布清单。

## 估计配准的证据和限制

作者论文将 AAL/AAL3 的单人脑来源指向 Colin27。数值核对发现，SPM 的 `single_subj_T1` 与原始 MNI1998 Colin27 存在 1 mm 坐标约定差异：按原始 Colin27→SPM 的 `[1,1,1]` mm 平移配对后，T1 相关为 0.999941。源脑掩膜按这一实测差异转换，未改写原件。该核对证明 T1/掩膜配对；不能单凭相同网格认证所有图谱边界。

随后在真实 T1 上估计平移、刚体、仿射和 DIPY 对称微分同胚变换。掩膜 Dice 从 0.9272 提高至 0.9656，共同脑区图像相关从 0.6283 提高至 0.9137；无非正 Jacobian，往返误差第95百分位为 0.0842 mm，坐标斜坡方向误差最大 0.000021 mm。后三项验证变换的数值一致性，不是解剖定位误差。

原生标签通过最近邻一次采样至 1 mm FSL 网格，保留 116/166 个标签。变换在 2 mm 上估计，1 mm 输出不等于 1 mm 定位精度。直接输出 2 mm 时会丢失只有 8 mm³ 的右侧丘脑 Re 标签134；任何再次按 2 mm 网格统计的 ROI 分析都应保留这一提示，不得用人为补点制造标签。

`registration-qc.png` 的三张中心正交切片经 AI 检视，主脑外轮廓、中线和脑室配对改善，未见明显左右反转或整体错位。该审查范围及哈希保存在 `root-review.json`，不是人工认证或全体小核团的边界验证。数据适合带限定说明的参考查看与探索性 ROI 对照；个体定位仍需个体解剖和独立配准检查。

## 重建

先检查 conda 环境，不在默认环境安装依赖。当前准备好的环境是 `mne`。

```powershell
conda env list
conda run -n mne python scripts/aal_prepare_registration.py
conda run -n mne python scripts/aal_apply_registration.py
conda run -n mne python scripts/aal_build.py
conda run -n mne python scripts/aal_validate.py
```

这里复用保存的变换场；重新估计配准见 [REGISTRATION.md](REGISTRATION.md)。重新估计后，只有与变换场、标签报告和 QC 图哈希一致的审查记录才会启用 `registered-estimate` 状态；变换变化后需要重新检视。

旧 BrainNet BA 的精确配对 T1 与源包装尚未确认。其历史标签仍可独立查看，但不能仅根据“MNI-like”字样套用这份 Colin27 变换；需要取得该版本的原始图谱、许可、配对 T1 和坐标说明后，再用通用工具配准。已验证的 FSL Talairach / Jülich 数据保持各自证据范围。

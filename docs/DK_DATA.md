# DK68 与配对皮层

当前 DK 数据包括完整的双侧 34 个皮层分区，共 68 区；双侧岛叶均保留。皮层表面与体素标签来自同一个 FSL MNI152 模板的 FreeSurfer 重建，避免将不同模板的脑表面与标签直接叠加。

原始文件取自 [Thomas Yeo Lab CBIG 的 FSL_MNI152_FS4.5.0](https://github.com/ThomasYeoLab/CBIG/tree/634f676630929a71297852d01dd92a287103e861/data/templates/volume/FSL_MNI152_FS4.5.0)，固定提交 `634f676630929a71297852d01dd92a287103e861`。分区体积、pial/white 表面、aparc.annot 和重建日志均保留在 `data-sources/dk/`，下载地址及 SHA-256 见该目录 `sources.json`。分区体系见 [FreeSurfer cortical parcellation](https://surfer.nmr.mgh.harvard.edu/fswiki/CorticalParcellation)。保留 CBIG MIT 许可证及 FreeSurfer、MNI、Desikan–Killiany 来源署名。

重建命令明确使用 FSL 4.1.5 的 `MNI152_T1_1mm.nii.gz`。配对 `orig.mgz` 按其头信息重采样至本项目 FSL 2 mm 参考后，228,453 个脑内体素强度相关为 0.998657；这支持相同模板来源，不代表新的配准估计。完整数值见 `public/data/space/template-comparison.json`。

体素标签以最近邻重采样到 RAS、2 mm 的 FSL MNI152NLin6Asym 网格。表面 tkregister-RAS 到 scanner-RAS 的变换由配对 MRI 头计算，平移为 `[-1, -17, 19]` mm；未按视觉印象调整位置。表面约保留 28% 原始三角形，保留拓扑及原始顶点，因此分区标签直接从原始 `aparc.annot` 传递，未按脑回位置重新推断。white 与 pial 使用相同顶点对应关系。

`public/data/dk-v2/metadata.json` 为界面数据入口；`validation.json` 记录 68 区、双侧岛叶、哈希、顶点对应、左右侧及体素质心检查。独立检查可在已有 `mne` 环境运行 `scripts/dk_validate.py`。这些是群体模板上的自动分割，标签边界不是每个人的解剖边界，也不构成专家逐区认证。

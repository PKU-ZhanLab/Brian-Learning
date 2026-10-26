# 本地 T1 与标签配准

`scripts/register_volume.py` 接受移动 T1、与它配对的整数标签、固定 T1 和新输出目录，执行真实图像配准并保存结果。图谱与 T1 必须描述同一解剖与坐标系；相同尺寸、相同 affine 或都写“MNI”不足以证明配对。

先运行 `conda env list`，使用已经准备好的 `mne` 环境。该工具不会安装软件包。移动和固定 T1 应使用相近的脑提取范围；完整头部 T1 应同时提供脑掩膜。

```powershell
conda run -n mne python scripts/register_volume.py `
  --moving-t1 path/to/source_T1.nii.gz `
  --moving-labels path/to/source_labels.nii.gz `
  --moving-mask path/to/source_brain_mask.nii.gz `
  --fixed-t1 data-sources/raw/MNI152_T1_2mm_brain.nii.gz `
  --source-space "source template and version" `
  --target-space MNI152NLin6Asym `
  --pairing-evidence "source record linking the labels and T1" `
  --outdir output/my-registration-01
```

`--moving-mask`、`--fixed-mask` 可省略；省略时仅用正强度体素作为范围，因此仅适合已经脑提取的 T1。输出目录必须尚不存在，以免覆盖旧变换和审查记录。标签必须是 0–65535 的非负整数，背景为0；最终采用最近邻直接采样原始标签，避免多次标签重采样。

结果包括：

- `mapping.npz`：完整 DIPY 双向位移场、仿射及网格信息。
- `moving-on-fixed.nii.gz`、`labels-on-fixed.nii.gz`：固定网格上的 T1 和整数标签。
- `registration-qc.png`：三中心切片的前后对照和标签叠加。
- `registration-report.json`：输入/输出哈希、参数、软件版本、重叠/相关、Jacobian、往返误差、方向检查和丢失标签。

坐标统一为 RAS 毫米。图像重采样使用固定位置→移动位置的 pull 映射；移动点→固定点则调用保存映射的 `transform_points_inverse`。两者不能颠倒。通用工具默认生成 `registered-unreviewed`，不会把数值收敛直接当成解剖认证。检查配对来源、左右、外轮廓、脑室、目标 ROI 和标签丢失后，再由集成层记录审查范围及限定用途。

验证变换方向和采样实现可运行：

```powershell
conda run -n mne python scripts/register_volume.py --self-test --outdir output/registration-self-test-01
```

此检查包含已知 RAS 平移、保存/重载、斜交与非等距网格的 Jacobian、坐标斜坡和最近邻标签采样。它验证程序约定，不证明真实输入配对正确。

本项目的 Colin27 候选配准命令如下。掩膜准备由 `aal_prepare_registration.py` 完成；原作者数据不被改写。

```powershell
conda run -n mne python scripts/register_volume.py `
  --moving-t1 data-sources/aal-official/spm12-single_subj_T1.nii `
  --moving-labels data-sources/aal-official/AAL3_dist/AAL3v1_1mm.nii `
  --moving-mask data-sources/aal-official/spm12-colin27-brain-mask-verified-shift.nii.gz `
  --fixed-t1 data-sources/raw/MNI152_T1_2mm_brain.nii.gz `
  --source-space "SPM12 canonical Colin27" `
  --target-space MNI152NLin6Asym `
  --pairing-evidence "See AAL_INTEGRATION.md and source-template-identity.json" `
  --outdir output/colin27-fsl-new-estimate
```

保留原生图谱和配准前文件；不把标签-only 图像当 T1 直接优化，也不把旧 BA 的未知源空间默认当作 Colin27。

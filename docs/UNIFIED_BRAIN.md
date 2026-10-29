# 当前共用脑形 / Shared brain geometry · 4.2.0

DK/AAL/AAL3 共用既有脑形和相机；图谱切换改变标签显示，原生 T1 不被替换。真实分区以 AtlasRegionRef 身份选择，概念脑区关联不充当标签等价。并排显示是独立来源视图；只有明确共同参考与来源依据时才允许相机/十字线联动。公开链接省略整组并排状态以保护私有位置。

DK/AAL/AAL3 retain the shared brain shape and camera. Native T1 remains available separately. Atlas identities and conceptual relationships are distinct. Linked side-by-side views require documented common reference; public links omit their state. The isolated viewer prototype does not change the production renderer or introduce NiiVue into production dependencies.

[查看器评估](VIEWER_EVALUATION.md)记录暂时保留 Three.js 的原因、隔离原型及尚未运行的 GPU/浏览器比较；不能据静态构建判定更快、更准确。

---

以下为保留的历史记录 / Retained historical record. Earlier pass/deployment claims apply only to their dated versions.

# 统一脑形与原始 T1 / Shared geometry and original T1

AAL 原始数据是带空间信息的三维整数标签体积。矢状、冠状、轴位是该体积在配对 T1 上的三种显示方向。三维标签边界、标准脑的皮层着色和原始 T1 切片是不同的展示，不能把其中一种当作另一种的原始数据。

## 查看方式

- 主界面选择 DK、AAL 或 AAL3，保持相同 FSL MNI152NLin6Asym 皮层几何与相机设置。
- AAL / AAL3 的 **原始 T1 三视图**打开 Colin27 T1 与原始标签；坐标独立于标准脑。
- 图谱分区中的 **标签边界 3D**保留体积的全部标签。**T1 三视图**使用当前图谱确有依据的配对模板。没有配对 T1 的导入数据不自动套用标准脑 T1。
- 点击标签名称后，切片定位到该标签内最接近质心的实际体素；右侧仍报告数学质心。这样薄小或不连通区域的交点不会因质心落在背景中而错过标签。
- 切片模式、交点、透明度与所选标签可保存到项目、命名视图和公开视图链接。

## 表面投影

保留既有 Colin27 → FSL 项目估计变换及原始体积不变。在相同 FreeSurfer 重建的配对 pial / white 顶点之间，按深度 0、0.1 … 1 进行 11 次最近邻标签采样，选择出现最多的非零皮层标签；同票时取较小源 ID。仅允许对应半球的皮层标签；DK 未标注的内侧壁不参与投影，无有效标签的柱保持灰色。海马、深部核团和小脑等不投射到大脑皮层表面，继续保留在体积、切片和 ROI 中。

方法参考 [Nilearn 的体积到表面采样说明](https://nilearn.github.io/stable/modules/generated/nilearn.surface.vol_to_surf.html)。本项目自行实现上述类别投票及背景、半球限制，并非调用 Nilearn 生成，也不是官方 AAL 表面图谱。表面颜色点击使用同一份顶点标签；切片使用体素标签，两者在边界附近可不同。

运行 `node scripts/build-unified-surfaces.mjs` 可重建，随后运行 `node scripts/upgrade-manifest.mjs` 更新清单。每个衍生文件的源体积、pial/white 几何 SHA-256、覆盖计数、允许标签及深度参数保存在 `public/data/surface-v1/manifest.json`。

| 图谱 | 半球 | 单点采样有标签 | 厚度采样有标签 | 可采样顶点 |
|---|---|---:|---:|---:|
| AAL | 左 | 35,368 | 37,954 | 38,081 |
| AAL | 右 | 34,949 | 37,748 | 37,885 |
| AAL3 | 左 | 34,611 | 37,945 | 38,081 |
| AAL3 | 右 | 34,852 | 37,710 | 37,885 |

这些数字只描述显示覆盖，不是配准准确率。配准估计、模板个体差异、1 mm 输出网格与原始 2 mm 变形场的限制仍然适用；未增加人工解剖认证。

## English

An original AAL atlas is a 3D integer label volume with spatial metadata. Orthogonal T1 slices are one way to display it. DK, registered AAL and registered AAL3 now share the identical FSL MNI152NLin6Asym pial geometry; switching cortical atlases preserves the camera. Native AAL slices retain their paired Colin27 T1 and independent coordinates.

The project samples 11 depths between matched pial and white vertices, chooses the most frequent positive cortical ID, and restricts labels to the correct hemisphere. Ties use the smallest source ID. The medial wall and uncovered ribbons remain unlabelled. Deep and cerebellar labels remain volumetric. This is a documented project projection of the existing registration estimate, not an official AAL surface atlas or an accuracy certification. Source and geometry hashes, label membership and coverage are checked during validation.

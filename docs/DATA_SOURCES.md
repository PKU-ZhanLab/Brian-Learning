# 解剖与图谱数据

脑内主参考为 **FSL MNI152NLin6Asym 2 mm**。RAS 指右、前、上为正；放射学显示左右翻转是另一项显示约定。相同坐标方向或体素网格不代表不同模板已经解剖对齐。

| 数据 | 当前内容与空间处理 | 具体记录 |
| --- | --- | --- |
| DK68 + 皮层曲面 | CBIG 保存的 FSL MNI152 FreeSurfer 重建；双侧各 34 区含岛叶。配套 pial/white 表面及原始 aparc 顶点标签；原输入与本机模板的一致性已核对。 | [DK_DATA.md](DK_DATA.md) |
| FSL T1 | MNI152NLin6Asym 2 mm；仅为显示将强度压缩到 8 位，空间网格不变。 | public/data/volume.json |
| Harvard–Oxford | 25% 最大概率、2 mm；21 标签含整体灰白质。原作者已映射至 FSL MNI；14 深部结构、2 侧脑室与脑干外表面由标签提取。 | data-sources/raw/download-manifest.json |
| JHU | ICBM-DTI-81 的 48 个白质正标签；标签区不是单独神经纤维。 | FSL 原始分发与主 manifest |
| BA | FSL Talairach 历史映射 42 个编号；另有 Jülich 9 个编号、22 双侧亚区的组织学子集。 | [BA_DATA.md](BA_DATA.md) |
| HCP1065 | 21 个白质条目、10 个颅神经条目的图谱流线；从 ICBM2009aAsym 以本项目估计的 2 mm 变换映射到 FSLNLin6Asym。 | [SPACE_ALIGNMENT.md](SPACE_ALIGNMENT.md)、[ANATOMY_UPGRADE.md](ANATOMY_UPGRADE.md) |
| PAM50 | 30 节段 C1–S5、灰质、白质及双侧前后角。保留原生直化空间；没有验证到脑模板的联合配准。 | [ANATOMY_UPGRADE.md](ANATOMY_UPGRADE.md) |
| AAL116 / AAL3v2 | 保留原始 116 / 166 正标签。当前分发无法确认配对模板，暂停在主模板上的叠加与坐标查询。 | [SPACE_ALIGNMENT.md](SPACE_ALIGNMENT.md) |
| 旧版 BrainNet BA | 原 41 标签保留作历史对照，空间变体未验证，暂停叠加。 | public/data/legacy-manifest-v1.json |
| 小脑 | Diedrichsen Cerebellum-MNIfnirt、25% 阈值的联合表面；中线带只是显示几何划分。 | FSL 原始来源清单 |

原始文件和下载 SHA-256 留在 data-sources，网页读取 public/data 衍生资产。总资产清单为 public/data/asset-checksums.json。v1 源码与数据清单另保存在 snapshots/neuroatlas-v1-before-accuracy-upgrade.zip。

## 边界与缺口

- 脑干外表面来自真实标签，中脑/脑桥/延髓的 z=-22/-47 mm 切分仍是教学划分；小脑蚓部中线带也未由独立真实分区确认。
- HCP 流线是群体弥散 MRI 的估计，不代表逐根轴突。模板配准质量不等于细小颅神经的局部验证；原始空间和转换报告均保留。
- PAM50 为直化模板，不能表示正常脊柱曲率。节段为图谱估计，不能解释为每个人精确神经根出口。Co1 未独立覆盖，灰白质概率图的最尾端覆盖也不完整。
- CN I、IV、VI、IX、X、XI、XII，孤立脊髓丘脑束、Co1 和侧角无可独立映射的已接入真实几何。相应目录保留；可选示意默认隐藏。
- 下丘脑、丘脑底核、黑质、红核，以及第三/第四脑室、中脑导水管和可选血管仍缺独立已接入网格；知识卡标记示意，默认不显示其示意几何。
- 概率阈值、平滑和网格简化影响显示边界；每个几何条目记录参数、来源、覆盖和限制。

## 坐标实现

体素按 i + nx * (j + ny * k) 即 x 最快变化顺序存储。manifest 的 4×4 affine 采用行优先展开，uint16 为小端序。SPM/MAT 一基仿射已转换为零基。FSL Jülich maxprob 用 XML index+1；Talairach Label XML 含背景 0，按原编号匹配。MGH HO 镜像中的 FreeSurfer 编号已依据其保留的对应表恢复，未执行下载脚本。

## 许可与署名

保留各源包及 public/data/licenses 的许可资料。CBIG 的软件许可、MNI/FreeSurfer 署名与图谱数据条款分别保留，不能互相替代。HCP1065 采用 CC BY-SA 4.0 并保留 WU-Minn HCP 致谢；PAM50 数据单独再分发条款见其具体记录。FSL 图谱分别遵守原图谱条款；项目不据软件仓库许可证推断通用商业授权。

## 复现

运行网页无需 Python。数据重建使用已检查的 mne conda 环境，未向默认环境安装依赖。

- 原版获取/构建：scripts/data_fetch.py、data_build.py（会重建 v1 manifest，升级后需重新合并）。
- DK、空间配准与 PAM50/HCP：参见各模块说明中的具体脚本。
- BA：scripts/ba_build.py。
- 汇总：node scripts/upgrade-manifest.mjs，然后 npm run check 和 npm run build。

图谱分区只支持对应解剖定义；功能与临床证据在知识卡中另列。

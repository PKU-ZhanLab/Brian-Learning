# NeuroAtlas

[English](README.en.md) · 应用版本 **4.2.0（本地候选，尚未发布）**

从坐标、图谱标签、影像或论文开始：确认参考空间与来源，比较 ROI，返回原文，保存完整研究项目。

- [使用指南](docs/USER_GUIDE.md)：坐标、多选、项目与恢复。
- [论文结果与证据](docs/RESULTS_WORKFLOW.md)：检索、来源、独立证据包和固定版本。
- [空间与方法](docs/SPACE_ALIGNMENT.md) · [共用脑形](docs/UNIFIED_BRAIN.md) · [数据许可](docs/PUBLIC_DATA_LICENSES.md)。
- [当前验收](docs/acceptance/STATUS.md) · [三个科研流程](docs/acceptance/RESEARCH_WORKFLOWS.md) · [构建与回退](docs/acceptance/RELEASE_CHECKLIST.md)。

`npm ci` 后运行 `npm run dev`；检查用 `npm run check`，公开构建用 `npm run build:public`。Node 22 或更新版本；浏览器测试仅在允许的独立 CI 环境运行，见交付说明。

项目文件保存本项目影像、证据、笔记、草稿、视图和计算历史；公开视图链接会省略私有内容。影像默认留在本机；许可允许的最小来源材料随证据包携带。打开和合并项目是不同操作，导入失败保留当前研究。

同名 MNI、1 mm 网格和显示覆盖都不证明配准精度。原生 Colin27 与主模板分开；未知空间不能强制叠加。人工空间/来源审阅尚未完成，部分新流程尚待浏览器验收，详见当前验收记录。

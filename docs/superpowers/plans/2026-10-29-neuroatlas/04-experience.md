# NeuroAtlas 交互、视觉与使用效率 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让科研人员能精确定位、连续比较、放心录入和恢复工作，并在不同屏幕上清楚阅读与操作。

**Architecture:** 保留现有三种内部工作模式，以稳定的选择、结果层和项目接口串联任务。新增小型交互组件及纯状态模块，逐步从 App 中移出相应职责；不一次性重写渲染器。空间、证据及保存算法分别消费 S/W/E 的实现。

**Tech Stack:** React 19、Three.js、现有 CSS、Node `node:test`、G0 配置的浏览器回归；当前桌面人工交互验收用 CUA。

**Spec:** [00-spec.md](00-spec.md)；[UX 原审查](../../../../output/audit-20261029/UX_REVIEW.zh-CN.md)。

## Global Constraints

- 相对代码路径均相对唯一执行 checkout，来源为 `.deployment/source`；不同时修改资料根副本。
- 保留中英文、现有功能和不明空间保护；视觉变化不得改变科学数据含义。
- 数据身份使用 `AtlasRegionRef`，结果层使用 `ResultLayer`；不再把名称作为唯一对象。
- 新工作区视图通过 W6 的迁移入口保存；私有内容不进入公开链接。
- 字体起点：正文 14–16 px、辅助文字 12–13 px、坐标 13–14 px；普通文字对比至少 4.5:1，采用实际计算样式验收。
- 缺少浏览器环境时，相关验收不勾选完成。纯样式调整不写镜像单元测试。

## Review Focus

1. 粘贴带小数、LPS 或模板外坐标不能悄悄取整或改变空间——X1。
2. 在已经设好 B 时，从图谱发送多选到 A 不能清空 B——X2。
3. 修改筛选/切模式或删除级联记录后，应能恢复草稿/撤销——X5。
4. 两层弹窗、键盘进入和关闭必须按层返回原触发位置——X6。
5. 宽屏打开设置后变成窄屏/200% 缩放，控制与长内容仍可达——X7。

## 文件职责

新增 `CoordinateNavigator`、`TaskEntryPoints`、`SelectionTray`、`ComparisonBasket`、`WorkspaceLayout`、`ResultLayerBar`、`DialogHost`、`WorkspaceStatus`，分别负责定位、任务入口、选择、比较、布局、层控制、弹窗和反馈。纯状态放在 `coordinate-input.js`、`selection-handoff.js`、`navigation-history.js`、`workspace-layout.js`、`draft-store.js`、`undo-history.js`、`workspace-status.js`。不重复实现 `research-contracts.js`、证据 schema、S3 资源、W5 层校验或 W6 项目序列化。

## X1：精确坐标与任务入口

**依赖：** G0、S1、S3。**对应：** R27、R39。

**Files:**
- Create: `src/lib/coordinate-input.js`、`src/lib/coordinate-input.test.mjs`、`src/components/CoordinateNavigator.jsx`、`src/components/TaskEntryPoints.jsx`。
- Modify: `src/App.jsx`、`src/components/SliceViews.jsx`、`src/components/ROICompare.jsx`、`src/components/AtlasSlicePanel.jsx`、`src/i18n/ui.js`。
- Test: `tests/e2e/coordinate-navigation.spec.mjs`。

**Interfaces:** `parseCoordinateInput(text,{spaceId,convention:'RAS'|'LPS',maxPoints:1000}) -> {points,errors}`；`CoordinateNavigator({point,spaceId,onNavigate,onCopy})`。`onNavigate` 交给 S3 的查询/空间能力判断。内部模式值继续使用 `anatomy/research/roi`，任务入口只调用既有模式切换，不产生另一套场景状态。

- [ ] 写回归：`'-38.25, -20.5, 54.1'` 保留小数；LPS `[10,20,30]` 明确转换为 RAS `[-10,-20,30]`；缺空间、NaN、超过 1,000 点给出字段错误；模板外点明确显示越界而不自动夹到脑内。
- [ ] 运行 `node --test src/lib/coordinate-input.test.mjs`，确认新增行为在实现前失败。
- [ ] 实现单点/批量粘贴、跳转、复制、每轴步进和返回中心；主脑、原生切片和 ROI 共享输入组件但保留不同空间上下文。加入“输入坐标／搜索脑区／导入影像／查论文”入口及可跳过的示例。
- [ ] 运行定向 Node 测试和 `npm run test:e2e -- tests/e2e/coordinate-navigation.spec.mjs`；检查三视图、坐标栏、多图谱结果一致，未知模板只进入独立视图。
- [ ] 提交本任务文件：`feat: add explicit coordinate navigation and research entry points`。

## X2：多选交接与研究导航历史

**依赖：** S2、W6。**对应：** R29、R30、R33。

**Files:**
- Create: `src/lib/selection-handoff.js`、`src/lib/selection-handoff.test.mjs`、`src/lib/navigation-history.js`、`src/lib/navigation-history.test.mjs`、`src/components/SelectionTray.jsx`。
- Modify: `src/components/AtlasExplorer.jsx`、`src/components/ROICompare.jsx`、`src/App.jsx`、`src/lib/workspace-project.js` 的 W6 视图适配入口。
- Test: `tests/e2e/selection-handoff.spec.mjs`。

**Interfaces:** `assignSelectionToOperand(previous,{side:'A'|'B',regions:AtlasRegionRef[]}) -> next`；单侧必须同图谱/版本/空间，否则明确拒绝。`pushNavigation(history,entry,{limit:50})`、`goBack(history)`、`goForward(history)` 返回新历史和目标；entry 保留模式、对象引用、滚动/选择上下文，私有历史只留本地。

- [ ] 写断言：向 A 传两个标签后 A 完整包含两者，B 和其阈值逐字段不变；不能把不同图谱分区悄悄并成一个原始标签集合；浏览论文后返回原比较现场且滚动位置恢复。
- [ ] 运行 `node --test src/lib/selection-handoff.test.mjs src/lib/navigation-history.test.mjs`，确认失败。
- [ ] 实现“已选 N 项”选择篮、清空、删除单项、“设为 A／设为 B／加入当前集合”；加入最近访问及前后返回。原生图谱可浏览但不能因这次交接绕过比较空间限制。
- [ ] 运行同组测试及 `npm run test:e2e -- tests/e2e/selection-handoff.spec.mjs`；检查跨模式、独立原生标签与恢复后的选择。
- [ ] 提交：`feat: preserve region selections across comparison workflows`。

## X3：证据阅读布局与论文比较篮

**依赖：** X2、E2、W6。**对应：** R30、R40、R43。

**Files:**
- Create: `src/components/WorkspaceLayout.jsx`、`src/components/WorkspaceLayout.css`、`src/components/ComparisonBasket.jsx`、`src/lib/workspace-layout.js`、`src/lib/workspace-layout.test.mjs`。
- Modify: `src/App.jsx`、`src/components/LiteratureWorkspace.jsx`、`src/components/LiteratureWorkspace.css`、`src/components/EvidenceEditor.css`、`src/lib/workspace-project.js`。
- Test: `tests/e2e/research-layout.spec.mjs`。

**Interfaces:** `normalizeLayout({mode,preset,panels},viewport) -> LayoutPreferences`；preset 为 `model/evidence/compare`。`ComparisonBasket({paperIds,maxPapers:3,onRemove,onOpenComparison})`；第四篇默认不自动替换，给出需要移除/替换的明确选择。layout 由 W6 作为可迁移视图字段保存。

- [ ] 在浏览器回归中定义：三篇比较后加入第四篇时原三篇不变，提示容量；打开其中一篇再返回仍显示原比较；两篇比较表展开后维度和标题保持可见。
- [ ] 运行 `npm run test:e2e -- tests/e2e/research-layout.spec.mjs` 确认新行为失败；Node 断言大屏保存的宽度在 390 px 上归一化且不产生超宽最小列。
- [ ] 实现可调分栏、证据优先、模型优先和全宽比较；固定表格首列/列头，侧栏适合简短详情，长编辑/比较使用主工作区。提供宽度重置与布局恢复。
- [ ] 运行定向测试；在 1366×768 和 1920×1080 对比两/三篇，检查正文可读、返回路径及布局保存。
- [ ] 提交：`feat: add evidence-focused layouts and explicit paper comparison`。

## X4：结果图层、来源回访和选择视觉

**依赖：** S2、E1/E2、W5、X2。**对应：** R15、R31、R38。

**Files:**
- Create: `src/components/ResultLayerBar.jsx`、`src/components/ResultLayerBar.css`。
- Modify: `src/App.jsx`、`src/components/BrainScene.jsx`、`src/components/ResultCoordinates.jsx`、`src/components/AtlasLegend.jsx`。
- Test: `tests/e2e/result-layers.spec.mjs`；消费 W5 的层测试。

**Interfaces:** `ResultLayerBar({layers:ResultLayer[],onVisibilityChange,onRemove,onOpenResult,onClear})`；`onOpenResult(resultId)` 使用 E2 的 `getResultViewModel(resultId,bundle)`。界面只传稳定 ID；保存/公开分享资格由 W5 决定。

- [ ] 写场景：叠加结果 A 后打开论文 B，层条仍明确显示 A；点击 A 的点能返回 A 的结果；隐藏/清除只影响对应层，不更换当前图谱；未知空间结果没有主脑叠加入口。
- [ ] 运行 `npm run test:e2e -- tests/e2e/result-layers.spec.mjs` 确认尚缺入口和来源返回。
- [ ] 实现图层来源条、显隐、移除、清空和返回原文；选区采用独立轮廓/名称条，分类色保持稳定；A/B/交集有固定语义并与图例一致。
- [ ] 运行回归与 W5 保存往返；屏幕缩窄时层条折叠但仍可操作；色觉模式/灰度下仍能通过名称、边线和图标区分。
- [ ] 提交：`feat: expose result layers and traceable selection controls`。

## X5：自动草稿、删除撤销与编辑离开保护

**依赖：** W2、E2、X2。**对应：** R32、R33。

**Files:**
- Create: `src/lib/draft-store.js`、`src/lib/draft-store.test.mjs`、`src/lib/undo-history.js`、`src/lib/undo-history.test.mjs`。
- Modify: `src/components/EvidenceEditor.jsx`、`src/components/LiteratureWorkspace.jsx`、`src/components/WorkspaceFiles.jsx`、`src/App.jsx`、`src/lib/workspace-session.js`、`src/lib/workspace-project.js`；调用 W2 的持久化协调器。
- Test: `tests/e2e/draft-and-undo.spec.mjs`。

**Interfaces:** `validateDrafts(records) -> DraftRecord[]`；`saveDraft({id,projectId,kind,recordId,payload,updatedAt},session)`；`readDraft(projectId,kind,recordId,session)`；`applyUndoableAction(state,action,{limit:20}) -> {state,undoState}`；`undoLast(undoState)`。DraftRecord 及 30 条/单条 50,000 字节/总 1 MiB 预算见 00-spec；草稿允许字段未完成，不能获得正式结果/来源核对状态。权威存储为 W2 envelope 的 drafts，W6 完整项目保留本项目 drafts，公开链接剔除；所有持久化通过 W2，禁止直接旁路写另一个 key。

- [ ] 写断言：输入半条结果后换筛选/模式再回来，内容相同；保存失败保留草稿；删除一篇本地论文连同结果/关系可作为一个动作撤销，恢复关联；跨项目不能读取另一项目草稿。
- [ ] 运行 `node --test src/lib/draft-store.test.mjs src/lib/undo-history.test.mjs` 确认失败。
- [ ] 实现自动草稿、未保存/保存失败状态、离开保护和级联影响数量；提供撤销入口与最近 20 个会话动作。撤销描述显示具体对象，不把恢复内置版本混称撤销。
- [ ] 运行同组测试及 `npm run test:e2e -- tests/e2e/draft-and-undo.spec.mjs`；验证 quota 失败、刷新后的草稿恢复、清除/保存后的 dirty 状态。影像删除由 W3 管理，不将大二进制塞入本任务撤销记录。
- [ ] 提交：`feat: protect research drafts and make edits reversible`。

## X6：统一弹窗、键盘与可读取的状态

**依赖：** G0；可在其他流并行开发组件，App 集成串行。**对应：** R34、R35。

**Files:**
- Create: `src/components/DialogHost.jsx`、`src/components/DialogHost.css`。
- Modify: `src/App.jsx`、`src/components/AtlasExplorer.jsx`、`src/components/WorkspaceFiles.jsx`、`src/components/ResultCoordinates.jsx`、`src/components/LiteratureWorkspace.jsx`、`src/components/BrainScene.jsx`、`src/styles.css`。
- Test: `tests/e2e/keyboard-dialogs.spec.mjs`。

**Interfaces:** `DialogHost({dialogs,onCloseTop})`；每项包含 `id,modal,title,returnFocusRef,content`。仅顶层 modal 激活；非模态结果面板仍可通过明确控件进入和返回。快捷键仅在非文本输入时响应，避免占用录入按键。

- [ ] 写键盘场景：打开图谱→打开保存→两次 Esc 逐层关闭；Tab 不进入被遮背景；焦点回到各自触发按钮；JSON 导入可由 Enter/Space 打开并取消返回；结构显隐按钮聚焦时可见。
- [ ] 运行 `npm run test:e2e -- tests/e2e/keyboard-dialogs.spec.mjs` 确认当前行为失败。
- [ ] 接入统一 dialog、inert/焦点管理及可见焦点；移除覆盖焦点的 outline:none；补 aria-current/aria-pressed/正确互斥语义和导入真实 button；主画布提供焦点与现有视角控制的键盘入口。
- [ ] 用测试及 CUA/实际键盘验收；若调用文件选择器或读屏器不可用，保留该项未完成，不用 DOM 属性代替完整交互证明。
- [ ] 提交：`fix: make dialogs and research controls keyboard accessible`。

## X7：视觉规范、响应式设置和长内容可读性

**依赖：** X3、X4、X6。**对应：** R36、R37、R38、R40。

**Files:**
- Create: `src/styles/tokens.css`、`src/components/DisplaySettingsDrawer.jsx`。
- Modify: `src/styles.css` 及各工作台 CSS、`src/App.jsx`；保留已有减少动效规则。
- Test: `tests/e2e/responsive-workspace.spec.mjs`；截图保存到执行验证目录，不写脆弱的全像素快照断言。

**Interfaces:** tokens 覆盖 `--text-primary/secondary/muted`、`--surface-*`、`--selection-*`、`--comparison-a/b/overlap`、字号/间距/点击区；`DisplaySettingsDrawer({settings,onChange,onRestoreHidden})` 与桌面共享同一状态。

- [ ] 固定验收场景：长标题、长限制、650 px 临界宽度、390 px、200% 缩放，以及 1366×768 打开切片；先记录基线。断言所有显示设置仍可达，正文尾部可滚到，单选/焦点不只靠颜色。
- [ ] 运行 `npm run test:e2e -- tests/e2e/responsive-workspace.spec.mjs`；把“设置消失”作为确认失败，其他裁切风险先实测，不凭 CSS 宣布已有错误。
- [ ] 用三种任务布局的视觉稿统一层级，再落地正文/数字字号、对比、间距、状态颜色和可点击区域。窄屏改抽屉/折叠，不删除功能；坐标用等宽数字。保留现有字体选择与兼容回退，不为换风格添加无关依赖。
- [ ] 复测最终计算样式和截图；普通文字≥4.5:1。重要独立控件点击区目标 40×40 px；紧凑表格控制不足该值时检查至少 24×24 px 或满足适用的间距/等效入口要求，并记录例外。实际触控/读屏器未测则不宣称通过。
- [ ] 提交：`feat: improve research readability and responsive controls`。

## X8：统一反馈、精确数量与保存导出解释

**依赖：** S3、W3/W5、E2。**对应：** R16、R41、R42、R43。

**Files:**
- Create: `src/lib/workspace-status.js`、`src/lib/workspace-status.test.mjs`、`src/components/WorkspaceStatus.jsx`。
- Modify: `src/App.jsx`、`src/components/LiteratureWorkspace.jsx`、`src/components/ROICompare.jsx`、`src/components/WorkspaceFiles.jsx`、`src/components/AtlasExplorer.jsx`。
- Test: `tests/e2e/recovery-and-feedback.spec.mjs`。

**Interfaces:** `summarizeEvidenceCounts(bundle,filters) -> {papers,results,coordinates,selected,matching}`；`WorkspaceStatus({status,onRetry,onCancel,onOpenResult})` 消费 S3/W 的状态，不另发请求。

- [ ] 写断言：基线显示“3 篇论文 · 4 条结果 · 8 个坐标”，筛选后全库/匹配/选择数不混用；失败网络重试后功能恢复，已有草稿/影像不丢；公开链接剔除私有层时说明省略内容而不展示私有名称。
- [ ] 运行 `node --test src/lib/workspace-status.test.mjs` 和反馈浏览器用例，确认新行为失败。
- [ ] 统一 loading/empty/error/ready 状态，显示明确重试、取消和结果入口；空搜索提供清除筛选而不是泛称无数据。保存/导出入口明确区分图片、视图链接、完整项目、证据包和 BibTeX，并显示资产/隐私范围。
- [ ] 重跑定向测试；注入首个 manifest 失败、单个图谱失败、计算取消和保存配额失败，检查当前工作仍可恢复。
- [ ] 提交：`fix: clarify workspace status counts and export scope`。

## X9：性能预算与可取消影像处理

**依赖：** W1、S3、X8。**对应：** R44。

**Files:**
- Create: `scripts/profile-workspace.mjs`（汇总允许环境产生的测量，不自行控制桌面浏览器）、`src/workers/nifti.worker.js`、`src/lib/nifti-worker-client.js`、`src/lib/nifti-worker-client.test.mjs`。
- Modify: `src/App.jsx`、`src/lib/nifti.js`、`src/components/ROICompare.jsx`、`vite.config.js`。
- Test: `tests/e2e/performance.spec.mjs`。

**Interfaces:** `parseNiftiInWorker(file,options,{signal,onProgress}) -> ImportedVolume`；`exportNiftiInWorker(volume,{gzip},{signal,onProgress}) -> {bytes:Uint8Array,extension:'.nii'|'.nii.gz'}`。ImportedVolume 沿用 W1/NIfTI 接口，预算由 W1 提供。取消或 worker 错误不返回可注册的部分体积/可下载半成品；不能通过转移 buffer 所有权使工作区原影像被 detach。

- [ ] 在固定设备、网络和输入清单上记录冷启动、热切图谱、常见与上限附近影像、内存峰值和取消响应；不预先编造首屏秒数。写取消不注册半成品、worker 出错不覆盖原项目、导出前后原 data buffer 长度/内容哈希不变的 Node 断言。
- [ ] 运行 `node --test src/lib/nifti-worker-client.test.mjs` 确认新接口失败；建立性能记录文件，缺设备数据就保持空缺及原因。
- [ ] 按测量拆分工作台代码、按需加载影像/几何，并将耗时 NIfTI 解析/导出移到可取消 worker；处理字体网络失败回退。
- [ ] 运行 Node 与 `npm run test:e2e -- tests/e2e/performance.spec.mjs`；检查低配/大输入取消、失败和重试，重测同一基线。
- [ ] 取消反馈目标≤1秒；定位/选择常用交互目标 p95≤200ms，无法满足时明确设备/输入范围与待改项。提交：`perf: make imaging work cancellable and measure responsiveness`。

## X10：成熟查看器评估与同步比较视图

**依赖：** S3/S4、X3、X9。**对应：** R28、R47。

**Files:**
- Create: `docs/VIEWER_EVALUATION.md`、`src/components/ComparisonViewport.jsx`、`src/lib/comparison-link.js`、`src/lib/comparison-link.test.mjs`。
- Modify: `src/components/BrainScene.jsx`、`src/components/SliceViews.jsx`、`src/components/ROICompare.jsx`。
- Test: `tests/e2e/linked-comparison.spec.mjs`。

**Interfaces:** `ComparisonViewport({left,right,linkCamera,linkCrosshair,onPoint})`，左右数据都携带 AssetIdentity；`canLinkCoordinates(left,right,transform) -> {allowed,reason}`。没有同空间依据或已记录变换时不得联动坐标；并排观看本身不宣称配准成功。

- [ ] 写断言：同参考左右十字线与相机可同步；未知空间/无变换时 linked-crosshair 禁用并给理由；关闭联动后右视图不再跟随左视图。
- [ ] 运行 `node --test src/lib/comparison-link.test.mjs` 确认新行为失败。
- [ ] 在隔离原型对照现有 Three.js 与 NiiVue 的坐标、表面、阈值、状态恢复、许可和性能。形成保留/替换/局部复用决定，不能因有新库而默认重写；即使暂不采用新库，同步比较仍按当前底层实现。
- [ ] 实现双脑/双切片、联动开关和清晰的左右来源。运行 `npm run test:e2e -- tests/e2e/linked-comparison.spec.mjs`，对两套同参考数据、不同图谱和空间不兼容场景验证。
- [ ] 提交：`feat: add source-aware linked comparison views`。查看器评估单独记录决定与再评估条件；未采用方案不标为已实现。

## X11：版本化公开结果页的入口与可发现性

**依赖：** E6、W5、X3/X8。**对应：** R24、R25。

**Files:**
- Modify: `src/App.jsx`、E6 创建的 `src/components/ResultRecordPage.jsx`、`index.html`、`scripts/build-public.mjs`。
- Create: `src/lib/public-result-route.js`、`src/lib/public-result-route.test.mjs`、`scripts/build-result-pages.mjs`。
- Test: `tests/e2e/public-result-page.spec.mjs`。

**Interfaces:** `parsePublicResultRoute(search) -> {resultId,dataVersion}|null`；页面消费 E6 的 `buildPublicResultRecord`，不从浏览器私有 evidence 查询公开内容。初版参数入口使用 `?result=<id>&version=<dataVersion>`，生成可引用静态落地页时保持对应身份。省略 version 只能明确跳转到带版本的最新公开地址；显式给出的未知版本不能被最新版本替代。

- [ ] 写断言：公开发布清单内的版本/结果可解析；未知版本显示不存在/不可获取，不能静默读最新；私有结果ID、自由文本和本地影像均不能被路由公开。
- [ ] 运行 `node --test src/lib/public-result-route.test.mjs` 确认新增入口失败。
- [ ] 挂载页面和返回工作区入口；为公开结果生成含标题、引用、版本、来源与限定条件的落地内容，保留无脚本可读的基本信息和规范链接。尊重第三方许可，不嵌入未经授权的全文/图像。
- [ ] 运行公开构建及 `npm run test:e2e -- tests/e2e/public-result-page.spec.mjs`，检查 GitHub Pages 子路径、直接打开/刷新、未知版本、中英文和清单外私有记录。
- [ ] 提交：`feat: expose versioned public research result pages`。上线与否由总计划 G1 的实际发布步骤决定，生成页面不等于已发布。

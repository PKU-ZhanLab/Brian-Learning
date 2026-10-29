# NeuroAtlas：交互、可访问性与响应式静态核查

日期：2026-10-29。范围：当前 `src`，面向研究人员的日常操作与阅读。未运行浏览器、读屏器或触屏测试；以下 CSS 尺寸为源码声明或可推导尺寸，色彩比值为 sRGB 相对亮度计算，不能称为浏览器实测。未修改应用源码。

## 优先问题

### 1. 弹窗显示后，键盘焦点仍可留在背景；新面板不响应 Escape

- 证据：`src/App.jsx:107` 的全局 Escape 只清空 `modal`、`searchOpen` 和 `boxSelect`。`src/App.jsx:212`–`215` 分别挂载图谱浏览、保存窗口、结果坐标及普通弹窗。`src/components/WorkspaceFiles.jsx:10`、`src/components/AtlasExplorer.jsx:47` 有 `role="dialog" aria-modal="true"`，但没有打开时移动焦点、Tab 范围限制、背景 inert 或关闭时恢复焦点的实现。`src/components/ResultCoordinates.jsx:11` 为非 modal dialog，也没有焦点入口与 Escape 处理。
- 影响：用键盘打开“项目与视图”后仍可能继续操作被遮住的主界面；按 Escape 不能退出保存或图谱浏览。图谱浏览内再打开保存窗口时会叠加两个声明为 modal 的区域。
- 建议：统一 dialog 管理；按层级只激活最上层。打开时聚焦标题或首个控件；Tab/Shift+Tab 保留在 modal 内，Escape 关闭最上层，关闭后返回触发按钮。非模态坐标面板则提供明确的焦点进入及返回机制。
- 验收：仅用键盘依次打开普通弹窗、图谱浏览、其内的保存窗口；后台不能收到键盘激活，Escape 每次只关闭一层，焦点按打开路径返回。

### 2. 手机与高倍缩放下，显示设置被直接移除，没有替代入口

- 证据：`src/styles.css:9` 的 `@media(max-width:650px)` 将 `.left-panel .display-controls` 设为 `display:none`。`src/App.jsx:183` 中该区域拥有皮层透明度、半球分离、悬浮标签、结构示意、临床拓展，以及“恢复隐藏结构”。这些控件未在其他窄屏菜单中重新提供。
- 影响：缩小窗口后不能调整这些状态；若宽屏时已开启半球分离或隐藏多个结构，进入窄屏后无法用同一控件恢复。手机用户也无法开启临床内容。
- 建议：改为可展开的“显示设置”抽屉/折叠区，保留控件与当前状态；固定高度布局可收起而不删除能力。
- 验收：390、650 CSS px 宽度，以及桌面 200% 缩放条件下，所有显示设置均能由键盘和触控到达，并能恢复之前的状态。

### 3. 研究阅读与坐标信息的字号、对比度不足，淡色层级压过了信息层级

- 证据：`src/styles.css:5` 中 `.coordinates-bar` 是 9 px、`#9ba591` / `#fbfcf8`，计算对比度 2.49:1；坐标数值是同样 9 px、`#73836a`，3.93:1。`src/styles.css:10` 的 `.voxel-info small` 为 8 px、`#92a087` / `#f2f5ee`，2.51:1；后置 `.knowledge-section p` 是 12 px、`#6e7c67` / `#fcfdfb`，4.34:1。后置 `.reference p` 为 10 px、`#87937d` / 白色，3.23:1。`src/styles.css:18` 图谱可用性说明使用 `--muted:#929b94`，与面板底色为 2.80:1。
- 影响：坐标、作者、图谱限制与说明都是研究决策信息，却比装饰性标题更难读；长时间查阅、普通笔记本屏幕和低视力场景尤其吃力。
- 建议：正文与读数至少采用清晰的 13–14 px 基线，坐标使用等宽/等宽数字；用间距、字重与边框区分层级，避免依靠降低正文对比度。普通文本以至少 4.5:1 为验收目标。
- 验收：对最终浏览器计算样式重新测量；关键读数、正文、参考文献元数据、限制说明均达到目标，200% 缩放后可完整读取。

### 4. 全局焦点样式虽存在，搜索框、图谱选择器、显隐按钮和主画布仍会出现不可见焦点

- 证据：`src/styles.css:5` 先声明 `button/input/select:focus-visible`，随后 `.global-search input` 与 `.select-wrap select` 以相同特异性设置 `outline:none`，覆盖该 outline。结构行末尾显隐按钮默认 `opacity:0`，只有 `:hover`、`.selected`、`.is-hidden` 使其显现，没有 `:focus-visible` 或 `:focus-within` 分支。对应按钮见 `src/App.jsx:181`。`src/components/BrainScene.jsx:244` 给 canvas 行内 `outline:none`，但 `:246` 又设置 `tabIndex=0`。
- 影响：Tab 会落在看不见的显隐按钮或无焦点标识的输入/画布上；用户不能可靠判断下一次空格或 Enter 将触发什么。15 px 高的显示开关（`src/styles.css:5`，27×15 px）也增加指针命中难度，但这里不据此单独宣称标准违规。
- 建议：为这些控件明确恢复焦点样式；结构行用 `:focus-within` 显示末尾按钮。开关的视觉轨道可以保留小尺寸，但外围可点击区域扩大至至少 32–40 px 高。
- 验收：不用鼠标从页面顶端 Tab 遍历；每个焦点位置清晰可见，未选中结构的显隐按钮在聚焦时显现，输入/下拉框/画布均有可辨边框。

### 5. 文献工作台“导入 JSON”不能由纯键盘触发

- 证据：`src/components/LiteratureWorkspace.jsx:68` 用无 `tabIndex`、无键盘处理的 `<label className="evidence-import-label">` 包裹文件输入；`src/components/EvidenceEditor.css:1` 将内部 input 设为 `display:none`。
- 影响：Tab 顺序直接略过这项重要研究工作流；旁边“添加论文”和“导出证据 JSON”可正常用键盘操作，行为不一致。
- 建议：使用真实 button 触发隐藏 file input，或使用可聚焦的原生文件控件并给出清晰标签。
- 验收：从“添加论文”按 Tab 可到达“导入 JSON”；Enter、Space 均打开文件选择器，取消后焦点回到该按钮。

### 6. ROI 对比切片只有鼠标点击能改变交点，缺少键盘和精确数值入口

- 证据：`src/components/ROICompare.jsx:73` 的 ROI 切片 canvas 只有 `onClick`，没有 `tabIndex` 或键盘事件；`:95` 定义 point，`:197` 仅在计算完成时将其设为 ROI 中心，`:278` 仅将 `setPoint` 传给这三个点击画布。ROI 结果区没有对应的 X/Y/Z 数值框或切片滑块。
- 影响：纯键盘用户不能逐层查看 ROI 交集；研究人员无法可靠地转到一个指定小数坐标，而点击缩略图只能近似定位。
- 建议：在 ROI 三视图旁增加共享 X/Y/Z 数值输入和每轴步进/滑块；画布保留点选作为快捷方式。移动后同时更新交点与读数。
- 验收：仅用键盘将交点改到指定 RAS 值，三张切片同步；各轴支持明确步长并可还原 ROI 中心，输入超界时有说明。

### 7. 当前视角、半球、面板与论文对比选择只通过颜色表达，没有可读取的选择状态

- 证据：`src/App.jsx:162` 导航使用 class `current`；`:178` 目录/网络、`:179` 半球按钮、`:193` 标准视角仅用 `selected` class，没有 `aria-current`、`aria-pressed` 或选项组选中语义。`src/components/LiteratureWorkspace.jsx:87` 论文对比图标也仅切换 class `active`，aria-label 始终为“对比论文 + 标题”。现有开关使用 `role=switch/aria-checked`（`src/App.jsx:47`），可以作为一致实现的基础。
- 影响：读屏器能读到按钮名称，却无法知道当前处于哪个视角/半球、某篇论文是否已加入比较；再次按下时也不知道是加入还是移除。
- 建议：为可切换按钮提供 `aria-pressed`；互斥项使用合适的 radio/tab 模式；导航当前项提供准确的 current 状态。论文对比按钮根据状态明确“加入/移除”。
- 验收：用浏览器可访问性树检查当前模式/半球/视角；每组只有正确的一项选中，论文对比加入和移除均能被读屏器辨认。

### 8. 文献对照被限制在侧栏，横向滚动会把比较维度一起卷走

- 证据：`src/components/LiteratureWorkspace.css:1` 默认研究区右栏为 410 px，`.literature-scroll` 左右 padding 各 17 px；扣除边框后内容约 374 px。`:2` 大屏右栏仅增至 460 px，内容约 424 px。`src/components/EvidenceEditor.css:1` 的 `.evidence-matrix table` 最小宽 650 px、数据列最小宽 175 px，且首列未 sticky。比较内容见 `src/components/LiteratureWorkspace.jsx:71`–`73`。
- 影响：即使 1550 px 以上桌面屏幕，两篇研究的条件、样本和结果对照仍需来回横滚；横滚后“任务/样本/结果”等行标签离开视野，增加对错行的负担。
- 建议：为比较增加展开至主工作区/全宽的操作，保持首列和列标题可见；普通阅读卡片保留在侧栏即可。
- 验收：在 1366×768 和 1920×1080 下比较至少两篇论文，展开后能同时看到比较维度与两篇数据；横滚更多论文时行标签和列标题保持可见。

## 已具备的支持与待浏览器核实的风险

- 全局 `:focus-visible` 已存在；不能笼统说“没有键盘焦点样式”。CSS 减少动效规则也存在于 `src/styles.css:14`。主场景没有发现应持续播放却绕过该规则的动画，未将减少动效列为缺陷。
- 常规三视图已有原生 range 输入，主视图也提供标准视角、缩放、重置按钮；因此没有将整个产品笼统归为“只能鼠标操作”。第 6 项限定为 ROI 对比自己的交点。
- `src/styles.css:8`–`9` 在 ≤1000 px 时将右卡片改为 `display:block`、`max-height:550/620px`，同时继承 `overflow:hidden`；正文滚动区另限高 340/410 px。上方标题、体素说明、按钮与正文总高可能超过父容器。需要浏览器用长标题/长说明核实是否截断，尚不作为确定缺陷。
- `src/styles.css:11` 在宽度 >1000 px、视口高 ≤849 px 且打开切片时令应用最小高度 865 px；这会要求页面纵向滚动，但不能仅凭代码认定内容永久不可达。


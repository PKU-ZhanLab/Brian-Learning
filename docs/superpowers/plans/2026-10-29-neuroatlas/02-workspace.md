# NeuroAtlas 工作区、导入导出与复现 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让项目打开、合并、影像导入、保存和重新计算遵守同一个完整性边界，保存用户实际展示的结果，并明确历史结果是否可复现。

**Architecture:** 将校验、暂存和提交从 `App.jsx` 的多次副作用中抽出；项目只拥有自己的资产，打开与合并采用不同操作。保存稳定的结果图层引用、原始计算快照和计算身份；读取旧格式时保留缺失信息，不补造历史来源。所有新增模块及接口均为本计划的提案，尚未实现。

**Tech Stack:** 现有 React 19、JavaScript ES modules、浏览器 Storage/Crypto/CompressionStream、Node `node:test`；使用仓库现有环境，不新增运行依赖。

**Spec:** [./00-spec.md](./00-spec.md)

## Global Constraints

- 本轮只写计划；任务中的代码、测试、提交命令均留待实施，不修改生产代码、不安装依赖、不发布。
- 本文所有 `src/`、`tests/`、命令路径均相对 G0 确认的 `.deployment/source/` 执行 checkout；G0 先检查它与根目录副本的差异并复制合成 fixtures，不能同时修改两个源码副本。共享入口 `src/App.jsx`、`src/components/ROICompare.jsx`、`src/components/LiteratureWorkspace.jsx` 只能由协调者按顺序接入，不能交给多个并行写者。
- `AtlasRegionRef={atlasId,atlasVersion,labelId,hemisphere,spaceId}`、`AssetIdentity={id,version,sha256,spaceId}`、`ComputationManifest={appVersion,algorithmVersion,inputs:AssetIdentity[],transforms:[{id,sha256}],sourceGrids,targetGrid,interpolation,thresholds,labelSets}`、`ResultLayer={layerId,resultId,coordinateIds,sourceReferenceId,spaceId,visible,style}` 与总规格一致，不另起同义字段。
- 共用契约由 G0 的 `src/lib/research-contracts.js` 定义；`src/lib/computation-manifest.js` 唯一实现者为 S5；证据的 `brain-evidence-v2`、`migrateEvidence`、`validateEvidence` 唯一实现者为 E2，本计划只消费它们。
- 新写项目为 `neuroatlas-project-v2`；继续读 `neuroatlas-project-v1`，缺失历史身份标记 `missing-provenance`，不能把当前版本和当前计算冒充保存时的事实。
- 所有失败导入必须保留导入前的持久化键值、批注、证据、注册影像、活动视图、相机、结果图层和进行中的编辑内容；校验及容量检查通过前没有发布动作。
- 保留 NIfTI 结构上限 `64_000_000` 体素；文件 `128 * 1024 * 1024` 字节；项目最多 `50` 个影像、总原始导出影像及计算快照负载 `256 * 1024 * 1024` 字节、JSON 文件 `180 * 1024 * 1024` 字节。上限是组合约束，不保证所有 64M 体素类型均可导入。
- 标签 `name/zh` 最多 `2000` 字符，空间名 `160` 字符，来源说明 `20000` 字符；必须拒绝超限值，不静默截断。导入和导出使用同一套限制。
- 公开视图链接只包含内置公开记录可重建的设置；不得出现私有记录 ID、自由文本、文件名、来源说明、坐标内容或自定义影像身份。
- 测试采用审查探针的内存存储模型和新建合成小数据；不读取、覆盖或导出用户真实研究记录，不分配 512 MB 来验证 64M float64 拒绝路径。
- 浏览器回归使用 G0 配置的 `tests/e2e/*.spec.mjs`、`playwright.config.mjs` 和 `npm run test:e2e -- <path>`；不运行隐式下载的 npx。CI 许可/runner 可用后执行自动化，桌面交互验收走 CUA。
- 清单加载/重试、取消与主线程响应预算交由交互计划；空间一致性和数值算法交由空间计划；草稿自动保存、逐条撤销交由交互计划。本计划只规定其事务边界与存储接入点。

## Review Focus

- 压缩很小、解码后巨大或经过缩放转成 float64 的 NIfTI：在分配完整数据前按实际目标类型拒绝，流也必须有上限（W1）。
- 旧项目缺依赖、晚到的异步导入、存储配额异常：当前工作区及所有持久化键值不变，不能让旧任务覆盖新项目（W2）。
- 相同 ID 指向不同内容，或排除/移除正在使用的资产：先展示精确影响，只有明确合并才重映射引用，不产生悬空引用（W2/W3）。
- 换文件或失败后重试仍残留上一文件的配准确认、标签表：每次新文件绑定独立的声明与摘要（W4）。
- 公开论文下的私有结果、已缺失的坐标、缺历史哈希的 v1 项目：公开链接不泄露，缺失图层不被默默换成别的点，历史结果不被静默重算（W5/W6）。

---

## 文件边界与交付顺序

| 文件 | 单一职责 / 写入者 |
|---|---|
| `src/lib/workspace-limits.js` | 共享元数据、计数及字节预算，W1 |
| `src/lib/workspace-session.js` | 无副作用暂存、版本检查、单次提交、显式合并，W2 |
| `src/lib/custom-volumes.js` | 当前项目注册表的快照替换和订阅，W2 |
| `src/lib/workspace-assets.js` | 资产依赖、移除计划、导出选择闭包，W3 |
| `src/components/WorkspaceAssets.jsx` / `.css` | 资产列表、依赖提示、导出清单，W3 |
| `src/lib/roi-import-state.js` | 单个文件的声明状态与确认摘要，W4 |
| `src/lib/result-layers.js` | 图层校验、证据解析和公开投影，W5 |
| `src/lib/saved-computation.js` | 消费 S5 的身份比较，保存计算与显式重算决定，W6 |
| `src/lib/workspace-project.js` | 项目/视图编解码，由 W1 → W5 → W6 顺序编辑 |
| `src/lib/nifti.js` | 有界解码与共享表格校验，W1；保持 PAM50 专用读取器不变 |
| `src/components/WorkspaceFiles.jsx` | 打开/合并和导出预览入口，W2 → W3 顺序编辑 |
| `src/App.jsx`、`ROICompare.jsx`、`LiteratureWorkspace.jsx`、`src/lib/roi.js`、`roi.worker.js`、`volume.js` | 只由协调者按对应任务接入；与空间/证据/交互计划对齐后写入 |

顺序为 G0 → W1 → W2 → W3/W4 → W5 → W6。W2 等待 E2 的证据迁移/校验契约；W5 等待 E2 的结果衍生模型；W6 等待 S5 的身份清单。W3/W4 的纯模块可并行，公共组件仍顺序接入。W5 的图层 UI 由交互计划使用，W6 的真实资产哈希来自空间计划的数据身份检查。

### W1: 统一导入、导出与内存准入规则

**Files:**
- Create: `src/lib/workspace-limits.js`, `src/lib/workspace-limits.test.mjs`
- Modify: `src/lib/nifti.js:2-5,34-52,74-119,153-172`, `src/lib/workspace-project.js:53-130`
- Test: `src/lib/nifti.test.mjs`, `src/lib/workspace-project.test.mjs`

**Interfaces（提案）:**
- `validateVolumeMetadata(input) -> normalizedMetadata`、`validateLabelRows(rows) -> labels`：无修改输入，错误为稳定代码；复用现有导出白名单。
- `assertWorkspaceBudget({assetCount,rawPayloadBytes,compressedAssetBytes:number[],projectUtf8Bytes}) -> void`：`rawPayloadBytes` 计入每个影像的 `352 + data.byteLength` 和 W6 保存的计算负载；数组逐项检查 128 MiB，其余计数为安全整数。精确通过 `<=`，超限拒绝。
- `parseNifti(input, {...existingOptions,maxDecodedVoxelBytes,maxInflatedBytes}) -> Promise<volume>`：调用者传入剩余预算；输出类型受 scaling 影响，必须在创建完整 typed array 前检查。默认值仍不得放宽现有硬上限。
- `src/lib/workspace-project.js` 的 `prepareProjectPayload(workspace) -> Promise<{text,usage,encodedAssets}>`：有界压缩及 JSON 编码，最终字节数校验通过后才返回；导入准入与下载复用结果，不能各用一套估算。现有 `serializeProject` 委托此函数并返回 text。

- [ ] **Step 1: 添加失败用例。** 测试名 `shared metadata boundaries`、`scaled decode admission precedes allocation`、`aggregate capacity is export symmetric`；用虚拟大小描述符、352 字节合成头和注入的分块流验证大尺寸分支。

```js
assert.doesNotThrow(() => validateLabelRows([{id:1,name:'x'.repeat(2000)}]));
assert.throws(() => validateLabelRows([{id:1,name:'x'.repeat(2001)}]), /label-name-too-long/);
assert.throws(() => assertWorkspaceBudget({...smallUsage,assetCount:51}), /asset-count/);
assert.throws(() => assertWorkspaceBudget({...smallUsage,rawPayloadBytes:256*1024*1024+1}), /decoded-budget/);
await assert.rejects(parseNifti(float64Header,{maxDecodedVoxelBytes:256*1024*1024-352}), /decoded-budget/);
assert.equal(allocationSpy.fullVolumeCalls, 0); // 64M float64 / scaling-to-float64 被拒绝
assert.deepEqual(restored.volumes[0].labels, accepted.volumes[0].labels);
```

另逐项断言 `space=160/161`、`provenance=20000/20001`、50/51 个资产、压缩负载 128 MiB/加一字节、最终 JSON 180 MiB/加一字节；元数据错误与累计拒绝均不触发注册。标签表原始文件 2 MiB、标签数 50,000、规范化 JSON 4 MiB 限制同样共享；保留 name 500、source 4096、license 10000、note 20000、limitations 100 × 4000 等现有白名单限制。

- [ ] **Step 2: 运行失败用例。** `node --test src/lib/workspace-limits.test.mjs src/lib/nifti.test.mjs src/lib/workspace-project.test.mjs`；预期新增共享接口缺失或 2001 字符仍被接受，其余原有断言不得删除。
- [ ] **Step 3: 实现共享校验和有界准入。** gzip 解码先读有界头、检查尺寸/offset/scaling/输出字节，再继续有界流读取；流超过剩余预算立即取消。元数据在读大文件前检查；完整候选项目经过有界压缩、base64 和 UTF-8 精确计数后才准入。之后任何批注/证据/快照修改也必须调用同一预算入口，防止后续编辑使已准入工作区无法导出。取消/进度由交互计划提供的 worker 外壳接入，不在此任务另造调度器。
- [ ] **Step 4: 运行通过检查。** 重跑 Step 2 命令；预期全部 PASS。检查 2000 字符成功 import → export → import，2001 字符在注册前失败；大容量测试没有真实大数组。
- [ ] **Step 5: 提交。** `git add src/lib/workspace-limits.js src/lib/workspace-limits.test.mjs src/lib/nifti.js src/lib/nifti.test.mjs src/lib/workspace-project.js src/lib/workspace-project.test.mjs`；`git commit -m "fix: share workspace admission and export limits"`。

### W2: 原子打开与显式合并，建立项目资产所有权

**Files:**
- Create: `src/lib/workspace-session.js`, `src/lib/workspace-session.test.mjs`
- Modify: `src/lib/custom-volumes.js:1-16`, `src/components/WorkspaceFiles.jsx:5-10`
- Test: `tests/e2e/workspace-import.spec.mjs`
- Coordinator integration: `src/App.jsx:46-57,99-105,132-147`, `src/components/LiteratureWorkspace.jsx` 的证据保存入口，`src/components/ROICompare.jsx:234-235` 的资产注册入口

**Interfaces（提案）:**
- `WorkspaceSnapshot={projectId,revision,view,notes,evidence,drafts,volumes,roiSnapshot,recomputedSnapshot}`，图层权威仅为 `view.resultLayers`；drafts 默认 []，结构与预算按 00-spec 的 DraftRecord，由 X5 提供严格校验并接入此事务。`Stage={baseRevision,next,persistedJSON,preview}`，后两项由完整检查生成，不能让 UI 手拼。
- `stageWorkspaceChange(next,{current}) -> Promise<Stage>`：通用完整候选校验入口，现有影像导入、批注保存和 E2 证据编辑均先走此入口再 commit；W4 仅追加逐文件状态管理，不承担补救事务旁路。
- `stageProjectImport(text,{current,mode:'open'|'merge',knownEvidence,makeId}) -> Promise<Stage>`：仅计算，不写 Storage、注册表或 React；先调用 E2 的 `migrateEvidence`/`validateEvidence` 并验证项目跨记录引用，再调用 W1 准入，不重写证据校验。
- `preview={mode,includedAssetIds,removedAssetIds,collisions,remap,changedReferenceCounts}`；重名不等于重复内容，碰撞按 `(recordKind,id)` 区分。
- `createWorkspaceSession({storage,initial}) -> {getSnapshot,subscribe,commit(stage)}`；`commit` 检查 `baseRevision`，对 `neuroatlas-workspace-current-v1` 做一次 `setItem` 后同步替换已验证快照，通知订阅者。持久 envelope 仅含 notes/evidence/view/drafts（resultLayers 在 view 中）及容器 projectId/revision，不把原始影像或 ROI binary 塞进 localStorage；影像仍通过项目文件恢复。草稿计入序列化和存储预算，不能因自动保存而绕过原子提交。
- `replaceCustomVolumes(projectId,volumes) -> void` 和 `listCustomVolumes(projectId) -> volume[]`：只能由 session 提交路径发布，旧 `getCustomVolume`/订阅读取当前项目投影。新写者不得绕过准入直接注册。

- [ ] **Step 1: 将 E1/E2 探针改写成正式失败用例。** `workspace-session.test.mjs` 定义小型 `makeWorkspace()`、可枚举全部键的 `memoryStorage()`、注入 `QuotaExceededError` 的存储器；只复用探针思路，不再用正则提取 JSX 执行。

```js
const before = {storage:storage.entries(), snapshot:session.getSnapshot(), volumes:listCustomVolumes('A')};
await assert.rejects(stageProjectImport(missingVolumeText, options), /missing-asset/);
assert.deepEqual(storage.entries(), before.storage);
assert.strictEqual(session.getSnapshot(), before.snapshot);
assert.deepEqual(listCustomVolumes('A'), before.volumes);
assert.throws(() => session.commit(staleStage), /stale-workspace/);
assert.deepEqual(exportedB.volumes.map(v=>v.id), []); // A(私有影像) → 打开 B(零影像)
```

同样覆盖无效证据、坏坐标引用、配额失败；在全部键中预置 language、saved-views、草稿哨兵值，失败后逐字节相等；UI 捕获 view/camera/resultLayers/notes/evidence 的引用与值均不变。成功提交只通知一次，所有订阅读取同一 revision。两个并发打开只允许当前 revision 的最终确认提交。

- [ ] **Step 2: 运行失败用例。** `node --test src/lib/workspace-session.test.mjs src/lib/workspace-project.test.mjs src/lib/evidence-workspace.test.mjs`；预期新接口缺失或旧行为泄漏 A 的资产。
- [ ] **Step 3: 实现暂存与单点提交。** 禁止“先 saveEvidence，再 setNotes，再恢复视图”；旧 notes/evidence 键在首次迁移时只读、不删，成功写入 authoritative envelope 后所有运行中读写经 session。准备持久 JSON、注册表 Map、纯视图状态在唯一 `setItem` 前完成；存储失败不得触发 state/ref/注册表修改。通知监听器的错误不能回滚已完成提交或阻止其他监听器读取同一快照。协调者移除旧自动写 notes 的旁路 effect，将证据编辑与现有 ROI 导入注册回调接入 `stageWorkspaceChange`，使本任务完成时已有导入功能仍可用。
- [ ] **Step 4: 实现并验证合并预览。** 默认“打开”替换项目所有权；“合并到当前项目”单独按钮，先预览再提交。相同 ID/相同内容可复用；相同 ID/不同内容保留双方，为传入记录生成新 ID，仅重写传入记录的影像、论文、结果、坐标、关系、图层、ROI、图谱查看器和计算清单引用。打开不继承旧项目、不因旧项目碰撞而改 ID；默认合并不覆盖现有条目、不自动按 DOI 覆盖。测试明确 `existing.id/content` 不变、`incoming.layer.resultId` 指向 remap、无悬空关系。重跑 Step 2，预期 PASS；再运行 `npm run test:e2e -- tests/e2e/workspace-import.spec.mjs`，验证实际组件在失败及预览取消后存储/UI 均不变。
- [ ] **Step 5: 提交。** `git add src/lib/workspace-session.js src/lib/workspace-session.test.mjs src/lib/custom-volumes.js src/components/WorkspaceFiles.jsx src/components/LiteratureWorkspace.jsx src/components/ROICompare.jsx src/App.jsx tests/e2e/workspace-import.spec.mjs`；`git commit -m "fix: open and merge projects through an atomic session"`。

### W3: 资产移除、依赖检查与按选择导出

**Files:**
- Create: `src/lib/workspace-assets.js`, `src/lib/workspace-assets.test.mjs`, `src/components/WorkspaceAssets.jsx`, `src/components/WorkspaceAssets.css`
- Test: `tests/e2e/workspace-assets.spec.mjs`
- Modify: `src/components/WorkspaceFiles.jsx`, `src/components/WorkspaceFiles.css`
- Coordinator integration: `src/App.jsx:146,213`, `src/components/ROICompare.jsx:265`

**Interfaces（提案）:**
- `planAssetRemoval(snapshot,assetId) -> {assetId,dependentViewFields,dependentResults,next}`：只列影响并生成候选；被移除影像关联的当前叠加/选择须解除，历史数值保留且标记 `missing-input`，批注和证据不删除。
- `planProjectExport(snapshot,{assetIds,dependentPolicy:'include'|'detach'}) -> {workspace,preview}`：只允许当前 projectId 的资产；`include` 加入依赖闭包，`detach` 从导出副本解除相关视图选择并保留历史数值/缺输入状态；不修改工作区。
- `WorkspaceAssets({snapshot,onRemovePlan,onExportPlan})`：名称、类型、空间、字节、使用处、勾选导出；所有按钮提交 W2 的 Stage，不能直接调用 `removeCustomVolume`。

- [ ] **Step 1: 添加失败用例。** 测试 `only current project assets are exportable`、`removal detaches references without deleting research`、`selection export is explicit and pure`。

```js
assert.deepEqual(planProjectExport(B,{assetIds:[],dependentPolicy:'detach'}).workspace.volumes, []);
assert.throws(() => planProjectExport(B,{assetIds:['custom-A-private'],dependentPolicy:'include'}), /foreign-asset/);
assert.deepEqual(removal.next.notes, before.notes);
assert.deepEqual(removal.next.evidence, before.evidence);
assert.equal(removal.next.roiSnapshot.status, 'missing-input');
assert.deepEqual(current, before); // 预览、取消和选择导出均无副作用
```

包含：移除未使用资产；移除 ROI A 且保留 B 的来源、阈值与选择；导出排除依赖时预览明确列出将解除的视图及历史结果；一项超限/坏元数据导致失败后，仍可移除该项并导出其余内容。

- [ ] **Step 2: 运行失败用例。** `node --test src/lib/workspace-assets.test.mjs src/lib/workspace-session.test.mjs`；预期新增接口缺失。
- [ ] **Step 3: 实现纯资产计划与组件。** 预览显示资产名称/数量/大小/依赖及包含的本地证据；“完整项目”默认只选当前项目全部资产，“选择内容导出”允许取消勾选并明确依赖策略；只有最后确认才下载。移除依赖资产时提供影响摘要与取消，确认后使用 W2 原子提交。配额错误保留列表/选择/研究内容。
- [ ] **Step 4: 运行通过检查。** 重跑 Step 2 及 `node --test src/lib/workspace-project.test.mjs`，预期 PASS；`npm run test:e2e -- tests/e2e/workspace-assets.spec.mjs` 使用合成 A→B→导出验证清单与导出 IDs 完全一致，再移除一个使用中的资产确认可恢复导出。此浏览器验收在实施阶段执行。
- [ ] **Step 5: 提交。** `git add src/lib/workspace-assets.js src/lib/workspace-assets.test.mjs src/components/WorkspaceAssets.jsx src/components/WorkspaceAssets.css src/components/WorkspaceFiles.jsx src/components/WorkspaceFiles.css src/components/ROICompare.jsx src/App.jsx tests/e2e/workspace-assets.spec.mjs`；`git commit -m "feat: manage project assets and preview scoped exports"`。

### W4: 每个 NIfTI 文件独立确认空间与标签表

**Files:**
- Create: `src/lib/roi-import-state.js`, `src/lib/roi-import-state.test.mjs`
- Test: `tests/e2e/roi-import.spec.mjs`
- Coordinator integration: `src/components/ROICompare.jsx:221-265`, `src/components/ROICompare.css`

**Interfaces（提案）:**
- `newImportDraft(fileToken) -> {fileToken,kind:'label',spaceId:'native-unverified',otherSpace:'',aligned:false,provenance:'',labelFile:null}`；token 为本次文件选择的唯一 ID，不能只由文件名推断同一文件。
- `reduceImportDraft(state,action) -> state`：`file-changed` 全部重置；`space-changed` 清空 aligned；`label-file-changed` 绑定当前 token；不得跨文件复用确认。
- `prepareImportSummary(draft,{file,labelFile}) -> {fileToken,fileName,kind,spaceId,labelFileName,provenance,alignmentStatus}`；长度复用 W1。
- `stageVolumeImport(draft,{file,labelFile,current,signal}) -> Promise<Stage>`：解码/准入使用 W1，成功候选交 W2；结束时 token/revision 不符则丢弃，不注册。

- [ ] **Step 1: 添加失败用例。** 测试 `changing image resets alignment and table`、`same filename is a new declaration`、`stale import never registers`。

```js
const next = reduceImportDraft(confirmedA,{type:'file-changed',fileToken:'B'});
assert.equal(next.spaceId,'native-unverified');
assert.equal(next.aligned,false);
assert.equal(next.labelFile,null);
assert.equal(next.provenance,'');
assert.equal(next.kind,'label');
assert.equal(registrationCallsAfterLateA,0);
```

断言旧标签表不能应用到 B；非 MNI152NLin6Asym 文件不能继承叠加许可；该模板的确认必须有当前文件来源说明；失败保留当前文件草稿供修正，成功后摘要对应实际注册数据，重选同名文件再次重置。

- [ ] **Step 2: 运行失败用例。** `node --test src/lib/roi-import-state.test.mjs src/lib/workspace-limits.test.mjs`；预期接口缺失或旧状态残留。
- [ ] **Step 3: 实现 reducer 并顺序接入。** 将独立的 importSpace/aligned/labelFile 等状态收束到当前文件草稿；读文件前呈现“文件—类型—空间—标签表”摘要，导入确认绑定该摘要。标签文件 input 同时清空实际 DOM 值。完成时依据 W2 revision 检查避免旧任务越权发布。取消/重试外观采用交互计划共同状态，不改变当前 ROI A/B 直到准入成功。
- [ ] **Step 4: 运行通过检查。** 重跑 Step 2，预期 PASS；`npm run test:e2e -- tests/e2e/roi-import.spec.mjs` 选择已确认 A，再选择 B（含同名不同内容）验证复选框、空间、标签文件名和来源说明均重置，B 以未验证空间开始。
- [ ] **Step 5: 提交。** `git add src/lib/roi-import-state.js src/lib/roi-import-state.test.mjs src/components/ROICompare.jsx src/components/ROICompare.css tests/e2e/roi-import.spec.mjs`；`git commit -m "fix: bind ROI import declarations to each file"`。

### W5: 保存完整研究结果图层并约束公开分享

**Files:**
- Create: `src/lib/result-layers.js`, `src/lib/result-layers.test.mjs`
- Test: `tests/e2e/result-layers.spec.mjs`
- Modify: `src/lib/workspace-project.js:20-50,109-130`, `src/lib/workspace-project.test.mjs`
- Coordinator integration: `src/App.jsx:63,132-152,191,214`, `src/components/ResultCoordinates.jsx`；结果图层列表 UI 由交互计划负责

**Interfaces（提案）:**
- 消费总规格 `ResultLayer` 与 E2 的 `getResultViewModel(resultId,bundle)`；E2 已将 `results.coordinates` 规范为 `locations`，图层模块只读其衍生模型，不能另遍历旧字段或回写模型。`validateResultLayers(layers,{evidence,publicEvidence}) -> ResultLayer[]` 检查 result/reference/coordinate/space 一致及 ID 唯一；style 只允许 `{color:'#RRGGBB',opacity:0..1,size:1..20}`，不接受自由文本。
- `resolveResultLayers(layers,{evidence,publicEvidence}) -> {layers,markers,unavailable}`：经 `getResultViewModel` 按稳定 location ID 取真实证据坐标（契约字段仍称 coordinateIds）；图层本身不存可漂移的第二份坐标。是否允许主模板叠加使用空间计划的许可判断，不因恢复而升级核查状态。
- `projectPublicResultLayers(layers,{publicReferenceIds,publicResults}) -> {layers,omitted}`：reference/result/coordinate 三者均须属于同一内置公开记录且内容一致；可公开层的 layerId 重写为 `public-layer-1` 等中性 ID，防止用户层名/ID 泄漏。
- `validateViewState` 新增 `resultLayers`；新链接/命名视图使用 `neuroatlas-view-v2`，`decodeView`/`readSavedViews` 兼容 v1（空图层）。`encodeView(input,{publicReferenceIds,publicResults})` 返回不含私有标识的 `omitted:['resultLayers',...]`。

- [ ] **Step 1: 添加失败用例。** 测试 `public result layers round trip without private identifiers`、`project preserves local marker identity and visibility`、`missing coordinate rejects atomic restore`。

```js
assert.deepEqual(restoredLayer.coordinateIds, originalLayer.coordinateIds);
assert.equal(restoredLayer.visible,false);
assert.deepEqual(restoredMarkers.map(m=>m.position), [[1,2,3],[-1,2,3]]);
assert.equal(sharedText.includes('private-result'),false);
assert.equal(sharedText.includes('private-layer-name'),false);
assert.ok(shared.omitted.includes('resultLayers'));
assert.equal(decodeView(oldV1Link).resultLayers.length,0);
```

分别用内置公开 fixture 与本地 fixture 通过项目/命名视图往返；公开论文下自建结果仍排除；公开 ID 碰撞而坐标内容不同也排除。测试隐藏层保存但不输出 markers；无效 coordinateId 在 W2 暂存失败，不先清空当前图层。来源不允许主模板叠加时保留层及不可用原因，不能伪造位置。

- [ ] **Step 2: 运行失败用例。** `node --test src/lib/result-layers.test.mjs src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs`；预期新字段被旧校验丢弃或新函数缺失。
- [ ] **Step 3: 实现图层解析和视图序列化。** `getWorkspaceView` 收集完整稳定图层；`restoreWorkspaceView` 先解析后提交，不无条件 `setStudyMarkers([])`。从同一个 layer store 派生 BrainScene markers 和图层列表；切换论文保持显式图层身份与来源，移除/隐藏行为使用交互计划。分享提示说明“已省略本地结果图层，请用项目文件共享”，不把只保留公开部分称为完整恢复。
- [ ] **Step 4: 运行通过检查。** 重跑 Step 2，预期 PASS；`npm run test:e2e -- tests/e2e/result-layers.spec.mjs` 验证两点一隐藏层的命名视图、公开链接和本地项目恢复，位置/来源/显隐一致，私有文本不进入解码后的链接 JSON。
- [ ] **Step 5: 提交。** `git add src/lib/result-layers.js src/lib/result-layers.test.mjs src/lib/workspace-project.js src/lib/workspace-project.test.mjs src/components/ResultCoordinates.jsx src/App.jsx tests/e2e/result-layers.spec.mjs`；`git commit -m "feat: persist research result layers with safe public projection"`。

### W6: 项目 v2 计算身份、历史快照与显式重新计算

**Files:**
- Create: `src/lib/saved-computation.js`, `src/lib/saved-computation.test.mjs`
- Test: `tests/e2e/workspace-reproducibility.spec.mjs`
- Modify: `src/lib/workspace-project.js`, `src/lib/workspace-project.test.mjs`
- Coordinator integration: `src/components/ROICompare.jsx:175-218`, `src/App.jsx:132-147`；`src/lib/volume.js`、`src/lib/roi.js`、`src/lib/roi.worker.js` 的身份产生与传递由 S5 完成，W6 不重复修改

**Interfaces（提案）:**
- 消费 S5 的 `makeComputationManifest({appVersion,algorithmVersion,inputs,transforms,sourceGrids,targetGrid,interpolation,thresholds,labelSets}) -> ComputationManifest` 与 `compareComputationManifest(saved,current) -> {matches,differences:[{path,saved,current}]}`，实现唯一位于 `computation-manifest.js`；W6 不复制哈希或比较算法。沿用 S5 的 `GridSpec={shape,affine,space,order}`，其 space 显式对应 AssetIdentity.spaceId；labelSets 为按 A/B 输入顺序的 `number[][]`，结合输入的版本/哈希/空间固定标签含义；阈值含 kind/threshold/tail，不能只保存显示文本。`saved-computation.js` 将缺失 manifest 映射为 missing-provenance；具备 manifest 后按 matches 映射 matched/mismatch。
- `SavedComputation={id,manifest,metrics,probabilityMetrics,grid,classes,display,status}`：保存当前 ROI 的原始数值、共享网格和紧凑 Uint8 classes；maskA/maskB/surfaces 可从 classes 派生，不重新采样来源。classes 单独有界 gzip/base64，计入 W1 的 256 MiB/180 MiB 预算。
- `restoreComputation(saved,{currentManifest,decision:'inspect-saved'|'recompute'}) -> {saved,status,canRecompute}`：默认 inspect-saved，不发送 worker；明确 recompute 后新增计算 ID，原始 `roiSnapshot` 保持不变，新结果保存为 `recomputedSnapshot`，两份负载都计入 W1 容量；不得原位覆盖历史快照。
- 项目 v2 增加 `projectId`、`drafts`、`roiSnapshot`、`recomputedSnapshot`、`provenanceStatus`；`resultLayers` 存在 `view.resultLayers`，避免顶层与视图产生双份权威。`migrateProjectV1(value) -> v2`，v1 的 drafts 为 []，未保存的两个 snapshot 为 null，缺失历史 manifest 保持 null，并报告 `missing-provenance`；证据部分委托 E2 `migrateEvidence`。迁移时新生成 projectId 是容器身份，不是历史数据版本。X5 接入后应验证未完成草稿随完整项目往返且不进入公开 URL。

- [ ] **Step 1: 添加失败用例。** 测试 `manifest mismatch blocks silent recompute`、`saved numerical result survives version drift`、`v1 migration never fabricates provenance`；合成 2×2×1 数据即可。

```js
assert.equal(compareComputationManifest(saved,current).matches,true);
assert.equal(compareComputationManifest(saved,{...current,algorithmVersion:'roi-v-next'}).matches,false);
assert.equal(workerCallsAfterRestore,0);
assert.deepEqual(reopened.roiSnapshot.metrics, original.metrics);
assert.deepEqual([...reopened.roiSnapshot.classes], [...original.classes]);
assert.equal(migrated.provenanceStatus,'missing-provenance');
assert.equal(migrated.roiSnapshot,null);
assert.equal(migrated.view.roi.computed,false);
```

再分别改一字节输入、源/目标哈希、transform ID、transform 哈希、affine、插值、threshold/tail、labelSets；各自报告字段级差异。同身份/同算法 fixture 显式重算的计数及确定性指标相同；有漂移时先保留旧数值，用户明确重算才生成新 ID。v1 旧 `computed:true` 只能表示过去选过计算，不得触发当前自动计算；保留旧选择及显示设置。

- [ ] **Step 2: 运行失败用例。** `node --test src/lib/saved-computation.test.mjs src/lib/workspace-project.test.mjs src/lib/roi.test.mjs`；预期无 manifest/快照或旧 restore 自动重算。
- [ ] **Step 3: 实现 v2 编解码与快照恢复。** 原样持久化 S5 提供的输入/transform/算法身份及比较报告；不根据当前安装版本推断旧项目的历史身份。哈希 bytes 定义、加载时核验、worker 传播由 S5 负责。缺少原始身份的旧项目仅可记录“本次读取观察到的哈希”，不可回填保存时身份；即使 legacy `computed:true` 也只恢复选择并显示缺少历史结果。
- [ ] **Step 4: 顺序接入恢复与导出。** 移除 ROI `computed` 自动触发计算路径；提供“查看已保存结果／按当前数据重新计算”的明确状态及差异列表；CSV 增加 app/algorithm/input/transform/sourceGrid/targetGrid 参数身份，并提供伴随 manifest JSON。W1 保证快照准入；W2 负责恢复原子性；W3 删除来源资产时旧快照保持 missing-input。公开链接不得携带私有计算清单，只能保存可公开重建的选择。
- [ ] **Step 5: 验证。** 重跑 Step 2，再运行 `node --test src/lib/workspace-limits.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-assets.test.mjs src/lib/roi-import-state.test.mjs src/lib/result-layers.test.mjs` 及 `npm run test:e2e -- tests/e2e/workspace-reproducibility.spec.mjs`；预期全部 PASS。协调者最后统一运行 `npm run check` 和 `npm run build:public`，禁止并发构建相同输出目录。
- [ ] **Step 6: 提交。** `git add src/lib/saved-computation.js src/lib/saved-computation.test.mjs src/lib/workspace-project.js src/lib/workspace-project.test.mjs src/components/ROICompare.jsx src/App.jsx tests/e2e/workspace-reproducibility.spec.mjs`；`git commit -m "feat: preserve project computation provenance and saved results"`。

## 覆盖与实施验收边界

本段的“工程发现”指原工程审查编号，不是 03-evidence.md 的任务编号：工程发现 E1 → W2；工程发现 E2 → W2/W3；工程发现 E3 → W1/W3/W4；工程发现 E4 → W5；工程发现 E6 → W6。工程发现 E5 清单失败恢复在 S3/X8，性能测量在 X9；必须使用本计划的 session revision，不能通过重置项目恢复网络。UX 的逐文件声明问题 → W4；结果图层 UI → W5 接口＋X4；草稿保存/撤销 → X5，接入 W2 的持久化边界。

审查依据为 `output/audit-20261029/engineering-review.md`、`engineering-probes.mjs`、`engineering-probes.json` 和当前源码。三个探针仅证明内存/处理器级重现；计划中的浏览器用例、容量边界测试、保存恢复验收尚未执行，不能把写完计划称为缺陷已修复。

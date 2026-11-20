# NeuroAtlas 空间身份与分析可追溯性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每个图谱标签、每次定位和每次 ROI 计算保留真实来源与独立身份，消除组织误配、陈旧查询和无法解释的采样损失，并建立明确标注验证范围的空间质量流程。

**Architecture:** 用稳定标签引用与显式关系替换精确选择中的名称推断；查询采用绑定输入的完整状态，异步资源以版本和请求编号隔离。ROI 计算输出网格损失与计算清单；自动检查、独立解剖检查、人工审查和示意几何分别记录。

**Tech Stack:** 现有 React 19.2、Three.js 0.180、Vite 7.1、ES modules、Node `node:test`、Web Worker；真实交互测试使用 G0 统一的 `playwright.config.mjs`、`tests/e2e/*.spec.mjs` 与 `npm run test:e2e -- <path>`。本桌面会话交互验收走 CUA，CI 测试运行器只在获准且可用的环境执行；缺环境标记未运行，不视为通过，不使用会临时下载依赖的命令。

**Spec:** [00-spec.md](./00-spec.md)。证据：[空间审查](../../../../output/audit-20261029/anatomy-review.md)、[总审查](../../../../output/audit-20261029/REVIEW.zh-CN.md)、[固定基线复现](../../../../output/audit-20261029/anatomy-probes.json)。

## Global Constraints

- 计划基线为 NeuroAtlas `4.1.0`，发布源码提交 `ca00c0928b0c7b62c662636cddf3a8d1da374a15`（简称 `ca00c09`）；不能把工作区主目录中的另一套源码当成该发布版本。
- 本文只记录未来实施步骤；以下标为新增的类型、函数、文件和测试尚未实现。本轮不实现、不安装、不发布。
- 所有任务路径均相对总计划指定的实现源码根；当前审计源码根是 `F:/project/brain-model/.deployment/source`。执行时先按总计划建立正确实现分支；本文的文档目录不是实现源码根。
- G0 先执行只读差异检查，将计划和审查夹具复制到执行 checkout；原审计输入保持只读。所有后续实现只改该 checkout，绝不同时修改工作区主目录源码副本。
- 保留同一主脑几何、既有相机与视角恢复、RAS 约定、原生 AAL/Colin27 独立查看和未知空间禁叠加规则。`MNI-unspecified`、用户声明和实际注册不能自动升级为已核验空间。
- 标签编号按原始离散值存储，不能按数组下标重编号；不做最近脑回猜测、不强填背景、不补造小核团体素、不把概念近似关系升级为等价。
- AAL/AAL3 的 `24/78`、`24/86` 仅为当前允许投影皮层标签与概念卡片的关联率，不能称为整图谱覆盖率。当前 1 mm 标签来自 2 mm 估计变换场，采样间距不等于定位精度。
- 自动指标和 AI 核图不构成人工解剖认证；独立参考或人工审查缺失时明确保留 `partial` / `pending`，不以软件测试通过补齐科学验证。
- 如后续科学处理需要 Python，先检查可用 conda 环境；无适用环境才新建专用环境，禁止往默认环境装包。本计划的工程测试使用现有 Node。
- `src/App.jsx`、`src/components/ROICompare.jsx`、`src/lib/volume.js`、数据清单是共享文件；执行顺序由总计划协调，后续任务保留其他子计划已经加入的代码和字段。

## Review Focus

1. 同名、不同版本或不连续标签编号应保持不同身份；S1 测试 AAL `8121/8211`、AAL3 `87/91` 和版本改变。
2. 无概念卡片的实际标签也应可选择、批注、恢复和进入 ROI；S2 遍历全部实际非零标签，不能只测已有卡片。
3. A→B→A 乱序加载、移动切片、重试失败时不能显示或选择旧结果；S3 用可控制延迟的真实交互验证。
4. 小标签消失、空交集与源标签不存在是三个不同状态；S4 用实际标签 134、空目标及原网格自比区分。
5. 文件名不变但内容或变换改变，以及只有三个中心切片的 QC，应分别标记版本不一致和部分验证；S5/S6 固定断言，不能自动认证。

## 文件与接口边界

以下接口以 JSDoc / 类型说明表达，实际实现仍为 `.js`，不引入 TypeScript 编译链。共享定义由 G0 放入 `src/lib/research-contracts.js`；本计划消费这些定义，不重复创建另一套共用类型。

```ts
type AtlasRegionRef = { atlasId: string; atlasVersion: string; labelId: number;
  hemisphere: 'L' | 'R' | 'M' | 'B' | 'U'; spaceId: string };
type AssetIdentity = { id: string; version: string; sha256: string; spaceId: string | null };
type QueryContext = { atlasId: string; atlasVersion: string;
  coordinate: [number, number, number]; method: string; requestId: number };
type GridSpec = { shape: [number, number, number]; affine: number[];
  space: string; order: 'x-fastest' | 'z-fastest' };
type ComputationManifest = { appVersion: string; algorithmVersion: string;
  inputs: AssetIdentity[]; transforms: { id: string; sha256: string }[];
  sourceGrids: GridSpec[]; targetGrid: GridSpec;
  interpolation: string[]; thresholds: { kind: string; threshold: number; tail: string }[];
  labelSets: number[][] };
```

`AtlasRegionRef` 的半球来自有来源记录的标签字典；`B` 表示明确双侧标签，`U` 表示未知，不能用点击位置或目录顺序伪造侧别。BA 双侧标签的表面点击侧另存在查询结果中。版本优先采用已核实的版本字段；上游无版本号时使用 `sha256:<实际派生文件摘要>` 作为本地工件版本，保留“上游版本未提供”，不编造发行号。

| 新增模块 | 责任 | 后续使用方 |
|---|---|---|
| `src/lib/atlas-identity.js` | 标签引用、明确概念关系、来源类别校验 | S2、S3、证据与坐标子计划 |
| `src/lib/atlas-selection.js` | 标签选择、最小详情、序列化适配 | S2、工程项目保存与恢复 |
| `src/lib/query-state.js` | 查询上下文、失效及乱序拒绝 | S3、坐标批量查询 |
| `src/lib/atlas-resource.js` | 清单与图谱的共享加载、错误、订阅和重试 | S3、X8 |
| `src/lib/roi-grid.js` | 已声明的 1/2 mm 共同网格与损失报告 | S4、S5 |
| `src/lib/computation-manifest.js` | 计算清单、身份匹配、独立结果导出 | S5、工程项目保存与重算 |
| `src/lib/spatial-qc.js` | 检查范围与证据门槛，不自动认证 | S6、详情/来源界面 |

工程子计划负责项目与视图容器的 schema 升级、原子导入和结果存储；这里提供标签/计算的序列化接口，不再实现另一套项目容器。证据子计划负责文献关联；这里输出有依据的关系，禁止用未关联标签自动补文献。

---

### S1：建立标签身份与有依据的概念关系

**Dependency:** G0 基线锁定与 `src/lib/research-contracts.js`；无其他空间任务依赖。

**Files:**
- Create: `src/lib/atlas-identity.js`、`public/data/atlas-region-relations.json`、`scripts/validate-atlas-identities.mjs`。
- Modify: `src/lib/volume.js`（`loadAtlas` 元数据与缓存身份）、`public/data/manifest.json`（版本/空间身份和标签元数据来源）；本任务不更换二进制图谱或皮层几何。
- Test: `src/lib/atlas-identity.test.mjs`、`src/lib/volume.test.mjs`。

**Interfaces:**
- Produces: `atlasRegionKey(ref: AtlasRegionRef): string`；固定字段顺序序列化五个身份字段，不使用名称。
- Produces: `makeAtlasRegionRef(atlasId, metadata, label): AtlasRegionRef`；查不到有来源的标签/空间身份时抛错，不猜测。
- Produces: `relationsForRegion(ref, relations): RegionRelation[]`；`RegionRelation={region:AtlasRegionRef,conceptId,type:'exact-source'|'overlaps'|'contained-by'|'contains'|'approximate',sourceUrl,sourceLocator,sourceTissue,targetTissue}`。`exact-source` 只用于同一来源标注，跨图谱重叠不会变为等价。
- Produces: `validateRegionRelations(relations, regionIndex, conceptIndex): {valid,errors}`。`regionIndex` 按 `atlasRegionKey` 索引；组织类别与侧别矛盾直接报错。未知关系表现为空数组。

- [ ] **Step 1: 新增失败回归。** 在 `atlas-identity.test.mjs` 读取真实清单与目录：断言六个 `Cingulum_Ant/Mid/Post_L/R` 的关系中没有白质扣带束；BA4/BA10 没有按目录顺序获得 DK 等价关系。断言 `key(AAL8121)!==key(AAL8211)`、`key(AAL3_87)!==key(AAL3_91)`，同标签不同版本的 key 不同，`[2001,8121,8211]` 原编号不变；一个伪造灰质→白质 `exact-source` 关系必须使 `valid===false`。
- [ ] **Step 2: 运行失败测试。** `node --test src/lib/atlas-identity.test.mjs`；预期因新增接口缺失或旧匹配行为失败。记录失败原因，不用跳过断言“通过”。
- [ ] **Step 3: 实现身份与关系合同。** 实现上述四个函数；从原始标签表生成半球/组织类别元数据并保存源文件定位，不从坐标正负推导标签半球。已知 DK 原始 `structureId` 也必须携带同源依据。删除无依据的 AAL/BA 自动精确关系；关联清单允许为空。缓存 key 必须包括 atlas ID、版本、文件摘要和空间，不能只靠 atlas ID。
- [ ] **Step 4: 定向验证。** `node --test src/lib/atlas-identity.test.mjs src/lib/volume.test.mjs` 与 `node scripts/validate-atlas-identities.mjs`；预期所有实际标签身份可解析，组织/侧别冲突为零，未知关系被明确计数。脚本分别报告全部体积标签和可投影皮层标签的分母，不强求概念映射率达到 100%。
- [ ] **Step 5: 提交。** `git add src/lib/atlas-identity.js src/lib/atlas-identity.test.mjs src/lib/volume.js src/lib/volume.test.mjs public/data/manifest.json public/data/atlas-region-relations.json scripts/validate-atlas-identities.mjs`；`git commit -m "fix: preserve atlas region identities and explicit relations"`。

### S2：每个实际标签均可独立选择与恢复

**Dependency:** S1；项目/视图往返验收还依赖工程子计划接入本任务序列化合同，以及总计划的浏览器测试环境。

**Files:**
- Create: `src/lib/atlas-selection.js`、`src/components/AtlasRegionDetails.jsx`、`src/components/AtlasRegionDetails.css`。
- Modify: `src/components/BrainScene.jsx`（着色/命中/高亮）、`src/App.jsx`（标签选择与批注目标）、`src/components/ROICompare.jsx`（精确标签入口）。
- Test: `src/lib/atlas-selection.test.mjs`、`tests/e2e/spatial-selection.spec.mjs`。

**Interfaces:**
- Consumes: S1 的 `atlasRegionKey`、`makeAtlasRegionRef`、`relationsForRegion`。
- Produces: `selectAtlasRegions(refs: AtlasRegionRef[], mode:'replace'|'add', current:AtlasRegionRef[]): AtlasRegionRef[]`，只按完整 key 去重。
- Produces: `serializeAtlasSelection(refs): AtlasRegionRef[]`、`restoreAtlasSelection(saved, regionIndex): {selected:AtlasRegionRef[],unresolved:AtlasRegionRef[]}`；不存在或版本不匹配者留在 unresolved，不按名称迁移。
- Produces: `regionDetails(ref, regionIndex, relations): {ref,labelName,sourceUrl,sourceLocator,relations,hasEvidence:boolean}`；`BrainScene` 新增 `onRegionSelect(refs, coordinate, queryContext)`，概念目录的原 `onSelect` 保留为独立入口。

- [ ] **Step 1: 新增失败回归。** 单测遍历 AAL116/AAL3 166 个实际非零体积标签，断言选择→序列化→恢复后完整 ref 一致；原始不连续 ID 不变。浏览器测 `Frontal_Sup_L` 无卡片时仍可打开最小详情、建立绑定 ref 的批注并进入对应 ROI；AAL `8121`/`8211` 的高亮和批注不共用一个选择，AAL3 `87`/`91` 同理。对本来只存在体积中的深核，经独立图谱浏览器进入，不能强投影到皮层。
- [ ] **Step 2: 运行失败测试。** `node --test src/lib/atlas-selection.test.mjs`；统一浏览器环境就绪后执行 `npm run test:e2e -- tests/e2e/spatial-selection.spec.mjs`。预期新增选择接口缺失、无卡片标签无法保持选择或不同颞极标签被合并。
- [ ] **Step 3: 实现选择与最小详情。** 让着色和点击读同一实际顶点标签及引用；从精确路径移除 `findMatchingStructure`，保留已有顶点/源体积/几何 hash 校验、半球限制与内侧壁背景。详情显示原标签、图谱版本、空间、查询方式与来源；未关联时显示“暂无已关联概念/研究结果”。批注使用 ref，旧 `structureId` 批注保持原概念语义；跨图谱关系不会连带选中别的标签。
- [ ] **Step 4: 定向验证。** 运行上述单测/交互测试和 `node --test src/lib/surface-projection.test.mjs src/lib/atlas-explorer.test.mjs src/lib/scene-frame.test.mjs`；预期全标签选择往返通过、两个颞极 ref 独立、无文献不会生成虚假证据。工程保存接入后再用同一交互用例完成刷新/项目往返；在那之前将“项目级往返”记为待验收，不能用适配器单测代替。确认切换标签不改变主脑网格、非主动聚焦时不重置相机。
- [ ] **Step 5: 提交。** 仅暂存本任务 Files 中的实现和测试；`git commit -m "feat: select and restore every atlas label independently"`。

### S3：使查询状态与异步图谱严格一致

**Dependency:** S1、S2、G0 浏览器测试环境。坐标子计划调用同一上下文合同，不另设旧标签缓存；X8 消费本任务共享资源状态做加载/错误/重试展示。

**Files:**
- Create: `src/lib/query-state.js`、`src/lib/atlas-resource.js`。
- Modify: `src/App.jsx`（首次清单加载、`updateSlice`、`setPoint`、位置详情状态）、`src/components/BrainScene.jsx`（图谱加载 effect、命中与 `onReady`）、`src/components/SliceViews.jsx`（共享资源消费）、`src/lib/volume.js`（版本化加载入口）。
- Test: `src/lib/query-state.test.mjs`、`src/lib/atlas-resource.test.mjs`、`tests/e2e/spatial-query.spec.mjs`。

**Interfaces:**
- Produces: `beginQuery(previous, context:QueryContext): QueryState`、`invalidateQuery(previous, reason:string): QueryState`、`acceptQueryResult(current, context, result): QueryState`。
- `QueryState={status:'idle'|'loading'|'ready'|'error',context:QueryContext|null,result:QueryResult|null,error:string|null}`；`QueryResult={region:AtlasRegionRef|null,observedHemisphere,sourceAsset:AssetIdentity,mapping,spaceId,probability?:number}`。
- Produces: `loadAtlasVersion(identity:AssetIdentity, options?:{signal:AbortSignal}): Promise<Volume>`；实际加载结果必须携带同一 identity。`acceptQueryResult` 仅在请求编号、图谱/版本、坐标与 method 全部一致且 result 空间符合当前图谱时接纳。
- Produces: `getResourceState(key:string):ResourceState`、`subscribe(key:string, listener:(state:ResourceState)=>void):()=>void`、`ensureResource(key:string):Promise<ResourceState>`、`retry(key:string):Promise<ResourceState>`；`ResourceState={status:'idle'|'loading'|'ready'|'error',generation:number,value:unknown|null,error:string|null}`。
- Produces: `MAIN_MANIFEST_RESOURCE='manifest:main'`、`ANATOMY_MANIFEST_RESOURCE='manifest:anatomy'`、`BA_COVERAGE_RESOURCE='manifest:ba-coverage'`、`atlasResourceKey(identity:AssetIdentity):string`。`ensureResource` 共用正在运行的同身份请求；`retry` 新增该资源 generation，旧请求不能回写。

- [ ] **Step 1: 新增失败回归。** 单测断言 begin/invalidate 后 `result===null`，旧 request、旧坐标、旧方法、旧版本的结果均不能覆盖当前状态；资源单测断言三个消费者只触发一次同身份请求、失败可观测、重试的新 generation 不被旧请求覆盖。浏览器注入延迟：AAL 点击后移动切片，详情不再显示原 `atlasLabel`；AAL→DK→BA 乱序返回，只显示最终 BA；加载中点击不能用旧 `atlasVolume` 返回标签。另模拟 App 首次主清单 503，恢复网络后会话内重试使工作区初始化，原文献/批注不变，不能靠刷新页面通过。
- [ ] **Step 2: 运行失败测试。** `node --test src/lib/query-state.test.mjs src/lib/atlas-resource.test.mjs`、`npm run test:e2e -- tests/e2e/spatial-query.spec.mjs`；预期当前浅合并状态保留旧投影标签、加载中旧体积仍被查询、首次清单错误被吞掉，新增纯函数也尚不存在。
- [ ] **Step 3: 实现完整查询状态替换与共享资源。** 开始切换立即清除活动可查询体积、结果和标签高亮，更新切片为明确加载状态；新体积和其 identity 一起提交。可取消请求尽量 abort，仍以 requestId 作最终拒绝条件。移动坐标、切片、图谱、方法、版本或空间均使旧查询失效；`onReady` 的模型加载状态与查询结果分开，不再 `{...previous,...next}` 合并查询字段。坐标保持小数；背景返回 `region:null`。App、Scene、Slices 共用资源模块，替换 App 首次 fetch 的空 catch；错误保留到重试成功，重试不清空项目/研究内容。订阅者退出时解绑，失败的 pending 请求不可永久复用；展示由 X8 接入相同状态。
- [ ] **Step 4: 定向验证。** 重跑以上测试及 `node --test src/lib/volume.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs`。另测原生 AAL/Colin27 仍只配原生 T1、`MNI-unspecified` 不叠加、白质可见性切换不改变皮层标签身份、背景不取邻近标签。真实浏览器记录坐标/ID/来源文本断言，不以截图“看起来正确”代替。
- [ ] **Step 5: 提交。** 仅暂存本任务 Files；`git commit -m "fix: invalidate stale atlas queries and isolate async loads"`。

### S4：允许选择 1/2 mm 共同网格并报告标签损失

**Dependency:** S1；ROI UI 与工程后台计算任务串行整合；浏览器测试环境。

**Files:**
- Create: `src/lib/roi-grid.js`。
- Modify: `src/lib/roi.js`（采样源/目标计数）、`src/lib/roi.worker.js`（预检和计算结果）、`src/components/ROICompare.jsx`（共同网格选择与损失确认）。
- Test: `src/lib/roi-grid.test.mjs`、`src/lib/roi.test.mjs`、`tests/e2e/roi-grid.spec.mjs`。

**Interfaces:**
- Produces: `makeComparisonGrid(reference:GridSpec, resolutionMm:1|2): GridSpec`；仅支持指定 NLin6Asym 标准网格，其他值显式拒绝。
- Produces: `inspectROISampling(volume, selection, target:GridSpec): SamplingReport`；`SamplingReport={sourceVoxels,sourceMm3,targetVoxels,targetMm3,lostLabelIds:number[],status:'retained'|'partial-loss'|'empty-target'|'empty-source'}`。标签集合逐标签计算损失，不能只检查联合集是否为空。
- Produces: `compareROIs(...)` 保留现有参数，在结果增加 `sampling:{A:SamplingReport,B:SamplingReport}`；Worker 增加 `phase:'preflight'|'complete'` 消息，以 requestId 关联预检和最终运算。

- [ ] **Step 1: 新增失败回归。** 读取发布 AAL3 注册版 `public/data/aal-v3/aal3-fsl1mm.bin` 的真实标签 134：断言源 7 体素/7 mm³；1 mm 自比 `aVoxels===7`、`intersectionVoxels===7`、`dice===1`；2 mm 时目标 0、`dice===null`、`lostLabelIds` 含 134、`status==='empty-target'`。另用多标签夹具验证一个标签消失但联合集非空时报告 `partial-loss`，绝不补点；保留 DK/BA4a 的 2 mm `1732/1065/57` 基线。
- [ ] **Step 2: 运行失败测试。** `node --test src/lib/roi-grid.test.mjs src/lib/roi.test.mjs`；`npm run test:e2e -- tests/e2e/roi-grid.spec.mjs`。预期缺少网格 UI/损失字段；已有底层 1 mm 算术通过不代表本任务完成。
- [ ] **Step 3: 实现明确网格和计算前预检。** 2 mm 维持 `[91,109,91]`、对角步长 `[2,2,2]`；1 mm 使用已发布注册标签相同的 `[181,217,181]`、步长 `[1,1,1]`；二者原点均 `[-90,-126,-72]`、RAS、x-fastest。保留 8,000,000 目标体素上限，禁止静默降采样。默认继续 2 mm，用户可主动选择 1 mm；预检若发生丢失，展示逐标签列表和源/目标体积，用户确认后才产生带警示的结果。标签/掩膜仍最近邻，连续图仍三线性后阈值，零背景仍排除。
- [ ] **Step 4: 定向验证。** 重跑单测与浏览器用例；浏览器分别选择 1 mm、2 mm，验证网格与来源体积同屏可读、全空结果不能称为“不重叠”，更改网格使旧结果失效。验证取消预检/计算不会提交旧结果；掩膜导出后 shape/affine/count 与所选网格一致，表面过大允许省略表面但不改变指标。
- [ ] **Step 5: 提交。** 仅暂存本任务 Files；`git commit -m "feat: expose ROI grids and sampling loss before comparison"`。

### S5：每次计算均带独立可核对的来源清单

**Dependency:** S1、S4；完整项目恢复由工程子计划接入。S3 查询结果中的 `AssetIdentity` 与本任务一致，S3 可先消费 S1 已验证元数据，S5 再补实际加载字节核验，不构造循环依赖。

**Files:**
- Create: `src/lib/computation-manifest.js`、`scripts/build-asset-identities.mjs`、`public/data/asset-identities.json`。
- Modify: `src/lib/volume.js`（加载结果附身份）、`src/lib/roi.js`（`serializableVolume` 与结果字段）、`src/lib/roi.worker.js`、`src/components/ROICompare.jsx`（结果与导出）。
- Test: `src/lib/computation-manifest.test.mjs`、`src/lib/roi.test.mjs`、`tests/e2e/roi-provenance.spec.mjs`。

**Interfaces:**
- Produces: `makeComputationManifest({appVersion,algorithmVersion,inputs,transforms,sourceGrids,targetGrid,interpolation,thresholds,labelSets}): ComputationManifest`；缺少必要身份/哈希则失败，不能使用 URL 代替哈希。
- Produces: `compareComputationManifest(saved:ComputationManifest,current:ComputationManifest): {matches:boolean,differences:Array<{path:string,saved:unknown,current:unknown}>}`；比较所有科学计算相关字段，标签集合可排序去重，但 A/B 与变换链的顺序不能排序后抹去。W6 的 `saved-computation.js` 直接消费此接口，不另建 manifest 实现。
- Produces: `makeAssetIdentity(bytes:Uint8Array, metadata:{id:string,version:string,spaceId:string|null}):Promise<AssetIdentity>`；hash 精确定义为传入原始文件字节的 SHA-256：内置输入为实际 `.bin` 字节、原始来源为原下载文件字节、变换为变换文件字节。本地影像同时保留原始 `.nii`/`.nii.gz` 文件身份和计算派生体积身份；派生体积按显式 dtype 与小端字节序编码后计算，不能 hash 对象字符串、临时 URL 或压缩前后混用。空间未知的源资产仍可记录字节身份，但 null 不授予比较/叠加资格；实际 A/B 计算体积必须通过空间资格检查。
- Manifest 数组约定：`inputs[0]` / `inputs[1]` 是 A/B 实际计算体积身份，随后按 id 排列参与这两输入的原始来源依赖，去重但不改变前两个槽位。`sourceGrids/interpolation/thresholds/labelSets` 始终各有两个位置，按 A/B 对应；两次自比允许前两个 identity 相同。`transforms` 保留实际处理顺序；空链表示确实无需变换，未知链不是空链。
- Produces: `exportComparisonBundle(comparison, manifest): {json:string,csv:string}`；JSON 为 `{schema:'neuroatlas-computation-v1',manifest,metrics,probabilityMetrics,sampling}`，CSV 保存同一 manifest 的 JSON 字段及全部指标。结果包含原始数值而非格式化文字。
- Consumes/extends: `serializableVolume(volume)` 保留 `identity`、源身份、sourceGrid、变换链及哈希；既有 `GridSpec.space` 明确映射到 `AssetIdentity.spaceId`，不静默默认为 MNI。

- [ ] **Step 1: 新增失败回归。** 固定两个资产及变换夹具，断言 Worker 往返后身份、源网格、变换哈希、阈值/方向、离散 labelSets、采样警示完整；名称/URL 不变但输入 sha256、version、spaceId 或 transform hash 任一改变均提示不一致。JSON/CSV 导出解析后 manifest 与原对象深相等；用同一输入与 manifest 重算，原始计数/Dice/概率指标一致。
- [ ] **Step 2: 运行失败测试。** `node --test src/lib/computation-manifest.test.mjs src/lib/roi.test.mjs`；`npm run test:e2e -- tests/e2e/roi-provenance.spec.mjs`。预期当前 `serializableVolume` 白名单丢失哈希/变换、独立 CSV 缺少复现字段。
- [ ] **Step 3: 实现清单与独立导出。** 构建脚本读取实际本地字节生成源/派生资产与变换哈希；加载后再核对接收到的实际字节，缺失或不符不能用清单中的预期哈希冒充已核验值。来源缺失时明确报缺，不填假值。每次开始计算锁定输入身份、精确网格、选择/阈值和算法版本；结果完成后固定 manifest，不能随全局清单刷新而被改写。已有注册输入同时记录原文件、派生标签文件及真实变换链；连续图和掩膜同样记录。导出包含原结果，不重新计算后覆盖；恢复发现不匹配由工程界面展示“原结果/当前输入重算”两个状态。历史 v1 无哈希只记录“本次读取观察值”，不回填历史计算身份。
- [ ] **Step 4: 定向验证。** `node scripts/build-asset-identities.mjs --check` 与上述单测/交互测试通过；下载 JSON 和 CSV 后解析核对，不只检查按钮出现。工程接入后验证项目保存也保留 manifest/原始结果，缺失输入不会自动重算；本任务单独交付时明确项目级恢复仍待集成。
- [ ] **Step 5: 提交。** 仅暂存本任务 Files；`git commit -m "feat: attach immutable provenance to ROI results and exports"`。

### S6：独立空间 QC 与示意分区替换门槛

**Dependency:** S1、S5；独立参考数据和具名人工审阅是科学验证的外部条件，不是软件任务可凭空完成的字段。

**Files:**
- Create: `src/lib/spatial-qc.js`、`scripts/spatial-qc.mjs`、`scripts/validate-segmentation-source.mjs`、`data-sources/spatial-qc/reference-set.json`、`public/data/spatial-qc/assessment.json`、`docs/validation/spatial-qc-protocol.md`。
- Modify: `src/components/BrainScene.jsx`（脑干/小脑分段来源状态）、`src/components/AtlasRegionDetails.jsx`（验证范围）、`scripts/anatomy_validate.mjs`、`public/data/manifest.json`（QC 记录链接）。
- Test: `src/lib/spatial-qc.test.mjs`、`src/lib/scene-frame.test.mjs`、`src/lib/atlas-slices.test.mjs`。

**Interfaces:**
- Produces: `evaluateSpatialQC({assets,transforms,referenceSet,measurements,reviews}): QCAssessment`；`QCAssessment={status:'partial'|'reviewed',automatedChecks,independentCoverage,missingCoverage,measurements,humanValidated:boolean,humanReviewScope:string[],limitations:string[]}`。
- Produces: `validateSegmentationSource(candidate, assetIndex): {eligible:boolean,missing:string[],issues:string[]}`；candidate 必含原始分割引用/许可、资产哈希、原始标签字典、源空间、变换链、派生步骤、覆盖结构及独立区域检查记录。
- Produces: `representationForAsset(asset, assessment): 'illustrative-subdivision'|'source-segmentation'`；只有来源验证和针对该结构的 QC 通过才允许后者。`humanValidated` 只能由有身份、日期与实际范围的人工记录生成，程序/AI 记录不能满足它。

- [ ] **Step 1: 新增失败回归。** 将现有 `public/data/aal-v3/root-review.json` 的三个中心平面作为夹具，断言 `status==='partial'`、`humanValidated===false`，缺失全脑/小核团覆盖仍可见。仅有高表面覆盖率、hash、Jacobian 或往返误差的报告不能变为 reviewed；自身配准产生的标签不能充当独立真值。脑干 z 分段和小脑 `|x|≤5` 中线带没有原始分割来源，`eligible===false`，界面必须继续标示意。
- [ ] **Step 2: 运行失败测试。** `node --test src/lib/spatial-qc.test.mjs`；预期新增 QC 合同不存在，现有单一“atlas-segmentation”表示不能满足细分来源门槛。
- [ ] **Step 3: 固定验证协议和数据准入。** 在协议中预先列出全脑轴/冠/矢状连续覆盖、左右/中线/脑室标志、皮层边界和重点深核（至少 AAL3 134）检查清单；保存独立参考的版本、许可、哈希、来源空间与标注方法。输出逐区域 landmark 距离、边界距离及有独立分割时的重叠量，并明确单位、配准/插值影响和缺失项；无真实独立参考时指标为未测，不能用自己的变换结果计算“准确率”。阈值必须随具体参考与任务预先记录，未有依据不承诺统一亚毫米精度。
- [ ] **Step 4: 实现可重复报告和替换门槛。** `spatial-qc.mjs` 从锁定输入重跑自动检查并生成带输入摘要的 assessment；保留历史 root-review 原文件。把当前脑干和蚓部几何分段显式归为 `illustrative-subdivision`。后续检索/取得可再分发且来源清晰的脑干、蚓部分割后，先在独立候选资产中执行来源校验和区域 QC，保存评审范围，通过才替换相应结构；不足则保留示意资产并在报告列出缺失来源，不通过改名称宣称完成。
- [ ] **Step 5: 定向验证与科学验收分开记录。** `node --test src/lib/spatial-qc.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs`、`node scripts/spatial-qc.mjs --check`、`node scripts/validate-segmentation-source.mjs --check`；预期工具对真实缺口输出结构化 partial，伪造/不完整 replacement 候选失败。检查 `--check` 不改历史证据。具名领域审阅人按协议复核后单独追加审阅记录；未收到该记录时软件验收可以通过，但“独立解剖验证/源分割替换”保持未完成，不发布人工认证结论。验证原生 Colin27、主脑与相机回归均通过。
- [ ] **Step 6: 提交。** 仅暂存本任务 Files；`git commit -m "feat: track spatial validation scope and segmentation provenance"`。候选资产真正获准后的替换以独立数据提交记录输入和 QC，不覆盖旧来源证据。

## 空间子计划退出条件

S1–S5 的工程与真实交互验收全部通过，标签身份/查询/网格/独立导出可核对，工程项目往返集成有单独证据。S6 的工具和诚实状态报告通过不等于解剖验证完成；未获得独立参考、人工范围记录或合格分割来源的部分明确保留在总计划未完成清单。全部完成状态由总计划汇总，不能将本文件保存成功当成修复成功。


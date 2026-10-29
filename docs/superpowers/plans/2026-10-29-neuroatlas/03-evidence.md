# 文献、结果与来源证据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每条阅读关联、研究结果和空间定位都能说明支持范围、返回具体原文，并独立保存和复核。

**Architecture:** 在现有 React 文献工作台旁建立纯函数证据模型，分别表示论文、实验、结果、位置、claim、目标映射和审阅事件。保留原始来源和目标图谱两端身份，由统一空间接口决定能否叠加；阅读关联、书目核对和原文核对不替代空间验证或研究质量判断。

**Tech Stack:** 现有 JavaScript ES modules、React 19、Node `node:test`、JSON、SHA-256；不因本计划增加数据库或 Python 依赖。

**Spec:** `./00-spec.md`

## Global Constraints

- 本文是实施计划，当前不修改生产代码、重建数据、安装依赖或发布网站；执行时先完成 `README.md` 的 G0。以下代码文件及命令均相对 `.deployment/source` 或 G0 确认的执行 checkout；G0 对比工作副本、复制本套计划及审查 fixtures，不在无 Git 的 `F:/project/brain-model` 根目录盲目提交，也不双写两份源码。
- 共享身份原样使用 `AtlasRegionRef={atlasId,atlasVersion,labelId,hemisphere,spaceId}`、`AssetIdentity={id,version,sha256,spaceId}`；不得从名称猜测图谱 label 或把动物来源改名为人体来源。
- 当前基线是完整库 118 篇来源、115 个阅读记录；当前脑目录 150 个结构、433 条阅读关联；隐藏脊髓 38 个结构、79 条关联。3 篇论文有 4 条结果、8 个坐标，覆盖当前脑目录 7 个结构；不混用分母。
- 当前脑目录有 8 条动物关联错误标为直接证据，完整库另有 3 条隐藏脊髓关联，合计 11 条。修正数据必须覆盖全部 11 条；当前界面受影响数仍为 8。
- 八个已有坐标保持 `MNI-unspecified`，不得默认改成 `MNI152NLin6Asym`；当前直接叠加资格为 0。未知、未报告、未摘录、未校正和未人工审阅必须可区分。
- “AI 辅助原文核对”不等于人工或专家认证；无人提供真实审阅记录时，不设置人工审阅完成状态。
- 原始审查文件 `output/audit-20261029/` 保持原样，新验收报告写入新目录。结果层恢复、数字口径展示、比较篮、草稿/撤销和阅读面板布局由总计划的交互任务负责，本分计划提供证据接口。
- 定量证据评分和元分析仅列入方法评估范围；不按论文数、claim 数或录入量自动实现证据强度评分。
- 兼容读取现有 project/view/evidence v1；不能补造历史文件里没有的来源、空间或人工审阅信息。迁移保留原件并标注缺失。
- 本地影像、笔记、自由文本和私有证据不得进入公开视图链接。默认不引入账号、云同步、遥测或第三方上传。

## Review Focus

1. 新增动物、混合或未知物种不能绕过直接证据规则；原研究直接测量不自动变成对人体目标图谱的直接支持。测试归 E1。
2. 同论文的左右侧支持不同，合并相同结构时不能覆盖限制或让背景一侧默认高亮。测试归 E1。
3. 缺失统计字段、SD、SE、峰值定位精度和未校正结果不能被填零或混为同一种误差。测试归 E2。
4. 来源网址可访问或文件哈希正确，不代表转录数值与来源一致；离线材料、来源版本和语义核对分别验收。测试归 E4。
5. DOI 重复、旧版包、缺少内置库或新版本勘误不能使独立导出丢失 claim、变换身份或历史结论。测试归 E5、E6。

---

## 文件职责与共享边界

| 文件 | 职责 |
|---|---|
| `src/lib/evidence-mapping.js` | 物种、来源区域、目标身份、支持类型与默认定位策略。 |
| `src/lib/evidence-schema.js` | v2 实验/结果/位置/claim schema、缺失值、审阅记录与纯迁移。 |
| `src/lib/evidence-search.js` | 双语与别名索引、论文方法/结果方法过滤。 |
| `src/lib/source-artifact.js` | 最小来源摘录的身份、哈希、字段锚点与离线审核。 |
| `src/lib/evidence-package.js` | 自包含证据包闭包选择、版本和引用一致性。 |
| `src/lib/statmap-source.js` | DOI 到 NeuroVault 候选及上游影像身份；不推断空间。 |
| `src/lib/result-publication.js` | 公开结果页的数据投影、固定版本与勘误链。 |
| `src/lib/evidence-workspace.js` | 保留存储/合并/校验公共入口，委托新模型；工程任务继续消费这些入口。 |
| `scripts/literature_build.mjs`、`data-sources/literature-upgrade/` | 阅读库生成和人工/AI 整理来源；生成文件 `src/data/literature.js` 不手改。 |
| `data-sources/results/`、`src/data/results.js` | 有出处的结构化原始记录、版本与发布导出。 |
| `src/components/LiteratureWorkspace.jsx` | 消费关系、检索和导出接口；局部接线，不重写其他任务负责的交互状态。 |

共享 JSON 类型采用 G0 创建的 `src/lib/research-contracts.js` 中的 JSDoc 定义，已有 JS 构建链保持不变；`01-spatial.md` 的 S1 实现区域身份助手。下列新增模块都需有同目录 `.test.mjs`；浏览器验收采用 G0 的 `playwright.config.mjs`、`npm run test:e2e -- <path>`，不通过 `npx` 隐式下载。当前桌面真实交互走 CUA；CI runner 仅在具备依赖及许可的环境运行，环境未建立时状态保持未验收。

本分计划使用 `BiText={zh:string,en:string}`、`ValidationReport={valid:boolean,errors:string[],warnings:string[],value?:EvidenceBundleV2}`、`IntegrityReport={valid:boolean,errors:string[]}`、`ReviewState={extracted:boolean,sourceChecked:boolean,spaceChecked:boolean,humanReviewed:boolean,events:ReviewEvent[],limitations:BiText[]}`。`ReviewState` 仅汇总传入 subject 的事件；跨 subject 展示由调用者先筛选，不把某结果的人审扩散到整篇或其他结果。来源材料缺失列入 limitations，不抹去历史核对记录，也不宣称本次重新核对成功。

### Task E1: 修正每条映射的物种、支持类型与侧化语义

**Files:**
- Create: `src/lib/evidence-mapping.js`, `src/lib/evidence-mapping.test.mjs`, `tests/e2e/evidence.spec.mjs`
- Modify: `scripts/literature_build.mjs`, `scripts/literature_validate.mjs`, `data-sources/literature-upgrade/curation.mjs`, `data-sources/literature-upgrade/discovery.mjs`, `src/components/LiteratureWorkspace.jsx`
- Regenerate: `src/data/literature.js`

**Interfaces:**
- Consumes: `src/lib/research-contracts.js` 的 `AtlasRegionRef`；现有 `literaturePapers`、`structures` 和 `onLocateRegions(regionIds,paper)`。
- Produces: `EvidenceMapping={id,referenceId,claimId,resultId,sourceRegion:{species,label,hemisphere,spaceId},targetRegionRef:AtlasRegionRef|null,targetConceptId:string|null,measurementKind,support,mappingKind,sourceRefs,limitations}`。`measurementKind` 为 `direct-measurement|synthesis|background|unknown`；`support` 为 `direct|context|cross-species|unknown`；`mappingKind` 为 `author-reported|contextual|homology-unverified|spatial-overlap|unknown`。缺少原作者标签时记录未知，不用目标名称补齐。
- Produces: `classifyMapping(mapping:EvidenceMapping):EvidenceMapping`；`buildLocateRequest(paperId:string,{mappings,includeContext=false}):{directMappings:EvidenceMapping[],contextMappings:EvidenceMapping[],limitations:BiText[]}`。已有 `directEvidence` 仅作兼容派生字段；`support==='direct'` 也不授予坐标叠加资格。

- [ ] **Step 1: 写失败测试。** 用当前审查的 11 个受影响 ID 建立明确 fixture（8 个当前脑关联、3 个隐藏脊髓关联），测试重新生成后全部 `support==='cross-species'`、`directEvidence===false` 且原物种不变；另测 `zebrafish`、`mixed`、`unspecified` 不能自动得到 human direct。断言 Silani 默认仅返回 `supramarginal-r`；`includeContext:true` 保留左侧背景及其限制；Dronkers 右侧和 Bentin 头皮 EEG 不进入默认直接定位集合；同一 target 的多条 claim 限制不互相覆盖。

  测试名 `species and hemisphere are retained per mapping`，核心断言（`affected` 为原 11 条 fixture 对应的生成结果）：

```js
assert.equal(affected.filter(m => activeIds.has(m.targetConceptId)).length, 8);
assert.equal(affected.filter(m => spinalIds.has(m.targetConceptId)).length, 3);
assert.ok(affected.every(m => m.support === 'cross-species' && m.directEvidence === false));
assert.deepEqual(buildLocateRequest('silani2013', {mappings}).directMappings.map(m => m.targetConceptId), ['supramarginal-r']);
assert.ok(buildLocateRequest('bentin1996', {mappings}).directMappings.length === 0);
```

- [ ] **Step 2: 运行失败测试。** Run: `node --test src/lib/evidence-mapping.test.mjs`。Expected: 新接口未实现，或原 11 条关联仍为 direct；不得以删 fixture 变绿。
- [ ] **Step 3: 实现映射分类和生成规则。** 修改上述 source curation 与生成器，物种为 human、来源区域及侧化有明确支持时才允许 direct；动物原结构与 human target 分开保存，背景/不确定映射保持限制。`LiteratureWorkspace` 的论文打开入口使用默认请求，脑区按钮逐条显示“原文支持 / 背景比较 / 跨物种 / 未确定”、半球、支持方法和来源；显式展开背景后才可定位。
- [ ] **Step 4: 验证生成结果和真实入口。** Run: `node scripts/literature_build.mjs`，再运行 `node --test src/lib/evidence-mapping.test.mjs` 和 `node scripts/literature_validate.mjs`。Expected: 全部通过；11 条都修正，8/3 分母仍可追踪。浏览器定向命令：`npm run test:e2e -- tests/e2e/evidence.spec.mjs --grep mapping`；Expected: 打开 Silani 后初始只定位右侧，左侧按钮可读出背景原因；CI runner 可用前用 CUA 记录同一场景结果，不把源码推断当浏览器通过。
- [ ] **Step 5: 提交。** Run: `git add src/lib/evidence-mapping.js src/lib/evidence-mapping.test.mjs tests/e2e/evidence.spec.mjs scripts/literature_build.mjs scripts/literature_validate.mjs data-sources/literature-upgrade/curation.mjs data-sources/literature-upgrade/discovery.mjs src/components/LiteratureWorkspace.jsx src/data/literature.js`，然后 `git commit -m "fix: preserve species and lateralized evidence mappings"`。Expected: 仅包含本任务文件；生成器若改变 `figure-audit.json`，先核对是否为预期生成差异再纳入。

### Task E2: 建立实验、结果、位置与审阅状态的结构化模型

**Files:**
- Create: `src/lib/evidence-schema.js`, `src/lib/evidence-schema.test.mjs`, `tests/fixtures/evidence-v1-baseline.json`
- Modify: `src/lib/research-contracts.js`, `src/lib/evidence-workspace.js`, `src/lib/evidence-workspace.test.mjs`, `src/data/results.js`, `data-sources/results/curated-results.json`, `scripts/literature_validate.mjs`
- Create: `docs/evidence-schema-v2.md`

**Interfaces:**
- Consumes: E1 `EvidenceMapping`；共享 `AtlasRegionRef`、`AssetIdentity`。
- Produces: `EvidenceBundleV2={schema:'brain-evidence-v2',dataVersion,references,readings,experiments,results,locations,claims,mappings,sourceArtifacts,reviewEvents,relations}`。`readings` 保留摘要、方法来源和局限；`relations` 继续表示结果间的一致/互补/不可比较关系，与 `mappings` 分开。
- `Claim={id,referenceId,experimentId:null|string,resultId:null|string,text,sourceRefs,limitations}`；`Reading={id,referenceId,resultSummaries,methodProvenance,limitations,claimIds}`。旧阅读摘要成为 reading claim，`experimentId/resultId` 保持 null；不能伪装成已摘录结果。原 v1 未规范化字段保存在 `legacyV1`，仅为无损迁移与显示回退，不参与空间判定。
- Produces: `Reported<T>={state:'reported',value:T,sourceRefs:string[]}|{state:'not-reported'|'not-extracted'|'uncertain'|'not-applicable',reason:string,sourceRefs:string[]}`；不能以 `0`、空字符串或默认正常替代未知。
- Produces: `Experiment={id,referenceId,task,species,sample,modalities,sourceRefs}`；`Result={id,experimentId:null|string,contrast,finding,modalities,statistics,effectEstimate,correction,timeWindow,frequencyBand,locationIds,claimIds,limitations}`；`Location={id,resultId,kind,sourceLabel,sourceSpaceId,xyz,unit:'mm',uncertainty,sourceRefs,derivedAsset:AssetIdentity|null,transformRef:string|null}`。v1 未表明独立实验时 `experimentId` 为 null 并保留迁移提示，不能凭同篇论文或摘要猜实验边界。
- 字段约定：`sample` 区分 enrolled/included/per-analysis n；`statistics` 保留统计类型、数值、自由度、单位及 `p` 的 `=|<|>`；`correction` 保留方法、比较族、是否通过和阈值；时间以 `ms`、频率以 `Hz`、坐标不确定性以 `mm`；`uncertainty.kind` 为 `sd|se|ci|localization-error|not-reported|unknown`，样本 SD 不冒充定位误差。
- `effectEstimate` 为 `Reported<{type,value,unit,variance:Reported<number>,interval:Reported<{level,lower,upper,unit}>}>`；`timeWindow` 为 `Reported<{start,end,unit:'ms'}>`，`frequencyBand` 为 `Reported<{min,max,unit:'Hz'}>`。只有明确原文报告才能填值，不能从 t/p 或图像外观自动补算效应量、方差或时间精度。
- Produces: `ReviewEvent={id,subjectId,stage:'extracted'|'source-checked'|'space-checked'|'human-reviewed',actorType:'ai'|'human'|'unknown',actorName,date,scope,sourceRefs,limitations,recordVersion}`；`validateEvidenceV2(input):ValidationReport`、`migrateEvidence(input):{value:EvidenceBundleV2,warnings:string[]}`、`deriveReviewState(events):ReviewState`。书目 `metadata-only` 仍是书目状态；阶段不是自动升级的单一等级。旧本地记录未说明核对者身份时 actorType 为 unknown，不能猜成人工；human-reviewed 必须绑定实际人类审阅者。
- Produces: `getResultViewModel(resultId:string,bundle:EvidenceBundleV2):ResultViewModel`，供 `02-workspace.md` 和 `04-experience.md` 的结果层、编辑器、`ResultCoordinates` 使用；结果为 `{id,referenceId,finding,condition,sample,roiDefinition,direction,modalities,topics,coordinates,regionIds,figures,sourceUrl,limitations,reviewState}`。位置数组从 `locations` 派生为现有 x/y/z/space/来源字段，旧 v1 原文字段保留以确保迁移无损；显示适配不得反向推断新空间或审阅状态，调用方不再各写一套迁移。

- [ ] **Step 1: 写失败测试。** 断言旧四结果迁移后仍为四条、八坐标逐一数值不变且全部 `MNI-unspecified`；Schaum 的结果模态仍 `['MEG']`；Axelrod 左 FFA `t=2.57`、`df=12`、正文 `p=.012` 与表格 `.01` 记录各自来源，校正未通过；右 FFA `n=16` 不覆盖左侧 `n=13`。未摘录的时间窗/频段/效应方差为 `not-extracted`，不是零。Bosco SD 与未知定位误差分别存在；`actorType:'ai'` 不产生 `human-reviewed`，无真实人名、日期、范围的人工事件验证失败。

  先把当前 `data-sources/results/curated-results.json` 保存为命名测试 fixture，保留原件哈希。测试名 `v1 migration preserves unknowns and review scope`：

```js
const {value} = migrateEvidence(v1Fixture);
assert.equal(value.results.length, 4);
assert.equal(value.locations.length, 8);
assert.ok(value.locations.every(location => location.sourceSpaceId === 'MNI-unspecified'));
assert.deepEqual(getResultViewModel('schaum2021-meg-stop', value).modalities, ['MEG']);
assert.equal(deriveReviewState(value.reviewEvents).humanReviewed, false);
assert.equal(value.results.find(r => r.id === 'schaum2021-meg-stop').timeWindow.state, 'not-extracted');
```

- [ ] **Step 2: 运行失败测试。** Run: `node --test src/lib/evidence-schema.test.mjs`。Expected: v2 或缺失值接口不存在而失败，原始坐标断言保留。
- [ ] **Step 3: 实现纯模型和非破坏性迁移。** `evidence-workspace.js` 仍导出 `validateEvidence`、`mergeEvidence`、`loadEvidence`、`saveEvidence`、`emptyEvidence`，内部委托 v2；读 v1 时只返回迁移预览及限制，未成功保存 v2 前保留旧存储。DOI 合并必须重写所有引用，不凭摘要自动拆出新实验/新 claim。旧 `source-checked` 迁移为带原始 AI 标记和旧核对范围的事件，若缺来源摘录则标记证据材料待补，绝不补造审阅完成。
- [ ] **Step 4: 验证模型和兼容边界。** Run: `node --test src/lib/evidence-schema.test.mjs src/lib/evidence-workspace.test.mjs`，再运行 `node scripts/literature_validate.mjs`。Expected: 新旧包兼容、原坐标和限制不丢、失败迁移不修改输入/旧存储；`getResultViewModel` 输出四个旧结果及原八点，未摘录字段仍显示缺失原因。工程项目导入任务直接复用 `migrateEvidence/validateEvidence`，不创建另一套 v2 校验。
- [ ] **Step 5: 提交。** Run: `git add src/lib/research-contracts.js src/lib/evidence-schema.js src/lib/evidence-schema.test.mjs tests/fixtures/evidence-v1-baseline.json src/lib/evidence-workspace.js src/lib/evidence-workspace.test.mjs src/data/results.js data-sources/results/curated-results.json scripts/literature_validate.mjs docs/evidence-schema-v2.md`，然后 `git commit -m "feat: model experiments locations and evidence review provenance"`。Expected: schema 文档与输出一致。

### Task E3: 补齐双语、功能区别名与论文方法检索

**Files:**
- Create: `src/lib/evidence-search.js`, `src/lib/evidence-search.test.mjs`, `data-sources/results/search-aliases.json`
- Modify: `src/components/LiteratureWorkspace.jsx`, `src/data/results.js`, `data-sources/literature-upgrade/curation.mjs`, `scripts/literature_validate.mjs`, `tests/e2e/evidence.spec.mjs`

**Interfaces:**
- Consumes: E1 映射、E2 `EvidenceBundleV2`；显示语言只决定文案，不改变检索内容。
- Produces: `buildEvidenceSearchIndex(bundle,{aliases,regions}):SearchIndex`、`searchEvidence(index,{query,topic,paperModality,resultModality,regionRef}):SearchHit[]`。`SearchHit={referenceId,resultIds,matchedFields}`；论文 `studyModalities` 与结果 `modalities` 独立，查询 fMRI 论文不将 MEG 结果改标 fMRI。
- `SearchIndex={entries:SearchEntry[]}`；`SearchEntry={referenceId,normalizedText,topics,studyModalities,resultEntries,mappings}`，`resultEntries` 为 `{resultId,normalizedText,modalities}` 数组。`studyModalities` 保存为论文级 `Reported<string[]>`，只用 state=reported 的 value 进行肯定过滤；没有摘录论文方法的记录不自动继承一条结果作为完整论文方法。
- 索引字段固定包括中英题名/摘要/条件/局限、原始 `sourceLabel/sourceRow`、ROI 定义、位置标签、带来源的术语别名与目标图谱名称；别名只扩展搜索，不改变映射、侧化或图谱身份。

- [ ] **Step 1: 写失败测试。** `pre-SMA`、`pre SMA`、`BA44`、`BA44/45`、`停止`、`inhibitory` 在 zh/en 两种显示下均返回 `schaum2021`；`topic:'control'` 与 `paperModality:'fMRI'` 也返回该论文；`resultModality:'fMRI'` 不把 `schaum2021-meg-stop` 当 fMRI 结果返回。变更界面语言不改变相同 query 的 ID 集合；pre-SMA 搜索命中不得产生新的直接区域关系。

  测试名 `bilingual aliases and paper methods remain searchable`：

```js
for (const query of ['pre-SMA', 'pre SMA', 'BA44', 'BA44/45', '停止', 'inhibitory']) {
  assert.ok(searchEvidence(index, {query}).some(hit => hit.referenceId === 'schaum2021'));
}
assert.ok(searchEvidence(index, {topic:'control', paperModality:'fMRI'}).some(hit => hit.referenceId === 'schaum2021'));
assert.ok(!searchEvidence(index, {resultModality:'fMRI'}).flatMap(hit => hit.resultIds).includes('schaum2021-meg-stop'));
```

- [ ] **Step 2: 运行失败测试。** Run: `node --test src/lib/evidence-search.test.mjs`。Expected: 现有搜索或尚未实现的索引无法满足固定查询。
- [ ] **Step 3: 实现索引与筛选接线。** 建立有出处的 `pre-SMA/前辅助运动区`、`BA44/45` 等最小别名集合，大小写/Unicode 连字符/空白归一化保留原词；Schaum 论文的方法记录 MEG、fMRI，主题增补 control，并引用原文方法。工作台使用新索引，分别显示“论文方法”和“已录入结果方法”；不凭结果为空推断论文没有该方法。
- [ ] **Step 4: 验证固定查询和交互。** Run: `node --test src/lib/evidence-search.test.mjs` 和 `node scripts/literature_validate.mjs`。Expected: 固定查询全部命中正确论文，方法过滤符合两层语义。浏览器定向命令：`npm run test:e2e -- tests/e2e/evidence.spec.mjs --grep search`；Expected: 切换语言、输入 `pre-SMA`、选 control/fMRI 后 Schaum 可打开且结果仍显示 MEG；结果 ID 与纯函数测试相同。
- [ ] **Step 5: 提交。** Run: `git add src/lib/evidence-search.js src/lib/evidence-search.test.mjs data-sources/results/search-aliases.json src/components/LiteratureWorkspace.jsx src/data/results.js data-sources/literature-upgrade/curation.mjs scripts/literature_validate.mjs tests/e2e/evidence.spec.mjs`，然后 `git commit -m "fix: index bilingual region aliases and paper methods"`。Expected: 仅检索、元数据与接线变化。

### Task E4: 使原文证据材料可离线复核且保留版权边界

**Files:**
- Create: `src/lib/source-artifact.js`, `src/lib/source-artifact.test.mjs`, `scripts/evidence-audit.mjs`
- Create: `data-sources/results/source-artifacts/index.json`, `data-sources/results/source-artifacts/schaum2021-v1.json`, `data-sources/results/source-artifacts/axelrod2015-v1.json`, `data-sources/results/source-artifacts/bosco2008-v1.json`
- Modify: `data-sources/results/verify-sources.mjs`, `data-sources/results/source-audit.json`, `data-sources/results/curated-results.json`, `src/data/results.js`, `scripts/literature_validate.mjs`

**Interfaces:**
- Consumes: E2 `sourceRefs`、`ReviewEvent` 和 `Reported<T>`。
- Produces: `SourceArtifact={id,referenceId,doi,sourceUrl,sourceVersion,retrievedAt,locator,rights,excerpt,sha256,sourceFileSha256:null|string,fields,limitations}`。`locator` 精确到表/行/列、图注或方法段；`fields` 把转录字段路径绑定到摘录单元格和原始文本。`sourceFileSha256` 仅在实际取得对应来源字节时填写；摘录哈希与全文哈希分开。
- Produces: `verifySourceArtifact(artifact,bytes):IntegrityReport`、`auditTranscription(bundle,artifacts):{integrityErrors,semanticReviewRequired,unavailableArtifacts}`；CLI `node scripts/evidence-audit.mjs --offline --output <new-path>`，有完整性错误或未解除的语义复核项时非零退出。

- [ ] **Step 1: 写失败测试。** 断言全部八个已有坐标具有逐字段来源锚点；将来源摘录一个字符改变而保持旧哈希会产生 `integrityErrors`；仅把转录的 Schaum `[50,20,20]` 改为 `[51,20,20]` 会进入 `semanticReviewRequired`；缺本地材料为 `unavailableArtifacts`，不能记“离线通过”。正文 `.012` 和表格 `.01` 保留两条来源记录；引用 URL、DOI、作者顺序和表编号各自检验，不用另一份整理 JSON 冒充原文。

  测试名 `offline audit separates integrity and transcription`（badBytes、wrongCoordinateBundle、missingArtifactSet 分别仅改变上文一项）：

```js
assert.equal(verifySourceArtifact(artifact, badBytes).valid, false);
assert.ok(auditTranscription(wrongCoordinateBundle, artifacts).semanticReviewRequired.length > 0);
assert.ok(auditTranscription(bundle, missingArtifactSet).unavailableArtifacts.length > 0);
assert.deepEqual(auditTranscription(bundle, artifacts).integrityErrors, []);
```

- [ ] **Step 2: 运行失败测试。** Run: `node --test src/lib/source-artifact.test.mjs`。Expected: 来源 artifact 或字段锚点缺失导致失败。
- [ ] **Step 3: 实现最小来源材料和审计。** 执行时合法获取三篇原文对应表格单元格/必要短语与方法信息，存公开版本、访问日期、定位锚点、许可、来源 URL 和 SHA-256。只保存核对必需的数值与最小合法摘录；不默认复制完整版权论文、整表/整图，不用翻译绕过原文复制边界。解释性文字单列 paraphrase，不能作为“逐字原文”。未确认复制权限的材料保留链接与事实转录，并诚实标注其离线核对范围；源更新新增 v2 artifact，不覆写 v1。Schaum 统计量/时间频率、Bosco 坐标 SD 在读到原文后填入 E2 字段；读不到或原文不清楚则保留 `not-extracted/uncertain`。
- [ ] **Step 4: 验证断网审计和引用保真。** Run: `node --test src/lib/source-artifact.test.mjs`；然后 `node scripts/evidence-audit.mjs --offline --output output/evidence-acceptance/source-audit.json` 和 `node scripts/literature_validate.mjs`。Expected: 在禁用网络的 fetch stub 下成功审计合法缓存；报告逐字段覆盖、缺项和原文差异，不把只通过哈希表述为原文重核。八点必须逐一核对后才能标本批次 source-checked，不沿用此前只抽样六点的结论。
- [ ] **Step 5: 提交。** Run: `git add src/lib/source-artifact.js src/lib/source-artifact.test.mjs scripts/evidence-audit.mjs data-sources/results/verify-sources.mjs data-sources/results/source-artifacts data-sources/results/source-audit.json data-sources/results/curated-results.json src/data/results.js scripts/literature_validate.mjs`，然后 `git commit -m "feat: retain minimal source artifacts for offline evidence audit"`。Expected: 不包含无许可全文、下载临时文件或用户私有资料。

### Task E5: 导出无需内置库解释的完整证据包

**Files:**
- Create: `src/lib/evidence-package.js`, `src/lib/evidence-package.test.mjs`
- Modify: `src/lib/evidence-workspace.js`, `src/lib/evidence-workspace.test.mjs`, `src/components/LiteratureWorkspace.jsx`, `docs/evidence-schema-v2.md`, `tests/e2e/evidence.spec.mjs`

**Interfaces:**
- Consumes: E1–E4 全部记录与现有 `normalizeDOI`；工程计划负责外层项目事务、容量和私有资产管理。
- Produces: `buildEvidencePackage({paperIds:string[],bundle:EvidenceBundleV2,includePrivate:boolean=false}):EvidenceBundleV2`、`validateEvidencePackageClosure(bundle):ValidationReport`。导出包含被选论文的 reading、claims、mappings、limitations、方法来源、实验/结果/位置、必要 source artifacts/审阅事件、数据版本；关系两端必须都在包内，若外部端未选中则标记排除说明，不留下悬空 ID。默认仅发布清单内的公共记录；用户选择本地证据文件导出时可传 true，以保存其选定私有结果，仍不能进入公共 URL 或公开结果页。
- 论文→实验→结果→位置与 claim→mapping 的引用闭包独立可解释；没有实际图谱映射时保留 `targetConceptId` 和 `targetRegionRef:null`，不能通过补造图谱身份消除校验错误。

- [ ] **Step 1: 写失败测试。** 导出 `kanwisher1997` 后在 `knownReferences:[]/knownResults:[]/knownRegions:undefined` 下验证成功；`results` 可为空，但 `claims/mappings/readings`、双语限制、原文 URL 和 `dataVersion` 必须非空。以序列化包单独重建论文阅读卡，文本与映射支持类型不变。重复 DOI 的别名导入后，实验/claim/mapping 的 `referenceId` 均指向同一 canonical ID；输入包不被原地修改。导出不得夹带其他论文的本地批注或未选择私有影像。

  测试名 `reading-only export is independently interpretable`：

```js
const exported = buildEvidencePackage({paperIds:['kanwisher1997'], bundle, includePrivate:false});
assert.equal(exported.results.length, 0);
assert.ok(exported.claims.length > 0 && exported.mappings.length > 0 && exported.readings.length > 0);
assert.equal(validateEvidencePackageClosure(JSON.parse(JSON.stringify(exported))).valid, true);
assert.ok(exported.dataVersion && exported.mappings.every(mapping => mapping.limitations));
```

- [ ] **Step 2: 运行失败测试。** Run: `node --test src/lib/evidence-package.test.mjs`。Expected: 现有仅 references/results/relations 导出缺少 claim/mapping 或无法独立验证。
- [ ] **Step 3: 实现闭包导出及 UI 接线。** 工作台的单篇/选定集导出共用 `buildEvidencePackage`，v1 导入先纯迁移再校验；仅成功后交给现有存储入口。将缺失内置库作为常规独立导入场景，包中保留历史来源、版本和审阅范围；只包含拥有可再分发依据的来源内容，其他材料保留可解析的引用和限制。
- [ ] **Step 4: 验证独立往返。** Run: `node --test src/lib/evidence-package.test.mjs src/lib/evidence-workspace.test.mjs`。Expected: Kanwisher 无结构化坐标也能完整导出其阅读证据；纯 JSON 往返保留 claim/映射/限制。浏览器定向命令：`npm run test:e2e -- tests/e2e/evidence.spec.mjs --grep export`；Expected: 从干净会话导入该包，导出前后的具体内容一致；失败导入不写存储由工程事务测试交叉验证。
- [ ] **Step 5: 提交。** Run: `git add src/lib/evidence-package.js src/lib/evidence-package.test.mjs src/lib/evidence-workspace.js src/lib/evidence-workspace.test.mjs src/components/LiteratureWorkspace.jsx docs/evidence-schema-v2.md tests/e2e/evidence.spec.mjs`，然后 `git commit -m "feat: export self-contained reading and result evidence"`。Expected: 无本地私有数据混入提交。

### Task E6: 建设有限专题的可追溯案例与统计图来源链

**Files:**
- Create: `data-sources/results/curation-scope.json`, `data-sources/results/upstream-assets.json`, `data-sources/results/corrections.json`
- Create: `src/lib/statmap-source.js`, `src/lib/statmap-source.test.mjs`, `src/lib/result-publication.js`, `src/lib/result-publication.test.mjs`
- Create: `src/components/ResultRecordPage.jsx`, `src/components/ResultRecordPage.css`, `docs/evidence-case-acceptance.md`, `docs/evidence-quantification-evaluation.md`
- Modify: `src/data/results.js`, `data-sources/results/curated-results.json`, `scripts/literature_validate.mjs`, `src/components/LiteratureWorkspace.jsx`

**Interfaces:**
- Consumes: E1–E5；S1/S3/S4/S5 的身份/查询及 ROI 指标接口；X1/X4 的定位与结果层接口，以及 W5/W6 的保存恢复与计算清单。E6 不依赖 X11 的页面路由，先完成公开记录投影和组件，再由 X11 挂载；不得用本任务重新计算另一套空间变换。
- Produces: `lookupStatMapsByDOI(doi:string,{fetcher,signal}):Promise<UpstreamCandidate[]>`；`UpstreamCandidate={provider:'NeuroVault',collectionId,imageId,paperDOI,sourceURL,retrievedAt,upstreamVersion,asset:AssetIdentity|null,sourceSpaceId:null|string,mapKind,statisticType,thresholdState,rights,status}`，`status='candidate'` 不等于已下载、已匹配论文或已配准。
- Produces: `resolveStatMapAsset(candidate,downloadManifest):AssetRecord`，记录上游对象 ID、版本/更新时间、原文件哈希/许可、原网格和 affine。只有来源空间明确且空间计划已有可验证变换，才生成包含 source/target `AssetIdentity`、transform ID/version/hash、插值、误差与限制的 derived asset；未知空间停在原生/独立空间。
- `AssetRecord={upstream:UpstreamCandidate,sourceAsset:AssetIdentity,sourceSpaceId:null|string,sourceGrid,derivedAsset:AssetIdentity|null,transformRef:null|string,limitations:BiText[]}`。未知 AssetIdentity.spaceId 使用 null，不以 `other` 冒充已经建立的空间身份；`sourceGrid` 保存 shape/voxelSize/affine/axisConvention。
- Produces: `buildPublicResultRecord(bundle,{resultId,dataVersion}):PublicResultRecord`；`PublicResultRecord={resultId,dataVersion,contentHash,sourceRefs,experiment,result,locations,mappings,reviewState,limitations,corrections}`。固定入口 `?result=<id>&version=<dataVersion>` 指向不可变数据快照；省略 version 只作为最新版本跳转；勘误条目 `{id,subjectId,fromVersion,toVersion,date,reason,changedFields,sourceRefs}` 保留前后版本。公开投影只接受发布清单内的不可变内置记录，不能信任导入数据自称 public；私有 claim/结果/自由文本均不进入 URL 或页数据。

- [ ] **Step 1: 固定建议专题与案例边界。** 在 `curation-scope.json` 记录 `status:'proposed'`，推荐先做“运动抑制/控制”（Schaum），备选“面孔感知”（Axelrod）及“动作知觉/TMS”（Bosco）；这不是用户已选定主题。按总计划三个可审计案例组织工作：有明确来源空间的坐标查询案例、任意实际图谱标签的映射/ROI 案例、原始统计图或 mask 的影像案例。验收按链路完整性，不设任意新增论文数量指标；优先补现有三篇的实验/统计/空间依据，缺合格来源则报告缺口，不能制造通过案例。
- [ ] **Step 2: 写失败测试。** mock NeuroVault 返回匹配 DOI、多集合、空结果、DOI 不匹配和未知空间候选；断言来源只作候选，未知空间无 derived overlay、`AbortSignal` 中止后不提交候选。明确空间 fixture 必须保留源/目标不同身份及变换版本/哈希。原八点仍逐一 `MNI-unspecified`、直接叠加 0。公开页 v1 在录入 v2 勘误后内容哈希不变；URL 指定 v1 不能读取最新版内容；未人工审阅显示未完成，不出现专家认证。

  测试名 `upstream identity never establishes unknown space`、`published result versions are immutable`：

```js
const unknownAsset = resolveStatMapAsset(unknownSpaceCandidate, downloadedFixture);
assert.equal(unknownAsset.sourceSpaceId, null);
assert.equal(unknownAsset.derivedAsset, null);
assert.equal(oldVersionAfterCorrection.contentHash, originalV1.contentHash);
assert.throws(() => buildPublicResultRecord(v2Bundle, {resultId:'schaum2021-meg-stop', dataVersion:v1Version}), /version-mismatch/);
```

- [ ] **Step 3: 运行失败测试。** Run: `node --test src/lib/statmap-source.test.mjs src/lib/result-publication.test.mjs`。Expected: 上游身份/版本快照接口未实现；未知空间和历史版本断言必须保留。
- [ ] **Step 4: 实现来源连接和结果页数据投影。** 执行时核查 NeuroVault 官方 API 的当前查询参数与字段后实现只读 DOI 查询；检索结果必须核对集合/影像对应论文与对比。合法获取原始统计图/ROI 时保存 `upstream-assets.json`，不把“来自 NeuroVault”当作具体模板证明；上游无版本号时记录原更新时间、取得时间和哈希，不伪造版本。补足推荐专题的可审计结果，明确 `not-extracted/no-coordinates/space-unknown/space-verified`。验证器保留旧 3 篇/4 结果/8 点为命名基线子集，新增记录按版本清单校验，不把未来全库数量硬编码为旧基线。创建可引用的结果页组件和不可变版本数据投影，路由挂载由 `04-experience.md` 完成；原文、空间、图谱、局限、审阅范围与勘误同时可见。本计划不执行公网发布。
- [ ] **Step 5: 验证三个案例与研究边界。** Run: `node --test src/lib/statmap-source.test.mjs src/lib/result-publication.test.mjs`、`node scripts/evidence-audit.mjs --offline --output output/evidence-acceptance/topic-audit.json`、`node scripts/literature_validate.mjs`。Expected: 自动检查通过；`docs/evidence-case-acceptance.md` 对三个案例逐项记录原文→来源空间→图谱/ROI→保存/恢复→独立导出及返回原文的证据。需要领域复核的栏位记录实际 reviewer、日期、范围与结论；未获得真实 reviewer 时保持 pending，不能称专家验收通过。`docs/evidence-quantification-evaluation.md` 仅评估纳入标准、重复样本、依赖效应、坐标/影像混合、缺失方差、异质性与多重比较是否允许后续评分/元分析，输出 go/no-go 和依据，不实现分数或自动汇总推论。
- [ ] **Step 6: 提交。** Run: `git add data-sources/results/curation-scope.json data-sources/results/upstream-assets.json data-sources/results/corrections.json src/lib/statmap-source.js src/lib/statmap-source.test.mjs src/lib/result-publication.js src/lib/result-publication.test.mjs src/components/ResultRecordPage.jsx src/components/ResultRecordPage.css docs/evidence-case-acceptance.md docs/evidence-quantification-evaluation.md src/data/results.js data-sources/results/curated-results.json scripts/literature_validate.mjs src/components/LiteratureWorkspace.jsx`，然后 `git commit -m "feat: trace curated results to versioned source maps and records"`。Expected: 只提交有明确再分发范围的内容；大原始影像按工程资产清单管理，不临时塞入证据 JSON。

## 覆盖与交接

- 审查 B6 / evidence-review 1–2 → E1；B7 / evidence-review 3 → E3；evidence-review 4 → E4；evidence-review 5 → E5；evidence-review 7 → E2；结果覆盖、空间链、NeuroVault、公开页/勘误路线图 → E6。
- E1、E2 先固定接口，E3/E4 可并行，E5 依赖 E2/E4，E6 依赖 E1–E5 与空间/保存任务。修改 `LiteratureWorkspace.jsx` 时依任务顺序接线，避免与交互工作同时覆盖整文件。
- 数字展示由交互任务消费明确口径；人审完成只由真实审阅记录触发。三个案例中任何来源/空间/人工复核未满足条件的环节必须留为 pending，不能为了计划退出条件假造证据。

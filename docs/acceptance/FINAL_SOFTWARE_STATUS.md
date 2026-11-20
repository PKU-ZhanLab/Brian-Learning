# 当前软件状态 / Current software status · 4.2.0

代码基准：**aa20e40f2e6261492f4ef8d63ba4f89204fca386**。该提交的软件修正已由下述审查和代码/API检查覆盖，根负责人整合检查为 **450/450，零失败、取消、跳过**，数据与文献校验通过。[实际收据](evidence/final-code/root-450-check.txt)。这不表示完整科研计划、浏览器验收或发布完成。

| 审查阶段 | 实际结论 |
|---|---|
| 独立全分支审查，ca00c09→dbac9eb | WITH FIXES；提出 I1–I6 及 M1。[报告](evidence/final-code/FINAL-review.md) |
| 独立范围复审，dbac9eb→cdeb6ed | I2–I6/M1 已解决；I1 尚有 R1，历史合并有 R2。[报告](evidence/final-code/FINAL-fix-review.md) |
| aa20e40 残留修正 | ROOT 直接检查完整限定差异、源文件指纹及回归，关闭 R1/R2 的已证明软件契约；**没有后来独立审阅者的全分支 all-clear**。[实际归属与范围](evidence/final-code/FINAL-residual-closure.md) |

cdeb6ed550733b13fb0cb3c24ccf41f0f80bcbd2 的归档、安装和构建是 **WITHHELD 中间产物**，当时两项问题尚未关闭，不能作为最终交付。M2 的密集代码可维护性观察仍为非阻断项。

当前修正覆盖：

- 本地资产按项目/条目世代隔离；缓存返回及比较结果发布时重查当前归属，保留公共数据的版本/哈希检查。
- 项目合并保留不可变原文对象和既有别名；无法无损表达的来源或计算历史冲突原子拒绝。合并后的当前视图有自己的选中访问记录，不覆盖原有访问/滚动/计算绑定，容量不足也拒绝。
- 刷新恢复解除丢失会话影像的活动引用，保留研究元数据、缺失身份、可用历史数值及原始恢复记录。下载与“我已保存，继续工作”确认分开；容量/提交失败保留原件。
- 项目载入后仅在实际派生字节/网格核验成功时获得新验证状态；不声称包含原始 NIfTI 字节，也不独立认证用户的空间声明。
- 科研旅程断言真实的操作数与完整来源依赖闭包（当前示例15项），等待异步确认/结果/错误/取消；无效导入标签动作被阻止。真实界面行为仍未执行。

实际范围证据：[189项覆盖](evidence/final-code/covering-final.txt)、[46项消息/事务覆盖](evidence/final-code/covering-message-final.txt)、[73项残留覆盖](evidence/final-code/residual-covering-final.txt)、[追加修正报告](evidence/final-code/FINAL-fix-report.md)。三条旅程仅完成[静态发现](evidence/final-code/static-e2e-list.txt)。[原始失败与指纹清单](evidence/final-code/inventory.json)保留六个原始RED和三组残留RED/GREEN；原始残留程序2修复后因未捕获的正确归属拒绝而 **exit1**，该原样日志不是一次通过的测试；73项套件明确断言该拒绝。

## 分发身份与未完成事项

本页记录代码 **aa20e40**。实际文档后继提交、源码/分发包、全新安装、构建和恢复结果及文件哈希，另由交付产物的 **build-source.json、不可变清单和分发核验报告**记录，以其实际结果为准。build-source.json 记录实际构建提交/源树，build-files.json 与独立 expected manifest 绑定完整文件/哈希；公开变换源码另保留 SOURCE_ORIGIN，不能由父Git推断精确干净提交。[交付与回退](RELEASE_CHECKLIST.md)。

| 门槛 | 当前状态 |
|---|---|
| 修正后的恢复下载/确认、导入标签、最终组合科研流程 | not-run：需允许的真实浏览器/独立CI执行 |
| 最终视口组合、原生200%缩放、文件选择器取消、读屏器、触屏 | not-run；历史reflow/抽样不替代本轮原生验收 |
| 浏览器p95、峰值内存、首帧、取消延迟、查看器/GPU同条件比较 | not-run / 未量化；既有构建警告和约1.1s Node规范化限制保留 |
| 独立科研使用、实际参与者任务完成率/耗时、真人来源/解剖复核 | pending-review；无实际人员记录，不补造 |
| S6科学空间验收 | partial，human=false，14项覆盖缺口、零合格替换源 |
| E6确切来源空间/图像科学闭环 | pending-review；原八个MNI-unspecified坐标不升级为已配准叠加 |
| aa20e40文档后继的源码/分发包、安装、构建及回退核验 | 由分发核验记录；按实际提交、不可变文件清单和收据结果核对 |
| workflow发布授权、GitHub Pages与上线后哈希/关键流程 | pending / not-run；4.2.0尚未发布 |

[50项要求与31项任务矩阵](STATUS.md)保留每个历史版本的证据范围；[验证记录](VALIDATION_RESULTS.md)区分早期worker探针与当前软件检查。此页只记录软件修正及其真实边界。

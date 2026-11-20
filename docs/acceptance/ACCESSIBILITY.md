# 可访问性验收 / Accessibility acceptance

范围：历史固定构建的真实 CUA 观察与当前编写的隔离套件分开。本轮 G1 没有执行浏览器或桌面操作。

| 检查 | 状态 | 真实依据与边界 |
|---|---|---|
| 键盘弹窗进入/限制/逐级关闭/焦点返回 | pass（历史版本抽样） | X6-cua.md、X5-cua.md；当前最终组合 not-run |
| 390/650 px 设置与长文本 | pass（历史版本抽样） | X7-cua.md；output/x7-cua/*long-tail*、drawer-390-initial.json |
| 1366×768、683×384 短视口比较 | pass（e531eb1 抽样） | comparison-short-fixed.json/png；404.38→62.59 px 标题，TBODY 命中及完整标题键盘打开 |
| 1440×900 及桌面布局 | pass（任务版本抽样） | 对应任务 CUA 构建收据；完整最终视口矩阵 not-run |
| 768 / 1920×1080 最终组合 | not-run | 不能由相邻宽度推断 |
| 普通文本对比、字号 | pass（抽样计算） | style-samples-fixed.json、style-contrast-fixed.json；不是全站穷尽审计 |
| 真正浏览器 200% 缩放 | not-run | 快捷键未改变浏览器指标；683×384 只证明 reflow |
| 原生文件选择器取消 | not-run | 实际选择/导入已有记录；取消路径不可由 setInputFiles 代替 |
| 读屏器实际播报 | not-run | 状态语义/键盘测试不能替代读屏器 |
| 实际触屏、色觉与独立科研使用 | pending-review | 无参与者记录；不编造完成率或耗时 |

允许的后续隔离 CI：运行 keyboard-dialogs、responsive-workspace、research-journeys、project-recovery 等套件；保留截图、trace、浏览器/设备/版本与失败日志。原生缩放/文件取消/读屏器仍需实际授权 UI 会话，不用注入脚本冒充。详情见 [STATUS](STATUS.md) 与 evidence/task-evidence.json 中的真实记录指纹。

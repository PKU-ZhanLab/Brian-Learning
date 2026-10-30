# 使用指南 / User guide · 4.2.0

选择界面语言后，从任务入口进入坐标、脑区、影像或论文。主脑、原生切片和 ROI 使用各自坐标上下文；输入保留小数，LPS 明确转换为 RAS。批量粘贴后逐点切换，复制时保留空间身份。不同空间之间不自动移交位置。

Use the task entries to enter coordinates, select atlas labels, import images or find papers. Decimal coordinates and their reference space stay together. Main-template, native and ROI navigation are separate contexts; LPS input is explicitly converted to RAS.

图谱标签以图谱、版本、标签号、半球和空间识别。选择篮可以把完整多选设为 A 或 B，另一侧与阈值保留。原生或未知空间标签可浏览，但无共同空间依据时不能交给模板比较。可选择 1/2 mm 共同网格；计算前查看逐标签采样损失。1 mm 是采样间距，不是定位精度。

Atlas labels retain atlas/version/label/hemisphere/space identity. Send a selection to A or B without clearing the other side. Check sampling loss before comparison. A smaller grid does not establish anatomical accuracy. Linked comparison requires the same specific reference with recorded provenance; each side can remain independent.

导入 NIfTI 后为当前文件重新选择类型、空间、来源和已对齐声明；统计图需要阈值及尾部，标签图需要标签表。未知空间保持独立查看。取消计算/导入后可重试；失败不登记半成品。大文件的完整项目准备仍可能阻塞约 1.1 秒（Node 合成上限测量，不能当作浏览器性能保证）。

Declare kind, space, provenance and alignment for each imported NIfTI. Statistical maps need a threshold and tail; labelled images need their own dictionary. Use the assets panel to inspect/remove an asset and preview dependencies before selective export.

“项目与视图”区分命名视图、公开链接与完整项目。打开替换当前项目，合并执行独立冲突校验。导出前查看包含资产、原始影像字节和实际项目文件大小。新会话通过项目文件恢复；浏览器本地记录不代替完整文件备份。未完成编辑作为项目内草稿保存，超限明确显示未保存并保留输入。

Projects & views separates named views, public links and complete projects. Open replaces the active project after validation; merge has explicit conflict handling. Export a complete project before changing browsers or machines. Review selected assets and file size before confirming the download. Browser storage is not a portable image backup.

v1 项目/证据/视图仍可读取；缺失的来源、空间或数值历史不会被补造。保留旧文件，再另存 v2。恢复历史计算不会自动重算；身份变化时先查看差异，再显式重算，原始与重算结果分别保留。排除输入资产可保留历史数值供检查，但不能无输入复算。

Keep the original v1 file and save migrated v2 separately. Missing provenance remains missing. Restoring a saved result never silently recomputes it; inspect differences and explicitly recompute into a distinct history slot. Removing an input can retain historical numbers while disabling recomputation.

刷新后若会话影像不可用，可在“项目与视图”选择“归档恢复记录并继续”，另存原样的刷新前元数据 **.json**。它独立于 **.neuroatlas** 完整项目，不含已丢失的影像字节。下载本身不会丢弃恢复副本；确认文件已保存后，点击“我已保存，继续工作”，才允许移除活动项目中的嵌入副本并正常继续。配额、合并或提交失败保留原件；选择只导出部分影像时，须先归档恢复记录。要恢复影像本身，请打开之前保存的完整项目文件。

If session images are unavailable after a reload, choose **Archive recovery record and continue** in Projects & views to save the exact pre-refresh metadata as a separate **.json** archive. This is separate from a complete **.neuroatlas** project and contains no lost image bytes. Downloading alone keeps the recovery copy; after verifying the file is saved, **I saved it; continue** acknowledges it and allows normal work while removing the embedded active-project copy. Quota, merge or commit failures preserve the originals; archive recovery first before exporting only selected images. Restore image bytes from a previously saved complete project.

[结果与来源](RESULTS_WORKFLOW.md) · [空间说明](SPACE_ALIGNMENT.md) · [当前验收及限制](acceptance/STATUS.md) · [键盘与可访问性](acceptance/ACCESSIBILITY.md)。

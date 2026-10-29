# 本地候选、发布与回退 / Release and rollback

应用版本4.2.0，当前未发布。软件/构建通过不等于运行/科学验收。先完成全分支独立审查并由根负责人提交，再在干净源码上构建最终候选；G1工作区构建只证明当时脏树，不声称精确提交产物。完整状态见[矩阵](STATUS.md)和[命令结果](VALIDATION_RESULTS.md)。

## 可复现检查

使用Node22或更新版本，固定package-lock。首次安装显式执行npm ci；不要靠npx隐式下载缺失运行器。Python科学处理需先检查适用conda环境，默认环境不临时装包。

```powershell
npm ci
npm run check
node scripts/spatial-qc.mjs --check
node scripts/validate-segmentation-source.mjs --check
node scripts/evidence-audit.mjs --offline
npm run build:public
```

候选分割源缓存不随源码再分发。缺缓存时按data-sources/spatial-qc/source-preparation.json和docs/validation/spatial-qc-protocol.md的固定来源准备流程显式获取/核对；--check不改写科学期望。原始完整资料的legacy anatomy验证与公开按需版不同：公开版strictlegacy失败不能靠改计数处理。保留原件与实际检查收据。

隔离CI在明确允许的环境运行：

```powershell
npm run test:e2e -- --list
npm run test:e2e
npm run test:e2e -- --config tests/e2e/public-result-page.config.mjs
```

本轮只执行--list，未执行浏览器。新会话项目恢复、网络错误/取消、键盘、390/650/768及1366×768/1440×900/1920×1080组合仍须保留实际截图/log/trace。原生200%缩放、原生取消和读屏器不可由reflow/脚本文件赋值代替。

## 源码包与来源身份

在唯一实施checkout执行显式新目标，保持已有候选：

```powershell
node scripts/public-package.mjs output/release-candidate/REPLACE_WITH_NEW_ID/source
```

包内有src/scripts/docs/tests、浏览器config/CI、许可及固定允许源，另有experiments/viewer-comparison的源/锁/notices。没有node_modules、dist、output、候选源rawcache、受限全文/原始图。原型依赖与生产分离；如要复现原型，在原型目录单独npm ci --ignore-scripts，运行其fixture测试/构建。原型../../src引用指向同包父源码，不引用用户原资料。

SOURCE_ORIGIN.json记录originCommit、原工作区状态与变换后树哈希。经过公开打包的源码是transformed-source-package，即使嵌套在父Git仓库里，也不能自称父仓库的干净提交。源码被增删/修改将使构建来源校验失败。npm ci后node_modules仍排除在源码身份之外。仅排除文档化生成目录（node_modules/dist/dist-public/output/.git/.vite/test-results/playwright-report/browserprofiles/.superpowers）；未声明的源码、配置或根文件变化仍会失败。QC候选缓存保持包外，必须按固定准备清单另行校验。

## 不可变发布清单

公开构建另以独占创建的build-files.json绑定构建器产生的完整文件列表/hash，缺失JS/chunk不能在创建发布期望时被遗漏。公开构建在build-source.json记录构建前后相同的源树指纹、origincommit、version及clean/exactCommit。任意旧dist不能从当前HEAD推断来源。最终干净源码命令（PowerShell）：

```powershell
$releaseCommit = git rev-parse HEAD
npm run build:public
node scripts/verify-release.mjs --create-manifest dist-public output/release-candidate/REPLACE_WITH_NEW_ID/expected.json $releaseCommit 4.2.0 .
node scripts/verify-release.mjs --verify dist-public output/release-candidate/REPLACE_WITH_NEW_ID/expected.json $releaseCommit .
```

先创建父目录；清单使用独占创建，拒绝覆盖。--verify只读清单和产物，不会刷新期望。验证先要求主数据/解剖/QC/公开版/资产清单/结果页清单与build-source，核对版本、声明文件、每个结果版本/内容摘要、静态HTML哈希，再比较完整文件列表/哈希、缺失/额外/变更文件与指定源树。篡改、缺文件、额外文件、旧源身份均失败。exactCommit校验必须提供真实源码根；sourcepackage只报告变换后来源。

不要将expected.json写在构建目录内部。保存整个构建与expected.json、verify输出、源提交及Gitbundle/archive；根负责人在最终提交后生成这些保全文件。例如在同一新候选父目录执行下列只读归档命令，并保存返回的SHA256：

```powershell
git bundle create output/release-candidate/REPLACE_WITH_NEW_ID/source.bundle --all
git archive --format=zip --output output/release-candidate/REPLACE_WITH_NEW_ID/source.zip $releaseCommit
Get-FileHash output/release-candidate/REPLACE_WITH_NEW_ID/source.bundle -Algorithm SHA256
Get-FileHash output/release-candidate/REPLACE_WITH_NEW_ID/source.zip -Algorithm SHA256
```

Gitarchive与经过许可变换的sourcepackage分别保留，不互相冒充。未通过时保留候选与日志，新建下一个目标，不删除证据、不更新旧期望掩盖问题。

## 发布及回退门槛

- [ ] 最终独立分支审查及干净源提交；最终sourcepackage实际check/build/manifest验证。
- [ ] 允许环境的完整浏览器旅程和原生可访问性；科学人审/独立使用继续按各自状态记录，不能伪造。
- [ ] 用户已批准可审查候选及所需workflow发布权限；当前待批准，不重试推送或绕过凭据。
- [ ] 发布后读取实际Pages构建提交/状态、版本、全部清单文件hash和关键浏览器流程；metadata200不能代替全部线上验收。

当前只读线上public-edition.json仍是4.1.0；main基线ca00c0928b0c7b62c662636cddf3a8d1da374a15、gh-pages基线88ebe3a3ac56976c0fe3a70df34da8efeec70841的收据在evidence。4.2.0未上线。

回退准备：保留已部署4.1.0完整site/expectedmanifest和对应源提交，另保留完整项目v1/v2原文件及当前研究导出。回退时由根负责人在新候选目录从已保存提交/包重新构建并验证，按有效授权发布先前已验证site，复核Pages实际提交和全部哈希。不要reset用户工作区、镜像删除资料或用程序降级覆盖研究文件；若旧版不能读取新字段，使用保留的新版本导出和原文件恢复。应用回退不重写历史证据dataVersion或计算身份。

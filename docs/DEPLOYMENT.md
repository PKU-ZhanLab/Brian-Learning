# 发布与维护

在线入口：<https://pku-zhanlab.github.io/Brian-Learning/>。仓库 `main` 保存公开源码，`gh-pages` 保存已构建网站。GitHub Pages 从 `gh-pages` 的根目录发布，`.nojekyll` 保留静态资源原样。

## 修改公开版本

在 `main` 的工作副本中修改并检查：

```sh
npm ci
npm run check
npm run build:public
```

`dist-public` 是发布内容，部署路径默认为 `/Brian-Learning/`。确认页面与资源加载后，将该目录内容提交到单独的 `gh-pages` 工作副本并推送。源码改动提交到 `main`。不要强制推送或将包含本地原始缓存的整个工作目录上传。

## 从完整本地数据生成公开源码

```sh
npm run package:source
```

默认输出到 `.deployment/source`，保留完整本地目录。打包会按声明规则去掉不能镜像的旧版资产、PAM50 数据及文献全文缓存，并保留必要许可和可分发原件。公开包的 `PUBLIC_RELEASE.json` 与 `public/data/public-edition.json` 记录范围，`asset-checksums.json` 保存文件哈希。

PAM50 通过浏览器从固定版本官方 URL 按需读取；官方服务不可达时界面显示加载失败。更新源版本、哈希、空间说明或许可时，需要同步审查数据描述和重建测试。

数据转换脚本需要 Python 时先检查对应 conda 环境；不要向默认环境安装依赖。直接运行网页只需要 Node.js。

---
doc_id: "DOC-RUNBOOK-GITHUB-RELEASE"
title: "GitHub Releases 自动更新发布流程"
doc_type: "runbook"
layer: "L8"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "release"
  - "electron"
source_of_truth: true
tags:
  - "tech-cc-hub"
  - "runbook"
  - "github-release"
  - "electron-updater"
---

# GitHub Releases 自动更新发布流程

## 目标

使用 `electron-updater + GitHub Releases + GitHub Actions` 作为桌面端更新链路，不部署自有更新服务器。

## 当前策略

- App 整包更新走 GitHub Releases。
- macOS 包在 `macos-14` runner 构建。
- Windows 包在 `windows-latest` runner 构建。
- 客户端启动后通过 `electron-updater` 检查 release metadata。
- 发现新版本后由用户手动下载，下载完成后重启安装。
- `skills / prompts / rules / templates` 这类内容热更新后续单独做，不和 Electron 主程序整包更新混在一起。

## 发布入口

一键发布 patch 版本：

```bash
npm run release:github -- patch
```

发布 minor 版本：

```bash
npm run release:github -- minor
```

发布指定版本：

```bash
npm run release:github -- v0.1.2
```

只预览命令，不改文件、不打 tag：

```bash
npm run release:github -- patch --dry-run
```

只生成本地 release commit 和 tag，不推送：

```bash
npm run release:github -- patch --no-push
```

## 脚本会做什么

`scripts/github-release.mjs` 会执行：

1. 确认当前目录是 Git 仓库。
2. 检查 `origin` 是否指向 `lst016/tech-cc-hub`。
3. 默认要求工作区干净。
4. 根据 `patch / minor / major / vX.Y.Z` 计算版本号。
5. 更新 `package.json` 和 `package-lock.json`。
6. 创建 `chore: release vX.Y.Z` commit。
7. 创建 annotated tag `vX.Y.Z`。
8. 推送当前分支和 tag 到 GitHub。
9. 由 GitHub Actions 自动构建 macOS / Windows 包并上传 Release。

## GitHub Actions 产物检查

发布后打开：

```text
https://github.com/lst016/tech-cc-hub/releases
```

一个可用于自动更新的 Release 应该至少包含：

- Windows installer，例如 `.exe`
- Windows update metadata，例如 `latest.yml`
- macOS installer，例如 `.dmg`
- macOS zip，例如 `.zip`
- macOS update metadata，例如 `latest-mac.yml` 或 arm64 对应 metadata
- blockmap 文件

如果 metadata 缺失，客户端无法通过 `electron-updater` 发现更新。

## 本机是否需要打 Windows 包

不需要。

Mac 本机可以尝试交叉打 Windows 包，但生产发布默认走 GitHub Actions 的 `windows-latest`。原因：

- Windows runner 更接近真实目标环境。
- NSIS installer 在 Windows runner 上更稳定。
- 平台二进制依赖更容易按目标平台安装。
- 不需要在本机维护 Wine / cross compile 细节。

## 注意事项

- Public 仓库的 GitHub Actions 对标准 runner 基本免费，适合当前项目。
- 不要用 `portable` 作为自动更新主线，Windows 自动更新主线使用 `nsis`。
- macOS 自动更新需要保留 `zip` target，`dmg` 主要用于手动安装。
- 发版前应先完成代码审查和 QA，不要把未验证版本推给用户。
- 如果 tag 已存在，不要复用 tag。修复后发新版本。

## 回滚策略

如果 Release 有问题：

1. 在 GitHub Release 页面标记问题版本说明。
2. 修复后发布更高版本号。
3. 不建议删除并重发同一个 tag，客户端和缓存可能已经看到旧 metadata。


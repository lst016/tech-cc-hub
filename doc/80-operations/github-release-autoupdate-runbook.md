---
doc_id: "DOC-RUNBOOK-GITHUB-RELEASE"
title: "内网优先与 GitHub 备用自动更新发布流程"
doc_type: "runbook"
layer: "L8"
status: "active"
version: "1.1.0"
last_updated: "2026-07-23"
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
  - "internal-release"
  - "electron-updater"
---

# 内网优先与 GitHub 备用自动更新发布流程

## 目标

使用 `electron-updater + 内网 Nginx + GitHub Releases` 作为桌面端更新链路。客户端优先检查和下载内网版本；内网不可达、元数据缺失或暂无新版时，继续使用 GitHub Releases。

## 当前策略

- App 整包更新默认按 `内网 -> GitHub` 顺序检查。
- 内网版本目录：`http://172.18.56.18/tech-cc-hub/release/`。
- 客户端读取 Nginx `autoindex`，按版本号选择最高的完整 `vX.Y.Z/` 目录。
- 在目录列表启用前，客户端使用 `v0.1.62/` 作为当前 bootstrap feed。
- GitHub Actions 仍是正式构建和 GitHub Release 发布入口；现阶段将其产物同步到内网版本目录。
- 内网安装包下载失败时，客户端会重新检查 GitHub 并从备用源下载。
- macOS 包在 `macos-14` runner 构建。
- Windows 包在 `windows-latest` runner 构建。
- `v*` tag 发布只走 `.github/workflows/release.yml`；`.github/workflows/build.yaml` 仅作为手动构建验证入口，避免同一个 tag 被两条流水线重复发布。
- Windows 发布包统一执行 `npm run dist:win`，由 `scripts/package-win-safe.mjs` 生成 installer、`latest.yml`、blockmap 和稳定别名。
- Release 上传前会再次校验 `latest.yml` 指向的 installer、`.blockmap` 和声明文件大小，校验失败不创建 GitHub Release。
- 客户端启动后通过 `electron-updater` 检查 release metadata。
- 发现新版本后由用户手动下载，下载完成后重启安装。
- `skills / prompts / rules / templates` 这类内容热更新后续单独做，不和 Electron 主程序整包更新混在一起。

## 内网目录约定

版本目录保留历史产物。每次本地打包后，把同一版本的 metadata、installer 和 blockmap 一起上传：

```text
/var/www/tech-cc-hub/release/
├── v0.1.62/
│   ├── latest.yml
│   ├── latest-mac.yml
│   ├── latest-x64-mac.yml
│   ├── tech-cc-hub Setup 0.1.62.exe
│   ├── tech-cc-hub Setup 0.1.62.exe.blockmap
│   ├── tech-cc-hub-0.1.62-arm64-mac.zip
│   ├── tech-cc-hub-0.1.62-arm64-mac.zip.blockmap
│   ├── tech-cc-hub-0.1.62-arm64.dmg
│   ├── tech-cc-hub-0.1.62-x64-mac.zip
│   ├── tech-cc-hub-0.1.62-x64-mac.zip.blockmap
│   └── tech-cc-hub-0.1.62-x64.dmg
└── v0.1.63/
    ├── latest.yml
    ├── latest-mac.yml
    ├── latest-x64-mac.yml
    └── ...
```

上传 `v0.1.62` 后检查目录和文件权限：

```bash
test -f /var/www/tech-cc-hub/release/v0.1.62/latest.yml
find /var/www/tech-cc-hub/release/v0.1.62 -type d -exec chmod 755 {} \;
find /var/www/tech-cc-hub/release/v0.1.62 -type f -exec chmod 644 {} \;
```

各平台要求：

| 客户端 | Metadata | 必须上传 |
| --- | --- | --- |
| Windows x64 | `latest.yml` | metadata 中 `path` 指向的 `.exe` 及同名 `.blockmap` |
| macOS Apple Silicon | `latest-mac.yml` | metadata 中 `path` 指向的 arm64 `.zip` 及同名 `.blockmap`；同时保留 DMG 供手动安装 |
| macOS Intel | `latest-x64-mac.yml` | metadata 中 `path` 指向的 x64 `.zip` 及同名 `.blockmap`；同时保留 DMG 供手动安装 |

Windows 安装包需要在 Windows 上构建；macOS 安装包需要在对应 Mac 架构上构建和签名。三个 metadata 文件可以放在同一个版本目录，客户端只读取与自身平台和架构匹配的文件。

本地构建入口：

```bash
# Windows x64 机器
npm run release:internal:win-x64

# Apple Silicon Mac 机器
npm run release:internal:mac-arm64

# Intel Mac 机器
npm run release:internal:mac-x64
```

三个命令都会在各自机器上生成：

```text
dist/internal-release/vX.Y.Z/
```

Windows 目录中包含 `latest.yml`、metadata 指向的 `.exe` 和 `.blockmap`；Apple Silicon Mac 目录中包含 `latest-mac.yml`、arm64 ZIP、blockmap 和 DMG；Intel Mac 目录中包含 `latest-x64-mac.yml`、x64 ZIP、blockmap 和 DMG。整理脚本会自动给未包含架构标记的 Intel Mac 文件名补上 `x64`，并同步更新 metadata，避免与 arm64 文件冲突。

分别构建完成后，将各台机器 `dist/internal-release/vX.Y.Z/` 目录内的文件平铺合并上传到服务器同一个 `vX.Y.Z/` 目录。不要上传 `dist` 中的 unpacked、debug 或 builder 配置文件，不要在服务器上再按平台建立子目录，也不要让不同平台使用不同版本号或不同 Git 提交。

Nginx 必须允许 `/release/` 显示目录列表。当前 `/release/` 中的 Hello World `index.html` 会遮住 `autoindex`，先将它改名：

```bash
cd /var/www/tech-cc-hub/release
test ! -f index.html || mv index.html index.html.disabled
nginx -t && systemctl reload nginx
```

上传后同时验证目录列表和当前版本 metadata：

```bash
curl http://127.0.0.1/tech-cc-hub/release/
curl -I http://127.0.0.1/tech-cc-hub/release/v0.1.62/latest.yml
curl -I http://172.18.56.18/tech-cc-hub/release/v0.1.62/latest.yml
```

第一条输出中应能看到 `href="v0.1.62/"`。客户端会从目录列表中提取 `vX.Y.Z/`，按语义版本从高到低检查，跳过缺少当前平台 metadata 的目录。无需维护 `latest` 软链接。

客户端默认使用以下策略变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `TECH_CC_HUB_UPDATE_MODE` | `internal-first` | 可设为 `internal-only` 或 `github-only` |
| `TECH_CC_HUB_INTERNAL_UPDATE_URL` | `http://172.18.56.18/tech-cc-hub/release/` | 可指向自动发现根目录或精确的 `vX.Y.Z/` |
| `TECH_CC_HUB_INTERNAL_UPDATE_PROBE_TIMEOUT_MS` | `3000` | 内网元数据探测超时，限制为 500–15000 ms |

内网镜像稳定后，将运行环境中的 `TECH_CC_HUB_UPDATE_MODE` 设为 `internal-only`，即可停止 GitHub 回退；遇到内网发布故障时可临时设为 `github-only`。

默认根目录暂时无法列目录时，客户端会退到 `http://172.18.56.18/tech-cc-hub/release/v0.1.62/`；该入口只用于当前迁移，后续版本发现依赖上面的 `autoindex`。

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

## GitHub Actions 与内网产物检查

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

同步到内网后，还必须确认版本目录下能访问同一组 metadata 和安装产物，并且 `/release/` 的 `autoindex` 对客户端可见。

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
- 当前内网地址使用 HTTP，应只允许可信内网访问；后续应迁移到 HTTPS 并保持安装包签名校验。

## 回滚策略

如果 Release 有问题：

1. 将问题版本目录改名为不符合 `vX.Y.Z` 的名称，使客户端恢复选择上一个已验证目录。
2. 在 GitHub Release 页面标记问题版本说明。
3. 修复后发布更高版本号。
4. 不建议删除并重发同一个 tag，客户端和缓存可能已经看到旧 metadata。


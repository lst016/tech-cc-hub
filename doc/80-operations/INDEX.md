---
doc_id: "DOC-INDEX-OPERATIONS"
title: "80-Operations 运维与使用手册索引"
doc_type: "index"
layer: "L8"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "contributors"
  - "electron"
source_of_truth: true
tags:
  - "tech-cc-hub"
  - "index"
  - "operations"
  - "runbook"
---

# 80-Operations / 运维与使用手册索引

本层提供日常运维、构建、打包、发布、自动更新的可执行操作手册。

## 本地开发

- 项目启动与常见问题见 [CLAUDE.md](../../CLAUDE.md) 和 [AGENTS.md](../../AGENTS.md)
- 核心命令摘要：

  ```bash
  npm run dev          # 启动 Electron 客户端
  npm run dev:react    # 仅启动前端调试服务
  npm run build        # 构建 React
  npm run transpile:electron  # 编译 Electron
  ```

## 构建与打包

| 命令 | 说明 |
|------|------|
| `npm run dist:win` | Windows 分发包 |
| `npm run dist:mac-arm64` | macOS ARM (Apple Silicon) |
| `npm run dist:mac-x64` | macOS Intel |
| `npm run dist:linux` | Linux 分发包 |

配置文件：`electron-builder.json`

## GitHub Releases 自动更新

- 实现：[src/electron/libs/auto-updater.ts](../../src/electron/libs/auto-updater.ts)
- 发布脚本：[scripts/github-release.mjs](../../scripts/github-release.mjs)
- CI Workflow：[.github/workflows/release.yml](../../.github/workflows/release.yml)
- 详细流程：[github-release-autoupdate-runbook.md](github-release-autoupdate-runbook.md)

## 操作手册

| 文档 | 说明 |
|------|------|
| [Electron 客户端操作与 QA 规范](electron-client-qa-runbook.md) | 启动、截图、窗口管理、调试入口 |
| [开发流操作沉淀规范](development-flow-standards.md) | 开发操作流程与沉淀标准 |
| [GitHub Releases 自动更新发布流程](github-release-autoupdate-runbook.md) | 发版、签名、自动更新完整流程 |

## QA 命令

```bash
npm run qa:window:list      # 列出窗口
npm run qa:window:capture   # 窗口截图
npm run qa:smoke             # 最小 smoke 测试
npm run qa:continue          # 续聊回归测试
npm run qa:slash             # slash 命令回归测试
```

详见 `scripts/qa/` 目录。

## 依赖清理

```bash
rm -rf node_modules package-lock.json
npm install
npm run rebuild   # Electron 原生模块重建
```

## 关联目录

| 目录 | 说明 |
|------|------|
| `doc/50-quality/` | QA 计划与验收核对表 |
| `doc/20-contracts/` | 配置模型与契约 |
| `doc/90-archive/iterations/` | 已完成迭代归档 |

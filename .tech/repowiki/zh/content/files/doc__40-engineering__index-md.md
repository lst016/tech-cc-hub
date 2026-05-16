# doc/40-engineering/INDEX.md

> 模块：`doc` · 语言：`markdown` · 行数：73

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "DOC-INDEX-ENGINEERING"
title: "40-Engineering 实现方案索引"
doc_type: "index"
layer: "L4"
status: "active"
version: "1.1.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
tags:
  - "tech-cc-hub"
  - "index"
  - "engineering"
---

# 40-Engineering / 实现方案索引

## Start Here

代码入口：`src/ui/` (React 渲染进程)、`src/electron/` (Electron 主进程)。

项目运行时规范见 [CLAUDE.md](../../CLAUDE.md) 和 [AGENTS.md](../../AGENTS.md)。

## 活跃模块

### Chat / Composer

- [Spec](chat-composer/spec.md)
- 组件：`src/ui/components/PromptInput.tsx`、`src/ui/components/DecisionPanel.tsx`
- 消息流：`src/ui/render/markdown.tsx`

### Preview / Browser Workbench

- [Spec](preview-workbench/spec.md)
- 组件：`src/ui/components/PreviewPanel.tsx`、`src/ui/components/AionWorkspacePreviewPane.tsx`
- BrowserView 集成：`src/electron/main.ts`、`src/electron/browser-manager.ts`
- 相关调研：`doc/00-research/AionUi-调研报告/`

### Activity Rail / Trace Analysis

- [Spec](activity-rail/spec.md)
- 组件：`src/ui/components/ActivityRail.tsx`、`src/ui/components/EventCard.tsx`
- 数据模型：`src/shared/activity-rail-model.ts`

### Settings / Skills

- [Spec](settings-skills/spec.md)
- 组件：`src/ui/components/settings/` 目录
- 配置持久化：`src/electron/libs/config-store.ts`、`src/electron/libs/claude-settings.ts`
- Skill Hub：`src/electron/libs/skill-hub.ts`、`src/electron/libs/skill-registry-sync.ts`

### Electron Main / IPC

- [Spec](electron-ipc/spec.md)
- 主入口：`src/electron/main.ts`
- IPC Handlers：`src/electron/ipc-handlers.ts`
- Runner：`src/electron/libs/runner.ts`
- BrowserView：`src/electron/browser-manager.ts`
- 自动更新：`src/electron/libs/auto-updater.ts`

## 关联目录

| 目录 | 说明 |
|------|------|
| `doc/20-contracts/` | IPC 接口、事件模型、状态机 |
| `doc/50-quality/` | 前端/Electron QA 与验收 |
| `doc/80-operations/` | 构建、打包、发布操作手册 |

```

# doc/40-engineering/electron-ipc/spec.md

> 模块：`doc` · 语言：`markdown` · 行数：241

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "DOC-SPEC-ELECTRON-IPC"
title: "Electron Main / IPC 模块 Spec"
doc_type: "spec"
layer: "L4"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "electron"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "engineering"
  - "electron"
  - "ipc"
  - "spec"
---

# Electron Main / IPC 模块 Spec

## Purpose

定义 Electron 主进程架构、IPC 通信通道、BrowserWindow 生命周期和原生能力集成。主进程是会话执行、配置管理和系统集成的唯一控制面。

## Scope

- Electron 主入口：窗口管理、菜单、globalShortcut
- IPC 通信：ClientEvent/ServerEvent 双工通道
- Session runner：Agent SDK 调用编排
- 原生集成：BrowserView、文件对话框、自动更新
- 不在本文档范围：前端组件实现（Chat/Composer、Activity Rail）、数据库 schema 细节（见 20-contracts）

## Active Entry Points

| 入口 | 文件 | 行数 |
|------|------|------|
| Electron 主入口 | `src/electron/main.ts` | ~1200 |
| IPC Handlers | `src/electron/ipc-handlers.ts` | ~800 |
| Session Runner | `src/electron/libs/runner.ts` | ~900 |
| Preload Bridge | `src/electron/preload.cts` | ~200 |
| 类型定义 | `src/electron/types.ts` | ~300 |
| Browser Manager | `src/electron/browser-manager.ts` | ~1400 |
| Auto Updater | `src/electron/libs/auto-updater.ts` | — |

## Architecture

### 进程模型

```
┌────────────────────────────────────────┐
│  Main Process (Node.js)                │
│  ├── main.ts        → 窗口/菜单/生命周期│
│  ├── ipc-handlers.ts → ClientEvent 路由 │
│  ├── runner.ts      → Agent SDK 编排    │
│  ├── browser-manager.ts → BrowserView   │
│  └── libs/          → config/skills/... │
├────────────────────────────────────────┤
│  Renderer Process (Chromium)           │
│  ├── React App                          │
│  ├── window.electron.sendEvent()       │
│  └── window.electron.invoke()          │
├────────────────────────────────────────┤
│  Preload Bridge (preload.cts)          │
│  └── contextBridge.exposeInMainWorld() │
└────────────────────────────────────────┘
```

### 主入口 main.ts 职责

| 职责 | 实现 |
|------|------|
| BrowserWindow 创建与生命周期 | `createMainWindow()` — 单窗口模式，DevTools 在 dev 时开 |
| IPC 注册 | `handleClientEvent`、`ipcMainHandle` 各 channel |
| 菜单 | 平台适配菜单（macOS app menu / Windows 窗口菜单） |
| globalShortcut | Debug 快捷键注册 |
| BrowserView 启动 | `BrowserWorkbenchManager` — 右侧浏览器工作台 |
| Session 清理 | `app.on("before-quit")` → `cleanupAllSessions()` |
| 自动更新 | `appAutoUpdater` 初始化与状态广播 |

### ipc-handlers.ts 路由表

所有 ClientEvent 通过 `handleClientEvent` 路由到对应处理器：

```
ClientEvent                → 处理函数
─────────────────────────────────────────
session.start              → startNewSession()
session.continue           → continueSession()
session.stop               → abortSession()
session.append             → appendToSession()
permission.response        → resolvePermissionRequest()
file.dialog.open           → dialog.showOpenDialog()
file.dialog.openDirectory  → dialog.showOpenDialog()
file.read                  → fs.readFileSync()
file.write                 → fs.writeFileSync()
file.list                  → fs.readdirSync()
skill.import               → importSkill()
skill.delete               → deleteSkill()
skill.sync                  → syncSkillSources()
settings.save              → saveConfig()
agent-rule.save             → saveUserAgentRuleDocument()
browser.open               → openBrowserPage()
browser.close              → closeBrowserPage()
system.maintenance.*        → maintenance handlers
```

### runner.ts Agent 编排

Session 执行管线：

```
prompt + attachments + runtime overrides
  → buildAnthropicPromptContentBlocks()
    → resolveAgentRuntimeContext()     — agent rules + context
      → buildEnvForConfig()            — API env var 注入
        → query({ prompt, options })   — Claude Agent SDK
          → stream.message → onEvent → broadcast()
```

RunnerHandle 抽象：

```typescript
type RunnerHandle = {
  abort: () => void;
};
```

每个 session 一个 RunnerHandle，存储在 `runnerHandles: Map<string, RunnerHandle>`。

### Browser Manager

BrowserWorkbenchManager 管理 BrowserView 实例：

- 单 BrowserView 复用（全局 session）
- URL 导航、前进/后退、重载
- DOM 查询/提取/注入（MCP browser tools 的后端）
- 标注模式控制
- 截图与设计对比

## IPC 通信

### 渲染 → 主进程 (ClientEvent)

```typescript
// 渲染进程
window.electron.sendEvent({ type: "session.start", payload: {...} });

// 主进程接收
ipcMain.on("client-event", (_event, data) =>
... (truncated)
```

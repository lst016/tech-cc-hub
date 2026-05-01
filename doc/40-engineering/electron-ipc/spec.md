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
ipcMain.on("client-event", (_event, data) => {
  handleClientEvent(data as ClientEvent);
});
```

### 主 → 渲染进程 (ServerEvent)

```typescript
// 主进程广播
broadcast(event: ServerEvent) {
  BrowserWindow.getAllWindows().forEach(win =>
    win.webContents.send("server-event", JSON.stringify(event))
  );
}

// 渲染进程接收
window.electron.onServerEvent((event) => { ... });
```

### invoke 模式 (请求-响应)

```typescript
// 渲染进程
const result = await window.electron.invoke("file.read", { path: "..." });

// 主进程
ipcMainHandle("file.read", async (_event, args) => { ... });
```

## Key Files

```
src/electron/
├── main.ts                      # 主入口：窗口、菜单、生命周期
├── ipc-handlers.ts              # ClientEvent 路由与业务处理
├── types.ts                     # 全量 IPC 类型定义
├── preload.cts                  # contextBridge 暴露 API
├── browser-manager.ts           # BrowserView 管理器
├── util.ts                      # 工具函数 & isDev
├── pathResolver.ts              # Vite 构建路径解析
├── stateless-continuation.ts    # 无状态续接 payload
├── dev-backend-bridge.ts        # Dev 后端桥接
└── libs/
    ├── runner.ts                # Agent SDK 编排
    ├── runner-error.ts          # Runner 错误标准化
    ├── session-store.ts         # SQLite 会话持久化
    ├── claude-settings.ts       # Claude CLI 配置桥接
    ├── config-store.ts          # JSON 配置持久化
    ├── skill-registry-sync.ts   # Skill git sync
    ├── skill-hub.ts             # Skill 管理
    ├── agent-rule-docs.ts       # Agent 规则文档
    ├── auto-updater.ts          # Electron autoUpdater
    ├── attachment-store.ts      # 附件持久化
    ├── image-preprocessor.ts    # 图片预处理
    ├── tool-output-sanitizer.ts # Tool 输出脱敏
    ├── slash-command-catalog.ts # Slash 命令目录
    ├── workflow-catalog.ts      # Workflow 目录
    ├── system-workspace.ts      # 系统工作区
    ├── cron-service.ts          # Cron 调度服务
    ├── webserver.ts             # 内置 Web 服务
    ├── agent-resolver.ts        # Agent 上下文解析
    ├── claude-project-memory.ts # Claude 项目 Memory
    ├── browser-workbench-session.ts # Browser 会话管理
    ├── design-inspection-dsl.ts # 设计检查 DSL
    ├── design-image-path.ts     # 设计图片路径解析
    └── mcp-tools/
        ├── admin.ts             # Admin MCP 工具
        ├── browser.ts           # Browser MCP 工具
        └── design.ts            # Design MCP 工具
```

## Compatibility

- 新增 ClientEvent type：在 `types.ts` 扩展联合类型 + `ipc-handlers.ts` 添加路由分支
- 新增 IPC channel：在 `preload.cts` contextBridge 暴露 + `main.ts` 注册 handler
- 新增 MCP tool server：在 `libs/mcp-tools/` 下实现 + `runner.ts` 注册
- Runner 选项扩展：在 `RunnerOptions` 类型添加字段 + runner.ts 消费

## Acceptance Criteria

- [ ] `npm run dev` Electron 窗口正常启动
- [ ] ClientEvent → ServerEvent 双工通信完好
- [ ] session.start / stop / continue / append 全部路径可用
- [ ] BrowserView 导航/查询/截图正常
- [ ] 自动更新检查不阻塞启动
- [ ] app quit 时 runner handles 全部 abort
- [ ] DevTools 仅在 dev 模式下可用

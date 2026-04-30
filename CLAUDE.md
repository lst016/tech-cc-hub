# tech-cc-hub 项目开发指南

## 项目概述

`tech-cc-hub` 是一个基于 `Electron + React + Claude Agent SDK` 的桌面端 Agent 协作客户端。

**核心设计原则：**
- `chat-first` - 主界面优先是正常聊天，不要求手工建 task
- `workspace-first sidebar` - 左侧按工作区组织会话，设置固定在底部
- `execution observability` - 右侧默认展示执行指标
- `Electron-first QA` - 验收以 Electron 真窗口为准
- `中文 UI` - 界面文案默认使用简体中文

## 技术栈

| 组件 | 版本/技术 |
|------|----------|
| 运行时 | Electron 39 |
| 前端框架 | React 19 |
| 语言 | TypeScript 5.9 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand |
| 数据库 | better-sqlite3 |
| Agent SDK | @anthropic-ai/claude-agent-sdk |
| 构建工具 | Vite 7 |
| 包管理器 | npm ( bun.lock 存在但项目使用 npm) |

## 目录结构

```
tech-cc-hub/
├── doc/                  # 产品、架构、PRD、开发规范文档
├── scripts/qa/           # Electron 窗口级 QA 脚本
├── src/
│   ├── electron/         # 主进程、IPC、运行时、会话存储
│   │   ├── main.ts       # Electron 主入口
│   │   ├── ipc-handlers.ts
│   │   ├── libs/         # 配置、会话存储等工具
│   │   └── types.ts
│   └── ui/               # React 客户端
│       ├── components/   # UI 组件
│       ├── hooks/        # 自定义 hooks
│       ├── store/        # Zustand store
│       └── render/       # Markdown 渲染
├── patches/              # SDK 补丁
├── dist-electron/        # Electron 编译产物
├── dist-react/           # 前端构建产物
└── package.json
```

## 开发命令

## 启动口径

- 在这个项目里，“本地启动”“启动项目”“把项目跑起来”默认都指启动 `Electron` 客户端，不是只启动网页端。
- 默认执行命令是 `npm run dev`，它会同时拉起 `Vite + Electron`，最终验收对象是桌面客户端窗口。
- `npm run dev:react` 只是单独启动前端调试服务，不能视为“项目已经启动完成”。
- 只有用户明确说“只起前端页面”“只起网页端”“只跑 React”时，才使用 `npm run dev:react`。

### 基础命令

```bash
# 安装依赖
npm install

# 本地启动默认指客户端启动 (同时启动 Vite 和 Electron)
npm run dev

# 仅在明确要求只起网页端时使用
npm run dev:react

# 单独启动 Electron
npm run dev:electron

# 构建
npm run build              # 构建 React
npm run transpile:electron # 编译 Electron

# 打包分发
npm run dist:win           # Windows
npm run dist:mac-arm64     # macOS ARM
npm run dist:mac-x64       # macOS Intel
npm run dist:linux         # Linux
```

### QA 命令

```bash
npm run qa:window:list     # 列出窗口
npm run qa:window:capture  # 窗口截图
npm run qa:smoke           # 最小 smoke 测试
npm run qa:continue        # 续聊回归测试
npm run qa:slash           # slash 命令回归测试
```

## 编码规范

### TypeScript

- 使用 ES Module (`"type": "module"`)
- 严格模式，完整类型注解
- 优先使用 `const`，避免 `var`
- 函数使用箭头函数或简洁声明

### React

- React 19 函数组件 + Hooks
- 状态管理使用 Zustand
- 组件文件使用 `.tsx` 扩展名
- 事件处理函数使用 `handle` 前缀

### 样式

- Tailwind CSS v4 原子类
- 自定义 CSS 放在 `App.css` / `index.css`
- 颜色使用语义化命名 (`ink-`, `accent-`, `muted`)

### 文件命名

- kebab-case: 组件文件 (`PromptInput.tsx`)
- camelCase: 工具函数 (`util.ts`)
- PascalCase: 类型定义 (`types.ts`)

## IPC 通信

Electron 主进程与渲染进程通过 IPC 通信：

```typescript
// 渲染进程 -> 主进程
window.electron.sendEvent({ type: "session.start", payload: {...} })

// 主进程 -> 渲染进程
ipcMain.on("client-event", handler)
```

## 会话管理

会话状态存储在 `better-sqlite3` 数据库中，关键实体：

- `Session` - 会话元数据 (标题、状态、工作目录)
- `Message` - 消息记录 (用户输入、AI 响应)
- `Event` - 执行事件 (Token、时长、TTFT)

## 调试技巧

1. **Electron 主进程调试**: 在 `main.ts` 添加 `console.log`，输出到终端
2. **渲染进程调试**: 使用 Chrome DevTools (Ctrl+Shift+I)
3. **IPC 日志**: 在 `ipc-handlers.ts` 添加日志
4. **数据库检查**: 直接查询 SQLite 数据库文件

## 常见问题

### Vite 端口冲突
```bash
# Windows
for /f "tokens=5" %a in ('netstat -ano ^| findstr :5173') do taskkill /PID %a /F
```

### Electron 重建
```bash
npm run rebuild
```

### 依赖清理
```bash
rm -rf node_modules package-lock.json
npm install
```

## Windows 环境工具约束

- **禁止使用 `mcp__windows__Powershell-Tool`** 进行 git 操作或文件读写。该 MCP 工具在本项目 Windows 环境下已知不稳定，会导致调用超时和重复诊断损耗。
- **Git 操作统一用 Bash（Git Bash）**。如果 Bash 不可用，回退到内置 `PowerShell` 工具，不走任何 MCP 封装。
- **工具调用超时处理**：如果用户反馈"卡死"，立即终止当前工具链，不要等待超时。

## 工具调用纪律

- 已知多个文件路径时，**并发 Read**，禁止串行逐个读取。
- 目标文件不明确时，先用 **Grep/Glob 收敛范围**，再并发读取命中文件。
- **禁止 ls → cat → grep 碎片链路**。一次 Grep 能得出结论的，不拆成多次 Bash。
- 只读操作可以批量并发；写入/删除/安装等副作用操作不混入批量调用。

## 任务执行纪律

### 模糊任务探查-计划-确认

当用户指令模糊（如"读下最近的任务安排完成剩余部分"、"把剩下的做完"）时，不允许直接开始跨文件编辑：

1. **探查** — 先读迭代计划/Memory/相关 doc 确认范围，列出待完成项清单，输出纯文本给用户确认。
2. **计划** — 用户确认范围后，按 Phase/Task 拆成"定位→修改→验证"三步，每步说明涉及的文件和验收标准。
3. **分相执行** — 每个 Phase 完成后中断，报告"Phase N 完成，构建/单测通过"，等用户说"继续"再进下一 Phase。
4. **禁止行为** — 禁止把多个 Phase 合并到一个轮次连续执行。禁止在用户未确认范围前编辑任何文件。

**Why:** 2026-04-30 诊断：第 1 轮 801s 跨 3 Phase 7 文件连续编辑，中间 0 次用户交互，导致上下文健康度 0/100。

### 单轮写入上限

- 单轮最多编辑 **3 个文件**。超过 3 个文件时必须中断，报告进度并等用户说"继续"。
- 跨 Phase 必须中断确认，不得连续推进。

**Why:** 本轮 23 次 Edit 串行写入 7 文件，工具输出占上下文 94.2%，后续轮次几乎无有效上下文可用。

### 上下文健康度自检

每轮开始前检查：
- 如果工具输出占 Prompt >80%，先输出 3-5 条事实摘要（目标、约束、涉及文件、验收标准），再进入执行。
- 如果历史+工具输出占 Prompt >90%，建议新开会话或显式要求用户确认继续。

**Why:** 本轮 Prompt 91,901 tok 中工具输出占 94.2%，当前输入仅占 0.8%，实际任务信号被淹没。

## 文档索引

- [产品文档](doc/40-product/1.0.0/00-版本总览.md)
- [架构文档](doc/10-architecture/10-系统上下文图.md)
- [开发规范](doc/40-product/1.0.0/40-delivery/52-前端工程最佳实践.md)

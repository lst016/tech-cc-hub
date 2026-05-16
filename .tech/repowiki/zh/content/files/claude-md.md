# CLAUDE.md

> 模块：`root` · 语言：`markdown` · 行数：278

## 文件职责

开发指南，定义项目法规、技术栈、目录约束、QA 命令和开发规范

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# tech-cc-hub 项目开发指南

## 项目概述

`tech-cc-hub` 是一个基于 `Electron + React + Claude Agent SDK` 的桌面端 Agent 协作客户端。

**核心设计原则：**
- `chat-first` - 主界面优先是正常聊天，不要求手工建 task
- `workspace-first sidebar` - 左侧按工作区组织会话，设置固定在底部
- `execution observability` - 右侧默认展示执行指标
- `Electron-first QA` - 验收以 Electron 真窗口为准
- `中文 UI` - 界面文案默认使用简体中文

## 项目法规：默认规则源与源码 CV

- 本项目默认规则源是根目录 `CLAUDE.md`；不要新增、启用或依赖 `AGENTS.md` 作为项目默认规则，除非用户明确要求。
- 用户已经标注、截图或指定上游来源的功能，默认必须直接从对应上游源码全量 CV 逻辑与 UI 结构，再做本项目适配。
- 禁止在没有用户明确许可的情况下，用“参考效果后自行复写”的方式替代上游源码；这种复写会引入行为差异和隐藏 bug。
- 适配层只允许处理本项目必要差异，例如路径、IPC、配置读写、类型桥接、样式 token 对齐和构建兼容。
- 上游已有但本轮没有完成接入的能力，不允许在 UI 中写“预留”“后续支持”“即将上线”等伪完成文案；未接入就隐藏。
- 如果上游源码暂时找不到、无法编译或许可证/依赖有阻塞，必须先说明阻塞并等待确认，不能擅自手写替代实现。
- CV 代码后必须保留来源说明，便于后续追踪上游差异和继续同步。
- 软件内置默认规则已合并 Karpathy coding guardrails，来源：https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md。
- 默认执行策略：编码前澄清假设和歧义，优先最小实现，只做外科手术式必要修改，并为多步骤任务定义可验证成功标准。

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

## 前端目录约束

- 运行时前端代码统一放在 `src/ui/`；不要新增或恢复 `src/renderer/` 作为第二套前端目录。
- 从 AionUi 或其他上游 CV 的前端模块，只有完成适配后才能作为 `src/ui/` 下的正式模块进入源码树；不要保留未接入运行时的全量拷贝目录。
- 前端跨模块引用优先使用 `@/ui/...` 或同目录相对路径，不再新增 `@renderer/*` alias。

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
- 做任何 UI / 视觉 / 色彩相关改动前必须先读根目录 `DESIGN.md`
- 主产品 UI 使用 `DESIGN.md` 定义的暖灰 + clay accent 色系；不要新增随机蓝色、紫色或 raw hex
- 代码预览、文件树、Monaco 这类 workbench 区域可以使用 `DESIGN.md` 的 VS Code light 工作台色，但必须局部作用域隔离

### Git 提交规范

- **默认使用中文** — 提交信息、PR 标题和描述默认使用简体中文撰写。
- **示例** — `feat: 文件预览面板支持多Tab与编辑器可编辑` 而非 `feat: add multi-tab support to file preview panel`
- 分类前缀可用英文（feat/fix/chore/docs/refactor），但描述必须用中文。

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
3. **IPC
... (truncated)
```

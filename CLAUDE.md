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

### 基础命令

```bash
# 安装依赖
npm install

# 启动开发环境 (同时启动 Vite 和 Electron)
npm run dev

# 单独启动 React 前端
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

## 文档索引

- [产品文档](doc/40-product/1.0.0/00-版本总览.md)
- [架构文档](doc/10-architecture/10-系统上下文图.md)
- [开发规范](doc/40-product/1.0.0/40-delivery/52-前端工程最佳实践.md)

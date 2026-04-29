# tech-cc-hub 项目开发指南

## 项目概述

`tech-cc-hub` 是一个基于 `Electron + React + Codex Agent SDK` 的桌面端 Agent 协作客户端。

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
| Agent SDK | @anthropic-ai/Codex-agent-sdk |
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

## 文档索引

- [产品文档](doc/40-product/1.0.0/00-版本总览.md)
- [架构文档](doc/10-architecture/10-系统上下文图.md)
- [开发规范](doc/40-product/1.0.0/40-delivery/52-前端工程最佳实践.md)

## 当前接力上下文（2026-04-20）

这个区块用于在新窗口里快速接手当前工作，优先看这里再开始改代码。

### 当前主线

- 近期重点在做右侧“执行轨迹 / Agent 执行分析”体验，不是普通聊天区。
- 目标是把右侧栏做成可复盘的 agent workbench：看任务级步骤、原子节点、指标、上下文分布、节点详情。
- 用户对“默认卡片太大、信息不聚焦、详情展示不合理”非常敏感，偏好高密度、可分析、中文 UI。

### 已完成的右栏改造

- 节点详情不再贴在底部，而是点节点后在右侧拉出二级详情抽屉。
- 增加了任务级步骤视图，会从 AI 回复里的 `1/2/3/4 step` 之类计划抽任务步骤。
- 增加了“上下文分布”弹窗，用来看 `用户提示 / AI 计划 / 工具输入 / 工具输出 / 最终结果 / 附件` 的占比。
- 指标展示改成单行表格，字段为：`输入 | 上下文 | 输出 | 耗时 | 成败`。
- 工具节点详情已从“直接糊 JSON”改成“工具输入 / 工具输出”结构化展示，优先显示摘要和字段表，再按需展开原始内容。

### 最近主要修改文件

- `src/ui/components/ActivityRail.tsx`
- `src/shared/activity-rail-model.ts`
- `src/electron/activity-rail-model.test.ts`
- 与指标时间相关的配套改动还涉及：
  - `src/electron/libs/session-store.ts`
  - `src/electron/ipc-handlers.ts`
  - `src/electron/types.ts`
  - `src/ui/store/useAppStore.ts`

### 当前最新问题与判断

- 用户反馈：节点详情里“展开原始输入 / 展开原始返回”看起来像空白。
- 当前判断的根因是样式问题，不是数据没传到：
  - 详情原始内容区域之前用了 `bg-ink-950`
  - 项目主题里没有这个颜色类，导致背景没有生效
  - 同时文字使用了浅色，视觉上接近“白字贴白底 / 透明底”
- 已经把这块改成项目真实存在的深色背景 `bg-ink-900`，并补了边框与阴影，理论上应恢复可读性。

### 当前状态口径

- 模型层和结构化详情测试是通过的。
- `eslint` 和 `build` 是通过的。
- 但“原始输入 / 原始返回”这块样式修复后，仍建议在 Electron 真窗口里重新展开一次确认视觉结果，不要只信构建结果。
- 如果用户继续说“还是空的”，优先检查：
  - 当前窗口是否拿到热更新
  - `dist-react` 里的样式类是否已更新
  - 详情抽屉中原始内容区的实际 DOM class 与计算样式

### 最近验证命令

```bash
npm run transpile:electron
node --test dist-electron/electron/activity-rail-model.test.js
npx eslint src/ui/components/ActivityRail.tsx src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts
npm run build
```

### 新窗口接手建议

1. 先看 `src/ui/components/ActivityRail.tsx` 的详情抽屉和原始内容渲染。
2. 再看 `src/shared/activity-rail-model.ts` 里 `detailSections`、`metrics`、`contextChars` 的生成逻辑。
3. 启动真窗口后，重点人工验证：
   - 节点指标是否是一行表格
   - 详情是否在右侧抽屉，不在底部
   - `工具输入 / 工具输出` 是否有结构化内容
   - “展开原始输入 / 返回”是否真正可读
4. 若继续优化，优先方向是：
   - `Bash / Read / Edit` 做更人话的摘要
   - 工具输出支持更好的折叠与截断
   - 上下文分布与节点详情之间增加联动跳转

### 注意事项

- 当前 worktree 很脏，存在不少与本轮无关的修改和未跟踪文件，不要做清理式回滚。
- 这个项目以 Electron 真窗口验收为准，右栏视觉问题不要只靠单测判断。
- UI 文案默认继续保持简体中文。

## Claude 项目 Memory 默认规则

- 开发会话默认把当前工作区对应的 `~/.claude/projects/<project-slug>/memory/*.md` 作为项目级默认规则与经验参考加载。
- Windows 工作区 slug 与 Claude Code 保持一致，例如 `D:\workspace\kefu\boke-kefu-vue` 对应 `D--workspace-kefu-boke-kefu-vue`。
- 只加载 `memory` 目录下的 Markdown 文档；不要加载原始会话日志、图片、jsonl 或大体积文件进入主上下文。
- 加载 memory 时必须保留来源目录提示，并设置字符预算；memory 用于减少重复探索，不应用作重新读取全项目文档的理由。
- 如果 memory 与用户当前明确指令冲突，以当前用户指令为准。

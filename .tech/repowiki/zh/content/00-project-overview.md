# tech-cc-hub 项目总览

## 1. 项目定位

tech-cc-hub 是一个桌面端 Agent 工作台，基于 Electron + React + Claude Agent SDK 构建。它把会话、任务、浏览器、模型路由、执行轨迹和复盘诊断整合在同一个客户端里，目标用户是需要本地运行 AI 编码助手并进行治理的单人研发者。

## 2. 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Electron 39 |
| 前端框架 | React 19 |
| 语言 | TypeScript 5.9 |
| 样式 | Tailwind CSS v4 + Radix UI |
| 状态管理 | Zustand |
| 数据库 | better-sqlite3 |
| 向量检索 | sqlite-vec |
| Agent SDK | @anthropic-ai/claude-agent-sdk |
| 构建工具 | Vite 7 |
| 包管理器 | npm（存在 bun.lock 但项目使用 npm）|

## 3. 核心目录结构

```
tech-cc-hub/
├── src/
│   ├── electron/           # Electron 主进程
│   │   ├── main.ts         # 主入口
│   │   ├── ipc-handlers.ts # IPC 处理器
│   │   ├── types.ts        # 共享类型
│   │   └── libs/           # 工具库（mcp-tools、runner、task 等）
│   └── ui/                 # React 前端
│       ├── components/     # UI 组件
│       ├── hooks/          # 自定义 Hooks
│       ├── store/          # Zustand 状态
│       └── render/         # Markdown 渲染
├── scripts/                # 构建和 QA 脚本
│   ├── dev.mjs             # Electron 开发启动
│   ├── dev-electron.mjs    # Electron 进程启动
│   ├── github-release.mjs  # GitHub Release 脚本
│   └── qa/                 # 窗口级 QA 测试脚本
├── .claude/
│   ├── commands/           # Claude Code 命令（goal、gw-claude-log、gw-claude-sum）
│   ├── skills/             # 开发技能库
│   │   ├── tech-cc-hub-dev-flow/    # 开发流程守则
│   │   ├── annotation-ui-fix/       # 标注驱动 UI 修复
│   │   ├── mcp-server-creator/      # MCP Server 创建 SOP
│   │   └── github-release-updater/  # GitHub Release 更新
│   └── worktrees/          # 工作区（figma-official-mcp 等）
├── .github/workflows/      # CI/CD（build.yaml、release.yml）
├── dist-electron/          # Electron 编译产物
└── patches/                # SDK 补丁
```

## 4. 运行与构建入口

### 本地开发

```bash
# 完整启动（Electron + Vite，默认验收口径）
npm run dev

# 仅前端开发（无 Electron 窗口）
npm run dev:react

# Electron 单独调试
npm run transpile:electron
npm run dev:electron
```

### 构建

```bash
# 完整构建（TypeScript 编译 + Vite 构建）
npm run build

# Electron TypeScript 编译（不触发 Vite）
npm run transpile:electron

# 原生模块重建（better-sqlite3 异常时）
npm run rebuild
```

### 打包发布

```bash
# macOS
npm run package:mac        # zip 包
npm run release:mac-arm64  # 发布 arm64

# Windows
npm run package:win
npm run release:win-x64

# GitHub Release（自动触发 Actions 构建）
npm run release:github -- patch
```

### QA 测试

```bash
# Electron 烟雾测试
npm run qa:smoke
npm run qa:slash           # 发送 /debug
npm run qa:codex           # Codex 集成测试

# Chat UI 测试
npm run qa:chat-ui
npm run qa:preview

# 窗口工具
npm run qa:window:list
npm run qa:window:capture
```

## 5. 核心能力

| 能力 | 说明 |
|------|------|
| 会话与工作区 | 左侧按 workspace 管理会话；任务可绑定独立 workspace 执行 |
| 模型路由 | 主模型、专家模型、小模型、Prompt 分析模型、图片模型分层配置 |
| 内置浏览器 | BrowserView 支持截图、DOM 摘要、样式检查、标注 |
| 执行轨迹 | 实时统计、诊断时间线、Trace Viewer |
| 任务系统 | 同步飞书任务，本地 SQLite 持久化，支持重试、暂停、产物列表 |
| MCP 工具 | 内置浏览器、设计检查、配置写入等工具供 Agent 调用 |
| 设计检查 | 截图分析、两图对比、diff 图、热点区域、JSON report |

## 6. 后续实现切入点

### 6.1 MCP Server 创建
参考 `.claude/skills/mcp-server-creator/SKILL.md` 的三阶段 SOP：

1. **Phase 1** — 探查：`src/electron/libs/runner.ts` 中的 `ALWAYS_ALLOWED_TOOLS` 和 `mcpServers` 注册区
2. **Phase 2** — 创建工具文件：`src/electron/libs/mcp-tools/<name>.ts`，使用 `@anthropic-ai/claude-agent-sdk` 的 `createSdkMcpServer`
3. **Phase 3** — 注册：`src/electron/libs/runner.ts` 中注入，依赖注入通过 `set<Name>Service` 模式

### 6.2 UI 开发
- 参考 `.claude/skills/tech-cc-hub-dev-flow/SKILL.md`
- 视觉语言对齐 VS Code 白主题：白色背景、浅灰分割线、紧凑树结构、最少蓝色点缀
- **必须**在实际运行页面验证，不依赖源码修改自证完成

### 6.3 GitHub Release
- 参考 `.claude/skills/github-release-updater/SKILL.md`
- 必须 clean worktree、不能复用已有 tag
- Windows 构建走 GitHub Actions `windows-latest`

## 7. 开发守则

- **默认规则源**是项目根目录 `CLAUDE.md`，不是 `AGENTS.md`
- 从上游 CV 的代码必须保留来源说明，适配层只处理本项目必要差异
- UI 必须实际运行验证，不能从源码推断完成

# root

> Root module of tech-cc-hub: Electron desktop Agent workbench with multi-model routing, task orchestration, and built-in browser

tech-cc-hub 是基于 Electron + React + Claude Agent SDK 的桌面端 Agent 协作客户端。根目录包含项目配置、构建脚本、多模型路由配置、代码规范、设计系统和类型定义。核心入口为 index.html 加载 src/ui/main.tsx，Electron 主进程入口在 src/electron/main.ts。

## 文件

### `package.json`

项目元数据、依赖声明、npm 脚本集合。定义版本 0.1.18，main 入口指向 dist-electron/electron/main.js。

- `scripts` (object) - dev/dev:electron/dev:react 构建命令；qa:* 端到端测试脚本；dist:* 打包分发；release:* 发布到 GitHub
- `rebuild` (script) - 重建 better-sqlite3 原生模块，用于 Electron native dependency 修复
- `main` (field) - Electron 主进程产物路径 dist-electron/electron/main.js

### `tsconfig.json`

根级 TypeScript 配置，通过 references 引用 tsconfig.app.json 和 tsconfig.node.json，实现前后端类型编译分离。

### `tsconfig.app.json`

前端(React) TypeScript 配置。target ES2020，jsx react-jsx，paths alias @/* -> ./src/*，include src/ui、src/shared、types.d.ts、types 目录。

- `paths['@/*']` (config) - src/* 路径别名，用于 src/ui 内部跨模块引用
- `noUncheckedSideEffectImports` (flag) - 禁止未检查副作用导入，提升类型安全性

### `tsconfig.node.json`

Node 端(TypeScript/Vite) 配置，用于 vite.config.ts 等构建脚本的编译。

### `vite.config.ts`

Vite 构建配置，包含 tech-cc-hub-preview-fs 插件提供文件预览服务(列表/文本预览/图片预览)，以及 MIME 类型映射和路径安全校验。

- `previewFsPlugin` (function) - 自定义 Vite 中间件插件，提供 /__tech_preview/list、/__tech_preview/text、/__tech_preview/image 三个端点用于 IDE 风格文件预览
- `isPathWithinRoot` (function) - 安全校验：确保请求路径在 cwd 根目录内，防止目录遍历攻击
- `ignoredPreviewDirectories` (set) - 预览时忽略 node_modules/.git/dist-react 等目录

### `index.html`

应用 HTML 入口，设置 CSP 安全策略(限制 self + data: blob:)，加载 /src/ui/main.tsx 入口脚本，显示 app-icon.png 图标。

### `electron-builder.json`

Electron 打包配置。appId 为 com.devagentforge.techcchub，files 包含 dist-electron、dist-react、claude-agent-sdk 依赖，asarUnpack 展开 SDK，afterPack 运行 win 图标脚本。

- `asarUnpack` (array) - Claude Agent SDK 需要 unpack 以支持动态 require
- `publish` (array) - GitHub auto-update 发布配置

### `eslint.config.js`

ESLint 配置，extends js.recommended + typescript-eslint recommended，plugins: react-hooks/react-refresh，ignores dist 目录。

### `types.d.ts`

全局类型声明文件。定义 Statistics/StaticData/ApiConfig/BrowserWorkbenchState/BrowserWorkbenchAnnotation/BrowserWorkbenchEvent 等核心类型，为 IPC 通信和全栈共享提供类型安全。

- `ApiConfig` (interface) - AI 接口配置，含 id/name/apiKey/baseURL 主模型字段，以及 expertModel/imageModel/smallModel/analysisModel 多模型槽位
- `ApiProviderMode` (type) - 提供商模式: custom/deepseek/codex
- `BrowserWorkbenchEvent` (union) - 浏览器工作台事件联合类型: browser.state/browser.console/browser.annotation
- `BrowserWorkbenchAnnotation` (interface) - 标注数据，含 id/point/domHint/comment/expectation
- `BrowserWorkbenchDomHint` (interface) - DOM 定位提示，含 tagName/selector/xpath/componentStack/sourceCandidates

### `agent-runtime.json`

Agent 运行时系统提示扩展配置。定义工具调用预算与并行规则、附件处理策略、标注驱动 UI 修改 SOP，是 Agent 执行时的默认行为准则。

- `systemPromptExt` (array) - 系统提示扩展片段，包含工具调用规则、附件处理、UI 修改 SOP

### `CLAUDE.md`

项目开发指南。定义 tech-cc-hub 为 Electron+React+Claude Agent SDK 的桌面客户端，核心原则：chat-first/workspace-first/execution observability。规定源码 CV 规则和默认规则源。

- `技术栈表` (table) - Electron 39/React 19/TypeScript 5.9/Tailwind v4/Zustand/better-sqlite3/Vite 7
- `目录结构约束` (rule) - 前端代码统一在 src/ui/，禁止新建 src/renderer/；跨模块引用用 @/ui/... alias

### `DESIGN.md`

设计系统文档。定义 warm utilitarian workbench 美学方向，Product Layer 颜色系统(accent #D26A3D，bg-100 #F8F9FB，ink-900 #16181D)，Workbench Layer 限定在代码预览区域使用 VS Code light 语义。

- `Product Layer Tokens` (table) - bg-100/surface/ink-900/accent 等核心设计 token
- `Accent color` (token) - primary action/selected state: #D26A3D, hover: #BE5D34, subtle: #F9EEE9

### `.gitignore`

Git 忽略规则。忽略 node_modules/dist/dist-react/dist-electron/.env/.context/.worktrees/ 等运行时和临时文件。

### `.mcp.json`

Model Context Protocol 服务器配置。定义 chrome-devtools 和 darbot-windows-mcp 两个 MCP server。

### `.qoderignore`

代码索引忽略配置，与 .gitignore 规则一致，用于 codex 等工具的索引过滤。

### `README.md`

产品文档。介绍五大核心能力：会话与工作区/模型路由/内置浏览器/执行轨迹/任务系统。包含飞书任务同步原理流程图和快速启动指南。

- `核心能力表` (table) - 会话工作区/模型路由/内置浏览器/执行轨迹/任务系统/MCP/设计检查
- `MODEL SLOTS` (concept) - 五类模型槽位: 默认主模型/专家模型/小模型/后端模型/Prompt分析模型/图片预处理模型

## 关键概念

- **Multi-model Routing**：5 类模型槽位架构：主模型(普通聊天)/专家模型(复杂兜底)/小模型/后台模型(轻量后台调用)/Prompt分析模型/图片预处理模型。ApiConfig 接口定义这些槽位，支持 provider 切换。
- **Workspace-first Sidebar**：左侧按工作区组织会话(session)，任务执行可绑定独立 workspace 避免污染当前聊天上下文。每个 workspace 维护自己的会话历史和执行记录。
- **Execution Observability**：聊天右侧展示实时统计、诊断和时间线；完整链路可进入 Trace Viewer。BrowserWorkbenchState/BrowserWorkbenchConsoleLog 等类型支撑执行轨迹的 IPC 事件流。
- **Browser Workbench**：内置 BrowserView 支持页面打开/截图/DOM摘要/样式检查/标注模式。BrowserWorkbenchAnnotation 支持点标注、DOM定位提示(componentStack/sourceCandidates)、标注回写。
- **Task Orchestration**：飞书任务同步到本地 SQLite 队列，Executor 调度执行，可绑定独立 workspace 和覆盖模型配置。App 重启后恢复状态并对卡住任务做重试判定。
- **Agent Runtime Config**：agent-runtime.json 定义系统提示扩展，包含工具调用预算规则(并行/批量/最小化读取)、附件处理策略(design_inspect_image)、标注驱动 UI 修改 SOP。
- **Vite Preview FS Plugin**：自定义 Vite 中间件提供 /__tech_preview/* 端点，支持目录列表/文本预览/图片预览，带路径安全校验(不能访问 cwd 外)和大小限制(maxPreviewTextBytes=512KB, maxPreviewImageBytes=2MB)。
- **Electron-builder Packing**：asarUnpack 展开 Claude Agent SDK 以支持动态 require；afterPack 执行 win 图标替换脚本；extraResources 包含 preload.cjs。

## 内部关系

- `tsconfig.json` -> `tsconfig.app.json`：tsconfig.json 通过 references 引用 tsconfig.app.json 和 tsconfig.node.json，实现前后端分离编译
- `tsconfig.app.json` -> `types.d.ts`：tsconfig.app.json include types.d.ts，使全局类型对前端代码可见
- `index.html` -> `src/ui/main.tsx`：index.html 通过 script type=module 加载前端入口 src/ui/main.tsx
- `package.json` -> `electron-builder.json`：package.json 的 build 脚本产出 dist-react，electron-builder.json 的 files 字段引用这些产物
- `CLAUDE.md` -> `agent-runtime.json`：CLAUDE.md 定义默认规则源；agent-runtime.json 提供运行时行为扩展配置，两者共同约束 Agent 执行策略
- `.mcp.json` -> `package.json`：MCP server 声明依赖 package.json 的 dependencies/npm scripts 执行

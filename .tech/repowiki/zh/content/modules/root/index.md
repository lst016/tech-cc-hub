# root

> 项目根目录模块：包含所有配置文件、文档、构建脚本和入口文件，定义项目元数据、构建流程、设计规范和开发指南

tech-cc-hub 是一个 Electron 桌面端 Agent 工作台，集成了会话管理、任务系统、内置浏览器、模型路由和执行轨迹监控。根目录包含项目构建配置（Vite、TypeScript、ESLint、Electron Builder）、产品文档、设计系统规范、开发指南、Agent 运行时配置，以及 HTML 入口文件。核心功能通过 src/electron/ 主进程和 src/ui/ 前端实现，根目录文件负责环境定义和工具链编排。

## 文件

### `vite.config.ts`

Vite 构建配置，包含文件预览中间件插件，支持浏览目录和读取文件内容

- `isPathWithinRoot` (function) - 判断目标路径是否在根目录范围内，防止目录遍历攻击
- `resolvePreviewRequest` (function) - 解析预览请求 URL，提取 cwd 和 path 参数，验证路径安全后返回真实路径
- `previewFsPlugin` (function) - Vite 插件，为开发服务器添加 /__tech_preview/list 和 /__tech_preview/files 两个端点，支持目录浏览和文件预览
- `previewImageMimeTypes` (constant) - 图片 MIME 类型映射表，用于文件预览响应头设置

### `package.json`

项目元数据和 npm 脚本定义，包含依赖声明、构建命令和打包配置

- `main` (field) - Electron 主入口文件路径 dist-electron/electron/main.js
- `scripts` (field) - 包含 dev、build、lint、package、dist 等开发构建命令
- `dependencies` (field) - 核心依赖：React 19、Electron、Claude Agent SDK、Zustand、better-sqlite3、Tailwind CSS v4 等

### `tsconfig.json`

TypeScript 项目引用配置，引用 tsconfig.app.json 和 tsconfig.node.json

- `references` (field) - 项目引用数组，指向 app 和 node 两个子配置

### `tsconfig.app.json`

React 前端 TypeScript 配置，编译 src/ui、src/shared、types.d.ts

- `jsx` (field) - jsx: react-jsx，启用新版 JSX 转换
- `baseUrl/paths` (field) - @/ alias 指向 ./src/，便于模块导入

### `tsconfig.node.json`

Node 端 TypeScript 配置，用于 vite.config.ts 等 Node 脚本

### `types.d.ts`

全局类型定义，包含 API 配置、浏览器工作台状态、任务系统等核心类型

- `ApiConfig` (type) - API 网关配置，包含 id、name、baseURL、model、各类模型槽位设置
- `BrowserWorkbenchState` (type) - 浏览器工作台状态，包含 url、loading、canGoBack、annotationMode 等
- `BrowserWorkbenchAnnotation` (type) - 浏览器标注对象，包含位置、DOM 提示、评论、期望等

### `eslint.config.js`

ESLint 配置，使用 typescript-eslint 规则集，忽略构建产物目录

### `electron-builder.json`

Electron 打包配置，定义 appId、files、mac/win/linux 打包目标、NSIS 安装器选项

### `index.html`

前端 HTML 入口，引入 React 主脚本，设置 CSP 安全策略

### `README.md`

项目主文档，包含功能介绍、快速启动、核心能力说明、目录结构和排障指南

### `CLAUDE.md`

开发指南，定义项目法规、技术栈、目录约束、QA 命令和开发规范

### `DESIGN.md`

设计系统文档，定义产品配色方案（warm gray + clay accent）和 VS Code 风格工作台层

### `agent-runtime.json`

Agent 运行时配置，定义工具调用预算规则和附件处理策略

### `.mcp.json`

MCP（Model Context Protocol）服务器配置，定义 chrome-devtools 和 windows 两个 MCP 服务

### `.qoderignore`

Qoder 索引忽略规则文件（用于知识引擎）

### `.techignore`

Tech/Knowledge Engine 项目忽略规则，排除 doc/*research* 目录

## 关键概念

- **模块化 TypeScript 项目**: 项目使用 tsconfig.json 的 references 特性，将前端（tsconfig.app.json）和 Node 端（tsconfig.node.json）分离编译，避免 Electron 主进程和 React 前端类型污染
- **预览文件系统中间件**: previewFsPlugin 在 Vite 开发服务器中注入两个端点，提供安全的文件浏览和读取功能，支持文本和图片预览，带有路径安全检查防止目录遍历
- **Electron + Vite 双构建流**: package.json 中 build 命令同时执行 tsc -b（TypeScript 编译）和 vite build（前端构建）；Electron 主进程需单独通过 transpile:electron 命令编译到 dist-electron/
- **设计系统双层架构**: Product Layer 使用 warm gray + clay accent 配色用于通用 UI；Workbench Layer 使用 VS Code light neutral + blue 仅用于代码文件预览区域
- **Agent 运行时策略**: agent-runtime.json 定义工具调用预算规则：要求并行发出不依赖的请求、限制单次读取行数、禁止碎片化工具链（ls→cat→grep→cat）

## 内部关系

- `vite.config.ts` → `tsconfig.node.json`: Vite 配置文件由 tsconfig.node.json 提供 TypeScript 类型支持
- `package.json` → `electron-builder.json`: package.json 定义 npm scripts 调用 electron-builder，使用 electron-builder.json 作为打包配置
- `index.html` → `src/ui/main.tsx`: HTML 入口加载 React 主模块 /src/ui/main.tsx
- `vite.config.ts` → `tsconfig.app.json`: Vite 通过 vite-tsconfig-paths 插件解析 tsconfig.app.json 中的路径别名 @/
- `tsconfig.json` → `tsconfig.app.json`: 根配置引用 app 配置编译前端代码
- `tsconfig.json` → `tsconfig.node.json`: 根配置引用 node 配置编译 Node 脚本

# tech-cc-hub 项目概览

> Desktop Agent workbench integrating chat, task management, browser, and model routing in Electron

tech-cc-hub is a desktop Agent workbench that brings chat, tasks, browser viewing, model routing, execution traces and replay diagnostics into a single Electron application. It supports unified access to Claude Code, OpenAI-compatible gateways, and local models through a configurable interface. The app synchronizes tasks from external sources like Feishu/Lark, executes them in isolated workspaces, and provides real-time execution tracing with usage analytics.

The built-in browser workbench allows opening pages, capturing screenshots, generating DOM summaries, and performing design inspections with comparison tools. Users can configure multiple model slots for different purposes: primary model for chat, expert model for complex tasks, small model for background operations, prompt analysis model for diagnostics, and image preprocessing model for OCR and screenshot analysis.

The task system persists tasks locally in SQLite, supports automatic/manual execution with retry and recovery, and can write results back to source systems. The project includes extensive documentation for architecture, contracts, engineering specs, and operations.

## Agent 快速定位

- 先读 `Agent 作业手册`，确认知识库生成、索引和聊天注入链路。
- 再读 `接口与存储面`，定位 IPC、MCP Tool、SQLite/向量表。
- 需要改某个功能时，从左侧模块树进入具体文件页，文件页包含源码摘录和运行信号。

## Agent 高价值文件

- `src/electron/main.ts` - 入口，运行信号，80 个符号
- `src/electron/libs/knowledge/knowledge-repository.ts` - 运行信号，34 个符号，4 个依赖
- `src/electron/libs/task/repository.ts` - 运行信号，67 个符号，2 个依赖
- `src/electron/libs/skill-manager/db.ts` - 运行信号，80 个符号，5 个依赖
- `src/electron/libs/mcp-tools/browser.ts` - 运行信号，80 个符号，5 个依赖
- `src/electron/libs/mcp-tools/design.ts` - 运行信号，80 个符号，11 个依赖
- `src/electron/libs/knowledge/knowledge-ui-store.ts` - 运行信号，80 个符号，8 个依赖
- `src/electron/libs/mcp-tools/figma-rest.ts` - 运行信号，80 个符号，10 个依赖
- `src/ui/components/settings/PluginsSettingsPage.tsx` - 运行信号，80 个符号，4 个依赖
- `src/electron/libs/cron-ipc-handlers.ts` - 运行信号，3 个符号，4 个依赖
- `src/electron/libs/mcp-tools/knowledge.ts` - 运行信号，55 个符号，13 个依赖
- `src/electron/libs/session-store.ts` - 运行信号，55 个符号，7 个依赖
- `src/electron/libs/memory/memory-repository.ts` - 运行信号，31 个符号，2 个依赖
- `src/electron/libs/learning-store.ts` - 运行信号，18 个符号，1 个依赖
- `src/electron/libs/knowledge/knowledge-indexer.ts` - 32 个符号，10 个依赖
- `src/electron/libs/knowledge/knowledge-types.ts` - 15 个符号
- `src/electron/libs/knowledge/repowiki/types.ts` - 27 个符号
- `src/electron/libs/skill-manager/sync-engine.ts` - 49 个符号，3 个依赖
- `src/electron/ipc-handlers.ts` - 80 个符号，27 个依赖
- `src/electron/libs/config-store.ts` - 65 个符号，4 个依赖
- `src/electron/libs/knowledge/knowledge-overview.ts` - 16 个符号，8 个依赖
- `src/electron/libs/knowledge/knowledge-utils.ts` - 35 个符号，3 个依赖

## 技术栈

- **Electron** latest (desktop framework)
- **React** 19.2.3 (frontend framework)
- **TypeScript** 5.x (language)
- **Vite** latest (build tool)
- **better-sqlite3** 12.9.0 (database)
- **Tailwind CSS** 4.1.18 (styling)
- **Monaco Editor** 0.55.1 (code editor)
- **Arco Design** 2.66.14 (UI component library)
- **Node.js** 20+ (runtime)
- **MCP SDK** 1.29.0 (model context protocol)
- **Claude Agent SDK** 0.3.142 (agent SDK)

## 关键工作流

- Multi-model routing with separate slots for primary, expert, small, analysis, and image models
- Task synchronization with Feishu/Lark, local SQLite persistence, and independent workspaces per task
- Built-in browser workbench for page viewing, screenshot, DOM summary, and style inspection
- Design inspection tools: single image analysis, two-image comparison, diff/comparison views, and JSON reports
- Real-time execution tracing with usage analytics and timeline visualization
- MCP tools integration for browser operations, design checks, Figma REST API, and admin operations
- Git workbench with status, diff, commit, branch management, and stash support
- Slash commands and session management with workspace organization
- Scheduled tasks via Cron service with persistence and execution history
- Knowledge panel for wiki search and learning management

## 快速开始

1. Ensure Node.js 20+ is installed; also install Bun for some packaging scripts
2. Run npm install to install dependencies
3. Start development: npm run dev (starts both Vite and Electron)
4. Build for production: npm run build (TypeScript + Vite)
5. If native Electron modules fail, run npm run rebuild first
6. For packaging: npm run package:mac, npm run package:win, or npm run dist:linux

## 验证命令

- `npm run qa:knowledge`
- `npm run qa:knowledge-ui`
- `npm run qa:knowledge-chat`

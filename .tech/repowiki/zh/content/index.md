# tech-cc-hub 项目概览

> Desktop Agent workbench with sessions, task orchestration, built-in browser and multi-model routing in Electron.

tech-cc-hub is a desktop Electron application that serves as an Agent workbench, unifying chat sessions, task management, a built-in browser, model routing, execution traces, and diagnostic playback into a single interface. It connects to Claude Code, OpenAI-compatible gateways, and local models, allowing agents to handle tasks like Feishu/Lark integration, sub-task decomposition, independent workspace execution, and result writing back to source systems.

The application provides layered model routing across five slots (main model, expert model, small/fast model, prompt-analysis model, and image-preprocessing model) to avoid routing backend calls through unavailable channels. A built-in BrowserView enables navigation, screenshots, DOM summarization, style inspection, and design comparison capabilities that agents can invoke via MCP tools.

The task system synchronizes with external task providers (currently Feishu/Lark), persists them locally in SQLite, and executes each task in an isolated workspace. An Executor handles scheduling, auto-execution, retry logic, concurrency control, and state recovery on app restart. The right-side panel surfaces real-time execution traces and usage diagnostics, with a full Trace Viewer for complete链路 analysis.

## 技术栈

- **TypeScript** (language)
- **Electron** (framework)
- **React** (ui_framework)
- **Vite** (build_tool)
- **Tailwind CSS** (styling)
- **Node.js** 20+ (runtime)
- **SQLite** (database)
- **Claude Agent SDK** 0.2.137 (ai_sdk)
- **MCP SDK** 1.29.0 (protocol)
- **better-sqlite3** 12.6.2 (native_module)

## 核心功能

- Multi-slot model routing with main/expert/small/prompt-analysis/image model tiers
- Built-in browser (BrowserView) for navigation, screenshot, DOM summarization, and design inspection
- Task system with external provider sync (Feishu/Lark), SQLite persistence, and isolated workspace execution
- Real-time execution traces and usage diagnostics on the right-side activity rail
- MCP tool layer exposing browser, design-inspection, Figma REST, and admin capabilities to agents
- Design comparison tools: single-image semantic summary, screenshot diff, hotspot regions, and JSON reports
- Session and workspace management with left-sidebar workspace grouping
- Slash commands, attachments, and model switching in the main chat composer
- Automatic task retry, stall recovery, and state restoration on app restart

## 快速开始

1. Clone the repo and run `npm install` to install dependencies (Node.js 20+ required, Bun recommended for packaging scripts).
2. Run `npm run dev` to start the development server. If native module errors occur, first run `npm run rebuild`.
3. On first launch, open Settings -> AI Interface, add a compatible gateway (e.g. OpenAI-compatible or Anthropic-compatible), set API key, and configure the five model slots.
4. For production packaging: run `npm run build` to transpile and bundle, then use platform-specific scripts like `npm run package:mac`, `npm run package:win`, or `npm run dist:linux`.

## 仓库规模

- 文件数：709
- 代码行数：133,061

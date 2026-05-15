# root

> Project root configuration layer: build setup, shared types, development guidelines, and entry points for the Desktop Agent workbench.

The root module holds project-wide configuration, metadata, and governance files for tech-cc-hub. It defines the build pipeline (Vite + Electron), shared TypeScript types used across both main and renderer processes, development workflows, linting rules, packaging settings, and design/development conventions. An agent modifying any feature layer must first consult CLAUDE.md (default rules) and DESIGN.md (UI conventions) before making changes.

## Agent 可用信息

- npm run dev starts full Electron client, not just Vite; dev:react is only the frontend server
- CLAUDE.md is the default rule source and prohibits relying on AGENTS.md
- UI changes must use DESIGN.md tokens (warm gray + clay accent) not raw hex colors
- Feature labeled with upstream source requires full CV copy + adaptation, not reimplementation
- 403 errors on file preview indicate path traversal protection triggered by isPathWithinRoot
- agent-runtime.json rules govern tool call batching and attachment handling behavior

## 优先入口

- `CLAUDE.md`：First read for any modification to understand project rules and conventions
- `package.json`：To identify available scripts (dev, build, qa commands) before starting work
- `DESIGN.md`：Required pre-read before any UI/visual/color changes to use correct design tokens

## 文件

### `vite.config.ts`

Vite bundler configuration with a custom dev-server plugin that exposes a file preview filesystem API. Agents read this to understand how the dev server handles file serving and path safety validation.

- `previewFsPlugin` (function) - Vite plugin that registers /__tech_preview/list and /__tech_preview/files middleware routes during dev server startup
- `resolvePreviewRequest` (function) - Resolves and validates file paths to prevent traversal beyond cwd root
- `isPathWithinRoot` (function) - Path safety check used by preview plugin to enforce workspace boundaries

### `package.json`

Project metadata, scripts, and runtime dependency declarations. Agents use this to understand available npm commands, dependency inventory, and how Electron vs React processes are orchestrated.

- `scripts.dev` (string) - Primary dev command: npm run dev starts both Vite and Electron via node scripts/dev.mjs
- `scripts.build` (string) - Build command: tsc -b && vite build compiles TypeScript then bundles React
- `scripts.transpile:electron` (string) - Only compiles Electron main process TypeScript without bundling UI
- `main` (string) - Electron entry point: dist-electron/electron/main.js

### `README.md`

配置文件，会影响构建、开发或模型能力；代码信号：config:README.md

### `tsconfig.json`

Root TypeScript config that references tsconfig.app.json (UI code) and tsconfig.node.json (Vite/build tools). Agents typically open app or node variants directly rather than this file.

### `types.d.ts`

Shared type definitions consumed by both Electron main process and React renderer. Defines API config schemas, browser workbench state types, IPC event shapes, and type aliases for exported UI types. Agents read this to understand cross-process data contracts.

- `ApiConfig` (type) - Gateway configuration shape with model slots (default/expert/small/analysis/image)
- `BrowserWorkbenchState` (type) - BrowserView state published to renderer via IPC: url, loading, navigation flags, annotation mode
- `BrowserWorkbenchEvent` (type) - Discriminated union of all browser IPC events: browser.state / browser.console / browser.annotation
- `UnsubscribeFunction` (type alias) - Standard cleanup function signature used across event subscriptions

### `.gitignore`

Git ignore patterns. Agents read when adding new build output directories (dist-electron, dist-react, dist-test, *.db).

### `.mcp.json`

MCP (Model Context Protocol) server configuration. Declares chrome-devtools and windows MCP servers for IDE integration. Agents may read to understand available MCP tools.

### `.qoderignore`

unknown 文件，1 行；用于 根目录 功能域。

### `agent-runtime.json`

System prompt extension rules injected into Claude Agent execution. Defines tool call budgeting, attachment handling strategy (design_inspect_image for images), and annotation-driven UI modification SOP. This file directly governs agent behavior in task execution.

- `工具调用预算与并行规则` (section) - Agents must batch evidence-gathering calls; no ls→cat→grep→cat chains
- `标注驱动 UI 修改 SOP` (section) - Sequence: locate from annotation.domHint → batch read ≤3 candidates → single-round edits → tsc --noEmit validation

### `CLAUDE.md`

Default project rules for all agents. Defines source-of-truth hierarchy (CLAUDE.md > upstream), CV policy (full source copy then adapt, no reimplementation), TypeScript/React/UI conventions, and QA command reference. Agents must read this before any modification.

- `项目法规` (section) - CLAUDE.md is the default rule source; AGENTS.md is prohibited unless explicitly requested
- `源码 CV 政策` (section) - Upstream labeled features must be full source copy + adaptation; no unauthorized reimplementation
- `启动口径` (section) - npm run dev means full Electron client; npm run dev:react is not project startup

### `DESIGN.md`

Design system documentation with color tokens, semantic naming conventions, and component guidelines. Agents making UI/visual changes must read this first to use correct tokens (warm gray + clay accent for product UI, VS Code light for workbench).

- `Product Layer Tokens` (table) - Accent color #D26A3D, ink-800 for body text, surface white for cards
- `Workbench Layer Tokens` (table) - VS Code light neutrals for code/file preview surfaces only

### `electron-builder.json`

Electron packaging configuration. Defines what files go into the distributable, ASAR unpacking for SDK dependencies, mac/win/linux build targets, and post-pack icon script.

- `files` (array) - Bundled artifacts: dist-electron, dist-react, and @anthropic-ai/claude-agent-sdk modules
- `asarUnpack` (array) - Agent SDK files unpacked from ASAR to allow native module access

### `eslint.config.js`

ESLint configuration using typescript-eslint. Agents read to understand lint rules and import resolver setup.

- `import/resolver.typescript` (object) - Enables TypeScript path resolution for eslint-plugin-import

### `index.html`

Entry HTML for the React app. CSP policy restricts content sources; agents rarely modify this unless changing security policy or adding new entry points.

- `Content-Security-Policy` (meta) - Restricts script/style to 'self' only; img allows data: and blob: URIs
- `#root` (element) - React mount point where App component is rendered

### `tsconfig.app.json`

TypeScript config for React renderer process. Defines @/ alias to ./src/, types field includes ./types, excludes src/electron. Agents modify this when adding new UI source directories.

- `paths.@/*` (object) - Alias @/ maps to ./src/ for all UI imports
- `exclude` (array) - src/electron excluded from UI build to prevent main-process code leaking into renderer bundle

### `tsconfig.node.json`

TypeScript config for Node/Vite build tooling context. Agents typically don't modify this unless adding new build scripts.

## 数据与接口契约

- **BrowserWorkbenchEvent union**：Discriminated union type at types.d.ts line 97. Events: browser.state | browser.console | browser.annotation. Owned by types.d.ts, consumed by Browser workbench component.
- **ApiConfig schema**：Gateway configuration at types.d.ts line 21. Fields: baseURL, apiKey, model slots (main/expert/small/analysis/image). Consumed by model routing logic in both Electron and renderer.
- **/__tech_preview/list**：Dev-only Vite middleware at vite.config.ts line 62. Returns directory entries as JSON for file explorer UI.
- **/__tech_preview/files**：Dev-only Vite middleware at vite.config.ts line 87. Returns file content with size/type validation.

## 关键概念

- **entrypoints**：index.html is the static entry point; main.tsx is the React entry; dist-electron/electron/main.js is the Electron entry.
- **model routing slots**：ApiConfig type defines five model slots: default/main, expert, small/backend, analysis, image. Misconfiguration causes 503 errors when backend model hits unavailable channel.
- **file preview plugin**：vite.config.ts registers a Vite plugin that exposes /__tech_preview/list and /__tech_preview/files dev-only HTTP endpoints for directory browsing and file content serving with path safety enforcement.
- **two-process architecture**：src/electron (main process) and src/ui (renderer) are separate TypeScript compilation units with isolated tsconfig files. Shared types live at root/types.d.ts.
- **workspace isolation**：isPathWithinRoot() prevents file preview and MCP tools from accessing files outside the cwd to prevent path traversal.

## 内部关系

- `vite.config.ts` -> `tsconfig.app.json`：Vite reads tsconfig.app.json via vite-tsconfig-paths plugin for path alias resolution
- `index.html` -> `src/ui/main.tsx`：HTML loads the React entry point script from src/ui/main.tsx
- `package.json` -> `vite.config.ts`：npm run build invokes Vite which loads vite.config.ts
- `electron-builder.json` -> `package.json`：electron-builder reads main field from package.json to locate entry point
- `CLAUDE.md` -> `DESIGN.md`：CLAUDE.md references DESIGN.md as required pre-read for UI changes
- `src/ui` -> `types.d.ts`：UI code imports shared types from the root types.d.ts via @/ alias or relative paths

## 运行注意事项

- Vite dev server serves file preview endpoints only in development mode via previewFsPlugin
- Electron main process compiled separately via tsc --project src/electron/tsconfig.json, not bundled by Vite
- UI and Electron are separate TypeScript projects with isolated tsconfig files
- agent-runtime.json modifies system prompt used by Claude Agent SDK at runtime
- npm run rebuild fixes native module (better-sqlite3) mismatches after Electron version upgrades

## 修改风险

- Modifying vite.config.ts plugin routes breaks file preview dev server functionality
- Changing tsconfig.app.json paths alias breaks @/ imports across entire UI codebase
- Modifying electron-builder.json files array can omit required SDK modules causing runtime crashes
- Changing design tokens in DESIGN.md without updating component usage breaks visual consistency
- Updating agent-runtime.json tool call rules changes agent behavior globally across all executions

## 验证

- npm run build - validates TypeScript compilation and Vite bundling success
- npm run qa:smoke - launches Electron and runs minimal chat smoke test
- npm run lint - ESLint check with typescript-eslint resolver
- vite preview (after build) - serves built React app for manual verification

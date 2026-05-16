# package.json

> 模块：`root` · 语言：`json` · 行数：124

## 文件职责

项目元数据和 npm 脚本定义，包含依赖声明、构建命令和打包配置

## 关键符号

- `main@0 - Electron 主入口文件路径 dist-electron/electron/main.js`
- `scripts@0 - 包含 dev、build、lint、package、dist 等开发构建命令`
- `dependencies@0 - 核心依赖：React 19、Electron、Claude Agent SDK、Zustand、better-sqlite3、Tailwind CSS v4 等`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
	"name": "tech-cc-hub",
	"private": true,
	"version": "0.1.18",
	"type": "module",
	"main": "dist-electron/electron/main.js",
	"scripts": {
		"rebuild": "npx electron-rebuild -f -w better-sqlite3",
		"dev": "node scripts/dev.mjs",
		"dev:react": "vite",
		"dev:electron": "bun run transpile:electron && node scripts/dev-electron.mjs",
		"qa:smoke": "bash scripts/qa/electron-autostart-smoke.sh \"请只回复：SMOKE_OK\"",
		"qa:slash": "bash scripts/qa/electron-autostart-smoke.sh \"/debug\"",
		"qa:codex": "SMOKE_TIMEOUT_SECONDS=120 bash scripts/qa/electron-autostart-smoke.sh \"/codex consult 你好，只回复 CODEX_SMOKE_OK\"",
		"qa:continue": "bash scripts/qa/electron-autostart-smoke.sh \"请只回复：SMOKE_ROUND_1\" \"请只回复：SMOKE_ROUND_2\"",
		"qa:chat-ui": "node scripts/qa/chat-ui-smoke.cjs",
		"qa:knowledge": "node scripts/qa/knowledge-engine-smoke.mjs",
		"qa:knowledge-chat": "node scripts/qa/knowledge-chat-injection-smoke.mjs",
		"qa:knowledge-ui": "node scripts/qa/knowledge-ui-smoke.cjs",
		"qa:preview": "node scripts/qa/preview-workbench-smoke.cjs",
		"qa:window:list": "bash scripts/qa/window-id-tools.sh list",
		"qa:window:capture": "bash scripts/qa/window-id-tools.sh capture",
		"codex:oauth:setup": "node scripts/codex-oauth-setup.mjs",
		"build": "tsc -b && vite build",
		"lint": "eslint .",
		"preview": "vite preview",
		"test:activity-rail-model": "tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/activity-rail-model.test.js",
		"transpile:electron": "tsc --project src/electron/tsconfig.json",
		"package:mac": "bun run transpile:electron && bun run build && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac zip --arm64 --publish never",
		"package:mac:fast": "bun run transpile:electron && bun run build && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac dir --arm64 --publish never",
		"package:win": "node scripts/package-win-safe.mjs",
		"dist:mac-arm64": "bun run transpile:electron && bun run build && electron-builder --mac --arm64",
		"dist:mac-x64": "bun run transpile:electron && bun run build && electron-builder --mac --x64",
		"dist:win": "node scripts/package-win-safe.mjs",
		"dist:win:stable": "node scripts/package-win-safe.mjs",
		"dist:linux": "bun run transpile:electron && bun run build && electron-builder --linux --x64",
		"release:mac-arm64": "npm run transpile:electron && npm run build && electron-builder --mac --arm64 --publish always",
		"release:mac-x64": "npm run transpile:electron && npm run build && electron-builder --mac --x64 --publish always",
		"release:win-x64": "npm run transpile:electron && npm run build && electron-builder --win --x64 --publish always --config.win.forceCodeSigning=false --config.win.signAndEditExecutable=false",
		"release:github": "node scripts/github-release.mjs"
	},
	"dependencies": {
		"@anthropic-ai/claude-agent-sdk": "^0.3.142",
		"@arco-design/web-react": "^2.66.14",
		"@codemirror/commands": "^6.10.3",
		"@codemirror/lang-html": "^6.4.11",
		"@codemirror/lang-markdown": "^6.5.0",
		"@codemirror/view": "^6.41.1",
		"@dnd-kit/core": "^6.3.1",
		"@dnd-kit/sortable": "^10.0.0",
		"@dnd-kit/utilities": "^3.2.2",
		"@floating-ui/react": "^0.27.19",
		"@gitgraph/react": "^1.6.0",
		"@icon-park/react": "^1.4.2",
		"@langchain/textsplitters": "^1.0.1",
		"@monaco-editor/react": "^4.7.0",
		"@radix-ui/react-dialog": "^1.1.15",
		"@radix-ui/react-dropdown-menu": "^2.1.16",
		"@tailwindcss/vite": "^4.1.18",
		"@types/diff": "^7.0.2",
		"@types/lodash-es": "^4.17.12",
		"@types/react-syntax-highlighter": "^15.5.13",
		"@uiw/react-codemirror": "^4.25.9",
		"ahooks": "^3.9.7",
		"better-sqlite3": "^12.9.0",
		"classnames": "^2.5.1",
		"croner": "^10.0.1",
		"diff": "^9.0.0",
		"diff2html": "^3.4.56",
		"dotenv": "^17.2.3",
		"electron-log": "^5.4.3",
		"electron-updater": "^6.8.3",
		"eventemitter3": "^5.0.4",
		"highlight.js": "^11.11.1",
		"i18next": "^26.0.8",
		"katex": "^0.16.45",
		"lodash-es": "^4.18.1",
		"lucide-react": "^1.14.0",
		"mitt": "^3.0.1",
		"monaco-editor": "^0.55.1",
		"os-utils": "^0.0.14",
		"react": "^19.2.3",
		"react-dom": "^19.2.3",
		"react-i18next": "^17.0.6",
		"react-markdown": "^10.1.0",
		"react-router-d
... (truncated)
```

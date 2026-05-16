# package/package.json

> 模块：`package` · 语言：`json` · 行数：83

## 文件职责

npm包配置，定义模块入口、依赖、版本和平台特定可选依赖

## 关键符号

- `exports@0 - 定义5个导出入口：主入口(browser/bridge/assistant/sdk-tools)`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "name": "@anthropic-ai/claude-agent-sdk",
  "version": "0.2.137",
  "main": "sdk.mjs",
  "types": "sdk.d.ts",
  "exports": {
    ".": {
      "types": "./sdk.d.ts",
      "default": "./sdk.mjs"
    },
    "./browser": {
      "types": "./browser-sdk.d.ts",
      "default": "./browser-sdk.js"
    },
    "./bridge": {
      "types": "./bridge.d.ts",
      "default": "./bridge.mjs"
    },
    "./assistant": {
      "types": "./assistant.d.ts",
      "default": "./assistant.mjs"
    },
    "./sdk-tools": {
      "types": "./sdk-tools.d.ts"
    },
    "./sdk-tools.js": {
      "types": "./sdk-tools.d.ts"
    }
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "type": "module",
  "author": "Anthropic <support@anthropic.com>",
  "license": "SEE LICENSE IN README.md",
  "description": "SDK for building AI agents with Claude Code's capabilities. Programmatically interact with Claude to build autonomous agents that can understand codebases, edit files, and execute workflows.",
  "homepage": "https://github.com/anthropics/claude-agent-sdk-typescript",
  "bugs": {
    "url": "https://github.com/anthropics/claude-agent-sdk-typescript/issues"
  },
  "keywords": [
    "ai",
    "agent",
    "sdk",
    "claude",
    "anthropic",
    "automation",
    "code-generation"
  ],
  "dependencies": {
    "@anthropic-ai/sdk": "^0.81.0",
    "@modelcontextprotocol/sdk": "^1.29.0"
  },
  "peerDependencies": {
    "zod": "^4.0.0"
  },
  "optionalDependencies": {
    "@anthropic-ai/claude-agent-sdk-linux-x64": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-linux-arm64": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-linux-x64-musl": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-linux-arm64-musl": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-darwin-x64": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-darwin-arm64": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-win32-x64": "0.2.137",
    "@anthropic-ai/claude-agent-sdk-win32-arm64": "0.2.137"
  },
  "files": [
    "sdk.mjs",
    "sdk.d.ts",
    "sdk-tools.d.ts",
    "agentSdkTypes.d.ts",
    "bridge.mjs",
    "bridge.d.ts",
    "assistant.mjs",
    "assistant.d.ts",
    "browser-sdk.js",
    "browser-sdk.d.ts",
    "manifest.json",
    "manifest.zst.json"
  ],
  "claudeCodeVersion": "2.1.137"
}

```

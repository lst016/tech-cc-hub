# test/electron/runner-claude-code-plugins.test.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：30

## 文件职责

测试Claude Code插件集成功能

## 关键符号

- `source@0 - 读取runner.ts源码用于字符串匹配测试，验证插件集成、auto-truncate和技能启用逻辑`

## 依赖输入

- `node:assert/strict`
- `node:fs`
- `node:test`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("runner injects enabled Claude Code plugins into Agent SDK sessions", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /resolveEnabledClaudeCodeSdkPlugins\(\)/);
  assert.match(source, /plugins:\s*sdkPlugins\.length > 0 \? sdkPlugins : undefined/);
  assert.match(source, /isClaudeCodePluginMcpTool\(toolName, sdkPluginMcpServerNames\)/);
  assert.match(source, /maybeRunFigmaGuideOAuth\(q,/);
  assert.match(source, /mcpAuthenticate\(figmaServer\.name\)/);
});

test("runner enables Claude Code auto truncation for oversized resumed contexts", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /CLAUDE_CODE_AUTO_TRUNCATE_ARGS/);
  assert.match(source, /"allow-auto-truncate": null/);
  assert.match(source, /extraArgs:\s*CLAUDE_CODE_AUTO_TRUNCATE_ARGS/);
});

test("runner enables discovered skills for desktop development sessions", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /const enabledSkills = agentContext\.skills\.length > 0/);
  assert.match(source, /runSurface === "development"\s*\? "all"/);
  assert.match(source, /skills:\s*enabledSkills/);
});

```

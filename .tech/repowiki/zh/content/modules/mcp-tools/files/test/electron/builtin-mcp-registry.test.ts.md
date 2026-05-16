# test/electron/builtin-mcp-registry.test.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：50

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `serverInfos@12`
- `registryNames@13`
- `toolNames@30`
- `uniqueToolNames@31`
- `hints@44`

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/shared/builtin-mcp-registry.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILTIN_MCP_SERVERS,
  buildBuiltinMcpPromptHints,
  listBuiltinMcpServerInfos,
  listBuiltinMcpToolNames,
} from "../../src/shared/builtin-mcp-registry.js";

test("built-in MCP registry drives the settings list", () => {
  const serverInfos = listBuiltinMcpServerInfos();
  const registryNames = BUILTIN_MCP_SERVERS.map((server) => server.name);

  assert.deepEqual(serverInfos.map((server) => server.name), registryNames);
  assert.equal(registryNames.includes("tech-cc-hub-idea"), true);
  assert.equal(serverInfos.every((server) => server.type === "builtin" && server.command === "builtin"), true);
});

test("built-in MCP registry contains displayable tool metadata", () => {
  for (const server of BUILTIN_MCP_SERVERS) {
    assert.ok(server.description.trim(), `${server.name} needs a description`);
    assert.ok(server.highlights.length > 0, `${server.name} needs highlights`);
    assert.ok(server.toolGroups.length > 0, `${server.name} needs at least one tool group`);
    assert.ok(server.toolGroups.some((group) => group.tools.length > 0), `${server.name} needs listed tools`);
  }
});

test("built-in MCP registry tool names stay unique", () => {
  const toolNames = listBuiltinMcpToolNames();
  const uniqueToolNames = new Set(toolNames);

  assert.equal(uniqueToolNames.size, toolNames.length);
  assert.equal(toolNames.includes("idea_status"), true);
  assert.equal(toolNames.includes("idea_open"), true);
  assert.equal(toolNames.includes("idea_focus"), true);
  assert.equal(toolNames.includes("idea_wait_ready"), true);
  assert.equal(toolNames.includes("figma_get_design_playbook"), true);
  assert.equal(toolNames.includes("figma_audit_design"), true);
  assert.equal(toolNames.includes("figma_match_ui_nodes"), true);
});

test("built-in MCP prompt hints are sourced from the registry", () => {
  const hints = buildBuiltinMcpPromptHints();

  assert.match(hints, /mcp__tech-cc-hub-idea__idea_status/);
  assert.match(hints, /mcp__tech-cc-hub-idea__idea_wait_ready/);
  assert.match(hints, /java -jar/);
});

```

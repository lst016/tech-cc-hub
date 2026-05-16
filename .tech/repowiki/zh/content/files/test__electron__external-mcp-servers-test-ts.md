# test/electron/external-mcp-servers.test.ts

> 模块：`test` · 语言：`typescript` · 行数：77

## 文件职责

测试外部MCP服务器解析，验证stdio/http双模式解析、CLAUDE_PROJECT_DIR注入、禁用/无效条目跳过、工具名格式兼容（mcp__xxx__xxx和xxx:xxx）

## 关键符号

- `parseExternalMcpServers@0 - 解析外部MCP服务器配置，注入项目目录环境变量`
- `isConfiguredExternalMcpTool@0 - 检查工具名是否属于已配置的外部MCP服务器`

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/electron/libs/external-mcp-servers.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  isConfiguredExternalMcpTool,
  listExternalMcpServerInfos,
  parseExternalMcpServers,
} from "../../src/electron/libs/external-mcp-servers.js";

test("parses stdio and http external MCP servers", () => {
  const config = {
    mcpServers: {
      "open-computer-use": { type: "stdio", command: "open-computer-use", args: ["mcp"], env: { A: "1" } },
      figma: { type: "http", url: "https://mcp.figma.com/mcp", enabled: true },
    },
  };

  const parsed = parseExternalMcpServers(config);
  assert.equal(Object.keys(parsed).includes("open-computer-use"), true);
  assert.equal(Object.keys(parsed).includes("figma"), true);
  assert.deepEqual(parsed.figma, { type: "http", url: "https://mcp.figma.com/mcp" });

  const infos = listExternalMcpServerInfos(config);
  assert.deepEqual(infos.map((item) => item.name), ["open-computer-use", "figma"]);
  assert.equal(infos.find((item) => item.name === "figma")?.transport, "http");
  assert.equal(infos.find((item) => item.name === "figma")?.url, "https://mcp.figma.com/mcp");
});

test("injects CLAUDE_PROJECT_DIR into stdio external MCP server env", () => {
  const parsed = parseExternalMcpServers(
    {
      mcpServers: {
        local: { type: "stdio", command: "local-mcp", env: { A: "1" } },
        custom: { type: "stdio", command: "custom-mcp", env: { CLAUDE_PROJECT_DIR: "D:\\custom" } },
        remote: { type: "http", url: "https://example.com/mcp" },
      },
    },
    { projectDir: "D:\\workspace\\demo" },
  );

  assert.deepEqual(parsed.local, {
    type: "stdio",
    command: "local-mcp",
    args: [],
    env: { CLAUDE_PROJECT_DIR: "D:\\workspace\\demo", A: "1" },
  });
  assert.equal(parsed.custom?.type, "stdio");
  if (parsed.custom?.type === "stdio") {
    assert.equal(parsed.custom.env?.CLAUDE_PROJECT_DIR, "D:\\custom");
  }
  assert.deepEqual(parsed.remote, { type: "http", url: "https://example.com/mcp" });
});

test("skips disabled and invalid external MCP entries", () => {
  const config = {
    mcpServers: {
      disabled: { type: "http", url: "https://example.com/mcp", enabled: false },
      badHttp: { type: "http" },
      badStdio: { type: "stdio" },
      legacy: { command: "legacy-mcp" },
    },
  };

  const infos = listExternalMcpServerInfos(config);
  assert.deepEqual(infos.map((item) => item.name), ["legacy"]);
  assert.equal(infos[0]?.transport, "stdio");
});

test("allows tools from configured external MCP server names", () => {
  const config = { mcpServers: { figma: { type: "http", url: "https://mcp.figma.com/mcp" } } };

  assert.equal(isConfiguredExternalMcpTool("mcp__figma__get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("figma__get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("figma:get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("other:get_code", config), false);
});

```

# test/electron/figma-official-plugin.test.ts

> 模块：`test` · 语言：`typescript` · 行数：248

## 文件职责

测试Figma官方插件配置构建函数，包括MCP远程/桌面配置、运行时配置合并、插件状态检测（未配置/已配置/配置错误）、OAuth回调数据脱敏、桌面模式切换

## 关键符号

- `buildFigmaOfficialMcpConfig@0 - 构建官方Figma MCP配置，支持Bearer token认证头`
- `buildFigmaDesktopMcpConfig@0 - 构建本地桌面MCP配置，指向127.0.0.1:3845`
- `getFigmaOfficialPluginStatusFromConfig@0 - 检测插件状态：not-configured/configured/misconfigured`
- `isFigmaMcpOAuthCallbackPrompt@0 - 检测是否是OAuth回调提示`
- `redactFigmaMcpOAuthCallbackPrompt@0 - 脱敏OAuth回调中的敏感数据`

## 依赖输入

- `node:assert/strict`
- `node:fs`
- `node:test`
- `../../src/electron/libs/figma-official-plugin.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildFigmaDesktopMcpConfig,
  buildFigmaOfficialMcpConfig,
  buildFigmaOfficialPluginConfig,
  buildNextFigmaOfficialCodexAuthRuntimeConfig,
  buildNextFigmaOfficialDesktopRuntimeConfig,
  buildNextFigmaOfficialAuthStateRuntimeConfig,
  buildNextFigmaOfficialRuntimeConfig,
  getFigmaOfficialPluginStatusFromConfig,
  isFigmaMcpOAuthCallbackPrompt,
  parseFigmaCodexOAuthCredentialStore,
  redactFigmaMcpOAuthCallbackPrompt,
  shouldPreserveReadyFigmaOfficialConfigAfterCodexError,
} from "../../src/electron/libs/figma-official-plugin.js";

test("builds official Figma remote MCP config", () => {
  assert.deepEqual(buildFigmaOfficialMcpConfig(), {
    type: "http",
    url: "https://mcp.figma.com/mcp",
    enabled: true,
  });

  assert.deepEqual(buildFigmaOfficialMcpConfig("figma-token"), {
    type: "http",
    url: "https://mcp.figma.com/mcp",
    enabled: true,
    headers: {
      Authorization: "Bearer figma-token",
    },
  });
});

test("builds official Figma desktop MCP config", () => {
  assert.deepEqual(buildFigmaDesktopMcpConfig(), {
    type: "http",
    url: "http://127.0.0.1:3845/mcp",
    enabled: true,
  });
});

test("preserves unrelated runtime config when adding Figma", () => {
  const next = buildNextFigmaOfficialRuntimeConfig({
    plugins: { "open-computer-use": { id: "open-computer-use" } },
    mcpServers: { "open-computer-use": { type: "stdio", command: "open-computer-use" } },
    other: true,
  }, 1000);

  assert.equal((next.plugins as Record<string, unknown>)["open-computer-use"] != null, true);
  assert.equal((next.mcpServers as Record<string, unknown>)["open-computer-use"] != null, true);
  assert.equal(next.other, true);
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaOfficialMcpConfig());
});

test("detects missing, configured, and misconfigured Figma plugin status", () => {
  assert.equal(getFigmaOfficialPluginStatusFromConfig({}).status, "not-configured");

  const configured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(configured).status, "configured");

  const misconfigured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: { type: "stdio", command: "figma" } },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(misconfigured).status, "misconfigured");
});

test("can switch Figma plugin to desktop MCP mode", () => {
  const next = buildNextFigmaOfficialDesktopRuntimeConfig({
    plugins: { "open-computer-use": { id: "open-computer-use" } },
    mcpServers: { "open-computer-use": { type: "stdio", command: "open-computer-use" } },
  }, {
    available: true,
    now: 3000,
  });

  const figmaPlugin = (next.plugins as Record<string, Record<string, unknown>>)["figma-official"];
  assert.equal(figmaPlugin.mode, "desktop");
  assert.equal(figmaPlugin.connected, true);
  assert.equal(figmaPlugin.authStatus, "ready");
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaDesktopMcpConfig());

  const status = getFigmaOfficialPluginStatusFromConfig(next);
  assert.equal(status.mode, "desktop");
  assert.equal(status.status, "ready");
  assert.equal(status.connected, true);
});

test("marks desktop MCP unavailable when the local server is not detected", () => {
  const next = buildNextFigmaOfficialDesktopRuntimeConfig({}, {
    available: false,
    error: "connection refused",
    now: 3000,
  });

  const status = getFigmaOfficialPluginStatusFromConfig(next);
  assert.equal(status.mode, "desktop");
  assert.equal(status.status, "desktop-unavailable");
  assert.equal(status.connected, false);
  assert.match(status.authHint ?? "", /Figma 桌面版/);
});

test("detects Figma auth expiry hints without marking config broken", () => {
  const status = getFigmaOfficialPluginStatusFromConfig({
    plugins: {
      "figma-official": {
        ...buildFigmaOfficialPluginConfig(1000),
        authStatus: "auth-expired",
        l
... (truncated)
```

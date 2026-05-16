# test/electron/claude-code-plugins.test.ts

> 模块：`test` · 语言：`typescript` · 行数：91

## 文件职责

测试Claude Code SDK插件解析，验证installed_plugins.json读取、settings.json enabledPlugins过滤、.mcp.json MCP服务器提取、工具名格式验证

## 关键符号

- `resolveEnabledClaudeCodeSdkPlugins@0 - 解析已启用的Claude Code SDK本地插件`
- `isClaudeCodePluginMcpTool@0 - 检查工具名是否为Claude Code插件MCP工具`

## 依赖输入

- `node:assert/strict`
- `node:fs`
- `node:os`
- `node:path`
- `node:test`
- `../../src/electron/libs/claude-code-plugins.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CLAUDE_FIGMA_PLUGIN_ID,
  isClaudeCodePluginMcpTool,
  listClaudeCodePluginMcpServerNames,
  resolveEnabledClaudeCodeSdkPlugins,
} from "../../src/electron/libs/claude-code-plugins.js";

test("resolves enabled Claude Code plugins as SDK local plugins", () => {
  const claudeRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-claude-plugin-"));
  const pluginPath = join(claudeRoot, "plugins", "cache", "claude-plugins-official", "figma", "2.1.30");
  const agentBridgePath = join(claudeRoot, "plugins", "cache", "agentbridge", "agentbridge", "0.1.0");
  mkdirSync(join(pluginPath, ".claude-plugin"), { recursive: true });
  mkdirSync(join(agentBridgePath, ".claude-plugin"), { recursive: true });
  writeFileSync(join(pluginPath, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "figma" }));
  writeFileSync(join(agentBridgePath, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "agentbridge" }));
  writeFileSync(join(pluginPath, ".mcp.json"), JSON.stringify({
    mcpServers: {
      figma: {
        type: "http",
        url: "https://mcp.figma.com/mcp",
      },
    },
  }));
  mkdirSync(join(claudeRoot, "plugins"), { recursive: true });
  writeFileSync(join(claudeRoot, "plugins", "installed_plugins.json"), JSON.stringify({
    version: 2,
    plugins: {
      [CLAUDE_FIGMA_PLUGIN_ID]: [{
        scope: "user",
        installPath: pluginPath,
        version: "2.1.30",
      }],
      "agentbridge@agentbridge": [{
        scope: "user",
        installPath: agentBridgePath,
        version: "0.1.0",
      }],
    },
  }));
  writeFileSync(join(claudeRoot, "settings.json"), JSON.stringify({
    enabledPlugins: {
      [CLAUDE_FIGMA_PLUGIN_ID]: true,
      "agentbridge@agentbridge": true,
    },
  }));

  const plugins = resolveEnabledClaudeCodeSdkPlugins({ claudeRoot });
  assert.deepEqual(plugins, [
    { type: "local", path: pluginPath },
    { type: "local", path: agentBridgePath },
  ]);
  assert.deepEqual(listClaudeCodePluginMcpServerNames(plugins), ["figma"]);
  assert.equal(isClaudeCodePluginMcpTool("mcp__figma__get_design_context", ["figma"]), true);
  assert.equal(isClaudeCodePluginMcpTool("figma:get_design_context", ["figma"]), true);
  assert.equal(isClaudeCodePluginMcpTool("mcp__other__get_design_context", ["figma"]), false);

  assert.deepEqual(resolveEnabledClaudeCodeSdkPlugins({
    claudeRoot,
    pluginIds: [CLAUDE_FIGMA_PLUGIN_ID],
  }), [{ type: "local", path: pluginPath }]);
});

test("skips the Claude Code Figma plugin when it is disabled", () => {
  const claudeRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-claude-plugin-disabled-"));
  const pluginPath = join(claudeRoot, "plugins", "cache", "claude-plugins-official", "figma", "2.1.30");
  mkdirSync(join(pluginPath, ".claude-plugin"), { recursive: true });
  writeFileSync(join(pluginPath, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "figma" }));
  mkdirSync(join(claudeRoot, "plugins"), { recursive: true });
  writeFileSync(join(claudeRoot, "plugins", "installed_plugins.json"), JSON.stringify({
    version: 2,
    plugins: {
      [CLAUDE_FIGMA_PLUGIN_ID]: [{
        installPath: pluginPath,
      }],
    },
  }));
  writeFileSync(join(claudeRoot, "settings.json"), JSON.stringify({
    enabledPlugins: {
      [CLAUDE_FIGMA_PLUGIN_ID]: false,
    },
  }));

  assert.deepEqual(resolveEnabledClaudeCodeSdkPlugins({ claudeRoot }), []);
});

```

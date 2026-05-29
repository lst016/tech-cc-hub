import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CLAUDE_FIGMA_PLUGIN_ID,
  isClaudeCodePluginMcpTool,
  listClaudeCodePluginMcpServerNames,
  resolveClaudeCodePluginDetails,
  resolveEnabledClaudeCodeSdkPlugins,
} from "../../src/electron/libs/claude/claude-code-plugins.js";

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

test("resolves Claude Code plugin details with operational metadata", () => {
  const claudeRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-claude-plugin-details-"));
  const pluginPath = join(claudeRoot, "plugins", "cache", "claude-plugins-official", "figma", "2.1.31");
  const disabledPluginPath = join(claudeRoot, "plugins", "cache", "agentbridge", "agentbridge", "0.1.0");
  mkdirSync(join(pluginPath, ".claude-plugin"), { recursive: true });
  mkdirSync(join(disabledPluginPath, ".claude-plugin"), { recursive: true });
  writeFileSync(join(pluginPath, ".claude-plugin", "plugin.json"), JSON.stringify({
    name: "figma",
    source: "remote",
    auth: { mode: "oauth" },
    tools: [{ name: "get_design_context" }, "get_screenshot"],
    lspServers: [{ name: "typescript" }],
    projectedTokenImpact: "medium",
  }));
  writeFileSync(join(disabledPluginPath, ".claude-plugin", "plugin.json"), JSON.stringify({
    name: "agentbridge",
    source: "local",
  }));
  writeFileSync(join(pluginPath, ".mcp.json"), JSON.stringify({
    mcpServers: {
      figma: {
        type: "http",
        url: "https://mcp.figma.com/mcp",
        tools: ["get_figjam"],
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
        version: "2.1.31",
      }],
      "agentbridge@agentbridge": [{
        scope: "user",
        installPath: disabledPluginPath,
        version: "0.1.0",
      }],
    },
  }));
  writeFileSync(join(claudeRoot, "settings.json"), JSON.stringify({
    enabledPlugins: {
      [CLAUDE_FIGMA_PLUGIN_ID]: true,
      "agentbridge@agentbridge": false,
    },
  }));

  assert.deepEqual(resolveClaudeCodePluginDetails({ claudeRoot }), [
    {
      id: "agentbridge@agentbridge",
      name: "agentbridge",
      source: "local",
      version: "0.1.0",
      status: "disabled",
      authMode: undefined,
      mcpServers: [],
      lspServers: [],
      toolNames: [],
      projectedTokenImpact: undefined,
      installPath: disabledPluginPath,
    },
    {
      id: CLAUDE_FIGMA_PLUGIN_ID,
      name: "figma",
      source: "remote",
      version: "2.1.31",
      status: "enabled",
      authMode: "oauth",
      mcpServers: ["figma"],
      lspServers: ["typescript"],
      toolNames: ["get_design_context", "get_screenshot", "get_figjam"],
      projectedTokenImpact: "medium",
      installPath: pluginPath,
    },
  ]);
});

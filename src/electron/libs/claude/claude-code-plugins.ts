import type { SdkPluginConfig } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const CLAUDE_FIGMA_PLUGIN_ID = "figma@claude-plugins-official";

type InstalledPluginEntry = {
  installPath?: unknown;
};

type InstalledPluginsStore = {
  plugins?: Record<string, InstalledPluginEntry[]>;
};

type ClaudePluginSettings = {
  enabledPlugins?: Record<string, boolean>;
};

export function resolveEnabledClaudeCodeSdkPlugins(options: {
  claudeRoot?: string;
  pluginIds?: string[];
} = {}): SdkPluginConfig[] {
  const claudeRoot = options.claudeRoot ?? join(homedir(), ".claude");
  const installedPlugins = readInstalledPlugins(claudeRoot);
  const enabledPlugins = readEnabledPlugins(claudeRoot);
  const pluginIds = options.pluginIds ?? Object.keys(installedPlugins.plugins ?? {});
  const configs: SdkPluginConfig[] = [];
  const seenPaths = new Set<string>();

  for (const pluginId of pluginIds) {
    if (enabledPlugins[pluginId] === false) {
      continue;
    }

    const installPath = resolveInstalledPluginPath(installedPlugins, pluginId);
    if (!installPath || seenPaths.has(installPath) || !isLoadableClaudeCodePlugin(installPath)) {
      continue;
    }

    configs.push({ type: "local", path: installPath });
    seenPaths.add(installPath);
  }

  return configs;
}

export function listClaudeCodePluginMcpServerNames(plugins: SdkPluginConfig[]): string[] {
  const names = new Set<string>();

  for (const plugin of plugins) {
    const mcpConfig = readJson(join(plugin.path, ".mcp.json"));
    if (!isRecord(mcpConfig) || !isRecord(mcpConfig.mcpServers)) {
      continue;
    }

    for (const name of Object.keys(mcpConfig.mcpServers)) {
      const normalized = name.trim();
      if (normalized) {
        names.add(normalized);
      }
    }
  }

  return Array.from(names);
}

export function isClaudeCodePluginMcpTool(toolName: string, serverNames: Iterable<string>): boolean {
  for (const serverName of serverNames) {
    if (
      toolName.startsWith(`mcp__${serverName}__`) ||
      toolName.startsWith(`${serverName}__`) ||
      toolName.startsWith(`${serverName}:`) ||
      toolName.startsWith(`${serverName}/`)
    ) {
      return true;
    }
  }

  return false;
}

function readInstalledPlugins(claudeRoot: string): InstalledPluginsStore {
  const parsed = readJson(join(claudeRoot, "plugins", "installed_plugins.json"));
  if (!isRecord(parsed) || !isRecord(parsed.plugins)) {
    return {};
  }

  const plugins: Record<string, InstalledPluginEntry[]> = {};
  for (const [pluginId, entries] of Object.entries(parsed.plugins)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    plugins[pluginId] = entries.filter(isRecord);
  }

  return { plugins };
}

function readEnabledPlugins(claudeRoot: string): Record<string, boolean> {
  const enabled: Record<string, boolean> = {};
  for (const fileName of ["settings.json", "settings.local.json"]) {
    const parsed = readJson(join(claudeRoot, fileName));
    if (!isRecord(parsed) || !isRecord((parsed as ClaudePluginSettings).enabledPlugins)) {
      continue;
    }

    for (const [pluginId, value] of Object.entries((parsed as ClaudePluginSettings).enabledPlugins ?? {})) {
      if (typeof value === "boolean") {
        enabled[pluginId] = value;
      }
    }
  }

  return enabled;
}

function resolveInstalledPluginPath(store: InstalledPluginsStore, pluginId: string): string | null {
  const entries = store.plugins?.[pluginId] ?? [];
  for (const entry of entries) {
    if (typeof entry.installPath === "string" && entry.installPath.trim() && existsSync(entry.installPath)) {
      return entry.installPath;
    }
  }

  return null;
}

function isLoadableClaudeCodePlugin(installPath: string): boolean {
  return existsSync(join(installPath, ".claude-plugin", "plugin.json")) || existsSync(join(installPath, ".mcp.json"));
}

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

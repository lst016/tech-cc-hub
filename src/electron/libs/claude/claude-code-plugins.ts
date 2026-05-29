import type { SdkPluginConfig } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const CLAUDE_FIGMA_PLUGIN_ID = "figma@claude-plugins-official";

export type ClaudeCodePluginSource = "local" | "remote" | "unknown";
export type ClaudeCodePluginStatus = "enabled" | "disabled" | "broken" | "unknown";

export type ClaudeCodePluginDetail = {
  id: string;
  name: string;
  source: ClaudeCodePluginSource;
  version?: string;
  status: ClaudeCodePluginStatus;
  authMode?: string;
  mcpServers: string[];
  lspServers: string[];
  toolNames: string[];
  projectedTokenImpact?: string;
  installPath?: string;
};

type InstalledPluginEntry = {
  installPath?: unknown;
  source?: unknown;
  version?: unknown;
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

export function resolveClaudeCodePluginDetails(options: {
  claudeRoot?: string;
  pluginIds?: string[];
} = {}): ClaudeCodePluginDetail[] {
  const claudeRoot = options.claudeRoot ?? join(homedir(), ".claude");
  const installedPlugins = readInstalledPlugins(claudeRoot);
  const enabledPlugins = readEnabledPlugins(claudeRoot);
  const pluginIds = (options.pluginIds ?? Object.keys(installedPlugins.plugins ?? {})).toSorted((left, right) => left.localeCompare(right));

  return pluginIds.map((pluginId) => {
    const entries = installedPlugins.plugins?.[pluginId] ?? [];
    const entry = resolveInstalledPluginEntry(entries);
    const rawInstallPath = readString(entry?.installPath);
    const installPath = rawInstallPath && existsSync(rawInstallPath) ? rawInstallPath : undefined;
    const pluginManifest = installPath ? readRecordJson(join(installPath, ".claude-plugin", "plugin.json")) : null;
    const packageManifest = installPath ? readRecordJson(join(installPath, "package.json")) : null;
    const mcpConfig = installPath ? readRecordJson(join(installPath, ".mcp.json")) : null;
    const loadable = Boolean(installPath && isLoadableClaudeCodePlugin(installPath));
    const status: ClaudeCodePluginStatus = enabledPlugins[pluginId] === false
      ? "disabled"
      : loadable
        ? "enabled"
        : entries.length > 0 ? "broken" : "unknown";

    return {
      id: pluginId,
      name: readString(pluginManifest?.name) ?? pluginId.split("@")[0] ?? pluginId,
      source: normalizePluginSource(readSourceValue(entry?.source) ?? readSourceValue(pluginManifest?.source), installPath),
      version: readString(entry?.version) ?? readString(pluginManifest?.version) ?? readString(packageManifest?.version),
      status,
      authMode: readAuthMode(pluginManifest, mcpConfig),
      mcpServers: readMcpServerNames(mcpConfig),
      lspServers: uniqueStrings([
        ...readNameCollection(pluginManifest?.lspServers),
        ...readNameCollection(pluginManifest?.languageServers),
        ...readNameCollection(mcpConfig?.lspServers),
        ...readNameCollection(mcpConfig?.languageServers),
      ]),
      toolNames: readPluginToolNames(pluginManifest, mcpConfig),
      projectedTokenImpact: readString(pluginManifest?.projectedTokenImpact)
        ?? readString(pluginManifest?.tokenImpact)
        ?? readString(pluginManifest?.contextTokenImpact),
      installPath,
    };
  });
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

function resolveInstalledPluginEntry(entries: InstalledPluginEntry[]): InstalledPluginEntry | undefined {
  return entries.find((entry) => {
    const installPath = readString(entry.installPath);
    return Boolean(installPath && existsSync(installPath));
  }) ?? entries[0];
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

function readRecordJson(path: string): Record<string, unknown> | null {
  const value = readJson(path);
  return isRecord(value) ? value : null;
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSourceValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value)) {
    return readString(value.type) ?? readString(value.kind) ?? readString(value.provider);
  }
  return undefined;
}

function normalizePluginSource(value: string | undefined, installPath: string | undefined): ClaudeCodePluginSource {
  if (value && /^remote|registry|marketplace|github|official$/i.test(value)) {
    return "remote";
  }
  if (value && /^local|path|file$/i.test(value)) {
    return "local";
  }
  return installPath ? "local" : "unknown";
}

function readAuthMode(pluginManifest: Record<string, unknown> | null, mcpConfig: Record<string, unknown> | null): string | undefined {
  const manifestAuth = isRecord(pluginManifest?.auth) ? pluginManifest.auth : null;
  const directAuth = readString(pluginManifest?.authMode)
    ?? readString(manifestAuth?.mode)
    ?? readString(manifestAuth?.type)
    ?? readString(manifestAuth?.provider);
  if (directAuth) {
    return directAuth;
  }

  const mcpServers = isRecord(mcpConfig?.mcpServers) ? mcpConfig.mcpServers : {};
  for (const server of Object.values(mcpServers)) {
    if (!isRecord(server)) continue;
    const serverAuth = isRecord(server.auth) ? server.auth : null;
    const authMode = readString(server.authMode)
      ?? readString(serverAuth?.mode)
      ?? readString(serverAuth?.type)
      ?? readString(serverAuth?.provider);
    if (authMode) {
      return authMode;
    }
  }

  return undefined;
}

function readMcpServerNames(mcpConfig: Record<string, unknown> | null): string[] {
  if (!isRecord(mcpConfig?.mcpServers)) {
    return [];
  }
  return uniqueStrings(Object.keys(mcpConfig.mcpServers));
}

function readPluginToolNames(pluginManifest: Record<string, unknown> | null, mcpConfig: Record<string, unknown> | null): string[] {
  const names = [
    ...readNameCollection(pluginManifest?.tools),
    ...readNameCollection(pluginManifest?.toolNames),
    ...readNameCollection(mcpConfig?.tools),
    ...readNameCollection(mcpConfig?.toolNames),
  ];

  const mcpServers = isRecord(mcpConfig?.mcpServers) ? mcpConfig.mcpServers : {};
  for (const server of Object.values(mcpServers)) {
    if (!isRecord(server)) continue;
    names.push(...readNameCollection(server.tools));
    names.push(...readNameCollection(server.toolNames));
  }

  return uniqueStrings(names);
}

function readNameCollection(value: unknown): string[] {
  if (typeof value === "string") {
    return [value.trim()].filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") {
        return item.trim() ? [item.trim()] : [];
      }
      if (!isRecord(item)) {
        return [];
      }
      const name = readString(item.name) ?? readString(item.id) ?? readString(item.tool);
      return name ? [name] : [];
    });
  }
  if (isRecord(value)) {
    return Object.keys(value).filter((key) => key.trim());
  }
  return [];
}

function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      seen.add(normalized);
    }
  }
  return Array.from(seen);
}

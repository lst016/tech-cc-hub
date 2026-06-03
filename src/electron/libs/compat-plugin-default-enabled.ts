// src/electron/libs/compat-plugin-default-enabled.ts
// -----------------------------------------------------------------------------
// Phase 7 of the Claude Code 2.1.161 compatibility workflow.
// Plugin defaultEnabled + dependency + duplicate MCP/tool detection. The full
// plugin UI wiring is deferred; this module is the pure-data layer the
// settings page (or any test) can consume.
// -----------------------------------------------------------------------------

export type PluginEnableState = "enabled" | "disabled" | "default-disabled" | "auto-from-dep";

export type PluginManifest = {
  name: string;
  version?: string;
  defaultEnabled: boolean;
  mcpServers: string[];
  toolNames: string[];
  dependencies: string[];
};

export type PluginDuplicate = {
  kind: "mcp-server" | "tool";
  name: string;
  plugins: string[];
};

// Parse a plugin.json manifest with defaultEnabled + dependencies. Tolerant:
// missing fields fall back to safe defaults (defaultEnabled = true,
// dependencies = []).
export function parsePluginManifest(input: unknown): PluginManifest | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name) return null;
  return {
    name: obj.name,
    version: typeof obj.version === "string" ? obj.version : undefined,
    defaultEnabled: obj.defaultEnabled === false ? false : true,
    mcpServers: asStringArray(obj.mcpServers),
    toolNames: asStringArray(obj.toolNames),
    dependencies: asStringArray(obj.dependencies),
  };
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is string => typeof v === "string" && v.length > 0);
}

// Decide the effective enable state of a plugin given which other plugins
// are currently enabled. Dependencies that are already enabled count as
// "auto from dep"; defaultEnabled = false means default-disabled unless
// pulled in by a dependency.
export function resolvePluginEnableState(plugin: PluginManifest, enabledPluginNames: Set<string>): PluginEnableState {
  if (enabledPluginNames.has(plugin.name)) return "enabled";
  if (plugin.defaultEnabled) return "enabled";
  if (plugin.dependencies.some((d) => enabledPluginNames.has(d))) return "auto-from-dep";
  return "default-disabled";
}

// Find duplicate MCP server or tool names across multiple plugins. Used by
// the settings page to flag collisions that would otherwise silently override
// each other at runtime.
export function findPluginDuplicates(plugins: PluginManifest[]): PluginDuplicate[] {
  const serverOwners = new Map<string, string[]>();
  const toolOwners = new Map<string, string[]>();
  for (const p of plugins) {
    for (const s of p.mcpServers) {
      const list = serverOwners.get(s) ?? [];
      list.push(p.name);
      serverOwners.set(s, list);
    }
    for (const t of p.toolNames) {
      const list = toolOwners.get(t) ?? [];
      list.push(p.name);
      toolOwners.set(t, list);
    }
  }
  const out: PluginDuplicate[] = [];
  for (const [name, owners] of serverOwners) {
    if (owners.length > 1) out.push({ kind: "mcp-server", name, plugins: [...new Set(owners)].sort() });
  }
  for (const [name, owners] of toolOwners) {
    if (owners.length > 1) out.push({ kind: "tool", name, plugins: [...new Set(owners)].sort() });
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

// Decide which dependencies of an enabled plugin should be auto-enabled.
// Only dependencies that are already in the registry count; missing
// dependencies are surfaced as "needs install" but not silently enabled.
export function recommendAutoEnableDependencies(plugin: PluginManifest, allPlugins: PluginManifest[]): {
  enable: string[];
  needsInstall: string[];
} {
  const known = new Set(allPlugins.map((p) => p.name));
  const enable: string[] = [];
  const needsInstall: string[] = [];
  for (const dep of plugin.dependencies) {
    if (known.has(dep)) enable.push(dep);
    else needsInstall.push(dep);
  }
  return { enable: enable.sort(), needsInstall: needsInstall.sort() };
}

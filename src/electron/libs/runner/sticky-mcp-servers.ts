import type { BuiltinMcpServerName } from "../../../shared/builtin-mcp-registry.js";
import type { RuntimeEfficiencyProfile } from "../runtime-efficiency.js";

export const STATEFUL_BUILTIN_MCP_SERVER_NAMES: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
];

const STATEFUL_BUILTIN_MCP_SERVER_NAME_SET = new Set<BuiltinMcpServerName>(
  STATEFUL_BUILTIN_MCP_SERVER_NAMES,
);

export function isStatefulBuiltinMcpServerName(value: string | null | undefined): value is BuiltinMcpServerName {
  return STATEFUL_BUILTIN_MCP_SERVER_NAME_SET.has(value as BuiltinMcpServerName);
}

export function mergeStickyBuiltinMcpServerNames(
  nextServerNames: readonly BuiltinMcpServerName[],
  previousServerNameSets: readonly ReadonlySet<BuiltinMcpServerName>[],
): BuiltinMcpServerName[] {
  const merged = new Set(nextServerNames);
  for (const previousServerNames of previousServerNameSets) {
    for (const serverName of previousServerNames) {
      if (isStatefulBuiltinMcpServerName(serverName)) {
        merged.add(serverName);
      }
    }
  }
  return [...merged];
}

export function applyStickyBuiltinMcpServersToProfile(
  profile: RuntimeEfficiencyProfile,
  previousServerNameSets: readonly ReadonlySet<BuiltinMcpServerName>[],
): RuntimeEfficiencyProfile {
  const builtinMcpServers = mergeStickyBuiltinMcpServerNames(
    profile.builtinMcpServers,
    previousServerNameSets,
  );
  if (builtinMcpServers.length === profile.builtinMcpServers.length) {
    return profile;
  }

  const hasBrowserTools = builtinMcpServers.includes("tech-cc-hub-browser");
  const hasDesignTools = builtinMcpServers.includes("tech-cc-hub-design");
  const hasFigmaTools = builtinMcpServers.includes("tech-cc-hub-figma");

  return {
    ...profile,
    builtinMcpServers,
    includeBrowserPrompt: profile.includeBrowserPrompt || hasBrowserTools,
    includeDesignPrompt: profile.includeDesignPrompt || hasDesignTools || hasFigmaTools,
    includeClaudeCompatPrompt: profile.includeClaudeCompatPrompt || hasDesignTools || hasFigmaTools,
    includePartialMessages: profile.includePartialMessages || hasBrowserTools || hasDesignTools,
  };
}

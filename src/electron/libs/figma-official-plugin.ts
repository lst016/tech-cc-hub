export const FIGMA_OFFICIAL_PLUGIN_ID = "figma-official";
export const FIGMA_MCP_SERVER_NAME = "figma";
export const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";

export type FigmaOfficialPluginStatusKind =
  | "not-configured"
  | "configured"
  | "needs-auth"
  | "auth-expired"
  | "misconfigured"
  | "ready";

export type FigmaOfficialPluginStatus = {
  id: typeof FIGMA_OFFICIAL_PLUGIN_ID;
  installed: boolean;
  connected: boolean;
  status: FigmaOfficialPluginStatusKind;
  message: string;
  authHint?: string;
  url: string;
  capabilities: string[];
  updatedAt?: number;
};

export type FigmaOfficialPluginActionResult = FigmaOfficialPluginStatus & {
  success: boolean;
};

export function buildFigmaOfficialPluginConfig(now = Date.now()): Record<string, unknown> {
  return {
    id: FIGMA_OFFICIAL_PLUGIN_ID,
    name: "Figma 官方 MCP",
    kind: "mcp-plugin",
    source: {
      type: "remote-mcp",
      url: FIGMA_MCP_URL,
    },
    enabled: true,
    installed: true,
    connected: false,
    capabilities: ["design-context"],
    authStatus: "unknown",
    lastAuthCheckedAt: null,
    lastAuthError: null,
    updatedAt: now,
  };
}

export function buildFigmaOfficialMcpConfig(): Record<string, unknown> {
  return {
    type: "http",
    url: FIGMA_MCP_URL,
    enabled: true,
  };
}

export function buildNextFigmaOfficialRuntimeConfig(config: unknown, now = Date.now()): Record<string, unknown> {
  const current = isRecord(config) ? config : {};
  const plugins = isRecord(current.plugins) ? current.plugins : {};
  const mcpServers = isRecord(current.mcpServers) ? current.mcpServers : {};

  return {
    ...current,
    plugins: {
      ...plugins,
      [FIGMA_OFFICIAL_PLUGIN_ID]: buildFigmaOfficialPluginConfig(now),
    },
    mcpServers: {
      ...mcpServers,
      [FIGMA_MCP_SERVER_NAME]: buildFigmaOfficialMcpConfig(),
    },
  };
}

export function getFigmaOfficialPluginStatusFromConfig(config: unknown): FigmaOfficialPluginStatus {
  const current = isRecord(config) ? config : {};
  const plugins = isRecord(current.plugins) ? current.plugins : {};
  const mcpServers = isRecord(current.mcpServers) ? current.mcpServers : {};
  const pluginConfig = isRecord(plugins[FIGMA_OFFICIAL_PLUGIN_ID]) ? plugins[FIGMA_OFFICIAL_PLUGIN_ID] : null;
  const mcpConfig = isRecord(mcpServers[FIGMA_MCP_SERVER_NAME]) ? mcpServers[FIGMA_MCP_SERVER_NAME] : null;

  if (!pluginConfig && !mcpConfig) {
    return buildStatus("not-configured", {
      installed: false,
      connected: false,
      message: "尚未接入 Figma 官方 MCP。",
    });
  }

  if (!isExpectedFigmaMcpConfig(mcpConfig)) {
    return buildStatus("misconfigured", {
      installed: Boolean(pluginConfig),
      connected: false,
      message: "Figma 官方 MCP 配置异常，可一键修复为官方远程 HTTP MCP。",
    });
  }

  const authStatus = typeof pluginConfig?.authStatus === "string" ? pluginConfig.authStatus : "";
  const lastAuthError = typeof pluginConfig?.lastAuthError === "string" ? pluginConfig.lastAuthError : "";
  const updatedAt = typeof pluginConfig?.updatedAt === "number" ? pluginConfig.updatedAt : undefined;

  if (authStatus === "auth-expired" || isLikelyFigmaAuthError(lastAuthError)) {
    return buildStatus("auth-expired", {
      installed: true,
      connected: false,
      message: "Figma 授权可能已过期。",
      authHint: "Figma 授权可能已过期，请通过 Figma MCP 的 OAuth 流程重新授权。",
      updatedAt,
    });
  }

  if (authStatus === "needs-auth") {
    return buildStatus("needs-auth", {
      installed: true,
      connected: false,
      message: "Figma MCP 已配置，首次使用时需要完成 OAuth 授权。",
      authHint: "首次使用 Figma MCP 工具时，请按 OAuth 流程授权 Figma。",
      updatedAt,
    });
  }

  if (pluginConfig?.connected === true || authStatus === "ready") {
    return buildStatus("ready", {
      installed: true,
      connected: true,
      message: "Figma 官方 MCP 已接入。",
      updatedAt,
    });
  }

  return buildStatus("configured", {
    installed: true,
    connected: false,
    message: "Figma 官方 MCP 已配置；如果首次使用或授权过期，需要通过 OAuth 重新授权。",
    authHint: "Figma 授权有时效，失效后需要重新授权。",
    updatedAt,
  });
}

export function buildFigmaOfficialActionResult(config: unknown): FigmaOfficialPluginActionResult {
  return {
    ...getFigmaOfficialPluginStatusFromConfig(config),
    success: true,
    message: "Figma 官方 MCP 配置已写入；首次使用时可能需要完成 OAuth 授权。",
  };
}

function buildStatus(
  status: FigmaOfficialPluginStatusKind,
  overrides: Pick<FigmaOfficialPluginStatus, "installed" | "connected" | "message"> & Partial<FigmaOfficialPluginStatus>,
): FigmaOfficialPluginStatus {
  return {
    id: FIGMA_OFFICIAL_PLUGIN_ID,
    status,
    url: FIGMA_MCP_URL,
    capabilities: ["design-context"],
    ...overrides,
  };
}

function isExpectedFigmaMcpConfig(value: Record<string, unknown> | null): boolean {
  return Boolean(
    value &&
    value.enabled !== false &&
    value.type === "http" &&
    value.url === FIGMA_MCP_URL
  );
}

function isLikelyFigmaAuthError(message: string): boolean {
  return /figma|401|403|auth|authorize|unauthorized|expired|token|oauth|permission/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

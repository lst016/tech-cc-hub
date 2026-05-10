export const FIGMA_OFFICIAL_PLUGIN_ID = "figma-official";
export const FIGMA_MCP_SERVER_NAME = "figma";
export const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
export const FIGMA_DESKTOP_MCP_URL = "http://127.0.0.1:3845/mcp";

export type FigmaOfficialConnectionMode = "remote" | "desktop";
export type FigmaOfficialOAuthProvider = "direct" | "codex";

export type FigmaOfficialPluginStatusKind =
  | "not-configured"
  | "configured"
  | "needs-auth"
  | "auth-expired"
  | "desktop-unavailable"
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
  desktopUrl: string;
  mode: FigmaOfficialConnectionMode;
  authProvider?: FigmaOfficialOAuthProvider;
  capabilities: string[];
  tools?: string[];
  toolCount?: number;
  lastToolCheckedAt?: number;
  updatedAt?: number;
};

export type FigmaOfficialPluginActionResult = FigmaOfficialPluginStatus & {
  success: boolean;
};

export type FigmaOfficialAuthState = "needs-auth" | "auth-expired" | "ready";

export type FigmaOfficialOAuthTokens = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  expiresAt?: number;
  provider?: FigmaOfficialOAuthProvider;
  client_id?: string;
};

export function buildFigmaOfficialPluginConfig(
  now = Date.now(),
  mode: FigmaOfficialConnectionMode = "remote",
): Record<string, unknown> {
  return {
    id: FIGMA_OFFICIAL_PLUGIN_ID,
    name: "Figma 官方 MCP",
    kind: "mcp-plugin",
    source: {
      type: mode === "desktop" ? "desktop-mcp" : "remote-mcp",
      url: mode === "desktop" ? FIGMA_DESKTOP_MCP_URL : FIGMA_MCP_URL,
    },
    enabled: true,
    installed: true,
    connected: false,
    mode,
    capabilities: mode === "desktop" ? ["design-context", "selection-context"] : ["design-context"],
    tools: [],
    toolCount: null,
    lastToolCheckedAt: null,
    authStatus: mode === "desktop" ? "desktop-unavailable" : "unknown",
    authProvider: null,
    lastAuthCheckedAt: null,
    lastAuthError: null,
    oauth: null,
    updatedAt: now,
  };
}

export function buildFigmaOfficialMcpConfig(accessToken?: string | null): Record<string, unknown> {
  const config: Record<string, unknown> = {
    type: "http",
    url: FIGMA_MCP_URL,
    enabled: true,
  };
  if (accessToken) {
    config.headers = {
      Authorization: `Bearer ${accessToken}`,
    };
  }
  return config;
}

export function buildFigmaDesktopMcpConfig(): Record<string, unknown> {
  return {
    type: "http",
    url: FIGMA_DESKTOP_MCP_URL,
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

export function buildNextFigmaOfficialDesktopRuntimeConfig(
  config: unknown,
  options: { available?: boolean; error?: string | null; now?: number } = {},
): Record<string, unknown> {
  const now = options.now ?? Date.now();
  const available = options.available === true;
  const current = isRecord(config) ? config : {};
  const plugins = isRecord(current.plugins) ? current.plugins : {};
  const mcpServers = isRecord(current.mcpServers) ? current.mcpServers : {};
  const existingPlugin = isRecord(plugins[FIGMA_OFFICIAL_PLUGIN_ID])
    ? plugins[FIGMA_OFFICIAL_PLUGIN_ID]
    : buildFigmaOfficialPluginConfig(now, "desktop");

  return {
    ...current,
    plugins: {
      ...plugins,
      [FIGMA_OFFICIAL_PLUGIN_ID]: {
        ...existingPlugin,
        source: {
          type: "desktop-mcp",
          url: FIGMA_DESKTOP_MCP_URL,
        },
        enabled: true,
        installed: true,
        connected: available,
        mode: "desktop",
        capabilities: ["design-context", "selection-context"],
        tools: [],
        toolCount: null,
        lastToolCheckedAt: null,
        authStatus: available ? "ready" : "desktop-unavailable",
        authProvider: null,
        oauth: null,
        lastAuthCheckedAt: now,
        lastAuthError: options.error ?? null,
        updatedAt: now,
      },
    },
    mcpServers: {
      ...mcpServers,
      [FIGMA_MCP_SERVER_NAME]: buildFigmaDesktopMcpConfig(),
    },
  };
}

export function buildNextFigmaOfficialAuthStateRuntimeConfig(
  config: unknown,
  state: FigmaOfficialAuthState,
  options: {
    error?: string;
    now?: number;
    oauth?: FigmaOfficialOAuthTokens | null;
    tools?: string[];
    toolCount?: number;
    lastToolCheckedAt?: number;
  } = {},
): Record<string, unknown> {
  const now = options.now ?? Date.now();
  const current = isRecord(config) ? config : {};
  const plugins = isRecord(current.plugins) ? current.plugins : {};
  const mcpServers = isRecord(current.mcpServers) ? current.mcpServers : {};
  const existingPlugin = isRecord(plugins[FIGMA_OFFICIAL_PLUGIN_ID])
    ? plugins[FIGMA_OFFICIAL_PLUGIN_ID]
    : buildFigmaOfficialPluginConfig(now);
  const existingFigmaMcp = isRecord(mcpServers[FIGMA_MCP_SERVER_NAME]) ? mcpServers[FIGMA_MCP_SERVER_NAME] : null;
  const shouldPreserveDesktopMcp = isExpectedFigmaDesktopMcpConfig(existingFigmaMcp) && state !== "ready";
  const oauth = options.oauth === undefined ? existingPlugin.oauth : options.oauth;
  const authProvider = isRecord(oauth) && oauth.provider === "codex" ? "codex" : isRecord(oauth) && oauth.provider === "direct" ? "direct" : null;
  const accessToken = state === "ready" && isRecord(oauth) && typeof oauth.access_token === "string"
    ? oauth.access_token
    : null;
  const nextMode: FigmaOfficialConnectionMode = shouldPreserveDesktopMcp ? "desktop" : "remote";
  const existingTools = readStringArray(existingPlugin.tools);
  const nextTools = state === "ready" && !shouldPreserveDesktopMcp
    ? options.tools ?? existingTools
    : [];
  const existingToolCount = typeof existingPlugin.toolCount === "number" && existingPlugin.toolCount >= 0
    ? existingPlugin.toolCount
    : null;
  const nextToolCount = state === "ready" && !shouldPreserveDesktopMcp
    ? options.toolCount ?? (nextTools.length > 0 ? nextTools.length : existingToolCount)
    : null;
  const existingToolCheckedAt = typeof existingPlugin.lastToolCheckedAt === "number"
    ? existingPlugin.lastToolCheckedAt
    : null;
  const nextToolCheckedAt = state === "ready" && !shouldPreserveDesktopMcp
    ? options.lastToolCheckedAt ?? (options.tools ? now : existingToolCheckedAt)
    : null;

  return {
    ...current,
    plugins: {
      ...plugins,
      [FIGMA_OFFICIAL_PLUGIN_ID]: {
        ...existingPlugin,
        source: {
          type: shouldPreserveDesktopMcp
            ? "desktop-mcp"
            : authProvider === "codex"
              ? "codex-supported-client-oauth"
              : "remote-mcp",
          url: shouldPreserveDesktopMcp ? FIGMA_DESKTOP_MCP_URL : FIGMA_MCP_URL,
        },
        connected: state === "ready",
        mode: nextMode,
        capabilities: nextMode === "desktop" ? ["design-context", "selection-context"] : ["design-context"],
        tools: nextTools,
        toolCount: nextToolCount,
        lastToolCheckedAt: nextToolCheckedAt,
        authStatus: state,
        authProvider: shouldPreserveDesktopMcp ? null : authProvider,
        oauth,
        lastAuthCheckedAt: now,
        lastAuthError: options.error ?? null,
        updatedAt: now,
      },
    },
    mcpServers: {
      ...mcpServers,
      [FIGMA_MCP_SERVER_NAME]: shouldPreserveDesktopMcp
        ? buildFigmaDesktopMcpConfig()
        : buildFigmaOfficialMcpConfig(accessToken),
    },
  };
}

export function buildNextFigmaOfficialCodexAuthRuntimeConfig(
  config: unknown,
  oauth: FigmaOfficialOAuthTokens,
  now = Date.now(),
  tools: string[] = [],
): Record<string, unknown> {
  return buildNextFigmaOfficialAuthStateRuntimeConfig(config, "ready", {
    now,
    tools,
    toolCount: tools.length,
    lastToolCheckedAt: now,
    oauth: {
      ...oauth,
      provider: "codex",
      token_type: oauth.token_type ?? "Bearer",
    },
  });
}

export function parseFigmaCodexOAuthCredentialStore(value: unknown): FigmaOfficialOAuthTokens | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const entry of Object.values(value)) {
    const credential = parseFigmaCodexOAuthCredentialEntry(entry);
    if (credential) {
      return credential;
    }
  }

  return null;
}

export function getFigmaOfficialPluginStatusFromConfig(config: unknown): FigmaOfficialPluginStatus {
  const current = isRecord(config) ? config : {};
  const plugins = isRecord(current.plugins) ? current.plugins : {};
  const mcpServers = isRecord(current.mcpServers) ? current.mcpServers : {};
  const pluginConfig = isRecord(plugins[FIGMA_OFFICIAL_PLUGIN_ID]) ? plugins[FIGMA_OFFICIAL_PLUGIN_ID] : null;
  const mcpConfig = isRecord(mcpServers[FIGMA_MCP_SERVER_NAME]) ? mcpServers[FIGMA_MCP_SERVER_NAME] : null;
  const isRemoteConfig = isExpectedFigmaMcpConfig(mcpConfig);
  const isDesktopConfig = isExpectedFigmaDesktopMcpConfig(mcpConfig);

  if (!pluginConfig && !mcpConfig) {
    return buildStatus("not-configured", {
      installed: false,
      connected: false,
      message: "尚未接入 Figma 官方 MCP。",
    });
  }

  if (!isRemoteConfig && !isDesktopConfig) {
    return buildStatus("misconfigured", {
      installed: Boolean(pluginConfig),
      connected: false,
      message: "Figma 官方 MCP 配置异常，可一键修复为官方远程 HTTP MCP 或切换到桌面 MCP。",
    });
  }

  const mode: FigmaOfficialConnectionMode = isDesktopConfig ? "desktop" : "remote";
  const authStatus = typeof pluginConfig?.authStatus === "string" ? pluginConfig.authStatus : "";
  const lastAuthError = typeof pluginConfig?.lastAuthError === "string" ? pluginConfig.lastAuthError : "";
  const updatedAt = typeof pluginConfig?.updatedAt === "number" ? pluginConfig.updatedAt : undefined;
  const oauth = isRecord(pluginConfig?.oauth) ? pluginConfig.oauth : null;
  const expiresAt = typeof oauth?.expiresAt === "number" ? oauth.expiresAt : null;
  const tools = readStringArray(pluginConfig?.tools);
  const storedToolCount = typeof pluginConfig?.toolCount === "number" && pluginConfig.toolCount >= 0
    ? pluginConfig.toolCount
    : null;
  const toolCount = storedToolCount ?? (tools.length > 0 ? tools.length : undefined);
  const lastToolCheckedAt = typeof pluginConfig?.lastToolCheckedAt === "number" ? pluginConfig.lastToolCheckedAt : undefined;
  const authProvider = pluginConfig?.authProvider === "codex" || pluginConfig?.authProvider === "direct"
    ? pluginConfig.authProvider
    : oauth?.provider === "codex" || oauth?.provider === "direct"
      ? oauth.provider
      : undefined;
  const isExpired = expiresAt !== null && expiresAt <= Date.now() + 60_000;

  if (mode === "desktop") {
    if (authStatus === "desktop-unavailable" || pluginConfig?.connected !== true) {
      return buildStatus("desktop-unavailable", {
        installed: true,
        connected: false,
        mode,
        message: "已切换到 Figma Desktop MCP，但未检测到本地 MCP 服务。",
        authHint: "请打开 Figma 桌面版，进入设计文件的 Dev Mode，并启用 Desktop MCP Server。",
        updatedAt,
      });
    }

    return buildStatus("ready", {
      installed: true,
      connected: true,
      mode,
      message: "Figma Desktop MCP 已接入。",
      updatedAt,
    });
  }

  if (authStatus === "auth-expired" || isLikelyFigmaAuthError(lastAuthError) || isExpired) {
    return buildStatus("auth-expired", {
      installed: true,
      connected: false,
      mode,
      authProvider,
      message: "Figma 授权可能已过期。",
      authHint: authProvider === "codex"
        ? "Codex 官方 OAuth 凭据有时效，过期后请在插件卡片中点击 Codex 重新授权。"
        : "Figma 授权有时效，过期后请在插件卡片中重新授权。",
      updatedAt,
    });
  }

  if (authStatus === "needs-auth") {
    return buildStatus("needs-auth", {
      installed: true,
      connected: false,
      mode,
      authProvider,
      message: "Figma MCP 已配置，首次使用时需要完成 OAuth 授权。",
      authHint: "首次使用 Figma MCP 工具时，请按 OAuth 流程授权 Figma。",
      updatedAt,
    });
  }

  if (pluginConfig?.connected === true || authStatus === "ready") {
    return buildStatus("ready", {
      installed: true,
      connected: true,
      mode,
      authProvider,
      message: expiresAt
        ? `${authProvider === "codex" ? "Figma 官方 MCP 已通过 Codex 官方 OAuth 接入" : "Figma 官方 MCP 已接入"}，授权有效期至 ${new Date(expiresAt).toLocaleString()}。`
        : authProvider === "codex" ? "Figma 官方 MCP 已通过 Codex 官方 OAuth 接入。" : "Figma 官方 MCP 已接入。",
      tools,
      toolCount,
      lastToolCheckedAt,
      updatedAt,
    });
  }

  return buildStatus("configured", {
    installed: true,
    connected: false,
    mode,
    authProvider,
    message: "Figma 官方 MCP 已配置；如果首次使用或授权过期，需要通过 OAuth 重新授权。",
    authHint: "推荐使用 Codex 官方 OAuth 接入；Figma 授权有时效，失效后需要重新授权。",
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

export function shouldPreserveReadyFigmaOfficialConfigAfterCodexError(config: unknown, message: string): boolean {
  const status = getFigmaOfficialPluginStatusFromConfig(config);
  return status.status === "ready" && status.mode === "remote" && !isLikelyFigmaTokenFailureMessage(message);
}

export function isLikelyFigmaTokenFailureMessage(message: string): boolean {
  return /401|403|unauthorized|forbidden|expired|invalid\s+token|token\s+invalid|token\s+expired|过期|无效.*令牌/i.test(message);
}

export function isFigmaMcpOAuthCallbackPrompt(prompt: string): boolean {
  return extractFigmaMcpOAuthCallbackUrl(prompt) !== null;
}

export function redactFigmaMcpOAuthCallbackPrompt(prompt: string): string {
  const callbackUrl = extractFigmaMcpOAuthCallbackUrl(prompt);
  if (!callbackUrl) return prompt;

  const redacted = new URL(callbackUrl.toString());
  if (redacted.searchParams.has("code")) {
    redacted.searchParams.set("code", "<redacted>");
  }
  if (redacted.searchParams.has("state")) {
    redacted.searchParams.set("state", "<redacted>");
  }
  return prompt.replace(callbackUrl.toString(), redacted.toString());
}

function buildStatus(
  status: FigmaOfficialPluginStatusKind,
  overrides: Pick<FigmaOfficialPluginStatus, "installed" | "connected" | "message"> & Partial<FigmaOfficialPluginStatus>,
): FigmaOfficialPluginStatus {
  const mode = overrides.mode ?? "remote";
  return {
    id: FIGMA_OFFICIAL_PLUGIN_ID,
    status,
    url: mode === "desktop" ? FIGMA_DESKTOP_MCP_URL : FIGMA_MCP_URL,
    desktopUrl: FIGMA_DESKTOP_MCP_URL,
    mode,
    capabilities: mode === "desktop" ? ["design-context", "selection-context"] : ["design-context"],
    ...overrides,
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  ));
}

function isExpectedFigmaMcpConfig(value: Record<string, unknown> | null): boolean {
  return Boolean(
    value &&
    value.enabled !== false &&
    value.type === "http" &&
    value.url === FIGMA_MCP_URL
  );
}

function parseFigmaCodexOAuthCredentialEntry(value: unknown): FigmaOfficialOAuthTokens | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.server_name !== FIGMA_MCP_SERVER_NAME || value.server_url !== FIGMA_MCP_URL) {
    return null;
  }

  const accessToken = typeof value.access_token === "string" ? value.access_token.trim() : "";
  if (!accessToken) {
    return null;
  }

  const refreshToken = typeof value.refresh_token === "string" ? value.refresh_token : undefined;
  const expiresAt = typeof value.expires_at === "number" ? value.expires_at : undefined;
  const clientId = typeof value.client_id === "string" ? value.client_id : undefined;
  const scopes = Array.isArray(value.scopes)
    ? value.scopes.filter((scope): scope is string => typeof scope === "string" && scope.trim().length > 0)
    : [];

  return {
    access_token: accessToken,
    token_type: "Bearer",
    refresh_token: refreshToken,
    scope: scopes.length ? scopes.join(" ") : undefined,
    expiresAt,
    provider: "codex",
    client_id: clientId,
  };
}

function isExpectedFigmaDesktopMcpConfig(value: Record<string, unknown> | null): boolean {
  return Boolean(
    value &&
    value.enabled !== false &&
    value.type === "http" &&
    value.url === FIGMA_DESKTOP_MCP_URL
  );
}

function isLikelyFigmaAuthError(message: string): boolean {
  return /figma|401|403|auth|authorize|unauthorized|expired|token|oauth|permission/i.test(message);
}

function extractFigmaMcpOAuthCallbackUrl(prompt: string): URL | null {
  const trimmed = prompt.trim();
  const match = trimmed.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/callback\?[^\s]+/i);
  const candidate = match?.[0] ?? trimmed;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocalhost || url.pathname !== "/callback") {
    return null;
  }

  return url.searchParams.has("code") && url.searchParams.has("state") ? url : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

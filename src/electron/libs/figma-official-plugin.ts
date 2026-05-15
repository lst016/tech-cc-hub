export const FIGMA_OFFICIAL_PLUGIN_ID = "figma-official";
export const FIGMA_MCP_SERVER_NAME = "figma";
export const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
export const FIGMA_DESKTOP_MCP_URL = "http://127.0.0.1:3845/mcp";
export const FIGMA_REST_API_URL = "https://api.figma.com/v1";
export const FIGMA_REST_TOOL_NAMES = [
  "figma_get_current_user",
  "figma_get_file_metadata",
  "figma_read_design",
  "figma_list_node_index",
  "figma_match_ui_nodes",
  "figma_summarize_design",
  "figma_extract_design_tokens",
  "figma_get_design_playbook",
  "figma_audit_design",
  "figma_generate_tailwind_code",
  "figma_get_image_urls",
  "figma_get_image_fills",
  "figma_list_file_versions",
  "figma_list_file_comments",
  "figma_list_file_library",
  "figma_get_file_variables",
  "figma_get_dev_resources",
] as const;

export type FigmaOfficialConnectionMode = "remote" | "desktop" | "rest";
export type FigmaOfficialOAuthProvider = "direct" | "codex" | "pat";

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
  accountLabel?: string;
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
  const isDesktop = mode === "desktop";
  const isRest = mode === "rest";
  return {
    id: FIGMA_OFFICIAL_PLUGIN_ID,
    name: isRest ? "Figma Token / REST API" : "Figma 官方 MCP",
    kind: isRest ? "api-token-plugin" : "mcp-plugin",
    source: {
      type: isRest ? "figma-rest-api" : isDesktop ? "desktop-mcp" : "remote-mcp",
      url: isRest ? FIGMA_REST_API_URL : isDesktop ? FIGMA_DESKTOP_MCP_URL : FIGMA_MCP_URL,
    },
    enabled: true,
    installed: true,
    connected: false,
    mode,
    capabilities: getFigmaCapabilitiesForMode(mode),
    tools: [],
    toolCount: null,
    lastToolCheckedAt: null,
    authStatus: isDesktop ? "desktop-unavailable" : isRest ? "needs-auth" : "unknown",
    authProvider: null,
    lastAuthCheckedAt: null,
    lastAuthError: null,
    oauth: null,
    accountLabel: null,
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

export function buildNextFigmaOfficialPatRuntimeConfig(
  config: unknown,
  accessToken: string,
  options: {
    accountLabel?: string;
    now?: number;
    tools?: string[];
  } = {},
): Record<string, unknown> {
  const now = options.now ?? Date.now();
  const current = isRecord(config) ? config : {};
  const plugins = isRecord(current.plugins) ? current.plugins : {};
  const mcpServers = isRecord(current.mcpServers) ? current.mcpServers : {};
  const nextMcpServers = omitFigmaMcpServer(mcpServers);
  const existingPlugin = isRecord(plugins[FIGMA_OFFICIAL_PLUGIN_ID])
    ? plugins[FIGMA_OFFICIAL_PLUGIN_ID]
    : buildFigmaOfficialPluginConfig(now, "rest");
  const tools = options.tools ?? [...FIGMA_REST_TOOL_NAMES];

  return {
    ...current,
    plugins: {
      ...plugins,
      [FIGMA_OFFICIAL_PLUGIN_ID]: {
        ...existingPlugin,
        name: "Figma Token / REST API",
        kind: "api-token-plugin",
        source: {
          type: "figma-rest-api",
          url: FIGMA_REST_API_URL,
        },
        enabled: true,
        installed: true,
        connected: true,
        mode: "rest",
        capabilities: getFigmaCapabilitiesForMode("rest"),
        tools,
        toolCount: tools.length,
        lastToolCheckedAt: now,
        authStatus: "ready",
        authProvider: "pat",
        oauth: {
          access_token: accessToken,
          token_type: "FigmaToken",
          provider: "pat",
        },
        accountLabel: options.accountLabel ?? null,
        lastAuthCheckedAt: now,
        lastAuthError: null,
        updatedAt: now,
      },
    },
    mcpServers: nextMcpServers,
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
  const authProvider = readFigmaAuthProvider(oauth);
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
        capabilities: getFigmaCapabilitiesForMode(nextMode),
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
  const isRestConfig = isExpectedFigmaRestPluginConfig(pluginConfig);

  if (!pluginConfig && !mcpConfig) {
    return buildStatus("not-configured", {
      installed: false,
      connected: false,
      message: "尚未接入 Figma。",
    });
  }

  if (!isRemoteConfig && !isDesktopConfig && !isRestConfig) {
    return buildStatus("misconfigured", {
      installed: Boolean(pluginConfig),
      connected: false,
      message: "Figma 配置异常，可重新输入 Figma Token，或切换到桌面 MCP。",
    });
  }

  const mode: FigmaOfficialConnectionMode = isRestConfig ? "rest" : isDesktopConfig ? "desktop" : "remote";
  const authStatus = typeof pluginConfig?.authStatus === "string" ? pluginConfig.authStatus : "";
  const lastAuthError = typeof pluginConfig?.lastAuthError === "string" ? pluginConfig.lastAuthError : "";
  const updatedAt = typeof pluginConfig?.updatedAt === "number" ? pluginConfig.updatedAt : undefined;
  const accountLabel = typeof pluginConfig?.accountLabel === "string" && pluginConfig.accountLabel.trim()
    ? pluginConfig.accountLabel.trim()
    : undefined;
  const oauth = isRecord(pluginConfig?.oauth) ? pluginConfig.oauth : null;
  const expiresAt = typeof oauth?.expiresAt === "number" ? oauth.expiresAt : null;
  const storedTools = readStringArray(pluginConfig?.tools);
  const tools = mode === "rest" ? [...FIGMA_REST_TOOL_NAMES] : storedTools;
  const storedToolCount = typeof pluginConfig?.toolCount === "number" && pluginConfig.toolCount >= 0
    ? pluginConfig.toolCount
    : null;
  const toolCount = mode === "rest" ? FIGMA_REST_TOOL_NAMES.length : storedToolCount ?? (tools.length > 0 ? tools.length : undefined);
  const lastToolCheckedAt = typeof pluginConfig?.lastToolCheckedAt === "number" ? pluginConfig.lastToolCheckedAt : undefined;
  const authProvider = readFigmaAuthProvider(pluginConfig) ?? readFigmaAuthProvider(oauth);
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

  if (mode === "rest") {
    if (!oauth?.access_token || authStatus === "needs-auth") {
      return buildStatus("needs-auth", {
        installed: true,
        connected: false,
        mode,
        authProvider: "pat",
        message: "Figma Token 尚未配置。",
        authHint: "请粘贴 Figma Personal Access Token，系统会先用 /v1/me 校验再保存到本机配置。",
        updatedAt,
      });
    }

    if (authStatus === "auth-expired" || isLikelyFigmaAuthError(lastAuthError)) {
      return buildStatus("auth-expired", {
        installed: true,
        connected: false,
        mode,
        authProvider: "pat",
        message: "Figma Token 无效或已失效。",
        authHint: "请重新生成并输入 Figma Personal Access Token。",
        accountLabel,
        updatedAt,
      });
    }

    return buildStatus("ready", {
      installed: true,
      connected: true,
      mode,
      authProvider: "pat",
      message: accountLabel
        ? `Figma Token 已接入：${accountLabel}。`
        : "Figma Token 已接入。",
      authHint: "当前使用 Figma REST API + 本机内置工具，不依赖 Codex OAuth。",
      tools,
      toolCount,
      lastToolCheckedAt,
      accountLabel,
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
      accountLabel,
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
      accountLabel,
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
      accountLabel,
      updatedAt,
    });
  }

  return buildStatus("configured", {
    installed: true,
    connected: false,
    mode,
    authProvider,
    message: "Figma 官方 MCP 已配置；如果首次使用或授权过期，需要通过 OAuth 重新授权。",
    authHint: "普通用户建议输入 Figma Personal Access Token；如果使用官方 MCP，则需要 OAuth 授权。",
    accountLabel,
    updatedAt,
  });
}

export function buildFigmaOfficialActionResult(config: unknown): FigmaOfficialPluginActionResult {
  return {
    ...getFigmaOfficialPluginStatusFromConfig(config),
    success: true,
    message: "Figma 配置已写入。",
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
    url: mode === "desktop" ? FIGMA_DESKTOP_MCP_URL : mode === "rest" ? FIGMA_REST_API_URL : FIGMA_MCP_URL,
    desktopUrl: FIGMA_DESKTOP_MCP_URL,
    mode,
    capabilities: getFigmaCapabilitiesForMode(mode),
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

function isExpectedFigmaRestPluginConfig(value: Record<string, unknown> | null): boolean {
  if (!value || value.enabled === false) {
    return false;
  }
  const source = isRecord(value.source) ? value.source : {};
  return value.mode === "rest" || value.authProvider === "pat" || source.type === "figma-rest-api";
}

function omitFigmaMcpServer(mcpServers: Record<string, unknown>): Record<string, unknown> {
  const next = { ...mcpServers };
  delete next[FIGMA_MCP_SERVER_NAME];
  return next;
}

function getFigmaCapabilitiesForMode(mode: FigmaOfficialConnectionMode): string[] {
  if (mode === "desktop") {
    return ["design-context", "selection-context"];
  }
  if (mode === "rest") {
    return ["design-context", "file-api", "image-export", "metadata", "library", "variables"];
  }
  return ["design-context"];
}

function readFigmaAuthProvider(value: unknown): FigmaOfficialOAuthProvider | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value.provider === "codex" || value.provider === "direct" || value.provider === "pat"
    ? value.provider
    : value.authProvider === "codex" || value.authProvider === "direct" || value.authProvider === "pat"
      ? value.authProvider
      : undefined;
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

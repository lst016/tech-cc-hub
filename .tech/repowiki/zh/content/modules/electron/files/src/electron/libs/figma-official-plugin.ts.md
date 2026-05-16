# src/electron/libs/figma-official-plugin.ts

> 模块：`electron` · 语言：`typescript` · 行数：705

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildFigmaOfficialPluginConfig@74`
- `buildFigmaOfficialMcpConfig@106`
- `buildFigmaDesktopMcpConfig@120`
- `buildNextFigmaOfficialRuntimeConfig@128`
- `buildNextFigmaOfficialDesktopRuntimeConfig@146`
- `buildNextFigmaOfficialPatRuntimeConfig@192`
- `buildNextFigmaOfficialAuthStateRuntimeConfig@248`
- `buildNextFigmaOfficialCodexAuthRuntimeConfig@329`
- `parseFigmaCodexOAuthCredentialStore@348`
- `getFigmaOfficialPluginStatusFromConfig@363`
- `buildFigmaOfficialActionResult@529`
- `shouldPreserveReadyFigmaOfficialConfigAfterCodexError@537`
- `isLikelyFigmaTokenFailureMessage@542`
- `isFigmaMcpOAuthCallbackPrompt@546`
- `redactFigmaMcpOAuthCallbackPrompt@550`
- `buildStatus@564`
- `readStringArray@580`
- `isExpectedFigmaMcpConfig@593`
- `parseFigmaCodexOAuthCredentialEntry@602`
- `isExpectedFigmaDesktopMcpConfig@634`
- `isExpectedFigmaRestPluginConfig@643`
- `omitFigmaMcpServer@651`
- `getFigmaCapabilitiesForMode@657`
- `readFigmaAuthProvider@667`
- `isLikelyFigmaAuthError@678`
- `extractFigmaMcpOAuthCallbackUrl@682`
- `isRecord@701`
- `FIGMA_OFFICIAL_PLUGIN_ID@1`
- `FIGMA_MCP_SERVER_NAME@2`
- `FIGMA_MCP_URL@3`
- `FIGMA_DESKTOP_MCP_URL@4`
- `FIGMA_REST_API_URL@5`
- `FIGMA_REST_TOOL_NAMES@6`
- `isDesktop@79`
- `isRest@80`
- `current@130`
- `plugins@131`
- `mcpServers@132`
- `now@151`
- `available@152`

## 对外暴露

- `FIGMA_OFFICIAL_PLUGIN_ID`
- `FIGMA_MCP_SERVER_NAME`
- `FIGMA_MCP_URL`
- `FIGMA_DESKTOP_MCP_URL`
- `FIGMA_REST_API_URL`
- `FIGMA_REST_TOOL_NAMES`
- `FigmaOfficialConnectionMode`
- `FigmaOfficialOAuthProvider`
- `FigmaOfficialPluginStatusKind`
- `FigmaOfficialPluginStatus`
- `FigmaOfficialPluginActionResult`
- `FigmaOfficialAuthState`
- `FigmaOfficialOAuthTokens`
- `buildFigmaOfficialPluginConfig`
- `buildFigmaOfficialMcpConfig`
- `buildFigmaDesktopMcpConfig`
- `buildNextFigmaOfficialRuntimeConfig`
- `buildNextFigmaOfficialDesktopRuntimeConfig`
- `buildNextFigmaOfficialPatRuntimeConfig`
- `buildNextFigmaOfficialAuthStateRuntimeConfig`
- `buildNextFigmaOfficialCodexAuthRuntimeConfig`
- `parseFigmaCodexOAuthCredentialStore`
- `getFigmaOfficialPluginStatusFromConfig`
- `buildFigmaOfficialActionResult`
- `shouldPreserveReadyFigmaOfficialConfigAfterCodexError`
- `isLikelyFigmaTokenFailureMessage`
- `isFigmaMcpOAuthCallbackPrompt`
- `redactFigmaMcpOAuthCallbackPrompt`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
... (truncated)
```

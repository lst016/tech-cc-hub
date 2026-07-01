import {
    app,
    BrowserWindow,
    clipboard,
    dialog,
    globalShortcut,
    IpcMainEvent,
    IpcMainInvokeEvent,
    ipcMain,
    Menu,
    nativeImage,
    shell,
    systemPreferences,
    desktopCapturer,
    type MessageBoxOptions,
} from "electron"
import { execSync, spawn } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "fs";
import { createServer, type Server } from "http";
import { homedir } from "os";
import { join } from "path";
import { startup } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError, type OAuthClientProvider, type OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { handleClientEvent, sessions, cleanupAllSessions, setChannelReplySender, listStoredSessionsForRenderer, initializeTaskExecutor, initializeNoteRepository } from "./ipc-handlers.js";
import { generateSessionTitle, getEnhancedEnv } from "./libs/util.js";
import {
  loadApiConfigSettings,
  type ApiConfigSettings,
  saveApiConfigSettings,
  loadGlobalRuntimeConfig,
  saveGlobalRuntimeConfig,
} from "./libs/config-store.js";
import { setBrowserToolHost } from "./libs/mcp-tools/browser.js";
import { setDesignToolHost } from "./libs/mcp-tools/design.js";
import { configureDesktopNotifications } from "./libs/desktop-notifications.js";
import { appAutoUpdater, type AppUpdateStatus } from "./libs/auto-updater/auto-updater.js";
import { startChannelBridge, type ChannelBridgeController } from "./libs/channel/channel-bridge.js";
import { ensureSystemWorkspace } from "./libs/system-workspace.js";
import { getClaudeCodePath, getCurrentApiConfig, getGlobalRuntimeEnvConfig, resolveApiConfigForModel, resolveImagePreprocessApiConfig } from "./libs/claude/claude-settings.js";
import { preprocessImageAttachments } from "./libs/image/image-preprocessor.js";
import {
    CODEX_OAUTH_BASE_URL,
    buildCodexRequestHeaders,
    buildCodexResponsesRequest,
    createCodexOAuthAuthorizationFlow,
    encodeCodexOAuthCredential,
    exchangeCodexAuthorizationCode,
    extractCodexModelIdsFromCache,
    getCodexResponsesPath,
    mergeCodexModelIds,
    parseCodexAuthorizationInput,
    parseCodexResponsesStream,
    parseCodexOAuthCredential,
    refreshCodexOAuthToken,
    toAnthropicMessageResponse,
    tokenResultToCredential,
} from "./libs/codex/codex-oauth.js";
import { loadAgentRuleDocuments, saveUserAgentRuleDocument } from "./libs/agent-rule-docs.js";
import { handleSkillManagerInvoke, registerSkillManagerHandlers } from "./libs/skill-manager/ipc-handlers.js";
import { registerCronIpcHandlers, IpcCronEventEmitter } from "./libs/cron/cron-ipc-handlers.js";
import { handleGitWorkbenchInvoke, registerGitWorkbenchIpcHandlers } from "./libs/git/index.js";
import {
  getManagedCodeGraphStatus,
  indexManagedCodeGraph,
  isManagedCodeGraphInitialized,
  syncManagedCodeGraph,
} from "./libs/codegraph/managed-codegraph.js";
import {
  getPreviewFileMetadataForRenderer,
  listPreviewDirectoryForRenderer,
  listPreviewFilesForRenderer,
  readPreviewFileForRenderer,
  removePreviewEntryForRenderer,
  renamePreviewEntryForRenderer,
  writePreviewFileForRenderer,
} from "./libs/preview-fs.js";
import { CronService } from "./libs/cron/cron-service.js";
import { CronRepository } from "./libs/cron/cron-repository.js";
import { CronJobExecutor, CronBusyGuard } from "./libs/cron/cron-executor.js";
import { setCronService } from "./libs/mcp-tools/cron.js";
import type { ClientEvent, PromptAttachment, ServerEvent } from "./types.js";
import { BrowserWorkbenchManager, type BrowserWorkbenchBounds, type BrowserWorkbenchEvent, type BrowserWorkbenchNetworkLogInput, type BrowserWorkbenchRecordedAction, type BrowserWorkbenchState } from "./browser-manager.js";
import { startDevBackendBridge, DEV_BACKEND_BRIDGE_PORT } from "./dev-backend-bridge.js";
import { buildSessionSlashCommandItems } from "./libs/slash-command-catalog.js";
import { prepareExternalCliCommand, runExternalCli } from "./libs/external-cli.js";
import {
  buildFigmaOfficialActionResult,
  buildNextFigmaOfficialCodexAuthRuntimeConfig,
  buildNextFigmaOfficialDesktopRuntimeConfig,
  buildNextFigmaOfficialAuthStateRuntimeConfig,
  buildNextFigmaOfficialPatRuntimeConfig,
  buildNextFigmaOfficialRuntimeConfig,
  FIGMA_DESKTOP_MCP_URL,
  FIGMA_MCP_URL,
  FIGMA_REST_API_URL,
  FIGMA_REST_TOOL_NAMES,
  type FigmaOfficialOAuthTokens,
  getFigmaOfficialPluginStatusFromConfig,
  parseFigmaCodexOAuthCredentialStore,
  shouldPreserveReadyFigmaOfficialConfigAfterCodexError,
} from "./libs/figma-official-plugin.js";
import { normalizePluginVersion, summarizePluginUpdate, type PluginUpdateSummary } from "./libs/plugin-updates.js";
import { submitFeedbackIssue, type FeedbackSubmitPayload } from "./libs/feedback.js";
import "./libs/claude/claude-settings.js";
import { resolveClaudeCodePluginDetails } from "./libs/claude/claude-code-plugins.js";
import { addServerEventListener } from "./ipc-handlers.js";
import {
    extractApiModelsFromListPayload,
    toImportedApiModels,
    type ImportedApiModel,
} from "../shared/models/api-model-metadata.js";
import {
    MINIMAX_ANTHROPIC_BASE_URL,
    MINIMAX_DEFAULT_MODEL,
    MINIMAX_M2_CONTEXT_WINDOW,
    MINIMAX_M3_CONTEXT_WINDOW,
} from "../shared/models/minimax.js";

let cleanupComplete = false;
let mainWindow: BrowserWindow | null = null;
const DEFAULT_BROWSER_WORKBENCH_SESSION_ID = "global";
const browserWorkbenches = new Map<string, BrowserWorkbenchManager>();
const browserWorkbenchEventListeners = new Set<(event: BrowserWorkbenchEvent) => void>();
let stopDevBackendBridge: (() => void) | null = null;
let channelBridgeController: ChannelBridgeController | null = null;

type CodeGraphUiPayload = {
  workspaceRoot?: unknown;
  mode?: unknown;
};

async function getOpenComputerUseVersion(): Promise<string | null> {
  try {
    const result = await runExternalCli("open-computer-use", ["--version"], { timeout: 15_000 });
    const rawVersion = result.stdout.trim() || result.stderr.trim();
    return normalizePluginVersion(rawVersion) ?? (rawVersion ? "installed" : null);
  } catch {
    return null;
  }
}

function getNpmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveCodeGraphWorkspaceRoot(payload: unknown): string {
  const request = payload && typeof payload === "object" ? payload as CodeGraphUiPayload : {};
  const workspaceRoot = typeof request.workspaceRoot === "string" ? request.workspaceRoot.trim() : "";
  if (!workspaceRoot) {
    throw new Error("workspaceRoot is required.");
  }
  if (!existsSync(workspaceRoot)) {
    throw new Error(`workspaceRoot does not exist: ${workspaceRoot}`);
  }
  return workspaceRoot;
}

async function handleCodeGraphUiInvoke(channel: string, payload: unknown): Promise<unknown> {
  if (channel === "codegraph:status") {
    const workspaceRoot = resolveCodeGraphWorkspaceRoot(payload);
    return { success: true, status: await getManagedCodeGraphStatus(workspaceRoot) };
  }
  if (channel === "codegraph:sync") {
    const workspaceRoot = resolveCodeGraphWorkspaceRoot(payload);
    const request = payload && typeof payload === "object" ? payload as CodeGraphUiPayload : {};
    const initialized = isManagedCodeGraphInitialized(workspaceRoot);
    const mode = request.mode === "index" || !initialized ? "index" : "sync";
    const result = mode === "index"
      ? await indexManagedCodeGraph(workspaceRoot)
      : await syncManagedCodeGraph(workspaceRoot);
    return {
      success: true,
      mode,
      result,
      status: await getManagedCodeGraphStatus(workspaceRoot),
    };
  }
  throw new Error(`Unsupported CodeGraph UI channel: ${channel}`);
}

async function getOpenComputerUseLatestVersion(): Promise<string> {
  const result = await runExternalCli(getNpmCommand(), ["view", "open-computer-use", "version"], { timeout: 60_000 });
  const latestVersion = normalizePluginVersion(result.stdout.trim() || result.stderr.trim());
  if (!latestVersion) {
    throw new Error("npm registry did not return an open-computer-use version.");
  }
  return latestVersion;
}

type OpenComputerUsePermissionStatus = {
  platform: NodeJS.Platform;
  required: boolean;
  accessibility: "granted" | "missing" | "not-required" | "unknown";
  screenRecording: "granted" | "missing" | "not-required" | "unknown";
  needsUserAction: boolean;
  openedSystemSettings: boolean;
};

type OpenComputerUsePluginStatus = PluginUpdateSummary & {
  installed: boolean;
  connected: boolean;
  version?: string;
  permissions: OpenComputerUsePermissionStatus;
};

type OpenComputerUsePluginActionResult = OpenComputerUsePluginStatus & {
  success: boolean;
  message: string;
  error?: string;
};

function macPrivacyPaneUrl(kind: "accessibility" | "screen-recording"): string {
  return kind === "accessibility"
    ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    : "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
}

async function prepareOpenComputerUsePermissions(options: { prompt?: boolean; openSettings?: boolean } = {}): Promise<OpenComputerUsePermissionStatus> {
  if (process.platform !== "darwin") {
    return {
      platform: process.platform,
      required: false,
      accessibility: "not-required",
      screenRecording: "not-required",
      needsUserAction: false,
      openedSystemSettings: false,
    };
  }

  let accessibility: OpenComputerUsePermissionStatus["accessibility"] = "unknown";
  let screenRecording: OpenComputerUsePermissionStatus["screenRecording"] = "unknown";
  let openedSystemSettings = false;

  try {
    accessibility = systemPreferences.isTrustedAccessibilityClient(Boolean(options.prompt)) ? "granted" : "missing";
  } catch {
    accessibility = "unknown";
  }

  try {
    const screenStatus = systemPreferences.getMediaAccessStatus("screen");
    screenRecording = screenStatus === "granted" ? "granted" : "missing";
  } catch {
    screenRecording = "unknown";
  }

  if (options.prompt && screenRecording !== "granted") {
    try {
      await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1, height: 1 },
      });
      const refreshedScreenStatus = systemPreferences.getMediaAccessStatus("screen");
      screenRecording = refreshedScreenStatus === "granted" ? "granted" : "missing";
    } catch {
      screenRecording = "missing";
    }
  }

  if (options.openSettings) {
    if (accessibility !== "granted") {
      await shell.openExternal(macPrivacyPaneUrl("accessibility"));
      openedSystemSettings = true;
    }
    if (screenRecording !== "granted") {
      setTimeout(() => {
        void shell.openExternal(macPrivacyPaneUrl("screen-recording"));
      }, accessibility !== "granted" ? 900 : 0);
      openedSystemSettings = true;
    }
  }

  return {
    platform: process.platform,
    required: true,
    accessibility,
    screenRecording,
    needsUserAction: accessibility !== "granted" || screenRecording !== "granted",
    openedSystemSettings,
  };
}

async function installOpenComputerUsePlugin(): Promise<{ success: boolean; installed: boolean; connected: boolean; version?: string; message: string; error?: string; permissions: OpenComputerUsePermissionStatus }> {
  const existingVersion = await getOpenComputerUseVersion();
  if (existingVersion) {
    const permissions = await prepareOpenComputerUsePermissions({ prompt: true, openSettings: true });
    connectOpenComputerUsePlugin(existingVersion, permissions);
    return {
      success: true,
      installed: true,
      connected: !permissions.needsUserAction,
      version: existingVersion,
      permissions,
      message: permissions.needsUserAction
        ? "Open Computer Use 已安装，已写入 MCP；macOS 还需要授权 Accessibility 和 Screen Recording。"
        : "Open Computer Use 已安装并接入。",
    };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    await runExternalCli(npmCommand, ["install", "-g", "open-computer-use"], { timeout: 300_000 });
    const version = await getOpenComputerUseVersion();
    const permissions = await prepareOpenComputerUsePermissions({ prompt: true, openSettings: true });
    connectOpenComputerUsePlugin(version ?? "installed", permissions);
    return {
      success: true,
      installed: true,
      connected: !permissions.needsUserAction,
      version: version ?? undefined,
      permissions,
      message: permissions.needsUserAction
        ? "Open Computer Use 安装完成，已写入 MCP；macOS 还需要授权 Accessibility 和 Screen Recording。"
        : "Open Computer Use 安装完成并接入。",
    };
  } catch (error) {
    const permissions = await prepareOpenComputerUsePermissions();
    return {
      success: false,
      installed: false,
      connected: false,
      message: "Open Computer Use 安装或接入失败。",
      permissions,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getOpenComputerUsePluginStatus(): Promise<OpenComputerUsePluginStatus> {
  const version = await getOpenComputerUseVersion();
  const permissions = await prepareOpenComputerUsePermissions();
  const config = loadGlobalRuntimeConfig();
  const plugins = isPlainObject(config.plugins) ? config.plugins : {};
  const mcpServers = isPlainObject(config.mcpServers) ? config.mcpServers : {};
  const pluginConfig = isPlainObject(plugins["open-computer-use"]) ? plugins["open-computer-use"] : {};
  const mcpConfig = isPlainObject(mcpServers["open-computer-use"]) ? mcpServers["open-computer-use"] : {};
  const hasMcpConfig = pluginConfig.enabled === true && mcpConfig.command === "open-computer-use";
  return {
    installed: Boolean(version),
    connected: Boolean(version) && hasMcpConfig && !permissions.needsUserAction,
    version: version ?? undefined,
    permissions,
    ...summarizePluginUpdate({ currentVersion: version }),
  };
}

async function checkOpenComputerUsePluginUpdate(): Promise<OpenComputerUsePluginStatus> {
  const status = await getOpenComputerUsePluginStatus();
  const updateCheckedAt = Date.now();
  try {
    const latestVersion = await getOpenComputerUseLatestVersion();
    return {
      ...status,
      ...summarizePluginUpdate({
        currentVersion: status.version,
        latestVersion,
        updateCheckedAt,
      }),
    };
  } catch (error) {
    return {
      ...status,
      ...summarizePluginUpdate({
        currentVersion: status.version,
        updateError: getErrorMessage(error),
        updateCheckedAt,
      }),
    };
  }
}

async function updateOpenComputerUsePlugin(): Promise<OpenComputerUsePluginActionResult> {
  const beforeVersion = await getOpenComputerUseVersion();
  if (!beforeVersion) {
    const installResult = await installOpenComputerUsePlugin();
    const updateCheckedAt = Date.now();
    try {
      const latestVersion = await getOpenComputerUseLatestVersion();
      return {
        ...installResult,
        ...summarizePluginUpdate({
          currentVersion: installResult.version,
          latestVersion,
          updateCheckedAt,
        }),
      };
    } catch (error) {
      return {
        ...installResult,
        ...summarizePluginUpdate({
          currentVersion: installResult.version,
          updateError: getErrorMessage(error),
          updateCheckedAt,
        }),
      };
    }
  }

  try {
    await runExternalCli(getNpmCommand(), ["install", "-g", "open-computer-use@latest"], { timeout: 300_000 });
    const version = await getOpenComputerUseVersion();
    const permissions = await prepareOpenComputerUsePermissions({ prompt: true, openSettings: true });
    connectOpenComputerUsePlugin(version ?? "installed", permissions);
    const updateCheckedAt = Date.now();
    const latestVersion = await getOpenComputerUseLatestVersion().catch(() => version ?? undefined);
    return {
      success: true,
      installed: true,
      connected: !permissions.needsUserAction,
      version: version ?? undefined,
      permissions,
      ...summarizePluginUpdate({
        currentVersion: version,
        latestVersion,
        updateCheckedAt,
      }),
      message: permissions.needsUserAction
        ? "Open Computer Use 已更新并写入 MCP，macOS 还需要授权 Accessibility 和 Screen Recording。"
        : "Open Computer Use 已更新到最新版本并接入。",
    };
  } catch (error) {
    const permissions = await prepareOpenComputerUsePermissions();
    return {
      success: false,
      installed: true,
      connected: false,
      version: beforeVersion,
      permissions,
      ...summarizePluginUpdate({
        currentVersion: beforeVersion,
        updateError: getErrorMessage(error),
        updateCheckedAt: Date.now(),
      }),
      message: "Open Computer Use 更新失败。",
      error: getErrorMessage(error),
    };
  }
}

function connectOpenComputerUsePlugin(version: string, permissions: OpenComputerUsePermissionStatus): void {
  const current = loadGlobalRuntimeConfig();
  const currentPlugins = isPlainObject(current.plugins) ? current.plugins : {};
  const currentMcpServers = isPlainObject(current.mcpServers) ? current.mcpServers : {};
  const permissionsReady = !permissions.needsUserAction;
  saveGlobalRuntimeConfig({
    ...current,
    plugins: {
      ...currentPlugins,
      "open-computer-use": {
        id: "open-computer-use",
        name: "Open Computer Use",
        kind: "mcp-plugin",
        source: {
          type: "github",
          repo: "iFurySt/open-codex-computer-use",
          path: "plugins/open-computer-use",
        },
        enabled: true,
        installed: true,
        connected: permissionsReady,
        permissionStatus: permissions,
        version,
        updatedAt: Date.now(),
      },
    },
    mcpServers: {
      ...currentMcpServers,
      "open-computer-use": {
        type: "stdio",
        command: "open-computer-use",
        args: ["mcp"],
      },
    },
  });
}

async function getFigmaOfficialPluginStatus() {
  const config = loadGlobalRuntimeConfig();
  const status = getFigmaOfficialPluginStatusFromConfig(config);
  if (status.mode !== "desktop") {
    return status;
  }

  const available = await isFigmaDesktopMcpAvailable();
  if (available === status.connected) {
    return status;
  }

  const nextConfig = buildNextFigmaOfficialDesktopRuntimeConfig(config, {
    available,
    error: available ? null : buildFigmaDesktopUnavailableMessage(),
  });
  saveGlobalRuntimeConfig(nextConfig);
  return getFigmaOfficialPluginStatusFromConfig(nextConfig);
}

function installFigmaOfficialPlugin() {
  const nextConfig = buildNextFigmaOfficialRuntimeConfig(loadGlobalRuntimeConfig());
  saveGlobalRuntimeConfig(nextConfig);
  return buildFigmaOfficialActionResult(nextConfig);
}

async function connectFigmaDesktopOfficialPlugin() {
  const available = await isFigmaDesktopMcpAvailable();
  const error = available ? null : buildFigmaDesktopUnavailableMessage();
  const nextConfig = buildNextFigmaOfficialDesktopRuntimeConfig(loadGlobalRuntimeConfig(), { available, error });
  saveGlobalRuntimeConfig(nextConfig);
  return {
    ...getFigmaOfficialPluginStatusFromConfig(nextConfig),
    success: available,
    message: available
      ? "已切换到 Figma Desktop MCP。也可以随时改用 Figma Token / REST API。"
      : error,
  };
}

type FigmaPatProfile = {
  id?: string;
  email?: string;
  handle?: string;
};

async function connectFigmaPatOfficialPlugin(tokenInput: unknown) {
  const token = typeof tokenInput === "string" ? tokenInput.trim() : "";
  if (!token) {
    const currentConfig = loadGlobalRuntimeConfig();
    return {
      ...getFigmaOfficialPluginStatusFromConfig(currentConfig),
      success: false,
      message: "请先输入 Figma Personal Access Token。",
      error: "empty-figma-token",
    };
  }

  try {
    const profile = await fetchFigmaPatProfile(token);
    const accountLabel = [profile.handle, profile.email, profile.id].find((item) => typeof item === "string" && item.trim())?.trim();
    const nextConfig = buildNextFigmaOfficialPatRuntimeConfig(loadGlobalRuntimeConfig(), token, {
      accountLabel,
      tools: [...FIGMA_REST_TOOL_NAMES],
    });
    saveGlobalRuntimeConfig(nextConfig);
    return {
      ...getFigmaOfficialPluginStatusFromConfig(nextConfig),
      success: true,
      message: accountLabel
        ? `Figma Token 校验通过，已接入 ${accountLabel}。`
        : "Figma Token 校验通过，已接入 Figma REST API。",
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      ...getFigmaOfficialPluginStatusFromConfig(loadGlobalRuntimeConfig()),
      success: false,
      message,
      error: message,
    };
  }
}

async function fetchFigmaPatProfile(token: string): Promise<FigmaPatProfile> {
  const response = await fetch(`${FIGMA_REST_API_URL}/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Figma-Token": token,
    },
  });
  const bodyText = await response.text();
  const body = parseJsonResponse(bodyText);
  if (!response.ok) {
    const detail = getFigmaRestErrorDetail(body, bodyText);
    throw new Error(`Figma Token 校验失败（${response.status}）：${detail}`);
  }
  if (!isPlainObject(body)) {
    return {};
  }
  return {
    id: typeof body.id === "string" ? body.id : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    handle: typeof body.handle === "string" ? body.handle : undefined,
  };
}

function parseJsonResponse(text: string): unknown {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getFigmaRestErrorDetail(body: unknown, fallback: string): string {
  if (isPlainObject(body)) {
    if (typeof body.err === "string") return body.err;
    if (typeof body.message === "string") return body.message;
    if (typeof body.status === "string") return body.status;
  }
  return fallback.trim() || "Token 无效或没有权限";
}

async function isFigmaDesktopMcpAvailable(timeoutMs = 900): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(FIGMA_DESKTOP_MCP_URL, {
      method: "GET",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildFigmaDesktopUnavailableMessage() {
  return [
    "未检测到 Figma Desktop MCP。",
    "请安装/打开 Figma 桌面版，打开一个设计文件，切到 Dev Mode，然后启用 Desktop MCP Server。",
    `启用后本地服务应监听 ${FIGMA_DESKTOP_MCP_URL}。`,
  ].join(" ");
}

const CODEX_MCP_FILE_CREDENTIAL_STORE_CONFIG = "mcp_oauth_credentials_store=\"file\"";
const CODEX_FIGMA_LOGIN_TIMEOUT_MS = 5 * 60_000;

function getCodexCommand(): string {
  const explicit = process.env.CODEX_CLI_PATH?.trim();
  if (explicit) {
    return explicit;
  }

  const candidates = [
    join(homedir(), "bin", "codex"),
    "/Applications/Codex.app/Contents/Resources/codex",
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "codex";
}

function getCodexHomePath(): string {
  return process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
}

function getCodexMcpCredentialsPath(): string {
  return join(getCodexHomePath(), ".credentials.json");
}

function readCodexFigmaOAuthCredentials(): FigmaOfficialOAuthTokens | null {
  const credentialsPath = getCodexMcpCredentialsPath();
  if (!existsSync(credentialsPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(credentialsPath, "utf8")) as unknown;
    return parseFigmaCodexOAuthCredentialStore(parsed);
  } catch (error) {
    console.error("[figma-official] failed to read Codex MCP credentials:", error);
    return null;
  }
}

function isUsableFigmaOAuth(oauth: FigmaOfficialOAuthTokens | null): oauth is FigmaOfficialOAuthTokens {
  if (!oauth?.access_token) {
    return false;
  }
  return typeof oauth.expiresAt !== "number" || oauth.expiresAt > Date.now() + 60_000;
}

async function hasCodexFigmaMcpServer(): Promise<boolean> {
  try {
    await runExternalCli(getCodexCommand(), ["mcp", "get", "figma"], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

async function listFigmaRemoteToolsWithAccessToken(accessToken: string) {
  const client = new Client({ name: "tech-cc-hub", version: app.getVersion() }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(FIGMA_MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    return tools.tools;
  } finally {
    await transport.close().catch(() => undefined);
  }
}

function extractFigmaMcpToolNames(tools: unknown): string[] {
  if (!Array.isArray(tools)) {
    return [];
  }

  return Array.from(new Set(
    tools
      .map((tool) => isPlainObject(tool) && typeof tool.name === "string" ? tool.name.trim() : "")
      .filter(Boolean),
  ));
}

function extractFigmaMcpAuthorizationUrl(text: string): string | null {
  const match = text.match(/https:\/\/www\.figma\.com\/oauth\/mcp\?[^\s"'<>]+/i);
  return match?.[0] ?? null;
}

async function openFigmaAuthorizationUrlInChrome(authUrl: string): Promise<void> {
  clipboard.writeText(authUrl);
  if (process.platform === "darwin") {
    try {
      await runExternalCli("open", ["-a", "Google Chrome", authUrl], { timeout: 5_000 });
      return;
    } catch (error) {
      console.warn("[figma-official] failed to open Google Chrome, falling back to default browser:", error);
    }
  }
  await shell.openExternal(authUrl);
}

function presentCodexFigmaAuthorizationUrl(authUrl: string): void {
  void openFigmaAuthorizationUrlInChrome(authUrl);
  const messageBoxOptions: MessageBoxOptions = {
    type: "info",
    buttons: ["知道了"],
    defaultId: 0,
    title: "Figma Codex 授权链接已打开",
    message: "已用 Chrome 打开 Figma 官方 OAuth 授权链接",
    detail: [
      "链接也已复制到剪贴板。",
      "请在 Chrome 中点击 Agree & Allow Access；授权完成后 tech-cc-hub 会继续接入远程 MCP。",
      "",
      authUrl,
    ].join("\n"),
  };
  void (mainWindow
    ? dialog.showMessageBox(mainWindow, messageBoxOptions)
    : dialog.showMessageBox(messageBoxOptions));
}

function runCodexFigmaOAuthLoginWithFileCredentials(needsAdd: boolean): Promise<string> {
  const args = needsAdd
    ? ["mcp", "add", "-c", CODEX_MCP_FILE_CREDENTIAL_STORE_CONFIG, "figma", "--url", FIGMA_MCP_URL]
    : ["mcp", "login", "figma", "-c", CODEX_MCP_FILE_CREDENTIAL_STORE_CONFIG];
  const prepared = prepareExternalCliCommand(getCodexCommand(), args);

  return new Promise((resolve, reject) => {
    let output = "";
    let openedAuthUrl = false;
    let settled = false;
    const child = spawn(prepared.command, prepared.args, {
      cwd: homedir(),
      env: prepared.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: prepared.windowsVerbatimArguments,
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Codex Figma OAuth timed out. 请重新点击 Codex 授权接入。"));
    }, CODEX_FIGMA_LOGIN_TIMEOUT_MS);

    const onData = (data: Buffer) => {
      const chunk = data.toString("utf8");
      output += chunk;
      const authUrl = openedAuthUrl ? null : extractFigmaMcpAuthorizationUrl(output);
      if (authUrl) {
        openedAuthUrl = true;
        presentCodexFigmaAuthorizationUrl(authUrl);
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve(output);
        return;
      }
      reject(new Error(`Codex Figma OAuth failed with exit code ${code ?? "unknown"}: ${output.trim()}`));
    });
  });
}

async function connectFigmaCodexOfficialPlugin() {
  try {
    const initialConfig = loadGlobalRuntimeConfig();
    const initialStatus = getFigmaOfficialPluginStatusFromConfig(initialConfig);
    if (initialStatus.status !== "ready" || initialStatus.mode !== "remote") {
      const baseConfig = buildNextFigmaOfficialRuntimeConfig(initialConfig);
      saveGlobalRuntimeConfig(baseConfig);
    }

    let oauth = readCodexFigmaOAuthCredentials();
    if (!isUsableFigmaOAuth(oauth)) {
      const hasServer = await hasCodexFigmaMcpServer();
      await runCodexFigmaOAuthLoginWithFileCredentials(!hasServer);
      oauth = readCodexFigmaOAuthCredentials();
    }

    if (!isUsableFigmaOAuth(oauth)) {
      throw new Error("未找到可用的 Codex file-store Figma OAuth 凭据，请重新完成 Figma 授权。");
    }

    const tools = await listFigmaRemoteToolsWithAccessToken(oauth.access_token);
    const toolNames = extractFigmaMcpToolNames(tools);
    const nextConfig = buildNextFigmaOfficialCodexAuthRuntimeConfig(loadGlobalRuntimeConfig(), oauth, Date.now(), toolNames);
    saveGlobalRuntimeConfig(nextConfig);
    return {
      ...getFigmaOfficialPluginStatusFromConfig(nextConfig),
      success: true,
      message: `已通过 Codex 官方 OAuth 接入 Figma 远程 MCP，并检测到 ${toolNames.length} 个工具。`,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const currentConfig = loadGlobalRuntimeConfig();
    const currentStatus = getFigmaOfficialPluginStatusFromConfig(currentConfig);
    if (shouldPreserveReadyFigmaOfficialConfigAfterCodexError(currentConfig, message)) {
      return {
        ...currentStatus,
        success: false,
        message,
        error: message,
      };
    }

    const state = /expired|过期/i.test(message) ? "auth-expired" : "needs-auth";
    const nextConfig = buildNextFigmaOfficialAuthStateRuntimeConfig(currentConfig, state, {
      error: message,
      oauth: null,
    });
    saveGlobalRuntimeConfig(nextConfig);
    return {
      ...getFigmaOfficialPluginStatusFromConfig(nextConfig),
      success: false,
      message,
      error: message,
    };
  }
}

type FigmaOAuthCallbackWaiter = {
  redirectUrl: string;
  waitForCode: Promise<string>;
  close: () => Promise<void>;
};

class FigmaRuntimeOAuthProvider implements OAuthClientProvider {
  private clientInfo?: OAuthClientInformationMixed;
  private currentTokens?: OAuthTokens;
  private codeVerifierValue?: string;
  private discovery?: OAuthDiscoveryState;
  private tokensSavedAt = Date.now();

  constructor(
    private readonly callbackUrl: string,
    private readonly oauthState: string,
    private readonly openAuthorizationUrl: (url: URL) => Promise<void>,
  ) {}

  get redirectUrl() {
    return this.callbackUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "tech-cc-hub",
      redirect_uris: [this.callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    };
  }

  state() {
    return this.oauthState;
  }

  clientInformation() {
    return this.clientInfo;
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed) {
    this.clientInfo = clientInformation;
  }

  tokens() {
    return this.currentTokens;
  }

  saveTokens(tokens: OAuthTokens) {
    this.currentTokens = tokens;
    this.tokensSavedAt = Date.now();
  }

  async redirectToAuthorization(authorizationUrl: URL) {
    await this.openAuthorizationUrl(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string) {
    this.codeVerifierValue = codeVerifier;
  }

  codeVerifier() {
    if (!this.codeVerifierValue) {
      throw new Error("Figma OAuth code verifier is missing.");
    }
    return this.codeVerifierValue;
  }

  saveDiscoveryState(state: OAuthDiscoveryState) {
    this.discovery = state;
  }

  discoveryState() {
    return this.discovery;
  }

  toRuntimeTokens(): FigmaOfficialOAuthTokens | null {
    if (!this.currentTokens?.access_token) {
      return null;
    }
    const expiresAt = typeof this.currentTokens.expires_in === "number"
      ? this.tokensSavedAt + (this.currentTokens.expires_in * 1000)
      : undefined;
    return {
      access_token: this.currentTokens.access_token,
      token_type: this.currentTokens.token_type,
      expires_in: this.currentTokens.expires_in,
      refresh_token: this.currentTokens.refresh_token,
      scope: this.currentTokens.scope,
      id_token: this.currentTokens.id_token,
      expiresAt,
    };
  }
}

async function createFigmaOAuthCallbackWaiter(expectedState: string, timeoutMs = 5 * 60_000): Promise<FigmaOAuthCallbackWaiter> {
  let server: Server | null = null;
  let settled = false;
  let timeout: NodeJS.Timeout | null = null;

  const waitForCode = new Promise<string>((resolve, reject) => {
    server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (requestUrl.pathname !== "/callback") {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      const code = requestUrl.searchParams.get("code");
      const state = requestUrl.searchParams.get("state");
      if (error) {
        settled = true;
        response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        response.end("<h1>Figma 授权失败</h1><p>可以关闭这个窗口，回到 tech-cc-hub 重新授权。</p>");
        reject(new Error(`Figma OAuth failed: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        settled = true;
        response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        response.end("<h1>Figma 授权回调无效</h1><p>可以关闭这个窗口，回到 tech-cc-hub 重新授权。</p>");
        reject(new Error("Figma OAuth callback is missing code or has mismatched state."));
        return;
      }

      settled = true;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<h1>Figma 授权完成</h1><p>可以关闭这个窗口，回到 tech-cc-hub 继续使用。</p>");
      resolve(code);
    });

    timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Figma OAuth timed out; please try authorizing again."));
    }, timeoutMs);
  });

  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "localhost", () => resolve());
  });

  const callbackServer = server!;
  const address = callbackServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start Figma OAuth callback server.");
  }

  return {
    redirectUrl: `http://localhost:${address.port}/callback`,
    waitForCode,
    close: () => new Promise<void>((resolve) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (!callbackServer.listening) {
        resolve();
        return;
      }
      callbackServer.close(() => resolve());
    }),
  };
}

async function connectFigmaOfficialPlugin() {
  let callbackWaiter: FigmaOAuthCallbackWaiter | null = null;
  try {
    const baseConfig = buildNextFigmaOfficialRuntimeConfig(loadGlobalRuntimeConfig());
    saveGlobalRuntimeConfig(baseConfig);

    const expectedState = randomUUID();
    callbackWaiter = await createFigmaOAuthCallbackWaiter(expectedState);
    const provider = new FigmaRuntimeOAuthProvider(callbackWaiter.redirectUrl, expectedState, async (url) => {
      const authorizationUrl = url.toString();
      clipboard.writeText(authorizationUrl);
      shell.openExternal(authorizationUrl).catch((error) => {
        console.error("[figma-official] failed to open external browser:", error);
      });
      const messageBoxOptions: MessageBoxOptions = {
        type: "info",
        buttons: ["知道了"],
        defaultId: 0,
        title: "Figma 授权链接已复制",
        message: "Figma 授权链接已复制到剪贴板",
        detail: [
          "如果外部浏览器没有自动打开，请直接到你已登录 Figma 的外部浏览器粘贴打开。",
          "",
          authorizationUrl,
        ].join("\n"),
      };
      void (mainWindow
        ? dialog.showMessageBox(mainWindow, messageBoxOptions)
        : dialog.showMessageBox(messageBoxOptions));
    });

    const client = new Client({ name: "tech-cc-hub", version: app.getVersion() }, { capabilities: {} });
    const connectWithOAuth = async (): Promise<StreamableHTTPClientTransport> => {
      const transport = new StreamableHTTPClientTransport(new URL(FIGMA_MCP_URL), { authProvider: provider });
      try {
        await client.connect(transport);
        return transport;
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) {
          throw error;
        }
        const authorizationCode = await callbackWaiter!.waitForCode;
        await transport.finishAuth(authorizationCode);
        return await connectWithOAuth();
      }
    };

    const transport = await connectWithOAuth();
    const tools = await client.listTools().catch(() => ({ tools: [] }));
    const toolNames = extractFigmaMcpToolNames(tools.tools);
    await transport.close().catch(() => undefined);

    const oauth = provider.toRuntimeTokens();
    if (!oauth?.access_token) {
      throw new Error("Figma OAuth did not return an access token.");
    }

    const nextConfig = buildNextFigmaOfficialAuthStateRuntimeConfig(loadGlobalRuntimeConfig(), "ready", {
      oauth,
      tools: toolNames,
      toolCount: toolNames.length,
      lastToolCheckedAt: Date.now(),
    });
    saveGlobalRuntimeConfig(nextConfig);
    return {
      ...getFigmaOfficialPluginStatusFromConfig(nextConfig),
      success: true,
      message: `Figma 授权完成，已写入官方 MCP 配置。已检测到 ${toolNames.length} 个工具。`,
    };
  } catch (error) {
    const rawMessage = getErrorMessage(error);
    const message = isLikelyFigmaRemoteClientRestriction(rawMessage)
      ? [
        "Figma 远程 MCP 拒绝了当前客户端的 OAuth 初始化。",
        "官方远程 MCP 目前只允许 MCP Catalog 中的受支持客户端直接连接；请使用 Codex 官方授权，或切换到 Figma Desktop MCP。",
        `原始错误：${rawMessage}`,
      ].join(" ")
      : rawMessage;
    const nextConfig = buildNextFigmaOfficialAuthStateRuntimeConfig(loadGlobalRuntimeConfig(), "needs-auth", { error: message, oauth: null });
    saveGlobalRuntimeConfig(nextConfig);
    return {
      ...getFigmaOfficialPluginStatusFromConfig(nextConfig),
      success: false,
      message,
      error: message,
    };
  } finally {
    await callbackWaiter?.close();
  }
}

function isLikelyFigmaRemoteClientRestriction(message: string) {
  return /403|forbidden|mcp:connect|invalid oauth error response/i.test(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function broadcastAppUpdateStatus(status: AppUpdateStatus): void {
  const payload = JSON.stringify(status);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("app-update-status", payload);
  }
}

const TERMINAL_DEFAULT_TIMEOUT_MS = 120_000;
const TERMINAL_MAX_TIMEOUT_MS = 10 * 60_000;
const TERMINAL_MAX_OUTPUT_CHARS = 200_000;
const TERMINAL_PROCESS_TAIL_CHARS = 60_000;
const TERMINAL_PROCESS_HISTORY_LIMIT = 30;

type TerminalProcessStatus = "running" | "exited" | "killed" | "error";

type TerminalProcessRecord = {
  id: string;
  command: string;
  cwd: string;
  shell: string;
  pid?: number;
  startedAt: number;
  endedAt?: number;
  exitCode?: number | null;
  signal?: string | null;
  stdoutTail: string;
  stderrTail: string;
  status: TerminalProcessStatus;
  error?: string;
  stopRequested?: boolean;
  child?: ChildProcessWithoutNullStreams;
};

type TerminalProcessInfo = Omit<TerminalProcessRecord, "child" | "stopRequested"> & {
  running: boolean;
};

const terminalProcesses = new Map<string, TerminalProcessRecord>();

function clampTerminalTimeoutMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return TERMINAL_DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1_000, Math.min(TERMINAL_MAX_TIMEOUT_MS, Math.floor(value)));
}

function appendTerminalOutput(current: string, chunk: Buffer): string {
  if (current.length >= TERMINAL_MAX_OUTPUT_CHARS) {
    return current;
  }
  const text = chunk.toString("utf8");
  const remaining = TERMINAL_MAX_OUTPUT_CHARS - current.length;
  if (text.length <= remaining) {
    return `${current}${text}`;
  }
  const marker = "\n...[output truncated]";
  const available = Math.max(0, remaining - marker.length);
  return `${current}${text.slice(0, available)}${marker}`;
}

function appendTerminalTail(current: string, chunk: Buffer): string {
  const next = `${current}${chunk.toString("utf8")}`;
  return next.length > TERMINAL_PROCESS_TAIL_CHARS
    ? next.slice(next.length - TERMINAL_PROCESS_TAIL_CHARS)
    : next;
}

function resolveTerminalCwd(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return process.cwd();
  }
  try {
    const realPath = realpathSync(value.trim());
    if (statSync(realPath).isDirectory()) {
      return realPath;
    }
  } catch {
    // Fall back to the app working directory if the session cwd disappeared.
  }
  return process.cwd();
}

function buildTerminalShell(command: string): { command: string; args: string[]; label: string } {
  if (process.platform === "win32") {
    const shellCommand = "powershell.exe";
    return {
      command: shellCommand,
      args: ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      label: shellCommand,
    };
  }
  const shellCommand = process.env.SHELL || "bash";
  return {
    command: shellCommand,
    args: ["-lc", command],
    label: shellCommand.split(/[\\/]/).pop() || "bash",
  };
}

function toTerminalProcessInfo(record: TerminalProcessRecord): TerminalProcessInfo {
  return {
    id: record.id,
    command: record.command,
    cwd: record.cwd,
    shell: record.shell,
    pid: record.pid,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    exitCode: record.exitCode,
    signal: record.signal,
    stdoutTail: record.stdoutTail,
    stderrTail: record.stderrTail,
    status: record.status,
    error: record.error,
    running: record.status === "running",
  };
}

function pruneTerminalProcessHistory(): void {
  const completed = [...terminalProcesses.values()]
    .filter((record) => record.status !== "running")
    .sort((left, right) => (right.endedAt ?? right.startedAt) - (left.endedAt ?? left.startedAt));

  for (const record of completed.slice(TERMINAL_PROCESS_HISTORY_LIMIT)) {
    terminalProcesses.delete(record.id);
  }
}

function finishTerminalProcess(
  record: TerminalProcessRecord,
  result: { exitCode?: number | null; signal?: string | null; error?: string },
): void {
  if (record.status !== "running") return;
  record.endedAt = Date.now();
  record.exitCode = result.exitCode ?? null;
  record.signal = result.signal ?? null;
  record.error = result.error;
  record.status = result.error ? "error" : record.stopRequested ? "killed" : "exited";
  record.child = undefined;
  pruneTerminalProcessHistory();
}

function readTerminalProcessId(request: unknown): string {
  const payload = request && typeof request === "object" ? request as { id?: unknown; processId?: unknown } : {};
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const processId = typeof payload.processId === "string" ? payload.processId.trim() : "";
  return id || processId;
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
    });
    let stderr = "";
    killer.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendTerminalTail(stderr, chunk);
    });
    killer.on("error", reject);
    killer.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `taskkill exited with code ${code ?? "unknown"}`));
    });
  });
}

async function stopProcessTree(record: TerminalProcessRecord): Promise<void> {
  if (!record.pid) {
    record.child?.kill();
    return;
  }

  if (process.platform === "win32") {
    await runTaskkill(record.pid);
    return;
  }

  try {
    process.kill(-record.pid, "SIGTERM");
  } catch {
    record.child?.kill("SIGTERM");
  }
}

function stopProcessTreeSync(record: TerminalProcessRecord): void {
  if (!record.pid) {
    record.child?.kill();
    return;
  }

  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${record.pid} /T /F`, { stdio: "ignore" });
      return;
    }
    process.kill(-record.pid, "SIGTERM");
  } catch {
    try {
      record.child?.kill();
    } catch {
      // Process is already gone.
    }
  }
}

function startTerminalProcessForRenderer(request: unknown): {
  success: boolean;
  process?: TerminalProcessInfo;
  error?: string;
} {
  const payload = request && typeof request === "object" ? request as { command?: unknown; cwd?: unknown } : {};
  const command = typeof payload.command === "string" ? payload.command.trim() : "";
  const cwd = resolveTerminalCwd(payload.cwd);
  const shellInfo = buildTerminalShell(command);

  if (!command) {
    return { success: false, error: "请输入命令。" };
  }

  try {
    const child = spawn(shellInfo.command, shellInfo.args, {
      cwd,
      env: process.env,
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    const record: TerminalProcessRecord = {
      id: randomUUID(),
      command,
      cwd,
      shell: shellInfo.label,
      pid: child.pid,
      startedAt: Date.now(),
      stdoutTail: "",
      stderrTail: "",
      status: "running",
      child,
    };

    terminalProcesses.set(record.id, record);

    child.stdout?.on("data", (chunk: Buffer) => {
      record.stdoutTail = appendTerminalTail(record.stdoutTail, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      record.stderrTail = appendTerminalTail(record.stderrTail, chunk);
    });
    child.on("error", (error) => {
      finishTerminalProcess(record, { exitCode: null, error: error.message });
    });
    child.on("close", (code, signal) => {
      finishTerminalProcess(record, { exitCode: code, signal });
    });

    return { success: true, process: toTerminalProcessInfo(record) };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

function listTerminalProcessesForRenderer(): {
  success: boolean;
  processes: TerminalProcessInfo[];
} {
  const processes = [...terminalProcesses.values()]
    .sort((left, right) => {
      if (left.status === "running" && right.status !== "running") return -1;
      if (left.status !== "running" && right.status === "running") return 1;
      return right.startedAt - left.startedAt;
    })
    .map(toTerminalProcessInfo);
  return { success: true, processes };
}

async function stopTerminalProcessForRenderer(request: unknown): Promise<{
  success: boolean;
  process?: TerminalProcessInfo;
  error?: string;
}> {
  const id = readTerminalProcessId(request);
  const record = id ? terminalProcesses.get(id) : undefined;
  if (!record) {
    return { success: false, error: "后台进程不存在或已清理。" };
  }
  if (record.status !== "running") {
    return { success: true, process: toTerminalProcessInfo(record) };
  }

  record.stopRequested = true;
  try {
    await stopProcessTree(record);
    return { success: true, process: toTerminalProcessInfo(record) };
  } catch (error) {
    record.error = getErrorMessage(error);
    return { success: false, process: toTerminalProcessInfo(record), error: record.error };
  }
}

function cleanupTerminalProcesses(): void {
  for (const record of terminalProcesses.values()) {
    if (record.status !== "running") continue;
    record.stopRequested = true;
    stopProcessTreeSync(record);
  }
}

function runTerminalCommandForRenderer(request: unknown): Promise<{
  success: boolean;
  command: string;
  cwd: string;
  shell: string;
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  elapsedMs: number;
  error?: string;
}> {
  const payload = request && typeof request === "object" ? request as { command?: unknown; cwd?: unknown; timeoutMs?: unknown } : {};
  const command = typeof payload.command === "string" ? payload.command.trim() : "";
  const cwd = resolveTerminalCwd(payload.cwd);
  const timeoutMs = clampTerminalTimeoutMs(payload.timeoutMs);
  const shellInfo = buildTerminalShell(command);
  const startedAt = Date.now();

  if (!command) {
    return Promise.resolve({
      success: false,
      command,
      cwd,
      shell: shellInfo.label,
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      elapsedMs: 0,
      error: "请输入命令。",
    });
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(shellInfo.command, shellInfo.args, {
      cwd,
      env: process.env,
      windowsHide: true,
    });
    const finish = (result: {
      exitCode: number | null;
      signal?: string | null;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        success: !timedOut && !result.error && result.exitCode === 0,
        command,
        cwd,
        shell: shellInfo.label,
        exitCode: result.exitCode,
        signal: result.signal,
        stdout,
        stderr,
        timedOut,
        elapsedMs: Date.now() - startedAt,
        error: result.error,
      });
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendTerminalOutput(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendTerminalOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      finish({ exitCode: null, error: error.message });
    });
    child.on("close", (code, signal) => {
      finish({ exitCode: code, signal });
    });
  });
}

ipcMain.handle("preview-list-directory", (_event, request: unknown) => listPreviewDirectoryForRenderer(request));
ipcMain.handle("preview-list-files", (_event, request: unknown) => listPreviewFilesForRenderer(request));
ipcMain.handle("sessions:list", (_event, payload?: { archived?: boolean; limit?: number }) => ({
  sessions: listStoredSessionsForRenderer(Boolean(payload?.archived), {
    limit: typeof payload?.limit === "number" ? payload.limit : undefined,
  }),
  archived: Boolean(payload?.archived),
}));
ipcMain.handle("slash-commands:list", (_event, payload?: { cwd?: string }) => ({
  commands: buildSessionSlashCommandItems({ cwd: payload?.cwd }) ?? [],
}));
ipcMain.handle("codegraph:status", async (_event, payload: unknown) => {
  try {
    return await handleCodeGraphUiInvoke("codegraph:status", payload);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
ipcMain.handle("codegraph:sync", async (_event, payload: unknown) => {
  try {
    return await handleCodeGraphUiInvoke("codegraph:sync", payload);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
ipcMain.handle("plugins:getOpenComputerUseStatus", () => getOpenComputerUsePluginStatus());
ipcMain.handle("plugins:checkOpenComputerUseUpdate", () => checkOpenComputerUsePluginUpdate());
ipcMain.handle("plugins:installOpenComputerUse", () => installOpenComputerUsePlugin());
ipcMain.handle("plugins:updateOpenComputerUse", () => updateOpenComputerUsePlugin());
ipcMain.handle("plugins:getClaudeCodePluginDetails", () => resolveClaudeCodePluginDetails());
ipcMain.handle("plugins:getFigmaOfficialStatus", () => getFigmaOfficialPluginStatus());
ipcMain.handle("plugins:installFigmaOfficial", () => installFigmaOfficialPlugin());
ipcMain.handle("plugins:connectFigmaOfficial", () => connectFigmaOfficialPlugin());
ipcMain.handle("plugins:connectFigmaCodexOfficial", () => connectFigmaCodexOfficialPlugin());
ipcMain.handle("plugins:connectFigmaPatOfficial", (_event, token: unknown) => connectFigmaPatOfficialPlugin(token));
ipcMain.handle("plugins:connectFigmaDesktopOfficial", () => connectFigmaDesktopOfficialPlugin());
ipcMain.handle("terminal:run", (_event, request: unknown) => runTerminalCommandForRenderer(request));
ipcMain.handle("terminal:start", (_event, request: unknown) => startTerminalProcessForRenderer(request));
ipcMain.handle("terminal:list", () => listTerminalProcessesForRenderer());
ipcMain.handle("terminal:stop", (_event, request: unknown) => stopTerminalProcessForRenderer(request));
ipcMain.handle("shell:openExternal", async (_event, url: unknown) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return { success: false, error: "Invalid external URL." };
  }
  await shell.openExternal(url);
  return { success: true };
});
ipcMain.handle("preview-read-file", (_event, request: unknown) => readPreviewFileForRenderer(request));
ipcMain.handle("preview-get-image-base64", (_event, request: unknown) => readPreviewFileForRenderer(request));
ipcMain.handle("preview-get-file-metadata", (_event, request: unknown) => getPreviewFileMetadataForRenderer(request));
ipcMain.handle("preview-write-file", (_event, request: unknown) => writePreviewFileForRenderer(request));
ipcMain.handle("preview-remove-entry", (_event, request: unknown) => removePreviewEntryForRenderer(request));
ipcMain.handle("preview-rename-entry", (_event, request: unknown) => renamePreviewEntryForRenderer(request));
ipcMain.handle("preview-open-file", async (_event, request: unknown) => {
  const path = request && typeof request === "object" && typeof (request as { path?: unknown }).path === "string"
    ? (request as { path: string }).path
    : "";
  if (!path) return { success: false, error: "缺少文件路径。" };
  const { shell } = await import("electron");
  const error = await shell.openPath(path);
  return error ? { success: false, error } : { success: true };
});
ipcMain.handle("preview-show-item-in-folder", async (_event, request: unknown) => {
  const path = request && typeof request === "object" && typeof (request as { path?: unknown }).path === "string"
    ? (request as { path: string }).path
    : "";
  if (!path) return { success: false, error: "缺少文件路径。" };
  const { shell } = await import("electron");
  shell.showItemInFolder(path);
  return { success: true };
});
ipcMain.handle("preview-open-dialog", async (_event, options: unknown) => {
  const properties: Electron.OpenDialogOptions["properties"] = options && typeof options === "object" && Array.isArray((options as { properties?: unknown }).properties)
    ? (options as { properties: Electron.OpenDialogOptions["properties"] }).properties
    : ["openDirectory"];
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, { properties })
    : await dialog.showOpenDialog({ properties });
  return result.canceled ? [] : result.filePaths;
});

function buildBrowserWorkbenchFallbackState(): {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  annotationMode: boolean;
} {
  return {
    url: "",
    title: "浏览器预览",
    loading: false,
    canGoBack: false,
    canGoForward: false,
    annotationMode: false,
  };
}

function resolveBrowserWorkbenchSessionId(sessionId?: unknown): string {
  return typeof sessionId === "string" && sessionId.trim()
    ? sessionId.trim()
    : DEFAULT_BROWSER_WORKBENCH_SESSION_ID;
}

function getBrowserWorkbench(sessionId?: unknown): BrowserWorkbenchManager | null {
  if (!mainWindow) return null;

  const resolvedSessionId = resolveBrowserWorkbenchSessionId(sessionId);
  const existing = browserWorkbenches.get(resolvedSessionId);
  if (existing) return existing;

  const manager = new BrowserWorkbenchManager(mainWindow, resolvedSessionId, {
    resolveWorkspaceRoot: () => sessions.getSession(resolvedSessionId)?.cwd ?? process.cwd(),
  });
  manager.addEventListener((event) => {
    for (const listener of browserWorkbenchEventListeners) {
      listener(event);
    }
  });
  browserWorkbenches.set(resolvedSessionId, manager);
  return manager;
}

function closeAllBrowserWorkbenches(): void {
  for (const manager of browserWorkbenches.values()) {
    manager.close();
  }
  browserWorkbenches.clear();
  browserWorkbenchEventListeners.clear();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  for (const view of mainWindow.getBrowserViews()) {
    mainWindow.removeBrowserView(view);
    if (!view.webContents.isDestroyed()) {
      view.webContents.close({ waitForBeforeUnload: false });
    }
  }
}

function hideAllBrowserWorkbenches(): BrowserWorkbenchState[] {
  const hiddenStates: BrowserWorkbenchState[] = [];
  const hiddenBounds: BrowserWorkbenchBounds = { x: 0, y: 0, width: 0, height: 0 };
  for (const manager of browserWorkbenches.values()) {
    hiddenStates.push(manager.setBounds(hiddenBounds));
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    for (const view of mainWindow.getBrowserViews()) {
      mainWindow.removeBrowserView(view);
    }
  }
  return hiddenStates;
}

function isIgnorableStreamError(error: unknown): error is NodeJS.ErrnoException {
    return Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "EPIPE" || error.code === "EIO" || error.code === "ERR_STREAM_DESTROYED"),
    );
}

function installStdIoGuards(): void {
    const swallowBrokenPipe = (error: Error) => {
        if (isIgnorableStreamError(error)) {
            return;
        }
        throw error;
    };

    process.stdout?.on("error", swallowBrokenPipe);
    process.stderr?.on("error", swallowBrokenPipe);
    process.on("uncaughtException", (error) => {
        if (isIgnorableStreamError(error)) {
            return;
        }
        throw error;
    });
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
    if (!isDev()) {
        await window.loadFile(getUIPath());
        return;
    }

    const devUrl = `http://localhost:${DEV_PORT}`;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try {
            await window.loadURL(devUrl);
            return;
        } catch (error) {
            lastError = error;
            if (attempt === 30) break;
            await sleep(300);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`无法连接开发服务器：${devUrl}`);
}

async function scheduleDevAutostart(): Promise<void> {
    if (!isDev()) return;

    const prompt = process.env.AGENT_COWORK_DEV_AUTOSTART_PROMPT?.trim();
    if (!prompt) return;
    const continuePrompt = process.env.AGENT_COWORK_DEV_CONTINUE_PROMPT?.trim();

    const cwd = process.env.AGENT_COWORK_DEV_AUTOSTART_CWD?.trim() || undefined;

    setTimeout(async () => {
        try {
            const title = await generateSessionTitle(prompt);
            void handleClientEvent({
                type: "session.start",
                payload: { title, prompt, cwd, allowedTools: "*" }
            });

            if (!continuePrompt) return;

            const deadline = Date.now() + 60_000;
            const timer = setInterval(() => {
                if (!sessions) return;
                const latest = sessions
                    .listSessions()
                    .find((session) => session.lastPrompt === prompt);

                if (!latest) return;

                if (latest.status === "completed" && latest.claudeSessionId) {
                    clearInterval(timer);
                    void handleClientEvent({
                        type: "session.continue",
                        payload: { sessionId: latest.id, prompt: continuePrompt }
                    });
                    return;
                }

                if (latest.status === "error" || Date.now() > deadline) {
                    clearInterval(timer);
                    console.error("[dev-autostart] Continue prompt skipped because the initial session did not complete in time.");
                }
            }, 1500);
        } catch (error) {
            console.error("[dev-autostart] Failed to bootstrap session:", error);
        }
    }, 1800);
}

function killViteDevServer(): void {
    if (!isDev()) return;
    try {
        if (process.platform === 'win32') {
            execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${DEV_PORT}') do taskkill /PID %a /F`, { stdio: 'ignore', shell: 'cmd.exe' });
        } else {
            execSync(`lsof -ti:${DEV_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
        }
    } catch {
        // Process may already be dead
    }
}

function cleanup(): void {
  if (cleanupComplete) return;
  cleanupComplete = true;

  globalShortcut.unregisterAll();
  stopPolling();
  stopDevBackendBridge?.();
  stopDevBackendBridge = null;
  channelBridgeController?.stop();
  channelBridgeController = null;
  setChannelReplySender(null);
  setBrowserToolHost(null);
  setDesignToolHost(null);
  closeAllBrowserWorkbenches();
  cleanupTerminalProcesses();
    cleanupAllSessions();
    killViteDevServer();
}

function handleSignal(): void {
    cleanup();
    app.quit();
}

function registerReloadShortcuts(): void {
    if (!mainWindow) {
        return;
    }

    const reloadWindow = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            closeAllBrowserWorkbenches();
            mainWindow.webContents.reload();
        }
    };

    const reloadWindowIgnoringCache = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            closeAllBrowserWorkbenches();
            mainWindow.webContents.reloadIgnoringCache();
        }
    };

    const shortcuts = [
        { accelerator: "CommandOrControl+R", handler: reloadWindow },
        { accelerator: "F5", handler: reloadWindow },
        { accelerator: "CommandOrControl+Shift+R", handler: reloadWindowIgnoringCache },
    ];
    const registeredAccelerators = new Set<string>();

    const registerFocusedShortcuts = () => {
        if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) {
            return;
        }

        for (const shortcut of shortcuts) {
            if (registeredAccelerators.has(shortcut.accelerator)) {
                continue;
            }

            try {
                const registered = globalShortcut.register(shortcut.accelerator, shortcut.handler);
                if (registered) {
                    registeredAccelerators.add(shortcut.accelerator);
                    continue;
                }
                console.warn(`[main] Failed to register focused shortcut: ${shortcut.accelerator}`);
            } catch (error) {
                console.warn(`[main] Failed to bind focused shortcut ${shortcut.accelerator}:`, error);
            }
        }
    };

    const unregisterFocusedShortcuts = () => {
        for (const accelerator of registeredAccelerators) {
            globalShortcut.unregister(accelerator);
        }
        registeredAccelerators.clear();
    };

    mainWindow.on("focus", registerFocusedShortcuts);
    mainWindow.on("blur", unregisterFocusedShortcuts);
    mainWindow.on("closed", unregisterFocusedShortcuts);
    registerFocusedShortcuts();
}

function readPromptAttachmentPayload(attachments?: unknown[]): PromptAttachment[] {
    return Array.isArray(attachments) ? (attachments as PromptAttachment[]) : [];
}

type ApiModelsProvider = "custom" | "deepseek" | "codex" | "minimax";

const DEEPSEEK_OPENAI_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic";
const MINIMAX_MODELS_ENDPOINT = `${MINIMAX_ANTHROPIC_BASE_URL}/v1/models`;
let pendingCodexOAuthFlow: ReturnType<typeof createCodexOAuthAuthorizationFlow> | null = null;

function resolveApiModelsProvider(provider: unknown, baseURL: string): ApiModelsProvider {
    if (provider === "custom" || provider === "deepseek" || provider === "codex" || provider === "minimax") {
        return provider;
    }

    try {
        const url = new URL(baseURL);
        if (url.hostname === "api.deepseek.com") return "deepseek";
        if (url.hostname === "chatgpt.com") return "codex";
        if (url.hostname === "api.minimax.io" || url.hostname === "api.minimaxi.com") return "minimax";
    } catch {
        // Invalid URLs are handled by the generic path below.
    }

    return "custom";
}

function normalizeApiBaseURLForModels(value: string, provider: ApiModelsProvider): string {
    if (provider === "deepseek") {
        return DEEPSEEK_ANTHROPIC_BASE_URL;
    }
    if (provider === "codex") {
        return CODEX_OAUTH_BASE_URL;
    }
    if (provider === "minimax") {
        return MINIMAX_ANTHROPIC_BASE_URL;
    }

    const trimmed = value.trim();
    if (!trimmed) return "";

    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "");

    if (!pathname || pathname === "/" || pathname.startsWith("/console")) {
        url.pathname = "/v1";
    } else if (pathname.endsWith("/models")) {
        url.pathname = pathname.replace(/\/models$/, "");
    }

    return url.toString().replace(/\/$/, "");
}

function buildModelsEndpoint(baseURL: string, provider: ApiModelsProvider): { endpoint: string; normalizedBaseURL: string } {
    if (provider === "deepseek") {
        return {
            endpoint: `${DEEPSEEK_OPENAI_BASE_URL}/models`,
            normalizedBaseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
        };
    }
    if (provider === "codex") {
        return {
            endpoint: `${CODEX_OAUTH_BASE_URL}/backend-api/codex/models`,
            normalizedBaseURL: CODEX_OAUTH_BASE_URL,
        };
    }
    if (provider === "minimax") {
        return {
            endpoint: MINIMAX_MODELS_ENDPOINT,
            normalizedBaseURL: MINIMAX_ANTHROPIC_BASE_URL,
        };
    }

    const normalizedBaseURL = normalizeApiBaseURLForModels(baseURL, provider);
    const url = new URL(normalizedBaseURL);
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname.endsWith("/v1") ? `${pathname}/models` : `${pathname}/v1/models`;
    return {
        endpoint: url.toString(),
        normalizedBaseURL,
    };
}

function getMiniMaxFallbackContextWindow(modelName: string): number {
    return modelName === MINIMAX_DEFAULT_MODEL ? MINIMAX_M3_CONTEXT_WINDOW : MINIMAX_M2_CONTEXT_WINDOW;
}

function readCodexModelIdsFromCache(): string[] {
    const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
    const cachePath = join(codexHome, "models_cache.json");
    if (!existsSync(cachePath)) {
        return [];
    }

    try {
        return extractCodexModelIdsFromCache(JSON.parse(readFileSync(cachePath, "utf8")));
    } catch (error) {
        console.warn("[codex] failed to read models cache:", error);
        return [];
    }
}

async function fetchApiModels(payload: { baseURL?: string; apiKey?: string; provider?: ApiModelsProvider }): Promise<{ success: boolean; models?: ImportedApiModel[]; baseURL?: string; error?: string }> {
    const rawBaseURL = payload?.baseURL?.trim() ?? "";
    const apiKey = payload?.apiKey?.trim() ?? "";
    const provider = resolveApiModelsProvider(payload?.provider, rawBaseURL);
    const baseURL = rawBaseURL || (provider === "deepseek"
        ? DEEPSEEK_ANTHROPIC_BASE_URL
        : provider === "codex"
            ? CODEX_OAUTH_BASE_URL
            : provider === "minimax"
                ? MINIMAX_ANTHROPIC_BASE_URL
                : "");

    if (!baseURL) {
        return { success: false, error: "请先填写接口地址。" };
    }
    if (provider === "codex") {
        const cacheModels = readCodexModelIdsFromCache();
        return {
            success: true,
            models: toImportedApiModels(mergeCodexModelIds(cacheModels), 200_000),
            baseURL: CODEX_OAUTH_BASE_URL,
        };
    }
    if (!apiKey) {
        return { success: false, error: "请先填写 API 密钥。" };
    }

    try {
        const { endpoint, normalizedBaseURL } = buildModelsEndpoint(baseURL, provider);
        const response = await fetch(endpoint, {
            headers: {
                authorization: `Bearer ${apiKey}`,
                "x-api-key": apiKey,
            },
        });

        if (!response.ok) {
            const message = await response.text();
            return { success: false, error: message || response.statusText };
        }

        const responsePayload = await response.json() as unknown;
        const fallbackContextWindow = provider === "deepseek" ? 1_000_000 : undefined;
        const models = extractApiModelsFromListPayload(responsePayload).map((model) => ({
            ...model,
            contextWindow: model.contextWindow ?? (provider === "minimax" ? getMiniMaxFallbackContextWindow(model.name) : fallbackContextWindow),
        }));
        if (models.length === 0) {
            return { success: false, error: "接口没有返回可用模型。" };
        }

        return {
            success: true,
            models,
            baseURL: normalizedBaseURL,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

function buildMessagesEndpoint(baseURL: string, provider: ApiModelsProvider): { endpoint: string; normalizedBaseURL: string } {
    if (provider === "deepseek") {
        return {
            endpoint: `${DEEPSEEK_ANTHROPIC_BASE_URL}/v1/messages`,
            normalizedBaseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
        };
    }
    if (provider === "codex") {
        return {
            endpoint: `${CODEX_OAUTH_BASE_URL}/backend-api/codex/responses`,
            normalizedBaseURL: CODEX_OAUTH_BASE_URL,
        };
    }
    if (provider === "minimax") {
        return {
            endpoint: `${MINIMAX_ANTHROPIC_BASE_URL}/v1/messages`,
            normalizedBaseURL: MINIMAX_ANTHROPIC_BASE_URL,
        };
    }

    const normalizedBaseURL = normalizeApiBaseURLForModels(baseURL, provider);
    const url = new URL(normalizedBaseURL);
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname.endsWith("/v1") ? `${pathname}/messages` : `${pathname}/v1/messages`;
    return {
        endpoint: url.toString(),
        normalizedBaseURL,
    };
}

function extractApiErrorText(payload: string): string {
    const trimmed = payload.trim();
    if (!trimmed) {
        return "";
    }

    try {
        const parsed = JSON.parse(trimmed) as { error?: { message?: unknown }; message?: unknown };
        const message = parsed.error?.message ?? parsed.message;
        return typeof message === "string" && message.trim() ? message.trim() : trimmed;
    } catch {
        return trimmed;
    }
}

async function testApiConfig(payload: { baseURL?: string; apiKey?: string; model?: string; provider?: ApiModelsProvider }): Promise<{ success: boolean; message?: string; endpoint?: string; model?: string; error?: string }> {
    const rawBaseURL = payload?.baseURL?.trim() ?? "";
    const apiKey = payload?.apiKey?.trim() ?? "";
    const model = payload?.model?.trim() ?? "";
    const provider = resolveApiModelsProvider(payload?.provider, rawBaseURL);
    const baseURL = rawBaseURL || (provider === "deepseek"
        ? DEEPSEEK_ANTHROPIC_BASE_URL
        : provider === "codex"
            ? CODEX_OAUTH_BASE_URL
            : provider === "minimax"
                ? MINIMAX_ANTHROPIC_BASE_URL
                : "");

    if (!baseURL || !apiKey || !model) {
        return { success: false, error: provider === "codex" ? "请先完成 Codex OAuth 授权并选择默认主模型。" : "请先填写接口地址、API Key 和默认主模型。" };
    }

    try {
        if (provider === "codex") {
            const credential = parseCodexOAuthCredential(apiKey);
            const codexRequest = buildCodexResponsesRequest({
                model,
                max_tokens: 8,
                messages: [
                    {
                        role: "user",
                        content: "ping",
                    },
                ],
            });
            const endpoint = new URL(getCodexResponsesPath(model), CODEX_OAUTH_BASE_URL).toString();
            const response = await fetch(endpoint, {
                method: "POST",
                headers: buildCodexRequestHeaders(credential, true),
                body: JSON.stringify({
                    ...codexRequest,
                    stream: true,
                }),
            });
            const responseText = await response.text();
            if (!response.ok) {
                return {
                    success: false,
                    endpoint,
                    model,
                    error: extractApiErrorText(responseText) || response.statusText,
                };
            }
            const message = toAnthropicMessageResponse(parseCodexResponsesStream(responseText), model);
            return {
                success: true,
                endpoint,
                model,
                message: `测试通过：${message.model || model} 已通过 Codex OAuth 响应。`,
            };
        }

        const { endpoint } = buildMessagesEndpoint(baseURL, provider);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "anthropic-version": "2023-06-01",
                authorization: `Bearer ${apiKey}`,
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                model,
                max_tokens: 8,
                messages: [
                    {
                        role: "user",
                        content: "ping",
                    },
                ],
            }),
        });
        const responseText = await response.text();
        if (!response.ok) {
            return {
                success: false,
                endpoint,
                model,
                error: extractApiErrorText(responseText) || response.statusText,
            };
        }

        return {
            success: true,
            endpoint,
            model,
            message: `测试通过：${model} 已响应。`,
        };
    } catch (error) {
        return {
            success: false,
            model,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

type PromptOptimizeResult = {
    success: boolean;
    optimizedPrompt?: string;
    model?: string;
    error?: string;
};

const PROMPT_OPTIMIZE_TIMEOUT_MS = 45_000;
const PROMPT_OPTIMIZE_MAX_INPUT_CHARS = 20_000;
const PROMPT_OPTIMIZE_MAX_TOKENS = 1_800;

function buildPromptOptimizeMessages(prompt: string): Array<{ role: "user"; content: string }> {
    return [{
        role: "user",
        content: [
            "请优化下面这段用户输入，让它更适合作为 agent 执行 prompt。",
            "",
            "要求：",
            "- 保留原意、语言和关键信息，不要编造用户没有说的事实。",
            "- 如果原文是中文，输出中文；如果原文是英文，输出英文。",
            "- 让目标、上下文、约束、期望输出和验收标准更清楚。",
            "- 只输出优化后的 prompt 正文，不要解释，不要 Markdown 代码围栏。",
            "",
            "原始 prompt：",
            prompt,
        ].join("\n"),
    }];
}

function sanitizeOptimizedPrompt(text: string): string {
    return text
        .trim()
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim()
        .replace(/^```(?:markdown|md|text)?[^\S\r\n]*(?:\r?\n|$)/i, "")
        .replace(/\r?\n```[^\S\r\n]*$/i, "")
        .replace(/^(?:优化后的\s*)?(?:prompt|提示词|提示)\s*[：:]\s*/i, "")
        .trim();
}

function extractOptimizedPromptText(payload: unknown): string {
    if (!payload || typeof payload !== "object") {
        return "";
    }

    const record = payload as Record<string, unknown>;
    const content = record.content;
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((block) => {
                if (!block || typeof block !== "object") return "";
                const text = (block as { text?: unknown }).text;
                return typeof text === "string" ? text : "";
            })
            .filter(Boolean)
            .join("\n");
    }

    const choices = record.choices;
    if (Array.isArray(choices)) {
        return choices
            .map((choice) => {
                if (!choice || typeof choice !== "object") return "";
                const choiceRecord = choice as { message?: { content?: unknown }; text?: unknown };
                if (typeof choiceRecord.message?.content === "string") return choiceRecord.message.content;
                if (typeof choiceRecord.text === "string") return choiceRecord.text;
                return "";
            })
            .filter(Boolean)
            .join("\n");
    }

    return "";
}

async function optimizePrompt(payload: { prompt?: string; model?: string }): Promise<PromptOptimizeResult> {
    const prompt = payload?.prompt?.trim() ?? "";
    if (!prompt) {
        return { success: false, error: "请先在输入框里写一段 prompt。" };
    }
    if (prompt.length > PROMPT_OPTIMIZE_MAX_INPUT_CHARS) {
        return { success: false, error: `当前 prompt 过长，请先压缩到 ${PROMPT_OPTIMIZE_MAX_INPUT_CHARS} 字以内。` };
    }

    const resolved = resolveApiConfigForModel(payload?.model);
    if (!resolved) {
        return { success: false, error: "当前没有可用模型，请先在设置里启用配置。" };
    }

    const config = resolved.config;
    const model = resolved.model;
    const provider = resolveApiModelsProvider(config.provider, config.baseURL);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROMPT_OPTIMIZE_TIMEOUT_MS);

    try {
        const messages = buildPromptOptimizeMessages(prompt);
        const system = "你是一个严谨的 prompt 优化器。你的输出会直接替换用户输入框内容，所以只能输出优化后的 prompt 正文。";

        if (provider === "codex") {
            const credential = parseCodexOAuthCredential(config.apiKey);
            const codexRequest = buildCodexResponsesRequest({
                model,
                max_tokens: PROMPT_OPTIMIZE_MAX_TOKENS,
                messages: [
                    { role: "user", content: `${system}\n\n${messages[0].content}` },
                ],
            });
            const endpoint = new URL(getCodexResponsesPath(model), CODEX_OAUTH_BASE_URL).toString();
            const response = await fetch(endpoint, {
                method: "POST",
                signal: controller.signal,
                headers: buildCodexRequestHeaders(credential, true),
                body: JSON.stringify({
                    ...codexRequest,
                    stream: true,
                }),
            });
            const responseText = await response.text();
            if (!response.ok) {
                return { success: false, model, error: extractApiErrorText(responseText) || response.statusText };
            }

            const message = toAnthropicMessageResponse(parseCodexResponsesStream(responseText), model);
            const optimizedPrompt = sanitizeOptimizedPrompt(extractOptimizedPromptText(message));
            if (!optimizedPrompt) {
                return { success: false, model, error: "模型没有返回可用的优化结果。" };
            }
            return { success: true, model, optimizedPrompt };
        }

        const { endpoint } = buildMessagesEndpoint(config.baseURL, provider);
        const response = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "content-type": "application/json",
                "anthropic-version": "2023-06-01",
                authorization: `Bearer ${config.apiKey}`,
                "x-api-key": config.apiKey,
            },
            body: JSON.stringify({
                model,
                max_tokens: PROMPT_OPTIMIZE_MAX_TOKENS,
                temperature: 0.2,
                system,
                messages,
            }),
        });
        const responseText = await response.text();
        let responsePayload: unknown = {};
        try {
            responsePayload = responseText ? JSON.parse(responseText) : {};
        } catch {
            responsePayload = {};
        }
        if (!response.ok) {
            return { success: false, model, error: extractApiErrorText(responseText) || response.statusText };
        }

        const optimizedPrompt = sanitizeOptimizedPrompt(extractOptimizedPromptText(responsePayload));
        if (!optimizedPrompt) {
            return { success: false, model, error: "模型没有返回可用的优化结果。" };
        }
        return { success: true, model, optimizedPrompt };
    } catch (error) {
        const errorMessage = error instanceof Error && error.name === "AbortError"
            ? "Prompt 优化超时，请稍后重试。"
            : error instanceof Error ? error.message : String(error);
        return { success: false, model, error: errorMessage };
    } finally {
        clearTimeout(timer);
    }
}

async function startCodexOAuth(): Promise<{ success: boolean; authorizeUrl?: string; error?: string }> {
    try {
        pendingCodexOAuthFlow = createCodexOAuthAuthorizationFlow();
        await shell.openExternal(pendingCodexOAuthFlow.authorizeUrl);
        return {
            success: true,
            authorizeUrl: pendingCodexOAuthFlow.authorizeUrl,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function completeCodexOAuth(payload: { input?: string }): Promise<{ success: boolean; credential?: string; accountId?: string; email?: string; expiresAt?: string; error?: string }> {
    try {
        if (!pendingCodexOAuthFlow) {
            throw new Error("Codex OAuth 流程尚未开始或已过期。");
        }
        const { code, state } = parseCodexAuthorizationInput(payload.input ?? "");
        if (!code || !state) {
            throw new Error("回调 URL 必须包含 code 和 state。");
        }
        if (state !== pendingCodexOAuthFlow.state) {
            throw new Error("Codex OAuth state 不匹配，请重新授权。");
        }
        const result = await exchangeCodexAuthorizationCode(code, pendingCodexOAuthFlow.verifier);
        pendingCodexOAuthFlow = null;
        const credential = tokenResultToCredential(result);
        return {
            success: true,
            credential: encodeCodexOAuthCredential(credential),
            accountId: credential.accountId,
            email: credential.email,
            expiresAt: credential.expired,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function refreshCodexOAuth(payload: { apiKey?: string }): Promise<{ success: boolean; credential?: string; accountId?: string; email?: string; expiresAt?: string; error?: string }> {
    try {
        const previous = parseCodexOAuthCredential(payload.apiKey ?? "");
        if (!previous.refreshToken) {
            throw new Error("Codex OAuth 凭据缺少 refresh_token，无法刷新。");
        }
        const result = await refreshCodexOAuthToken(previous.refreshToken);
        const credential = tokenResultToCredential(result, previous);
        return {
            success: true,
            credential: encodeCodexOAuthCredential(credential),
            accountId: credential.accountId,
            email: credential.email,
            expiresAt: credential.expired,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

installStdIoGuards();
app.setName("tech-cc-hub");
configureDesktopNotifications();

function configureDevelopmentRuntimeIsolation(): void {
    if (!isDev()) {
        return;
    }

    const sessionDataPath = process.env.TECH_CC_HUB_DEV_SESSION_DATA_DIR?.trim()
        || join(app.getPath("appData"), "tech-cc-hub-dev-session");
    mkdirSync(sessionDataPath, { recursive: true });
    app.setPath("sessionData", sessionDataPath);

    if (!process.env.TECH_CC_HUB_CODEX_PROXY_PORT?.trim()) {
        process.env.TECH_CC_HUB_CODEX_PROXY_PORT = "14560";
    }
    if (!process.env.TECH_CC_HUB_ANTHROPIC_COMPAT_PROXY_PORT?.trim()) {
        process.env.TECH_CC_HUB_ANTHROPIC_COMPAT_PROXY_PORT = "14562";
    }

    console.info(`[dev] using isolated Electron session data: ${sessionDataPath}`);
    console.info(`[dev] using Codex proxy port: ${process.env.TECH_CC_HUB_CODEX_PROXY_PORT}`);
    console.info(`[dev] using Anthropic compatibility proxy port: ${process.env.TECH_CC_HUB_ANTHROPIC_COMPAT_PROXY_PORT}`);
}

configureDevelopmentRuntimeIsolation();

// Initialize everything when app is ready
app.on("ready", async () => {
    Menu.setApplicationMenu(null);
    try {
        await startup({
            options: {
                env: getEnhancedEnv(),
                pathToClaudeCodeExecutable: getClaudeCodePath(),
            },
            initializeTimeoutMs: 5000,
        });
        console.info("[startup] Claude Code subprocess prewarmed");
    } catch (error) {
        console.warn("[startup] prewarm failed", error instanceof Error ? error.message : String(error));
    }
    const appIconPath = getIconPath();
    if (process.platform === "darwin" && app.dock) {
        app.setActivationPolicy("regular");
        await app.dock.show();
        const dockIcon = nativeImage.createFromPath(appIconPath);
        if (!dockIcon.isEmpty()) {
            app.dock.setIcon(dockIcon);
        }
    }
    // Setup event handlers
    app.on("before-quit", cleanup);
    app.on("will-quit", cleanup);
    app.on("window-all-closed", () => {
        cleanup();
        app.quit();
    });

    process.on("SIGTERM", handleSignal);
    process.on("SIGINT", handleSignal);
    process.on("SIGHUP", handleSignal);

    // Create main window
    mainWindow = new BrowserWindow({
        width: 1480,
        height: 900,
        minWidth: 1180,
        minHeight: 600,
        title: "tech-cc-hub",
        webPreferences: {
            preload: getPreloadPath(),
            spellcheck: process.platform !== "darwin",
        },
        icon: appIconPath,
        titleBarStyle: "hiddenInset",
        backgroundColor: "#FAF9F6",
        trafficLightPosition: { x: 15, y: 18 }
    });
    mainWindow.webContents.on("will-navigate", () => {
        closeAllBrowserWorkbenches();
    });
    mainWindow.webContents.on("did-start-loading", () => {
        closeAllBrowserWorkbenches();
    });
    mainWindow.webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) {
            closeAllBrowserWorkbenches();
        }
    });
    mainWindow.webContents.on("before-input-event", (event, input) => {
        const isReloadShortcut =
            input.key.toLowerCase() === "r" &&
            (input.meta || input.control);
        if (!isReloadShortcut) return;
        closeAllBrowserWorkbenches();
        if (!mainWindow || mainWindow.isDestroyed()) return;
        event.preventDefault();
        if (input.shift) {
            mainWindow.webContents.reloadIgnoringCache();
            return;
        }
        mainWindow.webContents.reload();
    });
    mainWindow.webContents.on("render-process-gone", () => {
        closeAllBrowserWorkbenches();
    });
    mainWindow.on("closed", () => {
        closeAllBrowserWorkbenches();
        mainWindow = null;
    });
    setBrowserToolHost({
      open: (sessionId, url) => getBrowserWorkbench(sessionId)?.open(url) ?? buildBrowserWorkbenchFallbackState(),
      close: (sessionId) => getBrowserWorkbench(sessionId)?.close() ?? buildBrowserWorkbenchFallbackState(),
      setBounds: (sessionId, bounds) => getBrowserWorkbench(sessionId)?.setBounds(bounds) ?? buildBrowserWorkbenchFallbackState(),
      reload: (sessionId) => getBrowserWorkbench(sessionId)?.reload() ?? buildBrowserWorkbenchFallbackState(),
      goBack: (sessionId) => getBrowserWorkbench(sessionId)?.goBack() ?? buildBrowserWorkbenchFallbackState(),
      goForward: (sessionId) => getBrowserWorkbench(sessionId)?.goForward() ?? buildBrowserWorkbenchFallbackState(),
      getState: (sessionId) => getBrowserWorkbench(sessionId)?.getState() ?? buildBrowserWorkbenchFallbackState(),
      getConsoleLogs: (sessionId, limit) => getBrowserWorkbench(sessionId)?.getConsoleLogs(limit) ?? [],
      getNetworkLogs: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "Browser workbench is not initialized." };
        }
        return browserWorkbench.getNetworkLogs(input);
      },
      httpRequest: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "Browser workbench is not initialized." };
        }
        return await browserWorkbench.httpRequest(input);
      },
      extractPageSnapshot: async (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.extractPageSnapshot();
      },
      captureVisible: async (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.captureVisible();
      },
      saveScreenshot: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.saveScreenshot(input);
      },
      savePdf: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.savePdf(input);
      },
      manageCookies: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.manageCookies(input);
      },
      manageStorage: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.manageStorage(input);
      },
      getDomStats: async (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.getDomStats();
      },
      getInteractiveSnapshot: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.getInteractiveSnapshot(input);
      },
      clickElement: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.clickElement(input);
      },
      runElementAction: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.runElementAction(input);
      },
      fillElement: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.fillElement(input);
      },
      getElementInfo: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.getElementInfo(input);
      },
      pressKey: (sessionId, key) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, key, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.pressKey(key);
      },
      sendKeyEvent: (sessionId, action, key) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, action, key, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.sendKeyEvent(action, key);
      },
      sendKeyboardText: (sessionId, action, text) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, action, textLength: text.length, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.sendKeyboardText(action, text);
      },
      sendMouseEvent: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, action: input.action, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.sendMouseEvent(input);
      },
      evaluateJavaScript: async (sessionId, expression) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.evaluateJavaScript(expression);
      },
      scrollPage: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.scrollPage(input);
      },
      waitFor: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.waitFor(input);
      },
      queryNodes: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.queryNodes(input);
      },
      inspectStyles: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.inspectStyles(input);
      },
      applyStyles: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.applyStyles(input);
      },
      inspectAtPoint: async (sessionId, point) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return null;
        }
        return await browserWorkbench.inspectAtPoint(point);
      },
      setAnnotationMode: async (sessionId, enabled) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return buildBrowserWorkbenchFallbackState();
        }
        return await browserWorkbench.setAnnotationMode(enabled);
      },
      clickAt: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return {
            success: false,
            action: input.dblClick ? "dblclick" : "click",
            state: buildBrowserWorkbenchFallbackState(),
            error: "浏览器工作台尚未初始化。",
          };
        }
        return browserWorkbench.clickAt(input);
      },
      dragElement: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.dragElement(input);
      },
      fillForm: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        const errors: string[] = [];
        let filled = 0;
        for (const element of input.elements) {
          const result = await browserWorkbench.runElementAction({
            action: "fill",
            target: element.target,
            value: element.value,
            strategy: element.strategy,
            index: element.index,
          });
          if (result.success) {
            filled += 1;
          } else {
            errors.push(`${element.target}: ${result.error ?? "fill failed"}`);
          }
        }
        return {
          success: errors.length === 0,
          result: {
            filled,
            total: input.elements.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          error: errors.length > 0 ? errors.join("\n") : undefined,
        };
      },
      navigatePage: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return buildBrowserWorkbenchFallbackState();
        }
        const type = input.type || (input.url ? "url" : "reload");
        if (type === "url" && input.url) {
          return browserWorkbench.open(input.url);
        }
        if (type === "back") {
          return browserWorkbench.goBack();
        }
        if (type === "forward") {
          return browserWorkbench.goForward();
        }
        return browserWorkbench.reload();
      },
      resizeView: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return buildBrowserWorkbenchFallbackState();
        }
        return browserWorkbench.resizeView(input);
      },
      handleDialog: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.handleDialog(input);
      },
      uploadFile: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.uploadFile(input);
      },
      enhancedSnapshot: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.enhancedSnapshot(input);
      },
      listNetworkRequests: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.listNetworkRequests(input);
      },
      getNetworkRequest: async (sessionId, reqid) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.getNetworkRequest(reqid);
      },
      listConsoleMessages: (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.listConsoleMessages(input);
      },
      getConsoleMessage: (sessionId, msgid) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.getConsoleMessage(msgid);
      },
      startPerformanceTrace: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.startPerformanceTrace(input);
      },
      stopPerformanceTrace: async (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.stopPerformanceTrace();
      },
      emulate: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, state: buildBrowserWorkbenchFallbackState(), error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.emulate(input);
      },
      listPages: (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return browserWorkbench.listPages();
      },
      selectPage: (sessionId, pageId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return buildBrowserWorkbenchFallbackState();
        }
        return browserWorkbench.selectPage(pageId);
      },
      newPage: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return buildBrowserWorkbenchFallbackState();
        }
        return await browserWorkbench.newPage(input);
      },
      evaluateScriptEnhanced: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.evaluateScriptEnhanced(input);
      },
    });
    setDesignToolHost({
      getState: (sessionId) => getBrowserWorkbench(sessionId)?.getState() ?? buildBrowserWorkbenchFallbackState(),
      getElementInfo: async (sessionId, input) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.getElementInfo(input);
      },
      captureVisible: async (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.captureVisible();
      },
    });

    try {
        await loadRenderer(mainWindow);
        mainWindow.show();
        mainWindow.focus();
        if (process.platform === "darwin") {
            app.focus({ steal: true });
        }
    } catch (error) {
        console.error("[main] Failed to load renderer:", error);
        dialog.showErrorBox(
            "桌面端启动失败",
            error instanceof Error ? error.message : String(error)
        );
        cleanup();
        app.quit();
        return;
    }
    appAutoUpdater.initialize(broadcastAppUpdateStatus);

    globalShortcut.register('CommandOrControl+Q', () => {
        cleanup();
        app.quit();
    });
    registerReloadShortcuts();

    pollResources(mainWindow);
    void scheduleDevAutostart();
    registerSkillManagerHandlers();
    registerGitWorkbenchIpcHandlers();
    const cronBusyGuard = new CronBusyGuard();
    const systemWorkspacePath = ensureSystemWorkspace();

    const sendCronMessage = async (conversationId: string, text: string, executionMode?: string) => {
      const store = sessions;
      if (!store) {
        console.error("[CronExecutor] SessionStore 未初始化");
        return;
      }

      // new_conversation mode: always create a fresh session
      if (executionMode === "new_conversation") {
        const cwd =
          conversationId === "__system__"
            ? systemWorkspacePath
            : (store.getSession(conversationId)?.cwd ?? systemWorkspacePath);
        await handleClientEvent({
          type: "session.start",
          payload: { title: "定时任务", cwd, prompt: text },
        });
        return;
      }

      // System workspace tasks: find or create a system session
      if (conversationId === "__system__") {
        const allSessions = store.listSessions();
        const systemSession = allSessions.find((s) => s.cwd === systemWorkspacePath);

        if (systemSession) {
          await handleClientEvent({
            type: "session.continue",
            payload: { sessionId: systemSession.id, prompt: text },
          });
        } else {
          await handleClientEvent({
            type: "session.start",
            payload: {
              title: "系统工作区",
              cwd: systemWorkspacePath,
              prompt: text,
            },
          });
        }
      } else {
        // Normal session task
        await handleClientEvent({
          type: "session.continue",
          payload: { sessionId: conversationId, prompt: text },
        });
      }
    };

    const cronExecutor = new CronJobExecutor(cronBusyGuard, sendCronMessage);
    const cronEventEmitter = new IpcCronEventEmitter();
    const cronRepo = new CronRepository();
    const cronService = new CronService(cronRepo, cronEventEmitter, cronExecutor);
    setCronService(cronService);
    registerCronIpcHandlers(cronService);
    cronService.init().catch((err) => console.error("[main] CronService 初始化失败:", err));
    // Initialize task system
    const taskDbPath = join(app.getPath("userData"), "tasks.db");
    initializeTaskExecutor(taskDbPath);
    console.log("[main] Task executor initialized");

    // Initialize note CRUD
    const noteDbPath = join(app.getPath("userData"), "notes.db");
    initializeNoteRepository(noteDbPath);
    console.log("[main] Note repository initialized");
    channelBridgeController = startChannelBridge(async (message) => {
      await handleClientEvent({
        type: "channel.message.receive",
        payload: message,
      });
    });
    setChannelReplySender(channelBridgeController.sendText);

    if (isDev()) {
      const bridge = startDevBackendBridge({
        port: DEV_BACKEND_BRIDGE_PORT,
        platform: process.platform,
        handlers: {
          getStaticData: () => getStaticData(),
          sendClientEvent: async (event: ClientEvent) => {
            const emittedEvents: ServerEvent[] = [];
            const unsubscribe = addServerEventListener((nextEvent) => {
              emittedEvents.push(nextEvent);
            });
            try {
              await handleClientEvent(event);
            } finally {
              unsubscribe();
            }
            return { success: true, events: emittedEvents };
          },
          listSessions: (payload?: { archived?: boolean; limit?: number }) => ({
            sessions: listStoredSessionsForRenderer(Boolean(payload?.archived), {
              limit: typeof payload?.limit === "number" ? payload.limit : undefined,
            }),
            archived: Boolean(payload?.archived),
          }),
          listSlashCommands: (payload?: { cwd?: string }) => ({
            commands: buildSessionSlashCommandItems({ cwd: payload?.cwd }) ?? [],
          }),
          generateSessionTitle: async (userInput: string | null, options?: { model?: string }) => await generateSessionTitle(userInput, options),
          getRecentCwds: (limit?: number) => {
            const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
            return sessions.listRecentCwds(boundedLimit);
          },
          getSystemWorkspace: () => ensureSystemWorkspace(),
          selectDirectory: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ["openDirectory"],
            });
            if (result.canceled) return null;
            try {
              return realpathSync(result.filePaths[0]);
            } catch {
              return result.filePaths[0];
            }
          },
          getApiConfig: () => loadApiConfigSettings(),
          saveApiConfig: (config: unknown) => {
            saveApiConfigSettings(config as ApiConfigSettings);
            return { success: true };
          },
          fetchApiModels: async (payload: { baseURL?: string; apiKey?: string; provider?: ApiModelsProvider }) => await fetchApiModels(payload),
          testApiConfig: async (payload: { baseURL?: string; apiKey?: string; model?: string; provider?: ApiModelsProvider }) => await testApiConfig(payload),
          getGlobalConfig: () => loadGlobalRuntimeConfig(),
          saveGlobalConfig: (config: unknown) => {
            saveGlobalRuntimeConfig(config as Record<string, unknown>);
            return { success: true };
          },
          getAgentRuleDocuments: () => loadAgentRuleDocuments(),
          saveUserAgentRuleDocument: (markdown: unknown) => {
            saveUserAgentRuleDocument(typeof markdown === "string" ? markdown : "");
            return { success: true };
          },
          invoke: async (channel: string, ...args: unknown[]) => {
            if (channel === "prompt:optimize") {
              return await optimizePrompt(args[0] as { prompt?: string; model?: string });
            }
            if (channel === "sessions:list") {
              const payload = args[0] as { archived?: boolean; limit?: number } | undefined;
              return {
                sessions: listStoredSessionsForRenderer(Boolean(payload?.archived), {
                  limit: typeof payload?.limit === "number" ? payload.limit : undefined,
                }),
                archived: Boolean(payload?.archived),
              };
            }
            if (channel === "slash-commands:list") {
              const payload = args[0] as { cwd?: string } | undefined;
              return { commands: buildSessionSlashCommandItems({ cwd: payload?.cwd }) ?? [] };
            }
            if (channel === "plugins:getOpenComputerUseStatus") {
              return await getOpenComputerUsePluginStatus();
            }
            if (channel === "plugins:checkOpenComputerUseUpdate") {
              return await checkOpenComputerUsePluginUpdate();
            }
            if (channel === "plugins:installOpenComputerUse") {
              return await installOpenComputerUsePlugin();
            }
            if (channel === "plugins:updateOpenComputerUse") {
              return await updateOpenComputerUsePlugin();
            }
            if (channel === "plugins:getFigmaOfficialStatus") {
              return await getFigmaOfficialPluginStatus();
            }
            if (channel === "plugins:installFigmaOfficial") {
              return installFigmaOfficialPlugin();
            }
            if (channel === "plugins:connectFigmaOfficial") {
              return await connectFigmaOfficialPlugin();
            }
            if (channel === "plugins:connectFigmaCodexOfficial") {
              return await connectFigmaCodexOfficialPlugin();
            }
            if (channel === "plugins:connectFigmaPatOfficial") {
              return await connectFigmaPatOfficialPlugin(args[0]);
            }
            if (channel === "plugins:connectFigmaDesktopOfficial") {
              return await connectFigmaDesktopOfficialPlugin();
            }
            if (channel === "shell:openExternal") {
              const url = args[0];
              if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
                return { success: false, error: "Invalid external URL." };
              }
              await shell.openExternal(url);
              return { success: true };
            }
            if (channel === "terminal:run") {
              return await runTerminalCommandForRenderer(args[0]);
            }
            if (channel === "terminal:start") {
              return startTerminalProcessForRenderer(args[0]);
            }
            if (channel === "terminal:list") {
              return listTerminalProcessesForRenderer();
            }
            if (channel === "terminal:stop") {
              return await stopTerminalProcessForRenderer(args[0]);
            }
            if (channel === "codegraph:status" || channel === "codegraph:sync") {
              return await handleCodeGraphUiInvoke(channel, args[0]);
            }
            if (channel === "codex-oauth-start") {
              return await startCodexOAuth();
            }
            if (channel === "codex-oauth-complete") {
              return await completeCodexOAuth(args[0] as { input?: string });
            }
            if (channel === "codex-oauth-refresh") {
              return await refreshCodexOAuth(args[0] as { apiKey?: string });
            }
            if (channel.startsWith("git:")) {
              return await handleGitWorkbenchInvoke(channel, ...args);
            }
            if (channel.startsWith("skills:")) {
              return await handleSkillManagerInvoke(channel, ...args);
            }
            throw new Error(`Unsupported dev bridge invoke channel: ${channel}`);
          },
          checkApiConfig: () => {
            const config = getCurrentApiConfig();
            return { hasConfig: config !== null, config };
          },
          debugSaveTraceSnapshot: (snapshot: unknown) => {
            const debugDir = join(app.getPath("userData"), "debug-artifacts");
            mkdirSync(debugDir, { recursive: true });
            const filePath = join(debugDir, `trace-dom-snapshot-${Date.now()}.json`);
            writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
            return { success: true, path: filePath };
          },
          preprocessImageAttachments: async (payload: { prompt?: string; selectedModel?: string; attachments?: unknown[] }) => {
            const attachments = readPromptAttachmentPayload(payload?.attachments);
            return await preprocessImageAttachments({
              config: resolveImagePreprocessApiConfig(payload?.selectedModel),
              prompt: payload?.prompt ?? "",
              selectedModel: payload?.selectedModel,
              attachments,
            });
          },
          getAppUpdateStatus: () => appAutoUpdater.getStatus(),
          checkForAppUpdates: async () => await appAutoUpdater.checkForUpdates(),
          downloadAppUpdate: async () => await appAutoUpdater.downloadUpdate(),
          installAppUpdate: () => appAutoUpdater.quitAndInstall(),
          openBrowserWorkbench: (url: string, sessionId?: string) => getBrowserWorkbench(sessionId)!.open(url),
          closeBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.close(),
          setBrowserWorkbenchBounds: (bounds: BrowserWorkbenchBounds, sessionId?: string) => getBrowserWorkbench(sessionId)!.setBounds(bounds),
          hideAllBrowserWorkbenches,
          reloadBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.reload(),
          goBackBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.goBack(),
          goForwardBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.goForward(),
          getBrowserWorkbenchState: (sessionId?: string) => getBrowserWorkbench(sessionId)!.getState(),
          getBrowserWorkbenchConsoleLogs: (limit?: number, sessionId?: string) => getBrowserWorkbench(sessionId)!.getConsoleLogs(limit),
          getBrowserWorkbenchFetchLogs: (input?: BrowserWorkbenchNetworkLogInput, sessionId?: string) => getBrowserWorkbench(sessionId)!.getNetworkLogs(input),
          captureBrowserWorkbenchVisible: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.captureVisible(),
          inspectBrowserWorkbenchAtPoint: async (point: { x: number; y: number }, sessionId?: string) => await getBrowserWorkbench(sessionId)!.inspectAtPoint(point),
          clickBrowserWorkbenchAtPoint: (point: { x: number; y: number; dblClick?: boolean }, sessionId?: string) => getBrowserWorkbench(sessionId)!.clickAt(point),
          clearBrowserWorkbenchAnnotations: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.clearAnnotations(),
          removeBrowserWorkbenchAnnotation: async (annotationId: string, sessionId?: string) => await getBrowserWorkbench(sessionId)!.removeAnnotation(annotationId),
          setBrowserWorkbenchAnnotationMode: async (enabled: boolean, sessionId?: string) => await getBrowserWorkbench(sessionId)!.setAnnotationMode(enabled),
          startBrowserWorkbenchRecording: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.startRecording(),
          stopBrowserWorkbenchRecording: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.stopRecording(),
          getBrowserWorkbenchRecordingState: (sessionId?: string) => getBrowserWorkbench(sessionId)!.getRecordingState(),
          setBrowserWorkbenchRecordingAssertionMode: async (enabled: boolean, sessionId?: string) => await getBrowserWorkbench(sessionId)!.setRecordingAssertionMode(enabled),
          runBrowserWorkbenchRecording: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.runRecording(),
          cancelBrowserWorkbenchRecordingRun: (sessionId?: string) => getBrowserWorkbench(sessionId)!.cancelRecordingRun(),
          openBrowserWorkbenchRecordingRunOutput: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.openRecordingRunOutput(),
          openBrowserWorkbenchRecordingTraceViewer: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.openRecordingTraceViewer(),
          listBrowserWorkbenchRecordings: (sessionId?: string, limit?: number) => getBrowserWorkbench(sessionId)!.listRecordingHistory(limit),
          loadBrowserWorkbenchRecording: (rootPath: string, sessionId?: string) => getBrowserWorkbench(sessionId)!.loadRecordingHistory(rootPath),
          updateBrowserWorkbenchRecordingArtifact: (artifactPath: string, content: string, sessionId?: string) => getBrowserWorkbench(sessionId)!.updateRecordingArtifact({ artifactPath, content }),
          startBrowserWorkbenchRecordingLocatorPick: async (actionId: string, sessionId?: string) => await getBrowserWorkbench(sessionId)!.startRecordingLocatorPick(actionId),
          cancelBrowserWorkbenchRecordingLocatorPick: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.cancelRecordingLocatorPick(),
          addBrowserWorkbenchRecordingAssertion: async (input: { kind: BrowserWorkbenchRecordedAction["kind"]; value?: string; key?: string; selector?: string }, sessionId?: string) => await getBrowserWorkbench(sessionId)!.addRecordingAssertion(input),
          repairBrowserWorkbenchRecordingLocator: async (actionId: string, selector: string, sessionId?: string) => await getBrowserWorkbench(sessionId)!.repairRecordingLocator({ actionId, selector }),
        },
        subscribeServerEvents: (listener) => addServerEventListener(listener as (event: ServerEvent) => void),
        subscribeBrowserEvents: (listener) => {
          const browserListener = listener as (event: BrowserWorkbenchEvent) => void;
          browserWorkbenchEventListeners.add(browserListener);
          return () => browserWorkbenchEventListeners.delete(browserListener);
        },
      });
      stopDevBackendBridge = () => bridge.stop();
    }

    ipcMainHandle("getStaticData", () => {
        return getStaticData();
    });

    // Handle client events
    ipcMain.on("client-event", (_: IpcMainEvent, event: ClientEvent) => {
        void handleClientEvent(event);
    });

    // Handle session title generation
    ipcMainHandle("generate-session-title", async (_: IpcMainInvokeEvent, userInput: string | null, options?: { model?: string }) => {
        return await generateSessionTitle(userInput, options);
    });

    // Handle recent cwds request
    ipcMainHandle("get-recent-cwds", (_: IpcMainInvokeEvent, limit?: number) => {
        const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
        return sessions.listRecentCwds(boundedLimit);
    });

    // Handle directory selection
    ipcMainHandle("select-directory", async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory']
        });

	        if (result.canceled) {
	            return null;
	        }

	        try {
	            return realpathSync(result.filePaths[0]);
	        } catch {
	            return result.filePaths[0];
	        }
    });

    ipcMainHandle("get-system-workspace", () => {
        return ensureSystemWorkspace();
    });

    // Handle API config
    ipcMainHandle("get-api-config", () => {
        return loadApiConfigSettings();
    });

    ipcMainHandle("check-api-config", () => {
        const config = getCurrentApiConfig();
        return { hasConfig: config !== null, config };
    });

    ipcMainHandle("save-api-config", (_: IpcMainInvokeEvent, config: unknown) => {
        try {
            saveApiConfigSettings(config as ApiConfigSettings);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    });

    ipcMainHandle("fetch-api-models", async (_: IpcMainInvokeEvent, payload: { baseURL?: string; apiKey?: string; provider?: ApiModelsProvider }) => {
        try {
            return await fetchApiModels(payload);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("test-api-config", async (_: IpcMainInvokeEvent, payload: { baseURL?: string; apiKey?: string; model?: string; provider?: ApiModelsProvider }) => {
        try {
            return await testApiConfig(payload);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle("prompt:optimize", async (_: IpcMainInvokeEvent, payload: { prompt?: string; model?: string }) => {
        return await optimizePrompt(payload);
    });

    ipcMainHandle("codex-oauth-start", async () => {
        return await startCodexOAuth();
    });

    ipcMainHandle("codex-oauth-complete", async (_: IpcMainInvokeEvent, payload: { input?: string }) => {
        return await completeCodexOAuth(payload);
    });

    ipcMainHandle("codex-oauth-refresh", async (_: IpcMainInvokeEvent, payload: { apiKey?: string }) => {
        return await refreshCodexOAuth(payload);
    });

    ipcMainHandle("app-update-get-status", () => {
        return appAutoUpdater.getStatus();
    });

    ipcMainHandle("app-update-check", async () => {
        return await appAutoUpdater.checkForUpdates();
    });

    ipcMainHandle("app-update-download", async () => {
        return await appAutoUpdater.downloadUpdate();
    });

    ipcMainHandle("app-update-install", () => {
        return appAutoUpdater.quitAndInstall();
    });

    ipcMainHandle("get-global-config", () => {
        return loadGlobalRuntimeConfig();
    });

    ipcMainHandle("save-global-config", (_: IpcMainInvokeEvent, config: unknown) => {
        try {
            saveGlobalRuntimeConfig(config as Record<string, unknown>);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("get-agent-rule-documents", () => {
        return loadAgentRuleDocuments();
    });

    ipcMainHandle("save-user-agent-rule-document", (_: IpcMainInvokeEvent, markdown: unknown) => {
        try {
            saveUserAgentRuleDocument(typeof markdown === "string" ? markdown : "");
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("debug-save-trace-snapshot", (_: IpcMainInvokeEvent, snapshot: unknown) => {
        try {
            const debugDir = join(app.getPath("userData"), "debug-artifacts");
            mkdirSync(debugDir, { recursive: true });
            const filePath = join(debugDir, `trace-dom-snapshot-${Date.now()}.json`);
            writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
            return { success: true, path: filePath };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("preprocess-image-attachments", async (_: IpcMainInvokeEvent, payload: { prompt?: string; selectedModel?: string; attachments?: unknown[] }) => {
        try {
            const attachments = readPromptAttachmentPayload(payload?.attachments);
            return await preprocessImageAttachments({
                config: resolveImagePreprocessApiConfig(payload?.selectedModel),
                prompt: payload?.prompt ?? "",
                selectedModel: payload?.selectedModel,
                attachments,
            });
        } catch (error) {
            return {
                success: false,
                attachments: readPromptAttachmentPayload(payload?.attachments),
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMainHandle("browser-open", (_: IpcMainInvokeEvent, url: string, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.open(url);
    });

    ipcMainHandle("browser-close", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.close();
    });

    ipcMainHandle("browser-set-bounds", (_: IpcMainInvokeEvent, bounds: BrowserWorkbenchBounds, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.setBounds(bounds);
    });

    ipcMainHandle("browser-hide-all", () => {
        return hideAllBrowserWorkbenches();
    });

    ipcMainHandle("browser-reload", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.reload();
    });

    ipcMainHandle("browser-back", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.goBack();
    });

    ipcMainHandle("browser-forward", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.goForward();
    });

    ipcMainHandle("browser-state", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.getState();
    });

    ipcMainHandle("browser-console-logs", (_: IpcMainInvokeEvent, limit?: number, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.getConsoleLogs(limit);
    });

    ipcMainHandle("browser-fetch-logs", (_: IpcMainInvokeEvent, input?: BrowserWorkbenchNetworkLogInput, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.getNetworkLogs(input);
    });

    ipcMainHandle("browser-capture-visible", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.captureVisible();
    });

    ipcMainHandle("browser-inspect-at-point", async (_: IpcMainInvokeEvent, point: { x: number; y: number }, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.inspectAtPoint(point);
    });

    ipcMainHandle("browser-click-at-point", (_: IpcMainInvokeEvent, point: { x: number; y: number; dblClick?: boolean }, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.clickAt(point);
    });

    ipcMainHandle("browser-clear-annotations", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.clearAnnotations();
    });

    ipcMainHandle("browser-remove-annotation", async (_: IpcMainInvokeEvent, annotationId: string, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.removeAnnotation(annotationId);
    });

    ipcMainHandle("browser-annotation-mode", async (_: IpcMainInvokeEvent, enabled: boolean, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.setAnnotationMode(enabled);
    });

    ipcMainHandle("browser-open-devtools", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.openDevTools();
    });

    ipcMainHandle("browser-close-devtools", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.closeDevTools();
    });

    ipcMainHandle("browser-is-devtools-open", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.isDevToolsOpened();
    });

    ipcMainHandle("browser-recording-start", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.startRecording();
    });

    ipcMainHandle("browser-recording-stop", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.stopRecording();
    });

    ipcMainHandle("browser-recording-state", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.getRecordingState();
    });

    ipcMainHandle("browser-recording-assertion-mode", async (_: IpcMainInvokeEvent, enabled: boolean, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.setRecordingAssertionMode(enabled);
    });

    ipcMainHandle("browser-recording-run", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.runRecording();
    });

    ipcMainHandle("browser-recording-run-cancel", (_: IpcMainInvokeEvent, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.cancelRecordingRun();
    });

    ipcMainHandle("browser-recording-open-run-output", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.openRecordingRunOutput();
    });

    ipcMainHandle("browser-recording-open-trace-viewer", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.openRecordingTraceViewer();
    });

    ipcMainHandle("browser-recording-history", (_: IpcMainInvokeEvent, sessionId?: string, limit?: number) => {
        return getBrowserWorkbench(sessionId)!.listRecordingHistory(limit);
    });

    ipcMainHandle("browser-recording-load-history", (_: IpcMainInvokeEvent, rootPath: string, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.loadRecordingHistory(rootPath);
    });

    ipcMainHandle("browser-recording-update-artifact", (_: IpcMainInvokeEvent, artifactPath: string, content: string, sessionId?: string) => {
        return getBrowserWorkbench(sessionId)!.updateRecordingArtifact({ artifactPath, content });
    });

    ipcMainHandle("browser-recording-locator-pick-start", async (_: IpcMainInvokeEvent, actionId: string, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.startRecordingLocatorPick(actionId);
    });

    ipcMainHandle("browser-recording-locator-pick-cancel", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.cancelRecordingLocatorPick();
    });

    ipcMainHandle("browser-recording-add-assertion", async (_: IpcMainInvokeEvent, input: { kind: BrowserWorkbenchRecordedAction["kind"]; value?: string; key?: string; selector?: string }, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.addRecordingAssertion(input);
    });

    ipcMainHandle("browser-recording-repair-locator", async (_: IpcMainInvokeEvent, actionId: string, selector: string, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.repairRecordingLocator({ actionId, selector });
    });

    // Feedback: capture screenshot of the main window
    ipcMainHandle("feedback:capture-screenshot", async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return null;
        try {
            const image = await mainWindow.webContents.capturePage();
            const base64 = image.toJPEG(80).toString("base64");
            return `data:image/jpeg;base64,${base64}`;
        } catch (error) {
            console.error("[feedback] Failed to capture screenshot:", error);
            return null;
        }
    });

    // Feedback: submit GitHub issue, or open a prefilled draft when no token is available.
    ipcMainHandle("feedback:submit-issue", async (_: IpcMainInvokeEvent, payload: FeedbackSubmitPayload) => {
        const runtimeEnv = getGlobalRuntimeEnvConfig();
        const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || runtimeEnv.GITHUB_TOKEN || runtimeEnv.GH_TOKEN;
        return await submitFeedbackIssue(payload, {
            token,
            fetchFn: fetch,
            openExternal: async (url) => {
                await shell.openExternal(url);
            },
        });
    });
})

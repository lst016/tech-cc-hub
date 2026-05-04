import {
    app,
    BrowserWindow,
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
} from "electron"
import { execFile, execSync } from "child_process";
import { mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { extname, isAbsolute, join, relative } from "path";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { handleClientEvent, sessions, cleanupAllSessions, setChannelReplySender, listStoredSessionsForRenderer, initializeTaskExecutor, initializeNoteRepository } from "./ipc-handlers.js";
import { generateSessionTitle } from "./libs/util.js";
import {
  loadApiConfigSettings,
  type ApiConfigSettings,
  saveApiConfigSettings,
  loadGlobalRuntimeConfig,
  saveGlobalRuntimeConfig,
} from "./libs/config-store.js";
import { setBrowserToolHost } from "./libs/mcp-tools/browser.js";
import { setDesignToolHost } from "./libs/mcp-tools/design.js";
import { appAutoUpdater, type AppUpdateStatus } from "./libs/auto-updater.js";
import { startChannelBridge, type ChannelBridgeController } from "./libs/channel-bridge.js";
import { ensureSystemWorkspace } from "./libs/system-workspace.js";
import { getCurrentApiConfig } from "./libs/claude-settings.js";
import { preprocessImageAttachments } from "./libs/image-preprocessor.js";
import { loadAgentRuleDocuments, saveUserAgentRuleDocument } from "./libs/agent-rule-docs.js";
import { registerSkillManagerHandlers } from "./libs/skill-manager/ipc-handlers.js";
import { registerCronIpcHandlers, IpcCronEventEmitter } from "./libs/cron-ipc-handlers.js";
import { CronService } from "./libs/cron-service.js";
import { CronRepository } from "./libs/cron-repository.js";
import { CronJobExecutor, CronBusyGuard } from "./libs/cron-executor.js";
import { setCronService } from "./libs/mcp-tools/cron.js";
import type { ClientEvent, PromptAttachment, ServerEvent } from "./types.js";
import { BrowserWorkbenchManager, type BrowserWorkbenchBounds, type BrowserWorkbenchEvent } from "./browser-manager.js";
import { startDevBackendBridge, DEV_BACKEND_BRIDGE_PORT } from "./dev-backend-bridge.js";
import { buildSessionSlashCommandItems, buildSessionSlashCommands } from "./libs/slash-command-catalog.js";
import "./libs/claude-settings.js";
import { addServerEventListener } from "./ipc-handlers.js";

let cleanupComplete = false;
let mainWindow: BrowserWindow | null = null;
const DEFAULT_BROWSER_WORKBENCH_SESSION_ID = "global";
const MAX_PREVIEW_TEXT_BYTES = 512_000;
const MAX_PREVIEW_IMAGE_BYTES = 2_000_000;
const MAX_PREVIEW_DIRECTORY_ENTRIES = 300;
const PREVIEW_IMAGE_MIME_TYPES: Record<string, string> = {
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const browserWorkbenches = new Map<string, BrowserWorkbenchManager>();
const browserWorkbenchEventListeners = new Set<(event: BrowserWorkbenchEvent) => void>();
let stopDevBackendBridge: (() => void) | null = null;
let channelBridgeController: ChannelBridgeController | null = null;

function execFileText(command: string, args: string[], timeout = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, env: process.env }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

async function getOpenComputerUseVersion(): Promise<string | null> {
  try {
    const result = await execFileText("open-computer-use", ["--version"], 15_000);
    const version = result.stdout.trim() || result.stderr.trim();
    return version || "installed";
  } catch {
    return null;
  }
}

type OpenComputerUsePermissionStatus = {
  platform: NodeJS.Platform;
  required: boolean;
  accessibility: "granted" | "missing" | "not-required" | "unknown";
  screenRecording: "granted" | "missing" | "not-required" | "unknown";
  needsUserAction: boolean;
  openedSystemSettings: boolean;
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
    await execFileText(npmCommand, ["install", "-g", "open-computer-use"], 300_000);
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

async function getOpenComputerUsePluginStatus(): Promise<{ installed: boolean; connected: boolean; version?: string; permissions: OpenComputerUsePermissionStatus }> {
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
  };
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function broadcastAppUpdateStatus(status: AppUpdateStatus): void {
  const payload = JSON.stringify(status);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("app-update-status", payload);
  }
}

function detectPreviewLanguage(filePath: string): string | undefined {
  const extension = extname(filePath).toLowerCase();
  const languages: Record<string, string> = {
    ".bash": "bash",
    ".css": "css",
    ".go": "go",
    ".html": "html",
    ".java": "java",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "javascript",
    ".md": "markdown",
    ".markdown": "markdown",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".sh": "bash",
    ".sql": "sql",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
  };
  return languages[extension];
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const rel = relative(rootPath, candidatePath);
  return Boolean(rel) && !rel.startsWith("..") && !isAbsolute(rel);
}

function isPathWithinOrEqualRoot(rootPath: string, candidatePath: string): boolean {
  return rootPath === candidatePath || isPathInsideRoot(rootPath, candidatePath);
}

function isIgnoredPreviewDirectory(name: string): boolean {
  return name === ".git" ||
    name === "node_modules" ||
    name === "dist-react" ||
    name === "dist-electron" ||
    name === ".vite" ||
    name === ".turbo";
}

function listPreviewDirectoryForRenderer(request: unknown): {
  success: boolean;
  path?: string;
  entries?: Array<{ name: string; path: string; relativePath: string; type: "file" | "directory"; size?: number }>;
  error?: string;
} {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少目录请求参数。" };
    }

    const payload = request as { cwd?: unknown; path?: unknown };
    const rawCwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
    const rawPath = typeof payload.path === "string" ? payload.path.trim() : "";
    if (!rawCwd) {
      return { success: false, error: "缺少工作目录。" };
    }

    const rootPath = realpathSync(rawCwd);
    const requestedPath = rawPath ? (isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath)) : rootPath;
    const realPath = realpathSync(requestedPath);
    if (!isPathWithinOrEqualRoot(rootPath, realPath)) {
      return { success: false, path: realPath, error: "只能浏览当前工作目录内的文件。" };
    }

    const stat = statSync(realPath);
    if (!stat.isDirectory()) {
      return { success: false, path: realPath, error: "只能浏览目录。" };
    }

    const entries = readdirSync(realPath, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith(".") || entry.name === ".env")
      .filter((entry) => !(entry.isDirectory() && isIgnoredPreviewDirectory(entry.name)))
      .slice(0, MAX_PREVIEW_DIRECTORY_ENTRIES)
      .map((entry) => {
        const entryPath = join(realPath, entry.name);
        const entryStat = statSync(entryPath);
        return {
          name: entry.name,
          path: entryPath,
          relativePath: relative(rootPath, entryPath) || entry.name,
          type: entry.isDirectory() ? "directory" as const : "file" as const,
          size: entry.isFile() ? entryStat.size : undefined,
        };
      })
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === "directory" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });

    return { success: true, path: realPath, entries };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "读取目录失败。",
    };
  }
}

function readPreviewFileForRenderer(request: unknown): {
  success: boolean;
  path?: string;
  content?: string;
  language?: string;
  error?: string;
} {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少预览请求参数。" };
    }

    const payload = request as { cwd?: unknown; path?: unknown };
    const rawCwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
    const rawPath = typeof payload.path === "string" ? payload.path.trim() : "";
    if (!rawCwd || !rawPath) {
      return { success: false, error: "缺少工作目录或文件路径。" };
    }

    const rootPath = realpathSync(rawCwd);
    const requestedPath = isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath);
    const realPath = realpathSync(requestedPath);
    if (!isPathInsideRoot(rootPath, realPath)) {
      return { success: false, path: realPath, error: "只能预览当前工作目录内的文件。" };
    }

    const stat = statSync(realPath);
    if (!stat.isFile()) {
      return { success: false, path: realPath, error: "只能预览普通文件。" };
    }

    const extension = extname(realPath).toLowerCase();
    const imageMime = PREVIEW_IMAGE_MIME_TYPES[extension];
    if (imageMime) {
      if (stat.size > MAX_PREVIEW_IMAGE_BYTES) {
        return { success: false, path: realPath, error: "图片过大，暂不在侧栏预览。" };
      }
      const base64 = readFileSync(realPath).toString("base64");
      return {
        success: true,
        path: realPath,
        content: `data:${imageMime};base64,${base64}`,
      };
    }

    if (stat.size > MAX_PREVIEW_TEXT_BYTES) {
      return { success: false, path: realPath, error: "文件过大，暂不在侧栏预览。" };
    }

    return {
      success: true,
      path: realPath,
      content: readFileSync(realPath, "utf8"),
      language: detectPreviewLanguage(realPath),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "读取预览文件失败。",
    };
  }
}

ipcMain.handle("preview-list-directory", (_event, request: unknown) => listPreviewDirectoryForRenderer(request));
ipcMain.handle("sessions:list", (_event, payload?: { archived?: boolean }) => ({
  sessions: listStoredSessionsForRenderer(Boolean(payload?.archived)),
  archived: Boolean(payload?.archived),
}));
ipcMain.handle("slash-commands:list", (_event, payload?: { cwd?: string }) => ({
  commands: buildSessionSlashCommandItems({ cwd: payload?.cwd }) ?? [],
}));
ipcMain.handle("plugins:getOpenComputerUseStatus", () => getOpenComputerUsePluginStatus());
ipcMain.handle("plugins:installOpenComputerUse", () => installOpenComputerUsePlugin());
ipcMain.handle("preview-read-file", (_event, request: unknown) => readPreviewFileForRenderer(request));
ipcMain.handle("preview-get-image-base64", (_event, request: unknown) => readPreviewFileForRenderer(request));
ipcMain.handle("preview-get-file-metadata", (_event, request: unknown) => {
  try {
    if (!request || typeof request !== "object") {
      return null;
    }
    const payload = request as { cwd?: unknown; path?: unknown };
    const rawCwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
    const rawPath = typeof payload.path === "string" ? payload.path.trim() : "";
    if (!rawCwd || !rawPath) {
      return null;
    }
    const rootPath = realpathSync(rawCwd);
    const requestedPath = isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath);
    const realPath = realpathSync(requestedPath);
    if (!isPathWithinOrEqualRoot(rootPath, realPath)) {
      return null;
    }
    const stat = statSync(realPath);
    return {
      name: realPath.split(/[\\/]/).pop() ?? realPath,
      path: realPath,
      size: stat.size,
      type: stat.isDirectory() ? "directory" : extname(realPath).slice(1),
      lastModified: stat.mtimeMs,
      isDirectory: stat.isDirectory(),
    };
  } catch {
    return null;
  }
});
ipcMain.handle("preview-write-file", (_event, request: unknown) => {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少写入请求参数。" };
    }
    const payload = request as { cwd?: unknown; path?: unknown; data?: unknown };
    const rawCwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
    const rawPath = typeof payload.path === "string" ? payload.path.trim() : "";
    if (!rawCwd || !rawPath || typeof payload.data !== "string") {
      return { success: false, error: "缺少工作目录、文件路径或写入内容。" };
    }
    const rootPath = realpathSync(rawCwd);
    const requestedPath = isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath);
    const realPath = realpathSync(requestedPath);
    if (!isPathWithinOrEqualRoot(rootPath, realPath)) {
      return { success: false, path: realPath, error: "只能写入当前工作目录内的文件。" };
    }
    if (!statSync(realPath).isFile()) {
      return { success: false, path: realPath, error: "只能写入普通文件。" };
    }
    writeFileSync(realPath, payload.data, "utf8");
    return { success: true, path: realPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "写入预览文件失败。" };
  }
});
ipcMain.handle("preview-remove-entry", (_event, request: unknown) => {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少删除请求参数。" };
    }
    const payload = request as { cwd?: unknown; path?: unknown };
    const rawCwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
    const rawPath = typeof payload.path === "string" ? payload.path.trim() : "";
    if (!rawCwd || !rawPath) {
      return { success: false, error: "缺少工作目录或路径。" };
    }
    const rootPath = realpathSync(rawCwd);
    const requestedPath = isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath);
    const realPath = realpathSync(requestedPath);
    if (!isPathWithinOrEqualRoot(rootPath, realPath) || rootPath === realPath) {
      return { success: false, path: realPath, error: "只能删除当前工作目录内的子文件。" };
    }
    rmSync(realPath, { recursive: true, force: true });
    return { success: true, path: realPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "删除文件失败。" };
  }
});
ipcMain.handle("preview-rename-entry", (_event, request: unknown) => {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少重命名请求参数。" };
    }
    const payload = request as { cwd?: unknown; path?: unknown; newName?: unknown };
    const rawCwd = typeof payload.cwd === "string" ? payload.cwd.trim() : "";
    const rawPath = typeof payload.path === "string" ? payload.path.trim() : "";
    const newName = typeof payload.newName === "string" ? payload.newName.trim() : "";
    if (!rawCwd || !rawPath || !newName || /[\\/]/.test(newName)) {
      return { success: false, error: "缺少工作目录、路径或合法新名称。" };
    }
    const rootPath = realpathSync(rawCwd);
    const requestedPath = isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath);
    const realPath = realpathSync(requestedPath);
    if (!isPathWithinOrEqualRoot(rootPath, realPath) || rootPath === realPath) {
      return { success: false, path: realPath, error: "只能重命名当前工作目录内的子文件。" };
    }
    const newPath = join(realPath.split(/[\\/]/).slice(0, -1).join("/"), newName);
    renameSync(realPath, newPath);
    return { success: true, path: realPath, newPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "重命名文件失败。" };
  }
});
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

  const manager = new BrowserWorkbenchManager(mainWindow, resolvedSessionId);
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

    for (const shortcut of shortcuts) {
        try {
            const registered = globalShortcut.register(shortcut.accelerator, shortcut.handler);
            if (!registered) {
                console.warn(`[main] Failed to register shortcut: ${shortcut.accelerator}`);
            }
        } catch (error) {
            console.warn(`[main] Failed to bind shortcut ${shortcut.accelerator}:`, error);
        }
    }
}

function readPromptAttachmentPayload(attachments?: unknown[]): PromptAttachment[] {
    return Array.isArray(attachments) ? (attachments as PromptAttachment[]) : [];
}

function normalizeApiBaseURLForModels(value: string): string {
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

function buildModelsEndpoint(baseURL: string): { endpoint: string; normalizedBaseURL: string } {
    const normalizedBaseURL = normalizeApiBaseURLForModels(baseURL);
    const url = new URL(normalizedBaseURL);
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname.endsWith("/v1") ? `${pathname}/models` : `${pathname}/v1/models`;
    return {
        endpoint: url.toString(),
        normalizedBaseURL,
    };
}

function extractModelIds(payload: unknown): string[] {
    if (!payload || typeof payload !== "object") {
        return [];
    }

    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data)) {
        return [];
    }

    return Array.from(new Set(data
        .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
                return (item as { id: string }).id;
            }
            return "";
        })
        .map((item) => item.trim())
        .filter(Boolean)));
}

async function fetchApiModels(payload: { baseURL?: string; apiKey?: string }): Promise<{ success: boolean; models?: string[]; baseURL?: string; error?: string }> {
    const baseURL = payload?.baseURL?.trim() ?? "";
    const apiKey = payload?.apiKey?.trim() ?? "";

    if (!baseURL) {
        return { success: false, error: "请先填写接口地址。" };
    }
    if (!apiKey) {
        return { success: false, error: "请先填写 API 密钥。" };
    }

    try {
        const { endpoint, normalizedBaseURL } = buildModelsEndpoint(baseURL);
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
        const models = extractModelIds(responsePayload);
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

installStdIoGuards();

// Initialize everything when app is ready
app.on("ready", async () => {
    Menu.setApplicationMenu(null);
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
      getDomStats: async (sessionId) => {
        const browserWorkbench = getBrowserWorkbench(sessionId);
        if (!browserWorkbench) {
          return { success: false, error: "浏览器工作台尚未初始化。" };
        }
        return await browserWorkbench.getDomStats();
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
    });
    setDesignToolHost({
      getState: (sessionId) => getBrowserWorkbench(sessionId)?.getState() ?? buildBrowserWorkbenchFallbackState(),
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
          listSessions: (payload?: { archived?: boolean }) => ({
            sessions: listStoredSessionsForRenderer(Boolean(payload?.archived)),
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
            return result.canceled ? null : result.filePaths[0];
          },
          getApiConfig: () => loadApiConfigSettings(),
          saveApiConfig: (config: unknown) => {
            saveApiConfigSettings(config as ApiConfigSettings);
            return { success: true };
          },
          fetchApiModels: async (payload: { baseURL?: string; apiKey?: string }) => await fetchApiModels(payload),
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
            if (channel === "sessions:list") {
              const payload = args[0] as { archived?: boolean } | undefined;
              return {
                sessions: listStoredSessionsForRenderer(Boolean(payload?.archived)),
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
            if (channel === "plugins:installOpenComputerUse") {
              return await installOpenComputerUsePlugin();
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
              config: getCurrentApiConfig(),
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
          reloadBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.reload(),
          goBackBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.goBack(),
          goForwardBrowserWorkbench: (sessionId?: string) => getBrowserWorkbench(sessionId)!.goForward(),
          getBrowserWorkbenchState: (sessionId?: string) => getBrowserWorkbench(sessionId)!.getState(),
          getBrowserWorkbenchConsoleLogs: (limit?: number, sessionId?: string) => getBrowserWorkbench(sessionId)!.getConsoleLogs(limit),
          captureBrowserWorkbenchVisible: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.captureVisible(),
          inspectBrowserWorkbenchAtPoint: async (point: { x: number; y: number }, sessionId?: string) => await getBrowserWorkbench(sessionId)!.inspectAtPoint(point),
          clearBrowserWorkbenchAnnotations: async (sessionId?: string) => await getBrowserWorkbench(sessionId)!.clearAnnotations(),
          setBrowserWorkbenchAnnotationMode: async (enabled: boolean, sessionId?: string) => await getBrowserWorkbench(sessionId)!.setAnnotationMode(enabled),
        },
        subscribeServerEvents: (listener) => addServerEventListener(listener as any),
        subscribeBrowserEvents: (listener) => {
          browserWorkbenchEventListeners.add(listener as any);
          return () => browserWorkbenchEventListeners.delete(listener as any);
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

        return result.filePaths[0];
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

    ipcMainHandle("fetch-api-models", async (_: IpcMainInvokeEvent, payload: { baseURL?: string; apiKey?: string }) => {
        try {
            return await fetchApiModels(payload);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
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
                config: getCurrentApiConfig(),
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

    ipcMainHandle("browser-capture-visible", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.captureVisible();
    });

    ipcMainHandle("browser-inspect-at-point", async (_: IpcMainInvokeEvent, point: { x: number; y: number }, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.inspectAtPoint(point);
    });

    ipcMainHandle("browser-clear-annotations", async (_: IpcMainInvokeEvent, sessionId?: string) => {
        return await getBrowserWorkbench(sessionId)!.clearAnnotations();
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
})

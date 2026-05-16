# src/ui/dev-electron-shim.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：591

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getDevElectronRuntimeSource@69`
- `createFallbackElectron@86`
- `createBridgeElectron@402`
- `waitForBridgeElectron@543`
- `browserPreviewSessionId@3`
- `browserPreviewCwd@5`
- `browserPreviewSlashCommands@6`
- `browserPreviewSlashCommandNames@11`
- `DEV_BACKEND_BRIDGE_ORIGIN@12`
- `BRIDGE_BOOT_RETRY_COUNT@13`
- `BRIDGE_BOOT_RETRY_DELAY_MS@14`
- `BRIDGE_HEALTH_TIMEOUT_MS@15`
- `DEV_BRIDGE_READY_EVENT@16`
- `DEV_BROWSER_PREVIEW_FLAG@17`
- `DEV_SHIM_MARKER@18`
- `url@23`
- `response@25`
- `response@40`
- `unsupportedPreviewMutation@43`
- `createPreviewGitResult@48`
- `createPreviewUpdateStatus@56`
- `createPreviewUpdateResult@64`
- `status@66`
- `marker@74`
- `buildBrowserPreviewTitle@80`
- `normalized@82`
- `sessionCreatedAt@88`
- `sessionUpdatedAt@89`
- `sessionTitle@91`
- `createEmptyBrowserState@94`
- `getBrowserState@102`
- `resolvedSessionId@103`
- `setBrowserState@107`
- `resolvedSessionId@108`
- `platform@112`
- `buildSessionListEvent@113`
- `buildSessionHistoryEvent@131`
- `listeners@143`
- `emit@145`
- `syncSession@152`

## 依赖输入

- `./types`

## 对外暴露

- `DEV_BRIDGE_READY_EVENT`
- `DEV_BROWSER_PREVIEW_FLAG`
- `DevElectronRuntimeSource`
- `getDevElectronRuntimeSource`
- `installDevElectronShim`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { ClientEvent, PromptAttachment, ServerEvent, StreamMessage, UiGitCommitDetail, UiGitCommitMessageSuggestion, UiGitDiffResult, UiGitResult, UiGitWorkbenchSnapshot } from "./types";
import type { AppUpdateActionResult, AppUpdateStatus } from "./types";

const browserPreviewSessionId = "browser-preview-session";
const browserPreviewCwd = "/Users/lst01/Desktop/学习/tech-cc-hub";
const browserPreviewSlashCommands = [
  { name: "codex", description: "Codex 会话命令" },
  { name: "review", description: "进入代码审查模式" },
  { name: "plan", description: "生成计划，不直接执行" },
];
const browserPreviewSlashCommandNames = browserPreviewSlashCommands.map((command) => command.name);
const DEV_BACKEND_BRIDGE_ORIGIN = "/__dev_bridge";
const BRIDGE_BOOT_RETRY_COUNT = 20;
const BRIDGE_BOOT_RETRY_DELAY_MS = 250;
const BRIDGE_HEALTH_TIMEOUT_MS = 500;
export const DEV_BRIDGE_READY_EVENT = "tech-cc-hub:dev-bridge-ready";
export const DEV_BROWSER_PREVIEW_FLAG = "__tech_cc_hub_browser_preview";
const DEV_SHIM_MARKER = "__techCCHubDevShim";

export type DevElectronRuntimeSource = "bridge" | "fallback" | "electron";

async function invokePreviewFs<T>(endpoint: "list" | "files" | "read" | "write", payload: { cwd: string; path?: string; limit?: number; data?: string }): Promise<T> {
  const url = new URL(`/__tech_preview/${endpoint}`, window.location.origin);
  if (endpoint === "write") {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return await response.json() as T;
  }
  url.searchParams.set("cwd", payload.cwd);
  if (payload.path) {
    url.searchParams.set("path", payload.path);
  }
  if (payload.limit) {
    url.searchParams.set("limit", String(payload.limit));
  }
  const response = await fetch(url, { cache: "no-store" });
  return await response.json() as T;
}

const unsupportedPreviewMutation = async () => ({
  success: false,
  error: "浏览器预览态暂不支持修改文件，请在 Electron 客户端里操作。",
});

const createPreviewGitResult = <T,>(): UiGitResult<T> => ({
  success: false,
  error: {
    code: "not_a_repo",
    message: "浏览器预览态没有可操作的 Git 仓库，请在 Electron 客户端里使用 Git 工作台。",
  },
});

const createPreviewUpdateStatus = (): AppUpdateStatus => ({
  status: "disabled",
  currentVersion: "0.1.1",
  isPackaged: false,
  provider: "github",
  error: "浏览器预览态不会检查 GitHub Releases 更新，请在打包后的 Electron 客户端里使用。",
});

const createPreviewUpdateResult = async (): Promise<AppUpdateActionResult> => {
  const status = createPreviewUpdateStatus();
  return { success: false, status, error: status.error };
};

export function getDevElectronRuntimeSource(): DevElectronRuntimeSource {
  if (typeof window === "undefined" || !window.electron) {
    return "fallback";
  }

  const marker = (window.electron as typeof window.electron & Record<string, unknown>)[DEV_SHIM_MARKER];
  if (marker === "bridge") return "bridge";
  if (marker === "fallback") return "fallback";
  return "electron";
}

const buildBrowserPreviewTitle = (input: string) => {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "新聊天";
  return normalized.slice(0, 24);
};

function createFallbackElectron(): typeof window.electron & Record<string, unknown> {
  let sessionCreatedAt = Date.now();
  let sessionUpdatedAt = sessionCreatedAt;
  let sessionStatus: "idle" | "running" | "completed" = "idle";
  let sessionTitle = "新聊天";
  let sessionMessages: StreamMessage[] = [];
  const browserStateBySessionId: Record<string, BrowserWorkbenchState> = {};
  const createEmptyBrowserState = (): BrowserWorkbenchState => ({
    url: "",
    title: "浏览器预览",
    loading: false,
    canGoBack: false,
    canGoForward: false,
    annotationMode: false,
  });
  const getBrowserState = (sessionId?: string) => {
    const resolvedSessionId = sessionId?.trim() || "global";
    browserStateBySessionId[resolvedSessionId] ??= createEmptyBrowserState();
    return browserStateBySessionId[resolvedSessionId];
  };
  const setBrowserState = (sessionId: string | undefined, nextState: BrowserWorkbenchState) => {
    const resolvedSessionId = sessionId?.trim() || "global";
    browserStateBySe
... (truncated)
```

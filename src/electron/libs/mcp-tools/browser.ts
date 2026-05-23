// 浏览器工作台 MCP 工具：把右侧 BrowserView 的导航、截图、DOM 查询能力暴露给 Agent。
// 这里不直接依赖 UI 组件，只通过 BrowserWorkbenchToolHost 访问主进程维护的 BrowserView。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { execFile } from "node:child_process";
import { z } from "zod";

import type {
  BrowserWorkbenchConsoleLog,
  BrowserWorkbenchDomStats,
  BrowserWorkbenchDomHint,
  BrowserWorkbenchElementActionName,
  BrowserWorkbenchElementActionResult,
  BrowserWorkbenchElementInfoKind,
  BrowserWorkbenchElementInfoResult,
  BrowserWorkbenchCookieInput,
  BrowserWorkbenchCookieResult,
  BrowserWorkbenchInteractiveSnapshot,
  BrowserWorkbenchKeyboardResult,
  BrowserWorkbenchMouseInput,
  BrowserWorkbenchMouseResult,
  BrowserWorkbenchNetworkLogInput,
  BrowserWorkbenchNetworkLogResult,
  BrowserWorkbenchNodeQueryResult,
  BrowserWorkbenchSavedFileResult,
  BrowserWorkbenchScrollResult,
  BrowserWorkbenchState,
  BrowserWorkbenchStorageInput,
  BrowserWorkbenchStorageResult,
  BrowserWorkbenchBounds,
  BrowserWorkbenchPageSnapshot,
  BrowserWorkbenchQueryStrategy,
  BrowserWorkbenchStyleApplyInput,
  BrowserWorkbenchStyleApplyResult,
  BrowserWorkbenchStyleInspection,
  BrowserWorkbenchWaitResult,
  BrowserWorkbenchEvalResult,
} from "../../browser-manager.js";
import { toTextToolResult } from "./tool-result.js";

export const BROWSER_TOOL_NAMES = [
  "http_ping",
  "diagnose_port",
  "bash_batch",
  "browser_open_page",
  "browser_close_page",
  "browser_get_state",
  "browser_navigate",
  "browser_reload",
  "browser_extract_page",
  "browser_capture_visible",
  "browser_save_screenshot",
  "browser_save_pdf",
  "browser_cookies",
  "browser_storage",
  "browser_console_logs",
  "browser_fetch_logs",
  "browser_get_dom_stats",
  "browser_snapshot_interactive",
  "browser_click_element",
  "browser_dblclick_element",
  "browser_focus_element",
  "browser_hover_element",
  "browser_type_element",
  "browser_fill_element",
  "browser_select_element",
  "browser_check_element",
  "browser_uncheck_element",
  "browser_scroll_into_view",
  "browser_get_element",
  "browser_eval",
  "browser_press_key",
  "browser_key_down",
  "browser_key_up",
  "browser_keyboard_type",
  "browser_keyboard_insert_text",
  "browser_mouse",
  "browser_scroll_page",
  "browser_wait_for",
  "browser_query_nodes",
  "browser_inspect_styles",
  "browser_apply_styles",
  "browser_inspect_at_point",
  "browser_set_annotation_mode",
  "click_at",
  "drag",
  "fill_form",
  "navigate_page",
  "resize_page",
  "handle_dialog",
  "upload_file",
  "take_snapshot",
  "list_network_requests",
  "get_network_request",
  "list_console_messages",
  "get_console_message",
  "performance_start_trace",
  "performance_stop_trace",
  "emulate",
  "list_pages",
  "select_page",
  "new_page",
  "evaluate_script",
] as const;

// Host 是主进程注入的 BrowserView 适配层。MCP 工具只依赖这个接口，避免和窗口/UI 生命周期绑死。
export type BrowserWorkbenchToolHost = {
  open: (sessionId: string, url: string) => BrowserWorkbenchState;
  close: (sessionId: string) => BrowserWorkbenchState;
  setBounds: (sessionId: string, bounds: BrowserWorkbenchBounds) => BrowserWorkbenchState;
  reload: (sessionId: string) => BrowserWorkbenchState;
  goBack: (sessionId: string) => BrowserWorkbenchState;
  goForward: (sessionId: string) => BrowserWorkbenchState;
  getState: (sessionId: string) => BrowserWorkbenchState;
  getConsoleLogs: (sessionId: string, limit?: number) => BrowserWorkbenchConsoleLog[];
  getNetworkLogs: (sessionId: string, input?: BrowserWorkbenchNetworkLogInput) => { success: boolean; result?: BrowserWorkbenchNetworkLogResult; error?: string };
  extractPageSnapshot: (sessionId: string) => Promise<{ success: boolean; snapshot?: BrowserWorkbenchPageSnapshot; error?: string }>;
  captureVisible: (sessionId: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  saveScreenshot: (sessionId: string, input: { path?: string; format?: "png" | "jpeg"; quality?: number }) => Promise<{ success: boolean; result?: BrowserWorkbenchSavedFileResult; error?: string }>;
  savePdf: (sessionId: string, input: { path?: string; landscape?: boolean; printBackground?: boolean }) => Promise<{ success: boolean; result?: BrowserWorkbenchSavedFileResult; error?: string }>;
  manageCookies: (sessionId: string, input: BrowserWorkbenchCookieInput) => Promise<{ success: boolean; result?: BrowserWorkbenchCookieResult; error?: string }>;
  manageStorage: (sessionId: string, input: BrowserWorkbenchStorageInput) => Promise<{ success: boolean; result?: BrowserWorkbenchStorageResult; error?: string }>;
  getDomStats: (sessionId: string) => Promise<{ success: boolean; stats?: BrowserWorkbenchDomStats; error?: string }>;
  getInteractiveSnapshot: (sessionId: string, input: {
    maxResults?: number;
    visibleOnly?: boolean;
  }) => Promise<{ success: boolean; snapshot?: BrowserWorkbenchInteractiveSnapshot; error?: string }>;
  clickElement: (sessionId: string, input: {
    target: string;
    strategy?: "auto" | "ref" | "selector" | "xpath";
    index?: number;
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchElementActionResult; error?: string }>;
  runElementAction: (sessionId: string, input: {
    action: BrowserWorkbenchElementActionName;
    target: string;
    value?: string;
    strategy?: "auto" | "ref" | "selector" | "xpath";
    index?: number;
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchElementActionResult; error?: string }>;
  fillElement: (sessionId: string, input: {
    target: string;
    value: string;
    strategy?: "auto" | "ref" | "selector" | "xpath";
    index?: number;
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchElementActionResult; error?: string }>;
  getElementInfo: (sessionId: string, input: {
    kind: BrowserWorkbenchElementInfoKind;
    target: string;
    attribute?: string;
    properties?: string[];
    strategy?: "auto" | "ref" | "selector" | "xpath";
    index?: number;
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchElementInfoResult; error?: string }>;
  pressKey: (sessionId: string, key: string) => { success: boolean; key: string; state: BrowserWorkbenchState; error?: string };
  sendKeyEvent: (sessionId: string, action: "press" | "down" | "up", key: string) => BrowserWorkbenchKeyboardResult;
  sendKeyboardText: (sessionId: string, action: "type" | "insertText", text: string) => BrowserWorkbenchKeyboardResult;
  sendMouseEvent: (sessionId: string, input: BrowserWorkbenchMouseInput) => BrowserWorkbenchMouseResult;
  evaluateJavaScript: (sessionId: string, expression: string) => Promise<{ success: boolean; result?: BrowserWorkbenchEvalResult; error?: string }>;
  scrollPage: (sessionId: string, input: {
    direction?: "up" | "down" | "left" | "right";
    amount?: number;
    target?: string;
    strategy?: "auto" | "ref" | "selector" | "xpath";
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchScrollResult; error?: string }>;
  waitFor: (sessionId: string, input: {
    condition: "load" | "selector" | "text" | "url" | "time" | "function";
    value?: string;
    strategy?: "selector" | "xpath";
    state?: "visible" | "hidden" | "attached";
    timeoutMs?: number;
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchWaitResult; error?: string }>;
  queryNodes: (sessionId: string, input: {
    strategy?: BrowserWorkbenchQueryStrategy;
    query: string;
    maxResults?: number;
    includeStyles?: boolean;
    styleProps?: string[];
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchNodeQueryResult; error?: string }>;
  inspectStyles: (sessionId: string, input: {
    strategy?: BrowserWorkbenchQueryStrategy;
    query: string;
    index?: number;
    properties?: string[];
  }) => Promise<{ success: boolean; inspection?: BrowserWorkbenchStyleInspection; error?: string }>;
  applyStyles: (sessionId: string, input: BrowserWorkbenchStyleApplyInput) => Promise<{ success: boolean; result?: BrowserWorkbenchStyleApplyResult; error?: string }>;
  inspectAtPoint: (sessionId: string, point: { x: number; y: number }) => Promise<BrowserWorkbenchDomHint | null>;
  setAnnotationMode: (sessionId: string, enabled: boolean) => Promise<BrowserWorkbenchState>;
  clickAt: (sessionId: string, input: { x: number; y: number; dblClick?: boolean }) => BrowserWorkbenchMouseResult;
  dragElement: (sessionId: string, input: { from_uid: string; to_uid: string; strategy?: "auto" | "ref" | "selector" | "xpath"; index?: number }) => Promise<{ success: boolean; error?: string }>;
  fillForm: (sessionId: string, input: { elements: Array<{ target: string; value: string; strategy?: "auto" | "ref" | "selector" | "xpath"; index?: number }> }) => Promise<{ success: boolean; result?: unknown; error?: string }>;
  navigatePage: (sessionId: string, input: { type?: "url" | "back" | "forward" | "reload"; url?: string; ignoreCache?: boolean }) => BrowserWorkbenchState;
  resizeView: (sessionId: string, input: { width: number; height: number }) => BrowserWorkbenchState;
  handleDialog: (sessionId: string, input: { action: "accept" | "dismiss"; promptText?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  uploadFile: (sessionId: string, input: { target: string; filePath: string; strategy?: "auto" | "ref" | "selector" | "xpath"; index?: number }) => Promise<{ success: boolean; path?: string; error?: string }>;
  enhancedSnapshot: (sessionId: string, input: { maxResults?: number; visibleOnly?: boolean }) => Promise<{ success: boolean; snapshot?: BrowserWorkbenchInteractiveSnapshot; error?: string }>;
  listNetworkRequests: (sessionId: string, input: { pageSize?: number; pageIdx?: number; resourceTypes?: string[] }) => { success: boolean; result?: BrowserWorkbenchNetworkLogResult; error?: string };
  getNetworkRequest: (sessionId: string, reqid: number) => Promise<{ success: boolean; result?: BrowserWorkbenchNetworkLog & { responseBody?: string; responseBodyBase64Encoded?: boolean; responseBodyTruncated?: boolean }; error?: string }>;
  listConsoleMessages: (sessionId: string, input: { pageSize?: number; pageIdx?: number; types?: string[] }) => { success: boolean; result?: { url: string; title?: string; total: number; entries: BrowserWorkbenchConsoleLog[] }; error?: string };
  getConsoleMessage: (sessionId: string, msgid: number) => { success: boolean; result?: BrowserWorkbenchConsoleLog; error?: string };
  startPerformanceTrace: (sessionId: string, input?: { reload?: boolean; autoStop?: boolean }) => Promise<{ success: boolean; state: BrowserWorkbenchState; error?: string }>;
  stopPerformanceTrace: (sessionId: string) => Promise<{ success: boolean; state: BrowserWorkbenchState; error?: string; traceEvents?: unknown[] }>;
  emulate: (sessionId: string, input: {
    networkConditions?: string;
    cpuThrottlingRate?: number;
    userAgent?: string;
    colorScheme?: "dark" | "light" | "auto";
    geolocation?: { latitude: number; longitude: number };
    viewport?: { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean; isLandscape?: boolean; hasTouch?: boolean };
  }) => Promise<{ success: boolean; state: BrowserWorkbenchState; error?: string }>;
  listPages: (sessionId: string) => { success: boolean; pages?: Array<{ pageId: number; url: string; title?: string }>; error?: string };
  selectPage: (sessionId: string, pageId: number) => BrowserWorkbenchState;
  newPage: (sessionId: string, input: { url: string; background?: boolean }) => Promise<BrowserWorkbenchState>;
  evaluateScriptEnhanced: (sessionId: string, input: {
    function: string;
    args?: string[];
  }) => Promise<{ success: boolean; result?: BrowserWorkbenchEvalResult & { output?: string }; error?: string }>;
};

const BROWSER_TOOLS_SERVER_NAME = "tech-cc-hub-browser";
const BROWSER_MCP_SERVER_VERSION = "1.0.0";
const MAX_CAPTURE_SNIPPET = 4096;
const DEFAULT_HTTP_PING_TIMEOUT_MS = 3000;
const MAX_HTTP_PING_TIMEOUT_MS = 15000;
const DEFAULT_CONSOLE_WAIT_TIMEOUT_MS = 10000;
const MAX_CONSOLE_WAIT_TIMEOUT_MS = 60000;
const CONSOLE_WAIT_INTERVAL_MS = 150;
const DEFAULT_FETCH_LOG_LIMIT = 30;
const MAX_FETCH_LOG_LIMIT = 200;
const MAX_BATCH_COMMANDS = 20;
const DEFAULT_BATCH_COMMAND_TIMEOUT_MS = 30000;
const MAX_BATCH_COMMAND_TIMEOUT_MS = 120000;

type HttpPingState =
  | "ok"
  | "redirect"
  | "reachable_not_ready"
  | "server_error"
  | "client_error"
  | "unknown_status";

let browserHost: BrowserWorkbenchToolHost | null = null;

// main.ts 在 BrowserWorkbenchManager 创建后调用；cleanup 时会传 null，避免旧窗口残留。
export function setBrowserToolHost(host: BrowserWorkbenchToolHost | null): void {
  browserHost = host;
}

export function getBrowserToolNames(): string[] {
  return BROWSER_TOOL_NAMES.map((name) => name);
}

function getHost(): BrowserWorkbenchToolHost {
  if (!browserHost) {
    throw new Error("浏览器工作台尚未初始化，无法执行浏览器工具。");
  }
  return browserHost;
}

type JsonRecord = Record<string, unknown>;

const FIELD_ALIASES: Record<string, string> = {
  box: "boundingBox",
  bounds: "boundingBox",
  computed: "computedStyle",
  css: "computedStyle",
  styles: "computedStyle",
  style: "computedStyle",
  vars: "cssVariables",
  variables: "cssVariables",
};

const QUERY_RESULT_BASE_FIELDS = ["url", "title", "strategy", "query", "total", "returned"] as const;
const QUERY_RESULT_TOP_FIELDS = new Set<string>([...QUERY_RESULT_BASE_FIELDS, "matches"]);
const STYLE_INSPECTION_BASE_FIELDS = ["url", "title", "strategy", "query", "index", "found"] as const;
const STYLE_INSPECTION_TOP_FIELDS = new Set<string>([
  ...STYLE_INSPECTION_BASE_FIELDS,
  "node",
  "inlineStyle",
  "computedStyle",
  "cssVariables",
]);

function normalizeFieldParts(field: string, removablePrefixes: string[] = []): string[] {
  const parts = field
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 0 && removablePrefixes.includes(parts[0])) {
    parts.shift();
  }
  return parts.map((part) => FIELD_ALIASES[part] ?? part);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPathValue(source: unknown, parts: string[]): unknown {
  if (parts.length === 0) {
    return source;
  }
  if (Array.isArray(source)) {
    return source.map((item) => getPathValue(item, parts)).filter((value) => value !== undefined);
  }
  if (!isRecord(source)) {
    return undefined;
  }
  const [head, ...tail] = parts;
  return getPathValue(source[head], tail);
}

function setPathValue(target: JsonRecord, parts: string[], value: unknown): void {
  if (parts.length === 0 || value === undefined) {
    return;
  }
  const [head, ...tail] = parts;
  if (tail.length === 0) {
    target[head] = value;
    return;
  }
  if (!isRecord(target[head])) {
    target[head] = {};
  }
  setPathValue(target[head] as JsonRecord, tail, value);
}

function normalizeFields(fields: string[] | undefined): string[] {
  return Array.from(new Set((fields ?? []).map((field) => field.trim()).filter(Boolean)));
}

function filterNodeQueryResult(
  result: BrowserWorkbenchNodeQueryResult,
  fields: string[] | undefined,
): BrowserWorkbenchNodeQueryResult | JsonRecord {
  const selectedFields = normalizeFields(fields);
  if (selectedFields.length === 0) {
    return result;
  }

  const filtered: JsonRecord = {};
  for (const field of QUERY_RESULT_BASE_FIELDS) {
    const value = result[field];
    if (value !== undefined) {
      filtered[field] = value;
    }
  }

  const wantsFullMatches = selectedFields.some((field) => {
    const parts = normalizeFieldParts(field, ["result"]);
    return parts.length === 1 && parts[0] === "matches";
  });
  const matchFields = selectedFields.filter((field) => {
    const parts = normalizeFieldParts(field, ["result", "matches", "match", "node"]);
    return parts.length > 0 && !QUERY_RESULT_TOP_FIELDS.has(parts[0]);
  });
  if (wantsFullMatches) {
    filtered.matches = result.matches;
  } else if (matchFields.length > 0 || selectedFields.some((field) => normalizeFieldParts(field, ["result"])[0] === "matches")) {
    filtered.matches = result.matches.map((match) => {
      const item: JsonRecord = { index: match.index };
      for (const field of matchFields) {
        const parts = normalizeFieldParts(field, ["result", "matches", "match", "node"]);
        setPathValue(item, parts, getPathValue(match, parts));
      }
      return item;
    });
  }

  for (const field of selectedFields) {
    const parts = normalizeFieldParts(field, ["result"]);
    if (parts.length > 0 && QUERY_RESULT_TOP_FIELDS.has(parts[0]) && parts[0] !== "matches") {
      setPathValue(filtered, parts, getPathValue(result, parts));
    }
  }

  return filtered;
}

function filterStyleInspection(
  inspection: BrowserWorkbenchStyleInspection,
  fields: string[] | undefined,
): BrowserWorkbenchStyleInspection | JsonRecord {
  const selectedFields = normalizeFields(fields);
  if (selectedFields.length === 0) {
    return inspection;
  }

  const filtered: JsonRecord = {};
  for (const field of STYLE_INSPECTION_BASE_FIELDS) {
    const value = inspection[field];
    if (value !== undefined) {
      filtered[field] = value;
    }
  }

  for (const field of selectedFields) {
    const parts = normalizeFieldParts(field, ["inspection"]);
    if (parts.length === 0) {
      continue;
    }
    if (STYLE_INSPECTION_TOP_FIELDS.has(parts[0])) {
      setPathValue(filtered, parts, getPathValue(inspection, parts));
      continue;
    }
    if (inspection.node) {
      setPathValue(filtered, ["node", ...parts], getPathValue(inspection.node, parts));
    }
  }

  return filtered;
}

function clampInteger(value: unknown, fallback = 80, max = 300): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), max));
}

function clampDuration(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(100, Math.min(Math.trunc(parsed), max));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeHttpUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

async function httpPing(url: string, timeoutMs: number): Promise<Record<string, unknown>> {
  const targetUrl = normalizeHttpUrl(url);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      action: "http_ping",
      success: true,
      url: targetUrl,
      method: "HEAD",
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      reachable: true,
      state: classifyHttpPingStatus(targetUrl, response.status),
      redirected: response.type === "opaqueredirect" || response.status >= 300 && response.status < 400,
      location: response.headers.get("location") || undefined,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      action: "http_ping",
      success: false,
      url: targetUrl,
      method: "HEAD",
      elapsedMs: Date.now() - startedAt,
      reachable: false,
      state: "unreachable",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function classifyHttpPingStatus(url: string, status: number): HttpPingState {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "redirect";
  if (status === 503 && /\/actuator\/health(?:\/|$|\?)/i.test(url)) return "reachable_not_ready";
  if (status >= 500 && status < 600) return "server_error";
  if (status >= 400 && status < 500) return "client_error";
  return "unknown_status";
}

function execFileText(command: string, args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const message = stderr?.trim() || error.message;
        reject(new Error(message));
        return;
      }
      resolve(stdout);
    });
  });
}

function execShellCommand(commandText: string, cwd: string | undefined, timeoutMs: number): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
}> {
  const command = process.platform === "win32" ? "cmd.exe" : "bash";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", commandText]
    : ["-lc", commandText];
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd: cwd?.trim() || undefined,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      const timedOut = Boolean(error && "killed" in error && error.killed && "signal" in error && error.signal === "SIGTERM");
      const exitCode = error && "code" in error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        error: error ? error.message : undefined,
      });
    });
  });
}

function parseJsonOutput(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }
  return JSON.parse(trimmed);
}

export function buildDiagnosePortPowerShellScript(port: number): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$port = ${port}`,
    "$connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)",
    "$items = @()",
    "foreach ($connection in $connections) {",
    "  $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue",
    "  $cim = Get-CimInstance Win32_Process -Filter \"ProcessId = $($connection.OwningProcess)\" -ErrorAction SilentlyContinue",
    "  $startedAt = $null",
    "  if ($process -and $process.StartTime) { $startedAt = $process.StartTime.ToString('yyyy-MM-dd HH:mm:ss') }",
    "  $processName = if ($process) { \"$($process.ProcessName).exe\" } elseif ($cim) { $cim.Name } else { $null }",
    "  $commandLine = if ($cim) { $cim.CommandLine } else { $null }",
    "  $items += [pscustomobject]@{",
    "    pid = $connection.OwningProcess",
    "    processName = $processName",
    "    localAddress = $connection.LocalAddress",
    "    localPort = $connection.LocalPort",
    "    state = $connection.State.ToString()",
    "    startedAt = $startedAt",
    "    commandLine = $commandLine",
    "  }",
    "}",
    "$items | ConvertTo-Json -Compress",
  ].join("\n");
}

export function buildPowerShellEncodedCommandArgs(script: string): string[] {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64"),
  ];
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      columns.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  columns.push(current);
  return columns;
}

async function getWindowsProcessName(pid: number): Promise<string | undefined> {
  try {
    const output = await execFileText("tasklist.exe", ["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"], 5000);
    const columns = parseCsvLine(output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "");
    return columns[0] || undefined;
  } catch {
    return undefined;
  }
}

async function diagnosePortWithNetstat(port: number): Promise<Record<string, unknown>> {
  const output = await execFileText("netstat.exe", ["-ano", "-p", "tcp"], 5000);
  const rawListeners = output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => {
      return parts[0]?.toUpperCase() === "TCP"
        && parts[1]?.endsWith(`:${port}`)
        && parts[3]?.toUpperCase() === "LISTENING"
        && Number.isFinite(Number.parseInt(parts[4] ?? "", 10));
    });

  const listeners: Array<Record<string, unknown>> = [];
  for (const parts of rawListeners) {
    const pid = Number.parseInt(parts[4] ?? "", 10);
    const localAddress = (parts[1] ?? "").slice(0, -String(port).length - 1);
    listeners.push({
      pid,
      processName: await getWindowsProcessName(pid),
      localAddress,
      localPort: port,
      state: "Listen",
    });
  }

  return buildDiagnosePortResult(port, listeners, "netstat");
}

function buildKillCommands(pid: unknown): Record<string, string> | undefined {
  if (!pid) return undefined;
  const normalizedPid = String(pid);
  return {
    cmd: `taskkill /PID ${normalizedPid} /F`,
    bash: `taskkill //PID ${normalizedPid} //F`,
    powershell: `taskkill.exe /PID ${normalizedPid} /F`,
  };
}

function buildDiagnosePortResult(
  port: number,
  listeners: Array<Record<string, unknown>>,
  source: "powershell" | "netstat",
  diagnosticError?: string,
): Record<string, unknown> {
  const first = listeners[0];
  return {
    action: "diagnose_port",
    success: true,
    source,
    port,
    listening: listeners.length > 0,
    listeners,
    suggestion: first
      ? `${port} is occupied by ${String(first.processName || "unknown process")} (PID ${String(first.pid || "unknown")})${first.startedAt ? `, started at ${String(first.startedAt)}` : ""}. Kill only if this is a stale dev server.`
      : `${port} is free; start the dev server directly.`,
    killCommand: first?.pid ? `taskkill /PID ${String(first.pid)} /F` : undefined,
    killCommands: buildKillCommands(first?.pid),
    diagnosticError,
  };
}

async function diagnosePort(port: number): Promise<Record<string, unknown>> {
  if (process.platform !== "win32") {
    return {
      action: "diagnose_port",
      success: false,
      port,
      error: "diagnose_port currently supports Windows only.",
    };
  }

  const psScript = buildDiagnosePortPowerShellScript(port);

  try {
    const output = await execFileText("powershell.exe", buildPowerShellEncodedCommandArgs(psScript));
    const parsed = parseJsonOutput(output);
    const listeners = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    return buildDiagnosePortResult(port, listeners as Array<Record<string, unknown>>, "powershell");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      return await diagnosePortWithNetstat(port).then((result) => ({
        ...result,
        diagnosticError: message,
      }));
    } catch {
      // Fall through to the original PowerShell failure if the fallback also fails.
    }
    return {
      action: "diagnose_port",
      success: false,
      port,
      error: message,
    };
  }
}

async function bashBatch(input: {
  commands: string[];
  cwd?: string;
  timeoutMs?: number;
  stopOnError?: boolean;
}): Promise<Record<string, unknown>> {
  const commands = input.commands
    .map((command) => command.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH_COMMANDS);
  const timeoutMs = clampDuration(input.timeoutMs, DEFAULT_BATCH_COMMAND_TIMEOUT_MS, MAX_BATCH_COMMAND_TIMEOUT_MS);
  const stopOnError = input.stopOnError !== false;
  const startedAt = Date.now();
  const results: Array<Record<string, unknown>> = [];

  for (const [index, command] of commands.entries()) {
    const commandStartedAt = Date.now();
    const result = await execShellCommand(command, input.cwd, timeoutMs);
    const item = {
      index: index + 1,
      command,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      elapsedMs: Date.now() - commandStartedAt,
      stdout: result.stdout.slice(0, 20000),
      stderr: result.stderr.slice(0, 20000),
      error: result.error,
    };
    results.push(item);
    if (stopOnError && result.exitCode !== 0) {
      break;
    }
  }

  const failed = results.find((item) => item.exitCode !== 0 || item.timedOut);
  return {
    action: "bash_batch",
    success: !failed,
    shell: process.platform === "win32" ? "cmd.exe" : "bash",
    cwd: input.cwd || process.cwd(),
    stopOnError,
    requested: input.commands.length,
    executed: results.length,
    elapsedMs: Date.now() - startedAt,
    results,
  };
}

function logMatches(log: BrowserWorkbenchConsoleLog, pattern: string, mode: "contains" | "regex", level?: BrowserWorkbenchConsoleLog["level"]): boolean {
  if (level && log.level !== level) {
    return false;
  }
  if (mode === "regex") {
    try {
      return new RegExp(pattern).test(log.message);
    } catch {
      return false;
    }
  }
  return log.message.includes(pattern);
}

async function waitForConsoleLog(
  host: BrowserWorkbenchToolHost,
  sessionId: string,
  input: {
    limit?: number;
    waitFor: string;
    waitMode?: "contains" | "regex";
    level?: BrowserWorkbenchConsoleLog["level"];
    timeoutMs?: number;
  },
): Promise<{ logs: BrowserWorkbenchConsoleLog[]; matchedLog?: BrowserWorkbenchConsoleLog; timedOut: boolean; elapsedMs: number }> {
  const startedAt = Date.now();
  const timeoutMs = clampDuration(input.timeoutMs, DEFAULT_CONSOLE_WAIT_TIMEOUT_MS, MAX_CONSOLE_WAIT_TIMEOUT_MS);
  const limit = clampInteger(input.limit, 80, 300);
  const mode = input.waitMode === "regex" ? "regex" : "contains";
  let logs = host.getConsoleLogs(sessionId, limit);

  while (Date.now() - startedAt <= timeoutMs) {
    logs = host.getConsoleLogs(sessionId, limit);
    const matchedLog = logs.find((log) => logMatches(log, input.waitFor, mode, input.level));
    if (matchedLog) {
      return { logs, matchedLog, timedOut: false, elapsedMs: Date.now() - startedAt };
    }
    await sleep(CONSOLE_WAIT_INTERVAL_MS);
  }

  logs = host.getConsoleLogs(sessionId, limit);
  return { logs, timedOut: true, elapsedMs: Date.now() - startedAt };
}

// 截图 data URL 很大，这里只返回片段给模型；真正做视觉对比要走 design MCP 保存文件。
function getShortCaptureSnippet(dataUrl?: string): { dataUrl?: string; truncated: boolean } {
  if (!dataUrl) return { dataUrl, truncated: false };
  if (dataUrl.length <= MAX_CAPTURE_SNIPPET) {
    return { dataUrl, truncated: false };
  }
  return {
    dataUrl: dataUrl.slice(0, MAX_CAPTURE_SNIPPET),
    truncated: true,
  };
}

export function getBrowserMcpServer(sessionId = "global"): McpSdkServerConfigWithInstance {
  const resolvedSessionId = sessionId.trim() || "global";

  const httpPingTool = tool(
    "http_ping",
    "Lightweight URL liveness check. Sends a HEAD request and returns status/latency without loading the page in BrowserView.",
    {
      url: z.string().trim().min(1),
      timeoutMs: z.number().int().min(100).max(MAX_HTTP_PING_TIMEOUT_MS).optional(),
    },
    async (input) => {
      const timeoutMs = clampDuration(input.timeoutMs, DEFAULT_HTTP_PING_TIMEOUT_MS, MAX_HTTP_PING_TIMEOUT_MS);
      return toTextToolResult(await httpPing(input.url, timeoutMs));
    },
  );

  const diagnosePortTool = tool(
    "diagnose_port",
    "Diagnose a local listening port on Windows. Returns listener PID, process name, start time, command line, and a suggested next action.",
    { port: z.number().int().min(1).max(65535) },
    async (input) => {
      return toTextToolResult(await diagnosePort(input.port));
    },
  );

  const bashBatchTool = tool(
    "bash_batch",
    "Run multiple shell commands sequentially and return per-command stdout/stderr/exit code. Defaults to stopping at the first failing command.",
    {
      commands: z.array(z.string().trim().min(1)).min(1).max(MAX_BATCH_COMMANDS),
      cwd: z.string().trim().min(1).optional(),
      timeoutMs: z.number().int().min(100).max(MAX_BATCH_COMMAND_TIMEOUT_MS).optional(),
      stopOnError: z.boolean().optional(),
    },
    async (input) => {
      return toTextToolResult(await bashBatch({
        commands: input.commands,
        cwd: input.cwd,
        timeoutMs: input.timeoutMs,
        stopOnError: input.stopOnError,
      }));
    },
  );

  const openPageTool = tool(
    "browser_open_page",
    "打开/切换浏览器预览页的 URL。",
    { url: z.string().trim().min(1) },
    async (input) => {
      const host = getHost();
      const state = host.open(resolvedSessionId, input.url);
      return toTextToolResult({ action: "browser_open_page", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const closePageTool = tool(
    "browser_close_page",
    "关闭浏览器预览页面及标注会话。",
    {},
    async () => {
      const host = getHost();
      const state = host.close(resolvedSessionId);
      return toTextToolResult({ action: "browser_close_page", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const getStateTool = tool(
    "browser_get_state",
    "获取当前浏览器预览页状态（URL、标题、加载/前进后退状态）。",
    {},
    async () => {
      const host = getHost();
      const state = host.getState(resolvedSessionId);
      return toTextToolResult({ action: "browser_get_state", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const navigateTool = tool(
    "browser_navigate",
    "执行浏览器预览页导航，支持 back/forward。",
    { direction: z.enum(["back", "forward"]) },
    async (input) => {
      const host = getHost();
      const state = input.direction === "back" ? host.goBack(resolvedSessionId) : host.goForward(resolvedSessionId);
      return toTextToolResult({ action: "browser_navigate", direction: input.direction, success: true, sessionId: resolvedSessionId, state });
    },
  );

  const reloadTool = tool(
    "browser_reload",
    "重新加载当前浏览器预览页。",
    {},
    async () => {
      const host = getHost();
      const state = host.reload(resolvedSessionId);
      return toTextToolResult({ action: "browser_reload", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const extractPageTool = tool(
    "browser_extract_page",
    "提取当前浏览器页面的数据，包括 URL、标题、描述、正文文本、标题层级、链接和图片。用户要求读取/爬取当前内置浏览器页面时优先使用这个工具。",
    {},
    async () => {
      const host = getHost();
      const result = await host.extractPageSnapshot(resolvedSessionId);
      if (!result.success) {
        return toTextToolResult({ action: "browser_extract_page", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "browser_extract_page",
        success: true,
        sessionId: resolvedSessionId,
        snapshot: result.snapshot,
      });
    },
  );

  const captureTool = tool(
    "browser_capture_visible",
    "截取当前浏览器页面可见区域。为避免上下文过大，返回的是文本摘要片段。",
    {},
    async () => {
      const host = getHost();
      const capture = await host.captureVisible(resolvedSessionId);
      if (!capture.success) {
        return toTextToolResult({ action: "browser_capture_visible", success: false, error: capture.error }, true);
      }

      const snippet = getShortCaptureSnippet(capture.dataUrl);
      return toTextToolResult({
        action: "browser_capture_visible",
        success: true,
        sessionId: resolvedSessionId,
        urlDataSnippet: snippet.dataUrl,
        truncated: snippet.truncated,
        totalLength: capture.dataUrl?.length,
      });
    },
  );

  const saveScreenshotTool = tool(
    "browser_save_screenshot",
    "保存当前 BrowserView 可见区域截图到本地文件，返回文件路径和字节数。",
    {
      path: z.string().trim().min(1).optional(),
      format: z.enum(["png", "jpeg"]).optional(),
      quality: z.number().int().min(1).max(100).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.saveScreenshot(resolvedSessionId, {
        path: input.path,
        format: input.format,
        quality: input.quality,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_save_screenshot", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_save_screenshot", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const savePdfTool = tool(
    "browser_save_pdf",
    "将当前页面打印为 PDF 并保存到本地文件，返回文件路径和字节数。",
    {
      path: z.string().trim().min(1).optional(),
      landscape: z.boolean().optional(),
      printBackground: z.boolean().optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.savePdf(resolvedSessionId, {
        path: input.path,
        landscape: input.landscape,
        printBackground: input.printBackground,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_save_pdf", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_save_pdf", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const cookiesTool = tool(
    "browser_cookies",
    "管理当前 BrowserView session cookies。支持 list/set/remove/flush。",
    {
      action: z.enum(["list", "set", "remove", "flush"]),
      url: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1).optional(),
      value: z.string().optional(),
      domain: z.string().optional(),
      path: z.string().optional(),
      secure: z.boolean().optional(),
      httpOnly: z.boolean().optional(),
      expirationDate: z.number().optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.manageCookies(resolvedSessionId, input);
      if (!result.success) {
        return toTextToolResult({ action: "browser_cookies", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_cookies", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const storageTool = tool(
    "browser_storage",
    "管理当前页面 localStorage/sessionStorage。支持 get/set/remove/clear。",
    {
      action: z.enum(["get", "set", "remove", "clear"]),
      area: z.enum(["localStorage", "sessionStorage"]).optional(),
      key: z.string().optional(),
      value: z.string().optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.manageStorage(resolvedSessionId, input);
      if (!result.success) {
        return toTextToolResult({ action: "browser_storage", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_storage", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const consoleLogsTool = tool(
    "browser_console_logs",
    "读取浏览器控制台最近日志。可用 waitFor 等待指定日志出现，例如等待 Vite HMR 完成。",
    {
      limit: z.number().int().min(1).max(300).optional(),
      waitFor: z.string().trim().min(1).optional(),
      waitMode: z.enum(["contains", "regex"]).optional(),
      level: z.enum(["debug", "info", "log", "warn", "error"]).optional(),
      timeoutMs: z.number().int().min(100).max(MAX_CONSOLE_WAIT_TIMEOUT_MS).optional(),
    },
    async (input) => {
      const host = getHost();
      if (input.waitFor) {
        const waitResult = await waitForConsoleLog(host, resolvedSessionId, {
          limit: input.limit,
          waitFor: input.waitFor,
          waitMode: input.waitMode,
          level: input.level,
          timeoutMs: input.timeoutMs,
        });
        return toTextToolResult({
          action: "browser_console_logs",
          success: !waitResult.timedOut,
          sessionId: resolvedSessionId,
          waitFor: input.waitFor,
          waitMode: input.waitMode ?? "contains",
          level: input.level,
          timedOut: waitResult.timedOut,
          elapsedMs: waitResult.elapsedMs,
          matchedLog: waitResult.matchedLog,
          limit: waitResult.logs.length,
          logs: waitResult.logs,
        }, waitResult.timedOut);
      }
      const logs = host.getConsoleLogs(resolvedSessionId, input.limit);
      return toTextToolResult({
        action: "browser_console_logs",
        success: true,
        sessionId: resolvedSessionId,
        limit: logs.length,
        logs,
      });
    },
  );

  const fetchLogsTool = tool(
    "browser_fetch_logs",
    "Read captured BrowserView Fetch/XHR requests, status codes, post data, and JSON/text response bodies. Use this after page interactions when API data matters.",
    {
      limit: z.number().int().min(1).max(MAX_FETCH_LOG_LIMIT).optional(),
      includeBody: z.boolean().optional(),
      includeHeaders: z.boolean().optional(),
      urlContains: z.string().trim().min(1).optional(),
      resourceTypes: z.array(z.string().trim().min(1)).max(20).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = host.getNetworkLogs(resolvedSessionId, {
        limit: input.limit ?? DEFAULT_FETCH_LOG_LIMIT,
        includeBody: input.includeBody,
        includeHeaders: input.includeHeaders,
        urlContains: input.urlContains,
        resourceTypes: input.resourceTypes ?? ["Fetch", "XHR"],
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_fetch_logs", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "browser_fetch_logs",
        success: true,
        sessionId: resolvedSessionId,
        result: result.result,
      });
    },
  );

  const domStatsTool = tool(
    "browser_get_dom_stats",
    "统计当前页面 DOM 规模和结构，返回节点总数、交互元素数量以及最常见标签，适合快速判断页面复杂度。",
    {},
    async () => {
      const host = getHost();
      const result = await host.getDomStats(resolvedSessionId);
      if (!result.success) {
        return toTextToolResult({ action: "browser_get_dom_stats", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "browser_get_dom_stats",
        success: true,
        sessionId: resolvedSessionId,
        stats: result.stats,
      });
    },
  );

  const interactiveSnapshotTool = tool(
    "browser_snapshot_interactive",
    "提取当前页面可交互元素快照，并生成 @e1 这类稳定短 ref。后续可用 browser_click_element / browser_fill_element 直接操作这些 ref。",
    {
      maxResults: z.number().int().min(1).max(200).optional(),
      visibleOnly: z.boolean().optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.getInteractiveSnapshot(resolvedSessionId, {
        maxResults: clampInteger(input.maxResults, 80, 200),
        visibleOnly: input.visibleOnly,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_snapshot_interactive", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "browser_snapshot_interactive",
        success: true,
        sessionId: resolvedSessionId,
        snapshot: result.snapshot,
      });
    },
  );

  const clickElementTool = tool(
    "browser_click_element",
    "点击当前页面元素。target 支持 browser_snapshot_interactive 返回的 @e1 ref、CSS selector 或 XPath。",
    {
      target: z.string().trim().min(1),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.clickElement(resolvedSessionId, {
        target: input.target,
        strategy: input.strategy,
        index: input.index,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_click_element", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({
        action: "browser_click_element",
        success: true,
        sessionId: resolvedSessionId,
        result: result.result,
      });
    },
  );

  const createElementActionTool = (
    name: string,
    action: BrowserWorkbenchElementActionName,
    description: string,
  ) => tool(
    name,
    description,
    {
      target: z.string().trim().min(1),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.runElementAction(resolvedSessionId, {
        action,
        target: input.target,
        strategy: input.strategy,
        index: input.index,
      });
      if (!result.success) {
        return toTextToolResult({ action: name, success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: name, success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const createElementValueActionTool = (
    name: string,
    action: BrowserWorkbenchElementActionName,
    valueLabel: "text" | "value",
    description: string,
  ) => tool(
    name,
    description,
    {
      target: z.string().trim().min(1),
      [valueLabel]: z.string(),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
    },
    async (input) => {
      const host = getHost();
      const value = String(valueLabel === "text" ? input.text : input.value);
      const result = await host.runElementAction(resolvedSessionId, {
        action,
        target: input.target,
        value,
        strategy: input.strategy,
        index: input.index,
      });
      if (!result.success) {
        return toTextToolResult({ action: name, success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: name, success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const dblclickElementTool = createElementActionTool(
    "browser_dblclick_element",
    "dblclick",
    "双击当前页面元素。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const focusElementTool = createElementActionTool(
    "browser_focus_element",
    "focus",
    "聚焦当前页面元素。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const hoverElementTool = createElementActionTool(
    "browser_hover_element",
    "hover",
    "悬停当前页面元素，触发 mouseover/mouseenter/mousemove。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const scrollIntoViewTool = createElementActionTool(
    "browser_scroll_into_view",
    "scrollIntoView",
    "将当前页面元素滚动到视口中间。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const typeElementTool = createElementValueActionTool(
    "browser_type_element",
    "type",
    "text",
    "向目标输入元素追加文本，并触发 input/change 事件。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const fillElementTool = tool(
    "browser_fill_element",
    "填写当前页面输入元素。target 支持 @e1 ref、CSS selector 或 XPath；会触发 input/change 事件。",
    {
      target: z.string().trim().min(1),
      value: z.string(),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.fillElement(resolvedSessionId, {
        target: input.target,
        value: input.value,
        strategy: input.strategy,
        index: input.index,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_fill_element", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({
        action: "browser_fill_element",
        success: true,
        sessionId: resolvedSessionId,
        result: result.result,
      });
    },
  );

  const selectElementTool = createElementValueActionTool(
    "browser_select_element",
    "select",
    "value",
    "设置 select 元素的 value，并触发 input/change 事件。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const checkElementTool = createElementActionTool(
    "browser_check_element",
    "check",
    "勾选 checkbox/radio 或 role=checkbox 元素。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const uncheckElementTool = createElementActionTool(
    "browser_uncheck_element",
    "uncheck",
    "取消勾选 checkbox 或 role=checkbox 元素。target 支持 @e1 ref、CSS selector 或 XPath。",
  );

  const getElementTool = tool(
    "browser_get_element",
    "读取当前页面信息或元素信息。kind 支持 text/html/value/attr/title/url/count/box/styles；target 支持 @e1 ref、CSS selector 或 XPath。",
    {
      kind: z.enum(["text", "html", "value", "attr", "title", "url", "count", "box", "styles"]),
      target: z.string().trim().min(1).optional(),
      attribute: z.string().trim().min(1).optional(),
      properties: z.array(z.string()).max(80).optional(),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.getElementInfo(resolvedSessionId, {
        kind: input.kind,
        target: input.target ?? "html",
        attribute: input.attribute,
        properties: input.properties,
        strategy: input.strategy,
        index: input.index,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_get_element", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_get_element", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const evalTool = tool(
    "browser_eval",
    "在当前 BrowserView 页面上下文执行 JavaScript 表达式或脚本，返回可序列化结果。仅用于读取/诊断或明确需要的页面操作。",
    { expression: z.string().trim().min(1) },
    async (input) => {
      const host = getHost();
      const result = await host.evaluateJavaScript(resolvedSessionId, input.expression);
      if (!result.success) {
        return toTextToolResult({ action: "browser_eval", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_eval", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const pressKeyTool = tool(
    "browser_press_key",
    "向当前 BrowserView 焦点发送单个按键，例如 Enter、Tab、Escape、Backspace。",
    { key: z.string().trim().min(1).max(64) },
    async (input) => {
      const host = getHost();
      const result = host.pressKey(resolvedSessionId, input.key);
      if (!result.success) {
        return toTextToolResult({ action: "browser_press_key", success: false, error: result.error, key: result.key, state: result.state }, true);
      }
      return toTextToolResult({ action: "browser_press_key", success: true, sessionId: resolvedSessionId, key: result.key, state: result.state });
    },
  );

  const keyDownTool = tool(
    "browser_key_down",
    "向当前 BrowserView 焦点发送 keyDown，可用于组合键的第一步。",
    { key: z.string().trim().min(1).max(64) },
    async (input) => {
      const host = getHost();
      const result = host.sendKeyEvent(resolvedSessionId, "down", input.key);
      if (!result.success) {
        return toTextToolResult({ action: "browser_key_down", success: false, error: result.error, result }, true);
      }
      return toTextToolResult({ action: "browser_key_down", success: true, sessionId: resolvedSessionId, result });
    },
  );

  const keyUpTool = tool(
    "browser_key_up",
    "向当前 BrowserView 焦点发送 keyUp，可用于组合键的最后一步。",
    { key: z.string().trim().min(1).max(64) },
    async (input) => {
      const host = getHost();
      const result = host.sendKeyEvent(resolvedSessionId, "up", input.key);
      if (!result.success) {
        return toTextToolResult({ action: "browser_key_up", success: false, error: result.error, result }, true);
      }
      return toTextToolResult({ action: "browser_key_up", success: true, sessionId: resolvedSessionId, result });
    },
  );

  const keyboardTypeTool = tool(
    "browser_keyboard_type",
    "向当前焦点用键盘字符事件输入文本，不指定 selector。",
    { text: z.string() },
    async (input) => {
      const host = getHost();
      const result = host.sendKeyboardText(resolvedSessionId, "type", input.text);
      if (!result.success) {
        return toTextToolResult({ action: "browser_keyboard_type", success: false, error: result.error, result }, true);
      }
      return toTextToolResult({ action: "browser_keyboard_type", success: true, sessionId: resolvedSessionId, result });
    },
  );

  const keyboardInsertTextTool = tool(
    "browser_keyboard_insert_text",
    "向当前焦点插入文本，不发送逐字符 key 事件。",
    { text: z.string() },
    async (input) => {
      const host = getHost();
      const result = host.sendKeyboardText(resolvedSessionId, "insertText", input.text);
      if (!result.success) {
        return toTextToolResult({ action: "browser_keyboard_insert_text", success: false, error: result.error, result }, true);
      }
      return toTextToolResult({ action: "browser_keyboard_insert_text", success: true, sessionId: resolvedSessionId, result });
    },
  );

  const mouseTool = tool(
    "browser_mouse",
    "向当前 BrowserView 发送鼠标事件。支持 move/down/up/wheel，坐标为 BrowserView 视口坐标。",
    {
      action: z.enum(["move", "down", "up", "wheel"]),
      x: z.number().optional(),
      y: z.number().optional(),
      button: z.enum(["left", "right", "middle"]).optional(),
      deltaX: z.number().optional(),
      deltaY: z.number().optional(),
    },
    async (input) => {
      const host = getHost();
      const result = host.sendMouseEvent(resolvedSessionId, {
        action: input.action,
        x: input.x,
        y: input.y,
        button: input.button,
        deltaX: input.deltaX,
        deltaY: input.deltaY,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_mouse", success: false, error: result.error, result }, true);
      }
      return toTextToolResult({ action: "browser_mouse", success: true, sessionId: resolvedSessionId, result });
    },
  );

  const scrollPageTool = tool(
    "browser_scroll_page",
    "滚动当前页面或指定元素。target 可选，支持 @e1 ref、CSS selector 或 XPath。",
    {
      direction: z.enum(["up", "down", "left", "right"]).optional(),
      amount: z.number().int().min(1).max(4000).optional(),
      target: z.string().trim().min(1).optional(),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.scrollPage(resolvedSessionId, {
        direction: input.direction,
        amount: input.amount,
        target: input.target,
        strategy: input.strategy,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_scroll_page", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_scroll_page", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const waitForTool = tool(
    "browser_wait_for",
    "等待页面条件满足。支持 load、selector、text、url、time、function；selector 可等 visible/hidden/attached。",
    {
      condition: z.enum(["load", "selector", "text", "url", "time", "function"]),
      value: z.string().optional(),
      strategy: z.enum(["selector", "xpath"]).optional(),
      state: z.enum(["visible", "hidden", "attached"]).optional(),
      timeoutMs: z.number().int().min(100).max(30000).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.waitFor(resolvedSessionId, {
        condition: input.condition,
        value: input.value,
        strategy: input.strategy,
        state: input.state,
        timeoutMs: input.timeoutMs,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_wait_for", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({ action: "browser_wait_for", success: true, sessionId: resolvedSessionId, result: result.result });
    },
  );

  const queryNodesTool = tool(
    "browser_query_nodes",
    "按 CSS selector 或 XPath 查询页面节点，返回匹配数量、节点路径、属性、文本和可选样式，适合定向定位组件或批量检查 DOM。可用 fields 只返回需要的字段，例如 [\"text\", \"selector\", \"box\", \"computed.color\"]。",
    {
      query: z.string().trim().min(1),
      strategy: z.enum(["selector", "xpath"]).optional(),
      maxResults: z.number().int().min(1).max(50).optional(),
      includeStyles: z.boolean().optional(),
      styleProps: z.array(z.string()).max(40).optional(),
      fields: z.array(z.string().trim().min(1)).max(80).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.queryNodes(resolvedSessionId, {
        strategy: input.strategy,
        query: input.query,
        maxResults: clampInteger(input.maxResults, 8, 50),
        includeStyles: input.includeStyles,
        styleProps: input.styleProps,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_query_nodes", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "browser_query_nodes",
        success: true,
        sessionId: resolvedSessionId,
        result: result.result ? filterNodeQueryResult(result.result, input.fields) : result.result,
      });
    },
  );

  const inspectStylesTool = tool(
    "browser_inspect_styles",
    "按 CSS selector 或 XPath 读取目标节点的计算样式、CSS 变量、内联样式和节点基础信息，适合诊断布局和样式问题。可用 fields 只返回需要的字段，例如 [\"inlineStyle\", \"computed.color\", \"node.text\", \"box\"]。",
    {
      query: z.string().trim().min(1),
      strategy: z.enum(["selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
      properties: z.array(z.string()).max(60).optional(),
      fields: z.array(z.string().trim().min(1)).max(80).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.inspectStyles(resolvedSessionId, {
        strategy: input.strategy,
        query: input.query,
        index: input.index,
        properties: input.properties,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_inspect_styles", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "browser_inspect_styles",
        success: true,
        sessionId: resolvedSessionId,
        inspection: result.inspection ? filterStyleInspection(result.inspection, input.fields) : result.inspection,
      });
    },
  );

  const applyStylesTool = tool(
    "browser_apply_styles",
    "Temporarily apply inline CSS styles to an element in the current BrowserView for preview before editing source files.",
    {
      query: z.string().trim().min(1),
      strategy: z.enum(["selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
      styles: z.record(z.string(), z.union([z.string(), z.number()])),
      persist: z.boolean().optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.applyStyles(resolvedSessionId, {
        strategy: input.strategy,
        query: input.query,
        index: input.index,
        styles: input.styles,
        persist: input.persist,
      });
      if (!result.success) {
        return toTextToolResult({ action: "browser_apply_styles", success: false, error: result.error, result: result.result }, true);
      }
      return toTextToolResult({
        action: "browser_apply_styles",
        success: true,
        sessionId: resolvedSessionId,
        result: result.result,
      });
    },
  );

  const inspectPointTool = tool(
    "browser_inspect_at_point",
    "在浏览器预览页中根据坐标提取 DOM 线索（selector、文本、路径等）。",
    { x: z.number(), y: z.number() },
    async (input) => {
      const host = getHost();
      const domHint = await host.inspectAtPoint(resolvedSessionId, { x: clampInteger(input.x, 0, Number.MAX_SAFE_INTEGER), y: clampInteger(input.y, 0, Number.MAX_SAFE_INTEGER) });
      return toTextToolResult({
        action: "browser_inspect_at_point",
        success: true,
        sessionId: resolvedSessionId,
        domHint,
      });
    },
  );

  const setAnnotationModeTool = tool(
    "browser_set_annotation_mode",
    "切换浏览器预览页标注模式（开启/关闭）。",
    { enabled: z.boolean() },
    async (input) => {
      const host = getHost();
      const state = await host.setAnnotationMode(resolvedSessionId, input.enabled);
      return toTextToolResult({
        action: "browser_set_annotation_mode",
        success: true,
        sessionId: resolvedSessionId,
        enabled: input.enabled,
        state,
      });
    },
  );

  // ── Phase 1: upstream CV tools ──
  // Sources: chrome-devtools-mcp/src/tools/input.ts, pages.ts, snapshot.ts

  // Source: chrome-devtools-mcp/src/tools/input.ts (click)
  const clickAtTool = tool(
    "click_at",
    `Clicks at the provided coordinates.`,
    {
      x: z.number().int().describe("The x coordinate"),
      y: z.number().int().describe("The y coordinate"),
      dblClick: z.boolean().optional().describe("Set to true for double clicks. Default is false."),
    },
    async (input) => {
      const host = getHost();
      const result = host.clickAt(resolvedSessionId, { x: input.x, y: input.y, dblClick: input.dblClick });
      return toTextToolResult({
        action: "click_at",
        success: result.success,
        x: input.x,
        y: input.y,
        dblClick: input.dblClick ?? false,
        state: result.state,
        error: result.error,
      }, !result.success);
    },
  );

  const dragTool = tool(
    "drag",
    `Drag an element onto another element.`,
    {
      from_uid: z.string().min(1).describe("The uid of the element to drag"),
      to_uid: z.string().min(1).describe("The uid of the element to drop into"),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.dragElement(resolvedSessionId, {
        from_uid: input.from_uid,
        to_uid: input.to_uid,
        strategy: input.strategy,
        index: input.index,
      });
      return toTextToolResult({
        action: "drag",
        success: result.success,
        error: result.error,
      }, !result.success);
    },
  );

  const fillFormTool = tool(
    "fill_form",
    `Fill out multiple form elements (inputs, selects, checkboxes, radios) at once. ALWAYS prefer this tool over multiple individual fill or click calls when interacting with forms. It is significantly faster, more reliable, and reduces turn count.`,
    {
      elements: z.array(
        z.object({
          target: z.string().min(1).describe("The uid/selector/xpath of the element to fill"),
          value: z.string().describe("Value for the element. 'true' or 'false' for checkboxes, radio buttons and toggles."),
          strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
          index: z.number().int().min(0).optional(),
        }),
      ).min(1).describe("Elements from snapshot to fill out."),
    },
    async (input) => {
      const host = getHost();
      const errors: string[] = [];
      let filled = 0;
      for (const element of input.elements) {
        const res = await host.runElementAction(resolvedSessionId, {
          action: "fill",
          target: element.target,
          value: element.value,
          strategy: element.strategy,
          index: element.index,
        });
        if (res.success) filled++;
        else errors.push(`${element.target}: ${res.error}`);
      }
      const result = { success: errors.length === 0, filled, total: input.elements.length, errors: errors.length > 0 ? errors : undefined };
      return toTextToolResult(result, !result.success);
    },
  );

  const navigatePageTool = tool(
    "navigate_page",
    `Go to a URL, or back, forward, or reload.`,
    {
      type: z.enum(["url", "back", "forward", "reload"]).optional().describe("Navigate the page by URL, back or forward in history, or reload."),
      url: z.string().optional().describe("Target URL (only for type=url)"),
      ignoreCache: z.boolean().optional().describe("Whether to ignore cache on reload."),
    },
    async (input) => {
      const host = getHost();
      let state: unknown;
      const resolvedType = input.type || (input.url ? "url" : "reload");
      if (resolvedType === "url" && input.url) {
        state = host.open(resolvedSessionId, input.url);
      } else if (resolvedType === "back") {
        state = host.goBack(resolvedSessionId);
      } else if (resolvedType === "forward") {
        state = host.goForward(resolvedSessionId);
      } else {
        state = host.reload(resolvedSessionId);
      }
      return toTextToolResult({ action: "navigate_page", type: resolvedType, success: true, state });
    },
  );

  const resizePageTool = tool(
    "resize_page",
    `Resizes the selected page's viewport to the specified dimensions.`,
    {
      width: z.number().int().min(100).describe("Page width in pixels"),
      height: z.number().int().min(100).describe("Page height in pixels"),
    },
    async (input) => {
      const host = getHost();
      const state = host.resizeView(resolvedSessionId, { width: input.width, height: input.height });
      return toTextToolResult({ action: "resize_page", success: true, width: input.width, height: input.height, state });
    },
  );

  const handleDialogTool = tool(
    "handle_dialog",
    `If a browser dialog was opened, use this command to handle it.`,
    {
      action: z.enum(["accept", "dismiss"]).describe("Whether to dismiss or accept the dialog"),
      promptText: z.string().optional().describe("Optional prompt text to enter into the dialog."),
    },
    async (input) => {
      const host = getHost();
      const result = await host.handleDialog(resolvedSessionId, { action: input.action, promptText: input.promptText });
      return toTextToolResult({ action: "handle_dialog", ...result }, !result.success);
    },
  );

  const uploadFileTool = tool(
    "upload_file",
    "Upload a file through a provided element.",
    {
      target: z.string().min(1).describe("The uid/selector/xpath of the file input element on the page"),
      filePath: z.string().min(1).describe("The local path of the file to upload"),
      strategy: z.enum(["auto", "ref", "selector", "xpath"]).optional(),
      index: z.number().int().min(0).optional(),
    },
    async (input) => {
      const host = getHost();
      const result = await host.uploadFile(resolvedSessionId, {
        target: input.target,
        filePath: input.filePath,
        strategy: input.strategy,
        index: input.index,
      });
      return toTextToolResult({ action: "upload_file", ...result }, !result.success);
    },
  );

  const takeSnapshotTool = tool(
    "take_snapshot",
    `Take a text snapshot of the currently selected page based on the a11y tree. The snapshot lists page elements along with a unique identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot.`,
    {},
    async () => {
      const host = getHost();
      const result = await host.enhancedSnapshot(resolvedSessionId, {
        maxResults: undefined,
        visibleOnly: true,
      });
      if (!result.success) {
        return toTextToolResult({ action: "take_snapshot", success: false, error: result.error }, true);
      }
      return toTextToolResult({
        action: "take_snapshot",
        success: true,
        url: result.snapshot?.url,
        total: result.snapshot?.total ?? 0,
        returned: result.snapshot?.returned ?? 0,
        elements: result.snapshot?.elements ?? [],
      });
    },
  );

  // ── Phase 2: CDP-based tools ──
  // Sources: chrome-devtools-mcp/src/tools/network.ts, console.ts, performance.ts

  const listNetworkRequestsTool = tool(
    "list_network_requests",
    `List all requests for the currently selected page since the last navigation.`,
    {
      pageSize: z.number().int().min(1).max(500).optional().describe("Maximum number of requests to return. When omitted, returns all requests."),
      pageIdx: z.number().int().min(0).optional().describe("Page number to return (0-based). When omitted, returns the first page."),
      resourceTypes: z.array(z.string()).optional().describe("Filter requests to only return requests of the specified resource types."),
    },
    async (input) => {
      const host = getHost();
      const result = host.listNetworkRequests(resolvedSessionId, {
        pageSize: input.pageSize,
        pageIdx: input.pageIdx,
        resourceTypes: input.resourceTypes,
      });
      return toTextToolResult(result, !result.success);
    },
  );

  const getNetworkRequestTool = tool(
    "get_network_request",
    `Gets a network request by an optional reqid, if omitted returns the currently selected request in the DevTools Network panel.`,
    {
      reqid: z.number().int().describe("The reqid of the network request."),
    },
    async (input) => {
      const host = getHost();
      const result = await host.getNetworkRequest(resolvedSessionId, input.reqid);
      return toTextToolResult(result, !result.success);
    },
  );

  const listConsoleMessagesTool = tool(
    "list_console_messages",
    `List all console messages for the currently selected page since the last navigation.`,
    {
      pageSize: z.number().int().min(1).max(1000).optional().describe("Maximum number of messages to return."),
      pageIdx: z.number().int().min(0).optional().describe("Page number to return (0-based)."),
      types: z.array(z.enum(["log", "debug", "info", "error", "warn"])).optional().describe("Filter messages by type."),
    },
    async (input) => {
      const host = getHost();
      const result = host.listConsoleMessages(resolvedSessionId, {
        pageSize: input.pageSize,
        pageIdx: input.pageIdx,
        types: input.types,
      });
      return toTextToolResult(result, !result.success);
    },
  );

  const getConsoleMessageTool = tool(
    "get_console_message",
    `Gets a console message by its ID. You can get all messages by calling list_console_messages.`,
    {
      msgid: z.number().int().min(0).describe("The msgid of a console message from the listed console messages"),
    },
    async (input) => {
      const host = getHost();
      const result = host.getConsoleMessage(resolvedSessionId, input.msgid);
      return toTextToolResult(result, !result.success);
    },
  );

  const performanceStartTraceTool = tool(
    "performance_start_trace",
    `Start a performance trace on the selected webpage. Use to find frontend performance issues and improve page load speed.`,
    {
      reload: z.boolean().optional().default(true).describe("Whether to reload the page after starting the trace."),
      autoStop: z.boolean().optional().default(true).describe("Whether to automatically stop the trace."),
    },
    async (input) => {
      const host = getHost();
      const result = await host.startPerformanceTrace(resolvedSessionId, {
        reload: input.reload,
        autoStop: input.autoStop,
      });
      return toTextToolResult(result, !result.success);
    },
  );

  const performanceStopTraceTool = tool(
    "performance_stop_trace",
    "Stop the active performance trace recording on the selected webpage.",
    {},
    async () => {
      const host = getHost();
      const result = await host.stopPerformanceTrace(resolvedSessionId);
      const summary = {
        success: result.success,
        error: result.error,
        traceEventCount: result.traceEvents ? (result.traceEvents as unknown[]).length : 0,
      };
      return toTextToolResult(summary, !result.success);
    },
  );

  // ── Phase 3: emulate + multi-page + evaluate_script ──
  // Sources: chrome-devtools-mcp/src/tools/emulation.ts, pages.ts, script.ts

  const emulateTool = tool(
    "emulate",
    `Emulates various features on the selected page.`,
    {
      networkConditions: z.enum(["Offline", "Slow3G", "Fast3G", "Slow4G", "Fast4G"]).optional().describe("Throttle network. Omit to disable throttling."),
      cpuThrottlingRate: z.number().int().min(1).max(20).optional().describe("CPU slowdown factor (1-20). Omit to disable."),
      userAgent: z.string().optional().describe("User agent string to emulate."),
      colorScheme: z.enum(["dark", "light", "auto"]).optional().describe("Color scheme to emulate."),
      geolocation: z.string().optional().describe("Geolocation as 'latitude,longitude'."),
      viewport: z.string().optional().describe("Viewport as 'widthxheightxdpr,mobile,touch,landscape'."),
    },
    async (input) => {
      const host = getHost();
      let geolocation: { latitude: number; longitude: number } | undefined;
      if (input.geolocation) {
        const [lat, lng] = input.geolocation.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          geolocation = { latitude: lat, longitude: lng };
        }
      }
      let viewport: { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean; isLandscape?: boolean; hasTouch?: boolean } | undefined;
      if (input.viewport) {
        const [dims, ...tags] = input.viewport.split(",");
        const [w, h, dpr] = dims.split("x").map(Number);
        if (!isNaN(w) && !isNaN(h)) {
          viewport = {
            width: w,
            height: h,
            deviceScaleFactor: dpr,
            isMobile: tags.includes("mobile"),
            isLandscape: tags.includes("landscape"),
            hasTouch: tags.includes("touch"),
          };
        }
      }
      const result = await host.emulate(resolvedSessionId, {
        networkConditions: input.networkConditions,
        cpuThrottlingRate: input.cpuThrottlingRate,
        userAgent: input.userAgent,
        colorScheme: input.colorScheme,
        geolocation,
        viewport,
      });
      return toTextToolResult({ action: "emulate", ...result }, !result.success);
    },
  );

  const listPagesTool = tool(
    "list_pages",
    `Get a list of pages open in the browser.`,
    {},
    async () => {
      const host = getHost();
      const result = host.listPages(resolvedSessionId);
      return toTextToolResult(result, !result.success);
    },
  );

  const selectPageTool = tool(
    "select_page",
    `Select a page as a context for future tool calls.`,
    {
      pageId: z.number().int().min(0).describe("The ID of the page to select."),
      bringToFront: z.boolean().optional().describe("Whether to focus the page."),
    },
    async (input) => {
      const host = getHost();
      const state = host.selectPage(resolvedSessionId, input.pageId);
      return toTextToolResult({ action: "select_page", success: true, pageId: input.pageId, state });
    },
  );

  const newPageTool = tool(
    "new_page",
    `Open a new tab and load a URL.`,
    {
      url: z.string().min(1).describe("URL to load in a new page."),
      background: z.boolean().optional().describe("Whether to open in background."),
    },
    async (input) => {
      const host = getHost();
      const state = await host.newPage(resolvedSessionId, { url: input.url, background: input.background });
      return toTextToolResult({ action: "new_page", success: true, url: input.url, state });
    },
  );

  const evaluateScriptTool = tool(
    "evaluate_script",
    `Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON, so returned values have to be JSON-serializable.`,
    {
      function: z.string().describe("A JavaScript function declaration to be executed. E.g., '() => { return document.title }'"),
      args: z.array(z.string()).optional().describe("Optional arguments to pass to the function (element UIDs)."),
    },
    async (input) => {
      const host = getHost();
      const result = await host.evaluateScriptEnhanced(resolvedSessionId, {
        function: input.function,
        args: input.args,
      });
      return toTextToolResult(result, !result.success);
    },
  );

  return createSdkMcpServer({
    name: BROWSER_TOOLS_SERVER_NAME,
    version: BROWSER_MCP_SERVER_VERSION,
    tools: [
      httpPingTool,
      diagnosePortTool,
      bashBatchTool,
      openPageTool,
      closePageTool,
      getStateTool,
      navigateTool,
      reloadTool,
      extractPageTool,
      captureTool,
      saveScreenshotTool,
      savePdfTool,
      cookiesTool,
      storageTool,
      consoleLogsTool,
      fetchLogsTool,
      domStatsTool,
      interactiveSnapshotTool,
      clickElementTool,
      dblclickElementTool,
      focusElementTool,
      hoverElementTool,
      typeElementTool,
      fillElementTool,
      selectElementTool,
      checkElementTool,
      uncheckElementTool,
      scrollIntoViewTool,
      getElementTool,
      evalTool,
      pressKeyTool,
      keyDownTool,
      keyUpTool,
      keyboardTypeTool,
      keyboardInsertTextTool,
      mouseTool,
      scrollPageTool,
      waitForTool,
      queryNodesTool,
      inspectStylesTool,
      applyStylesTool,
      inspectPointTool,
      setAnnotationModeTool,
      clickAtTool,
      dragTool,
      fillFormTool,
      navigatePageTool,
      resizePageTool,
      handleDialogTool,
      uploadFileTool,
      takeSnapshotTool,
      listNetworkRequestsTool,
      getNetworkRequestTool,
      listConsoleMessagesTool,
      getConsoleMessageTool,
      performanceStartTraceTool,
      performanceStopTraceTool,
      emulateTool,
      listPagesTool,
      selectPageTool,
      newPageTool,
      evaluateScriptTool,
    ],
  });

}

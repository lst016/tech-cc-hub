import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import type {
  BrowserWorkbenchConsoleLog,
  BrowserWorkbenchDomHint,
  BrowserWorkbenchState,
  BrowserWorkbenchBounds,
} from "../browser-manager.js";

export const BROWSER_TOOL_NAMES = [
  "browser_open_page",
  "browser_close_page",
  "browser_get_state",
  "browser_navigate",
  "browser_reload",
  "browser_capture_visible",
  "browser_console_logs",
  "browser_inspect_at_point",
  "browser_set_annotation_mode",
] as const;

export type BrowserWorkbenchToolHost = {
  open: (url: string) => BrowserWorkbenchState;
  close: () => BrowserWorkbenchState;
  setBounds: (bounds: BrowserWorkbenchBounds) => BrowserWorkbenchState;
  reload: () => BrowserWorkbenchState;
  goBack: () => BrowserWorkbenchState;
  goForward: () => BrowserWorkbenchState;
  getState: () => BrowserWorkbenchState;
  getConsoleLogs: (limit?: number) => BrowserWorkbenchConsoleLog[];
  captureVisible: () => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  inspectAtPoint: (point: { x: number; y: number }) => Promise<BrowserWorkbenchDomHint | null>;
  setAnnotationMode: (enabled: boolean) => Promise<BrowserWorkbenchState>;
};

const BROWSER_TOOLS_SERVER_NAME = "tech-cc-hub-browser";
const BROWSER_MCP_SERVER_VERSION = "1.0.0";
const MAX_CAPTURE_SNIPPET = 4096;

let browserHost: BrowserWorkbenchToolHost | null = null;
let browserMcpServer: McpSdkServerConfigWithInstance | null = null;

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

function toTextToolResult(payload: unknown, isError = false) {
  return {
    isError,
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function clampInteger(value: unknown, fallback = 80, max = 300): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), max));
}

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

export function getBrowserMcpServer(): McpSdkServerConfigWithInstance {
  if (browserMcpServer) {
    return browserMcpServer;
  }

  const openPageTool = tool(
    "browser_open_page",
    "打开/切换浏览器预览页的 URL。",
    { url: z.string().trim().min(1) },
    async (input) => {
      const host = getHost();
      const state = host.open(input.url);
      return toTextToolResult({ action: "browser_open_page", success: true, state });
    },
  );

  const closePageTool = tool(
    "browser_close_page",
    "关闭浏览器预览页面及标注会话。",
    {},
    async () => {
      const host = getHost();
      const state = host.close();
      return toTextToolResult({ action: "browser_close_page", success: true, state });
    },
  );

  const getStateTool = tool(
    "browser_get_state",
    "获取当前浏览器预览页状态（URL、标题、加载/前进后退状态）。",
    {},
    async () => {
      const host = getHost();
      const state = host.getState();
      return toTextToolResult({ action: "browser_get_state", success: true, state });
    },
  );

  const navigateTool = tool(
    "browser_navigate",
    "执行浏览器预览页导航，支持 back/forward。",
    { direction: z.enum(["back", "forward"]) },
    async (input) => {
      const host = getHost();
      const state = input.direction === "back" ? host.goBack() : host.goForward();
      return toTextToolResult({ action: "browser_navigate", direction: input.direction, success: true, state });
    },
  );

  const reloadTool = tool(
    "browser_reload",
    "重新加载当前浏览器预览页。",
    {},
    async () => {
      const host = getHost();
      const state = host.reload();
      return toTextToolResult({ action: "browser_reload", success: true, state });
    },
  );

  const captureTool = tool(
    "browser_capture_visible",
    "截取当前浏览器页面可见区域。为避免上下文过大，返回的是文本摘要片段。",
    {},
    async () => {
      const host = getHost();
      const capture = await host.captureVisible();
      if (!capture.success) {
        return toTextToolResult({ action: "browser_capture_visible", success: false, error: capture.error }, true);
      }

      const snippet = getShortCaptureSnippet(capture.dataUrl);
      return toTextToolResult({
        action: "browser_capture_visible",
        success: true,
        urlDataSnippet: snippet.dataUrl,
        truncated: snippet.truncated,
        totalLength: capture.dataUrl?.length,
      });
    },
  );

  const consoleLogsTool = tool(
    "browser_console_logs",
    "读取浏览器控制台最近日志。",
    { limit: z.number().int().min(1).max(300).optional() },
    async (input) => {
      const host = getHost();
      const logs = host.getConsoleLogs(input.limit);
      return toTextToolResult({
        action: "browser_console_logs",
        success: true,
        limit: logs.length,
        logs,
      });
    },
  );

  const inspectPointTool = tool(
    "browser_inspect_at_point",
    "在浏览器预览页中根据坐标提取 DOM 线索（selector、文本、路径等）。",
    { x: z.number(), y: z.number() },
    async (input) => {
      const host = getHost();
      const domHint = await host.inspectAtPoint({ x: clampInteger(input.x, 0, Number.MAX_SAFE_INTEGER), y: clampInteger(input.y, 0, Number.MAX_SAFE_INTEGER) });
      return toTextToolResult({
        action: "browser_inspect_at_point",
        success: true,
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
      const state = await host.setAnnotationMode(input.enabled);
      return toTextToolResult({
        action: "browser_set_annotation_mode",
        success: true,
        enabled: input.enabled,
        state,
      });
    },
  );

  browserMcpServer = createSdkMcpServer({
    name: BROWSER_TOOLS_SERVER_NAME,
    version: BROWSER_MCP_SERVER_VERSION,
    tools: [
      openPageTool,
      closePageTool,
      getStateTool,
      navigateTool,
      reloadTool,
      captureTool,
      consoleLogsTool,
      inspectPointTool,
      setAnnotationModeTool,
    ],
  });

  return browserMcpServer;
}

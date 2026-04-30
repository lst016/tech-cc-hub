// 浏览器工作台 MCP 工具：把右侧 BrowserView 的导航、截图、DOM 查询能力暴露给 Agent。
// 这里不直接依赖 UI 组件，只通过 BrowserWorkbenchToolHost 访问主进程维护的 BrowserView。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type {
  BrowserWorkbenchConsoleLog,
  BrowserWorkbenchDomStats,
  BrowserWorkbenchDomHint,
  BrowserWorkbenchNodeQueryResult,
  BrowserWorkbenchState,
  BrowserWorkbenchBounds,
  BrowserWorkbenchPageSnapshot,
  BrowserWorkbenchQueryStrategy,
  BrowserWorkbenchStyleInspection,
} from "../../browser-manager.js";

export const BROWSER_TOOL_NAMES = [
  "browser_open_page",
  "browser_close_page",
  "browser_get_state",
  "browser_navigate",
  "browser_reload",
  "browser_extract_page",
  "browser_capture_visible",
  "browser_console_logs",
  "browser_get_dom_stats",
  "browser_query_nodes",
  "browser_inspect_styles",
  "browser_inspect_at_point",
  "browser_set_annotation_mode",
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
  extractPageSnapshot: (sessionId: string) => Promise<{ success: boolean; snapshot?: BrowserWorkbenchPageSnapshot; error?: string }>;
  captureVisible: (sessionId: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  getDomStats: (sessionId: string) => Promise<{ success: boolean; stats?: BrowserWorkbenchDomStats; error?: string }>;
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
  inspectAtPoint: (sessionId: string, point: { x: number; y: number }) => Promise<BrowserWorkbenchDomHint | null>;
  setAnnotationMode: (sessionId: string, enabled: boolean) => Promise<BrowserWorkbenchState>;
};

const BROWSER_TOOLS_SERVER_NAME = "tech-cc-hub-browser";
const BROWSER_MCP_SERVER_VERSION = "1.0.0";
const MAX_CAPTURE_SNIPPET = 4096;

let browserHost: BrowserWorkbenchToolHost | null = null;
const browserMcpServersBySessionId = new Map<string, McpSdkServerConfigWithInstance>();

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

function toTextToolResult(payload: unknown, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function clampInteger(value: unknown, fallback = 80, max = 300): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), max));
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
  const cachedServer = browserMcpServersBySessionId.get(resolvedSessionId);
  if (cachedServer) {
    return cachedServer;
  }

  const openPageTool = tool(
    "browser_open_page",
    "打开/切换浏览器预览页的 URL。",
    { url: z.string().trim().min(1) },
    async (input, _extra) => {
      const host = getHost();
      const state = host.open(resolvedSessionId, input.url);
      return toTextToolResult({ action: "browser_open_page", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const closePageTool = tool(
    "browser_close_page",
    "关闭浏览器预览页面及标注会话。",
    {},
    async (_input, _extra) => {
      const host = getHost();
      const state = host.close(resolvedSessionId);
      return toTextToolResult({ action: "browser_close_page", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const getStateTool = tool(
    "browser_get_state",
    "获取当前浏览器预览页状态（URL、标题、加载/前进后退状态）。",
    {},
    async (_input, _extra) => {
      const host = getHost();
      const state = host.getState(resolvedSessionId);
      return toTextToolResult({ action: "browser_get_state", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const navigateTool = tool(
    "browser_navigate",
    "执行浏览器预览页导航，支持 back/forward。",
    { direction: z.enum(["back", "forward"]) },
    async (input, _extra) => {
      const host = getHost();
      const state = input.direction === "back" ? host.goBack(resolvedSessionId) : host.goForward(resolvedSessionId);
      return toTextToolResult({ action: "browser_navigate", direction: input.direction, success: true, sessionId: resolvedSessionId, state });
    },
  );

  const reloadTool = tool(
    "browser_reload",
    "重新加载当前浏览器预览页。",
    {},
    async (_input, _extra) => {
      const host = getHost();
      const state = host.reload(resolvedSessionId);
      return toTextToolResult({ action: "browser_reload", success: true, sessionId: resolvedSessionId, state });
    },
  );

  const extractPageTool = tool(
    "browser_extract_page",
    "提取当前浏览器页面的数据，包括 URL、标题、描述、正文文本、标题层级、链接和图片。用户要求读取/爬取当前内置浏览器页面时优先使用这个工具。",
    {},
    async (_input, _extra) => {
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
    async (_input, _extra) => {
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

  const consoleLogsTool = tool(
    "browser_console_logs",
    "读取浏览器控制台最近日志。",
    { limit: z.number().int().min(1).max(300).optional() },
    async (input, _extra) => {
      const host = getHost();
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

  const domStatsTool = tool(
    "browser_get_dom_stats",
    "统计当前页面 DOM 规模和结构，返回节点总数、交互元素数量以及最常见标签，适合快速判断页面复杂度。",
    {},
    async (_input, _extra) => {
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

  const queryNodesTool = tool(
    "browser_query_nodes",
    "按 CSS selector 或 XPath 查询页面节点，返回匹配数量、节点路径、属性、文本和可选样式，适合定向定位组件或批量检查 DOM。",
    {
      query: z.string().trim().min(1),
      strategy: z.enum(["selector", "xpath"]).optional(),
      maxResults: z.number().int().min(1).max(50).optional(),
      includeStyles: z.boolean().optional(),
      styleProps: z.array(z.string()).max(40).optional(),
    },
    async (input, _extra) => {
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
        result: result.result,
      });
    },
  );

  const inspectStylesTool = tool(
    "browser_inspect_styles",
    "按 CSS selector 或 XPath 读取目标节点的计算样式、CSS 变量、内联样式和节点基础信息，适合诊断布局和样式问题。",
    {
      query: z.string().trim().min(1),
      strategy: z.enum(["selector", "xpath"]).optional(),
      index: z.number().int().min(0).max(200).optional(),
      properties: z.array(z.string()).max(60).optional(),
    },
    async (input, _extra) => {
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
        inspection: result.inspection,
      });
    },
  );

  const inspectPointTool = tool(
    "browser_inspect_at_point",
    "在浏览器预览页中根据坐标提取 DOM 线索（selector、文本、路径等）。",
    { x: z.number(), y: z.number() },
    async (input, _extra) => {
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
    async (input, _extra) => {
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

  const browserMcpServer = createSdkMcpServer({
    name: BROWSER_TOOLS_SERVER_NAME,
    version: BROWSER_MCP_SERVER_VERSION,
    tools: [
      openPageTool,
      closePageTool,
      getStateTool,
      navigateTool,
      reloadTool,
      extractPageTool,
      captureTool,
      consoleLogsTool,
      domStatsTool,
      queryNodesTool,
      inspectStylesTool,
      inspectPointTool,
      setAnnotationModeTool,
    ],
  });

  browserMcpServersBySessionId.set(resolvedSessionId, browserMcpServer);
  return browserMcpServer;
}

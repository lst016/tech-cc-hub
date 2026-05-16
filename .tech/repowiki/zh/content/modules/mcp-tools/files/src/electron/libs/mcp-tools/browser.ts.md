# src/electron/libs/mcp-tools/browser.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：1490

## 文件职责

浏览器工作台 MCP 工具：将右侧 BrowserView 的导航、截图、DOM 查询、样式检查能力暴露给 Agent

## 运行信号

- `mcp tool: http_ping`
- `mcp tool: diagnose_port`
- `mcp tool: bash_batch`
- `mcp tool: browser_open_page`
- `mcp tool: browser_close_page`
- `mcp tool: browser_get_state`
- `mcp tool: browser_navigate`
- `mcp tool: browser_reload`
- `mcp tool: browser_extract_page`
- `mcp tool: browser_capture_visible`
- `mcp tool: browser_save_screenshot`
- `mcp tool: browser_save_pdf`
- `mcp tool: browser_cookies`
- `mcp tool: browser_storage`
- `mcp tool: browser_console_logs`
- `mcp tool: browser_get_dom_stats`
- `mcp tool: browser_snapshot_interactive`
- `mcp tool: browser_click_element`
- `mcp tool: browser_fill_element`
- `mcp tool: browser_get_element`
- `mcp tool: browser_eval`
- `mcp tool: browser_press_key`
- `mcp tool: browser_key_down`
- `mcp tool: browser_key_up`
- `mcp tool: browser_keyboard_type`
- `mcp tool: browser_keyboard_insert_text`
- `mcp tool: browser_mouse`
- `mcp tool: browser_scroll_page`
- `mcp tool: browser_wait_for`
- `mcp tool: browser_query_nodes`
- `mcp tool: browser_inspect_styles`
- `mcp tool: browser_apply_styles`

## 关键符号

- `BrowserWorkbenchToolHost@0 - Host 接口类型，定义 BrowserView 操作方法集（open/close/navigate/capture等）`
- `BROWSER_TOOL_NAMES@0 - 所有浏览器工具名常量数组（navigation、DOM query、cookies、screenshot、keyboard/mouse 等 35 个工具）`
- `getBrowserMcpServer@0 - 创建并返回浏览器 MCP 服务器实例，注册所有浏览器工具`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `node:child_process`
- `zod`
- `../../browser-manager.js`
- `./tool-result.js`

## 对外暴露

- `BROWSER_TOOL_NAMES`
- `BrowserWorkbenchToolHost`
- `setBrowserToolHost`
- `getBrowserToolNames`
- `getBrowserMcpServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  saveScreenshot: (sessionId: string, input: { path?: string; format?: "png" | "jpeg"; quality?: number }) => Promise<{ success: boolean; result?: BrowserWorkbenchSavedFileResult; error?: string }>;
  savePdf: (sessionId: string, input: { path?: string; landscape?: boolean; printBackground?: boolean }) => Promise<{ success: boolean; result?: BrowserWorkbenchSavedFileResult; error?: string }>;
  manageCookies: (sessionId: string, input: BrowserWorkbenchCookieInput) => Promise<{ success: boolean; result?: BrowserWorkbenchCookieResult; error?: string }>;
  manageStorage: (sessionId: string, input: BrowserWorkbenchStorageInput) => Promise<{ success: boolean; result?: BrowserWorkbenchStorageResult; error?: string }>;
  getDomStats: (sessionId: string) => Promise<{ success: boolean; stats?: BrowserWorkbenchDomStats; error?: string }>;
  getInteractiveSnapshot: (sessionId: string, input: {
    maxResults?: number;
    v
... (truncated)
```

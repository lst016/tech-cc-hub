# src/shared/builtin-mcp-registry.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：388

## 文件职责

源码文件

## 关键符号

- `getBuiltinMcpServerDefinition@359 - `
- `listBuiltinMcpServerInfos@363 - `
- `listBuiltinMcpToolNames@374 - `
- `buildBuiltinMcpPromptHints@380 - `
- `enabledNames@382 - `
- `BuiltinMcpServerName@1 - `
- `BuiltinMcpIconKey@10 - `
- `BuiltinMcpToolInfo@19 - `
- `BuiltinMcpToolGroup@26 - `
- `BuiltinMcpServerDefinition@32 - `

## 对外暴露

- `BuiltinMcpServerName`
- `BuiltinMcpIconKey`
- `BuiltinMcpToolInfo`
- `BuiltinMcpToolGroup`
- `BuiltinMcpServerDefinition`
- `BUILTIN_MCP_SERVERS`
- `getBuiltinMcpServerDefinition`
- `listBuiltinMcpServerInfos`
- `listBuiltinMcpToolNames`
- `buildBuiltinMcpPromptHints`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type BuiltinMcpServerName =
  | "tech-cc-hub-browser"
  | "tech-cc-hub-admin"
  | "tech-cc-hub-design"
  | "tech-cc-hub-figma"
  | "tech-cc-hub-cron"
  | "tech-cc-hub-idea"
  | "tech-cc-hub-plan"
  | "tech-cc-hub-knowledge";

export type BuiltinMcpIconKey =
  | "activity"
  | "settings"
  | "sparkles"
  | "figma"
  | "timer"
  | "code"
  | "list";

export type BuiltinMcpToolInfo = {
  name: string;
  description: string;
  tag?: string;
  intent?: string;
};

export type BuiltinMcpToolGroup = {
  title: string;
  summary?: string;
  tools: BuiltinMcpToolInfo[];
};

export type BuiltinMcpServerDefinition = {
  name: BuiltinMcpServerName;
  type: "builtin";
  command: "builtin";
  args: string[];
  envKeys: string[];
  enabled: boolean;
  iconKey: BuiltinMcpIconKey;
  description: string;
  iconClassName: string;
  highlights: string[];
  workflow?: Array<{
    label: string;
    description: string;
  }>;
  toolGroups: BuiltinMcpToolGroup[];
  promptHints?: string[];
};

export const BUILTIN_MCP_SERVERS: readonly BuiltinMcpServerDefinition[] = [
  {
    name: "tech-cc-hub-browser",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "activity",
    description: "Built-in BrowserView automation for navigation, page reading, interaction, screenshots, storage, console logs, and local service diagnostics.",
    iconClassName: "border-blue-500/15 bg-blue-50 text-blue-700",
    highlights: ["BrowserView", "DOM read", "Interaction"],
    toolGroups: [
      {
        title: "Navigation and page state",
        tools: [
          { name: "browser_open_page", description: "Open or switch the BrowserView URL." },
          { name: "browser_close_page", description: "Close the current BrowserView page." },
          { name: "browser_get_state", description: "Read URL, title, loading, and navigation state." },
          { name: "browser_navigate", description: "Go back or forward." },
          { name: "browser_reload", description: "Reload the current page." },
          { name: "browser_wait_for", description: "Wait for load, selector, text, URL, time, or JavaScript conditions." },
        ],
      },
      {
        title: "Reading and diagnostics",
        tools: [
          { name: "browser_extract_page", description: "Extract page text, title, links, and image summary." },
          { name: "browser_get_element", description: "Read text, html, value, attributes, box, and style details." },
          { name: "browser_get_dom_stats", description: "Inspect DOM size and common element counts." },
          { name: "browser_snapshot_interactive", description: "Create @e1/@e2 references for interactive elements." },
          { name: "browser_query_nodes", description: "Query DOM nodes with CSS selectors or XPath." },
          { name: "browser_inspect_styles", description: "Read computed styles, CSS variables, and node style metadata." },
          { name: "browser_inspect_at_point", description: "Inspect the DOM node under a viewport coordinate." },
          { name: "browser_console_logs", description: "Read or wait for browser console output." },
          { name: "browser_eval", description: "Run JavaScript in the current page context." },
          { name: "http_ping", description: "Lightweight URL health and status check." },
          { name: "diagnose_port", description: "Diagnose a local Windows port listener." },
          { name: "bash_batch", description: "Run a bounded batch of read-only shell commands through the browser tool host." },
        ],
      },
      {
        title: "Element and input interaction",
        tools: [
          { name: "browser_click_element", description: "Click an element by ref, selector, or XPath." },
          { name: "browser_dblclick_element", description: "Double-click an element." },
          { name: "browser_focus_element", description: "Focus an element." },
          { name: "browser_hover_element", description: "Hover an element." },
          { name: "browser_type_element", description: "Append text to an element." },
          { name: "browser_fill_element", description: "Clear and fill an input element." },
... (truncated)
```

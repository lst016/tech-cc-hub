# src/ui/components/settings/McpSettingsPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：640

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getElectron@301`
- `McpSettingsPage@306`
- `McpTabButton@422`
- `getBuiltinToolGroups@437`
- `getBuiltinServerMeta@441`
- `toBuiltinServerMeta@445`
- `formatExternalServerSummary@456`
- `ServerCard@463`
- `BuiltinToolsPanel@542`
- `DetailRow@627`
- `e@303`
- `electron@315`
- `fallbackTimer@317`
- `unsubscribe@323`
- `evt@325`
- `timeout@336`
- `toggleExpand@343`
- `setter@345`
- `toolGroups@465`
- `toolCount@466`
- `serverMeta@467`
- `ServerIcon@468`
- `toolCount@544`
- `serverMeta@545`
- `ToolIcon@597`
- `LucideIcon@16`
- `BuiltinMcpIconKey@21`
- `BuiltinMcpServerDefinition@22`
- `McpServerEntry@25`
- `BuiltinToolInfo@29`
- `BuiltinToolGroup@37`
- `McpTab@43`
- `BuiltinServerMeta@45`
- `ElectronClient@296`
- `sendClientEvent@298`
- `onServerEvent@299`

## 依赖输入

- `lucide-react`
- `react`
- `../../../shared/builtin-mcp-registry`
- `../../types`

## 对外暴露

- `McpSettingsPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronDown,
  Code2,
  GitCompare,
  Image,
  ListChecks,
  ScanSearch,
  ServerCog,
  Settings,
  Timer,
  WandSparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getBuiltinMcpServerDefinition,
  type BuiltinMcpIconKey,
  type BuiltinMcpServerDefinition,
} from "../../../shared/builtin-mcp-registry";
import type { McpServerInfo } from "../../types";

type McpServerEntry = McpServerInfo & {
  expanded?: boolean;
};

type BuiltinToolInfo = {
  name: string;
  description: string;
  icon?: LucideIcon;
  tag?: string;
  intent?: string;
};

type BuiltinToolGroup = {
  title: string;
  summary?: string;
  tools: BuiltinToolInfo[];
};

type McpTab = "builtin" | "external";

type BuiltinServerMeta = {
  icon: LucideIcon;
  description: string;
  iconClassName: string;
  highlights: string[];
  workflow?: Array<{
    label: string;
    description: string;
  }>;
};

const BUILTIN_ICON_MAP: Record<BuiltinMcpIconKey, LucideIcon> = {
  activity: Activity,
  settings: Settings,
  sparkles: WandSparkles,
  figma: WandSparkles,
  timer: Timer,
  code: Code2,
  list: ListChecks,
};

const BUILTIN_TOOL_GROUPS: Record<string, BuiltinToolGroup[]> = {
  "tech-cc-hub-browser": [
    {
      title: "页面与导航",
      tools: [
        { name: "browser_open_page", description: "打开或切换右侧 BrowserView URL" },
        { name: "browser_close_page", description: "关闭当前浏览器工作台页面" },
        { name: "browser_get_state", description: "读取 URL、标题、加载、前进后退状态" },
        { name: "browser_navigate", description: "执行 back / forward 导航" },
        { name: "browser_reload", description: "刷新当前页面" },
        { name: "browser_wait_for", description: "等待加载、元素、文本、URL、时间或 JS 条件" },
      ],
    },
    {
      title: "页面读取",
      tools: [
        { name: "browser_extract_page", description: "提取正文、标题、链接、图片等页面摘要" },
        { name: "browser_get_element", description: "读取 text/html/value/attr/title/url/count/box/styles" },
        { name: "browser_get_dom_stats", description: "统计 DOM 规模和常见标签" },
        { name: "browser_query_nodes", description: "按 CSS selector 或 XPath 查询节点" },
        { name: "browser_inspect_styles", description: "读取计算样式、CSS 变量和节点信息" },
        { name: "browser_inspect_at_point", description: "按视口坐标反查 DOM 线索" },
        { name: "browser_console_logs", description: "读取或等待浏览器控制台日志" },
        { name: "browser_eval", description: "在页面上下文执行 JavaScript" },
      ],
    },
    {
      title: "元素交互",
      tools: [
        { name: "browser_snapshot_interactive", description: "生成 @e1/@e2 交互元素 ref 快照" },
        { name: "browser_click_element", description: "点击 ref、CSS selector 或 XPath 元素" },
        { name: "browser_dblclick_element", description: "双击目标元素" },
        { name: "browser_focus_element", description: "聚焦目标元素" },
        { name: "browser_hover_element", description: "触发目标元素悬停事件" },
        { name: "browser_type_element", description: "向目标输入元素追加文本" },
        { name: "browser_fill_element", description: "清空并填写目标输入元素" },
        { name: "browser_select_element", description: "设置 select 元素 value" },
        { name: "browser_check_element", description: "勾选 checkbox/radio/role=checkbox" },
        { name: "browser_uncheck_element", description: "取消勾选 checkbox/role=checkbox" },
        { name: "browser_scroll_into_view", description: "把目标元素滚动到视口中间" },
      ],
    },
    {
      title: "键鼠输入",
      tools: [
        { name: "browser_press_key", description: "发送单次按键，如 Enter、Tab、Escape" },
        { name: "browser_key_down", description: "发送 keyDown，用于组合键" },
        { name: "browser_key_up", description: "发送 keyUp，用于组合键" },
        { name: "browser_keyboard_type", description: "向当前焦点发送逐字符键盘输入" },
        { name: "browser_keyboard_insert_text", description: "向当前焦点直接插入文本" },
        { name: "browser_mouse", description: "发送 move/down/up/wheel 鼠标事件" },
        { name: "browser_scroll_page", description: "滚动页面或指定元素" },
      ],
    },
    {
      title: "截图与会话数据",
      tools: [
        { name: "browser_capture_visible", description: "截取可见区域并返回短 data URL 片段" },
        { name: "browser_save_screenshot", description: "保存 BrowserView 可见区域截图文件" },
... (truncated)
```

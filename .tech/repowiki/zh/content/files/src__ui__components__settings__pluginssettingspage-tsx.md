# src/ui/components/settings/PluginsSettingsPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：834

## 文件职责

插件设置页面，管理Open Computer Use和Figma等MCP插件

## 运行信号

- `electron.invoke: plugins:getOpenComputerUseStatus`
- `electron.invoke: plugins:checkOpenComputerUseUpdate`
- `electron.invoke: plugins:getFigmaOfficialStatus`
- `electron.invoke: plugins:installOpenComputerUse`
- `electron.invoke: plugins:connectFigmaDesktopOfficial`
- `electron.invoke: plugins:connectFigmaPatOfficial`
- `electron.invoke: plugins:updateOpenComputerUse`

## 关键符号

- `OPEN_COMPUTER_USE_ID@0 - Open Computer Use插件ID`
- `FIGMA_OFFICIAL_ID@0 - Figma官方插件ID`
- `getPluginStatusMeta@0 - 获取插件状态元数据`
- `getUpdateHint@0 - 生成更新提示信息`
- `PluginsSettingsPage@0 - 插件设置页面主组件`

## 依赖输入

- `lucide-react`
- `react`
- `sonner`
- `./plugin-toast-messages`

## 对外暴露

- `PluginsSettingsPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { buildPluginActionToastMessage } from "./plugin-toast-messages";

type PluginStatus = "not-installed" | "needs-permission" | "needs-connect" | "ready" | "update-available";
type PluginUpdateStatus = "unknown" | "up-to-date" | "update-available" | "error";

type DefaultPlugin = {
  id: string;
  name: string;
  kind: string;
  version: string;
  description: string;
  sourcePath: string;
  sourceLabel: string;
  permissions: string[];
};

type OpenComputerUsePermissionStatus = {
  platform: string;
  required: boolean;
  accessibility: "granted" | "missing" | "not-required" | "unknown";
  screenRecording: "granted" | "missing" | "not-required" | "unknown";
  needsUserAction: boolean;
  openedSystemSettings: boolean;
};

type FigmaOfficialStatusKind =
  | "not-configured"
  | "configured"
  | "needs-auth"
  | "auth-expired"
  | "desktop-unavailable"
  | "misconfigured"
  | "ready";

type FigmaOfficialMode = "remote" | "desktop" | "rest";
type FigmaOfficialAuthProvider = "direct" | "codex" | "pat";

type PluginInstallResult = {
  success: boolean;
  installed: boolean;
  connected: boolean;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  updateStatus?: PluginUpdateStatus;
  updateError?: string;
  updateCheckedAt?: number;
  message: string;
  error?: string;
  permissions?: OpenComputerUsePermissionStatus;
  status?: FigmaOfficialStatusKind;
  authHint?: string;
  url?: string;
  desktopUrl?: string;
  mode?: FigmaOfficialMode;
  authProvider?: FigmaOfficialAuthProvider;
  capabilities?: string[];
  tools?: string[];
  toolCount?: number;
  lastToolCheckedAt?: number;
  accountLabel?: string;
};

type PluginRuntimeStatus = {
  installed: boolean;
  connected: boolean;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  updateStatus?: PluginUpdateStatus;
  updateError?: string;
  updateCheckedAt?: number;
  permissions?: OpenComputerUsePermissionStatus;
  status?: FigmaOfficialStatusKind;
  message?: string;
  authHint?: string;
  url?: string;
  desktopUrl?: string;
  mode?: FigmaOfficialMode;
  authProvider?: FigmaOfficialAuthProvider;
  capabilities?: string[];
  tools?: string[];
  toolCount?: number;
  lastToolCheckedAt?: number;
  accountLabel?: string;
};

type PluginGuideSessionRequest = {
  title: string;
  prompt: string;
  agentId?: string;
  allowedTools?: string;
};

type PluginsSettingsPageProps = {
  onStartGuideSession?: (request: PluginGuideSessionRequest) => Promise<void> | void;
};

const OPEN_COMPUTER_USE_ID = "open-computer-use";
const FIGMA_OFFICIAL_ID = "figma-official";
const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
const FIGMA_DESKTOP_MCP_URL = "http://127.0.0.1:3845/mcp";
const FIGMA_REST_API_URL = "https://api.figma.com/v1";
const FIGMA_TOKEN_SETTINGS_URL = "https://www.figma.com/settings";
// The Electron runner injects enabled Claude Code plugins into Agent SDK sessions.
const FIGMA_AGENT_GUIDE_ENABLED = false;

const DEFAULT_PLUGINS: DefaultPlugin[] = [
  {
    id: OPEN_COMPUTER_USE_ID,
    name: "Open Computer Use",
    kind: "mcp-plugin",
    version: "0.1.48",
    description: "本机桌面控制 MCP 插件，作为插件体系的第一颗默认插件。",
    sourcePath: "plugins/open-computer-use",
    sourceLabel: "GitHub",
    permissions: ["mcp.server", "desktop.read", "desktop.write", "accessibility", "screen-recording"],
  },
  {
    id: FIGMA_OFFICIAL_ID,
    name: "Figma Token / REST API",
    kind: "api-token-plugin",
    version: "PAT",
    description: "使用 Figma Personal Access Token 读取文件/节点，提取设计摘要和 tokens，内置设计系统/UX 审查，生成 Tailwind 初稿，并查看评论、版本、组件样式、变量、Dev Resources 和导出图片 URL，不依赖 Codex OAuth。",
    sourcePath: FIGMA_REST_API_URL,
    sourceLabel: "Figma REST API",
    permissions: ["figma.token", "figma.rest", "design.read", "ux.audit", "metadata", "library", "variables"],
  },
];

const statusMeta: Record<PluginStatus, { label: string; className: string }> = {
  "not-installed": {
    label: "未安装",
    className: "border-amber-500/20 bg-amber-50 text-amber-800",
  },
  "needs-permission": {
    label: "待授
... (truncated)
```

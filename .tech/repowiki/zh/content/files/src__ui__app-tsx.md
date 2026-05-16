# src/ui/App.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1879

## 文件职责

主应用组件，负责整体布局、会话管理、消息渲染和IPC事件处理

## 运行信号

- `electron.invoke: sessions:list`
- `electron.invoke: shell:openExternal`

## 关键符号

- `SCROLL_THRESHOLD@0 - 滚动阈值常量，值为50`
- `INITIAL_HISTORY_LIMIT@0 - 初始历史消息加载限制，值为400`
- `HISTORY_PAGE_LIMIT@0 - 历史消息分页加载限制，值为200`
- `isRecord@0 - 类型守卫函数，判断值是否为普通对象`
- `getMessageContentItems@0 - 从消息中提取content数组，支持envelope.message格式`
- `isProcessMessage@0 - 判断消息是否为工具调用/结果类型`
- `getProcessGroupSummary@0 - 汇总进程组中的工具使用情况，返回工具数和标签统计`
- `ProcessGroupCard@0 - 进程组卡片组件，渲染工具调用汇总`
- `CompactProcessRow@0 - 紧凑型进程行组件，用于折叠视图`
- `App@0 - 主应用组件，整合所有UI面板和状态管理`

## 依赖输入

- `react`
- `@anthropic-ai/claude-agent-sdk`
- `lucide-react`
- `sonner`
- `./hooks/useIPC`
- `./hooks/useMessageWindow`
- `./store/useAppStore`
- `./types`
- `./components/Sidebar`
- `./components/StartSessionModal`
- `./components/SettingsModal`
- `./components/TooltipButton`
- `./components/UpdateToast`
- `./components/PromptInput`
- `./components/EventCard`
- `./components/ActivityRail`
- `./components/SessionAnalysisPage`
- `./components/BrowserWorkbenchPage`
- `./render/markdown`
- `./components/cron/ScheduledTasksPage`
- `./components/KnowledgePanel`
- `./components/TaskPanel`
- `./events`
- `./utils/clipboard`
- `./utils/activity-workspace-tabs`
- `./components/settings/settings-utils`
- `./dev-electron-shim`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
﻿import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { Download, Loader2, PackageCheck } from "lucide-react";
import { Toaster } from "sonner";
import { useIPC } from "./hooks/useIPC";
import { useMessageWindow } from "./hooks/useMessageWindow";
import { useAppStore } from "./store/useAppStore";
import type { AppUpdateStatus, ServerEvent, SettingsPageId, StreamMessage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { StartSessionModal } from "./components/StartSessionModal";
import { SettingsModal } from "./components/SettingsModal";
import { TooltipButton } from "./components/TooltipButton";
import { UpdateToast } from "./components/UpdateToast";
import { PromptInput, usePromptActions } from "./components/PromptInput";
import { MessageCard } from "./components/EventCard";
import { ActivityRail } from "./components/ActivityRail";
import { SessionAnalysisPage, buildSessionWorkflowOptimizationPrompt } from "./components/SessionAnalysisPage";
import { BrowserWorkbenchPage } from "./components/BrowserWorkbenchPage";
// FeedbackDialog removed — uses direct browser link
import MDContent from "./render/markdown";
import ScheduledTasksPage from "./components/cron/ScheduledTasksPage";
import { KnowledgePanel } from "./components/KnowledgePanel";
import { TaskPanel } from "./components/TaskPanel";
import { OPEN_BROWSER_WORKBENCH_URL_EVENT, type OpenBrowserWorkbenchUrlDetail } from "./events";
import { copyTextToClipboard } from "./utils/clipboard";
import type { ActivityRailTab } from "./utils/activity-workspace-tabs";
import { getAvailableModelsForProfiles, getEnabledProfiles } from "./components/settings/settings-utils";
import {
  DEV_BRIDGE_READY_EVENT,
  getDevElectronRuntimeSource,
  type DevElectronRuntimeSource,
} from "./dev-electron-shim";

const SCROLL_THRESHOLD = 50;
const INITIAL_HISTORY_LIMIT = 400;
const HISTORY_PAGE_LIMIT = 200;
const MIN_CENTER_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 250;
const MIN_ACTIVITY_RAIL_WIDTH = 400;
const EMPTY_MESSAGES: StreamMessage[] = [];
const EMPTY_PERMISSION_REQUESTS: NonNullable<ReturnType<typeof useAppStore.getState>["sessions"][string]["permissionRequests"]> = [];
type GlobalRuntimeConfig = Record<string, unknown>;

type RenderEntry =
  | { type: "separator"; key: string; roundNumber: number }
  | { type: "message"; key: string; originalIndex: number; message: StreamMessage }
  | { type: "process_group"; key: string; originalIndex: number; messages: Array<{ originalIndex: number; message: StreamMessage }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessageContentItems(message: StreamMessage): unknown[] {
  const envelope = message as { message?: unknown };
  if (!isRecord(envelope.message)) return [];
  const content = envelope.message.content;
  return Array.isArray(content) ? content : content ? [content] : [];
}

function isProcessMessage(message: StreamMessage): boolean {
  if (!isRecord(message)) return false;
  const contentItems = getMessageContentItems(message);
  if (contentItems.length === 0) return false;

  if (message.type === "assistant") {
    return contentItems.every((item) => (
      isRecord(item) &&
      item.type === "tool_use" &&
      item.name !== "AskUserQuestion"
    ));
  }

  if (message.type === "user") {
    return contentItems.every((item) => isRecord(item) && item.type === "tool_result");
  }

  return false;
}

function getProcessGroupSummary(groupMessages: Array<{ message: StreamMessage }>): string {
  let toolUseCount = 0;
  let toolResultCount = 0;
  const toolLabels = new Map<string, number>();

  for (const item of groupMessages) {
    for (const content of getMessageContentItems(item.message)) {
      if (!isRecord(content)) continue;
      if (content.type === "tool_use") {
        toolUseCount += 1;
        const name = typeof content.name === "string" ? content.name : "tool";
        toolLabels.set(name, (toolLabels.get(name) ?? 0) + 1);
      }
      i
... (truncated)
```

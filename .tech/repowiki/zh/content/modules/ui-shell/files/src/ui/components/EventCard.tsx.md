# src/ui/components/EventCard.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1738

## 文件职责

消息卡片组件，渲染AI消息、工具调用、工具结果等各类流式消息

## 关键符号

- `toolStatusMap@0 - 工具ID到状态的映射表`
- `setToolStatus@0 - 设置工具执行状态`
- `useToolStatus@0 - 订阅工具状态变化的hook`
- `formatTime@0 - 格式化时间戳为HH:mm格式`
- `formatTokens@0 - 格式化token数量显示`
- `MessageCardBase@0 - 基础消息卡片组件，处理markdown渲染和交互`

## 依赖输入

- `react-dom`
- `@anthropic-ai/claude-agent-sdk`
- `../types`
- `../store/useAppStore`
- `../render/markdown`
- `./DecisionPanel`
- `../../shared/attachments`
- `../utils/clipboard`
- `../events`
- `../utils/code-reference-prompt`

## 对外暴露

- `isMarkdown`
- `MessageCard`
- `EventCard`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
﻿import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  PermissionResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, StreamMessage } from "../types";
import type { PermissionRequest } from "../store/useAppStore";
import { useAppStore } from "../store/useAppStore";
import MDContent from "../render/markdown";
import { DecisionPanel } from "./DecisionPanel";
import { resolveImageAttachmentSrc } from "../../shared/attachments";
import { copyTextToClipboard as copyText } from "../utils/clipboard";
import { OPEN_BROWSER_WORKBENCH_URL_EVENT, PREVIEW_OPEN_FILE_EVENT, PROMPT_FOCUS_EVENT } from "../events";
import { extractCodeReferencesPrompt, type CodeReferencePromptSummary } from "../utils/code-reference-prompt";

type MessageContent = SDKAssistantMessage["message"]["content"][number];
type ToolResultContent = SDKUserMessage["message"]["content"][number];
type ToolStatus = "pending" | "success" | "error";

type SystemInitMessage = SDKMessage & {
  subtype?: string;
  session_id?: string;
  model?: string;
  permissionMode?: string;
  cwd?: string;
};

type AskUserQuestionInput = {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
};

type BrowserAnnotationsPayload = {
  count?: number;
  items?: unknown[];
};

type BrowserAnnotationSourceCandidate = {
  component?: string;
  file?: string;
  line?: number;
  column?: number;
  framework?: string;
  source?: string;
  confidence?: string;
};

type BrowserAnnotationSummary = {
  index: number;
  label: string;
  comment?: string;
  expectation?: string;
  pageTitle?: string;
  pageUrl?: string;
  target?: string;
  selector?: string;
  xpath?: string;
  path?: string;
  componentStack?: string[];
  sourceCandidates?: BrowserAnnotationSourceCandidate[];
  componentStackConfidence?: string;
  position?: { x: number; y: number };
};

const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
const MAX_VISIBLE_LINES = 8;
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const setToolStatus = (toolUseId: string | undefined, status: ToolStatus) => {
  if (!toolUseId) return;
  toolStatusMap.set(toolUseId, status);
  toolStatusListeners.forEach((listener) => listener());
};

const useToolStatus = (toolUseId: string | undefined) => {
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolUseId ? toolStatusMap.get(toolUseId) : undefined,
  );

  useEffect(() => {
    if (!toolUseId) return;
    const handleUpdate = () => setStatus(toolStatusMap.get(toolUseId));
    toolStatusListeners.add(handleUpdate);
    return () => {
      toolStatusListeners.delete(handleUpdate);
    };
  }, [toolUseId]);

  return status;
};

const getRecordString = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  return typeof value === "string" ? value : null;
};

const formatTime = (value?: number) => {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `${hh}:${mm}`;
  }
  return `${date.getMonth() + 1}-${date.getDate()} ${hh}:${mm}`;
};

const formatMinutes = (ms: number | undefined) =>
  typeof ms !== "number" ? "-" : `${(ms / 60000).toFixed(2)} min`;

const formatUsd = (usd: number | undefined) =>
  typeof usd !== "number" ? "-" : `$${usd.toFixed(2)}`;

const formatTokens = (tokens: number | undefined) => {
  if (typeof tokens !== "number") return "-";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(4)} M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)} k`;
  return String(tokens);
};

const compactPreview = (text: string, limit = 160) => {
  const normalized
... (truncated)
```

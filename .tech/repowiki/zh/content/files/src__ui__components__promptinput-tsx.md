# src/ui/components/PromptInput.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：2188

## 文件职责

Prompt输入框组件，支持文本输入、文件提及、slash命令、代码引用等功能

## 运行信号

- `electron.invoke: slash-commands:list`

## 关键符号

- `normalizeSlashCommandList@0 - 规范化slash命令列表，去重并处理名称描述格式`
- `hasDraggedFiles@0 - 检测DataTransfer是否包含文件`
- `buildBrowserAnnotationsPrompt@0 - 根据浏览器标注生成prompt内容`
- `mergePromptWithBrowserAnnotations@0 - 合并prompt与浏览器标注信息`
- `buildCodeReferencesPrompt@0 - 构建代码引用prompt`
- `mergePromptWithCodeReferences@0 - 合并prompt与代码引用`
- `buildMessageReferencesPrompt@0 - 构建消息引用prompt`
- `buildFileReferencesPrompt@0 - 构建文件引用prompt`
- `collectFileMentionOptions@0 - 收集可提及的文件选项，支持目录扫描`
- `buildQueuedPrompt@0 - 构建待发送的完整prompt，包含所有引用和附件`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `../types`
- `../store/useAppStore`
- `../utils/clipboard`
- `../utils/browser-annotation-reset`
- `../utils/slash-command-input`
- `../events`
- `./ComposerContextCard`
- `./DecisionPanel`
- `./ModelSelect`
- `./settings/settings-utils`

## 对外暴露

- `usePromptActions`
- `PromptInput`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
﻿import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type {
  ApiConfigProfile,
  ClientEvent,
  PromptAttachment,
  RuntimeOverrides,
  RuntimeReasoningMode,
} from "../types";
import {
  getCodeReferenceSessionKey,
  useAppStore,
  type CodeReferenceDraft,
  type FileReferenceDraft,
  type MessageReferenceDraft,
  type PermissionRequest,
} from "../store/useAppStore";
import { copyTextToClipboard as copyText } from "../utils/clipboard";
import { resetBrowserWorkbenchAnnotationState } from "../utils/browser-annotation-reset";
import { getSlashCommandQuery, isDismissedSlashCommandQuery } from "../utils/slash-command-input";
import {
  ADD_PROMPT_ATTACHMENT_EVENT,
  OPEN_BROWSER_WORKBENCH_URL_EVENT,
  PREVIEW_OPEN_FILE_EVENT,
  PROMPT_FOCUS_EVENT,
  PROMPT_SENT_EVENT,
  PROMPT_SUBMIT_EVENT,
  type AddPromptAttachmentDetail,
} from "../events";
import { ComposerContextCard } from "./ComposerContextCard";
import { DecisionPanel } from "./DecisionPanel";
import { ModelSelect } from "./ModelSelect";
import { getAvailableModelsForProfiles, getEnabledProfiles } from "./settings/settings-utils";

const DEFAULT_ALLOWED_TOOLS = "*";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;
const SLASH_PREVIEW_LIMIT = 8;
const SLASH_QUERY_LIMIT = 16;
const FILE_MENTION_PREVIEW_LIMIT = 10;
const FILE_MENTION_SCAN_LIMIT = 260;
const FILE_MENTION_SCAN_DEPTH = 4;
const FILE_MENTION_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "node_modules",
]);
const EMPTY_CODE_REFERENCES: CodeReferenceDraft[] = [];
const EMPTY_FILE_REFERENCES: FileReferenceDraft[] = [];
const EMPTY_MESSAGE_REFERENCES: MessageReferenceDraft[] = [];

type SlashCommandOption = {
  name: string;
  description?: string;
};

type SlashCommandPayloadItem = string | SlashCommandOption;

function normalizeSlashCommandList(commands?: SlashCommandPayloadItem[]): SlashCommandOption[] {
  const normalized = new Map<string, SlashCommandOption>();
  for (const command of commands ?? []) {
    const name = (typeof command === "string" ? command : command.name).replace(/^\//, "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = normalized.get(key);
    const description = typeof command === "string" ? undefined : command.description?.trim();
    normalized.set(key, {
      name: existing?.name ?? name,
      description: existing?.description || description || undefined,
    });
  }
  return Array.from(normalized.values());
}

function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
}

type FileMentionOption = {
  path: string;
  label: string;
  name: string;
  kind: "file" | "directory";
};

type FileMentionContext = {
  start: number;
  end: number;
  query: string;
};

type PreviewDirectoryEntry = {
  name?: string;
  path?: string;
  filePath?: string;
  type?: string;
  kind?: string;
  isDirectory?: boolean;
};

type PreviewDirectoryResponse =
  | PreviewDirectoryEntry[]
  | {
      success?: boolean;
      entries?: PreviewDirectoryEntry[];
      error?: string;
    };

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
  disabled?: boolean;
  leftOffset?: number;
  rightOffset?: number;
}

const MAX_TEXT_ATTACHMENT_LENGTH = 20_000;
const MAX_IMAGE_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.88;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const TEXT_FILE_PATTERN = /\.(txt|md|markdown|json|ya?ml|xml|svg|csv|tsv|log|js|jsx|ts|tsx|py|rb|java|go|rs|sh|css|html|sql|toml|ini|env)$/i;
const SVG_MIME_TYPE = "image/svg+xml";
const REASONING_OPTIONS: Array<{ value: RuntimeReasoningMode; label: string }> = [
  { value: "disabled", label: "关闭思考" },
  { value: "low", label: "低" },
  { value: "medium", label: "中"
... (truncated)
```

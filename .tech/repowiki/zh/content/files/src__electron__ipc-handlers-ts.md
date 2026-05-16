# src/electron/ipc-handlers.ts

> 模块：`electron` · 语言：`typescript` · 行数：1713

## 文件职责

Electron IPC处理器注册，管理会话、运行器、任务执行和渠道通信

## 关键符号

- `initializeSessionRepository@0 - 初始化会话仓储`
- `initializeTaskExecutor@0 - 初始化任务执行器，支持Lark、钉钉、飞书项目等任务源`
- `listStoredSessionsForRenderer@0 - 列出存储的会话供渲染进程使用`
- `getReusableRunnerHandle@0 - 获取可复用的Agent运行器句柄`
- `scheduleWarmRunnerCleanup@0 - 调度闲置运行器的清理任务`
- `broadcast@0 - 向所有监听器广播服务器事件`

## 依赖输入

- `electron`
- `fs`
- `os`
- `path`
- `../shared/attachments.js`
- `../shared/prompt-ledger.js`
- `../shared/workflow-markdown.js`
- `../shared/builtin-mcp-registry.js`
- `./libs/runner.js`
- `./libs/runner-reuse.js`
- `./libs/attachment-store.js`
- `./libs/agent-resolver.js`
- `./libs/claude-settings.js`
- `./libs/config-store.js`
- `./libs/external-mcp-servers.js`
- `./libs/figma-official-plugin.js`
- `./libs/session-store.js`
- `./libs/slash-command-catalog.js`
- `./libs/tool-output-sanitizer.js`
- `./libs/workflow-catalog.js`
- `./stateless-continuation.js`
- `./types.js`
- `./util.js`
- `better-sqlite3`
- `./libs/task/index.js`
- `./libs/note-repository.js`
- `./libs/channel-workspace.js`

## 对外暴露

- `initializeNoteRepository`
- `initializeTaskExecutor`
- `setChannelReplySender`
- `listStoredSessionsForRenderer`
- `handleClientEvent`
- `addServerEventListener`
- `cleanupAllSessions`
- `sessions`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { app, BrowserWindow, clipboard, dialog, shell, type MessageBoxOptions } from "electron";
import { readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, extname, join } from "path";

import {
  createStoredUserPromptMessage,
  estimateAttachmentPromptChars,
  sanitizePromptAttachmentsForStorage,
} from "../shared/attachments.js";
import { buildPromptLedgerMessage, type PromptLedgerMessage, type PromptLedgerSource } from "../shared/prompt-ledger.js";
import { createInitialSessionWorkflowState, parseWorkflowMarkdown } from "../shared/workflow-markdown.js";
import { listBuiltinMcpServerInfos } from "../shared/builtin-mcp-registry.js";
import { runClaude, type RunnerHandle } from "./libs/runner.js";
import { buildRunnerReuseKey, canReuseRunner } from "./libs/runner-reuse.js";
import { persistImageAttachmentReference, rehydrateStoredImageAttachment } from "./libs/attachment-store.js";
import { resolveAgentRuntimeContext } from "./libs/agent-resolver.js";
import { getApiConfigForModel, getCurrentApiConfig, getModelConfig, resolveApiConfigForModel, supportsRemoteSessionResume } from "./libs/claude-settings.js";
import { loadGlobalRuntimeConfig, saveGlobalRuntimeConfig } from "./libs/config-store.js";
import { listExternalMcpServerInfos } from "./libs/external-mcp-servers.js";
import { buildNextFigmaOfficialAuthStateRuntimeConfig, isFigmaMcpOAuthCallbackPrompt, redactFigmaMcpOAuthCallbackPrompt, type FigmaOfficialAuthState } from "./libs/figma-official-plugin.js";
import { SessionStore } from "./libs/session-store.js";
import { buildSessionSlashCommands } from "./libs/slash-command-catalog.js";
import { stripInlineBase64ImagesFromMessage } from "./libs/tool-output-sanitizer.js";
import { buildSessionWorkflowCatalog } from "./libs/workflow-catalog.js";
import { buildStatelessContinuationPayload } from "./stateless-continuation.js";
import type { ClientEvent, PromptAttachment, RuntimeOverrides, ServerEvent, StreamMessage } from "./types.js";
import { isDev } from "./util.js";
import Database from "better-sqlite3";
import {
  TaskExecutor,
  TaskRepository,
  LarkTaskProvider,
  TbTaskProvider,
  FeishuProjectTaskProvider,
  registerTaskProvider,
  type TaskFilter,
  type TaskExecutionOptions,
  type TaskProviderId,
} from "./libs/task/index.js";
import { NoteRepository } from "./libs/note-repository.js";
import {
  buildChannelSessionTitle,
  buildChannelReplyTarget,
  ensureChannelWorkspace,
  recordChannelOutboundMessage,
  recordChannelInboundMessage,
  type ChannelReplyTarget,
} from "./libs/channel-workspace.js";

let sessions: SessionStore;
const runnerHandles = new Map<string, RunnerHandle>();
const warmRunnerCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const serverEventListeners = new Set<(event: ServerEvent) => void>();
const channelReplyTargets = new Map<string, ChannelReplyTarget>();
const channelLatestAssistantText = new Map<string, string>();
const channelLastSentAssistantText = new Map<string, string>();
// Temporarily disable the embedded Figma Agent OAuth bridge; Codex OAuth remains the supported path.
const FIGMA_AGENT_OAUTH_BRIDGE_ENABLED = false;
const WARM_RUNNER_IDLE_MS = 30 * 60 * 1000;
const figmaAuthToolUses = new Map<string, "authenticate" | "complete_authentication">();
const figmaAuthUrlsBySession = new Map<string, string>();
let channelReplySender: ((target: ChannelReplyTarget, text: string) => Promise<void> | void) | null = null;

let taskExecutor: TaskExecutor | null = null;

let noteRepo: NoteRepository | null = null;

export function initializeNoteRepository(dbPath: string): NoteRepository {
  const noteDb = new Database(dbPath);
  noteRepo = new NoteRepository(noteDb);
  return noteRepo;
}

export function initializeTaskExecutor(dbPath: string): TaskExecutor {
  const taskDb = new Database(dbPath);
  const taskRepo = new TaskRepository(taskDb);
  const sessionStore = initializeSessions();

  registerTaskProvider(new LarkTaskProvider());
  registerTaskProvider(new TbTaskProvider());
  registerTaskProvider(new FeishuProjectTaskProvider());

  const executor = new TaskExecutor(taskRepo, {
    onTaskUpdated: (task) => {
      broadcast({
... (truncated)
```

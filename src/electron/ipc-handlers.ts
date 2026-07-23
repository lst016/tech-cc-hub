import { app, BrowserWindow, clipboard, dialog, shell, type MessageBoxOptions } from "electron";
import { join } from "path";
import type { SDKMessageOrigin } from "@anthropic-ai/claude-agent-sdk";

import {
  createStoredUserPromptMessage,
  estimateAttachmentPromptChars,
  sanitizePromptAttachmentsForStorage,
} from "../shared/attachments.js";
import { buildPromptLedgerMessage, type PromptLedgerMessage, type PromptLedgerSource } from "../shared/prompt-ledger.js";
import { deriveLatestPlanSnapshot } from "../shared/plan-progress.js";
import { normalizeBackgroundRunnerStatus } from "../shared/runner-background-lifecycle.js";
import { shouldBypassProviderResumeAfterEmptySuccess } from "../shared/runner-status.js";
import { normalizeReleasePermissionMode } from "../shared/runtime-permissions.js";
import { createInitialSessionWorkflowState, parseWorkflowMarkdown } from "../shared/workflow-markdown.js";
import {
  buildNextBuiltinMcpServerEnabledConfig,
  isBuiltinMcpServerName,
  listBuiltinMcpServerInfos,
  resolveEnabledBuiltinMcpServerNames,
} from "../shared/builtin-mcp-registry.js";
import {
  runClaude,
  type RunnerHandle,
  type ToolPermissionPolicy,
} from "./libs/runner/runner.js";
import { buildRunnerReuseKey } from "./libs/runner/runner-reuse.js";
import { persistImageAttachmentReference, rehydrateStoredImageAttachment } from "./libs/attachment-store.js";
import { listAvailableClaudeAgents, resolveAgentRuntimeContext } from "./libs/agent-resolver.js";
import {
  getCurrentApiConfig,
  getModelConfig,
  resolveApiConfigForModel,
  supportsRemoteSessionResume,
} from "./libs/claude/claude-settings.js";
import { loadGlobalRuntimeConfig, saveGlobalRuntimeConfig } from "./libs/config-store.js";
import { listExternalMcpServerInfos } from "./libs/external-mcp-servers.js";
import { buildNextFigmaOfficialAuthStateRuntimeConfig, isFigmaMcpOAuthCallbackPrompt, redactFigmaMcpOAuthCallbackPrompt, type FigmaOfficialAuthState } from "./libs/figma-official-plugin.js";
import { SessionStore } from "./libs/session-store.js";
import { BtwRuntimeManager } from "./libs/btw-runtime-manager.js";
import { forkStoredSession } from "./libs/session-fork/index.js";
import { buildSessionSlashCommands, resolveInvokedLocalSlashDefinition } from "./libs/slash-command-catalog.js";
import { stripInlineBase64ImagesFromMessage } from "./libs/tool-output-sanitizer.js";
import { buildSessionWorkflowCatalog } from "./libs/workflow-catalog.js";
import {
  collectWorkflowToolUseNames,
  extractWorkflowRunPatchesFromMessage,
} from "./libs/workflows/workflow-output-parser.js";
import { buildStatelessContinuationPayload } from "./stateless-continuation.js";
import { ensureManagedCodeGraphSynced } from "./libs/codegraph/managed-codegraph.js";
import { createSessionCodeGraphAutoSyncScheduler } from "./libs/codegraph/session-codegraph-autosync.js";
import { createServerEventBatcher } from "./libs/server-event-batcher.js";
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
import { NoteRepository } from "./libs/note/note-repository.js";
import {
  buildChannelSessionTitle,
  buildChannelReplyTarget,
  ensureChannelWorkspace,
  resolveChannelWorkspaceLocation,
  resolveChannelWorkspaceIds,
  recordChannelOutboundMessage,
  recordChannelInboundMessage,
  type ChannelReplyTarget,
} from "./libs/channel/channel-workspace.js";
import {
  collectSafeChannelReplyAttachments,
  removeUploadedAttachmentReferences,
} from "./libs/channel/channel-reply-attachments.js";
import { buildChannelAgentPrompt } from "./libs/channel/channel-agent-prompt.js";
import {
  buildLarkAskUserQuestionAnsweredInput,
  buildLarkAskUserQuestionOptionAnswerInput,
  buildLarkWorkflowCard,
  createLarkWorkflowCardCoordinator,
  deriveLarkAgentConversationEntries,
  resolveLarkWorkflowReplyDelivery,
  type LarkCardActionEvent,
  type LarkCardJson,
  type LarkWorkflowCardSnapshot,
  type LarkWorkflowCardSendResult,
} from "./libs/channel/lark-workflow-card.js";
import { notifySessionFinished, notifyTaskExecutionFinished } from "./libs/desktop-notifications.js";
import type { WorkflowRunRecord } from "../shared/workflows/workflow-runs.js";
import {
  getClaudeConversationResetId,
  getClaudeRetractionIds,
  isClaudeConversationReset,
} from "../shared/claude-agent-sdk-messages.js";

import { AnnotationStore } from "./libs/annotations-store.js";
import type { AnnotationInput } from "../shared/annotation.js";

let sessions: SessionStore;
let annotationStore: AnnotationStore | null = null;
const runnerHandles = new Map<string, RunnerHandle>();
const serverEventListeners = new Set<(event: ServerEvent) => void>();
const channelReplyTargets = new Map<string, ChannelReplyTarget>();
const pendingChannelReplyTargetsByConversation = new Map<string, {
  target: ChannelReplyTarget;
  claim?: ChannelMessageClaim;
  workspaceRoot: string;
}>();
const channelMessageQueues = new Map<string, Promise<void>>();
const channelLatestAssistantText = new Map<string, string>();
const channelLastSentReplySignature = new Map<string, string>();
const channelProcessingReactions = new Map<string, { reactionId: string; target: ChannelReplyTarget }>();
const channelProcessingReactionGenerations = new Map<string, number>();
const channelMessageClaimsBySession = new Map<string, ChannelMessageClaim[]>();
// 渠道心跳：长任务在飞书侧长时间静默时，定期发一条「仍在处理中」提示，避免被误以为卡死。
// 仅对注册了回复目标的渠道会话生效；每个 turn 的首次 status:running 重新 arm，终态时清除。
const channelHeartbeatTimers = new Map<string, ReturnType<typeof setTimeout>>();
// 首次心跳：turn 启动后多久还没出结果就先发一条「仍在处理中」。
const RUNNER_CHANNEL_HEARTBEAT_DELAY_MS = 45_000;
// 后续心跳：首次之后每隔多久再提醒一次，直到终态。
const RUNNER_CHANNEL_HEARTBEAT_INTERVAL_MS = 90_000;
// Temporarily disable the embedded Figma Agent OAuth bridge; Codex OAuth remains the supported path.
const FIGMA_AGENT_OAUTH_BRIDGE_ENABLED = false;
const CONTINUATION_HISTORY_LIMIT = 1_000;
const figmaAuthToolUses = new Map<string, "authenticate" | "complete_authentication">();
const figmaAuthUrlsBySession = new Map<string, string>();
const workflowToolUseNamesBySession = new Map<string, Map<string, string>>();
const workflowTaskIdsBySession = new Map<string, Set<string>>();
type ChannelMessageClaim = { messageId: string; provider: string };

type ChannelReplySender = {
  sendText: (target: ChannelReplyTarget, text: string) => Promise<void> | void;
  sendImage?: (target: ChannelReplyTarget, relativePath: string) => Promise<void> | void;
  sendFile?: (target: ChannelReplyTarget, relativePath: string) => Promise<void> | void;
  addReaction?: (target: ChannelReplyTarget, emojiType: string) => Promise<string>;
  removeReaction?: (target: ChannelReplyTarget, reactionId: string) => Promise<void>;
  sendWorkflowCard?: (
    target: ChannelReplyTarget,
    card: LarkCardJson,
    idempotencyKey: string,
  ) => Promise<LarkWorkflowCardSendResult>;
  updateWorkflowCard?: (messageId: string, card: LarkCardJson) => Promise<void>;
  updateWorkflowCardAfterAction?: (token: string, card: LarkCardJson) => Promise<void>;
};

let channelReplySender: ChannelReplySender | null = null;
const larkWorkflowCardPermissions = new Map<string, LarkWorkflowCardSnapshot["permission"]>();
const larkWorkflowCardErrors = new Map<string, string>();
const larkWorkflowCardActionNotices = new Map<string, string>();
const larkWorkflowCardCoordinator = createLarkWorkflowCardCoordinator({
  send: async (target, card, idempotencyKey) => {
    const sender = channelReplySender;
    if (!sender?.sendWorkflowCard) throw new Error("Lark workflow card sender is unavailable");
    return await sender.sendWorkflowCard(target, card, idempotencyKey);
  },
  update: async (messageId, card) => {
    const sender = channelReplySender;
    if (!sender?.updateWorkflowCard) throw new Error("Lark workflow card updater is unavailable");
    await sender.updateWorkflowCard(messageId, card);
  },
});

let taskExecutor: TaskExecutor | null = null;

let noteRepo: NoteRepository | null = null;

function isThinkingTokenStreamMessage(message: StreamMessage): boolean {
  return message.type === "system" && "subtype" in message && message.subtype === "thinking_tokens";
}

const scheduleCodeGraphAutoSyncAfterTurn = createSessionCodeGraphAutoSyncScheduler({
  sync: ensureManagedCodeGraphSynced,
  logInfo: (message) => console.info(message),
  logWarn: (message, error) => console.warn(message, error),
});

export function initializeNoteRepository(dbPath: string): NoteRepository {
  const noteDb = new Database(dbPath);
  noteRepo = new NoteRepository(noteDb);
  return noteRepo;
}

export function initializeAnnotationStore(dbPath: string): AnnotationStore {
  const annotationDb = new Database(dbPath);
  annotationStore = new AnnotationStore(annotationDb);
  return annotationStore;
}

function requireAnnotationStore(): AnnotationStore {
  if (!annotationStore) {
    throw new Error("AnnotationStore not initialized");
  }
  return annotationStore;
}

export function registerAnnotationIpcHandlers(ipcMainHandle: typeof import("./util.js").ipcMainHandle): void {
  ipcMainHandle("annotations:list-by-message", (_event: unknown, sessionId: string, messageId: string) => {
    return requireAnnotationStore().listByMessage(sessionId, messageId);
  });
  ipcMainHandle("annotations:list-by-session", (_event: unknown, sessionId: string) => {
    return requireAnnotationStore().listBySession(sessionId);
  });
  ipcMainHandle("annotations:create", (_event: unknown, input: AnnotationInput) => {
    return requireAnnotationStore().create(input);
  });
  ipcMainHandle("annotations:update", (_event: unknown, id: string, body: string) => {
    return requireAnnotationStore().update(id, body);
  });
  ipcMainHandle("annotations:remove", (_event: unknown, id: string) => {
    return requireAnnotationStore().remove(id);
  });
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
        type: "task.updated",
        payload: { task },
      } as ServerEvent);
    },
    onTaskDeleted: (taskId) => {
      broadcast({
        type: "task.deleted",
        payload: { taskId },
      } as ServerEvent);
    },
    onExecutionStarted: (execution) => {
      broadcast({
        type: "task.execution.started",
        payload: { execution },
      } as ServerEvent);
    },
    onExecutionCompleted: (execution) => {
      broadcast({
        type: "task.execution.completed",
        payload: { execution },
      } as ServerEvent);
      const task = taskRepo.getTask(execution.taskId);
      const executionSession = sessions.getSession(execution.sessionId);
      notifyTaskExecutionFinished({
        taskId: execution.taskId,
        sessionId: execution.sessionId,
        taskTitle: task?.title,
        workspacePath: task?.workspacePath ?? executionSession?.cwd,
        status: execution.status,
        error: execution.error,
      });
    },
    onExecutionLog: (log) => {
      broadcast({
        type: "task.execution.log",
        payload: { log },
      } as ServerEvent);
    },
    onStatsChanged: (stats) => {
      broadcast({
        type: "task.stats",
        payload: { stats },
      } as ServerEvent);
    },
    onSyncCompleted: (provider, count) => {
      broadcast({
        type: "task.sync.completed",
        payload: { provider, count },
      } as ServerEvent);
    },
    onError: (message) => {
      broadcast({
        type: "task.error",
        payload: { message },
      } as ServerEvent);
    },
  }, {
    sessionStore,
    emitServerEvent: emit,
    userDataPath: app.getPath("userData"),
    cwd: app.getAppPath(),
  });

  executor.startPolling(30000);
  taskExecutor = executor;
  return executor;
}

export function setChannelReplySender(sender: ChannelReplySender | null) {
  channelReplySender = sender;
}

function buildLarkWorkflowCardSnapshot(sessionId: string): LarkWorkflowCardSnapshot | null {
  if (!sessions) return null;
  const session = sessions.getSession(sessionId);
  if (!session) return null;
  const runs = sessions.listWorkflowRuns(sessionId).map((run) => ({
    id: run.id,
    taskId: run.taskId,
    workflowRunId: run.id,
    workflowName: run.workflowName,
    status: run.status,
    summary: run.summary,
    warning: run.warning,
    error: run.error,
    sessionUrl: run.sessionUrl,
    canResume: Boolean(run.runId)
      && run.taskType !== "remote_agent"
      && run.status !== "running"
      && run.status !== "launching"
      && run.status !== "backgrounded",
    canRerun: Boolean(run.scriptPath)
      && (run.status === "failed" || run.status === "killed" || run.status === "completed"),
  }));
  const latestRunUpdate = runs.reduce((latest, run) => {
    const record = sessions.getWorkflowRun(run.id);
    return Math.max(latest, record?.updatedAt ?? 0);
  }, 0);
  const conversation = deriveLarkAgentConversationEntries(
    sessions.getSessionHistory(sessionId)?.messages ?? [],
    session.status,
  );
  return {
    sessionId,
    title: session.title,
    prompt: session.lastPrompt,
    status: session.status,
    updatedAt: Math.max(session.updatedAt ?? 0, latestRunUpdate, Date.now()),
    assistantSummary: channelLatestAssistantText.get(sessionId),
    error: larkWorkflowCardErrors.get(sessionId),
    actionNotice: larkWorkflowCardActionNotices.get(sessionId),
    runs,
    permission: larkWorkflowCardPermissions.get(sessionId),
    conversation,
  };
}

async function syncLarkWorkflowCard(sessionId: string): Promise<boolean> {
  const target = channelReplyTargets.get(sessionId);
  const sender = channelReplySender;
  if (
    target?.provider !== "lark"
    || !sender?.sendWorkflowCard
    || !sender.updateWorkflowCard
  ) {
    return false;
  }
  const snapshot = buildLarkWorkflowCardSnapshot(sessionId);
  if (!snapshot) return false;
  try {
    await larkWorkflowCardCoordinator.sync(target, snapshot);
    return true;
  } catch (error) {
    console.warn("[channel] Failed to synchronize Lark workflow card:", error);
    return false;
  }
}

function initializeSessions() {
  if (!sessions) {
    const dbPath = join(app.getPath("userData"), "sessions.db");
    sessions = new SessionStore(dbPath);
    sessions.recoverInterruptedSessions();
  }
  return sessions;
}

const RENDERER_SESSION_LIST_LIMIT = 80;

export function listStoredSessionsForRenderer(archived = false, options?: { limit?: number }) {
  const store = initializeSessions();
  return store.listSessions({
    archived,
    summary: true,
    limit: options?.limit ?? RENDERER_SESSION_LIST_LIMIT,
  });
}

function sendRendererServerEvent(event: ServerEvent): void {
  const payload = JSON.stringify(event);
  if (isDev()) {
    console.log("[meta][server-event]", event.type);
  }
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("server-event", payload);
  }
}

const rendererEventBatcher = createServerEventBatcher({
  send: sendRendererServerEvent,
});

function broadcast(event: ServerEvent) {
  rendererEventBatcher.enqueue(event);
  for (const listener of serverEventListeners) {
    listener(event);
  }
}

export function broadcastServerEvent(event: ServerEvent): void {
  broadcast(event);
}

function hasLiveSession(sessionId: string): boolean {
  if (!sessions) return false;
  return Boolean(sessions.getSession(sessionId));
}

const MAX_REHYDRATED_IMAGE_ATTACHMENTS = 2;
const RECENT_IMAGE_REFERENCE_PATTERN =
  /(上一张|上张|上一轮|刚才那张|刚刚那张|之前那张|前面那张|之前的截图|前面的截图|之前的图片|前面的图片|previous (image|screenshot)|last (image|screenshot))/i;

function resolveLatestMessageModel(messages: StreamMessage[] | undefined): string | null {
  if (!messages || messages.length === 0) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") {
      continue;
    }

    const candidateModel = "model" in message ? (message as { model?: string }).model : undefined;
    if (typeof candidateModel !== "string") {
      continue;
    }

    const trimmed = candidateModel.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function isPlaceholderSessionTitle(title?: string): boolean {
  const normalized = title?.trim();
  return !normalized || normalized === "新聊天" || normalized === "New Session";
}

function buildTitleFromFirstPrompt(prompt: string, attachments?: PromptAttachment[]): string {
  const withoutAnnotations = prompt.replace(/<browser_annotations>[\s\S]*?<\/browser_annotations>/g, "").trim();
  const compact = withoutAnnotations
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");

  if (compact) {
    return compact.length > 18 ? `${compact.slice(0, 18)}...` : compact;
  }

  const imageCount = attachments?.filter((attachment) => attachment.kind === "image").length ?? 0;
  if (imageCount > 0) {
    return imageCount === 1 ? "图片识别" : `${imageCount} 张图片识别`;
  }

  return "新会话";
}

function shouldRehydrateRecentImages(prompt: string, attachments?: PromptAttachment[]): boolean {
  void prompt;
  void attachments;
  // 临时关闭历史图片自动补入：这个功能容易在截图开发场景串到旧图。
  // 后续如果恢复，必须在 UI 上明确提示“正在复用上一张图片”。
  return false;

  if (attachments?.some((attachment) => attachment.kind === "image")) {
    return false;
  }

  return RECENT_IMAGE_REFERENCE_PATTERN.test(prompt);
}

function hasInlineImagePreview(attachment: PromptAttachment): boolean {
  return typeof attachment.preview === "string" && /^data:image\//i.test(attachment.preview.trim());
}

async function hydrateImagePreviewsForDisplay(messages: StreamMessage[]): Promise<StreamMessage[]> {
  // Packaged renderer pages can display persisted file URIs directly. The dev
  // server is HTTP-based and still needs a data URL for local file previews.
  if (!isDev()) return messages;

  const hydratedMessages: StreamMessage[] = [];
  for (const message of messages) {
    if (message.type !== "user_prompt" || !message.attachments?.length) {
      hydratedMessages.push(message);
      continue;
    }

    const attachments: PromptAttachment[] = [];
    for (const attachment of message.attachments) {
      if (attachment.kind !== "image" || hasInlineImagePreview(attachment)) {
        attachments.push(attachment);
        continue;
      }
      try {
        const restored = await rehydrateStoredImageAttachment(attachment);
        attachments.push(restored?.runtimeData ? { ...attachment, preview: restored.runtimeData } : attachment);
      } catch {
        attachments.push(attachment);
      }
    }
    hydratedMessages.push({ ...message, attachments });
  }
  return hydratedMessages;
}

async function loadRecentReferencedImages(messages: StreamMessage[]): Promise<PromptAttachment[]> {
  const candidates: PromptAttachment[] = [];
  const seenStoragePaths = new Set<string>();

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== "user_prompt" || !message.attachments?.length) {
      continue;
    }

    for (const attachment of message.attachments) {
      if (attachment.kind !== "image" || !attachment.storagePath) {
        continue;
      }

      if (seenStoragePaths.has(attachment.storagePath)) {
        continue;
      }

      seenStoragePaths.add(attachment.storagePath);
      candidates.push(attachment);
      if (candidates.length >= MAX_REHYDRATED_IMAGE_ATTACHMENTS) {
        break;
      }
    }

    if (candidates.length >= MAX_REHYDRATED_IMAGE_ATTACHMENTS) {
      break;
    }
  }

  const hydrated: PromptAttachment[] = [];
  for (const attachment of candidates.reverse()) {
    const restored = await rehydrateStoredImageAttachment(attachment);
    if (restored) {
      hydrated.push(restored);
    }
  }

  return hydrated;
}

type PreparedPromptAttachments = {
  displayAttachments: PromptAttachment[];
  agentAttachments: PromptAttachment[];
};

function buildImageAssetSummary(attachment: PromptAttachment): string {
  const parts = [
    `用户当前轮上传/粘贴的图片附件已作为本地资产保存，主上下文不包含 base64：${attachment.name || "未命名图片"}`,
    attachment.storagePath ? `本地路径：${attachment.storagePath}` : undefined,
    attachment.storagePath ? `design_inspect_image 参数：{ "imagePath": "${attachment.storagePath.replace(/\\/g, "\\\\")}" }` : undefined,
    attachment.storageUri ? `文件 URI：${attachment.storageUri}` : undefined,
    typeof attachment.size === "number" ? `大小：${attachment.size} bytes` : undefined,
    "重要：不要用 Read 直接读取这个图片文件，图片会打爆主上下文。",
    "第一步必须调用 mcp__tech-cc-hub-design__design_inspect_image，并传入上面的本地路径，获取这张图的结构化视觉摘要。",
    "如果已经有当前页面并需要还原对齐，再调用 mcp__tech-cc-hub-design__design_compare_current_view，把当前页面截图和这张参考图比较。",
    "只有在确实有两张不同本地截图时，才调用 mcp__tech-cc-hub-design__design_compare_images；不要把同一张图同时作为 reference 和 candidate。",
  ].filter(Boolean);

  return parts.join("\n");
}

async function preparePromptAttachmentsForSession(attachments?: PromptAttachment[]): Promise<PreparedPromptAttachments> {
  const displayAttachments: PromptAttachment[] = [];
  const agentAttachments: PromptAttachment[] = [];

  for (const attachment of attachments ?? []) {
    if (attachment.kind !== "image") {
      displayAttachments.push(attachment);
      agentAttachments.push(attachment);
      continue;
    }

    const storedReference = await persistImageAttachmentReference(attachment);
    const displayAttachment: PromptAttachment = {
      ...attachment,
      storagePath: storedReference?.storagePath ?? attachment.storagePath,
      storageUri: storedReference?.storageUri ?? attachment.storageUri,
      size: storedReference?.size ?? attachment.size,
      runtimeData: undefined,
    };
    const summaryText = attachment.summaryText ?? buildImageAssetSummary(displayAttachment);
    const agentAttachment: PromptAttachment = {
      ...displayAttachment,
      data: storedReference?.storageUri ?? attachment.storageUri ?? attachment.data,
      preview: undefined,
      runtimeData: undefined,
      summaryText,
    };

    displayAttachments.push({ ...displayAttachment, summaryText });
    agentAttachments.push(agentAttachment);
  }

  return { displayAttachments, agentAttachments };
}

function buildPromptLedgerForRun(options: {
  phase: "start" | "continue";
  prompt: string;
  attachments?: PromptAttachment[];
  session: { cwd?: string; runSurface?: "development" | "maintenance"; agentId?: string; workflowMarkdown?: string; continuationSummary?: string };
  historyMessages?: StreamMessage[];
  model?: string;
  continuationSummary?: string;
}): PromptLedgerMessage {
  const agentContext = resolveAgentRuntimeContext({
    cwd: options.session.cwd,
    surface: options.session.runSurface ?? "development",
    agentId: options.session.agentId,
  });
  const memorySources: PromptLedgerSource[] = [];

  if (options.continuationSummary?.trim()) {
    memorySources.push({
      id: "continuation-summary",
      label: "本地滚动摘要",
      sourceKind: "memory",
      text: options.continuationSummary,
    });
  } else if (options.session.continuationSummary?.trim()) {
    memorySources.push({
      id: "continuation-summary",
      label: "本地滚动摘要",
      sourceKind: "memory",
      text: options.session.continuationSummary,
    });
  }

  const promptSources: PromptLedgerSource[] = [...agentContext.promptSources];
  const invokedDefinition = resolveInvokedLocalSlashDefinition({
    cwd: options.session.cwd,
    prompt: options.prompt,
  });
  if (invokedDefinition) {
    promptSources.push({
      id: `invoked-local-claude-definition-${invokedDefinition.name}`,
      label: `Invoked local Claude ${invokedDefinition.definitionKind}: ${invokedDefinition.name}`,
      sourceKind: "skill",
      text: invokedDefinition.content,
      sourcePath: invokedDefinition.filePath,
    });
  }

  if (options.session.workflowMarkdown?.trim()) {
    promptSources.push({
      id: "session-workflow",
      label: "当前工作流",
      sourceKind: "workflow",
      text: options.session.workflowMarkdown,
    });
  }

  return buildPromptLedgerMessage({
    phase: options.phase,
    model: options.model,
    cwd: options.session.cwd,
    prompt: options.prompt,
    attachments: (options.attachments ?? []).map((attachment) => ({
      name: attachment.name,
      kind: attachment.kind,
      chars: estimateAttachmentPromptChars(attachment),
    })),
    promptSources,
    memorySources,
    historyMessages: options.historyMessages ?? [],
  });
}

function rememberRunnerHandle(sessionId: string, handle: RunnerHandle, reuseKey: string): void {
  if (handle.isClosed()) return;
  handle.reuseKey = reuseKey;
  runnerHandles.set(sessionId, handle);
}

function closeRunnerHandle(sessionId: string): void {
  const handle = runnerHandles.get(sessionId);
  if (handle) {
    handle.abort();
    runnerHandles.delete(sessionId);
  }
}

function buildSessionRunnerReuseKey(options: {
  session: { cwd?: string; runSurface?: "development" | "maintenance"; agentId?: string; allowedTools?: string };
  model?: string;
  runtime?: RuntimeOverrides;
  prompt: string;
  attachments?: PromptAttachment[];
  toolPermissionPolicy?: ToolPermissionPolicy;
}): string {
  return buildRunnerReuseKey({
    cwd: options.session.cwd,
    model: options.model,
    allowedTools: options.session.allowedTools,
    runSurface: options.session.runSurface,
    agentId: options.session.agentId,
    runtime: options.runtime,
    prompt: options.prompt,
    attachments: options.attachments,
    toolPermissionPolicy: options.toolPermissionPolicy,
  });
}

function emit(event: ServerEvent) {
  let nextEvent = event;

  // If a session was deleted, drop late events that would resurrect it in the UI.
  // Session history lookups are DB-backed, so late events commonly lead to
  // "Unknown session" artifacts on the renderer side.
  if (
    (nextEvent.type === "session.status" ||
      nextEvent.type === "session.plan.updated" ||
      nextEvent.type === "stream.message" ||
      nextEvent.type === "stream.user_prompt" ||
      nextEvent.type === "workflow.runs" ||
      nextEvent.type === "workflow.run.updated" ||
      nextEvent.type === "permission.request") &&
    !hasLiveSession(nextEvent.payload.sessionId)
  ) {
    return;
  }

  if (nextEvent.type === "session.status") {
    if (nextEvent.payload.backgroundActive) {
      const normalizedStatus = normalizeBackgroundRunnerStatus(
        nextEvent.payload.status,
        nextEvent.payload.backgroundActive,
      );
      if (normalizedStatus !== nextEvent.payload.status) {
        nextEvent = {
          ...nextEvent,
          payload: { ...nextEvent.payload, status: normalizedStatus },
        };
      }
    }
    const previousSession = sessions.getSession(nextEvent.payload.sessionId);
    const previousStatus = previousSession?.status;
    const sessionCwd = typeof nextEvent.payload.cwd === "string" && nextEvent.payload.cwd.trim()
      ? nextEvent.payload.cwd
      : previousSession?.cwd;

    sessions.updateSession(nextEvent.payload.sessionId, { status: nextEvent.payload.status });
    scheduleCodeGraphAutoSyncAfterTurn({
      sessionId: nextEvent.payload.sessionId,
      cwd: sessionCwd,
      previousStatus,
      nextStatus: nextEvent.payload.status,
    });
  }
  if (nextEvent.type === "session.plan.updated") {
    sessions.updateSession(nextEvent.payload.sessionId, { planSnapshot: nextEvent.payload });
  }
  if (nextEvent.type === "stream.message") {
    const normalizedMessage =
      typeof nextEvent.payload.message.capturedAt === "number"
        ? nextEvent.payload.message
        : { ...nextEvent.payload.message, capturedAt: Date.now() };
    if (isThinkingTokenStreamMessage(normalizedMessage)) {
      return;
    }
    if (isClaudeConversationReset(normalizedMessage)) {
      sessions.resetConversation(nextEvent.payload.sessionId, {
        claudeSessionId: getClaudeConversationResetId(normalizedMessage),
      });
      workflowToolUseNamesBySession.delete(nextEvent.payload.sessionId);
      workflowTaskIdsBySession.delete(nextEvent.payload.sessionId);
      channelLatestAssistantText.delete(nextEvent.payload.sessionId);
      figmaAuthUrlsBySession.delete(nextEvent.payload.sessionId);
    }
    const retractedMessageIds = getClaudeRetractionIds(normalizedMessage);
    if (retractedMessageIds.length > 0) {
      sessions.retractMessages(nextEvent.payload.sessionId, retractedMessageIds);
      const currentPlan = sessions.getSession(nextEvent.payload.sessionId)?.planSnapshot;
      if (currentPlan?.turnId && retractedMessageIds.includes(currentPlan.turnId)) {
        const remainingMessages = sessions.getSessionHistory(nextEvent.payload.sessionId)?.messages ?? [];
        sessions.updateSession(nextEvent.payload.sessionId, {
          planSnapshot: deriveLatestPlanSnapshot(nextEvent.payload.sessionId, remainingMessages),
        });
      }
    }
    trackFigmaAuthToolState(nextEvent.payload.sessionId, normalizedMessage);
    const message = sessions.recordMessage(
      nextEvent.payload.sessionId,
      stripInlineBase64ImagesFromMessage(normalizedMessage),
    );
    trackWorkflowRunsFromStreamMessage(nextEvent.payload.sessionId, message);
    nextEvent = {
      ...nextEvent,
      payload: {
        ...nextEvent.payload,
        message,
      },
    };
    const assistantText = extractAssistantText(message);
    console.log("[channel-debug] stream.message: sessionId=%s, messageType=%s, hasChannelTarget=%s, extractedAssistantText=%s",
      nextEvent.payload.sessionId,
      message.type,
      channelReplyTargets.has(nextEvent.payload.sessionId) ? "yes" : "no",
      assistantText ? `length=${assistantText.length}` : "null");
    if (assistantText && channelReplyTargets.has(nextEvent.payload.sessionId)) {
      channelLatestAssistantText.set(nextEvent.payload.sessionId, assistantText);
      larkWorkflowCardActionNotices.delete(nextEvent.payload.sessionId);
      void syncLarkWorkflowCard(nextEvent.payload.sessionId);
      console.log("[channel-debug] channelLatestAssistantText SET: sessionId=%s, textLength=%d",
        nextEvent.payload.sessionId, assistantText.length);
    }
  }
  if (nextEvent.type === "stream.user_prompt") {
    const sanitizedAttachments = sanitizePromptAttachmentsForStorage(nextEvent.payload.attachments);
    const storedPrompt = sessions.recordMessage(
      nextEvent.payload.sessionId,
      {
        ...createStoredUserPromptMessage(nextEvent.payload.prompt, sanitizedAttachments),
        capturedAt: Date.now(),
      },
    );
    nextEvent = {
      ...nextEvent,
      payload: {
        ...nextEvent.payload,
        attachments: isDev() ? nextEvent.payload.attachments : sanitizedAttachments,
        capturedAt: storedPrompt.capturedAt,
        historyId: storedPrompt.historyId,
      },
    };
    void syncLarkWorkflowCard(nextEvent.payload.sessionId);
  }
  if (nextEvent.type === "permission.request") {
    nextEvent = withFigmaAuthUrlPermissionInput(nextEvent);
    larkWorkflowCardActionNotices.delete(nextEvent.payload.sessionId);
    larkWorkflowCardPermissions.set(nextEvent.payload.sessionId, {
      toolUseId: nextEvent.payload.toolUseId,
      toolName: nextEvent.payload.toolName,
      input: nextEvent.payload.input,
    });
    void syncLarkWorkflowCard(nextEvent.payload.sessionId);
  }

  if (nextEvent.type === "session.status") {
    larkWorkflowCardActionNotices.delete(nextEvent.payload.sessionId);
    if (nextEvent.payload.status === "error") {
      larkWorkflowCardErrors.set(
        nextEvent.payload.sessionId,
        nextEvent.payload.error?.trim() || "任务执行失败",
      );
    } else {
      larkWorkflowCardErrors.delete(nextEvent.payload.sessionId);
    }
    if (nextEvent.payload.status !== "running") {
      larkWorkflowCardPermissions.delete(nextEvent.payload.sessionId);
    }
    void syncLarkWorkflowCard(nextEvent.payload.sessionId);
  }

  if (nextEvent.type === "session.status" && nextEvent.payload.status === "running") {
    // 渠道会话每次进入 running（新 turn 或 append 续聊）重新 arm 心跳；终态会清除。
    armChannelHeartbeat(nextEvent.payload.sessionId);
  }

  if (nextEvent.type === "session.status" && nextEvent.payload.status === "completed") {
    console.log("[channel-debug] session.status:completed: sessionId=%s, channelLatestAssistantTextKeys=%j",
      nextEvent.payload.sessionId,
      [...channelLatestAssistantText.keys()]);
    finalizeChannelMessageClaims(nextEvent.payload.sessionId, false);
    clearChannelHeartbeat(nextEvent.payload.sessionId);
    void maybeSendChannelReply(nextEvent.payload.sessionId);
    closeRunnerHandle(nextEvent.payload.sessionId);
    const session = sessions.getSession(nextEvent.payload.sessionId);
    notifySessionFinished({
      sessionId: nextEvent.payload.sessionId,
      title: nextEvent.payload.title ?? session?.title,
      lastPrompt: session?.lastPrompt,
      workspacePath: nextEvent.payload.cwd ?? session?.cwd,
      status: nextEvent.payload.status,
    });
  }

  // 清理 runner handle，避免 appendPrompt 将消息写入已完成的 runner 内部 dead array
  if (nextEvent.type === "session.status" && nextEvent.payload.status === "error") {
    console.log("[channel-debug] session.status:error: sessionId=%s, channelLatestAssistantTextKeys=%j, error=%s",
      nextEvent.payload.sessionId,
      [...channelLatestAssistantText.keys()],
      nextEvent.payload.error?.substring(0, 200) ?? "none");
    finalizeChannelMessageClaims(nextEvent.payload.sessionId, true);
    clearChannelHeartbeat(nextEvent.payload.sessionId);
    void clearChannelProcessingReaction(nextEvent.payload.sessionId);
    void sendChannelErrorReply(nextEvent.payload.sessionId, nextEvent.payload.error);
    closeRunnerHandle(nextEvent.payload.sessionId);
    const session = sessions.getSession(nextEvent.payload.sessionId);
    notifySessionFinished({
      sessionId: nextEvent.payload.sessionId,
      title: nextEvent.payload.title ?? session?.title,
      lastPrompt: session?.lastPrompt,
      workspacePath: nextEvent.payload.cwd ?? session?.cwd,
      status: nextEvent.payload.status,
      error: nextEvent.payload.error,
    });
  }

  broadcast(nextEvent);
}

const btwRuntimeManager = new BtwRuntimeManager({
  emit,
  run: runClaude,
  buildContinuation: (messages, prompt, attachments) => buildStatelessContinuationPayload(
    messages,
    prompt,
    attachments,
    { recentTurnCount: 5 },
  ),
});

function getWorkflowToolUseNamesForSession(sessionId: string): Map<string, string> {
  const existing = workflowToolUseNamesBySession.get(sessionId);
  if (existing) return existing;
  const next = new Map<string, string>();
  workflowToolUseNamesBySession.set(sessionId, next);
  return next;
}

function getWorkflowTaskIdsForSession(sessionId: string): Set<string> {
  const existing = workflowTaskIdsBySession.get(sessionId);
  if (existing) return existing;
  const next = new Set<string>();
  workflowTaskIdsBySession.set(sessionId, next);
  return next;
}

function trackWorkflowRunsFromStreamMessage(sessionId: string, message: StreamMessage): void {
  const toolUseNames = getWorkflowToolUseNamesForSession(sessionId);
  const taskIds = getWorkflowTaskIdsForSession(sessionId);
  collectWorkflowToolUseNames(message, toolUseNames);

  const patches = extractWorkflowRunPatchesFromMessage({
    sessionId,
    message,
    toolUseNames,
    knownWorkflowTaskIds: taskIds,
  });

  for (const patch of patches) {
    const run = sessions.upsertWorkflowRun(patch);
    taskIds.add(run.taskId);
    broadcast({
      type: "workflow.run.updated",
      payload: run,
    });
  }
  if (patches.length > 0) {
    larkWorkflowCardActionNotices.delete(sessionId);
    void syncLarkWorkflowCard(sessionId);
  }
}

function trackFigmaAuthToolState(sessionId: string, message: StreamMessage): void {
  if (!FIGMA_AGENT_OAUTH_BRIDGE_ENABLED) {
    return;
  }
  const record: Record<string, unknown> = isRecord(message) ? message : {};
  const sdkMessage = isRecord(record.message) ? record.message : record;
  const content = Array.isArray(sdkMessage.content) ? sdkMessage.content : [];

  for (const item of content) {
    if (!isRecord(item) || item.type !== "tool_use") continue;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) continue;
    if (item.name === "mcp__figma__authenticate") {
      figmaAuthToolUses.set(id, "authenticate");
    }
    if (item.name === "mcp__figma__complete_authentication") {
      figmaAuthToolUses.set(id, "complete_authentication");
    }
  }

  for (const item of content) {
    if (!isRecord(item) || item.type !== "tool_result") continue;
    const toolUseId = typeof item.tool_use_id === "string" ? item.tool_use_id : "";
    const toolKind = figmaAuthToolUses.get(toolUseId);
    if (!toolKind) continue;

    const result = isRecord(record.tool_use_result) ? record.tool_use_result : {};
    const status = typeof result.status === "string" ? result.status : "";
    const text = [
      typeof item.content === "string" ? item.content : "",
      typeof result.message === "string" ? result.message : "",
      typeof result.error === "string" ? result.error : "",
    ].filter(Boolean).join("\n");

    if (toolKind === "authenticate" && status === "auth_url") {
      const authUrl = extractFigmaAuthUrl(text);
      if (authUrl) {
        const previousAuthUrl = figmaAuthUrlsBySession.get(sessionId);
        figmaAuthUrlsBySession.set(sessionId, authUrl);
        if (previousAuthUrl !== authUrl) {
          presentFigmaAuthUrl(authUrl);
        }
      }
      updateFigmaPluginAuthState("needs-auth");
      continue;
    }

    if (toolKind === "complete_authentication" && isSuccessfulFigmaAuthText(status, text)) {
      updateFigmaPluginAuthState("ready");
      figmaAuthUrlsBySession.delete(sessionId);
      figmaAuthToolUses.delete(toolUseId);
      continue;
    }

    if (isFigmaAuthFailureText(status, text)) {
      updateFigmaPluginAuthState("auth-expired", text.slice(0, 500));
    }
  }
}

function withFigmaAuthUrlPermissionInput(
  event: Extract<ServerEvent, { type: "permission.request" }>,
): Extract<ServerEvent, { type: "permission.request" }> {
  if (!FIGMA_AGENT_OAUTH_BRIDGE_ENABLED) {
    return event;
  }
  if (event.payload.toolName !== "AskUserQuestion") {
    return event;
  }
  const authUrl = figmaAuthUrlsBySession.get(event.payload.sessionId);
  if (!authUrl) {
    return event;
  }
  const input = isRecord(event.payload.input) ? event.payload.input : {};
  return {
    ...event,
    payload: {
      ...event.payload,
      input: {
        ...input,
        figmaAuthUrl: authUrl,
      },
    },
  };
}

function extractFigmaAuthUrl(text: string): string | null {
  const match = text.match(/https:\/\/www\.figma\.com\/oauth\/mcp\?[^\s"'<>）)]+/i);
  return match?.[0] ?? null;
}

function presentFigmaAuthUrl(authUrl: string): void {
  clipboard.writeText(authUrl);
  shell.openExternal(authUrl).catch((error) => {
    console.error("[figma-official] failed to open Agent auth URL:", error);
  });
  const options: MessageBoxOptions = {
    type: "info",
    buttons: ["知道了"],
    defaultId: 0,
    title: "Figma 授权链接已打开",
    message: "Figma 授权链接已打开并复制到剪贴板",
    detail: [
      "如果外部浏览器没有自动打开，请到你已登录 Figma 的浏览器粘贴打开。",
      "授权完成后，如果 localhost 页面正常加载，在 Agent 询问面板里选择「授权已完成」。",
      "不要把 localhost callback URL 粘贴回 Agent；当前嵌入式 OAuth 流里这条路径容易丢失临时授权状态。",
      "如果 localhost 页面打不开，请回到插件卡片改用 Figma Desktop MCP。",
      "",
      authUrl,
    ].join("\n"),
  };
  const focusedWindow = BrowserWindow.getFocusedWindow();
  void (focusedWindow ? dialog.showMessageBox(focusedWindow, options) : dialog.showMessageBox(options));
}

function updateFigmaPluginAuthState(state: FigmaOfficialAuthState, error?: string): void {
  try {
    saveGlobalRuntimeConfig(
      buildNextFigmaOfficialAuthStateRuntimeConfig(loadGlobalRuntimeConfig(), state, { error }),
    );
  } catch (cause) {
    console.error("[figma-official] failed to persist auth state:", cause);
  }
}

function isSuccessfulFigmaAuthText(status: string, text: string): boolean {
  return /^(success|ok|ready|authenticated)$/i.test(status)
    || /authentication complete|authenticated|authorization complete|successfully authorized|授权.*完成|授权.*成功/i.test(text);
}

function isFigmaAuthFailureText(status: string, text: string): boolean {
  return /^error$/i.test(status)
    || /no oauth flow is in progress|401|403|unauthorized|expired|token|oauth.*error|authorization.*failed|auth.*failed/i.test(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractAssistantText(message: StreamMessage): string | null {
  if (message.type !== "assistant") {
    console.log("[channel-debug] extractAssistantText: message.type=%s, skipping", message.type);
    return null;
  }
  const sdkMessage = "message" in message && typeof message.message === "object" && message.message !== null
    ? message.message as { content?: unknown }
    : null;
  const content = Array.isArray(sdkMessage?.content) ? sdkMessage.content : [];
  const blockTypes = content.map((item) => {
    if (!item || typeof item !== "object") return "unknown";
    const block = item as { type?: unknown };
    return typeof block.type === "string" ? block.type : "unknown";
  });
  const text = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const block = item as { type?: unknown; text?: unknown };
      return block.type === "text" && typeof block.text === "string" ? block.text.trim() : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const result = text || null;
  console.log("[channel-debug] extractAssistantText: contentBlocks=%j, blockTypes=%j, extractedLength=%d, result=%s",
    content.length, blockTypes, result?.length ?? 0, result ? "has-text" : "null");
  return result;
}

type ChannelReplyDeliveryResult = "workflow_card" | "text" | "skipped";

async function maybeSendChannelReply(sessionId: string): Promise<ChannelReplyDeliveryResult> {
  const target = channelReplyTargets.get(sessionId);
  const text = channelLatestAssistantText.get(sessionId)?.trim();
  console.log("[channel-debug] maybeSendChannelReply: sessionId=%s, hasTarget=%s, hasText=%s, textLength=%d, hasSender=%s, targetProvider=%s, targetConversationId=%s, targetExternalMessageId=%s",
    sessionId,
    target ? "yes" : "no",
    text ? "yes" : "no",
    text?.length ?? 0,
    channelReplySender ? "yes" : "no",
    target?.provider ?? "none",
    target?.rawConversationId ?? "none",
    target?.externalMessageId ?? "none");
  if (!target || !channelReplySender) {
    console.warn("[channel-debug] maybeSendChannelReply SKIPPED: reason=%s",
      !target ? "no-reply-target" : "no-channel-sender");
    return "skipped";
  }

  // A synchronized Lark workflow card is the primary and only textual reply.
  // Plain text remains a compatibility fallback when card delivery is unavailable.
  const delivery = await resolveLarkWorkflowReplyDelivery(
    target.provider,
    () => syncLarkWorkflowCard(sessionId),
  );
  if (delivery === "skipped") {
    console.warn("[channel-debug] maybeSendChannelReply SKIPPED: Lark workflow card delivery unavailable");
    await clearChannelProcessingReaction(sessionId);
    return "skipped";
  }
  if (delivery === "text" && !text) {
    console.warn("[channel-debug] maybeSendChannelReply SKIPPED: reason=no-assistant-text");
    return "skipped";
  }

  const replySignature = `${target.externalMessageId ?? target.rawConversationId}\0${delivery}\0${text ?? ""}`;
  if (channelLastSentReplySignature.get(sessionId) === replySignature) {
    console.warn("[channel-debug] maybeSendChannelReply SKIPPED: duplicate-reply-signature");
    await clearChannelProcessingReaction(sessionId);
    return delivery;
  }

  const attachments = target.provider === "lark" && text
    ? collectSafeChannelReplyAttachments(text, target.workspaceRoot)
    : [];
  const uploaded = [] as typeof attachments;
  try {
    for (const attachment of attachments) {
      try {
        if (attachment.kind === "image" && channelReplySender.sendImage) {
          await channelReplySender.sendImage(target, attachment.relativePath);
        } else if (attachment.kind === "file" && channelReplySender.sendFile) {
          await channelReplySender.sendFile(target, attachment.relativePath);
        } else {
          continue;
        }
        uploaded.push(attachment);
        recordChannelOutboundMessage(target.workspaceRoot, target, `[${attachment.kind}] ${attachment.relativePath}`);
      } catch (error) {
        console.warn(`[channel] Failed to send ${attachment.kind} reply:`, error);
      }
    }

    if (delivery === "workflow_card") {
      channelLastSentReplySignature.set(sessionId, replySignature);
      console.log("[channel-debug] maybeSendChannelReply card SENT OK: sessionId=%s", sessionId);
      return "workflow_card";
    }

    const replyText = removeUploadedAttachmentReferences(text ?? "", uploaded);
    console.log("[channel-debug] maybeSendChannelReply sending: sessionId=%s, replyTextLength=%d, uploadedCount=%d, attachmentsFound=%d",
      sessionId, replyText?.length ?? 0, uploaded.length, attachments.length);
    if (replyText) {
      await channelReplySender.sendText(target, replyText);
      recordChannelOutboundMessage(target.workspaceRoot, target, replyText);
      console.log("[channel-debug] maybeSendChannelReply text SENT OK: sessionId=%s", sessionId);
    }
    channelLastSentReplySignature.set(sessionId, replySignature);
    return "text";
  } catch (error) {
    console.warn("[channel] Failed to send channel reply:", error);
    console.warn("[channel-debug] maybeSendChannelReply FAILED: sessionId=%s, errorMessage=%s", sessionId, (error as Error)?.message ?? String(error));
    return "skipped";
  } finally {
    await clearChannelProcessingReaction(sessionId);
  }
}

async function sendChannelErrorReply(sessionId: string, error?: string): Promise<void> {
  const target = channelReplyTargets.get(sessionId);
  if (!target || !channelReplySender) return;
  // 先尝试回传超时/出错前已生成的部分文本（无文本时 maybeSendChannelReply 内部会跳过）。
  const delivery = await maybeSendChannelReply(sessionId);
  if (delivery !== "text") return;
  // 再补一条兜底提示，确保渠道侧一定能看到任务未正常结束，避免"不返回结果"。
  const reason = error?.trim() ? error.trim() : "任务执行失败";
  const fallback = `⚠️ 任务未正常完成：${reason}\n（未生成完整结果，请重试或简化指令后重试）`;
  const fallbackSignature = `${target.externalMessageId ?? target.rawConversationId}\0${fallback}`;
  if (channelLastSentReplySignature.get(sessionId) === fallbackSignature) return;
  try {
    await channelReplySender.sendText(target, fallback);
    recordChannelOutboundMessage(target.workspaceRoot, target, fallback);
    channelLastSentReplySignature.set(sessionId, fallbackSignature);
  } catch (sendError) {
    console.warn("[channel] Failed to send channel error reply:", sendError);
  }
}

// 渠道心跳：长任务在飞书侧长时间静默时，先发一条「仍在处理中」提示，避免被误以为卡死。
// 仅对注册了回复目标的渠道会话生效；每个 turn 的首次 status:running 重新 arm，终态时清除。
function armChannelHeartbeat(sessionId: string): void {
  clearChannelHeartbeat(sessionId);
  if (!channelReplyTargets.has(sessionId)) return;
  scheduleChannelHeartbeat(sessionId, RUNNER_CHANNEL_HEARTBEAT_DELAY_MS);
}

function scheduleChannelHeartbeat(sessionId: string, delayMs: number): void {
  const timer = setTimeout(() => void fireChannelHeartbeat(sessionId), delayMs);
  timer.unref?.();
  channelHeartbeatTimers.set(sessionId, timer);
}

async function fireChannelHeartbeat(sessionId: string): Promise<void> {
  channelHeartbeatTimers.delete(sessionId);
  const session = sessions.getSession(sessionId);
  if (!session || session.status !== "running") return;
  const target = channelReplyTargets.get(sessionId);
  if (target && channelReplySender) {
    const delivery = await resolveLarkWorkflowReplyDelivery(
      target.provider,
      () => syncLarkWorkflowCard(sessionId),
    );
    if (delivery !== "text") {
      if (delivery === "skipped") {
        console.warn("[channel] Lark heartbeat card delivery unavailable; plain-text downgrade suppressed");
      }
      scheduleChannelHeartbeat(sessionId, RUNNER_CHANNEL_HEARTBEAT_INTERVAL_MS);
      return;
    }
    const text = "⏳ 仍在处理中，请稍候…";
    try {
      await channelReplySender.sendText(target, text);
      recordChannelOutboundMessage(target.workspaceRoot, target, text);
    } catch (error) {
      console.warn("[channel] Failed to send heartbeat:", error);
    }
  }
  // 仍在 running 就继续按间隔提醒，直到终态清除。
  scheduleChannelHeartbeat(sessionId, RUNNER_CHANNEL_HEARTBEAT_INTERVAL_MS);
}

function clearChannelHeartbeat(sessionId: string): void {
  const timer = channelHeartbeatTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    channelHeartbeatTimers.delete(sessionId);
  }
}

function registerChannelSession(sessionId: string, target: ChannelReplyTarget, claim?: ChannelMessageClaim) {
  console.log("[channel-debug] registerChannelSession: sessionId=%s, provider=%s, conversationId=%s, externalMessageId=%s",
    sessionId, target.provider, target.rawConversationId, target.externalMessageId ?? "none");
  channelReplyTargets.set(sessionId, target);
  channelLatestAssistantText.delete(sessionId);
  larkWorkflowCardPermissions.delete(sessionId);
  larkWorkflowCardErrors.delete(sessionId);
  larkWorkflowCardActionNotices.delete(sessionId);
  channelLastSentReplySignature.delete(sessionId);
  if (claim) {
    const claims = channelMessageClaimsBySession.get(sessionId) ?? [];
    claims.push(claim);
    channelMessageClaimsBySession.set(sessionId, claims);
  }
  if (target.provider !== "lark") return;
  const generation = (channelProcessingReactionGenerations.get(sessionId) ?? 0) + 1;
  channelProcessingReactionGenerations.set(sessionId, generation);
  void (async () => {
    await clearChannelProcessingReaction(sessionId, false);
    if (!channelReplySender?.addReaction) return;
    try {
      const reactionId = await channelReplySender.addReaction(target, "GLANCE");
      if (channelProcessingReactionGenerations.get(sessionId) !== generation) {
        await channelReplySender.removeReaction?.(target, reactionId);
        return;
      }
      channelProcessingReactions.set(sessionId, { reactionId, target });
    } catch (error) {
      console.warn("[channel] Failed to add Lark processing reaction:", error);
    }
  })();
}

async function clearChannelProcessingReaction(sessionId: string, invalidatePending = true): Promise<void> {
  if (invalidatePending) {
    channelProcessingReactionGenerations.set(
      sessionId,
      (channelProcessingReactionGenerations.get(sessionId) ?? 0) + 1,
    );
  }
  const pending = channelProcessingReactions.get(sessionId);
  if (!pending) return;
  channelProcessingReactions.delete(sessionId);
  if (!channelReplySender?.removeReaction) return;
  try {
    await channelReplySender.removeReaction(pending.target, pending.reactionId);
  } catch (error) {
    console.warn("[channel] Failed to remove Lark processing reaction:", error);
  }
}

function finalizeChannelMessageClaims(sessionId: string, release: boolean): void {
  const claims = channelMessageClaimsBySession.get(sessionId);
  if (!claims) return;
  channelMessageClaimsBySession.delete(sessionId);
  if (!release) return;
  for (const claim of claims) {
    sessions.releaseChannelMessage(claim.messageId, claim.provider);
  }
}

function releaseChannelMessageClaim(sessionId: string, claim: ChannelMessageClaim | undefined): void {
  if (!claim) return;
  sessions.releaseChannelMessage(claim.messageId, claim.provider);
  const claims = channelMessageClaimsBySession.get(sessionId);
  if (!claims) return;
  const remaining = claims.filter((item) => item !== claim);
  if (remaining.length > 0) channelMessageClaimsBySession.set(sessionId, remaining);
  else channelMessageClaimsBySession.delete(sessionId);
}

function buildChannelSessionRouteKey(
  provider: string,
  workspaceId: string,
  conversationId: string,
): string {
  return `${provider.trim()}\0${workspaceId.trim()}\0${conversationId.trim()}`;
}

function getChannelEventWorkspaceIds(
  event: Extract<ClientEvent, { type: "channel.message.receive" }>,
): { workspaceId: string; conversationId: string } {
  return resolveChannelWorkspaceIds({
    provider: event.payload.provider,
    text: event.payload.text,
    externalConversationId: event.payload.externalConversationId,
    senderId: event.payload.senderId,
    channelName: event.payload.channelName,
  });
}

async function handleChannelMessageEventLocked(event: Extract<ClientEvent, { type: "channel.message.receive" }>) {
  const store = initializeSessions();
  const text = event.payload.text.trim();
  if (!text) {
    emit({
      type: "runner.error",
      payload: { message: "渠道消息为空，已忽略。" },
    });
    return;
  }

  const claim = event.payload.externalMessageId
    ? { messageId: event.payload.externalMessageId, provider: event.payload.provider }
    : undefined;

  const inboundMessage = {
    provider: event.payload.provider,
    text,
    externalConversationId: event.payload.externalConversationId,
    externalMessageId: event.payload.externalMessageId,
    senderId: event.payload.senderId,
    senderName: event.payload.senderName,
    channelName: event.payload.channelName,
    title: event.payload.title,
    receivedAt: event.payload.receivedAt,
  };
  const workspaceLocation = resolveChannelWorkspaceLocation(inboundMessage);
  const existingWorkspaceRoute = store.getChannelWorkspaceRoute(
    event.payload.provider,
    workspaceLocation.workspaceId,
  );
  const workspaceRoute = store.getOrCreateChannelWorkspaceRoute({
    provider: event.payload.provider,
    workspaceId: workspaceLocation.workspaceId,
    workspaceRoot: existingWorkspaceRoute?.workspaceRoot ?? workspaceLocation.root,
  });
  const workspace = ensureChannelWorkspace(inboundMessage, workspaceRoute.workspaceRoot);
  const adoptedLegacyConversationRoot = !existingWorkspaceRoute
    && workspaceLocation.adoptedLegacyConversationRoot
    && workspace.root === workspaceLocation.root;
  if (claim && !store.claimChannelMessage(claim.messageId, claim.provider)) {
    console.info(`[channel] Duplicate message skipped: provider=${claim.provider} message=${claim.messageId}`);
    return;
  }
  recordChannelInboundMessage(workspace, inboundMessage);
  const replyTarget = buildChannelReplyTarget({
    provider: event.payload.provider,
    text,
    externalConversationId: event.payload.externalConversationId,
    externalMessageId: event.payload.externalMessageId,
    senderId: event.payload.senderId,
    senderName: event.payload.senderName,
    channelName: event.payload.channelName,
  }, workspace);

  const CHANNEL_SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 小时

  let route = store.getChannelSessionRoute(
    event.payload.provider,
    workspace.workspaceId,
    workspace.conversationId,
  );
  if (!route && adoptedLegacyConversationRoot) {
    const legacySession = store
      .listSessions({ archived: false })
      .find((session) => session.cwd === workspace.root);
    if (legacySession) {
      route = store.setChannelSessionRoute({
        provider: event.payload.provider,
        workspaceId: workspace.workspaceId,
        conversationId: workspace.conversationId,
        workspaceRoot: workspace.root,
        sessionId: legacySession.id,
      });
    }
  }
  const existingSession = route?.workspaceRoot === workspace.root
    ? store.listSessions({ archived: false }).find((session) => session.id === route.sessionId)
    : undefined;

  const sessionExpired = existingSession
    ? Date.now() - existingSession.updatedAt > CHANNEL_SESSION_IDLE_TIMEOUT_MS
    : false;

  if (existingSession && sessionExpired) {
    console.log(
      `[channel] Session ${existingSession.id} idle >1h, opening new session for conversation ${workspace.conversationId}`
    );
  }

  if (!existingSession || sessionExpired) {
    const routeKey = buildChannelSessionRouteKey(
      event.payload.provider,
      workspace.workspaceId,
      workspace.conversationId,
    );
    pendingChannelReplyTargetsByConversation.set(routeKey, {
      target: replyTarget,
      claim,
      workspaceRoot: workspace.root,
    });
    try {
      await handleClientEvent({
        type: "session.start",
        payload: {
          title: buildChannelSessionTitle({
            provider: event.payload.provider,
            text,
            externalConversationId: event.payload.externalConversationId,
            senderName: event.payload.senderName,
            channelName: event.payload.channelName,
            title: event.payload.title,
          }, workspace),
          prompt: text,
          agentPrompt: buildChannelAgentPrompt(event.payload.provider, text),
          cwd: workspace.root,
          allowedTools: event.payload.allowedTools,
          attachments: event.payload.attachments,
          runtime: event.payload.runtime,
        },
      }, {
        promptOrigin: { kind: "channel", server: event.payload.provider },
        channelRoute: {
          provider: event.payload.provider,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
        },
      });
    } catch (error) {
      pendingChannelReplyTargetsByConversation.delete(routeKey);
      if (claim) store.releaseChannelMessage(claim.messageId, claim.provider);
      throw error;
    }
    if (!store.getChannelSessionRoute(
      event.payload.provider,
      workspace.workspaceId,
      workspace.conversationId,
    )) {
      pendingChannelReplyTargetsByConversation.delete(routeKey);
    }
    return;
  }

  if (event.payload.provider === "lark" && existingSession.status === "running") {
    const activeSession = store.getSession(existingSession.id);
    const pendingQuestion = [...(activeSession?.pendingPermissions.values() ?? [])]
      .find((pending) => pending.toolName === "AskUserQuestion");
    const updatedInput = pendingQuestion
      ? buildLarkAskUserQuestionAnsweredInput(pendingQuestion.input, text)
      : null;
    if (pendingQuestion && updatedInput) {
      if (!channelReplyTargets.has(existingSession.id)) {
        registerChannelSession(existingSession.id, replyTarget, claim);
      }
      larkWorkflowCardActionNotices.set(existingSession.id, "已收到回答，继续执行。");
      await handleClientEvent({
        type: "permission.response",
        payload: {
          sessionId: existingSession.id,
          toolUseId: pendingQuestion.toolUseId,
          result: { behavior: "allow", updatedInput },
        },
      });
      await syncLarkWorkflowCard(existingSession.id);
      return;
    }
  }

  registerChannelSession(existingSession.id, replyTarget, claim);

  if (existingSession.status === "running") {
    try {
      await handleClientEvent({
        type: "session.append",
        payload: {
          sessionId: existingSession.id,
          prompt: text,
          agentPrompt: buildChannelAgentPrompt(event.payload.provider, text),
          attachments: event.payload.attachments,
        },
      }, { promptOrigin: { kind: "channel", server: event.payload.provider } });
    } catch (error) {
      releaseChannelMessageClaim(existingSession.id, claim);
      throw error;
    }
    return;
  }

  try {
    await handleClientEvent({
      type: "session.continue",
      payload: {
        sessionId: existingSession.id,
        prompt: text,
        agentPrompt: buildChannelAgentPrompt(event.payload.provider, text),
        attachments: event.payload.attachments,
        runtime: event.payload.runtime,
      },
    }, { promptOrigin: { kind: "channel", server: event.payload.provider } });
  } catch (error) {
    releaseChannelMessageClaim(existingSession.id, claim);
    throw error;
  }
}

async function handleChannelMessageEvent(event: Extract<ClientEvent, { type: "channel.message.receive" }>) {
  const { workspaceId, conversationId } = getChannelEventWorkspaceIds(event);
  const routeKey = buildChannelSessionRouteKey(event.payload.provider, workspaceId, conversationId);
  const previous = channelMessageQueues.get(routeKey) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(() => handleChannelMessageEventLocked(event));
  channelMessageQueues.set(routeKey, queued);
  try {
    await queued;
  } finally {
    if (channelMessageQueues.get(routeKey) === queued) {
      channelMessageQueues.delete(routeKey);
    }
  }
}

function buildWorkflowRunResumePrompt(run: WorkflowRunRecord): string {
  const lines = [
    "请使用 Workflow tool 继续运行此 workflow，只继续这个 run，不要改写脚本内容：",
    "如果 Workflow tool 判定必须修复脚本才能继续，agent(...) 的长提示词必须使用 String.raw 或普通字符串包裹，避免提示词里的 `${id}`、`${agentId}` 等示例被 workflow.js 当成外层 JS 模板变量执行。",
    run.workflowName ? `- workflowName: ${run.workflowName}` : null,
    run.scriptPath ? `- scriptPath: ${run.scriptPath}` : null,
    `- resumeFromRunId: ${run.runId}`,
    `- taskId: ${run.taskId}`,
    run.summary ? `- previousSummary: ${run.summary}` : null,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

function buildWorkflowRunRerunPrompt(run: WorkflowRunRecord): string {
  const lines = [
    "请使用 Workflow tool 重新运行此 workflow 脚本，保留当前会话上下文并汇报新的 runId/taskId：",
    "复跑前如果需要修复脚本，agent(...) 的长提示词必须使用 String.raw 或普通字符串包裹，避免提示词里的 `${id}`、`${agentId}` 等示例被 workflow.js 当成外层 JS 模板变量执行。",
    run.workflowName ? `- workflowName: ${run.workflowName}` : null,
    `- scriptPath: ${run.scriptPath}`,
    run.summary ? `- previousSummary: ${run.summary}` : null,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

async function continueWorkflowRunFromPrompt(options: {
  sessionId: string;
  workflowRunId: string;
  mode: "resume" | "rerun";
}) {
  const store = initializeSessions();
  const session = store.getSession(options.sessionId);
  if (!session) {
    emit({ type: "session.deleted", payload: { sessionId: options.sessionId } });
    return;
  }

  const run = store.getWorkflowRun(options.workflowRunId);
  if (!run || run.sessionId !== options.sessionId) {
    emit({
      type: "runner.error",
      payload: { sessionId: options.sessionId, message: "Workflow run no longer exists." },
    });
    return;
  }

  if (options.mode === "resume") {
    if (!run.runId || run.taskType === "remote_agent") {
      emit({
        type: "runner.error",
        payload: { sessionId: options.sessionId, message: "这个 workflow run 没有可在当前会话恢复的本地 runId。" },
      });
      return;
    }
    if (run.status === "running" || run.status === "launching" || run.status === "backgrounded") {
      emit({
        type: "runner.error",
        payload: { sessionId: options.sessionId, message: "原 workflow run 仍在运行，需要结束后再恢复。" },
      });
      return;
    }
  }

  if (options.mode === "rerun" && !run.scriptPath) {
    emit({
      type: "runner.error",
      payload: { sessionId: options.sessionId, message: "这个 workflow run 没有可复跑的 scriptPath。" },
    });
    return;
  }

  await handleClientEvent({
    type: "session.continue",
    payload: {
      sessionId: options.sessionId,
      prompt: options.mode === "resume" ? buildWorkflowRunResumePrompt(run) : buildWorkflowRunRerunPrompt(run),
      runtime: {
        workflowMode: "force",
      },
    },
  });
}

export async function handleLarkCardAction(event: LarkCardActionEvent): Promise<void> {
  const accepted = larkWorkflowCardCoordinator.acceptAction(event);
  if (!accepted.ok) {
    console.warn(`[channel] Ignored Lark workflow card action: ${accepted.reason}`);
    return;
  }

  const action = event.action;
  let notice: string;
  if (action.action === "stop_session") {
    await handleClientEvent({ type: "session.stop", payload: { sessionId: action.sessionId } });
    notice = "流程停止请求已执行。";
  } else if (action.action === "stop_task" && action.taskId) {
    await handleClientEvent({
      type: "workflow.run.stop",
      payload: { sessionId: action.sessionId, taskId: action.taskId },
    });
    notice = "子任务停止请求已提交。";
  } else if (action.action === "rerun_run" && action.workflowRunId) {
    await handleClientEvent({
      type: "workflow.run.rerun",
      payload: { sessionId: action.sessionId, workflowRunId: action.workflowRunId },
    });
    notice = "重新执行请求已提交。";
  } else if (action.action === "resume_run" && action.workflowRunId) {
    await handleClientEvent({
      type: "workflow.run.resume",
      payload: { sessionId: action.sessionId, workflowRunId: action.workflowRunId },
    });
    notice = "继续执行请求已提交。";
  } else if (action.action === "question_answer" && action.toolUseId && action.answer) {
    const session = initializeSessions().getSession(action.sessionId);
    const pending = session?.pendingPermissions.get(action.toolUseId);
    const updatedInput = buildLarkAskUserQuestionOptionAnswerInput(pending?.input, action.answer);
    if (!pending || pending.toolName !== "AskUserQuestion" || !updatedInput) {
      console.warn("[channel] Ignored Lark question answer because it does not match the pending question");
      return;
    }
    larkWorkflowCardPermissions.delete(action.sessionId);
    await handleClientEvent({
      type: "permission.response",
      payload: {
        sessionId: action.sessionId,
        toolUseId: action.toolUseId,
        result: { behavior: "allow", updatedInput },
      },
    });
    notice = `已回答：${action.answer}`;
  } else if (
    (action.action === "permission_allow" || action.action === "permission_deny")
    && action.toolUseId
  ) {
    const session = initializeSessions().getSession(action.sessionId);
    const pending = session?.pendingPermissions.get(action.toolUseId);
    if (!pending) {
      console.warn("[channel] Ignored Lark permission action because the request is no longer pending");
      return;
    }
    larkWorkflowCardPermissions.delete(action.sessionId);
    await handleClientEvent({
      type: "permission.response",
      payload: {
        sessionId: action.sessionId,
        toolUseId: action.toolUseId,
        result: action.action === "permission_allow"
          ? {
              behavior: "allow",
              updatedInput: isRecord(pending.input) ? pending.input : { value: pending.input },
            }
          : { behavior: "deny", message: "User denied the request from the Lark workflow card" },
      },
    });
    notice = action.action === "permission_allow" ? "已允许一次，流程继续执行。" : "已拒绝本次工具调用。";
  } else {
    return;
  }

  larkWorkflowCardActionNotices.set(action.sessionId, notice);
  await syncLarkWorkflowCard(action.sessionId);

  const state = larkWorkflowCardCoordinator.getState(action.sessionId);
  const snapshot = buildLarkWorkflowCardSnapshot(action.sessionId);
  if (!state?.messageId || !snapshot || !channelReplySender?.updateWorkflowCardAfterAction) return;
  try {
    const card = buildLarkWorkflowCard({ ...snapshot, cardVersion: state.version });
    await channelReplySender.updateWorkflowCardAfterAction(event.callbackToken, card);
  } catch (error) {
    console.warn("[channel] Failed to acknowledge Lark workflow card action visually:", error);
  }
}

type ClientEventContext = {
  promptOrigin?: SDKMessageOrigin;
  toolPermissionPolicy?: ToolPermissionPolicy;
  channelRoute?: {
    provider: string;
    workspaceId: string;
    conversationId: string;
  };
};

export async function handleClientEvent(event: ClientEvent, context: ClientEventContext = {}) {
  const store = initializeSessions();

  if (event.type === "channel.message.receive") {
    await handleChannelMessageEvent(event);
    return;
  }

  if (event.type === "workflow.runs.list") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }
    emit({
      type: "workflow.runs",
      payload: {
        sessionId: event.payload.sessionId,
        runs: store.listWorkflowRuns(event.payload.sessionId),
      },
    });
    return;
  }

  if (event.type === "workflow.run.resume") {
    await continueWorkflowRunFromPrompt({
      sessionId: event.payload.sessionId,
      workflowRunId: event.payload.workflowRunId,
      mode: "resume",
    });
    return;
  }

  if (event.type === "workflow.run.rerun") {
    await continueWorkflowRunFromPrompt({
      sessionId: event.payload.sessionId,
      workflowRunId: event.payload.workflowRunId,
      mode: "rerun",
    });
    return;
  }

  if (event.type === "workflow.run.stop") {
    const handle = runnerHandles.get(event.payload.sessionId);
    if (!handle || handle.isClosed()) {
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: "当前没有可控制的 workflow runner。" },
      });
      return;
    }
    try {
      await handle.stopTask(event.payload.taskId);
    } catch (error) {
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: `停止 workflow task 失败: ${String(error)}` },
      });
    }
    return;
  }

  if (event.type === "session.list") {
    const archived = Boolean(event.payload?.archived);
    const limit = typeof event.payload?.limit === "number" ? event.payload.limit : undefined;
    emit({
      type: "session.list",
      payload: { sessions: listStoredSessionsForRenderer(archived, { limit }), archived },
    });
    return;
  }

  if (event.type === "session.archive") {
    closeRunnerHandle(event.payload.sessionId);
    const session = store.archiveSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }
    emit({
      type: "session.archived",
      payload: {
        sessionId: session.id,
        session: {
          ...session,
          slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
        },
      },
    });
    return;
  }

  if (event.type === "session.unarchive") {
    const session = store.unarchiveSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }
    emit({
      type: "session.unarchived",
      payload: {
        sessionId: session.id,
        session: {
          ...session,
          slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
        },
      },
    });
    return;
  }

  if (event.type === "session.rename") {
    const title = event.payload.title.trim();
    if (!title) {
      return;
    }
    const session = store.updateSession(event.payload.sessionId, { title });
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }
    emit({
      type: "session.renamed",
      payload: {
        sessionId: session.id,
        title: session.title,
        updatedAt: Date.now(),
      },
    });
    return;
  }

  if (event.type === "session.history") {
    const history = store.getSessionHistoryPage(event.payload.sessionId, {
      before: event.payload.before,
      limit: event.payload.limit,
    });
    if (!history) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }

    const displayMessages = await hydrateImagePreviewsForDisplay(history.messages);
    emit({
      type: "session.history",
      payload: {
        sessionId: history.session.id,
        status: history.session.status,
        messages: displayMessages,
        mode: event.payload.before ? "prepend" : "replace",
        hasMore: history.hasMore,
        nextCursor: history.nextCursor,
        slashCommands: buildSessionSlashCommands({
          cwd: history.session.cwd,
          messages: displayMessages,
        }),
      },
    });
    if (!event.payload.before) {
      const activeSession = store.getSession(history.session.id);
      for (const pending of activeSession?.pendingPermissions.values() ?? []) {
        emit({
          type: "permission.request",
          payload: {
            sessionId: history.session.id,
            toolUseId: pending.toolUseId,
            toolName: pending.toolName,
            input: pending.input,
            ...pending.metadata,
          },
        });
      }
    }
    return;
  }

  if (event.type === "session.workflow.catalog.list") {
    const history = store.getSessionHistoryPage(event.payload.sessionId, { limit: 80 });
    if (!history) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }

    emit({
      type: "session.workflow.catalog",
      payload: buildSessionWorkflowCatalog({
        sessionId: history.session.id,
        cwd: history.session.cwd,
        messages: history.messages,
      }),
    });
    return;
  }

  if (event.type === "session.workflow.set") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: "Session no longer exists." },
      });
      return;
    }

    const parsed = parseWorkflowMarkdown(event.payload.markdown);
    if (!parsed.ok || !parsed.document) {
      const errorMessage = parsed.errors.map((item) => item.message).join("；") || "工作流 Markdown 解析失败。";
      store.updateSession(session.id, {
        workflowMarkdown: event.payload.markdown,
        workflowSourceLayer: event.payload.sourceLayer,
        workflowSourcePath: event.payload.sourcePath,
        workflowState: undefined,
        workflowError: errorMessage,
      });
      emit({
        type: "session.workflow",
        payload: {
          sessionId: session.id,
          markdown: event.payload.markdown,
          sourceLayer: event.payload.sourceLayer,
          sourcePath: event.payload.sourcePath,
          error: errorMessage,
        },
      });
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message: errorMessage },
      });
      return;
    }

    const workflowState = createInitialSessionWorkflowState(
      parsed.document,
      event.payload.sourceLayer,
      event.payload.sourcePath,
    );

    store.updateSession(session.id, {
      workflowMarkdown: event.payload.markdown,
      workflowSourceLayer: event.payload.sourceLayer,
      workflowSourcePath: event.payload.sourcePath,
      workflowState,
      workflowError: undefined,
    });

    emit({
      type: "session.workflow",
      payload: {
        sessionId: session.id,
        markdown: event.payload.markdown,
        sourceLayer: event.payload.sourceLayer,
        sourcePath: event.payload.sourcePath,
        state: workflowState,
      },
    });
    return;
  }

  if (event.type === "session.workflow.clear") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      return;
    }

    store.updateSession(session.id, {
      workflowMarkdown: undefined,
      workflowSourceLayer: undefined,
      workflowSourcePath: undefined,
      workflowState: undefined,
      workflowError: undefined,
    });

    emit({
      type: "session.workflow",
      payload: {
        sessionId: session.id,
      },
    });
    return;
  }

  if (event.type === "btw.thread.create") {
    const parentSession = store.getSession(event.payload.parentSessionId);
    const parentHistory = store.getSessionHistoryPage(event.payload.parentSessionId, { limit: CONTINUATION_HISTORY_LIMIT });
    if (!parentSession || !parentHistory) return;
    btwRuntimeManager.createThread({
      parentSession,
      snapshot: parentHistory.messages,
    });
    return;
  }

  if (event.type === "btw.thread.send") {
    const { displayAttachments, agentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
    await btwRuntimeManager.send({
      threadId: event.payload.threadId,
      prompt: event.payload.prompt,
      agentPrompt: event.payload.agentPrompt,
      workspaceContext: event.payload.workspaceContext,
      attachments: agentAttachments,
      displayAttachments,
      runtime: event.payload.runtime,
    });
    return;
  }

  if (event.type === "btw.thread.stop") {
    btwRuntimeManager.stop(event.payload.threadId);
    return;
  }

  if (event.type === "btw.thread.permission.response") {
    btwRuntimeManager.respondPermission(event.payload.threadId, event.payload.toolUseId, event.payload.result);
    return;
  }

  if (event.type === "btw.thread.close") {
    btwRuntimeManager.closeThread(event.payload.threadId);
    return;
  }

  if (event.type === "btw.parent.close_all") {
    btwRuntimeManager.closeParent(event.payload.parentSessionId);
    return;
  }

  if (event.type === "session.create") {
    const session = store.createSession({
      cwd: event.payload.cwd,
      title: event.payload.title || "新聊天",
      allowedTools: event.payload.allowedTools,
    });

    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "idle",
        title: session.title,
        cwd: session.cwd,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });
    return;
  }

  if (event.type === "session.fork") {
    try {
      const result = await forkStoredSession({
        store,
        sourceSessionId: event.payload.sessionId,
        upToMessageId: event.payload.upToMessageId,
        title: event.payload.title,
      });
      emit({
        type: "session.status",
        payload: {
          sessionId: result.session.id,
          status: "idle",
          title: result.session.title,
          cwd: result.session.cwd,
          model: result.session.model,
          configProfileId: result.session.configProfileId,
          executionMode: result.session.executionMode,
          reasoningMode: result.session.reasoningMode,
          permissionMode: result.session.permissionMode,
          slashCommands: buildSessionSlashCommands({ cwd: result.session.cwd }),
        },
      });
      emit({
        type: "session.history",
        payload: {
          sessionId: result.session.id,
          status: "idle",
          messages: result.messages,
          mode: "replace",
          hasMore: false,
          slashCommands: buildSessionSlashCommands({ cwd: result.session.cwd }),
        },
      });
    } catch (error) {
      emit({
        type: "runner.error",
        payload: {
          sessionId: event.payload.sessionId,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return;
  }

  if (event.type === "session.start") {
    const displayPrompt = event.payload.prompt;
    const agentPrompt = event.payload.agentPrompt?.trim() ? event.payload.agentPrompt : displayPrompt;
    const { displayAttachments, agentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
    const config = getCurrentApiConfig();
    const requestedModel = event.payload.runtime?.model?.trim() || config?.model;
    const requestedConfigProfileId = event.payload.runtime?.configProfileId?.trim();
    const resolvedRoute = resolveApiConfigForModel(requestedModel, requestedConfigProfileId);
    const selectedModel = resolvedRoute?.model ?? requestedModel;
    const selectedConfigProfileId = resolvedRoute?.config.id ?? requestedConfigProfileId;
    const selectedExecutionMode = event.payload.runtime?.executionMode ?? "foreground";
    const selectedReasoningMode = event.payload.runtime?.reasoningMode;
    const selectedPermissionMode = normalizeReleasePermissionMode(event.payload.runtime?.permissionMode);
    const session = store.createSession({
      cwd: event.payload.cwd,
      title: event.payload.title,
      executionMode: selectedExecutionMode,
      reasoningMode: selectedReasoningMode,
      permissionMode: selectedPermissionMode,
      runSurface: event.payload.runtime?.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId,
      model: selectedModel,
      configProfileId: selectedConfigProfileId,
      allowedTools: event.payload.allowedTools,
      prompt: displayPrompt,
    });

    const pendingChannelKey = context.channelRoute
      ? buildChannelSessionRouteKey(
        context.channelRoute.provider,
        context.channelRoute.workspaceId,
        context.channelRoute.conversationId,
      )
      : undefined;
    const pendingChannel = pendingChannelKey
      ? pendingChannelReplyTargetsByConversation.get(pendingChannelKey)
      : undefined;
    if (pendingChannel && pendingChannelKey && context.channelRoute) {
      pendingChannelReplyTargetsByConversation.delete(pendingChannelKey);
      store.setChannelSessionRoute({
        provider: context.channelRoute.provider,
        workspaceId: context.channelRoute.workspaceId,
        conversationId: context.channelRoute.conversationId,
        workspaceRoot: pendingChannel.workspaceRoot,
        sessionId: session.id,
      });
      registerChannelSession(session.id, pendingChannel.target, pendingChannel.claim);
    }

    store.updateSession(session.id, {
      status: "running",
      executionMode: selectedExecutionMode,
      reasoningMode: selectedReasoningMode,
      permissionMode: selectedPermissionMode,
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
      model: selectedModel,
      configProfileId: selectedConfigProfileId,
      lastPrompt: displayPrompt,
    });

    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "running",
        title: session.title,
        cwd: session.cwd,
        model: selectedModel,
        configProfileId: selectedConfigProfileId,
        executionMode: selectedExecutionMode,
        reasoningMode: selectedReasoningMode,
        permissionMode: selectedPermissionMode,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "start",
          prompt: displayPrompt,
          attachments: agentAttachments,
          session,
          model: selectedModel,
        }),
      },
    });

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: displayPrompt, attachments: displayAttachments },
    });

    const nextExecutionMode = event.payload.runtime?.executionMode ?? session.executionMode ?? "foreground";
    const nextReasoningMode = event.payload.runtime?.reasoningMode ?? session.reasoningMode;
    const nextPermissionMode = normalizeReleasePermissionMode(event.payload.runtime?.permissionMode ?? session.permissionMode);
    const runnerRuntime = {
      ...(event.payload.runtime ?? {}),
      executionMode: nextExecutionMode,
      reasoningMode: nextReasoningMode,
      permissionMode: nextPermissionMode,
      model: selectedModel,
      configProfileId: selectedConfigProfileId,
    };
    const reuseKey = buildSessionRunnerReuseKey({
      session,
      model: selectedModel,
      runtime: runnerRuntime,
      prompt: agentPrompt,
      attachments: agentAttachments,
      toolPermissionPolicy: context.toolPermissionPolicy,
    });

    runClaude({
      prompt: agentPrompt,
      promptOrigin: context.promptOrigin ?? { kind: "human" },
      toolPermissionPolicy: context.toolPermissionPolicy,
      displayPrompt,
      workspaceContext: event.payload.workspaceContext,
      attachments: agentAttachments,
      runtime: runnerRuntime,
      session,
      resumeSessionId: session.claudeSessionId,
      onEvent: emit,
      onSessionUpdate: (updates) => {
        store.updateSession(session.id, updates);
      },
    })
      .then((handle) => {
        rememberRunnerHandle(session.id, handle, reuseKey);
        store.setAbortController(session.id, undefined);
      })
      .catch((error) => {
        store.updateSession(session.id, { status: "error" });
        emit({
          type: "session.status",
          payload: {
            sessionId: session.id,
            status: "error",
            title: session.title,
            cwd: session.cwd,
            model: session.model,
            error: String(error),
          },
        });
      });

    return;
  }

  if (event.type === "session.continue") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: "Session no longer exists." },
      });
      return;
    }

    const defaultConfig = getCurrentApiConfig();
    const displayPrompt = event.payload.prompt;
    const agentPrompt = event.payload.agentPrompt?.trim() ? event.payload.agentPrompt : displayPrompt;
    const storagePrompt = redactFigmaMcpOAuthCallbackPrompt(displayPrompt);
    const isFigmaOAuthCallback = isFigmaMcpOAuthCallbackPrompt(displayPrompt);
    const { displayAttachments, agentAttachments: currentAgentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
    const replacingHistoryId = event.payload.replaceHistoryId?.trim();

    if (replacingHistoryId) {
      const replaced = store.replaceUserPromptAndPrune(session.id, replacingHistoryId, storagePrompt, displayAttachments);
      if (!replaced) {
        emit({
          type: "runner.error",
          payload: { sessionId: session.id, message: "要修改的用户消息不存在或不能修改。" },
        });
        return;
      }

      const replacedHistory = store.getSessionHistoryPage(session.id);
      if (replacedHistory) {
        const displayMessages = await hydrateImagePreviewsForDisplay(replacedHistory.messages);
        emit({
          type: "session.history",
          payload: {
            sessionId: session.id,
            status: replacedHistory.session.status,
            messages: displayMessages,
            mode: "replace",
            hasMore: replacedHistory.hasMore,
            nextCursor: replacedHistory.nextCursor,
            slashCommands: buildSessionSlashCommands({
              cwd: replacedHistory.session.cwd,
              messages: displayMessages,
            }),
          },
        });
      }
    }

    const history = store.getSessionHistoryPage(session.id, { limit: CONTINUATION_HISTORY_LIMIT });
    const historyMessagesForRun = replacingHistoryId
      ? (history?.messages ?? []).filter((message) => message.historyId !== replacingHistoryId)
      : history?.messages ?? [];
    const hasConversationContent = (history?.messages ?? []).some((message) => (
      message.type === "user_prompt"
      || message.type === "user"
      || message.type === "assistant"
      || message.type === "result"
    ));
    const shouldRetitleFromFirstPrompt = isPlaceholderSessionTitle(session.title) && !hasConversationContent;
    const nextTitle = shouldRetitleFromFirstPrompt
      ? buildTitleFromFirstPrompt(storagePrompt, event.payload.attachments)
      : session.title;
    const requestedModel =
      event.payload.runtime?.model?.trim()
      || session.model
      || resolveLatestMessageModel(history?.messages)
      || defaultConfig?.model;
    const requestedConfigProfileId = event.payload.runtime?.configProfileId?.trim() || session.configProfileId;
    const resolvedRoute = resolveApiConfigForModel(requestedModel, requestedConfigProfileId);
    const selectedModel = resolvedRoute?.model ?? requestedModel;
    const selectedConfigProfileId = resolvedRoute?.config.id ?? requestedConfigProfileId;
    const config = resolvedRoute?.config ?? defaultConfig;
    const previousModel = resolveLatestMessageModel(history?.messages) || session.model || defaultConfig?.model;
    const modelConfig = config && selectedModel ? getModelConfig(config, selectedModel) : null;
    const nextExecutionMode = event.payload.runtime?.executionMode ?? session.executionMode ?? "foreground";
    const nextReasoningMode = event.payload.runtime?.reasoningMode ?? session.reasoningMode;
    const nextPermissionMode = normalizeReleasePermissionMode(event.payload.runtime?.permissionMode ?? session.permissionMode);
    const runnerRuntime = {
      ...(event.payload.runtime ?? {}),
      executionMode: nextExecutionMode,
      reasoningMode: nextReasoningMode,
      permissionMode: nextPermissionMode,
      model: selectedModel,
      configProfileId: selectedConfigProfileId,
    };
    if (runnerHandles.has(session.id)) {
      closeRunnerHandle(session.id);
    }
    const supportsResume = config ? supportsRemoteSessionResume(config) : true;
    const canUseFigmaOAuthCallbackResume =
      FIGMA_AGENT_OAUTH_BRIDGE_ENABLED && isFigmaOAuthCallback && Boolean(session.claudeSessionId);
    const switchedModel = Boolean(
      selectedModel
      && previousModel
      && selectedModel.trim() !== previousModel.trim(),
    );
    const providerResumeBlockedByEmptySuccess = shouldBypassProviderResumeAfterEmptySuccess(historyMessagesForRun);
    const canUseRemoteResume = Boolean(session.claudeSessionId)
      && (supportsResume || canUseFigmaOAuthCallbackResume)
      && !switchedModel
      && !replacingHistoryId
      && !providerResumeBlockedByEmptySuccess;
    const thinResumePrompt = isFigmaOAuthCallback ? storagePrompt : agentPrompt;
    const continuationPayload = canUseRemoteResume
      ? null
      : buildStatelessContinuationPayload(
          historyMessagesForRun,
          thinResumePrompt,
          currentAgentAttachments,
          {
            contextWindow: modelConfig?.contextWindow,
            compressionThresholdPercent: modelConfig?.compressionThresholdPercent,
            recentTurnCount: 5,
            existingSummary: history?.session.continuationSummary,
            existingSummaryMessageCount: history?.session.continuationSummaryMessageCount,
            forceCompression: history?.hasMore,
            historyMessageCount: history?.totalMessages,
          },
        );
    const prompt = canUseRemoteResume
      ? thinResumePrompt
      : continuationPayload?.prompt ?? thinResumePrompt;
    const resumeSessionId = canUseRemoteResume
      ? session.claudeSessionId
      : undefined;
    const rehydratedAttachments = shouldRehydrateRecentImages(displayPrompt, displayAttachments)
      ? await loadRecentReferencedImages(history?.messages ?? [])
      : [];
    const attachmentsForRun = [...currentAgentAttachments, ...rehydratedAttachments];

    store.updateSession(session.id, {
      status: "running",
      title: nextTitle,
      executionMode: nextExecutionMode,
      reasoningMode: nextReasoningMode,
      permissionMode: nextPermissionMode,
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
      model: selectedModel,
      configProfileId: selectedConfigProfileId,
      lastPrompt: storagePrompt,
      continuationSummary: canUseRemoteResume
        ? session.continuationSummary
        : continuationPayload?.usedCompression
          ? continuationPayload.summaryText
          : undefined,
      continuationSummaryMessageCount: canUseRemoteResume
        ? session.continuationSummaryMessageCount
        : continuationPayload?.usedCompression
          ? continuationPayload.summaryMessageCount
          : undefined,
    });
    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "running",
        title: nextTitle,
        cwd: session.cwd,
        model: selectedModel,
        configProfileId: selectedConfigProfileId,
        executionMode: nextExecutionMode,
        reasoningMode: nextReasoningMode,
        permissionMode: nextPermissionMode,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });
    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "continue",
          prompt: storagePrompt,
          attachments: attachmentsForRun,
          session,
          historyMessages: canUseRemoteResume || continuationPayload?.usedCompression
            ? []
            : historyMessagesForRun,
          model: selectedModel,
          continuationSummary: continuationPayload?.summaryText,
        }),
      },
    });
    if (event.payload.displayUserPrompt !== false) {
      emit({
        type: "stream.user_prompt",
        payload: { sessionId: session.id, prompt: storagePrompt, attachments: displayAttachments },
      });
    }

    runClaude({
      prompt,
      promptOrigin: context.promptOrigin ?? { kind: "human" },
      toolPermissionPolicy: context.toolPermissionPolicy,
      displayPrompt: storagePrompt,
      workspaceContext: event.payload.workspaceContext,
      attachments: attachmentsForRun,
      runtime: runnerRuntime,
      session,
      resumeSessionId,
      onEvent: emit,
      onSessionUpdate: (updates) => {
        store.updateSession(session.id, updates);
      },
    })
      .then((handle) => {
        const coldReuseKey = buildSessionRunnerReuseKey({
          session,
          model: selectedModel,
          runtime: runnerRuntime,
          prompt,
          attachments: attachmentsForRun,
          toolPermissionPolicy: context.toolPermissionPolicy,
        });
        rememberRunnerHandle(session.id, handle, coldReuseKey);
      })
      .catch((error) => {
        store.updateSession(session.id, { status: "error" });
        emit({
          type: "session.status",
          payload: {
            sessionId: session.id,
            status: "error",
            title: session.title,
            cwd: session.cwd,
            model: session.model,
            error: String(error),
          },
        });
      });
    return;
    /* Legacy session.continue append path removed:
    const shouldAppendToActiveWorkflowRunner =
      !isFigmaOAuthCallback
      && !replacingHistoryId
      && !shouldForceStatelessCompression
      && Boolean(liveHandle)
      && !liveHandle?.isClosed()
      && hasActiveWorkflowRun(session.id);
    if (shouldAppendToActiveWorkflowRunner && liveHandle && !liveHandle.isClosed()) {
      store.updateSession(session.id, {
        status: "running",
        lastPrompt: storagePrompt,
      });
      emit({
        type: "session.status",
        payload: {
          sessionId: session.id,
          status: "running",
          title: session.title,
          cwd: session.cwd,
          model: session.model,
          executionMode: session.executionMode,
          reasoningMode: session.reasoningMode,
          permissionMode: session.permissionMode,
          slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
        },
      });
      emit({
        type: "stream.message",
        payload: {
          sessionId: session.id,
          message: buildPromptLedgerForRun({
            phase: "continue",
            prompt: storagePrompt,
            attachments: currentAgentAttachments,
            session,
            historyMessages: [],
            model: session.model,
          }),
        },
      });
      if (event.payload.displayUserPrompt !== false) {
        emit({
          type: "stream.user_prompt",
          payload: { sessionId: session.id, prompt: storagePrompt, attachments: displayAttachments },
        });
      }

      try {
        await liveHandle.appendPrompt(agentPrompt, currentAgentAttachments, {
          displayPrompt: storagePrompt,
          workspaceContext: event.payload.workspaceContext,
        });
      } catch (error) {
        emit({
          type: "runner.error",
          payload: { sessionId: session.id, message: `插入进度追问失败: ${String(error)}` },
        });
      }
      return;
    }
    */
    /* Legacy session.continue remote-resume path removed:
    if (runnerHandles.has(session.id)) {
      closeRunnerHandle(session.id);
    }
    const continuationPayload = canUseRemoteResume
      ? null
      : buildStatelessContinuationPayload(
          historyMessagesForRun,
          isFigmaOAuthCallback ? storagePrompt : agentPrompt,
          currentAgentAttachments,
          {
            contextWindow: modelConfig?.contextWindow,
            compressionThresholdPercent: modelConfig?.compressionThresholdPercent,
            recentTurnCount: 5,
            existingSummary: history?.session.continuationSummary,
            existingSummaryMessageCount: history?.session.continuationSummaryMessageCount,
          },
        );
    const prompt = canUseRemoteResume ? agentPrompt : continuationPayload?.prompt ?? agentPrompt;
    const resumeSessionId = canUseRemoteResume ? session.claudeSessionId : undefined;
    const rehydratedAttachments = shouldRehydrateRecentImages(displayPrompt, displayAttachments)
      ? await loadRecentReferencedImages(history?.messages ?? [])
      : [];
    const attachmentsForRun = [...currentAgentAttachments, ...rehydratedAttachments];

    store.updateSession(session.id, {
      status: "running",
      title: nextTitle,
      executionMode: nextExecutionMode,
      reasoningMode: nextReasoningMode,
      permissionMode: nextPermissionMode,
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
      model: selectedModel,
      lastPrompt: storagePrompt,
      continuationSummary: continuationPayload?.usedCompression ? continuationPayload.summaryText : undefined,
      continuationSummaryMessageCount: continuationPayload?.usedCompression
        ? continuationPayload.summaryMessageCount
        : undefined,
    });
    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "running",
        title: nextTitle,
        cwd: session.cwd,
        model: selectedModel,
        executionMode: nextExecutionMode,
        reasoningMode: nextReasoningMode,
        permissionMode: nextPermissionMode,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "continue",
          prompt: storagePrompt,
          attachments: attachmentsForRun,
          session,
          historyMessages: canUseRemoteResume || !continuationPayload?.usedCompression ? historyMessagesForRun : [],
          model: selectedModel,
          continuationSummary: continuationPayload?.summaryText,
        }),
      },
    });

    if (event.payload.displayUserPrompt !== false) {
      emit({
        type: "stream.user_prompt",
        payload: { sessionId: session.id, prompt: storagePrompt, attachments: displayAttachments },
      });
    }

    runClaude({
      prompt,
      promptOrigin: context.promptOrigin ?? { kind: "human" },
      toolPermissionPolicy: context.toolPermissionPolicy,
      displayPrompt: storagePrompt,
      workspaceContext: event.payload.workspaceContext,
      attachments: attachmentsForRun,
      runtime: runnerRuntime,
      session,
      resumeSessionId,
      onEvent: emit,
      onSessionUpdate: (updates) => {
        store.updateSession(session.id, updates);
      },
    })
      .then((handle) => {
        const coldReuseKey = buildSessionRunnerReuseKey({
          session,
          model: selectedModel,
          runtime: runnerRuntime,
          prompt,
          attachments: attachmentsForRun,
          toolPermissionPolicy: context.toolPermissionPolicy,
        });
        rememberRunnerHandle(session.id, handle, coldReuseKey);
      })
      .catch((error) => {
        store.updateSession(session.id, { status: "error" });
        emit({
          type: "session.status",
          payload: {
            sessionId: session.id,
            status: "error",
            title: session.title,
            cwd: session.cwd,
            model: session.model,
            error: String(error),
          },
        });
      });

    return;
  }

  if (event.type === "session.set_model") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: "Session no longer exists." },
      });
      return;
    }

    const requestedModel = event.payload.model.trim();
    const selectedModel = resolveApiConfigForModel(requestedModel)?.model ?? requestedModel;
    if (!selectedModel) {
      return;
    }

    store.updateSession(session.id, { model: selectedModel });
    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: session.status,
        title: session.title,
        cwd: session.cwd,
        model: selectedModel,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });
    return;
    */
  }

  if (event.type === "session.set_model") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: "Session no longer exists." },
      });
      return;
    }

    const requestedModel = event.payload.model.trim();
    const requestedConfigProfileId = event.payload.configProfileId?.trim();
    const resolvedRoute = resolveApiConfigForModel(requestedModel, requestedConfigProfileId);
    const selectedModel = resolvedRoute?.model ?? requestedModel;
    const selectedConfigProfileId = resolvedRoute?.config.id ?? requestedConfigProfileId;
    if (!selectedModel) return;

    store.updateSession(session.id, {
      model: selectedModel,
      configProfileId: selectedConfigProfileId,
    });
    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: session.status,
        title: session.title,
        cwd: session.cwd,
        model: selectedModel,
        configProfileId: selectedConfigProfileId,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });
    return;
  }

  if (event.type === "session.append") {
    const appendRequestId = event.payload.requestId?.trim();
    const emitAppendResult = (success: boolean, error?: string) => {
      if (!appendRequestId) return;
      emit({
        type: "session.append.result",
        payload: {
          sessionId: event.payload.sessionId,
          requestId: appendRequestId,
          success,
          error,
        },
      });
    };
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      const message = "Session no longer exists.";
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      emitAppendResult(false, message);
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message },
      });
      return;
    }

    if (session.status !== "running") {
      const message = "当前会话没有正在执行的任务，不能插入补充指令。";
      emitAppendResult(false, message);
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message },
      });
      return;
    }

    const handle = runnerHandles.get(session.id);
    if (!handle || handle.isClosed()) {
      const message = "当前执行器还未就绪，稍后再插入补充指令。";
      emitAppendResult(false, message);
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message },
      });
      return;
    }

    const displayPrompt = event.payload.prompt;
    const agentPrompt = event.payload.agentPrompt?.trim() ? event.payload.agentPrompt : displayPrompt;

    try {
      const preparedAttachmentsPromise = preparePromptAttachmentsForSession(event.payload.attachments);
      const appendPromptPromise = handle.appendPrompt(
        agentPrompt,
        preparedAttachmentsPromise.then(({ agentAttachments }) => agentAttachments),
        { origin: context.promptOrigin ?? { kind: "human" } },
      );
      const [{ displayAttachments }] = await Promise.all([preparedAttachmentsPromise, appendPromptPromise]);
      store.updateSession(session.id, { lastPrompt: displayPrompt });
      emit({
        type: "stream.user_prompt",
        payload: { sessionId: session.id, prompt: displayPrompt, attachments: displayAttachments },
      });
      emitAppendResult(true);
    } catch (error) {
      const message = `插入补充指令失败：${String(error)}`;
      emitAppendResult(false, message);
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message },
      });
    }
    return;
  }

  if (event.type === "session.stop") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) return;

    closeRunnerHandle(session.id);

    store.updateSession(session.id, { status: "idle" });
    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "idle",
        title: session.title,
        cwd: session.cwd,
        model: session.model,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });
    return;
  }

  if (event.type === "session.delete") {
    const sessionId = event.payload.sessionId;
    btwRuntimeManager.closeParent(sessionId);
    closeRunnerHandle(sessionId);
    workflowToolUseNamesBySession.delete(sessionId);
    workflowTaskIdsBySession.delete(sessionId);
    larkWorkflowCardPermissions.delete(sessionId);
    larkWorkflowCardErrors.delete(sessionId);
    larkWorkflowCardActionNotices.delete(sessionId);
    larkWorkflowCardCoordinator.forget(sessionId);

    store.deleteSession(sessionId);
    emit({
      type: "session.deleted",
      payload: { sessionId },
    });
    return;
  }

  if (event.type === "permission.response") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) return;

    const pending = session.pendingPermissions.get(event.payload.toolUseId);
    if (pending) {
      pending.resolve(event.payload.result);
    }
    emit({
      type: "permission.resolved",
      payload: {
        sessionId: event.payload.sessionId,
        toolUseId: event.payload.toolUseId,
      },
    });
    larkWorkflowCardPermissions.delete(event.payload.sessionId);
    void syncLarkWorkflowCard(event.payload.sessionId);
    return;
  }

  if (event.type === "agent.list") {
    emit({ type: "agent.list", payload: { agents: listAvailableClaudeAgents({ cwd: event.payload.cwd }) } });
    return;
  }

  // MCP server list
  if (event.type === "mcp.list") {
    const config = loadGlobalRuntimeConfig();

    const builtin = listBuiltinMcpServerInfos(resolveEnabledBuiltinMcpServerNames(config));
    const external = listExternalMcpServerInfos(config);

    emit({ type: "mcp.list", payload: { builtin, external } });
    return;
  }

  if (event.type === "mcp.builtin.setEnabled") {
    const serverName = event.payload.name;
    if (!isBuiltinMcpServerName(serverName)) {
      emit({ type: "runner.error", payload: { message: `Unknown built-in MCP server: ${String(serverName)}` } });
      return;
    }

    const nextConfig = buildNextBuiltinMcpServerEnabledConfig(
      loadGlobalRuntimeConfig(),
      serverName,
      Boolean(event.payload.enabled),
    );
    saveGlobalRuntimeConfig(nextConfig);

    const builtin = listBuiltinMcpServerInfos(resolveEnabledBuiltinMcpServerNames(nextConfig));
    const external = listExternalMcpServerInfos(nextConfig);
    emit({ type: "mcp.list", payload: { builtin, external } });
    return;
  }

  // Task system handlers
  if (event.type === "task.list") {
    const filter = event.payload?.filter as TaskFilter | undefined;
    const tasks = taskExecutor?.listTasks(filter) ?? [];
    emit({
      type: "task.list",
      payload: { tasks },
    } as ServerEvent);
    return;
  }

  if (event.type === "task.sync") {
    void taskExecutor?.syncProvider(event.payload.provider as TaskProviderId);
    return;
  }

  if (event.type === "task.execute") {
    void taskExecutor?.triggerExecution(event.payload.taskId, event.payload.options as TaskExecutionOptions | undefined);
    return;
  }

  if (event.type === "task.control") {
    taskExecutor?.controlTask(event.payload.taskId, event.payload.action);
    return;
  }

  if (event.type === "task.delete") {
    taskExecutor?.deleteTask(event.payload.taskId);
    return;
  }

  if (event.type === "task.markStatus") {
    void taskExecutor?.markTaskStatus(event.payload.taskId, event.payload.status as "pending" | "in_progress" | "done" | "cancelled");
    return;
  }

  if (event.type === "task.settings.get") {
    const settings = taskExecutor?.getSettings();
    if (settings) {
      emit({
        type: "task.settings",
        payload: { settings },
      } as ServerEvent);
    }
    return;
  }

  if (event.type === "task.settings.update") {
    const settings = taskExecutor?.updateSettings(event.payload.settings);
    if (settings) {
      emit({
        type: "task.settings",
        payload: { settings },
      } as ServerEvent);
    }
    return;
  }

  if (event.type === "task.providers") {
    void taskExecutor?.getProviderStates().then((providers) => {
      emit({
        type: "task.providers",
        payload: { providers },
      } as ServerEvent);
    });
    return;
  }

  if (event.type === "task.stats") {
    const stats = taskExecutor?.getStats();
    if (stats) {
      emit({
        type: "task.stats",
        payload: { stats },
      } as ServerEvent);
    }
    return;
  }

  if (event.type === "task.execution.logs") {
    const executionTaskId = event.payload.taskId;
    const bundle = taskExecutor?.getExecutionBundle(executionTaskId) ?? {
      taskId: executionTaskId,
      executions: [],
      logs: [],
      subtasks: [],
      artifacts: [],
    };
    emit({
      type: "task.execution.list",
      payload: bundle,
    } as ServerEvent);
    return;
  }

  // Note CRUD handlers
  if (event.type === "note.list") {
    const notes = noteRepo?.list() ?? [];
    emit({ type: "note.list", payload: { notes } } as ServerEvent);
    return;
  }

  if (event.type === "note.create") {
    if (!noteRepo) {
      emit({ type: "note.error", payload: { message: "Note repository not initialized" } } as ServerEvent);
      return;
    }
    const note = noteRepo.create(event.payload);
    emit({ type: "note.created", payload: { note } } as ServerEvent);
    return;
  }

  if (event.type === "note.get") {
    const note = noteRepo?.get(event.payload.noteId);
    if (note) {
      emit({ type: "note.list", payload: { notes: [note] } } as ServerEvent);
    } else {
      emit({ type: "note.error", payload: { message: `Note ${event.payload.noteId} not found` } } as ServerEvent);
    }
    return;
  }

  if (event.type === "note.update") {
    if (!noteRepo) {
      emit({ type: "note.error", payload: { message: "Note repository not initialized" } } as ServerEvent);
      return;
    }
    const updated = noteRepo.update(event.payload.noteId, event.payload.input);
    if (updated) {
      emit({ type: "note.updated", payload: { note: updated } } as ServerEvent);
    } else {
      emit({ type: "note.error", payload: { message: `Note ${event.payload.noteId} not found` } } as ServerEvent);
    }
    return;
  }

  if (event.type === "note.delete") {
    const deleted = noteRepo?.delete(event.payload.noteId);
    if (deleted) {
      emit({ type: "note.deleted", payload: { noteId: event.payload.noteId } } as ServerEvent);
    } else {
      emit({ type: "note.error", payload: { message: `Note ${event.payload.noteId} not found` } } as ServerEvent);
    }
    return;
  }
}

export function addServerEventListener(listener: (event: ServerEvent) => void): () => void {
  serverEventListeners.add(listener);
  return () => {
    serverEventListeners.delete(listener);
  };
}

export function cleanupAllSessions(): void {
  rendererEventBatcher.dispose();
  btwRuntimeManager.closeAll();
  for (const [, handle] of runnerHandles) {
    handle.abort();
  }
  runnerHandles.clear();
  taskExecutor?.stopPolling();
  taskExecutor = null;
  if (sessions) {
    sessions.recoverInterruptedSessions();
    sessions.close();
  }
}

export { sessions };

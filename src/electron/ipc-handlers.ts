import { app, BrowserWindow } from "electron";
import { existsSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, dirname, extname, isAbsolute, join } from "path";

import { createStoredUserPromptMessage, sanitizePromptAttachmentsForStorage } from "../shared/attachments.js";
import { buildPromptLedgerMessage, type PromptLedgerMessage, type PromptLedgerSource } from "../shared/prompt-ledger.js";
import { createInitialSessionWorkflowState, parseWorkflowMarkdown } from "../shared/workflow-markdown.js";
import { runClaude, type RunnerHandle } from "./libs/runner.js";
import { persistImageAttachmentReference, rehydrateStoredImageAttachment } from "./libs/attachment-store.js";
import { resolveAgentRuntimeContext } from "./libs/agent-resolver.js";
import { getCurrentApiConfig, getModelConfig, supportsRemoteSessionResume } from "./libs/claude-settings.js";
import { SessionStore } from "./libs/session-store.js";
import { buildSessionSlashCommands } from "./libs/slash-command-catalog.js";
import { stripInlineBase64ImagesFromMessage } from "./libs/tool-output-sanitizer.js";
import { buildSessionWorkflowCatalog } from "./libs/workflow-catalog.js";
import { buildStatelessContinuationPayload } from "./stateless-continuation.js";
import type { ClientEvent, PromptAttachment, ServerEvent, StreamMessage } from "./types.js";
import { isDev } from "./util.js";

let sessions: SessionStore;
const runnerHandles = new Map<string, RunnerHandle>();
const serverEventListeners = new Set<(event: ServerEvent) => void>();

function initializeSessions() {
  if (!sessions) {
    const dbPath = join(app.getPath("userData"), "sessions.db");
    sessions = new SessionStore(dbPath);
    sessions.recoverInterruptedSessions();
  }
  return sessions;
}

function broadcast(event: ServerEvent) {
  const payload = JSON.stringify(event);
  if (isDev()) {
    console.log("[meta][server-event]", event.type);
  }
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("server-event", payload);
  }
  for (const listener of serverEventListeners) {
    listener(event);
  }
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
    const agentAttachment: PromptAttachment = {
      ...displayAttachment,
      data: storedReference?.storageUri ?? attachment.storageUri ?? attachment.data,
      preview: undefined,
      runtimeData: undefined,
      summaryText: attachment.summaryText ?? buildImageAssetSummary(displayAttachment),
    };

    displayAttachments.push(displayAttachment);
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
      chars: attachment.size ?? attachment.data.length,
    })),
    promptSources,
    memorySources,
    historyMessages: options.historyMessages ?? [],
  });
}

function emit(event: ServerEvent) {
  let nextEvent = event;

  // If a session was deleted, drop late events that would resurrect it in the UI.
  // Session history lookups are DB-backed, so late events commonly lead to
  // "Unknown session" artifacts on the renderer side.
  if (
    (nextEvent.type === "session.status" ||
      nextEvent.type === "stream.message" ||
      nextEvent.type === "stream.user_prompt" ||
      nextEvent.type === "permission.request") &&
    !hasLiveSession(nextEvent.payload.sessionId)
  ) {
    return;
  }

  if (nextEvent.type === "session.status") {
    sessions.updateSession(nextEvent.payload.sessionId, { status: nextEvent.payload.status });
  }
  if (nextEvent.type === "stream.message") {
    const normalizedMessage =
      typeof nextEvent.payload.message.capturedAt === "number"
        ? nextEvent.payload.message
        : { ...nextEvent.payload.message, capturedAt: Date.now() };
    const message = sessions.recordMessage(
      nextEvent.payload.sessionId,
      stripInlineBase64ImagesFromMessage(normalizedMessage),
    );
    nextEvent = {
      ...nextEvent,
      payload: {
        ...nextEvent.payload,
        message,
      },
    };
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
        attachments: sanitizedAttachments,
        capturedAt: storedPrompt.capturedAt,
        historyId: storedPrompt.historyId,
      },
    };
  }

  broadcast(nextEvent);
}

export async function handleClientEvent(event: ClientEvent) {
  const store = initializeSessions();

  if (event.type === "session.list") {
    const archived = Boolean(event.payload?.archived);
    const sessionsWithSlashCommands = store.listSessions({ archived }).map((session) => ({
      ...session,
      slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
    }));
    emit({
      type: "session.list",
      payload: { sessions: sessionsWithSlashCommands, archived },
    });
    return;
  }

  if (event.type === "session.archive") {
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
    return;
  }

  if (event.type === "session.workflow.catalog.list") {
    const history = store.getSessionHistory(event.payload.sessionId);
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

  if (event.type === "session.start") {
    const { displayAttachments, agentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
    const config = getCurrentApiConfig();
    const selectedModel = event.payload.runtime?.model?.trim() || config?.model;
    const session = store.createSession({
      cwd: event.payload.cwd,
      title: event.payload.title,
      runSurface: event.payload.runtime?.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId,
      model: selectedModel,
      allowedTools: event.payload.allowedTools,
      prompt: event.payload.prompt,
    });

    store.updateSession(session.id, {
      status: "running",
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
      model: selectedModel,
      lastPrompt: event.payload.prompt,
    });

    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "running",
        title: session.title,
        cwd: session.cwd,
        model: selectedModel,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "start",
          prompt: event.payload.prompt,
          attachments: agentAttachments,
          session,
          model: selectedModel,
        }),
      },
    });

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: displayAttachments },
    });

    runClaude({
      prompt: event.payload.prompt,
      attachments: agentAttachments,
      runtime: {
        ...(event.payload.runtime ?? {}),
        model: selectedModel,
      },
      session,
      resumeSessionId: session.claudeSessionId,
      onEvent: emit,
      onSessionUpdate: (updates) => {
        store.updateSession(session.id, updates);
      },
    })
      .then((handle) => {
        runnerHandles.set(session.id, handle);
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

    const config = getCurrentApiConfig();
    const canUseRemoteResume = config ? supportsRemoteSessionResume(config) : true;
    const history = store.getSessionHistory(session.id);
    const shouldRetitleFromFirstPrompt = isPlaceholderSessionTitle(session.title) && (history?.messages.length ?? 0) === 0;
    const nextTitle = shouldRetitleFromFirstPrompt
      ? buildTitleFromFirstPrompt(event.payload.prompt, event.payload.attachments)
      : session.title;
    const selectedModel =
      event.payload.runtime?.model?.trim()
      || resolveLatestMessageModel(history?.messages)
      || session.model
      || config?.model;
    const modelConfig = config && selectedModel ? getModelConfig(config, selectedModel) : null;
    const { displayAttachments, agentAttachments: currentAgentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
    const continuationPayload = canUseRemoteResume
      ? null
      : buildStatelessContinuationPayload(
          history?.messages ?? [],
          event.payload.prompt,
          currentAgentAttachments,
          {
            contextWindow: modelConfig?.contextWindow,
            compressionThresholdPercent: modelConfig?.compressionThresholdPercent,
            recentTurnCount: 5,
            existingSummary: history?.session.continuationSummary,
            existingSummaryMessageCount: history?.session.continuationSummaryMessageCount,
          },
        );
    const prompt = canUseRemoteResume ? event.payload.prompt : continuationPayload?.prompt ?? event.payload.prompt;
    const resumeSessionId = canUseRemoteResume ? session.claudeSessionId : undefined;
    const rehydratedAttachments = shouldRehydrateRecentImages(event.payload.prompt, displayAttachments)
      ? await loadRecentReferencedImages(history?.messages ?? [])
      : [];
    const attachmentsForRun = [...currentAgentAttachments, ...rehydratedAttachments];

    store.updateSession(session.id, {
      status: "running",
      title: nextTitle,
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
        model: selectedModel,
        lastPrompt: event.payload.prompt,
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
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "continue",
          prompt,
          attachments: attachmentsForRun,
          session,
          historyMessages: canUseRemoteResume ? history?.messages ?? [] : [],
          model: selectedModel,
          continuationSummary: continuationPayload?.summaryText,
        }),
      },
    });

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: displayAttachments },
    });

    runClaude({
      prompt,
      attachments: attachmentsForRun,
      runtime: {
        ...(event.payload.runtime ?? {}),
        model: selectedModel,
      },
      session,
      resumeSessionId,
      onEvent: emit,
      onSessionUpdate: (updates) => {
        store.updateSession(session.id, updates);
      },
    })
      .then((handle) => {
        runnerHandles.set(session.id, handle);
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

  if (event.type === "session.append") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) {
      emit({ type: "session.deleted", payload: { sessionId: event.payload.sessionId } });
      emit({
        type: "runner.error",
        payload: { sessionId: event.payload.sessionId, message: "Session no longer exists." },
      });
      return;
    }

    if (session.status !== "running") {
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message: "当前会话没有正在执行的任务，不能插入补充指令。" },
      });
      return;
    }

    const handle = runnerHandles.get(session.id);
    if (!handle) {
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message: "当前执行器还未就绪，稍后再插入补充指令。" },
      });
      return;
    }

    const { displayAttachments, agentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
    store.updateSession(session.id, { lastPrompt: event.payload.prompt });
    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: displayAttachments },
    });

    try {
      await handle.appendPrompt(event.payload.prompt, agentAttachments);
    } catch (error) {
      emit({
        type: "runner.error",
        payload: { sessionId: session.id, message: `插入补充指令失败：${String(error)}` },
      });
    }
    return;
  }

  if (event.type === "session.stop") {
    const session = store.getSession(event.payload.sessionId);
    if (!session) return;

    const handle = runnerHandles.get(session.id);
    if (handle) {
      handle.abort();
      runnerHandles.delete(session.id);
    }

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
    const handle = runnerHandles.get(sessionId);
    if (handle) {
      handle.abort();
      runnerHandles.delete(sessionId);
    }

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
    return;
  }

  if (event.type === "agent.list") {
    const agents: Array<{ id: string; name: string; description?: string; scope: string }> = [];
    const cwd = event.payload.cwd?.trim();
    const projectRoot = cwd ? join(cwd, ".claude", "agents") : undefined;

    for (const [scope, root] of [["user", join(homedir(), ".claude", "agents")], ["project", projectRoot]] as const) {
      if (!root) continue;
      try {
        const entries = readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const ext = extname(entry.name).toLowerCase();
          const id = basename(entry.name, ext);
          const name = id;
          if (ext === ".json") {
            try {
              const parsed = JSON.parse(readFileSync(join(root, entry.name), "utf8")) as { name?: string; description?: string; enabled?: boolean };
              if (parsed.enabled === false) continue;
              agents.push({ id, name: parsed.name?.trim() || name, description: parsed.description?.trim(), scope });
            } catch { /* skip invalid JSON */ }
          } else if (ext === ".md") {
            agents.push({ id, name, scope });
          }
        }
      } catch { /* directory not found */ }
    }

    emit({ type: "agent.list", payload: { agents } });
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
  for (const [, handle] of runnerHandles) {
    handle.abort();
  }
  runnerHandles.clear();
  if (sessions) {
    sessions.recoverInterruptedSessions();
    sessions.close();
  }
}

export { sessions };

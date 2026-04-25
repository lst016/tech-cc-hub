import { app, BrowserWindow } from "electron";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { createStoredUserPromptMessage, sanitizePromptAttachmentsForStorage } from "../shared/attachments.js";
import { applyDevLoopToPrompt, classifyDevLoop, createDevLoopMessage } from "../shared/dev-loop.js";
import { buildPromptLedgerMessage, type PromptLedgerMessage, type PromptLedgerSource } from "../shared/prompt-ledger.js";
import {
  applyProjectRuntimeToPrompt,
  buildFirstShotContextPack,
  buildProjectProfile,
  createProjectRuntimeMessage,
  type FirstShotContextPack,
  type ProjectManifestFile,
  type ProjectProfile,
} from "../shared/project-profile.js";
import { createInitialSessionWorkflowState, parseWorkflowMarkdown } from "../shared/workflow-markdown.js";
import { runClaude, type RunnerHandle } from "./libs/runner.js";
import { rehydrateStoredImageAttachment } from "./libs/attachment-store.js";
import { resolveAgentRuntimeContext } from "./libs/agent-resolver.js";
import { getCurrentApiConfig, getModelConfig, supportsRemoteSessionResume } from "./libs/claude-settings.js";
import { SessionStore } from "./libs/session-store.js";
import { buildSessionSlashCommands } from "./libs/slash-command-catalog.js";
import { stripInlineBase64ImagesFromMessage } from "./libs/tool-output-sanitizer.js";
import { buildSessionWorkflowCatalog } from "./libs/workflow-catalog.js";
import { resolveContinuationResumeStrategy } from "./continuation-resume-strategy.js";
import { buildStatelessContinuationPayload } from "./stateless-continuation.js";
import type { ClientEvent, PromptAttachment, ServerEvent, StreamMessage } from "./types.js";
import { isDev } from "./util.js";

let sessions: SessionStore;
const runnerHandles = new Map<string, RunnerHandle>();

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
    console.log("[meta][server-event]", payload);
  }
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("server-event", payload);
  }
}

function hasLiveSession(sessionId: string): boolean {
  if (!sessions) return false;
  return Boolean(sessions.getSession(sessionId));
}

const MAX_REHYDRATED_IMAGE_ATTACHMENTS = 2;
const VISUAL_REVIEW_REHYDRATE_PATTERN =
  /(ui|design|interface|screenshot|image|compare|diff|align|layout|spacing|pixel|visual|button|style|\u8bbe\u8ba1|\u754c\u9762|\u622a\u56fe|\u770b\u56fe|\u6bd4\u5bf9|\u5bf9\u6bd4|\u4e00\u81f4|\u50cf\u7d20|\u5e03\u5c40|\u95f4\u8ddd|\u8fd8\u539f|\u89c6\u89c9|\u6309\u94ae|\u6837\u5f0f|\u9884\u671f)/i;

const PROJECT_PROFILE_MANIFEST_FILES = [
  "package.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "electron-builder.json",
  "pom.xml",
  "build.gradle",
  "requirements.txt",
  "pyproject.toml",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "src/App.tsx",
  "src/main.tsx",
  "src/App.jsx",
  "src/main.jsx",
];

function readProjectManifestFiles(cwd?: string): ProjectManifestFile[] {
  if (!cwd || !existsSync(cwd)) {
    return [];
  }

  const files: ProjectManifestFile[] = [];
  for (const relativePath of PROJECT_PROFILE_MANIFEST_FILES) {
    const absolutePath = join(cwd, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    try {
      files.push({
        path: relativePath,
        text: readFileSync(absolutePath, "utf8").slice(0, 80_000),
      });
    } catch {
      // Ignore unreadable optional profile inputs; the profile will carry lower confidence.
    }
  }
  return files;
}

function loadOrCreateProjectProfile(store: SessionStore, cwd?: string): ProjectProfile | null {
  if (!cwd) {
    return null;
  }

  const existing = store.getProjectProfile(cwd);
  if (existing) {
    return existing;
  }

  const profile = buildProjectProfile({
    cwd,
    files: readProjectManifestFiles(cwd),
  });
  store.upsertProjectProfile(profile);
  return profile;
}

function emitProjectRuntimeContext(options: {
  store: SessionStore;
  sessionId: string;
  cwd?: string;
  prompt: string;
  taskKind: string;
  loopMode: ReturnType<typeof classifyDevLoop>["loopMode"];
}): {
  profile: ProjectProfile | null;
  pack: FirstShotContextPack | null;
} {
  const profile = loadOrCreateProjectProfile(options.store, options.cwd);
  if (!profile) {
    return { profile: null, pack: null };
  }

  const pack = buildFirstShotContextPack({
    profile,
    taskKind: options.taskKind,
    loopMode: options.loopMode,
    prompt: options.prompt,
  });

  emit({
    type: "stream.message",
    payload: {
      sessionId: options.sessionId,
      message: createProjectRuntimeMessage("profile_loaded", profile),
    },
  });
  emit({
    type: "stream.message",
    payload: {
      sessionId: options.sessionId,
      message: createProjectRuntimeMessage("context_pack_generated", profile, pack),
    },
  });

  return { profile, pack };
}

function shouldRehydrateRecentImages(prompt: string, attachments?: PromptAttachment[]): boolean {
  if (attachments?.some((attachment) => attachment.kind === "image")) {
    return false;
  }

  return VISUAL_REVIEW_REHYDRATE_PATTERN.test(prompt);
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
    const sessionsWithSlashCommands = store.listSessions().map((session) => ({
      ...session,
      slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
    }));
    emit({
      type: "session.list",
      payload: { sessions: sessionsWithSlashCommands },
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

    emit({
      type: "session.history",
      payload: {
        sessionId: history.session.id,
        status: history.session.status,
        messages: history.messages,
        mode: event.payload.before ? "prepend" : "replace",
        hasMore: history.hasMore,
        nextCursor: history.nextCursor,
        slashCommands: buildSessionSlashCommands({
          cwd: history.session.cwd,
          messages: history.messages,
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
    const session = store.createSession({
      cwd: event.payload.cwd,
      title: event.payload.title,
      runSurface: event.payload.runtime?.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId,
      allowedTools: event.payload.allowedTools,
      prompt: event.payload.prompt,
    });

    store.updateSession(session.id, {
      status: "running",
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
      lastPrompt: event.payload.prompt,
    });

    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "running",
        title: session.title,
        cwd: session.cwd,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });

    const config = getCurrentApiConfig();
    const devLoop = classifyDevLoop({
      prompt: event.payload.prompt,
      attachments: event.payload.attachments,
      cwd: session.cwd,
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface,
    });
    const projectRuntime = emitProjectRuntimeContext({
      store,
      sessionId: session.id,
      cwd: session.cwd,
      prompt: event.payload.prompt,
      taskKind: devLoop.taskKind,
      loopMode: devLoop.loopMode,
    });
    const promptWithProjectRuntime = projectRuntime.pack
      ? applyProjectRuntimeToPrompt(event.payload.prompt, projectRuntime.pack)
      : event.payload.prompt;
    const promptForRun = applyDevLoopToPrompt(promptWithProjectRuntime, devLoop);

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: createDevLoopMessage(devLoop, devLoop.loopMode === "none" ? "classified" : "prompt_injected"),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "start",
          prompt: promptForRun,
          attachments: event.payload.attachments,
          session,
          model: event.payload.runtime?.model ?? config?.model,
        }),
      },
    });

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: event.payload.attachments },
    });

    runClaude({
      prompt: promptForRun,
      attachments: event.payload.attachments,
      runtime: event.payload.runtime,
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
    const apiSupportsRemoteResume = config ? supportsRemoteSessionResume(config) : true;
    const resumeStrategy = resolveContinuationResumeStrategy({
      apiSupportsRemoteResume,
      sessionStatus: session.status,
      claudeSessionId: session.claudeSessionId,
    });
    const history = store.getSessionHistory(session.id);
    const selectedModel = event.payload.runtime?.model ?? config?.model;
    const modelConfig = config && selectedModel ? getModelConfig(config, selectedModel) : null;
    const continuationPayload = !resumeStrategy.useStatelessContinuation
      ? null
      : buildStatelessContinuationPayload(
          history?.messages ?? [],
          event.payload.prompt,
          event.payload.attachments ?? [],
          {
            contextWindow: modelConfig?.contextWindow,
            compressionThresholdPercent: modelConfig?.compressionThresholdPercent,
            recentTurnCount: 5,
            existingSummary: history?.session.continuationSummary,
            existingSummaryMessageCount: history?.session.continuationSummaryMessageCount,
          },
        );
    const prompt = !resumeStrategy.useStatelessContinuation ? event.payload.prompt : continuationPayload?.prompt ?? event.payload.prompt;
    const resumeSessionId = resumeStrategy.resumeSessionId;
    const currentAttachments = event.payload.attachments ?? [];
    const rehydratedAttachments = shouldRehydrateRecentImages(event.payload.prompt, currentAttachments)
      ? await loadRecentReferencedImages(history?.messages ?? [])
      : [];
    const attachmentsForRun = [...currentAttachments, ...rehydratedAttachments];
    const devLoop = classifyDevLoop({
      prompt: event.payload.prompt,
      attachments: attachmentsForRun,
      cwd: session.cwd,
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface,
    });
    const projectRuntime = emitProjectRuntimeContext({
      store,
      sessionId: session.id,
      cwd: session.cwd,
      prompt: event.payload.prompt,
      taskKind: devLoop.taskKind,
      loopMode: devLoop.loopMode,
    });
    const promptWithProjectRuntime = projectRuntime.pack
      ? applyProjectRuntimeToPrompt(prompt, projectRuntime.pack)
      : prompt;
    const promptForRun = applyDevLoopToPrompt(promptWithProjectRuntime, devLoop);

    store.updateSession(session.id, {
      status: "running",
      runSurface: event.payload.runtime?.runSurface ?? session.runSurface ?? "development",
      agentId: event.payload.runtime?.agentId ?? session.agentId,
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
        title: session.title,
        cwd: session.cwd,
        slashCommands: buildSessionSlashCommands({ cwd: session.cwd }),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: createDevLoopMessage(devLoop, devLoop.loopMode === "none" ? "classified" : "prompt_injected"),
      },
    });

    emit({
      type: "stream.message",
      payload: {
        sessionId: session.id,
        message: buildPromptLedgerForRun({
          phase: "continue",
          prompt: promptForRun,
          attachments: attachmentsForRun,
          session,
          historyMessages: history?.messages ?? [],
          model: selectedModel,
          continuationSummary: continuationPayload?.summaryText,
        }),
      },
    });

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: currentAttachments },
    });

    runClaude({
      prompt: promptForRun,
      attachments: attachmentsForRun,
      runtime: event.payload.runtime,
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
            error: String(error),
          },
        });
      });

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

    store.updateSession(session.id, { status: "paused" });
    emit({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status: "paused",
        title: session.title,
        cwd: session.cwd,
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
  }
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

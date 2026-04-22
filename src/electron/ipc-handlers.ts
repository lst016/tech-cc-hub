import { app, BrowserWindow } from "electron";
import { join } from "path";

import { createStoredUserPromptMessage } from "../shared/attachments.js";
import { createInitialSessionWorkflowState, parseWorkflowMarkdown } from "../shared/workflow-markdown.js";
import { runClaude, type RunnerHandle } from "./libs/runner.js";
import { getCurrentApiConfig, getModelConfig, supportsRemoteSessionResume } from "./libs/claude-settings.js";
import { SessionStore } from "./libs/session-store.js";
import { buildSessionSlashCommands } from "./libs/slash-command-catalog.js";
import { stripInlineBase64ImagesFromMessage } from "./libs/tool-output-sanitizer.js";
import { buildSessionWorkflowCatalog } from "./libs/workflow-catalog.js";
import { buildStatelessContinuationPayload } from "./stateless-continuation.js";
import type { ClientEvent, ServerEvent } from "./types.js";
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
    const message = stripInlineBase64ImagesFromMessage(normalizedMessage);
    sessions.recordMessage(nextEvent.payload.sessionId, message);
    nextEvent = {
      ...nextEvent,
      payload: {
        ...nextEvent.payload,
        message,
      },
    };
  }
  if (nextEvent.type === "stream.user_prompt") {
    sessions.recordMessage(
      nextEvent.payload.sessionId,
      {
        ...createStoredUserPromptMessage(nextEvent.payload.prompt, nextEvent.payload.attachments),
        capturedAt: Date.now(),
      },
    );
  }

  broadcast(nextEvent);
}

export function handleClientEvent(event: ClientEvent) {
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
    const history = store.getSessionHistory(event.payload.sessionId);
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

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: event.payload.attachments },
    });

    runClaude({
      prompt: event.payload.prompt,
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
    const canUseRemoteResume = config ? supportsRemoteSessionResume(config) : true;
    const history = store.getSessionHistory(session.id);
    const selectedModel = event.payload.runtime?.model ?? config?.model;
    const modelConfig = config && selectedModel ? getModelConfig(config, selectedModel) : null;
    const continuationPayload = canUseRemoteResume
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
    const prompt = canUseRemoteResume ? event.payload.prompt : continuationPayload?.prompt ?? event.payload.prompt;
    const resumeSessionId = canUseRemoteResume ? session.claudeSessionId : undefined;

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
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt: event.payload.prompt, attachments: event.payload.attachments },
    });

    runClaude({
      prompt,
      attachments: event.payload.attachments,
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

    store.updateSession(session.id, { status: "idle" });
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

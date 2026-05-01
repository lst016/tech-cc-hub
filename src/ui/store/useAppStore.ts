import { create } from 'zustand';
import type {
  ApiConfigProfile,
  ApiConfigSettings,
  RuntimePermissionMode,
  RuntimeReasoningMode,
  SessionHistoryCursor,
  SessionWorkflowCatalog,
  ServerEvent,
  SessionStatus,
  StreamMessage,
} from "../types";
import {
  parseWorkflowMarkdown,
  type SessionWorkflowState,
  type WorkflowScope,
  type WorkflowSpecDocument,
} from "../../shared/workflow-markdown";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands";

export type PermissionRequest = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type SessionView = {
  id: string;
  title: string;
  status: SessionStatus;
  model?: string;
  cwd?: string;
  slashCommands?: string[];
  messages: StreamMessage[];
  permissionRequests: PermissionRequest[];
  lastPrompt?: string;
  workflowMarkdown?: string;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowState?: SessionWorkflowState;
  workflowSpec?: WorkflowSpecDocument;
  workflowError?: string;
  workflowCatalog?: SessionWorkflowCatalog;
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  hydrated: boolean;
  hasMoreHistory: boolean;
  historyCursor?: SessionHistoryCursor;
};

export type BrowserWorkbenchSessionState = {
  url?: string;
  hasBrowserTab: boolean;
  annotations: BrowserWorkbenchAnnotation[];
};

export const CODE_REFERENCE_DRAFT_SESSION_ID = "__draft__";

export function getCodeReferenceSessionKey(sessionId?: string | null) {
  return sessionId || CODE_REFERENCE_DRAFT_SESSION_ID;
}

export type CodeReferenceDraft = {
  id: string;
  kind: "selection" | "comment";
  filePath: string;
  fileName: string;
  language?: string;
  startLine: number;
  endLine: number;
  code: string;
  comment?: string;
  createdAt: number;
};

export type MessageReferenceDraft = {
  id: string;
  kind: "selection" | "message";
  sourceRole: "user" | "assistant" | "tool" | "system";
  sourceLabel: string;
  text: string;
  capturedAt?: number;
  createdAt: number;
};

export type FileReferenceDraft = {
  id: string;
  kind: "file" | "directory";
  path: string;
  name: string;
  label: string;
  workspaceRoot: string;
  createdAt: number;
};

interface AppState {
  sessions: Record<string, SessionView>;
  archivedSessions: Record<string, SessionView>;
  activeSessionId: string | null;
  prompt: string;
  browserAnnotations: BrowserWorkbenchAnnotation[];
  browserWorkbenchBySessionId: Record<string, BrowserWorkbenchSessionState>;
  codeReferencesBySessionId: Record<string, CodeReferenceDraft[]>;
  messageReferencesBySessionId: Record<string, MessageReferenceDraft[]>;
  fileReferencesBySessionId: Record<string, FileReferenceDraft[]>;
  cwd: string;
  apiConfigSettings: ApiConfigSettings;
  runtimeModel: string;
  reasoningMode: RuntimeReasoningMode;
  permissionMode: RuntimePermissionMode;
  pendingStart: boolean;
  globalError: string | null;
  sessionsLoaded: boolean;
  showStartModal: boolean;
  showSettingsModal: boolean;
  historyRequested: Set<string>;
  apiConfigChecked: boolean;
  availableAgents: Array<{ id: string; name: string; description?: string; scope: string }>;
  selectedAgentId: string;

  setPrompt: (prompt: string) => void;
  setBrowserAnnotations: (annotations: BrowserWorkbenchAnnotation[]) => void;
  clearBrowserAnnotations: () => void;
  setBrowserWorkbenchUrl: (sessionId: string, url: string) => void;
  setBrowserWorkbenchHasTab: (sessionId: string, hasBrowserTab: boolean) => void;
  setBrowserWorkbenchAnnotations: (sessionId: string, annotations: BrowserWorkbenchAnnotation[]) => void;
  addCodeReference: (
    sessionId: string | null | undefined,
    reference: Omit<CodeReferenceDraft, "id" | "createdAt"> & Partial<Pick<CodeReferenceDraft, "id" | "createdAt">>,
  ) => CodeReferenceDraft;
  updateCodeReference: (sessionId: string | null | undefined, id: string, patch: Partial<Pick<CodeReferenceDraft, "comment" | "kind">>) => void;
  removeCodeReference: (sessionId: string | null | undefined, id: string) => void;
  clearCodeReferences: (sessionId?: string | null) => void;
  addMessageReference: (
    sessionId: string | null | undefined,
    reference: Omit<MessageReferenceDraft, "id" | "createdAt"> & Partial<Pick<MessageReferenceDraft, "id" | "createdAt">>,
  ) => MessageReferenceDraft;
  removeMessageReference: (sessionId: string | null | undefined, id: string) => void;
  clearMessageReferences: (sessionId?: string | null) => void;
  addFileReference: (
    sessionId: string | null | undefined,
    reference: Omit<FileReferenceDraft, "id" | "createdAt"> & Partial<Pick<FileReferenceDraft, "id" | "createdAt">>,
  ) => FileReferenceDraft;
  removeFileReference: (sessionId: string | null | undefined, id: string) => void;
  clearFileReferences: (sessionId?: string | null) => void;
  setCwd: (cwd: string) => void;
  setApiConfigSettings: (settings: ApiConfigSettings) => void;
  setRuntimeModel: (model: string) => void;
  setReasoningMode: (mode: RuntimeReasoningMode) => void;
  setPermissionMode: (mode: RuntimePermissionMode) => void;
  setPendingStart: (pending: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setShowStartModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setActiveSessionId: (id: string | null) => void;
  setApiConfigChecked: (checked: boolean) => void;
  setSelectedAgentId: (id: string) => void;
  markHistoryRequested: (sessionId: string) => void;
  resolvePermissionRequest: (sessionId: string, toolUseId: string) => void;
  handleServerEvent: (event: ServerEvent) => void;
}

function createSession(id: string): SessionView {
  return {
    id,
    title: "",
    status: "idle",
    messages: [],
    permissionRequests: [],
    hydrated: false,
    hasMoreHistory: false,
  };
}

function hydrateWorkflowView(
  markdown?: string,
  workflowState?: SessionWorkflowState,
  workflowSourceLayer?: WorkflowScope,
  workflowSourcePath?: string,
  workflowError?: string,
): Pick<SessionView, "workflowMarkdown" | "workflowState" | "workflowSourceLayer" | "workflowSourcePath" | "workflowSpec" | "workflowError"> {
  const parsed = markdown ? parseWorkflowMarkdown(markdown) : null;
  return {
    workflowMarkdown: markdown,
    workflowState,
    workflowSourceLayer,
    workflowSourcePath,
    workflowSpec: parsed?.ok ? parsed.document ?? undefined : undefined,
    workflowError: workflowError ?? (parsed && !parsed.ok ? parsed.errors.map((item) => item.message).join("；") : undefined),
  };
}

function getEnabledProfile(settings: ApiConfigSettings): ApiConfigProfile | undefined {
  return settings.profiles.find((profile) => profile.enabled) ?? settings.profiles[0];
}

function extractSlashCommands(messages: StreamMessage[]): string[] | undefined {
  return extractSlashCommandsFromMessages(messages);
}

function isTransientStreamEventMessage(message: StreamMessage): boolean {
  return "type" in message && message.type === "stream_event";
}

const MAX_RENDERER_HISTORY_MESSAGES = 600;
const STREAM_MESSAGE_BATCH_DELAY_MS = 32;

let pendingStreamMessageTimer: ReturnType<typeof setTimeout> | null = null;
const pendingStreamMessagesBySession = new Map<string, StreamMessage[]>();

function getMessageCursor(message: StreamMessage | undefined): SessionHistoryCursor | undefined {
  if (!message?.historyId || typeof message.capturedAt !== "number") {
    return undefined;
  }

  return {
    beforeCreatedAt: message.capturedAt,
    beforeId: message.historyId,
  };
}

function getMessageStableKey(message: StreamMessage): string {
  if (message.historyId) {
    return `history:${message.historyId}`;
  }

  if ("uuid" in message && typeof message.uuid === "string" && message.uuid.length > 0) {
    return `uuid:${message.uuid}`;
  }

  if (message.type === "user_prompt") {
    return `user:${message.capturedAt ?? "na"}:${message.prompt}`;
  }

  return `fallback:${message.type}:${message.capturedAt ?? "na"}:${JSON.stringify(message)}`;
}

function mergeMessages(olderMessages: StreamMessage[], newerMessages: StreamMessage[]): StreamMessage[] {
  const merged: StreamMessage[] = [];
  const seen = new Set<string>();

  for (const message of [...olderMessages, ...newerMessages]) {
    const key = getMessageStableKey(message);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(message);
  }

  return merged;
}

function trimMessagesToRecent(
  messages: StreamMessage[],
  fallbackCursor?: SessionHistoryCursor,
): {
  messages: StreamMessage[];
  trimmed: boolean;
  historyCursor?: SessionHistoryCursor;
} {
  if (messages.length <= MAX_RENDERER_HISTORY_MESSAGES) {
    return { messages, trimmed: false, historyCursor: fallbackCursor };
  }

  const trimmedMessages = messages.slice(-MAX_RENDERER_HISTORY_MESSAGES);
  return {
    messages: trimmedMessages,
    trimmed: true,
    historyCursor: getMessageCursor(trimmedMessages[0]) ?? fallbackCursor,
  };
}

function appendMessagesToSession(
  session: SessionView,
  nextMessages: StreamMessage[],
): SessionView {
  let slashCommands = session.slashCommands;
  for (const message of nextMessages) {
    slashCommands = mergeSlashCommandLists(slashCommands, extractSlashCommands([message]));
  }

  const trimmed = trimMessagesToRecent(
    [...session.messages, ...nextMessages],
    session.historyCursor,
  );

  return {
    ...session,
    slashCommands: slashCommands ?? session.slashCommands,
    messages: trimmed.messages,
    hasMoreHistory: trimmed.trimmed ? true : session.hasMoreHistory,
    historyCursor: trimmed.trimmed ? trimmed.historyCursor ?? session.historyCursor : session.historyCursor,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: {},
  archivedSessions: {},
  activeSessionId: null,
  prompt: "",
  browserAnnotations: [],
  browserWorkbenchBySessionId: {},
  codeReferencesBySessionId: {},
  messageReferencesBySessionId: {},
  fileReferencesBySessionId: {},
  cwd: "",
  apiConfigSettings: { profiles: [] },
  runtimeModel: "",
  reasoningMode: "high",
  pendingStart: false,
  globalError: null,
  permissionMode: "bypassPermissions",
  sessionsLoaded: false,
  showStartModal: false,
  showSettingsModal: false,
  historyRequested: new Set(),
  apiConfigChecked: false,
  availableAgents: [],
  selectedAgentId: "",

  setPrompt: (prompt) => set({ prompt }),
  setBrowserAnnotations: (browserAnnotations) => set({ browserAnnotations }),
  clearBrowserAnnotations: () => set({ browserAnnotations: [] }),
  setBrowserWorkbenchUrl: (sessionId, url) => set((state) => ({
    browserWorkbenchBySessionId: {
      ...state.browserWorkbenchBySessionId,
      [sessionId]: {
        ...state.browserWorkbenchBySessionId[sessionId],
        hasBrowserTab: state.browserWorkbenchBySessionId[sessionId]?.hasBrowserTab ?? true,
        annotations: state.browserWorkbenchBySessionId[sessionId]?.annotations ?? [],
        url,
      },
    },
  })),
  setBrowserWorkbenchHasTab: (sessionId, hasBrowserTab) => set((state) => ({
    browserWorkbenchBySessionId: {
      ...state.browserWorkbenchBySessionId,
      [sessionId]: {
        url: state.browserWorkbenchBySessionId[sessionId]?.url,
        annotations: state.browserWorkbenchBySessionId[sessionId]?.annotations ?? [],
        hasBrowserTab,
      },
    },
  })),
  setBrowserWorkbenchAnnotations: (sessionId, annotations) => set((state) => ({
    browserWorkbenchBySessionId: {
      ...state.browserWorkbenchBySessionId,
      [sessionId]: {
        ...state.browserWorkbenchBySessionId[sessionId],
        hasBrowserTab: state.browserWorkbenchBySessionId[sessionId]?.hasBrowserTab ?? true,
        annotations,
      },
    },
  })),
  addCodeReference: (sessionId, reference) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    const nextReference: CodeReferenceDraft = {
      ...reference,
      id: reference.id ?? crypto.randomUUID(),
      createdAt: reference.createdAt ?? Date.now(),
      fileName: reference.fileName || reference.filePath.split(/[\\/]/).pop() || reference.filePath,
      comment: reference.comment?.trim() || undefined,
    };

    set((state) => ({
      codeReferencesBySessionId: {
        ...state.codeReferencesBySessionId,
        [sessionKey]: [...(state.codeReferencesBySessionId[sessionKey] ?? []), nextReference],
      },
    }));

    return nextReference;
  },
  updateCodeReference: (sessionId, id, patch) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => ({
      codeReferencesBySessionId: {
        ...state.codeReferencesBySessionId,
        [sessionKey]: (state.codeReferencesBySessionId[sessionKey] ?? []).map((reference) => (
          reference.id === id
            ? {
                ...reference,
                ...patch,
                comment: patch.comment !== undefined ? patch.comment.trim() || undefined : reference.comment,
              }
            : reference
        )),
      },
    }));
  },
  removeCodeReference: (sessionId, id) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => {
      const nextReferences = (state.codeReferencesBySessionId[sessionKey] ?? []).filter((reference) => reference.id !== id);
      const nextBySession = { ...state.codeReferencesBySessionId };
      if (nextReferences.length === 0) {
        delete nextBySession[sessionKey];
      } else {
        nextBySession[sessionKey] = nextReferences;
      }
      return { codeReferencesBySessionId: nextBySession };
    });
  },
  clearCodeReferences: (sessionId) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => {
      if (!state.codeReferencesBySessionId[sessionKey]) return state;
      const nextBySession = { ...state.codeReferencesBySessionId };
      delete nextBySession[sessionKey];
      return { codeReferencesBySessionId: nextBySession };
    });
  },
  addMessageReference: (sessionId, reference) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    const nextReference: MessageReferenceDraft = {
      ...reference,
      id: reference.id ?? crypto.randomUUID(),
      createdAt: reference.createdAt ?? Date.now(),
      text: reference.text.trim(),
      sourceLabel: reference.sourceLabel.trim() || reference.sourceRole,
    };

    set((state) => ({
      messageReferencesBySessionId: {
        ...state.messageReferencesBySessionId,
        [sessionKey]: [...(state.messageReferencesBySessionId[sessionKey] ?? []), nextReference],
      },
    }));

    return nextReference;
  },
  removeMessageReference: (sessionId, id) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => {
      const nextReferences = (state.messageReferencesBySessionId[sessionKey] ?? []).filter((reference) => reference.id !== id);
      const nextBySession = { ...state.messageReferencesBySessionId };
      if (nextReferences.length === 0) {
        delete nextBySession[sessionKey];
      } else {
        nextBySession[sessionKey] = nextReferences;
      }
      return { messageReferencesBySessionId: nextBySession };
    });
  },
  clearMessageReferences: (sessionId) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => {
      if (!state.messageReferencesBySessionId[sessionKey]) return state;
      const nextBySession = { ...state.messageReferencesBySessionId };
      delete nextBySession[sessionKey];
      return { messageReferencesBySessionId: nextBySession };
    });
  },
  addFileReference: (sessionId, reference) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    const nextReference: FileReferenceDraft = {
      ...reference,
      id: reference.id ?? crypto.randomUUID(),
      createdAt: reference.createdAt ?? Date.now(),
      name: reference.name || reference.label.split(/[\\/]/).pop() || reference.label,
      label: reference.label || reference.path,
    };

    set((state) => {
      const existing = state.fileReferencesBySessionId[sessionKey] ?? [];
      const withoutDuplicate = existing.filter((item) => item.path !== nextReference.path || item.kind !== nextReference.kind);
      return {
        fileReferencesBySessionId: {
          ...state.fileReferencesBySessionId,
          [sessionKey]: [...withoutDuplicate, nextReference],
        },
      };
    });

    return nextReference;
  },
  removeFileReference: (sessionId, id) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => {
      const nextReferences = (state.fileReferencesBySessionId[sessionKey] ?? []).filter((reference) => reference.id !== id);
      const nextBySession = { ...state.fileReferencesBySessionId };
      if (nextReferences.length === 0) {
        delete nextBySession[sessionKey];
      } else {
        nextBySession[sessionKey] = nextReferences;
      }
      return { fileReferencesBySessionId: nextBySession };
    });
  },
  clearFileReferences: (sessionId) => {
    const sessionKey = getCodeReferenceSessionKey(sessionId);
    set((state) => {
      if (!state.fileReferencesBySessionId[sessionKey]) return state;
      const nextBySession = { ...state.fileReferencesBySessionId };
      delete nextBySession[sessionKey];
      return { fileReferencesBySessionId: nextBySession };
    });
  },
  setCwd: (cwd) => set({ cwd }),
  setApiConfigSettings: (apiConfigSettings) => {
    set((state) => {
      const enabledProfile = getEnabledProfile(apiConfigSettings);
      const availableModels = enabledProfile
        ? Array.from(
            new Set([
              enabledProfile.model,
              ...(enabledProfile.models ?? []).map((item) => item.name),
            ]),
          ).filter(Boolean)
        : [];
      const runtimeModel = availableModels.includes(state.runtimeModel)
        ? state.runtimeModel
        : (enabledProfile?.model || availableModels[0] || "");

      return {
        apiConfigSettings,
        runtimeModel,
      };
    });
  },
  setRuntimeModel: (runtimeModel) => set({ runtimeModel }),
  setReasoningMode: (reasoningMode) => set({ reasoningMode }),
  setPermissionMode: (permissionMode) => set({ permissionMode }),
  setPendingStart: (pendingStart) => set({ pendingStart }),
  setGlobalError: (globalError) => set({ globalError }),
  setShowStartModal: (showStartModal) => set({ showStartModal }),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setApiConfigChecked: (apiConfigChecked) => set({ apiConfigChecked }),
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  markHistoryRequested: (sessionId) => {
    set((state) => {
      const next = new Set(state.historyRequested);
      next.add(sessionId);
      return { historyRequested: next };
    });
  },

  resolvePermissionRequest: (sessionId, toolUseId) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return {};
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            permissionRequests: existing.permissionRequests.filter(req => req.toolUseId !== toolUseId)
          }
        }
      };
    });
  },

  handleServerEvent: (event) => {
    const state = get();
    const enqueueStreamMessages = (sessionId: string, messages: StreamMessage[]) => {
      const existing = pendingStreamMessagesBySession.get(sessionId) ?? [];
      pendingStreamMessagesBySession.set(sessionId, [...existing, ...messages]);

      if (pendingStreamMessageTimer !== null) {
        return;
      }

      pendingStreamMessageTimer = setTimeout(() => {
        pendingStreamMessageTimer = null;
        const batches = Array.from(pendingStreamMessagesBySession.entries());
        pendingStreamMessagesBySession.clear();

        if (batches.length === 0) {
          return;
        }

        set((currentState) => {
          let nextSessions = currentState.sessions;
          let nextArchivedSessions = currentState.archivedSessions;
          let changedSessions = false;
          let changedArchivedSessions = false;

          for (const [sessionId, pendingMessages] of batches) {
            if (pendingMessages.length === 0) {
              continue;
            }

            const updateArchived = Boolean(nextArchivedSessions[sessionId]) && !nextSessions[sessionId];
            const existingSession = (updateArchived ? nextArchivedSessions[sessionId] : nextSessions[sessionId]) ?? createSession(sessionId);
            const nextSession = appendMessagesToSession(existingSession, pendingMessages);

            if (updateArchived) {
              if (!changedArchivedSessions) {
                nextArchivedSessions = { ...nextArchivedSessions };
                changedArchivedSessions = true;
              }
              nextArchivedSessions[sessionId] = nextSession;
            } else {
              if (!changedSessions) {
                nextSessions = { ...nextSessions };
                changedSessions = true;
              }
              nextSessions[sessionId] = nextSession;
            }
          }

          if (!changedSessions && !changedArchivedSessions) {
            return {};
          }

          return {
            sessions: nextSessions,
            archivedSessions: nextArchivedSessions,
          };
        });
      }, STREAM_MESSAGE_BATCH_DELAY_MS);
    };

    switch (event.type) {
      case "session.list": {
        const nextSessions: Record<string, SessionView> = {};
        for (const session of event.payload.sessions) {
          const existing = (event.payload.archived ? state.archivedSessions[session.id] : state.sessions[session.id])
            ?? createSession(session.id);
          nextSessions[session.id] = {
            ...existing,
            status: session.status,
            title: session.title,
            model: session.model,
            cwd: session.cwd,
            slashCommands: session.slashCommands ?? existing.slashCommands,
            ...hydrateWorkflowView(
              session.workflowMarkdown,
              session.workflowState,
              session.workflowSourceLayer,
              session.workflowSourcePath,
              session.workflowError,
            ),
            archivedAt: session.archivedAt,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          };
        }

        if (event.payload.archived) {
          set({ archivedSessions: nextSessions, sessionsLoaded: true });
          break;
        }

        set({ sessions: nextSessions, sessionsLoaded: true });

        const hasSessions = event.payload.sessions.length > 0;
        set({ showStartModal: false });

        if (!hasSessions) {
          get().setActiveSessionId(null);
        }

        if (!state.activeSessionId && event.payload.sessions.length > 0) {
          const sorted = [...event.payload.sessions].sort((a, b) => {
            const aTime = a.updatedAt ?? a.createdAt ?? 0;
            const bTime = b.updatedAt ?? b.createdAt ?? 0;
            return aTime - bTime;
          });
          const latestSession = sorted[sorted.length - 1];
          if (latestSession) {
            get().setActiveSessionId(latestSession.id);
          }
        } else if (state.activeSessionId) {
          const stillExists = event.payload.sessions.some(
            (session) => session.id === state.activeSessionId
          );
          if (!stillExists) {
            get().setActiveSessionId(null);
          }
        }
        break;
      }

      case "session.history": {
        const { sessionId, messages, status, mode, hasMore, nextCursor } = event.payload;
        set((state) => {
          const updateArchived = Boolean(state.archivedSessions[sessionId]) && !state.sessions[sessionId];
          const existing = (updateArchived ? state.archivedSessions[sessionId] : state.sessions[sessionId]) ?? createSession(sessionId);
          const mergedMessages = mode === "prepend"
            ? mergeMessages(messages, existing.messages)
            : messages;
          const slashCommands = mergeSlashCommandLists(
            event.payload.slashCommands,
            extractSlashCommands(mergedMessages),
          );
          const nextSession = {
            ...existing,
            status,
            messages: mergedMessages,
            slashCommands: slashCommands ?? existing.slashCommands,
            hydrated: true,
            hasMoreHistory: hasMore,
            historyCursor: nextCursor,
          };
          if (updateArchived) {
            return {
              archivedSessions: {
                ...state.archivedSessions,
                [sessionId]: nextSession,
              }
            };
          }
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: nextSession,
            }
          };
        });
        break;
      }

      case "session.workflow": {
        const { sessionId, markdown, state: workflowState, sourceLayer, sourcePath, error } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                ...hydrateWorkflowView(markdown, workflowState, sourceLayer, sourcePath, error),
              }
            }
          };
        });
        break;
      }

      case "session.workflow.catalog": {
        const catalog = event.payload;
        set((state) => {
          const existing = state.sessions[catalog.sessionId] ?? createSession(catalog.sessionId);
          return {
            sessions: {
              ...state.sessions,
              [catalog.sessionId]: {
                ...existing,
                workflowCatalog: catalog,
              }
            }
          };
        });
        break;
      }

      case "session.status": {
        const { sessionId, status, title, cwd, model, slashCommands } = event.payload;
        const isNewSession = !state.sessions[sessionId];
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                status,
                title: title ?? existing.title,
                cwd: cwd ?? existing.cwd,
                model: model ?? existing.model,
                slashCommands: slashCommands ?? existing.slashCommands,
                updatedAt: Date.now()
              }
            }
          };
        });

        if (state.pendingStart) {
          get().setActiveSessionId(sessionId);
          set({ pendingStart: false, showStartModal: false });
        }

        if (isNewSession) {
          get().setActiveSessionId(sessionId);
        }

        if (status === "error" && event.payload.error) {
          set({ globalError: event.payload.error });
        }
        if (status === "completed") {
          set({ globalError: null });
        }
        break;
      }

      case "session.archived": {
        const { sessionId, session } = event.payload;
        const previousState = get();
        set((state) => {
          const nextSessions = { ...state.sessions };
          const existing = nextSessions[sessionId];
          delete nextSessions[sessionId];

          const archivedSession = session
            ? {
                ...(state.archivedSessions[sessionId] ?? existing ?? createSession(sessionId)),
                status: session.status,
                title: session.title,
                cwd: session.cwd,
                model: session.model ?? existing?.model,
                slashCommands: session.slashCommands,
                ...hydrateWorkflowView(
                  session.workflowMarkdown,
                  session.workflowState,
                  session.workflowSourceLayer,
                  session.workflowSourcePath,
                  session.workflowError,
                ),
                archivedAt: session.archivedAt ?? Date.now(),
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
              }
            : existing
              ? { ...existing, archivedAt: Date.now() }
              : undefined;

          return {
            sessions: nextSessions,
            archivedSessions: archivedSession
              ? { ...state.archivedSessions, [sessionId]: archivedSession }
              : state.archivedSessions,
          };
        });

        if (previousState.activeSessionId === sessionId) {
          const remaining = Object.values(get().sessions).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          get().setActiveSessionId(remaining[0]?.id ?? null);
        }
        break;
      }

      case "session.unarchived": {
        const { sessionId, session } = event.payload;
        set((state) => {
          const nextArchivedSessions = { ...state.archivedSessions };
          const existing = nextArchivedSessions[sessionId];
          delete nextArchivedSessions[sessionId];

          const restoredSession = session
            ? {
                ...(state.sessions[sessionId] ?? existing ?? createSession(sessionId)),
                status: session.status,
                title: session.title,
                cwd: session.cwd,
                model: session.model ?? existing?.model,
                slashCommands: session.slashCommands,
                ...hydrateWorkflowView(
                  session.workflowMarkdown,
                  session.workflowState,
                  session.workflowSourceLayer,
                  session.workflowSourcePath,
                  session.workflowError,
                ),
                archivedAt: undefined,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
              }
            : existing
              ? { ...existing, archivedAt: undefined }
              : undefined;

          return {
            archivedSessions: nextArchivedSessions,
            sessions: restoredSession
              ? { ...state.sessions, [sessionId]: restoredSession }
              : state.sessions,
          };
        });
        break;
      }

      case "session.deleted": {
        const { sessionId } = event.payload;
        const state = get();

        const nextSessions = { ...state.sessions };
        delete nextSessions[sessionId];
        const nextArchivedSessions = { ...state.archivedSessions };
        delete nextArchivedSessions[sessionId];

        const nextHistoryRequested = new Set(state.historyRequested);
        nextHistoryRequested.delete(sessionId);

        const hasRemaining = Object.keys(nextSessions).length > 0;

        set({
          sessions: nextSessions,
          archivedSessions: nextArchivedSessions,
          historyRequested: nextHistoryRequested,
          browserWorkbenchBySessionId: Object.fromEntries(
            Object.entries(state.browserWorkbenchBySessionId).filter(([id]) => id !== sessionId),
          ),
          codeReferencesBySessionId: Object.fromEntries(
            Object.entries(state.codeReferencesBySessionId).filter(([id]) => id !== sessionId),
          ),
          messageReferencesBySessionId: Object.fromEntries(
            Object.entries(state.messageReferencesBySessionId).filter(([id]) => id !== sessionId),
          ),
          fileReferencesBySessionId: Object.fromEntries(
            Object.entries(state.fileReferencesBySessionId).filter(([id]) => id !== sessionId),
          ),
          showStartModal: !hasRemaining
        });

        if (state.activeSessionId === sessionId) {
          const remaining = Object.values(nextSessions).sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
          );
          get().setActiveSessionId(remaining[0]?.id ?? null);
        }
        break;
      }

      case "stream.message": {
        const { sessionId, message } = event.payload;
        if (isTransientStreamEventMessage(message)) {
          break;
        }
        enqueueStreamMessages(sessionId, [message]);
        break;
      }

      case "stream.user_prompt": {
        const { sessionId, prompt, attachments, capturedAt = Date.now(), historyId } = event.payload;
        enqueueStreamMessages(sessionId, [{ type: "user_prompt", prompt, attachments, capturedAt, historyId }]);
        break;
      }

      case "permission.request": {
        const { sessionId, toolUseId, toolName, input } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                permissionRequests: [...existing.permissionRequests, { toolUseId, toolName, input }]
              }
            }
          };
        });
        break;
      }

      case "runner.error": {
        set({ globalError: event.payload.message });
        break;
      }

      case "agent.list": {
        set({ availableAgents: event.payload.agents });
        break;
      }
    }
  }
}));

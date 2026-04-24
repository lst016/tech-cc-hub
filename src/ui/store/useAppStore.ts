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
  createdAt?: number;
  updatedAt?: number;
  hydrated: boolean;
  hasMoreHistory: boolean;
  historyCursor?: SessionHistoryCursor;
};

interface AppState {
  sessions: Record<string, SessionView>;
  activeSessionId: string | null;
  prompt: string;
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

  setPrompt: (prompt: string) => void;
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

export const useAppStore = create<AppState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  prompt: "",
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

  setPrompt: (prompt) => set({ prompt }),
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

    switch (event.type) {
      case "session.list": {
        const nextSessions: Record<string, SessionView> = {};
        for (const session of event.payload.sessions) {
          const existing = state.sessions[session.id] ?? createSession(session.id);
          nextSessions[session.id] = {
            ...existing,
            status: session.status,
            title: session.title,
            cwd: session.cwd,
            slashCommands: session.slashCommands ?? existing.slashCommands,
            ...hydrateWorkflowView(
              session.workflowMarkdown,
              session.workflowState,
              session.workflowSourceLayer,
              session.workflowSourcePath,
              session.workflowError,
            ),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          };
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
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          const mergedMessages = mode === "prepend"
            ? mergeMessages(messages, existing.messages)
            : messages;
          const slashCommands = mergeSlashCommandLists(
            event.payload.slashCommands,
            extractSlashCommands(mergedMessages),
          );
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                status,
                messages: mergedMessages,
                slashCommands: slashCommands ?? existing.slashCommands,
                hydrated: true,
                hasMoreHistory: hasMore,
                historyCursor: nextCursor,
              }
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
        const { sessionId, status, title, cwd, slashCommands } = event.payload;
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

      case "session.deleted": {
        const { sessionId } = event.payload;
        const state = get();

        const nextSessions = { ...state.sessions };
        delete nextSessions[sessionId];

        const nextHistoryRequested = new Set(state.historyRequested);
        nextHistoryRequested.delete(sessionId);

        const hasRemaining = Object.keys(nextSessions).length > 0;

        set({
          sessions: nextSessions,
          historyRequested: nextHistoryRequested,
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
        const slashCommands = mergeSlashCommandLists(extractSlashCommands([message]));
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          const trimmed = trimMessagesToRecent(
            [...existing.messages, message],
            existing.historyCursor,
          );
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                slashCommands: slashCommands ?? existing.slashCommands,
                messages: trimmed.messages,
                hasMoreHistory: trimmed.trimmed ? true : existing.hasMoreHistory,
                historyCursor: trimmed.trimmed ? trimmed.historyCursor ?? existing.historyCursor : existing.historyCursor,
              }
            }
          };
        });
        break;
      }

      case "stream.user_prompt": {
        const { sessionId, prompt, attachments, capturedAt = Date.now(), historyId } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          const trimmed = trimMessagesToRecent(
            [...existing.messages, { type: "user_prompt", prompt, attachments, capturedAt, historyId }],
            existing.historyCursor,
          );
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                messages: trimmed.messages,
                hasMoreHistory: trimmed.trimmed ? true : existing.hasMoreHistory,
                historyCursor: trimmed.trimmed ? trimmed.historyCursor ?? existing.historyCursor : existing.historyCursor,
              }
            }
          };
        });
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
    }
  }
}));

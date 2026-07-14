import { create } from 'zustand';
import type {
  ApiConfigProfile,
  ApiConfigSettings,
  RuntimePermissionMode,
  RuntimeReasoningMode,
  RuntimeOverrides,
  RuntimeWorkflowMode,
  SessionHistoryCursor,
  SessionWorkflowCatalog,
  ServerEvent,
  SessionStatus,
  StreamMessage,
} from "../types.js";
import {
  type SessionWorkflowState,
  type WorkflowScope,
  type WorkflowSpecDocument,
} from "../../shared/workflow-markdown.js";
import type { SessionExecutionMode } from "../../shared/session-semantics.js";
import { deriveLatestGoalSnapshot, type SessionGoalSnapshot } from "../../shared/goal-progress.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands.js";
import { TASK_TOOL_NAMES } from "../../shared/claude-agent-teams.js";
import {
  normalizeTaskCreateArgs,
  normalizeUpdatePlanArgs,
  type SessionPlanSnapshot,
} from "../../shared/plan-progress.js";
import { mergeHistoryReplacementMessages, mergeMessages } from "../utils/session-history-merge.js";
import { hydrateWorkflowView, mergeSessionListSession } from "../utils/session-list-merge.js";
import { appendPendingStreamMessages } from "../utils/pending-stream-messages.js";
import { selectSessionMessageEvictionIds, touchRecentSessionId } from "../utils/session-message-retention.js";

let recentlyActivatedSessionIds: string[] = [];

export type PermissionRequest = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type SessionView = {
  id: string;
  title: string;
  status: SessionStatus;
  error?: string;
  model?: string;
  executionMode?: SessionExecutionMode;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: RuntimeOverrides["permissionMode"];
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
  latestGoal?: SessionGoalSnapshot;
  latestPlan?: SessionPlanSnapshot;
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

export function getPromptDraftSessionKey(sessionId?: string | null) {
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
  kind: "selection" | "message" | "comment";
  sourceRole: "user" | "assistant" | "tool" | "system";
  sourceLabel: string;
  text: string;
  comment?: string;
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
  promptDraftsBySessionId: Record<string, string>;
  browserAnnotations: BrowserWorkbenchAnnotation[];
  browserWorkbenchBySessionId: Record<string, BrowserWorkbenchSessionState>;
  previewExpandedPathsByWorkspace: Record<string, string[]>;
  codeReferencesBySessionId: Record<string, CodeReferenceDraft[]>;
  messageReferencesBySessionId: Record<string, MessageReferenceDraft[]>;
  fileReferencesBySessionId: Record<string, FileReferenceDraft[]>;
  cwd: string;
  apiConfigSettings: ApiConfigSettings;
  runtimeModel: string;
  reasoningMode: RuntimeReasoningMode;
  permissionMode: RuntimePermissionMode;
  workflowMode: RuntimeWorkflowMode;
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
  setPreviewExpandedPaths: (workspace: string, paths: string[]) => void;
  resetPreviewExpandedPaths: (workspace: string, rootPath?: string) => void;
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
  setSessionModel: (sessionId: string | null | undefined, model: string) => void;
  setReasoningMode: (mode: RuntimeReasoningMode) => void;
  setPermissionMode: (mode: RuntimePermissionMode) => void;
  setWorkflowMode: (workflowMode: RuntimeWorkflowMode) => void;
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

function getEnabledProfiles(settings: ApiConfigSettings): ApiConfigProfile[] {
  const enabledProfiles = settings.profiles.filter((profile) => profile.enabled);
  if (enabledProfiles.length > 0) {
    return enabledProfiles;
  }
  return settings.profiles[0] ? [settings.profiles[0]] : [];
}

function getAvailableModelsForProfiles(profiles: ApiConfigProfile[]): string[] {
  return Array.from(
    new Set(profiles.flatMap((profile) => [
      profile.model,
      profile.expertModel,
      profile.smallModel,
      profile.imageModel,
      profile.analysisModel,
      ...(profile.models ?? []).map((item) => item.name),
    ])),
  )
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);
}

function hasApiProfiles(settings: ApiConfigSettings): boolean {
  return settings.profiles.length > 0;
}

function extractSlashCommands(messages: StreamMessage[]): string[] | undefined {
  return extractSlashCommandsFromMessages(messages);
}

function isTransientStreamEventMessage(message: StreamMessage): boolean {
  return (
    "type" in message &&
    (
      message.type === "stream_event" ||
      (
        message.type === "system" &&
        "subtype" in message &&
        (message.subtype === "status" || message.subtype === "thinking_tokens")
      )
    )
  );
}

const STREAM_MESSAGE_BATCH_DELAY_MS = 32;

let pendingStreamMessageTimer: ReturnType<typeof setTimeout> | null = null;
const pendingStreamMessagesBySession = new Map<string, StreamMessage[]>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGoalToolNameCandidate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const name = value.trim();
  return (
    name === "create_goal" ||
    name === "update_goal" ||
    name === "get_goal" ||
    name.endsWith("__create_goal") ||
    name.endsWith("__update_goal") ||
    name.endsWith("__get_goal") ||
    name.endsWith(":create_goal") ||
    name.endsWith(":update_goal") ||
    name.endsWith(":get_goal") ||
    name.endsWith("/create_goal") ||
    name.endsWith("/update_goal") ||
    name.endsWith("/get_goal")
  );
}

function messageMayAffectGoalSnapshot(message: StreamMessage): boolean {
  if (message.type === "user_prompt") {
    return typeof message.prompt === "string" && /^\s*\/goal(?:\s|$)/i.test(message.prompt);
  }

  if (message.type === "assistant" && isRecord(message.message)) {
    const content = Array.isArray(message.message.content) ? message.message.content : [];
    return content.some((item) => (
      isRecord(item) &&
      item.type === "tool_use" &&
      isGoalToolNameCandidate(item.name)
    ));
  }

  if (message.type === "user" && isRecord(message.message)) {
    const content = Array.isArray(message.message.content) ? message.message.content : [];
    return content.some((item) => isRecord(item) && item.type === "tool_result");
  }

  return false;
}

function extractPlanSnapshotFromMessage(sessionId: string, message: StreamMessage): SessionPlanSnapshot | null {
  if (message.type !== "assistant") return null;
  const content = (message as { message?: { content?: unknown[] }; uuid?: string }).message?.content;
  if (!Array.isArray(content)) return null;

  let snapshot: SessionPlanSnapshot | null = null;
  for (const item of content) {
    if (!isRecord(item) || item.type !== "tool_use") continue;
    const toolName = typeof item.name === "string" ? item.name : "";
    const toolUseId = typeof item.id === "string" ? item.id : undefined;
    const turnId = typeof (message as { uuid?: unknown }).uuid === "string"
      ? (message as { uuid: string }).uuid
      : undefined;

    if (toolName === "update_plan" || toolName.endsWith("__update_plan") || toolName.endsWith(":update_plan") || toolName.endsWith("/update_plan")) {
      const args = normalizeUpdatePlanArgs(item.input);
      if (args) {
        snapshot = {
          sessionId,
          turnId,
          updatedAt: message.capturedAt ?? Date.now(),
          source: "update_plan",
          toolName,
          toolUseId,
          ...args,
        };
      }
      continue;
    }

    if ((TASK_TOOL_NAMES as readonly string[]).includes(toolName)) {
      const input = toolName === "TaskUpdate"
        ? { item: item.input }
        : item.input;
      const args = normalizeTaskCreateArgs(input);
      if (args) {
        snapshot = {
          sessionId,
          turnId,
          updatedAt: message.capturedAt ?? Date.now(),
          source: "task_create",
          toolName,
          toolUseId,
          ...args,
        };
      }
    }
  }

  return snapshot;
}

function deriveLatestPlanSnapshot(
  sessionId: string,
  messages: StreamMessage[],
  fallback?: SessionPlanSnapshot,
): SessionPlanSnapshot | undefined {
  return messages.reduce<SessionPlanSnapshot | undefined>((latest, message) => (
    extractPlanSnapshotFromMessage(sessionId, message) ?? latest
  ), fallback);
}

export function appendMessagesToSession(
  session: SessionView,
  nextMessages: StreamMessage[],
): SessionView {
  const slashCommands = mergeSlashCommandLists(
    session.slashCommands,
    ...nextMessages.map((message) => extractSlashCommands([message])),
  );
  const messages = session.messages.concat(nextMessages);
  const shouldUpdateGoal = nextMessages.some(messageMayAffectGoalSnapshot);

  return {
    ...session,
    slashCommands: slashCommands ?? session.slashCommands,
    messages,
    latestGoal: shouldUpdateGoal ? deriveLatestGoalSnapshot(session.id, messages, session.latestGoal) : session.latestGoal,
    latestPlan: deriveLatestPlanSnapshot(session.id, nextMessages, session.latestPlan),
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: {},
  archivedSessions: {},
  activeSessionId: null,
  prompt: "",
  promptDraftsBySessionId: {},
  browserAnnotations: [],
  browserWorkbenchBySessionId: {},
  previewExpandedPathsByWorkspace: {},
  codeReferencesBySessionId: {},
  messageReferencesBySessionId: {},
  fileReferencesBySessionId: {},
  cwd: "",
  apiConfigSettings: { profiles: [] },
  runtimeModel: "",
  reasoningMode: "xhigh",
  pendingStart: false,
  globalError: null,
  permissionMode: "bypassPermissions",
  workflowMode: "auto",
  sessionsLoaded: false,
  showStartModal: false,
  showSettingsModal: false,
  historyRequested: new Set(),
  apiConfigChecked: false,
  availableAgents: [],
  selectedAgentId: "",

  setPrompt: (prompt) => set((state) => {
    const sessionKey = getPromptDraftSessionKey(state.activeSessionId);
    const nextDrafts = { ...state.promptDraftsBySessionId };
    if (prompt.length === 0) {
      delete nextDrafts[sessionKey];
    } else {
      nextDrafts[sessionKey] = prompt;
    }
    return {
      prompt,
      promptDraftsBySessionId: nextDrafts,
    };
  }),
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
  setPreviewExpandedPaths: (workspace, paths) => set((state) => {
    const key = workspace.trim();
    if (!key) return state;
    const uniquePaths = Array.from(new Set(paths.map((item) => item.trim()).filter(Boolean)));
    return {
      previewExpandedPathsByWorkspace: {
        ...state.previewExpandedPathsByWorkspace,
        [key]: uniquePaths.length > 0 ? uniquePaths : [key],
      },
    };
  }),
  resetPreviewExpandedPaths: (workspace, rootPath) => set((state) => {
    const key = workspace.trim();
    if (!key) return state;
    return {
      previewExpandedPathsByWorkspace: {
        ...state.previewExpandedPathsByWorkspace,
        [key]: [rootPath?.trim() || key],
      },
    };
  }),
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
      comment: reference.comment?.trim() || undefined,
      sourceLabel: reference.sourceLabel.trim() || reference.sourceRole,
    };

    set((state) => {
      const existing = state.messageReferencesBySessionId[sessionKey] ?? [];
      const withoutDuplicate = existing.filter((item) => !(
        item.sourceRole === nextReference.sourceRole
        && item.sourceLabel === nextReference.sourceLabel
        && item.text === nextReference.text
        && item.capturedAt === nextReference.capturedAt
        && (
          item.kind === nextReference.kind
          || (item.kind !== "message" && nextReference.kind !== "message")
        )
      ));
      return {
        messageReferencesBySessionId: {
          ...state.messageReferencesBySessionId,
          [sessionKey]: [...withoutDuplicate, nextReference],
        },
      };
    });

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
      const nextApiConfigSettings = hasApiProfiles(apiConfigSettings) || !hasApiProfiles(state.apiConfigSettings)
        ? apiConfigSettings
        : state.apiConfigSettings;
      const enabledProfiles = getEnabledProfiles(nextApiConfigSettings);
      const enabledProfile = enabledProfiles[0];
      const availableModels = getAvailableModelsForProfiles(enabledProfiles);
      const runtimeModel = availableModels.includes(state.runtimeModel)
        ? state.runtimeModel
        : (enabledProfile?.model || availableModels[0] || "");

      return {
        apiConfigSettings: nextApiConfigSettings,
        runtimeModel,
      };
    });
  },
  setRuntimeModel: (runtimeModel) => set({ runtimeModel }),
  setSessionModel: (sessionId, model) => {
    if (!sessionId) return;
    const nextModel = model.trim() || undefined;
    set((state) => {
      const activeSession = state.sessions[sessionId];
      if (activeSession) {
        return {
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...activeSession,
              model: nextModel,
              updatedAt: Date.now(),
            },
          },
        };
      }

      const archivedSession = state.archivedSessions[sessionId];
      if (archivedSession) {
        return {
          archivedSessions: {
            ...state.archivedSessions,
            [sessionId]: {
              ...archivedSession,
              model: nextModel,
              updatedAt: Date.now(),
            },
          },
        };
      }

      return {};
    });
  },
  setReasoningMode: (reasoningMode) => set({ reasoningMode }),
  setPermissionMode: (permissionMode) => set({ permissionMode }),
  setWorkflowMode: (workflowMode) => set({ workflowMode }),
  setPendingStart: (pendingStart) => set({ pendingStart }),
  setGlobalError: (globalError) => set({ globalError }),
  setShowStartModal: (showStartModal) => set({ showStartModal }),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
  setActiveSessionId: (id) => set((state) => {
    recentlyActivatedSessionIds = touchRecentSessionId(recentlyActivatedSessionIds, id);
    const evictionIds = selectSessionMessageEvictionIds(state.sessions, recentlyActivatedSessionIds, id);
    if (evictionIds.length === 0) {
      return {
        activeSessionId: id,
        prompt: state.promptDraftsBySessionId[getPromptDraftSessionKey(id)] ?? "",
      };
    }

    const sessions = { ...state.sessions };
    const historyRequested = new Set(state.historyRequested);
    for (const sessionId of evictionIds) {
      const session = sessions[sessionId];
      if (!session) continue;
      sessions[sessionId] = {
        ...session,
        messages: [],
        hydrated: false,
        hasMoreHistory: false,
        historyCursor: undefined,
      };
      historyRequested.delete(sessionId);
    }

    return {
      activeSessionId: id,
      prompt: state.promptDraftsBySessionId[getPromptDraftSessionKey(id)] ?? "",
      sessions,
      historyRequested,
    };
  }),
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
      pendingStreamMessagesBySession.set(
        sessionId,
        appendPendingStreamMessages(existing, messages),
      );

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
          nextSessions[session.id] = mergeSessionListSession(existing, session);
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
          break;
        }

        const activeStillExists = Boolean(state.activeSessionId)
          && event.payload.sessions.some((session) => session.id === state.activeSessionId);
        if (!activeStillExists) {
          const latestSession = [...event.payload.sessions]
            .sort((a, b) => {
              const aTime = a.updatedAt ?? a.createdAt ?? 0;
              const bTime = b.updatedAt ?? b.createdAt ?? 0;
              return aTime - bTime;
            })
            .at(-1);
          get().setActiveSessionId(latestSession?.id ?? null);
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
            : mergeHistoryReplacementMessages(messages, existing, status);
          const slashCommands = mergeSlashCommandLists(
            event.payload.slashCommands,
            extractSlashCommands(mergedMessages),
          );
          const nextSession = {
            ...existing,
            status,
            messages: mergedMessages,
            slashCommands: slashCommands ?? existing.slashCommands,
            latestGoal: deriveLatestGoalSnapshot(sessionId, mergedMessages, existing.latestGoal),
            latestPlan: deriveLatestPlanSnapshot(sessionId, mergedMessages, existing.latestPlan),
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

      case "desktop.notification.opened": {
        const target = event.payload.target;
        const sessionId = "sessionId" in target ? target.sessionId : undefined;
        if (sessionId) {
          get().setActiveSessionId(sessionId);
        }
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
        const { sessionId, status, title, cwd, model, executionMode, reasoningMode, permissionMode, slashCommands } = event.payload;
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
                executionMode: executionMode ?? existing.executionMode,
                reasoningMode: reasoningMode ?? existing.reasoningMode,
                permissionMode: permissionMode ?? existing.permissionMode,
                slashCommands: slashCommands ?? existing.slashCommands,
                error: event.payload.error,
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

      case "session.plan.updated": {
        const snapshot = event.payload;
        set((state) => {
          const updateArchived = Boolean(state.archivedSessions[snapshot.sessionId]) && !state.sessions[snapshot.sessionId];
          const existing = (updateArchived ? state.archivedSessions[snapshot.sessionId] : state.sessions[snapshot.sessionId])
            ?? createSession(snapshot.sessionId);
          const nextSession: SessionView = {
            ...existing,
            latestPlan: snapshot,
            updatedAt: snapshot.updatedAt,
          };

          if (updateArchived) {
            return {
              archivedSessions: {
                ...state.archivedSessions,
                [snapshot.sessionId]: nextSession,
              },
            };
          }

          return {
            sessions: {
              ...state.sessions,
              [snapshot.sessionId]: nextSession,
            },
          };
        });
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
                executionMode: session.executionMode ?? existing?.executionMode,
                reasoningMode: session.reasoningMode ?? existing?.reasoningMode,
                permissionMode: session.permissionMode ?? existing?.permissionMode,
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
                executionMode: session.executionMode ?? existing?.executionMode,
                reasoningMode: session.reasoningMode ?? existing?.reasoningMode,
                permissionMode: session.permissionMode ?? existing?.permissionMode,
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

      case "session.renamed": {
        const { sessionId, title, updatedAt } = event.payload;
        set((state) => {
          const nextSessions = { ...state.sessions };
          const nextArchivedSessions = { ...state.archivedSessions };
          let changed = false;

          if (nextSessions[sessionId]) {
            nextSessions[sessionId] = {
              ...nextSessions[sessionId],
              title,
              updatedAt,
            };
            changed = true;
          }

          if (nextArchivedSessions[sessionId]) {
            nextArchivedSessions[sessionId] = {
              ...nextArchivedSessions[sessionId],
              title,
              updatedAt,
            };
            changed = true;
          }

          if (!changed) {
            return {};
          }

          return {
            sessions: nextSessions,
            archivedSessions: nextArchivedSessions,
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
          promptDraftsBySessionId: Object.fromEntries(
            Object.entries(state.promptDraftsBySessionId).filter(([id]) => id !== sessionId),
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

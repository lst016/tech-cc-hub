import { create, type StateCreator } from "zustand";
import { createStore } from "zustand/vanilla";

import type {
  PromptAttachment,
  RuntimePermissionMode,
  RuntimeReasoningMode,
  ServerEvent,
  SessionStatus,
  StreamMessage,
} from "../types.js";

export type BtwPermissionRequest = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type BtwThreadView = {
  id: string;
  parentSessionId: string;
  title: string;
  status: SessionStatus;
  cwd?: string;
  model?: string;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: RuntimePermissionMode;
  messages: StreamMessage[];
  partialMessage: string;
  partialVisible: boolean;
  permissionRequests: BtwPermissionRequest[];
  draft: string;
  attachments: PromptAttachment[];
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export type BtwState = {
  threads: Record<string, BtwThreadView>;
  threadIdsByParent: Record<string, string[]>;
  activeThreadIdByParent: Record<string, string>;
  handleServerEvent: (event: ServerEvent) => void;
  setActiveThread: (parentSessionId: string, threadId: string) => void;
  setDraft: (threadId: string, draft: string) => void;
  setAttachments: (threadId: string, attachments: PromptAttachment[]) => void;
  setModel: (threadId: string, model: string) => void;
  setReasoningMode: (threadId: string, mode: RuntimeReasoningMode) => void;
  setThreadError: (threadId: string, error: string | null) => void;
  resolvePermissionRequest: (threadId: string, toolUseId: string) => void;
  clearThread: (threadId: string) => void;
  clearParent: (parentSessionId: string) => void;
};

type StreamEventLike = {
  type: "stream_event";
  event?: {
    type?: string;
    delta?: Record<string, unknown> & { type?: string };
  };
};

function updateThread(
  state: BtwState,
  threadId: string,
  update: (thread: BtwThreadView) => BtwThreadView,
): Partial<BtwState> | BtwState {
  const thread = state.threads[threadId];
  if (!thread) return state;
  return {
    threads: {
      ...state.threads,
      [threadId]: update(thread),
    },
  };
}

function extractPartialDelta(message: StreamMessage): { kind: "start" | "delta" | "stop" | "other"; text: string } {
  const streamMessage = message as unknown as StreamEventLike;
  if (streamMessage.type !== "stream_event") return { kind: "other", text: "" };
  if (streamMessage.event?.type === "content_block_start") return { kind: "start", text: "" };
  if (streamMessage.event?.type === "content_block_stop") return { kind: "stop", text: "" };
  if (streamMessage.event?.type !== "content_block_delta") return { kind: "other", text: "" };
  const delta = streamMessage.event.delta;
  const valueKey = delta?.type?.split("_")[0];
  const value = valueKey ? delta?.[valueKey] : undefined;
  return { kind: "delta", text: typeof value === "string" ? value : "" };
}

function removeThreadState(state: BtwState, threadId: string, parentSessionId: string): Partial<BtwState> {
  const currentIds = state.threadIdsByParent[parentSessionId] ?? [];
  const removedIndex = currentIds.indexOf(threadId);
  const nextIds = currentIds.filter((id) => id !== threadId);
  const threads = { ...state.threads };
  delete threads[threadId];
  const threadIdsByParent = { ...state.threadIdsByParent };
  const activeThreadIdByParent = { ...state.activeThreadIdByParent };
  if (nextIds.length === 0) {
    delete threadIdsByParent[parentSessionId];
    delete activeThreadIdByParent[parentSessionId];
  } else {
    threadIdsByParent[parentSessionId] = nextIds;
    if (activeThreadIdByParent[parentSessionId] === threadId) {
      activeThreadIdByParent[parentSessionId] = nextIds[Math.min(Math.max(removedIndex, 0), nextIds.length - 1)];
    }
  }
  return { threads, threadIdsByParent, activeThreadIdByParent };
}

function clearParentState(state: BtwState, parentSessionId: string): Partial<BtwState> {
  const threads = { ...state.threads };
  for (const threadId of state.threadIdsByParent[parentSessionId] ?? []) delete threads[threadId];
  const threadIdsByParent = { ...state.threadIdsByParent };
  const activeThreadIdByParent = { ...state.activeThreadIdByParent };
  delete threadIdsByParent[parentSessionId];
  delete activeThreadIdByParent[parentSessionId];
  return { threads, threadIdsByParent, activeThreadIdByParent };
}

const createBtwState: StateCreator<BtwState> = (set) => ({
  threads: {},
  threadIdsByParent: {},
  activeThreadIdByParent: {},

  handleServerEvent: (event) => {
    if (event.type === "btw.thread.created") {
      set((state) => {
        const { payload } = event;
        const existingIds = state.threadIdsByParent[payload.parentSessionId] ?? [];
        const ids = existingIds.includes(payload.threadId) ? existingIds : [...existingIds, payload.threadId];
        return {
          threads: {
            ...state.threads,
            [payload.threadId]: {
              id: payload.threadId,
              parentSessionId: payload.parentSessionId,
              title: payload.title,
              status: payload.status,
              cwd: payload.cwd,
              model: payload.model,
              reasoningMode: payload.reasoningMode,
              permissionMode: payload.permissionMode,
              messages: [],
              partialMessage: "",
              partialVisible: false,
              permissionRequests: [],
              draft: "",
              attachments: [],
              createdAt: payload.createdAt,
              updatedAt: payload.updatedAt,
            },
          },
          threadIdsByParent: { ...state.threadIdsByParent, [payload.parentSessionId]: ids },
          activeThreadIdByParent: { ...state.activeThreadIdByParent, [payload.parentSessionId]: payload.threadId },
        };
      });
      return;
    }

    if (event.type === "btw.thread.status") {
      set((state) => updateThread(state, event.payload.threadId, (thread) => ({
        ...thread,
        status: event.payload.status,
        title: event.payload.title ?? thread.title,
        model: event.payload.model ?? thread.model,
        reasoningMode: event.payload.reasoningMode ?? thread.reasoningMode,
        permissionMode: event.payload.permissionMode ?? thread.permissionMode,
        error: event.payload.error,
        partialVisible: event.payload.status === "running" ? thread.partialVisible : false,
        updatedAt: event.payload.updatedAt,
      })));
      return;
    }

    if (event.type === "btw.stream.user_prompt") {
      set((state) => updateThread(state, event.payload.threadId, (thread) => ({
        ...thread,
        messages: [...thread.messages, {
          type: "user_prompt",
          prompt: event.payload.prompt,
          attachments: event.payload.attachments,
          capturedAt: event.payload.capturedAt,
        } as StreamMessage],
        draft: "",
        attachments: [],
        error: undefined,
      })));
      return;
    }

    if (event.type === "btw.stream.message") {
      const partial = extractPartialDelta(event.payload.message);
      set((state) => updateThread(state, event.payload.threadId, (thread) => {
        if (partial.kind === "start") return { ...thread, partialMessage: "", partialVisible: true };
        if (partial.kind === "delta") return { ...thread, partialMessage: `${thread.partialMessage}${partial.text}`, partialVisible: true };
        if (partial.kind === "stop") return { ...thread, partialMessage: "", partialVisible: false };
        return { ...thread, messages: [...thread.messages, event.payload.message] };
      }));
      return;
    }

    if (event.type === "btw.permission.request") {
      set((state) => updateThread(state, event.payload.threadId, (thread) => ({
        ...thread,
        permissionRequests: [...thread.permissionRequests, {
          toolUseId: event.payload.toolUseId,
          toolName: event.payload.toolName,
          input: event.payload.input,
        }],
      })));
      return;
    }

    if (event.type === "btw.runner.error") {
      set((state) => updateThread(state, event.payload.threadId, (thread) => ({
        ...thread,
        error: event.payload.message,
      })));
      return;
    }

    if (event.type === "btw.thread.closed") {
      set((state) => removeThreadState(state, event.payload.threadId, event.payload.parentSessionId));
      return;
    }

    if (event.type === "btw.parent.closed") {
      set((state) => clearParentState(state, event.payload.parentSessionId));
    }
  },

  setActiveThread: (parentSessionId, threadId) => set((state) => {
    if (!state.threadIdsByParent[parentSessionId]?.includes(threadId)) return state;
    return { activeThreadIdByParent: { ...state.activeThreadIdByParent, [parentSessionId]: threadId } };
  }),
  setDraft: (threadId, draft) => set((state) => updateThread(state, threadId, (thread) => ({ ...thread, draft }))),
  setAttachments: (threadId, attachments) => set((state) => updateThread(state, threadId, (thread) => ({ ...thread, attachments }))),
  setModel: (threadId, model) => set((state) => updateThread(state, threadId, (thread) => ({ ...thread, model }))),
  setReasoningMode: (threadId, reasoningMode) => set((state) => updateThread(state, threadId, (thread) => ({ ...thread, reasoningMode }))),
  setThreadError: (threadId, error) => set((state) => updateThread(state, threadId, (thread) => ({ ...thread, error: error ?? undefined }))),
  resolvePermissionRequest: (threadId, toolUseId) => set((state) => updateThread(state, threadId, (thread) => ({
    ...thread,
    permissionRequests: thread.permissionRequests.filter((request) => request.toolUseId !== toolUseId),
  }))),
  clearThread: (threadId) => set((state) => {
    const thread = state.threads[threadId];
    return thread ? removeThreadState(state, threadId, thread.parentSessionId) : state;
  }),
  clearParent: (parentSessionId) => set((state) => clearParentState(state, parentSessionId)),
});

export function createBtwStore() {
  return createStore<BtwState>(createBtwState);
}

export const useBtwStore = create<BtwState>(createBtwState);

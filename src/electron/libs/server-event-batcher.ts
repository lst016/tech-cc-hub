import type { SDKPartialAssistantMessage } from "@anthropic-ai/claude-agent-sdk";

import type { ServerEvent } from "../types.js";

type StreamMessageEvent = Extract<ServerEvent, { type: "stream.message" }>;
type PartialStreamMessage = SDKPartialAssistantMessage & {
  capturedAt?: number;
  historyId?: string;
};
type ContentBlockDeltaEvent = Extract<
  SDKPartialAssistantMessage["event"],
  { type: "content_block_delta" }
>;
type TextDeltaEvent = Omit<ContentBlockDeltaEvent, "delta"> & {
  delta: Extract<ContentBlockDeltaEvent["delta"], { type: "text_delta" }>;
};
type ThinkingDeltaEvent = Omit<ContentBlockDeltaEvent, "delta"> & {
  delta: Extract<ContentBlockDeltaEvent["delta"], { type: "thinking_delta" }>;
};

type MergeableDelta =
  | {
      kind: "text_delta";
      key: string;
      serverEvent: StreamMessageEvent;
      message: PartialStreamMessage;
      rawEvent: TextDeltaEvent;
    }
  | {
      kind: "thinking_delta";
      key: string;
      serverEvent: StreamMessageEvent;
      message: PartialStreamMessage;
      rawEvent: ThinkingDeltaEvent;
    };

export type ServerEventBatcherTimerHandle = {
  unref?: () => void;
};

export type ServerEventBatcherOptions = {
  send: (event: ServerEvent) => void;
  flushMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => ServerEventBatcherTimerHandle;
  clearTimer?: (handle: ServerEventBatcherTimerHandle) => void;
};

export type ServerEventBatcher = {
  enqueue: (event: ServerEvent) => void;
  flush: () => void;
  dispose: () => void;
};

const DEFAULT_FLUSH_MS = 50;

function inspectMergeableDelta(event: ServerEvent): MergeableDelta | null {
  if (event.type !== "stream.message") return null;
  const message = event.payload.message;
  if (message.type !== "stream_event") return null;
  const rawEvent = message.event;
  if (rawEvent.type !== "content_block_delta") return null;
  if (rawEvent.delta.type !== "text_delta" && rawEvent.delta.type !== "thinking_delta") return null;

  const partialMessage = message as PartialStreamMessage;
  const key = [
    event.payload.sessionId,
    partialMessage.session_id,
    partialMessage.parent_tool_use_id ?? "",
    rawEvent.index,
    rawEvent.delta.type,
  ].join("\0");

  if (rawEvent.delta.type === "text_delta") {
    return {
      kind: "text_delta",
      key,
      serverEvent: event,
      message: partialMessage,
      rawEvent: rawEvent as TextDeltaEvent,
    };
  }

  return {
    kind: "thinking_delta",
    key,
    serverEvent: event,
    message: partialMessage,
    rawEvent: rawEvent as ThinkingDeltaEvent,
  };
}

function mergeCompatibleDeltas(previous: MergeableDelta, next: MergeableDelta): MergeableDelta | null {
  if (previous.key !== next.key || previous.kind !== next.kind) return null;
  const capturedAt = next.message.capturedAt ?? previous.message.capturedAt;

  if (previous.kind === "text_delta" && next.kind === "text_delta") {
    const message: PartialStreamMessage = {
      ...previous.message,
      capturedAt,
      event: {
        ...previous.rawEvent,
        delta: {
          ...previous.rawEvent.delta,
          text: previous.rawEvent.delta.text + next.rawEvent.delta.text,
        },
      },
    };
    return inspectMergeableDelta({
      ...previous.serverEvent,
      payload: { ...previous.serverEvent.payload, message },
    });
  }

  if (previous.kind === "thinking_delta" && next.kind === "thinking_delta") {
    const message: PartialStreamMessage = {
      ...previous.message,
      capturedAt,
      event: {
        ...previous.rawEvent,
        delta: {
          ...previous.rawEvent.delta,
          thinking: previous.rawEvent.delta.thinking + next.rawEvent.delta.thinking,
        },
      },
    };
    return inspectMergeableDelta({
      ...previous.serverEvent,
      payload: { ...previous.serverEvent.payload, message },
    });
  }

  return null;
}

export function createServerEventBatcher(options: ServerEventBatcherOptions): ServerEventBatcher {
  const flushMs = Math.max(0, options.flushMs ?? DEFAULT_FLUSH_MS);
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  });
  let pending: MergeableDelta | null = null;
  let timer: ServerEventBatcherTimerHandle | null = null;
  let disposed = false;

  const cancelTimer = (): void => {
    if (!timer) return;
    clearTimer(timer);
    timer = null;
  };

  const flush = (): void => {
    cancelTimer();
    if (!pending) return;
    const event = pending.serverEvent;
    pending = null;
    options.send(event);
  };

  const scheduleFlush = (): void => {
    if (timer) return;
    timer = setTimer(() => {
      timer = null;
      flush();
    }, flushMs);
    timer.unref?.();
  };

  const enqueue = (event: ServerEvent): void => {
    if (disposed) {
      options.send(event);
      return;
    }

    const next = inspectMergeableDelta(event);
    if (!next) {
      flush();
      options.send(event);
      return;
    }

    if (pending) {
      const merged = mergeCompatibleDeltas(pending, next);
      if (merged) {
        pending = merged;
        return;
      }
      flush();
    }

    pending = next;
    scheduleFlush();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    flush();
  };

  return { enqueue, flush, dispose };
}

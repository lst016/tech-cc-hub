import {
  forkSession as forkAgentSession,
  getSessionMessages as getAgentSessionMessages,
  type ForkSessionOptions,
  type ForkSessionResult,
  type GetSessionMessagesOptions,
  type SessionMessage,
} from "@anthropic-ai/claude-agent-sdk";

import type { StreamMessage } from "../../types.js";
import type { Session, SessionHistory, SessionStore } from "../session-store.js";

export type SessionForkStore = Pick<
  SessionStore,
  "getSession" | "getSessionHistory" | "createSession" | "updateSession" | "recordMessage"
>;

export type SessionForkSdk = {
  forkSession: (sessionId: string, options?: ForkSessionOptions) => Promise<ForkSessionResult>;
  getSessionMessages: (sessionId: string, options?: GetSessionMessagesOptions) => Promise<SessionMessage[]>;
};

export type ForkStoredSessionOptions = {
  store: SessionForkStore;
  sourceSessionId: string;
  upToMessageId: string;
  title?: string;
  sdk?: SessionForkSdk;
};

export type ForkStoredSessionResult = {
  session: Session;
  messages: StreamMessage[];
};

const defaultSdk: SessionForkSdk = {
  forkSession: forkAgentSession,
  getSessionMessages: getAgentSessionMessages,
};

function buildForkTitle(sourceTitle: string, requestedTitle?: string): string {
  const explicitTitle = requestedTitle?.trim();
  if (explicitTitle) return explicitTitle;
  const normalizedSourceTitle = sourceTitle.trim() || "新聊天";
  return `${normalizedSourceTitle}（分支）`;
}

function getMessageUuid(message: StreamMessage): string | undefined {
  if (!("uuid" in message) || typeof message.uuid !== "string") return undefined;
  return message.uuid;
}

function findForkPointIndex(messages: StreamMessage[], upToMessageId: string): number {
  return messages.findIndex((message) => (
    message.type === "assistant"
    && message.parent_tool_use_id === null
    && getMessageUuid(message) === upToMessageId
  ));
}

function findLatestUserPrompt(messages: StreamMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type === "user_prompt" && message.prompt.trim()) {
      return message.prompt;
    }
  }
  return undefined;
}

function buildForkedUuidMap(sourceMessages: SessionMessage[], forkedMessages: SessionMessage[]): Map<string, string> {
  if (sourceMessages.length !== forkedMessages.length) {
    throw new Error("Agent SDK 返回的分支消息数量与源会话不一致。");
  }

  const uuidMap = new Map<string, string>();
  sourceMessages.forEach((sourceMessage, index) => {
    const forkedMessage = forkedMessages[index];
    if (!forkedMessage || forkedMessage.type !== sourceMessage.type) {
      throw new Error("Agent SDK 返回的分支消息顺序与源会话不一致。");
    }
    uuidMap.set(sourceMessage.uuid, forkedMessage.uuid);
  });
  return uuidMap;
}

function cloneMessageForFork(
  message: StreamMessage,
  forkedClaudeSessionId: string,
  uuidMap: Map<string, string>,
): StreamMessage {
  const cloned = JSON.parse(JSON.stringify(message)) as StreamMessage;
  const sourceUuid = getMessageUuid(cloned);
  const mappedUuid = sourceUuid ? uuidMap.get(sourceUuid) : undefined;
  const nextHistoryId = mappedUuid ?? crypto.randomUUID();
  if (sourceUuid) {
    // Long-running local histories can include messages from an older SDK
    // session segment. They remain useful display context, but only messages
    // in the current SDK transcript receive a provider-owned fork UUID.
    (cloned as StreamMessage & { uuid: string }).uuid = mappedUuid ?? nextHistoryId;
  }
  if ("session_id" in cloned) {
    cloned.session_id = forkedClaudeSessionId;
  }
  cloned.historyId = nextHistoryId;
  return cloned;
}

function requireForkSource(
  store: SessionForkStore,
  sourceSessionId: string,
  upToMessageId: string,
): { sourceSession: Session; history: SessionHistory; localForkPointIndex: number } {
  const sourceSession = store.getSession(sourceSessionId);
  if (!sourceSession) {
    throw new Error("源会话不存在或已被删除。");
  }
  if (!sourceSession.claudeSessionId) {
    throw new Error("当前会话尚未建立可恢复的 Agent SDK 会话，无法 Fork。");
  }

  const history = store.getSessionHistory(sourceSessionId);
  if (!history) {
    throw new Error("无法读取源会话历史。");
  }
  const localForkPointIndex = findForkPointIndex(history.messages, upToMessageId);
  if (localForkPointIndex < 0) {
    throw new Error("找不到要 Fork 的助手消息。");
  }

  return { sourceSession, history, localForkPointIndex };
}

export async function forkStoredSession(options: ForkStoredSessionOptions): Promise<ForkStoredSessionResult> {
  const sourceSessionId = options.sourceSessionId.trim();
  const upToMessageId = options.upToMessageId.trim();
  if (!sourceSessionId || !upToMessageId) {
    throw new Error("Fork 缺少源会话或消息 ID。");
  }

  const { sourceSession, history, localForkPointIndex } = requireForkSource(
    options.store,
    sourceSessionId,
    upToMessageId,
  );
  const sourceClaudeSessionId = sourceSession.claudeSessionId!;
  const forkTitle = buildForkTitle(sourceSession.title, options.title);
  const sdk = options.sdk ?? defaultSdk;
  const messageOptions = {
    dir: sourceSession.cwd,
    includeSystemMessages: true,
  } satisfies GetSessionMessagesOptions;

  const sourceTranscript = await sdk.getSessionMessages(sourceClaudeSessionId, messageOptions);
  const sourceForkPointIndex = sourceTranscript.findIndex((message) => (
    message.type === "assistant" && message.uuid === upToMessageId
  ));
  if (sourceForkPointIndex < 0) {
    throw new Error("Agent SDK 会话中找不到要 Fork 的助手消息。");
  }
  const sourceTranscriptSlice = sourceTranscript.slice(0, sourceForkPointIndex + 1);

  const { sessionId: forkedClaudeSessionId } = await sdk.forkSession(sourceClaudeSessionId, {
    dir: sourceSession.cwd,
    upToMessageId,
    title: forkTitle,
  });
  const forkedTranscript = await sdk.getSessionMessages(forkedClaudeSessionId, messageOptions);
  const uuidMap = buildForkedUuidMap(sourceTranscriptSlice, forkedTranscript);
  const localForkMessages = history.messages.slice(0, localForkPointIndex + 1);

  const forkedSession = options.store.createSession({
    title: forkTitle,
    cwd: sourceSession.cwd,
    executionMode: sourceSession.executionMode,
    reasoningMode: sourceSession.reasoningMode,
    permissionMode: sourceSession.permissionMode,
    runSurface: sourceSession.runSurface,
    agentId: sourceSession.agentId,
    model: sourceSession.model,
    configProfileId: sourceSession.configProfileId,
    allowedTools: sourceSession.allowedTools,
    prompt: findLatestUserPrompt(localForkMessages),
  });
  const updatedSession = options.store.updateSession(forkedSession.id, {
    claudeSessionId: forkedClaudeSessionId,
    status: "idle",
  }) ?? forkedSession;

  const messages = localForkMessages
    .map((message) => cloneMessageForFork(message, forkedClaudeSessionId, uuidMap));
  messages.forEach((message) => options.store.recordMessage(updatedSession.id, message));

  return { session: updatedSession, messages };
}

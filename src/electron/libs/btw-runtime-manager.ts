import { randomUUID } from "node:crypto";

import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { LinkedWorkspaceContext } from "../../shared/linked-workspaces.js";
import { deriveLatestPlanSnapshot } from "../../shared/plan-progress.js";
import { normalizeBackgroundRunnerStatus } from "../../shared/runner-background-lifecycle.js";
import type { PromptAttachment, RuntimeOverrides, ServerEvent, StreamMessage } from "../types.js";
import type { RunnerHandle, RunnerOptions } from "./runner/runner.js";
import type { Session } from "./session-store.js";
import {
  getClaudeConversationResetId,
  getClaudeRetractionIds,
  isClaudeConversationReset,
  removeRetractedClaudeMessages,
} from "../../shared/claude-agent-sdk-messages.js";

type BtwServerEvent = Extract<ServerEvent, { type: `btw.${string}` }>;

export type BtwContinuationResult = {
  prompt: string;
};

export type BtwRuntimeManagerDependencies = {
  emit: (event: BtwServerEvent) => void;
  run: (options: RunnerOptions) => Promise<RunnerHandle>;
  buildContinuation: (
    messages: StreamMessage[],
    prompt: string,
    attachments: PromptAttachment[],
  ) => BtwContinuationResult;
  createId?: () => string;
  now?: () => number;
};

export type CreateBtwThreadInput = {
  parentSession: Session;
  snapshot: StreamMessage[];
};

export type SendBtwThreadInput = {
  threadId: string;
  prompt: string;
  agentPrompt?: string;
  workspaceContext?: LinkedWorkspaceContext;
  attachments?: PromptAttachment[];
  displayAttachments?: PromptAttachment[];
  runtime?: RuntimeOverrides;
};

type BtwRunnerConfig = {
  model?: string;
  configProfileId?: string;
  reasoningMode?: RuntimeOverrides["reasoningMode"];
  permissionMode?: RuntimeOverrides["permissionMode"];
};

type BtwRuntime = {
  threadId: string;
  parentSessionId: string;
  session: Session;
  snapshot: StreamMessage[];
  messages: StreamMessage[];
  handle?: RunnerHandle;
  runnerConfig?: BtwRunnerConfig;
  backgroundActive: boolean;
  generation: number;
  createdAt: number;
  updatedAt: number;
};

function cloneMessages(messages: readonly StreamMessage[]): StreamMessage[] {
  return messages.map((message) => structuredClone(message));
}

function buildThreadTitle(prompt: string, fallback: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 20 ? `${normalized.slice(0, 20)}…` : normalized;
}

function resolveRunnerConfig(session: Session, runtime?: RuntimeOverrides): BtwRunnerConfig {
  return {
    model: runtime?.model ?? session.model,
    configProfileId: runtime?.configProfileId ?? session.configProfileId,
    reasoningMode: runtime?.reasoningMode ?? session.reasoningMode,
    permissionMode: runtime?.permissionMode ?? session.permissionMode,
  };
}

function sameRunnerConfig(left: BtwRunnerConfig | undefined, right: BtwRunnerConfig): boolean {
  if (!left) return false;
  return left.model === right.model
    && left.configProfileId === right.configProfileId
    && left.reasoningMode === right.reasoningMode
    && left.permissionMode === right.permissionMode;
}

export class BtwRuntimeManager {
  private readonly runtimes = new Map<string, BtwRuntime>();
  private readonly createId: () => string;
  private readonly now: () => number;

  constructor(private readonly dependencies: BtwRuntimeManagerDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? Date.now;
  }

  createThread(input: CreateBtwThreadInput): Extract<BtwServerEvent, { type: "btw.thread.created" }>["payload"] {
    const siblingCount = this.getThreadCount(input.parentSession.id);
    const threadId = this.createId();
    const timestamp = this.now();
    const title = `侧聊 ${siblingCount + 1}`;
    const session: Session = {
      ...input.parentSession,
      id: threadId,
      title,
      status: "idle",
      claudeSessionId: undefined,
      continuationSummary: undefined,
      continuationSummaryMessageCount: undefined,
      planSnapshot: undefined,
      allowedTools: "*",
      lastPrompt: undefined,
      pendingPermissions: new Map(),
      abortController: undefined,
    };
    const runtime: BtwRuntime = {
      threadId,
      parentSessionId: input.parentSession.id,
      session,
      snapshot: cloneMessages(input.snapshot),
      messages: [],
      backgroundActive: false,
      generation: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.runtimes.set(threadId, runtime);

    const payload = {
      threadId,
      parentSessionId: runtime.parentSessionId,
      title,
      status: session.status,
      cwd: session.cwd,
      model: session.model,
      configProfileId: session.configProfileId,
      reasoningMode: session.reasoningMode,
      permissionMode: session.permissionMode,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Extract<BtwServerEvent, { type: "btw.thread.created" }>["payload"];
    this.dependencies.emit({ type: "btw.thread.created", payload });
    return payload;
  }

  async send(input: SendBtwThreadInput): Promise<boolean> {
    const runtime = this.runtimes.get(input.threadId);
    if (!runtime) return false;
    if (runtime.session.status === "running") {
      this.dependencies.emit({
        type: "btw.runner.error",
        payload: { threadId: input.threadId, message: "当前侧聊仍在执行中。" },
      });
      return false;
    }

    const timestamp = this.now();
    const displayPrompt = input.prompt;
    const agentPrompt = input.agentPrompt?.trim() || displayPrompt;
    const attachments = input.attachments ?? [];
    const displayAttachments = input.displayAttachments ?? attachments;
    const nextConfig = resolveRunnerConfig(runtime.session, input.runtime);
    const existingHandle = runtime.handle;
    const canAppend = Boolean(existingHandle)
      && !existingHandle!.isClosed()
      && sameRunnerConfig(runtime.runnerConfig, nextConfig);
    let continuation: BtwContinuationResult | undefined;

    if (!canAppend) {
      runtime.generation += 1;
      existingHandle?.abort();
      runtime.handle = undefined;
      runtime.runnerConfig = undefined;
      continuation = this.dependencies.buildContinuation(
        [...runtime.snapshot, ...runtime.messages],
        agentPrompt,
        attachments,
      );
    }
    const generation = runtime.generation;

    runtime.session.status = "running";
    runtime.backgroundActive = false;
    runtime.session.lastPrompt = displayPrompt;
    runtime.session.model = nextConfig.model;
    runtime.session.configProfileId = nextConfig.configProfileId;
    runtime.session.reasoningMode = nextConfig.reasoningMode;
    runtime.session.permissionMode = nextConfig.permissionMode;
    const hasConversationContent = runtime.messages.some((message) => (
      message.type === "user_prompt"
      || message.type === "user"
      || message.type === "assistant"
      || message.type === "result"
    ));
    runtime.session.title = !hasConversationContent
      ? buildThreadTitle(displayPrompt, runtime.session.title)
      : runtime.session.title;
    runtime.updatedAt = timestamp;
    runtime.messages.push({
      type: "user_prompt",
      prompt: displayPrompt,
      attachments: displayAttachments,
      capturedAt: timestamp,
    } as StreamMessage);

    this.dependencies.emit({
      type: "btw.thread.status",
      payload: {
        threadId: runtime.threadId,
        status: "running",
        title: runtime.session.title,
        model: runtime.session.model,
        configProfileId: runtime.session.configProfileId,
        reasoningMode: runtime.session.reasoningMode,
        permissionMode: runtime.session.permissionMode,
        updatedAt: timestamp,
      },
    });
    this.dependencies.emit({
      type: "btw.stream.user_prompt",
      payload: {
        threadId: runtime.threadId,
        prompt: displayPrompt,
        attachments: displayAttachments,
        capturedAt: timestamp,
      },
    });

    if (canAppend && existingHandle) {
      try {
        await existingHandle.appendPrompt(agentPrompt, attachments, {
          displayPrompt,
          workspaceContext: input.workspaceContext,
          origin: { kind: "human" },
        });
        return true;
      } catch (error) {
        const current = this.runtimes.get(runtime.threadId);
        if (!current || current.generation !== generation) return false;
        current.generation += 1;
        current.handle?.abort();
        current.handle = undefined;
        current.runnerConfig = undefined;
        const message = String(error);
        current.session.status = "error";
        current.updatedAt = this.now();
        this.dependencies.emit({ type: "btw.runner.error", payload: { threadId: current.threadId, message } });
        this.dependencies.emit({
          type: "btw.thread.status",
          payload: { threadId: current.threadId, status: "error", error: message, updatedAt: current.updatedAt },
        });
        return false;
      }
    }

    try {
      const handle = await this.dependencies.run({
        prompt: continuation!.prompt,
        promptOrigin: { kind: "human" },
        displayPrompt,
        attachments,
        runtime: {
          ...(input.runtime ?? {}),
          model: runtime.session.model,
          configProfileId: runtime.session.configProfileId,
          reasoningMode: runtime.session.reasoningMode,
          permissionMode: runtime.session.permissionMode,
        },
        session: runtime.session,
        workspaceContext: input.workspaceContext,
        resumeSessionId: undefined,
        onEvent: (event) => this.routeRunnerEvent(runtime.threadId, generation, event),
        onSessionUpdate: (updates) => {
          const current = this.runtimes.get(runtime.threadId);
          if (!current || current.generation !== generation) return;
          Object.assign(current.session, updates);
        },
      });
      const current = this.runtimes.get(runtime.threadId);
      if (!current || current.generation !== generation) {
        handle.abort();
        return false;
      }
      if (handle.isClosed()) {
        current.handle = undefined;
        current.runnerConfig = undefined;
        return false;
      }
      current.handle = handle;
      current.runnerConfig = nextConfig;
      return true;
    } catch (error) {
      const current = this.runtimes.get(runtime.threadId);
      if (!current || current.generation !== generation) return false;
      const message = String(error);
      current.session.status = "error";
      current.updatedAt = this.now();
      this.dependencies.emit({ type: "btw.runner.error", payload: { threadId: current.threadId, message } });
      this.dependencies.emit({
        type: "btw.thread.status",
        payload: { threadId: current.threadId, status: "error", error: message, updatedAt: current.updatedAt },
      });
      return false;
    }
  }

  stop(threadId: string): boolean {
    const runtime = this.runtimes.get(threadId);
    if (!runtime) return false;
    runtime.generation += 1;
    runtime.handle?.abort();
    runtime.handle = undefined;
    runtime.runnerConfig = undefined;
    runtime.session.status = "idle";
    runtime.backgroundActive = false;
    runtime.updatedAt = this.now();
    this.dependencies.emit({
      type: "btw.thread.status",
      payload: { threadId, status: "idle", updatedAt: runtime.updatedAt },
    });
    return true;
  }

  respondPermission(threadId: string, toolUseId: string, result: PermissionResult): boolean {
    const runtime = this.runtimes.get(threadId);
    const pending = runtime?.session.pendingPermissions.get(toolUseId);
    if (!pending) return false;
    pending.resolve(result);
    return true;
  }

  closeThread(threadId: string): boolean {
    const runtime = this.runtimes.get(threadId);
    if (!runtime) return false;
    runtime.generation += 1;
    runtime.handle?.abort();
    runtime.session.pendingPermissions.clear();
    this.runtimes.delete(threadId);
    this.dependencies.emit({
      type: "btw.thread.closed",
      payload: { threadId, parentSessionId: runtime.parentSessionId },
    });
    return true;
  }

  closeParent(parentSessionId: string): string[] {
    const threadIds = this.getThreadIds(parentSessionId);
    for (const threadId of threadIds) {
      const runtime = this.runtimes.get(threadId);
      if (!runtime) continue;
      runtime.generation += 1;
      runtime.handle?.abort();
      runtime.session.pendingPermissions.clear();
      this.runtimes.delete(threadId);
    }
    this.dependencies.emit({ type: "btw.parent.closed", payload: { parentSessionId, threadIds } });
    return threadIds;
  }

  closeAll(): void {
    const parentSessionIds = new Set(Array.from(this.runtimes.values(), (runtime) => runtime.parentSessionId));
    for (const parentSessionId of parentSessionIds) {
      this.closeParent(parentSessionId);
    }
  }

  getThreadCount(parentSessionId: string): number {
    return this.getThreadIds(parentSessionId).length;
  }

  private getThreadIds(parentSessionId: string): string[] {
    return Array.from(this.runtimes.values())
      .filter((runtime) => runtime.parentSessionId === parentSessionId)
      .map((runtime) => runtime.threadId);
  }

  private routeRunnerEvent(threadId: string, generation: number, event: ServerEvent): void {
    const runtime = this.runtimes.get(threadId);
    if (!runtime || runtime.generation !== generation) return;

    if (event.type === "stream.message") {
      const retractedIds = getClaudeRetractionIds(event.payload.message);
      if (isClaudeConversationReset(event.payload.message)) {
        runtime.messages = [];
        runtime.snapshot = [];
        runtime.session.title = "New Session";
        runtime.session.claudeSessionId = getClaudeConversationResetId(event.payload.message);
        runtime.session.lastPrompt = undefined;
        runtime.session.continuationSummary = undefined;
        runtime.session.continuationSummaryMessageCount = undefined;
        runtime.session.planSnapshot = undefined;
        runtime.session.workflowState = undefined;
        runtime.session.workflowError = undefined;
        const pendingPermissions = Array.from(runtime.session.pendingPermissions.values());
        runtime.session.pendingPermissions.clear();
        for (const permission of pendingPermissions) {
          permission.resolve({ behavior: "deny", message: "Conversation was reset before the permission request was answered." });
        }
      } else if (retractedIds.length > 0) {
        runtime.messages = removeRetractedClaudeMessages(runtime.messages, retractedIds);
      }
      runtime.messages.push(event.payload.message);
      if (retractedIds.length > 0) {
        // BTW owns a private conversation. Rebuild only from its messages so a
        // retraction can restore the previous BTW plan without inheriting the
        // parent session snapshot.
        runtime.session.planSnapshot = deriveLatestPlanSnapshot(threadId, runtime.messages);
      }
      runtime.updatedAt = this.now();
      this.dependencies.emit({ type: "btw.stream.message", payload: { threadId, message: event.payload.message } });
      return;
    }
    if (event.type === "session.plan.updated") {
      runtime.session.planSnapshot = event.payload;
      runtime.updatedAt = this.now();
      return;
    }
    if (event.type === "permission.request") {
      this.dependencies.emit({
        type: "btw.permission.request",
        payload: { ...event.payload, threadId },
      });
      return;
    }
    if (event.type === "runner.error") {
      this.dependencies.emit({ type: "btw.runner.error", payload: { threadId, message: event.payload.message } });
      return;
    }
    if (event.type === "session.status") {
      runtime.backgroundActive = Boolean(event.payload.backgroundActive);
      runtime.session.status = normalizeBackgroundRunnerStatus(
        event.payload.status,
        runtime.backgroundActive,
      );
      runtime.updatedAt = this.now();
      this.dependencies.emit({
        type: "btw.thread.status",
        payload: {
          threadId,
          status: runtime.session.status,
          title: runtime.session.title,
          model: event.payload.model ?? runtime.session.model,
          reasoningMode: event.payload.reasoningMode ?? runtime.session.reasoningMode,
          permissionMode: event.payload.permissionMode ?? runtime.session.permissionMode,
          error: event.payload.error,
          backgroundActive: runtime.backgroundActive,
          terminalReason: event.payload.terminalReason,
          updatedAt: runtime.updatedAt,
        },
      });
    }
  }
}

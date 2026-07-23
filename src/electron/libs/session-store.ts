import Database from "better-sqlite3";
import type { AgentRunSurface, PermissionRequestMetadata, PromptAttachment, RuntimeOverrides, RuntimeReasoningMode, SessionHistoryCursor, SessionStatus, StreamMessage } from "../types.js";
import { existsSync, realpathSync } from "fs";
import electron from "electron";
import { isSuccessfulRunnerResult } from "../../shared/runner-status.js";
import { sanitizePromptAttachmentsForStorage } from "../../shared/attachments.js";
import { normalizeReleasePermissionMode } from "../../shared/runtime-permissions.js";
import {
  hasIncompletePlan,
  normalizeUpdatePlanArgs,
  type SessionPlanSnapshot,
} from "../../shared/plan-progress.js";
import type { SessionExecutionMode } from "../../shared/session-semantics.js";
import type { SessionWorkflowState, WorkflowScope } from "../../shared/workflow-markdown.js";
import type { WorkflowRunPatch, WorkflowRunRecord } from "../../shared/workflows/workflow-runs.js";
import { stripInlineBase64ImagesFromMessage } from "./tool-output-sanitizer.js";
import {
  normalizeRuntimeEfficiencyProfileState,
  type RuntimeEfficiencyProfileState,
} from "./runtime-efficiency.js";
import { WorkflowRunRepository } from "./workflows/workflow-run-store.js";

const LEGACY_CWD_SUFFIXES = [
  "/upstream/open-claude-cowork",
  "/Desktop/claw-open-cowork",
];

const { app } = electron as unknown as { app?: { getAppPath?: () => string } };

function parseWorkflowState(value: unknown): SessionWorkflowState | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(value) as SessionWorkflowState;
  } catch {
    return undefined;
  }
}

function parseRuntimeProfileState(value: unknown): RuntimeEfficiencyProfileState | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    return normalizeRuntimeEfficiencyProfileState(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function serializeRuntimeProfileState(value: RuntimeEfficiencyProfileState | undefined): string | null {
  const normalized = normalizeRuntimeEfficiencyProfileState(value);
  return normalized ? JSON.stringify(normalized) : null;
}

function normalizeStoredPermissionMode(value: unknown): RuntimeOverrides["permissionMode"] | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalizeReleasePermissionMode(normalized);
}

export type PendingPermission = {
  toolUseId: string;
  toolName: string;
  input: unknown;
  metadata?: PermissionRequestMetadata;
  resolve: (result: { behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }) => void;
};

export type Session = {
  id: string;
  title: string;
  claudeSessionId?: string;
  status: SessionStatus;
  model?: string;
  configProfileId?: string;
  executionMode?: SessionExecutionMode;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: RuntimeOverrides["permissionMode"];
  cwd?: string;
  runSurface?: AgentRunSurface;
  agentId?: string;
  allowedTools?: string;
  lastPrompt?: string;
  continuationSummary?: string;
  continuationSummaryMessageCount?: number;
  workflowMarkdown?: string;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowState?: SessionWorkflowState;
  workflowError?: string;
  runtimeProfileState?: RuntimeEfficiencyProfileState;
  planSnapshot?: SessionPlanSnapshot;
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  pendingPermissions: Map<string, PendingPermission>;
  abortController?: AbortController;
};

export type StoredSession = {
  id: string;
  title: string;
  status: SessionStatus;
  model?: string;
  configProfileId?: string;
  executionMode?: SessionExecutionMode;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: RuntimeOverrides["permissionMode"];
  cwd?: string;
  runSurface?: AgentRunSurface;
  agentId?: string;
  allowedTools?: string;
  lastPrompt?: string;
  claudeSessionId?: string;
  continuationSummary?: string;
  continuationSummaryMessageCount?: number;
  workflowMarkdown?: string;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowState?: SessionWorkflowState;
  workflowError?: string;
  runtimeProfileState?: RuntimeEfficiencyProfileState;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type SessionListOptions = {
  archived?: boolean;
  limit?: number;
  summary?: boolean;
};

export type SessionHistory = {
  session: StoredSession;
  messages: StreamMessage[];
};

export type SessionHistoryPage = SessionHistory & {
  hasMore: boolean;
  nextCursor?: SessionHistoryCursor;
  totalMessages: number;
};

const SESSION_LIST_DEFAULT_SUMMARY_LIMIT = 80;
const SESSION_LIST_MAX_LIMIT = 500;
const DEFAULT_MESSAGE_BATCH_DELAY_MS = 100;
const CLOSE_MESSAGE_FLUSH_ATTEMPTS = 3;

type MessagePersistence = "transient" | "batched" | "immediate";

type PendingMessageWrite = {
  id: string;
  sessionId: string;
  data: string;
  capturedAt: number;
};

export type SessionStoreMessageTimerHandle = {
  unref?: () => void;
};

export type SessionStoreOptions = {
  messageBatchDelayMs?: number;
  messageTimer?: {
    setTimeout: (callback: () => void, delayMs: number) => SessionStoreMessageTimerHandle;
    clearTimeout: (handle: SessionStoreMessageTimerHandle) => void;
  };
  onMessageFlushError?: (error: unknown) => void;
};

export type MessageWriteStats = {
  pendingRows: number;
  transactionCount: number;
  insertedRows: number;
  ignoredRows: number;
};

function normalizeSessionListLimit(limit: number | undefined, fallback?: number): number | undefined {
  const raw = limit ?? fallback;
  if (raw === undefined) return undefined;
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(Math.floor(raw), SESSION_LIST_MAX_LIMIT));
}

function isTransientStreamEventMessage(message: StreamMessage): boolean {
  return (
    "type" in message &&
    (
      message.type === "stream_event" ||
      (
        message.type === "tool_progress" &&
        message.heartbeat === true &&
        !message.subagent_retry
      ) ||
      (
        message.type === "system" &&
        "subtype" in message &&
        (message.subtype === "status" || message.subtype === "thinking_tokens")
      )
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSessionPlanSnapshot(value: unknown): SessionPlanSnapshot | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) return undefined;

    const normalized = normalizeUpdatePlanArgs(parsed);
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    if (!normalized || !sessionId) return undefined;

    return {
      plan: normalized.plan,
      sessionId,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      source: parsed.source === "task_create" ? "task_create" : "update_plan",
      ...(normalized.explanation ? { explanation: normalized.explanation } : {}),
      ...(typeof parsed.turnId === "string" ? { turnId: parsed.turnId } : {}),
      ...(typeof parsed.toolName === "string" ? { toolName: parsed.toolName } : {}),
      ...(typeof parsed.toolUseId === "string" ? { toolUseId: parsed.toolUseId } : {}),
    };
  } catch {
    return undefined;
  }
}

function isExplicitErrorMessage(message: StreamMessage): boolean {
  const record = message as unknown as Record<string, unknown>;
  if (record.is_error === true || record.type === "error" || record.subtype === "error") {
    return true;
  }

  const envelope = record.message;
  if (!isRecord(envelope) || !Array.isArray(envelope.content)) return false;
  return envelope.content.some((item) => (
    isRecord(item) && item.type === "tool_result" && item.is_error === true
  ));
}

export function classifyMessagePersistence(message: StreamMessage): MessagePersistence {
  if (isTransientStreamEventMessage(message)) return "transient";
  if (message.type === "user_prompt" || message.type === "result" || isExplicitErrorMessage(message)) {
    return "immediate";
  }
  return "batched";
}

function parseStoredMessage(row: { id: string; data: string; created_at: number }): StreamMessage {
  const parsed = stripInlineBase64ImagesFromMessage(JSON.parse(String(row.data)) as StreamMessage);
  const message = {
    ...parsed,
    capturedAt: typeof parsed.capturedAt === "number" ? parsed.capturedAt : Number(row.created_at),
    historyId: parsed.historyId ? String(parsed.historyId) : String(row.id),
  } satisfies StreamMessage;
  if (message.type !== "user_prompt" || !message.attachments?.length) return message;
  return {
    ...message,
    attachments: sanitizePromptAttachmentsForStorage(message.attachments),
  } satisfies StreamMessage;
}

function createHistoryCursor(row: Record<string, unknown> | undefined): SessionHistoryCursor | undefined {
  if (!row || typeof row.created_at !== "number" || typeof row.id !== "string") {
    return undefined;
  }

  return {
    beforeCreatedAt: Number(row.created_at),
    beforeId: row.id,
    beforeSequence: Number(row.sequence),
  };
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private db: Database.Database;
  private workflowRuns: WorkflowRunRepository;
  private readonly pendingMessageWrites = new Map<string, PendingMessageWrite[]>();
  private readonly messageBatchDelayMs: number;
  private readonly messageTimerApi: NonNullable<SessionStoreOptions["messageTimer"]>;
  private readonly onMessageFlushError: (error: unknown) => void;
  private messageFlushTimer: SessionStoreMessageTimerHandle | null = null;
  private messageWriteTransactionCount = 0;
  private messageInsertedRows = 0;
  private messageIgnoredRows = 0;
  private closed = false;

  constructor(dbPath: string, options: SessionStoreOptions = {}) {
    this.db = new Database(dbPath);
    this.workflowRuns = new WorkflowRunRepository(this.db);
    this.messageBatchDelayMs = Math.max(0, options.messageBatchDelayMs ?? DEFAULT_MESSAGE_BATCH_DELAY_MS);
    this.messageTimerApi = options.messageTimer ?? {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    this.onMessageFlushError = options.onMessageFlushError ?? ((error) => {
      console.error("Failed to flush pending session messages:", error);
    });
    this.initialize();
    this.restoreIncompletePlanSessionStatuses();
    this.recoverSuccessfulErrorSessions();
    this.loadSessions();
  }

  private resolveCwd(cwd?: string): string | undefined {
    if (!cwd) return undefined;
    if (existsSync(cwd)) {
      try {
        return realpathSync(cwd);
      } catch {
        return cwd;
      }
    }

    const appPath = app?.getAppPath?.();
    if (!appPath) return undefined;
    for (const suffix of LEGACY_CWD_SUFFIXES) {
      if (cwd.endsWith(suffix) && existsSync(appPath)) {
        return appPath;
      }
    }

    return undefined;
  }

  private canonicalizeCwd(cwd?: string): string | undefined {
    if (!cwd) return undefined;
    return this.resolveCwd(cwd) ?? cwd;
  }

  private normalizeStoredCwd(sessionId: string, cwd?: string): string | undefined {
    const canonicalCwd = this.canonicalizeCwd(cwd);
    if (canonicalCwd !== cwd) {
      this.db
        .prepare("update sessions set cwd = ? where id = ?")
        .run(canonicalCwd ?? null, sessionId);
    }
    return canonicalCwd;
  }

  createSession(options: {
    cwd?: string;
    executionMode?: SessionExecutionMode;
    reasoningMode?: RuntimeReasoningMode;
    permissionMode?: RuntimeOverrides["permissionMode"];
    runSurface?: AgentRunSurface;
    agentId?: string;
    model?: string;
    configProfileId?: string;
    allowedTools?: string;
    prompt?: string;
    title: string;
  }): Session {
    const id = crypto.randomUUID();
    const now = Date.now();
    const session: Session = {
      id,
      title: options.title,
      status: "idle",
      model: options.model?.trim() || undefined,
      configProfileId: options.configProfileId?.trim() || undefined,
      executionMode: options.executionMode ?? "foreground",
      reasoningMode: options.reasoningMode,
      permissionMode: normalizeReleasePermissionMode(options.permissionMode),
      cwd: this.canonicalizeCwd(options.cwd),
      runSurface: options.runSurface,
      agentId: options.agentId,
      allowedTools: options.allowedTools,
      lastPrompt: options.prompt,
      createdAt: now,
      updatedAt: now,
      pendingPermissions: new Map()
    };
    this.sessions.set(id, session);
    this.db
      .prepare(
        `insert into sessions
          (id, title, claude_session_id, status, model, config_profile_id, execution_mode, reasoning_mode, permission_mode, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, runtime_profile_state, archived_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        session.title,
        session.claudeSessionId ?? null,
        session.status,
        session.model ?? null,
        session.configProfileId ?? null,
        session.executionMode ?? null,
        session.reasoningMode ?? null,
        session.permissionMode ?? null,
        session.cwd ?? null,
        session.runSurface ?? null,
        session.agentId ?? null,
        session.allowedTools ?? null,
        session.lastPrompt ?? null,
        session.continuationSummary ?? null,
        session.continuationSummaryMessageCount ?? null,
        session.workflowMarkdown ?? null,
        session.workflowSourceLayer ?? null,
        session.workflowSourcePath ?? null,
        session.workflowState ? JSON.stringify(session.workflowState) : null,
        session.workflowError ?? null,
        serializeRuntimeProfileState(session.runtimeProfileState),
        session.archivedAt ?? null,
        now,
        now
      );
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  listSessions(options?: SessionListOptions): StoredSession[] {
    const archived = Boolean(options?.archived);
    const summary = Boolean(options?.summary);
    const limit = normalizeSessionListLimit(
      options?.limit,
      summary ? SESSION_LIST_DEFAULT_SUMMARY_LIMIT : undefined,
    );
    const columns = summary
      ? "id, title, claude_session_id, status, model, config_profile_id, execution_mode, reasoning_mode, permission_mode, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, archived_at, created_at, updated_at"
      : "id, title, claude_session_id, status, model, config_profile_id, execution_mode, reasoning_mode, permission_mode, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, runtime_profile_state, archived_at, created_at, updated_at";
    const sql = `select ${columns}
         from sessions
         where archived_at is ${archived ? "not null" : "null"}
         order by updated_at desc${limit === undefined ? "" : " limit ?"}`;
    const statement = this.db.prepare(sql);
    const rows = (
      limit === undefined ? statement.all() : statement.all(limit)
    ) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapSessionRow(row));
  }

  archiveSession(id: string): StoredSession | undefined {
    const now = Date.now();
    const session = this.sessions.get(id);
    if (session) {
      session.archivedAt = now;
      session.updatedAt = now;
    }
    const result = this.db
      .prepare("update sessions set archived_at = ?, updated_at = ? where id = ?")
      .run(now, now, id);
    if (result.changes === 0 && !session) return undefined;
    const row = this.getSessionRow(id);
    return row ? this.mapSessionRow(row) : undefined;
  }

  unarchiveSession(id: string): StoredSession | undefined {
    const now = Date.now();
    const session = this.sessions.get(id);
    if (session) {
      session.archivedAt = undefined;
      session.updatedAt = now;
    }
    const result = this.db
      .prepare("update sessions set archived_at = null, updated_at = ? where id = ?")
      .run(now, id);
    if (result.changes === 0 && !session) return undefined;
    const row = this.getSessionRow(id);
    return row ? this.mapSessionRow(row) : undefined;
  }

  listRecentCwds(limit = 8): string[] {
    const rows = this.db
      .prepare(
        `select cwd, max(updated_at) as latest
         from sessions
         where cwd is not null and trim(cwd) != ''
         group by cwd
         order by latest desc
         limit ?`
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows
      .map((row) => this.resolveCwd(String(row.cwd)))
      .filter((cwd): cwd is string => Boolean(cwd))
      .filter((cwd, index, items) => items.indexOf(cwd) === index)
      .slice(0, limit);
  }

  getSessionHistory(id: string): SessionHistory | null {
    this.flushPendingMessagesForSession(id);
    const sessionRow = this.getSessionRow(id);
    if (!sessionRow) return null;

    const messages = (this.db
      .prepare(
        `select rowid as sequence, id, data, created_at
         from messages
         where session_id = ?
           and coalesce(json_extract(data, '$.type'), '') != 'stream_event'
         order by created_at asc, rowid asc`
      )
      .all(id) as Array<Record<string, unknown>>)
      .map((row) =>
        parseStoredMessage({
          id: String(row.id),
          data: String(row.data),
          created_at: Number(row.created_at),
        })
      )
      .filter((message) => !isTransientStreamEventMessage(message));

    return {
      session: this.mapSessionRow(sessionRow),
      messages
    };
  }

  getSessionHistoryPage(
    id: string,
    options?: {
      before?: SessionHistoryCursor;
      limit?: number;
    }
  ): SessionHistoryPage | null {
    this.flushPendingMessagesForSession(id);
    const sessionRow = this.getSessionRow(id);
    if (!sessionRow) return null;

    const limit = Math.max(1, Math.min(options?.limit ?? 400, 1_000));
    const before = options?.before;
    const totalMessages = Number((this.db
      .prepare("select count(*) as count from messages where session_id = ?")
      .get(id) as { count?: number } | undefined)?.count ?? 0);
    const rows = before?.beforeSequence !== undefined
      ? (this.db
          .prepare(
            `select rowid as sequence, id, data, created_at
             from messages
             where session_id = ?
               and coalesce(json_extract(data, '$.type'), '') != 'stream_event'
               and (created_at < ? or (created_at = ? and rowid < ?))
             order by created_at desc, rowid desc
             limit ?`
          )
          .all(id, before.beforeCreatedAt, before.beforeCreatedAt, before.beforeSequence, limit + 1) as Array<Record<string, unknown>>)
      : before
      ? (this.db
          .prepare(
            `select rowid as sequence, id, data, created_at
             from messages
             where session_id = ?
               and coalesce(json_extract(data, '$.type'), '') != 'stream_event'
               and (created_at < ? or (created_at = ? and id < ?))
             order by created_at desc, rowid desc
             limit ?`
          )
          .all(id, before.beforeCreatedAt, before.beforeCreatedAt, before.beforeId, limit + 1) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(
            `select rowid as sequence, id, data, created_at
             from messages
             where session_id = ?
               and coalesce(json_extract(data, '$.type'), '') != 'stream_event'
             order by created_at desc, rowid desc
             limit ?`
          )
          .all(id, limit + 1) as Array<Record<string, unknown>>);

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit).reverse();
    const messages = pageRows.map((row) =>
      parseStoredMessage({
        id: String(row.id),
        data: String(row.data),
        created_at: Number(row.created_at),
      })
    );

    return {
      session: this.mapSessionRow(sessionRow),
      messages,
      hasMore,
      nextCursor: hasMore ? createHistoryCursor(pageRows[0]) : undefined,
      totalMessages,
    };
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const normalizedUpdates = Object.prototype.hasOwnProperty.call(updates, "cwd")
      ? { ...updates, cwd: this.canonicalizeCwd(updates.cwd) }
      : updates;
    Object.assign(session, normalizedUpdates);
    const updatedAt = this.persistSession(id, normalizedUpdates);
    if (updatedAt !== undefined) session.updatedAt = updatedAt;
    return session;
  }

  recoverInterruptedSessions(): string[] {
    const recoveredIds: string[] = [];
    const recoveredAt = Date.now();

    for (const session of this.sessions.values()) {
      if (session.status !== "running") {
        continue;
      }

      session.status = "idle";
      session.abortController = undefined;
      session.pendingPermissions.clear();
      session.updatedAt = recoveredAt;
      recoveredIds.push(session.id);
    }

    if (recoveredIds.length === 0) {
      return recoveredIds;
    }

    const placeholders = recoveredIds.map(() => "?").join(", ");
    this.db
      .prepare(`update sessions set status = ?, updated_at = ? where id in (${placeholders})`)
      .run("idle", recoveredAt, ...recoveredIds);

    return recoveredIds;
  }

  setAbortController(id: string, controller: AbortController | undefined): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.abortController = controller;
  }

  recordMessage(sessionId: string, message: StreamMessage): StreamMessage {
    if (this.closed) throw new Error("SessionStore is closed");
    const capturedAt = typeof message.capturedAt === "number" ? message.capturedAt : Date.now();
    const id = message.historyId
      ? String(message.historyId)
      : ('uuid' in message && message.uuid)
        ? String(message.uuid)
        : crypto.randomUUID();
    const storedMessage = {
      ...message,
      capturedAt,
      historyId: id,
    } satisfies StreamMessage;
    const persistence = classifyMessagePersistence(storedMessage);
    if (persistence === "transient") {
      return storedMessage;
    }

    const pending = this.pendingMessageWrites.get(sessionId) ?? [];
    pending.push({
      id,
      sessionId,
      data: JSON.stringify(storedMessage),
      capturedAt,
    });
    this.pendingMessageWrites.set(sessionId, pending);

    if (persistence === "immediate") {
      try {
        this.flushPendingMessagesForSession(sessionId);
      } catch (error) {
        this.scheduleMessageFlush();
        throw error;
      }
    } else {
      this.scheduleMessageFlush();
    }
    return storedMessage;
  }

  retractMessages(sessionId: string, messageIds: readonly string[]): number {
    const ids = Array.from(new Set(messageIds.filter(Boolean)));
    if (ids.length === 0) return 0;

    const idSet = new Set(ids);
    const pending = this.pendingMessageWrites.get(sessionId) ?? [];
    const remaining = pending.filter((entry) => !idSet.has(entry.id));
    if (remaining.length > 0) {
      this.pendingMessageWrites.set(sessionId, remaining);
    } else {
      this.pendingMessageWrites.delete(sessionId);
    }

    const placeholders = ids.map(() => "?").join(", ");
    const result = this.db
      .prepare(`delete from messages where session_id = ? and id in (${placeholders})`)
      .run(sessionId, ...ids);
    return Number(result.changes) + (pending.length - remaining.length);
  }

  clearMessages(sessionId: string): number {
    const pendingCount = this.pendingMessageWrites.get(sessionId)?.length ?? 0;
    this.pendingMessageWrites.delete(sessionId);
    const result = this.db.prepare("delete from messages where session_id = ?").run(sessionId);
    return Number(result.changes) + pendingCount;
  }

  resetConversation(
    sessionId: string,
    options: { claudeSessionId?: string; title?: string } = {},
  ): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const pendingMessages = this.pendingMessageWrites.get(sessionId)?.length ?? 0;
    const nextTitle = options.title?.trim() || "New Session";
    const resetAt = Date.now();
    const resetDatabase = this.db.transaction(() => {
      const deleted = this.db.prepare("delete from messages where session_id = ?").run(sessionId);
      this.db.prepare("delete from workflow_runs where session_id = ?").run(sessionId);
      this.db.prepare(
        `update sessions
         set title = ?, claude_session_id = ?, last_prompt = null,
             continuation_summary = null, continuation_summary_message_count = null,
             plan_state = null, workflow_state = null, workflow_error = null,
             updated_at = ?
         where id = ?`,
      ).run(nextTitle, options.claudeSessionId ?? null, resetAt, sessionId);
      return Number(deleted.changes);
    });

    const deletedMessages = resetDatabase();
    this.pendingMessageWrites.delete(sessionId);
    const pendingPermissions = Array.from(session.pendingPermissions.values());
    Object.assign(session, {
      title: nextTitle,
      claudeSessionId: options.claudeSessionId,
      lastPrompt: undefined,
      continuationSummary: undefined,
      continuationSummaryMessageCount: undefined,
      planSnapshot: undefined,
      workflowState: undefined,
      workflowError: undefined,
      updatedAt: resetAt,
    } satisfies Partial<Session>);
    session.pendingPermissions.clear();
    for (const permission of pendingPermissions) {
      permission.resolve({ behavior: "deny", message: "Conversation was reset before the permission request was answered." });
    }

    if (deletedMessages + pendingMessages > 0) {
      console.info("[session-store] Reset conversation transcript", {
        sessionId,
        removedMessages: deletedMessages + pendingMessages,
      });
    }
    return session;
  }

  replaceUserPromptAndPrune(
    sessionId: string,
    historyId: string,
    prompt: string,
    attachments?: PromptAttachment[],
  ): StreamMessage | null {
    this.flushPendingMessagesForSession(sessionId);
    const row = this.db
      .prepare(
        `select rowid, id, data, created_at
         from messages
         where session_id = ? and id = ?`
      )
      .get(sessionId, historyId) as Record<string, unknown> | undefined;

    if (!row || typeof row.data !== "string") return null;

    const existing = JSON.parse(row.data) as StreamMessage;
    if (existing.type !== "user_prompt") return null;

    const updated = {
      ...existing,
      prompt,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      capturedAt: typeof existing.capturedAt === "number" ? existing.capturedAt : Number(row.created_at),
      historyId: String(row.id),
    } satisfies StreamMessage;

    const transaction = this.db.transaction(() => {
      this.db
        .prepare("update messages set data = ? where session_id = ? and id = ?")
        .run(JSON.stringify(updated), sessionId, historyId);
      this.db
        .prepare("delete from messages where session_id = ? and rowid > ?")
        .run(sessionId, Number(row.rowid));
    });
    transaction();

    return updated;
  }

  deleteSession(id: string): boolean {
    this.dropPendingMessagesForSession(id);
    const existing = this.sessions.get(id);
    if (existing) {
      this.sessions.delete(id);
    }
    this.workflowRuns.deleteWorkflowRunsForSession(id);
    this.db.prepare(`delete from messages where session_id = ?`).run(id);
    const result = this.db.prepare(`delete from sessions where id = ?`).run(id);
    const removedFromDb = result.changes > 0;
    return removedFromDb || Boolean(existing);
  }

  listWorkflowRuns(sessionId: string): WorkflowRunRecord[] {
    return this.workflowRuns.listWorkflowRuns(sessionId);
  }

  getWorkflowRun(workflowRunId: string): WorkflowRunRecord | undefined {
    return this.workflowRuns.getWorkflowRun(workflowRunId);
  }

  getWorkflowRunByTask(sessionId: string, taskId: string): WorkflowRunRecord | undefined {
    return this.workflowRuns.getWorkflowRunByTask(sessionId, taskId);
  }

  upsertWorkflowRun(patch: WorkflowRunPatch): WorkflowRunRecord {
    return this.workflowRuns.upsertWorkflowRun(patch);
  }

  deleteWorkflowRunsForSession(sessionId: string): void {
    this.workflowRuns.deleteWorkflowRunsForSession(sessionId);
  }

  getDatabaseForTest(): Database.Database {
    this.flushAllPendingMessages();
    return this.db;
  }

  getMessageWriteStats(): MessageWriteStats {
    let pendingRows = 0;
    for (const writes of this.pendingMessageWrites.values()) {
      pendingRows += writes.length;
    }
    return {
      pendingRows,
      transactionCount: this.messageWriteTransactionCount,
      insertedRows: this.messageInsertedRows,
      ignoredRows: this.messageIgnoredRows,
    };
  }

  private persistSession(id: string, updates: Partial<Session>): number | undefined {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const updatable = {
      claudeSessionId: "claude_session_id",
      title: "title",
      status: "status",
      cwd: "cwd",
      executionMode: "execution_mode",
      reasoningMode: "reasoning_mode",
      permissionMode: "permission_mode",
      runSurface: "run_surface",
      agentId: "agent_id",
      model: "model",
      configProfileId: "config_profile_id",
      allowedTools: "allowed_tools",
      lastPrompt: "last_prompt",
      continuationSummary: "continuation_summary",
      continuationSummaryMessageCount: "continuation_summary_message_count",
      workflowMarkdown: "workflow_markdown",
      workflowSourceLayer: "workflow_source_layer",
      workflowSourcePath: "workflow_source_path",
      workflowState: "workflow_state",
      workflowError: "workflow_error",
      runtimeProfileState: "runtime_profile_state",
      planSnapshot: "plan_state",
      archivedAt: "archived_at",
    } as const;

    for (const key of Object.keys(updates) as Array<keyof typeof updatable>) {
      const column = updatable[key];
      if (!column) continue;
      fields.push(`${column} = ?`);
      const value = updates[key];
      if (key === "workflowState") {
        values.push(value === undefined ? null : JSON.stringify(value));
        continue;
      }
      if (key === "runtimeProfileState") {
        values.push(serializeRuntimeProfileState(value as RuntimeEfficiencyProfileState | undefined));
        continue;
      }
      if (key === "planSnapshot") {
        values.push(value === undefined ? null : JSON.stringify(value));
        continue;
      }
      values.push(value === undefined ? null : (value as string | number));
    }

    if (fields.length === 0) return undefined;
    const updatedAt = Date.now();
    fields.push("updated_at = ?");
    values.push(updatedAt);
    values.push(id);
    this.db
      .prepare(`update sessions set ${fields.join(", ")} where id = ?`)
      .run(...values);
    return updatedAt;
  }

  private initialize(): void {
    this.db.exec(`pragma journal_mode = WAL;`);
    this.db.exec(
      `create table if not exists sessions (
        id text primary key,
        title text,
        claude_session_id text,
        status text not null,
        model text,
        config_profile_id text,
        execution_mode text,
        reasoning_mode text,
        permission_mode text,
        cwd text,
        run_surface text,
        agent_id text,
        allowed_tools text,
        last_prompt text,
        continuation_summary text,
        continuation_summary_message_count integer,
        workflow_markdown text,
        workflow_source_layer text,
        workflow_source_path text,
        workflow_state text,
        workflow_error text,
        runtime_profile_state text,
        plan_state text,
        archived_at integer,
        created_at integer not null,
        updated_at integer not null
      )`
    );
    this.ensureSessionColumn("continuation_summary", "text");
    this.ensureSessionColumn("continuation_summary_message_count", "integer");
    this.ensureSessionColumn("model", "text");
    this.ensureSessionColumn("config_profile_id", "text");
    this.ensureSessionColumn("execution_mode", "text");
    this.ensureSessionColumn("reasoning_mode", "text");
    this.ensureSessionColumn("permission_mode", "text");
    this.ensureSessionColumn("run_surface", "text");
    this.ensureSessionColumn("agent_id", "text");
    this.ensureSessionColumn("workflow_markdown", "text");
    this.ensureSessionColumn("workflow_source_layer", "text");
    this.ensureSessionColumn("workflow_source_path", "text");
    this.ensureSessionColumn("workflow_state", "text");
    this.ensureSessionColumn("workflow_error", "text");
    this.ensureSessionColumn("runtime_profile_state", "text");
    this.ensureSessionColumn("plan_state", "text");
    this.ensureSessionColumn("archived_at", "integer");
    this.db.exec(
      `create table if not exists messages (
        id text primary key,
        session_id text not null,
        data text not null,
        created_at integer not null,
        foreign key (session_id) references sessions(id)
      )`
    );
    this.db.exec(`create index if not exists messages_session_id on messages(session_id)`);
    this.db.exec(`create index if not exists messages_session_created_id on messages(session_id, created_at, id)`);
    this.db.exec(
      `create table if not exists channel_seen_message_ids (
        message_id text not null,
        provider text not null,
        created_at integer not null,
        primary key (message_id, provider)
      )`,
    );
    this.db
      .prepare("delete from channel_seen_message_ids where created_at < ?")
      .run(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  private loadSessions(): void {
    const rows = this.db
      .prepare(
        `select id, title, claude_session_id, status, model, config_profile_id, execution_mode, reasoning_mode, permission_mode, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, runtime_profile_state, plan_state, archived_at, created_at, updated_at
         from sessions`
      )
      .all();
    for (const row of rows as Array<Record<string, unknown>>) {
      const session: Session = {
        id: String(row.id),
        title: String(row.title),
        claudeSessionId: row.claude_session_id ? String(row.claude_session_id) : undefined,
        status: row.status as SessionStatus,
        model: row.model ? String(row.model) : undefined,
        configProfileId: row.config_profile_id ? String(row.config_profile_id) : undefined,
        executionMode: row.execution_mode === "background" ? "background" : row.execution_mode === "foreground" ? "foreground" : undefined,
        reasoningMode: row.reasoning_mode ? (String(row.reasoning_mode) as RuntimeReasoningMode) : undefined,
        permissionMode: normalizeStoredPermissionMode(row.permission_mode),
        cwd: this.normalizeStoredCwd(
          String(row.id),
          row.cwd ? String(row.cwd) : undefined,
        ),
        runSurface: row.run_surface ? (String(row.run_surface) as AgentRunSurface) : undefined,
        agentId: row.agent_id ? String(row.agent_id) : undefined,
        allowedTools: row.allowed_tools ? String(row.allowed_tools) : undefined,
        lastPrompt: row.last_prompt ? String(row.last_prompt) : undefined,
        continuationSummary: row.continuation_summary ? String(row.continuation_summary) : undefined,
        continuationSummaryMessageCount: typeof row.continuation_summary_message_count === "number"
          ? Number(row.continuation_summary_message_count)
          : undefined,
        workflowMarkdown: row.workflow_markdown ? String(row.workflow_markdown) : undefined,
        workflowSourceLayer: row.workflow_source_layer ? (String(row.workflow_source_layer) as WorkflowScope) : undefined,
        workflowSourcePath: row.workflow_source_path ? String(row.workflow_source_path) : undefined,
        workflowState: parseWorkflowState(row.workflow_state),
        workflowError: row.workflow_error ? String(row.workflow_error) : undefined,
        runtimeProfileState: parseRuntimeProfileState(row.runtime_profile_state),
        planSnapshot: parseSessionPlanSnapshot(row.plan_state),
        archivedAt: typeof row.archived_at === "number" ? Number(row.archived_at) : undefined,
        createdAt: typeof row.created_at === "number" ? Number(row.created_at) : undefined,
        updatedAt: typeof row.updated_at === "number" ? Number(row.updated_at) : undefined,
        pendingPermissions: new Map()
      };
      this.sessions.set(session.id, session);
    }
  }

  private recoverSuccessfulErrorSessions(): void {
    const rows = this.db
      .prepare("select id, plan_state from sessions where status = ?")
      .all("error") as Array<Record<string, unknown>>;

    for (const row of rows) {
      const id = String(row.id);
      const planSnapshot = parseSessionPlanSnapshot(row.plan_state);
      const latestResult = this.db
        .prepare(
          `select data
           from messages
           where session_id = ?
             and json_extract(data, '$.type') = 'result'
           order by created_at desc, id desc
           limit 1`
        )
        .get(id) as Record<string, unknown> | undefined;

      if (!latestResult || typeof latestResult.data !== "string") {
        continue;
      }

      try {
        if (
          isSuccessfulRunnerResult(JSON.parse(latestResult.data) as { type?: unknown; subtype?: unknown }) &&
          !hasIncompletePlan(planSnapshot?.plan)
        ) {
          this.db.prepare("update sessions set status = ? where id = ?").run("completed", id);
        }
      } catch {
        // Leave malformed legacy rows untouched.
      }
    }
  }

  private restoreIncompletePlanSessionStatuses(): void {
    const sessions = this.db
      .prepare("select id, plan_state from sessions where status = ? and plan_state is not null")
      .all("completed") as Array<Record<string, unknown>>;

    for (const row of sessions) {
      const sessionId = String(row.id);
      const planSnapshot = parseSessionPlanSnapshot(row.plan_state);
      if (!planSnapshot) continue;

      if (hasIncompletePlan(planSnapshot.plan)) {
        this.db.prepare("update sessions set status = ? where id = ?").run("idle", sessionId);
      }
    }
  }

  claimChannelMessage(messageId: string, provider: string): boolean {
    const result = this.db
      .prepare("insert or ignore into channel_seen_message_ids (message_id, provider, created_at) values (?, ?, ?)")
      .run(messageId, provider, Date.now());
    return result.changes === 1;
  }

  releaseChannelMessage(messageId: string, provider: string): boolean {
    const result = this.db
      .prepare("delete from channel_seen_message_ids where message_id = ? and provider = ?")
      .run(messageId, provider);
    return result.changes === 1;
  }

  close(): void {
    if (this.closed) return;
    this.cancelMessageFlushTimer();
    let lastError: unknown;
    for (let attempt = 0; attempt < CLOSE_MESSAGE_FLUSH_ATTEMPTS; attempt += 1) {
      try {
        this.flushAllPendingMessages();
        this.db.close();
        this.closed = true;
        return;
      } catch (error) {
        lastError = error;
        this.reportMessageFlushError(error);
      }
    }
    throw lastError;
  }

  private scheduleMessageFlush(): void {
    if (this.closed || this.messageFlushTimer || this.pendingMessageWrites.size === 0) return;
    this.messageFlushTimer = this.messageTimerApi.setTimeout(() => {
      this.messageFlushTimer = null;
      try {
        this.flushAllPendingMessages();
      } catch (error) {
        this.scheduleMessageFlush();
        this.reportMessageFlushError(error);
      }
    }, this.messageBatchDelayMs);
    this.messageFlushTimer.unref?.();
  }

  private cancelMessageFlushTimer(): void {
    if (!this.messageFlushTimer) return;
    this.messageTimerApi.clearTimeout(this.messageFlushTimer);
    this.messageFlushTimer = null;
  }

  private reportMessageFlushError(error: unknown): void {
    try {
      this.onMessageFlushError(error);
    } catch (reportError) {
      console.error("Failed to report session message flush error:", reportError);
    }
  }

  private writeMessageRows(writes: PendingMessageWrite[]): void {
    if (writes.length === 0) return;
    let insertedRows = 0;
    const insert = this.db.prepare(
      "insert or ignore into messages (id, session_id, data, created_at) values (?, ?, ?, ?)",
    );
    const transaction = this.db.transaction(() => {
      for (const write of writes) {
        insertedRows += insert.run(write.id, write.sessionId, write.data, write.capturedAt).changes;
      }
    });
    transaction();
    this.messageWriteTransactionCount += 1;
    this.messageInsertedRows += insertedRows;
    this.messageIgnoredRows += writes.length - insertedRows;
  }

  private flushPendingMessagesForSession(sessionId: string): void {
    const writes = this.pendingMessageWrites.get(sessionId);
    if (!writes || writes.length === 0) return;
    this.writeMessageRows(writes);
    this.pendingMessageWrites.delete(sessionId);
    if (this.pendingMessageWrites.size === 0) {
      this.cancelMessageFlushTimer();
    }
  }

  private flushAllPendingMessages(): void {
    if (this.pendingMessageWrites.size === 0) return;
    const writes = [...this.pendingMessageWrites.values()].flat();
    this.writeMessageRows(writes);
    this.pendingMessageWrites.clear();
    this.cancelMessageFlushTimer();
  }

  private dropPendingMessagesForSession(sessionId: string): void {
    this.pendingMessageWrites.delete(sessionId);
    if (this.pendingMessageWrites.size === 0) {
      this.cancelMessageFlushTimer();
    }
  }

  private ensureSessionColumn(columnName: string, columnType: "text" | "integer"): void {
    const columns = this.db.prepare("pragma table_info(sessions)").all() as Array<Record<string, unknown>>;
    const hasColumn = columns.some((column) => column.name === columnName);
    if (!hasColumn) {
      this.db.exec(`alter table sessions add column ${columnName} ${columnType}`);
    }
  }

  private getSessionRow(id: string): Record<string, unknown> | undefined {
    return this.db
      .prepare(
        `select id, title, claude_session_id, status, model, config_profile_id, execution_mode, reasoning_mode, permission_mode, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, runtime_profile_state, archived_at, created_at, updated_at
         from sessions
          where id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
  }

  private mapSessionRow(sessionRow: Record<string, unknown>): StoredSession {
      return {
        id: String(sessionRow.id),
        title: String(sessionRow.title),
        status: sessionRow.status as SessionStatus,
        model: sessionRow.model ? String(sessionRow.model) : undefined,
        configProfileId: sessionRow.config_profile_id ? String(sessionRow.config_profile_id) : undefined,
        executionMode: sessionRow.execution_mode === "background" ? "background" : sessionRow.execution_mode === "foreground" ? "foreground" : undefined,
        reasoningMode: sessionRow.reasoning_mode ? (String(sessionRow.reasoning_mode) as RuntimeReasoningMode) : undefined,
        permissionMode: normalizeStoredPermissionMode(sessionRow.permission_mode),
        cwd: this.normalizeStoredCwd(
          String(sessionRow.id),
          sessionRow.cwd ? String(sessionRow.cwd) : undefined,
        ),
      runSurface: sessionRow.run_surface ? (String(sessionRow.run_surface) as AgentRunSurface) : undefined,
      agentId: sessionRow.agent_id ? String(sessionRow.agent_id) : undefined,
      allowedTools: sessionRow.allowed_tools ? String(sessionRow.allowed_tools) : undefined,
      lastPrompt: sessionRow.last_prompt ? String(sessionRow.last_prompt) : undefined,
      claudeSessionId: sessionRow.claude_session_id ? String(sessionRow.claude_session_id) : undefined,
      continuationSummary: sessionRow.continuation_summary ? String(sessionRow.continuation_summary) : undefined,
      continuationSummaryMessageCount: typeof sessionRow.continuation_summary_message_count === "number"
        ? Number(sessionRow.continuation_summary_message_count)
        : undefined,
      workflowMarkdown: sessionRow.workflow_markdown ? String(sessionRow.workflow_markdown) : undefined,
      workflowSourceLayer: sessionRow.workflow_source_layer ? (String(sessionRow.workflow_source_layer) as WorkflowScope) : undefined,
      workflowSourcePath: sessionRow.workflow_source_path ? String(sessionRow.workflow_source_path) : undefined,
      workflowState: parseWorkflowState(sessionRow.workflow_state),
      workflowError: sessionRow.workflow_error ? String(sessionRow.workflow_error) : undefined,
      runtimeProfileState: parseRuntimeProfileState(sessionRow.runtime_profile_state),
      archivedAt: typeof sessionRow.archived_at === "number" ? Number(sessionRow.archived_at) : undefined,
      createdAt: Number(sessionRow.created_at),
      updatedAt: Number(sessionRow.updated_at)
    };
  }
}

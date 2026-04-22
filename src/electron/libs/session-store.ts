import Database from "better-sqlite3";
import type { AgentRunSurface, SessionStatus, StreamMessage } from "../types.js";
import { existsSync } from "fs";
import { app } from "electron";
import type { SessionWorkflowState, WorkflowScope } from "../../shared/workflow-markdown.js";
import { stripInlineBase64ImagesFromMessage } from "./tool-output-sanitizer.js";

const LEGACY_CWD_SUFFIXES = [
  "/upstream/open-claude-cowork",
  "/Desktop/claw-open-cowork",
];

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

export type PendingPermission = {
  toolUseId: string;
  toolName: string;
  input: unknown;
  resolve: (result: { behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }) => void;
};

export type Session = {
  id: string;
  title: string;
  claudeSessionId?: string;
  status: SessionStatus;
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
  pendingPermissions: Map<string, PendingPermission>;
  abortController?: AbortController;
};

export type StoredSession = {
  id: string;
  title: string;
  status: SessionStatus;
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
  createdAt: number;
  updatedAt: number;
};

export type SessionHistory = {
  session: StoredSession;
  messages: StreamMessage[];
};

export class SessionStore {
  private sessions = new Map<string, Session>();
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
    this.loadSessions();
  }

  private resolveCwd(cwd?: string): string | undefined {
    if (!cwd) return undefined;
    if (existsSync(cwd)) {
      return cwd;
    }

    const appPath = app.getAppPath();
    for (const suffix of LEGACY_CWD_SUFFIXES) {
      if (cwd.endsWith(suffix) && existsSync(appPath)) {
        return appPath;
      }
    }

    return undefined;
  }

  private normalizeStoredCwd(sessionId: string, cwd?: string): string | undefined {
    const resolvedCwd = this.resolveCwd(cwd);
    if (resolvedCwd !== cwd) {
      this.db
        .prepare("update sessions set cwd = ?, updated_at = ? where id = ?")
        .run(resolvedCwd ?? null, Date.now(), sessionId);
    }
    return resolvedCwd;
  }

  createSession(options: {
    cwd?: string;
    runSurface?: AgentRunSurface;
    agentId?: string;
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
      cwd: options.cwd,
      runSurface: options.runSurface,
      agentId: options.agentId,
      allowedTools: options.allowedTools,
      lastPrompt: options.prompt,
      pendingPermissions: new Map()
    };
    this.sessions.set(id, session);
    this.db
      .prepare(
        `insert into sessions
          (id, title, claude_session_id, status, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` 
      )
      .run(
        id,
        session.title,
        session.claudeSessionId ?? null,
        session.status,
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
        now,
        now
      );
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  listSessions(): StoredSession[] {
    const rows = this.db
      .prepare(
        `select id, title, claude_session_id, status, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, created_at, updated_at
         from sessions
         order by updated_at desc`
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: row.status as SessionStatus,
      cwd: this.normalizeStoredCwd(String(row.id), row.cwd ? String(row.cwd) : undefined),
      runSurface: row.run_surface ? (String(row.run_surface) as AgentRunSurface) : undefined,
      agentId: row.agent_id ? String(row.agent_id) : undefined,
      allowedTools: row.allowed_tools ? String(row.allowed_tools) : undefined,
      lastPrompt: row.last_prompt ? String(row.last_prompt) : undefined,
      claudeSessionId: row.claude_session_id ? String(row.claude_session_id) : undefined,
      continuationSummary: row.continuation_summary ? String(row.continuation_summary) : undefined,
      continuationSummaryMessageCount: typeof row.continuation_summary_message_count === "number"
        ? Number(row.continuation_summary_message_count)
        : undefined,
      workflowMarkdown: row.workflow_markdown ? String(row.workflow_markdown) : undefined,
      workflowSourceLayer: row.workflow_source_layer ? (String(row.workflow_source_layer) as WorkflowScope) : undefined,
      workflowSourcePath: row.workflow_source_path ? String(row.workflow_source_path) : undefined,
      workflowState: parseWorkflowState(row.workflow_state),
      workflowError: row.workflow_error ? String(row.workflow_error) : undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    }));
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
      .filter((cwd): cwd is string => Boolean(cwd));
  }

  getSessionHistory(id: string): SessionHistory | null {
    const sessionRow = this.db
      .prepare(
        `select id, title, claude_session_id, status, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error, created_at, updated_at
         from sessions
         where id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!sessionRow) return null;

    const messages = (this.db
      .prepare(
        `select data, created_at from messages where session_id = ? order by created_at asc`
      )
      .all(id) as Array<Record<string, unknown>>)
      .map((row) => {
        const parsed = stripInlineBase64ImagesFromMessage(JSON.parse(String(row.data)) as StreamMessage);
        if (typeof parsed.capturedAt === "number") {
          return parsed;
        }
        return {
          ...parsed,
          capturedAt: Number(row.created_at),
        } satisfies StreamMessage;
      });

    return {
      session: {
        id: String(sessionRow.id),
        title: String(sessionRow.title),
        status: sessionRow.status as SessionStatus,
        cwd: this.normalizeStoredCwd(String(sessionRow.id), sessionRow.cwd ? String(sessionRow.cwd) : undefined),
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
        createdAt: Number(sessionRow.created_at),
        updatedAt: Number(sessionRow.updated_at)
      },
      messages
    };
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    Object.assign(session, updates);
    this.persistSession(id, updates);
    return session;
  }

  recoverInterruptedSessions(): string[] {
    const recoveredIds: string[] = [];

    for (const session of this.sessions.values()) {
      if (session.status !== "running") {
        continue;
      }

      session.status = "idle";
      session.abortController = undefined;
      session.pendingPermissions.clear();
      recoveredIds.push(session.id);
    }

    if (recoveredIds.length === 0) {
      return recoveredIds;
    }

    const placeholders = recoveredIds.map(() => "?").join(", ");
    this.db
      .prepare(`update sessions set status = ? where id in (${placeholders})`)
      .run("idle", ...recoveredIds);

    return recoveredIds;
  }

  setAbortController(id: string, controller: AbortController | undefined): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.abortController = controller;
  }

  recordMessage(sessionId: string, message: StreamMessage): void {
    const capturedAt = typeof message.capturedAt === "number" ? message.capturedAt : Date.now();
    const storedMessage = message.capturedAt === capturedAt ? message : { ...message, capturedAt };
    const id = ('uuid' in message && message.uuid) ? String(message.uuid) : crypto.randomUUID();
    this.db
      .prepare(
        `insert or ignore into messages (id, session_id, data, created_at) values (?, ?, ?, ?)`
      )
      .run(id, sessionId, JSON.stringify(storedMessage), capturedAt);
  }

  deleteSession(id: string): boolean {
    const existing = this.sessions.get(id);
    if (existing) {
      this.sessions.delete(id);
    }
    this.db.prepare(`delete from messages where session_id = ?`).run(id);
    const result = this.db.prepare(`delete from sessions where id = ?`).run(id);
    const removedFromDb = result.changes > 0;
    return removedFromDb || Boolean(existing);
  }

  private persistSession(id: string, updates: Partial<Session>): void {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const updatable = {
      claudeSessionId: "claude_session_id",
      status: "status",
      cwd: "cwd",
      runSurface: "run_surface",
      agentId: "agent_id",
      allowedTools: "allowed_tools",
      lastPrompt: "last_prompt",
      continuationSummary: "continuation_summary",
      continuationSummaryMessageCount: "continuation_summary_message_count",
      workflowMarkdown: "workflow_markdown",
      workflowSourceLayer: "workflow_source_layer",
      workflowSourcePath: "workflow_source_path",
      workflowState: "workflow_state",
      workflowError: "workflow_error",
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
      values.push(value === undefined ? null : (value as string | number));
    }

    if (fields.length === 0) return;
    fields.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);
    this.db
      .prepare(`update sessions set ${fields.join(", ")} where id = ?`)
      .run(...values);
  }

  private initialize(): void {
    this.db.exec(`pragma journal_mode = WAL;`);
    this.db.exec(
      `create table if not exists sessions (
        id text primary key,
        title text,
        claude_session_id text,
        status text not null,
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
        created_at integer not null,
        updated_at integer not null
      )`
    );
    this.ensureSessionColumn("continuation_summary", "text");
    this.ensureSessionColumn("continuation_summary_message_count", "integer");
    this.ensureSessionColumn("run_surface", "text");
    this.ensureSessionColumn("agent_id", "text");
    this.ensureSessionColumn("workflow_markdown", "text");
    this.ensureSessionColumn("workflow_source_layer", "text");
    this.ensureSessionColumn("workflow_source_path", "text");
    this.ensureSessionColumn("workflow_state", "text");
    this.ensureSessionColumn("workflow_error", "text");
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
  }

  private loadSessions(): void {
    const rows = this.db
      .prepare(
        `select id, title, claude_session_id, status, cwd, run_surface, agent_id, allowed_tools, last_prompt, continuation_summary, continuation_summary_message_count, workflow_markdown, workflow_source_layer, workflow_source_path, workflow_state, workflow_error
         from sessions`
      )
      .all();
    for (const row of rows as Array<Record<string, unknown>>) {
      const session: Session = {
        id: String(row.id),
        title: String(row.title),
        claudeSessionId: row.claude_session_id ? String(row.claude_session_id) : undefined,
        status: row.status as SessionStatus,
        cwd: this.normalizeStoredCwd(String(row.id), row.cwd ? String(row.cwd) : undefined),
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
        pendingPermissions: new Map()
      };
      this.sessions.set(session.id, session);
    }
  }

  close(): void {
    this.db.close();
  }

  private ensureSessionColumn(columnName: string, columnType: "text" | "integer"): void {
    const columns = this.db.prepare("pragma table_info(sessions)").all() as Array<Record<string, unknown>>;
    const hasColumn = columns.some((column) => column.name === columnName);
    if (!hasColumn) {
      this.db.exec(`alter table sessions add column ${columnName} ${columnType}`);
    }
  }
}

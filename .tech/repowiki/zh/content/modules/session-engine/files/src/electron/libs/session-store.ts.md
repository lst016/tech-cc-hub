# src/electron/libs/session-store.ts

> 模块：`session-engine` · 语言：`typescript` · 行数：666

## 文件职责

核心Session存储引擎，使用better-sqlite3管理会话和消息的持久化、查询、归档

## 运行信号

- `create table: sessions`
- `create table: messages`

## 关键符号

- `parseWorkflowState@0 - 解析JSON格式的workflow状态，失败时返回undefined`
- `isTransientStreamEventMessage@0 - 判断消息是否为瞬态事件（如stream_event或status子类型），用于过滤`
- `parseStoredMessage@0 - 从数据库行解析StreamMessage，附加capturedAt和historyId`
- `createHistoryCursor@0 - 基于消息创建分页游标{capturedAt, historyId}`
- `SessionStore@0 - 主存储类，管理sessions Map和db连接，提供createSession/listSessions/archiveSession/startSession等API`
- `LEGACY_CWD_SUFFIXES@0 - 历史遗留路径后缀列表，用于兼容旧版本cwd路径`
- `Session@0 - 运行时会话对象，包含pendingPermissions Map和abortController等运行时字段`
- `StoredSession@0 - 持久化会话投影，不含运行时字段`
- `SessionHistory@0 - 会话+消息的组合类型`
- `SessionHistoryPage@0 - 分页类型，包含hasMore和nextCursor`

## 依赖输入

- `better-sqlite3`
- `../types.js`
- `fs`
- `electron`
- `../../shared/runner-status.js`
- `../../shared/workflow-markdown.js`
- `./tool-output-sanitizer.js`

## 对外暴露

- `PendingPermission`
- `Session`
- `StoredSession`
- `SessionHistory`
- `SessionHistoryPage`
- `SessionStore`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";
import type { AgentRunSurface, SessionHistoryCursor, SessionStatus, StreamMessage } from "../types.js";
import { existsSync } from "fs";
import electron from "electron";
import { isSuccessfulRunnerResult } from "../../shared/runner-status.js";
import type { SessionWorkflowState, WorkflowScope } from "../../shared/workflow-markdown.js";
import { stripInlineBase64ImagesFromMessage } from "./tool-output-sanitizer.js";

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
  model?: string;
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
  archivedAt?: number;
  pendingPermissions: Map<string, PendingPermission>;
  abortController?: AbortController;
};

export type StoredSession = {
  id: string;
  title: string;
  status: SessionStatus;
  model?: string;
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
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type SessionHistory = {
  session: StoredSession;
  messages: StreamMessage[];
};

export type SessionHistoryPage = SessionHistory & {
  hasMore: boolean;
  nextCursor?: SessionHistoryCursor;
};

function isTransientStreamEventMessage(message: StreamMessage): boolean {
  return (
    "type" in message &&
    (
      message.type === "stream_event" ||
      (message.type === "system" && "subtype" in message && message.subtype === "status")
    )
  );
}

function parseStoredMessage(row: { id: string; data: string; created_at: number }): StreamMessage {
  const parsed = stripInlineBase64ImagesFromMessage(JSON.parse(String(row.data)) as StreamMessage);
  return {
    ...parsed,
    capturedAt: typeof parsed.capturedAt === "number" ? parsed.capturedAt : Number(row.created_at),
    historyId: parsed.historyId ? String(parsed.historyId) : String(row.id),
  } satisfies StreamMessage;
}

function createHistoryCursor(message: StreamMessage | undefined): SessionHistoryCursor | undefined {
  if (!message || typeof message.capturedAt !== "number" || !message.historyId) {
    return undefined;
  }

  return {
    beforeCreatedAt: message.capturedAt,
    beforeId: message.historyId,
  };
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
    this.recoverSuccessfulErrorSessions();
    this.loadSessions();
  }

  private resolveCwd(cwd?: string): string | undefined {
    if (!cwd) return undefined;
    if (existsSync(cwd)) {
      return cwd;
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

  private normalizeStoredCwd(sessionId: string, cwd?: string):
... (truncated)
```

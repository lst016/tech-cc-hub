# doc/20-contracts/session-lifecycle/spec.md

> 模块：`session-engine` · 语言：`markdown` · 行数：215

## 文件职责

Session/Message/Event状态机规范文档，定义生命周期和持久化语义

## 关键符号

- `Session状态机@0 - idle→running→completed/error的状态转换规则`
- `SessionHistoryPage@0 - 游标分页接口：beforeCreatedAt和beforeId`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "DOC-SPEC-SESSION-LIFECYCLE"
title: "会话/消息/事件状态机 Spec"
doc_type: "spec"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "contracts"
  - "session-lifecycle"
  - "spec"
---

# 会话/消息/事件状态机 Spec

## Purpose

定义 Session、Message、Event 三个核心实体的生命周期、状态转换规则和持久化语义。

## Scope

- Session：从创建到删除的完整生命周期
- Message：消息的持久化和历史分页
- Event：执行事件的记录和聚合
- 不在本文档范围：UI 层的 SessionSidebar 交互行为

## Interfaces / Types

### Session

定义位置：`src/electron/libs/session-store.ts:34-55`

```typescript
type Session = {
  id: string;
  title: string;
  claudeSessionId?: string;         // SDK 远端会话 ID，用于 resume
  status: SessionStatus;            // "idle" | "running" | "completed" | "error"
  model?: string;
  cwd?: string;                     // 工作目录
  runSurface?: "development" | "maintenance";
  agentId?: string;
  allowedTools?: string;
  lastPrompt?: string;
  continuationSummary?: string;     // 上下文压缩滚动摘要
  continuationSummaryMessageCount?: number;
  workflowMarkdown?: string;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowState?: SessionWorkflowState;
  workflowError?: string;
  archivedAt?: number;              // Unix ms，非空表示已归档
  pendingPermissions: Map<string, PendingPermission>;
  abortController?: AbortController;
};
```

### StoredSession

持久化到 SQLite 的 Session 投影（不含运行时字段 `pendingPermissions` 和 `abortController`）：

```typescript
type StoredSession = {
  id: string;
  title: string;
  status: SessionStatus;
  model?: string;
  cwd?: string;
  // ... (同 Session，排除 pendingPermissions 和 abortController)
  createdAt: number;
  updatedAt: number;
};
```

### Message

```typescript
// StreamMessage = SDKMessage | UserPromptMessage | PromptLedgerMessage
// 存储时附加 capturedAt 和 historyId
type StreamMessage = (SDKMessage | UserPromptMessage | PromptLedgerMessage) & {
  capturedAt?: number;
  historyId?: string;
};
```

### SessionHistory & SessionHistoryPage

```typescript
type SessionHistory = {
  session: StoredSession;
  messages: StreamMessage[];
};

type SessionHistoryPage = SessionHistory & {
  hasMore: boolean;
  nextCursor?: SessionHistoryCursor; // { beforeCreatedAt: number; beforeId: string }
};
```

## State / Lifecycle

### Session 状态机

```
                  session.create / session.start
                            │
                            ▼
                        ┌───────┐
            ┌───────────│ idle  │◄──────────┐
            │           └───┬───┘           │
            │               │               │
            │               │ session.start │ session.stop
            │               │ session.continue  (abort)
            │               ▼               │
            │           ┌─────────┐         │
            │           │ running │─────────┘
            │           └────┬────┘
            │                │
            │     ┌──────────┼──────────┐
            │     ▼          ▼          ▼
            │ ┌─────────┐ ┌───────┐ ┌───────┐
            │ │completed│ │ error │ │ idle  │
            │ └─────────┘ └───────┘ └───────┘
            │
            │  session.archive
            ▼
      ┌──────────┐
      │ archived │ (archivedAt != null)
      └────┬─────┘
           │ session.unarchive → 回到之前的状态
           │ session.delete → 永久删除
           ▼
          ✕ (deleted)
```

### 状态转换规则

| 当前状态 | 触发事件 | 新状态 | 备注 |
|---------|---------|--------|------|
| (不存在) | `session.create` | `idle` | 创建空会话 |
| (不存在) | `session.start` | `running` | 创建并立即启动 |
| `idle` | `session.start` | `running` | 重新启动已有会话 |
| `idle` | `session.continue` | `running` | 继续已有会话 |
| `running` | SDK 返回 result | `completed` | Agent 正常完成 |
| `running` | SDK 抛出异常 | `error` | Runner catch 块设置 |
| `running` | `session.stop` | `idle` | 用户主动停止 |
| `running` | `session.append` | `running` | 状态不变，指令注入 |
| 任意 | `session.archive` | 当前状态 + `archivedAt` 置值 | 软删除 |
| 已归档 | `session.unarchive` | 原状态，`archivedAt` 置 null | 恢复 |
| 任意 | `session.delete` | 删除 | 物理删除，先 abort |

### 启动恢复

- 应用启动时 `SessionStore.recoverInterruptedSessions()` 将所有 `running` 状态 session
... (truncated)
```

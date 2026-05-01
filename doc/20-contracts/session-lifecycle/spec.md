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

- 应用启动时 `SessionStore.recoverInterruptedSessions()` 将所有 `running` 状态 session 重置为 `idle`
- `session.continue` 支持远端 resume：如果 SDK session 仍然存活且模型未切换，复用 `claudeSessionId`

### 上下文压缩

- 当消息历史超过 `contextWindow * compressionThresholdPercent` 时，触发 stateless continuation
- 压缩结果存储在 `continuationSummary` 和 `continuationSummaryMessageCount`
- 下次 continue 时，摘要通过 PromptLedger 注入为 memory source

### Message 持久化

- `stream.message` 事件 → `sessions.recordMessage()` → SQLite messages 表
- `stream.user_prompt` 事件 → `sessions.recordMessage()` → SQLite messages 表
- 消息存储前经过 `stripInlineBase64ImagesFromMessage()` 清理
- 历史加载时通过 `hydrateImagePreviewsForDisplay()` 按需还原图片预览

### 历史分页

- 使用基于游标的分页：`{ beforeCreatedAt: number; beforeId: string }`
- 首次加载传 `mode: "replace"`，后续加载传 `mode: "prepend"`
- `hasMore` 指示是否有更多历史消息

## Error Handling

| 场景 | 处理 |
|------|------|
| Session 不存在 | 发 `session.deleted` + `runner.error` |
| Append 到非 running 状态 | `runner.error`："当前会话没有正在执行的任务" |
| Append 时 Runner 未就绪 | `runner.error`："当前执行器还未就绪" |
| SDK 执行异常 | `session.status` → `error`，payload.error 包含错误描述 |
| 图片回填失败 | 静默降级，不阻断历史加载 |
| Workflow 解析失败 | `workflowError` 记录错误，`workflowState` 置空 |

## Security / Permission Boundary

- `pendingPermissions` Map 仅在主进程内存中，不持久化
- `abortController` 仅主进程持有
- API Key 不出现在 Session 的任何字段中

## Compatibility

- `Session` 类型新增字段必须可选（`?`），旧 session 从 SQLite 读出时可能缺少新字段
- `SessionStatus` 值域只增不减
- 消息表 schema 变更需要 migration

## Acceptance Criteria

- [ ] 所有状态转换路径在 `ipc-handlers.ts` 中有明确分支
- [ ] `recoverInterruptedSessions()` 在启动时正确重置 running → idle
- [ ] 已删除 session 的延迟事件被正确丢弃
- [ ] 归档/取消归档的 session 在 UI 列表正确显示/隐藏

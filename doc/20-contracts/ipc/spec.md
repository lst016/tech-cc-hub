---
doc_id: "DOC-SPEC-IPC"
title: "IPC 通道与消息格式 Spec"
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
  - "ipc"
  - "spec"
---

# IPC 通道与消息格式 Spec

## Purpose

定义 Electron 主进程与渲染进程之间的 IPC 通道、事件类型枚举、消息格式及错误处理约定。前端和 Electron 主进程的所有通信必须遵守本文档。

## Scope

- 主进程 → 渲染进程：`ServerEvent` 联合类型，通过 `webContents.send("server-event", payload)` 广播
- 渲染进程 → 主进程：`ClientEvent` 联合类型，通过 `ipcMain.on("client-event", handler)` 接收
- 不在本文档范围：SDK 级消息 (`SDKMessage`) 的字段定义，那是 SDK 契约

## Interfaces / Types

### ServerEvent（主进程 → 渲染进程）

定义位置：`src/electron/types.ts:113-126`

| 事件类型 | Payload | 说明 |
|---------|---------|------|
| `stream.message` | `{ sessionId, message: StreamMessage }` | Agent 输出流消息 |
| `stream.user_prompt` | `{ sessionId, prompt, attachments?, capturedAt?, historyId? }` | 用户输入回显 |
| `session.status` | `{ sessionId, status, title?, cwd?, model?, error?, slashCommands? }` | 会话状态变更 |
| `session.workflow` | `{ sessionId, markdown?, sourceLayer?, sourcePath?, state?, error? }` | 工作流变更 |
| `session.workflow.catalog` | `SessionWorkflowCatalog` | 工作流目录 |
| `session.list` | `{ sessions: SessionInfo[], archived? }` | 会话列表 |
| `session.history` | `{ sessionId, status, messages, mode, hasMore, nextCursor?, slashCommands? }` | 历史消息分页 |
| `session.archived` | `{ sessionId, session? }` | 会话已归档 |
| `session.unarchived` | `{ sessionId, session? }` | 会话已取消归档 |
| `session.deleted` | `{ sessionId }` | 会话已删除 |
| `permission.request` | `{ sessionId, toolUseId, toolName, input }` | 权限请求 |
| `runner.error` | `{ sessionId?, message }` | Runner 错误 |
| `agent.list` | `{ agents: Array<{ id, name, description?, scope }> }` | Agent 列表 |

### ClientEvent（渲染进程 → 主进程）

定义位置：`src/electron/types.ts:129-144`

| 事件类型 | Payload | 说明 |
|---------|---------|------|
| `session.create` | `{ title?, cwd?, allowedTools? }` | 创建空会话 |
| `session.start` | `{ title, prompt, cwd?, allowedTools?, attachments?, runtime? }` | 创建并启动会话 |
| `session.continue` | `{ sessionId, prompt, attachments?, runtime? }` | 继续已有会话 |
| `session.append` | `{ sessionId, prompt, attachments? }` | 运行中插入补充指令 |
| `session.stop` | `{ sessionId }` | 停止会话 |
| `session.archive` | `{ sessionId }` | 归档会话 |
| `session.unarchive` | `{ sessionId }` | 取消归档 |
| `session.delete` | `{ sessionId }` | 删除会话 |
| `session.list` | `{ archived? }` | 列出会话 |
| `session.history` | `{ sessionId, before?, limit? }` | 获取历史消息 |
| `session.workflow.catalog.list` | `{ sessionId }` | 获取工作流目录 |
| `session.workflow.set` | `{ sessionId, markdown, sourceLayer, sourcePath? }` | 设置工作流 |
| `session.workflow.clear` | `{ sessionId }` | 清除工作流 |
| `permission.response` | `{ sessionId, toolUseId, result }` | 权限决策结果 |
| `agent.list` | `{ cwd? }` | 列出可用 Agent |

### 传输格式

- 主进程通过 `BrowserWindow.webContents.send("server-event", JSON.stringify(event))` 发送
- 渲染进程通过 `window.electron.sendEvent(event)` 发送
- 广播模式：一个 `ServerEvent` 发送给所有 BrowserWindow

## State / Lifecycle

### 消息投递保证

- **尽力投递**：不保证重试，不保证有序
- **延迟删除保护**：`ipc-handlers.ts:317-325` 中，`session.status`、`stream.message`、`stream.user_prompt`、`permission.request` 在 session 已删除时被丢弃
- **消息持久化**：`stream.message` 和 `stream.user_prompt` 在广播前先写入 SQLite

## Error Handling

### 错误码约定

IPC 层不定义独立错误码。错误通过以下方式传递：

| 场景 | 传递方式 |
|------|---------|
| Runner 执行失败 | `runner.error` ServerEvent，payload.message 为错误描述 |
| Session 不存在 | `session.deleted` ServerEvent，随后 `runner.error` |
| 权限超时/拒绝 | 通过 `permission.response` 的 `PermissionResult` 传递 |
| append 失败 | `runner.error`，message 描述具体原因 |

### 边界条件

| 条件 | 行为 |
|------|------|
| 对不存在的 session 操作 | 先发 `session.deleted`，再发 `runner.error` |
| 对非 running 状态 session append | 发 `runner.error`："当前会话没有正在执行的任务" |
| Runner handle 未就绪时 append | 发 `runner.error`："当前执行器还未就绪" |
| 正在运行的 session 被 stop | 调用 `handle.abort()`，状态置为 `idle` |
| 正在运行的 session 被 delete | 调用 `handle.abort()`，从 store 删除 |

## Security / Permission Boundary

- IPC 事件仅在 Electron 主进程和渲染进程之间传递，不暴露给外部
- `permission.request` / `permission.response` 是工具调用的安全门禁
- API Key 等敏感信息不出现在 IPC 事件 payload 中（api-config.json 仅主进程读取）

## Compatibility

- 新增 ClientEvent/ServerEvent 类型时，主进程和渲染进程需同步更新 `types.ts`
- 不得删除已有事件类型，只能新增或标记废弃
- `payload` 字段只能扩展（新增可选字段），不能删减必填字段

## Acceptance Criteria

- [ ] 所有 ClientEvent 类型在 `ipc-handlers.ts` 中有对应处理分支
- [ ] 所有 ServerEvent 类型在渲染进程中有对应监听
- [ ] 新增事件类型必须更新本文档
- [ ] `session.deleted` 后的延迟事件丢弃逻辑有测试覆盖

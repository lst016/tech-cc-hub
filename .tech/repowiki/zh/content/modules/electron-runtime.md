# electron-runtime

> Main Electron process runtime managing desktop UI interactions, session persistence, task execution, browser previews, and Claude Code agent orchestration

Core Electron main process module that bridges the renderer UI with backend services. Handles IPC communication for chat sessions, browser workbench previews, MCP tool routing, task execution (Lark/Trello/Feishu), cron scheduling, knowledge base operations, and session trace replay. Uses SQLite (better-sqlite3) for persistent storage of sessions and messages, and integrates Claude Code via the @anthropic-ai/claude-agent-sdk.

## Agent 可用信息

- IPC channel names for triggering session operations: sessions:list, slash-commands:list, plugins:getOpenComputerUseStatus
- Task execution event names for debugging: task.updated, task.execution.started, task.execution.completed, task.error
- Database schema hint: messages table has session_id and created_id indexes for paginated history queries
- Warm runner cleanup interval is 30 minutes - affects session resume behavior timing
- ChannelReplyTarget type structure for outbound message routing
- RunnerHandle.abort() is the cancellation mechanism for running sessions
- PendingPermission type shows tool permission flow: toolUseId, toolName, input, resolve({behavior, updatedInput, message})

## 优先入口

- `src/electron/main.ts`：Primary Electron main() function creates app, BrowserWindow, and registers all IPC handlers. First file to understand application initialization flow.
- `src/electron/ipc-handlers.ts`：Exports handleClientEvent() which is the main IPC dispatch function called from main.ts ipcMainHandle wrappers

## 文件

### `src/electron/main.ts`

Electron main entry point - creates BrowserWindow instances, registers IPC handlers, manages system shortcuts, dialogs, clipboard, and desktop capture. Responsible for application lifecycle, menu construction, and auto-updater integration.

- `cleanupComplete` (const) - Signals cleanup completion for graceful shutdown
- `DEFAULT_BROWSER_WORKBENCH_SESSION_ID` (const) - Reserved session ID for browser preview workbench
- `browserWorkbenches` (Map) - Active BrowserWorkbenchManager instances keyed by session ID
- `browserWorkbenchEventListeners` (Map) - Event listeners for browser workbench bounds changes
- `KNOWLEDGE_UI_CHANNELS` (const) - IPC channel constants for knowledge base UI operations

### `src/electron/ipc-handlers.ts`

Central IPC handler registration and event broadcasting. Manages runner lifecycle (warm runners with 30-minute idle cleanup), channel reply targets, Figma OAuth state, and integrates TaskExecutor for external task providers. All IPC channels from renderer are handled here.

- `runnerHandles` (Map<string, RunnerHandle>) - Active Claude Code runner handles for session reuse
- `warmRunnerCleanupTimers` (Map<string, ReturnType<typeof setTimeout>>) - Timers for cleaning up idle warm runners after WARM_RUNNER_IDLE_MS (30 minutes)
- `serverEventListeners` (Set<(event: ServerEvent) => void>) - Listeners for broadcasting server events to renderer
- `channelReplyTargets` (Map<string, ChannelReplyTarget>) - Active channel reply destinations for workspace messaging
- `initializeTaskExecutor` (function) - Creates TaskExecutor with registered providers: Lark, Trello, FeishuProject
- `initializeNoteRepository` (function) - Creates NoteRepository with Database instance
- `setChannelReplySender` (function) - Sets the channel reply sender function for outbound messages

### `src/electron/libs/runner.ts`

Executes Claude Code via @anthropic-ai/claude-agent-sdk. Builds prompts with attachments, registers learning hooks (secret scan, commit validation, quality gates, drift detection), and normalizes runner errors. Manages MCP OAuth authentication flows.

- `runClaude` (function) - Primary entry - executes Claude Code with RunnerOptions, returns RunnerHandle
- `RunnerHandle` (type) - Handle with abort(), appendPrompt(), isClosed(), and optional reuseKey
- `ALWAYS_ALLOWED_TOOLS` (Set<string>) - Tools exempt from permission requests: AskUserQuestion + all built-in MCP tools
- `SKILL_ENV_HINTS` (Record<string, string[]>) - Environment variable hints by skill name for dynamic injection

### `src/electron/libs/session-store.ts`

SQLite-backed persistence for sessions and messages. Provides SessionStore class with load/save/archive operations, workflow state parsing, and legacy CWD resolution for migrated sessions.

- `SessionStore` (class) - Main store with sessions Map and Database connection
- `Session` (type) - Runtime session with pendingPermissions Map and AbortController
- `StoredSession` (type) - Persisted session format without runtime-only fields
- `parseStoredMessage` (function) - Deserializes stored StreamMessage with capturedAt and historyId normalization
- `isTransientStreamEventMessage` (function) - Filters out transient events for history storage

### `src/electron/dev-backend-bridge.ts`

Development-only HTTP bridge enabling frontend-backend RPC communication via JSON POST endpoints and SSE event streams. Allows external tools to invoke handlers and subscribe to server/browser events.

- `DEV_BACKEND_BRIDGE_PORT` (const) - Default port 4317 for dev bridge server
- `startDevBackendBridge` (function) - Creates HTTP server with /health, /events/server, /events/browser, and /rpc/{handler} endpoints
- `readJsonBody` (function) - Aggregates request chunks and parses JSON body

## 数据与接口契约

- **IPC channel: task.updated**：Broadcasts task state changes. Payload: {task: Task}. Owner: src/electron/ipc-handlers.ts initializeTaskExecutor() onTaskUpdated callback
- **IPC channel: channel.message.receive**：Inbound message from channel workspace. Payload: ChannelReplyTarget + message text. Owner: src/electron/ipc-handlers.ts recordChannelInboundMessage()
- **Database table: sessions**：Columns: id, title, status, model, cwd, runSurface, agentId, allowedTools, claudeSessionId, workflowMarkdown, workflowState, archivedAt, createdAt, updatedAt. Owner: src/electron/libs/session-store.ts SessionStore
- **Database table: messages**：Columns: id, session_id, data (JSON StreamMessage), created_at. Indexes on session_id and (session_id, created_id). Owner: src/electron/libs/session-store.ts SessionStore.insertMessage()
- **IPC channel: permission.request**：Tool permission approval. Handler at src/electron/ipc-handlers.ts resolvePermission(). Resolves PendingPermission from sessions pendingPermissions Map
- **ServerEvent type**：Union of all event types: stream.message, permission.request, session.status, runner.error, etc. Defined in src/electron/types.ts
- **RuntimeOverrides type**：Config overrides for runner: apiConfig, envConfig, model, cwd, allowedTools, agentId. Passed through RunnerOptions.runtime field

## 关键概念

- **Browser Workbench**：Embedded BrowserWindow for live preview. Managed by BrowserWorkbenchManager, bounds tracked, events broadcast on src/electron/main.ts:116
- **Warm Runner Reuse**：Idle runners kept alive for WARM_RUNNER_IDLE_MS (30min) for faster subsequent prompts. Cleanup timers on src/electron/ipc-handlers.ts:53
- **Session Persistence**：SQLite tables: sessions (metadata, workflow state), messages (StreamMessage with capturedAt/historyId). Legacy CWD migration handled on session-store.ts:9-21
- **MCP OAuth Flow**：handleClientEvent() processes mcpAuthenticate via QueryWithMcpOAuth type, supporting server-specific OAuth redirects
- **Channel Workspace**：Dual-direction messaging system: channelReplyTargets map targets, channelReplySender handles outbound. Events: channel.message.receive
- **Task Execution Providers**：Three providers registered: LarkTaskProvider, TbTaskProvider, FeishuProjectTaskProvider. Broadcasts task.updated, task.execution.completed, etc.
- **Cron Service**：CronService + CronRepository + CronJobExecutor for scheduled task execution, registered via setCronService() in MCP tools

## 内部关系

- `src/electron/main.ts` -> `src/electron/ipc-handlers.ts`：Imports IPC handler functions and event emitters for task/cron/channel operations
- `src/electron/main.ts` -> `src/electron/libs/session-store.ts`：Accesses exported sessions instance for session listing and cleanup
- `src/electron/ipc-handlers.ts` -> `src/electron/libs/runner.ts`：Uses runClaude() to execute agent prompts and manages RunnerHandle lifecycle
- `src/electron/ipc-handlers.ts` -> `src/electron/libs/session-store.ts`：Imports SessionStore instance, ServerEventListener setup, and channel workspace types
- `src/electron/libs/runner.ts` -> `src/shared/runner-prompt.ts`：Uses buildRunnerPromptContentBlocks() for prompt construction
- `src/electron/libs/runner.ts` -> `src/shared/runner-status.ts`：Checks isSuccessfulRunnerResult() and shouldSuppressRunnerErrorAfterSuccessfulResult()
- `src/electron/libs/runner.ts` -> `src/electron/libs/learning-hooks.ts`：Registers hooks for secrets, corrections, quality gates, drift detection, git blast radius

## 运行注意事项

- Dev mode bridge runs on port 4317, disabled in production builds via isDev() check
- Database path passed to initializeNoteRepository() and initializeTaskExecutor() - typically app userData path
- Browser workbench bounds events allow renderer to sync window positions for floating preview
- Channel workspace supports both inbound (receive) and outbound (reply) messaging with separate target routing
- Legacy CWD resolution for sessions ending with /upstream/open-claude-cowork or /Desktop/claw-open-claude-cowork maps to app.getAppPath()
- Figma Agent OAuth bridge is disabled (FIGMA_AGENT_OAUTH_BRIDGE_ENABLED = false) - Codex OAuth is the supported path
- Image attachments are preprocessed via preprocessImageAttachments() before being passed to runner

## 修改风险

- Changing WARM_RUNNER_IDLE_MS value affects session resume performance and memory usage
- Modifying Session type fields requires SQLite migration - StoredSession type must stay compatible
- Removing IPC channels in main.ts ipcMainHandle calls will break renderer communication without updates to both sides
- Task provider registration order in initializeTaskExecutor() affects provider IDs - changing requires provider ID updates
- BrowserWorkbenchManager bounds events are expected by renderer for preview window sync - breaking changes need renderer updates
- ChannelReplyTarget structure changes break channel workspace messaging
- Learning hooks in runner.ts affect security scanning behavior - removing hooks may introduce vulnerabilities

## 验证

- Run npm test or specific test files under src/electron/__tests__/ to verify IPC handler behavior
- Check dev-backend-bridge health: curl http://localhost:4317/health
- Verify database tables: sqlite3 <path> '.tables' and '.schema sessions' / '.schema messages'
- Test session persistence by creating session, restarting app, listing sessions via IPC: sessions:list
- Verify task sync by triggering provider sync and checking task.updated events in renderer dev tools

# package/bridge.d.ts

> 模块：`package` · 语言：`typescript` · 行数：232

## 文件职责

桥接会话SDK的类型定义，处理与Claude.ai的实时通信

## 关键符号

- `SessionState@0 - 会话状态枚举：idle/running/requires_action`
- `BridgeSessionHandle@0 - 会话句柄，包含SSE序列号追踪、消息写入、权限请求转发等方法`
- `AttachBridgeSessionOptions@0 - 附加会话的选项配置`
- `RemoteCredentials@0 - 远程认证凭证`

## 依赖输入

- `./agentSdkTypes.js`

## 对外暴露

- `SessionState`
- `BridgeSessionHandle`
- `AttachBridgeSessionOptions`
- `RemoteCredentials`
- `CredentialsFailure`
- `CodeSessionGitContext`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
/**
 * API surface definition for @anthropic-ai/claude-agent-sdk/bridge.
 *
 * This file is the source of truth for the /bridge export's public types.
 * It imports ONLY from agentSdkTypes.ts so the compiled .d.ts has exactly
 * one import to rewrite (./agentSdkTypes → ./sdk) for the flat package layout.
 *
 * Compiled by scripts/build-ant-sdk-typings.sh; see build-agent-sdk.sh for the
 * copy into the package. Runtime code is in agentSdkBridge.ts (separate file,
 * bun-built to bridge.mjs).
 *
 * The two type definitions below are copied from src/bridge/sessionHandle.ts.
 * Keep in sync — sessionHandle.ts is the implementation source of truth;
 * this file exists to produce a clean .d.ts without walking the implementation
 * import graph.
 */
import type { PermissionMode, SDKControlRequest, SDKControlResponse, SDKMessage } from './agentSdkTypes.js';
/**
 * Session state reported to the CCR /worker endpoint.
 * @alpha
 */
export type SessionState = 'idle' | 'running' | 'requires_action';
/**
 * Per-session bridge transport handle.
 *
 * Auth is instance-scoped — the JWT lives in this handle's closure, not a
 * process-wide env var, so multiple handles can coexist without stomping
 * each other.
 * @alpha
 */
export type BridgeSessionHandle = {
    readonly sessionId: string;
    /**
     * Live SSE event-stream high-water mark. Updates as the underlying
     * transport receives frames. Persist this and pass back as
     * `initialSequenceNum` on re-attach so the server resumes instead of
     * replaying full history.
     */
    getSequenceNum(): number;
    /** True once the write path (CCRClient initialize) is ready. */
    isConnected(): boolean;
    /** Write a single SDKMessage. `session_id` is injected automatically. */
    write(msg: SDKMessage): void;
    /** Signal turn boundary — claude.ai stops the "working" spinner. */
    sendResult(): void;
    /** Forward a permission request (`can_use_tool`) to claude.ai. */
    sendControlRequest(req: SDKControlRequest): void;
    /** Forward a permission response back through the bridge. */
    sendControlResponse(res: SDKControlResponse): void;
    /**
     * Tell claude.ai to dismiss a pending permission prompt (e.g. caller
     * aborted the turn locally before the user answered).
     */
    sendControlCancelRequest(requestId: string): void;
    /**
     * Swap the underlying transport in place with a fresh JWT (and epoch).
     * Carries the SSE sequence number so the server resumes the stream.
     * Call this when the poll loop re-dispatches work for the same session
     * with a fresh secret (JWT is 4h; backend mints a new one every dispatch).
     *
     * Throws if `createV2ReplTransport` fails (registerWorker error, etc).
     * Caller should treat that as a close and drop this handle.
     */
    reconnectTransport(opts: {
        ingressToken: string;
        apiBaseUrl: string;
        /** Omit to call registerWorker; provide if the server already bumped. */
        epoch?: number;
    }): Promise<void>;
    /**
     * PUT /worker state. Multi-session workers: `running` on turn start,
     * `requires_action` on permission prompt, `idle` on turn end. Daemon
     * callers don't need this — user watches the REPL locally.
     */
    reportState(state: SessionState): void;
    /** PUT /worker external_metadata (branch, dir shown on claude.ai). */
    reportMetadata(metadata: Record<string, unknown>): void;
    /**
     * POST /worker/events/{id}/delivery. Populates CCR's processing_at /
     * processed_at columns. `received` is auto-fired internally; this
     * surfaces `processing` (turn start) and `processed` (turn end).
     */
    reportDelivery(eventId: string, status: 'processing' | 'processed'): void;
    /** Drain the write queue. Call before close() when delivery matters. */
    flush(): Promise<void>;
    close(): void;
};
/** @alpha */
export type AttachBridgeSessionOptions = {
    /**
     * Session ID (`cse_*` form). Comes from `WorkResponse.data.id` in the
     * poll-loop path, or from whatever created the session.
     */
    sessionId: string;
    /** Worker JWT. Comes from `decodeWorkSecret(work.secret).session_ingress_token`. */
    ing
... (truncated)
```

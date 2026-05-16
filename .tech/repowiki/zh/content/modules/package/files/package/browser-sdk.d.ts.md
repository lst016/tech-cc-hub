# package/browser-sdk.d.ts

> 模块：`package` · 语言：`typescript` · 行数：54

## 文件职责

浏览器环境SDK的类型定义，通过WebSocket与Claude通信

## 关键符号

- `BrowserQueryOptions@0 - 浏览器查询配置，包含prompt流、WebSocket选项、MCP服务器等`
- `query@0 - 创建WebSocket查询的主入口函数，返回Query异步迭代器`
- `OAuthCredential@0 - OAuth认证凭证类型`

## 依赖输入

- `./agentSdkTypes.js`

## 对外暴露

- `OAuthCredential`
- `AuthMessage`
- `WebSocketOptions`
- `BrowserQueryOptions`
- `createSdkMcpServer`
- `tool`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
/**
 * API surface definition for @anthropic-ai/claude-agent-sdk/browser.
 *
 * This file is the source of truth for the browser export's public types.
 * It imports ONLY from agentSdkTypes.ts so the compiled .d.ts has exactly
 * one import to rewrite (./agentSdkTypes → ./sdk) for the flat package layout.
 *
 * Compiled by scripts/build-ant-sdk-typings.sh; see build-agent-sdk.sh for the
 * path rewrite and copy into the package.
 */
import type { CanUseTool, HookCallbackMatcher, HookEvent, McpServerConfig, OnElicitation, Query, SDKUserMessage } from './agentSdkTypes.js';
export type { CanUseTool, ElicitationRequest, ElicitationResult, HookCallbackMatcher, HookEvent, McpSdkServerConfigWithInstance, McpServerConfig, OnElicitation, Query, SDKAssistantMessage, SDKMessage, SDKResultMessage, SDKSystemMessage, SDKUserMessage, } from './agentSdkTypes.js';
export { createSdkMcpServer, tool } from './agentSdkTypes.js';
export type OAuthCredential = {
    type: 'oauth';
    token: string;
};
export type AuthMessage = {
    type: 'auth';
    credential: OAuthCredential;
};
export type WebSocketOptions = {
    url: string;
    headers?: Record<string, string>;
    authMessage?: AuthMessage;
};
export type BrowserQueryOptions = {
    prompt: AsyncIterable<SDKUserMessage>;
    websocket: WebSocketOptions;
    abortController?: AbortController;
    canUseTool?: CanUseTool;
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    mcpServers?: Record<string, McpServerConfig>;
    jsonSchema?: Record<string, unknown>;
    onElicitation?: OnElicitation;
};
/**
 * Create a Claude Code query using WebSocket transport in the browser.
 *
 * @example
 * ```typescript
 * import { query } from '@anthropic-ai/claude-agent-sdk/browser'
 *
 * const messages = query({
 *   prompt: messageStream,
 *   websocket: { url: 'wss://api.example.com/claude' },
 * })
 * for await (const message of messages) {
 *   console.log(message)
 * }
 * ```
 */
export declare function query(options: BrowserQueryOptions): Query;

```

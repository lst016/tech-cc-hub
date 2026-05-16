# src/electron/types.ts

> 模块：`electron` · 语言：`typescript` · 行数：260

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `RuntimeReasoningMode@6`
- `AgentRunSurface@8`
- `ApiModelConfig@9`
- `ApiProviderMode@15`
- `ApiConfig@17`
- `ApiConfigSettings@40`
- `RuntimeOverrides@44`
- `ChannelProviderId@53`
- `PromptAttachment@62`
- `UserPromptMessage@76`
- `StreamMessage@84`
- `SessionStatus@89`
- `AppUpdateState@91`
- `AppUpdateStatus@102`
- `AppUpdateActionResult@123`
- `SessionInfo@129`
- `WorkflowCatalogEntry@149`
- `SessionWorkflowCatalog@157`
- `SessionHistoryCursor@166`
- `McpServerInfo@171`
- `ServerEvent@184`
- `ClientEvent@223`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `../shared/prompt-ledger.js`
- `../shared/plan-progress.js`
- `../shared/workflow-markdown.js`
- `./libs/note-types.js`

## 对外暴露

- `RuntimeReasoningMode`
- `AgentRunSurface`
- `ApiModelConfig`
- `ApiProviderMode`
- `ApiConfig`
- `ApiConfigSettings`
- `RuntimeOverrides`
- `ChannelProviderId`
- `PromptAttachment`
- `UserPromptMessage`
- `StreamMessage`
- `SessionStatus`
- `AppUpdateState`
- `AppUpdateStatus`
- `AppUpdateActionResult`
- `SessionInfo`
- `WorkflowCatalogEntry`
- `SessionWorkflowCatalog`
- `SessionHistoryCursor`
- `McpServerInfo`
- `ServerEvent`
- `ClientEvent`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { PromptLedgerMessage } from "../shared/prompt-ledger.js";
import type { SessionPlanSnapshot } from "../shared/plan-progress.js";
import type { SessionWorkflowState, WorkflowScope, WorkflowSpecDocument } from "../shared/workflow-markdown.js";
import type { Note, NoteCreateInput, NoteUpdateInput } from "./libs/note-types.js";

export type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";
export type AgentRunSurface = "development" | "maintenance";

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

export type ApiProviderMode = "custom" | "deepseek" | "codex";

export type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  smallModel?: string;
  imageModel?: string;
  analysisModel?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingBatchSize?: number;
  wikiModel?: string;
  wikiModelCostTier?: "free" | "cheap" | "standard";
  wikiModelMaxInputTokens?: number;
  wikiModelMaxOutputTokens?: number;
  models?: ApiModelConfig[];
  enabled: boolean;
  provider?: ApiProviderMode;
  apiType?: "anthropic";
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

export type RuntimeOverrides = {
  model?: string;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: "default" | "bypassPermissions" | "plan";
  runSurface?: AgentRunSurface;
  agentId?: string;
  outputFormat?: "json" | "none";
};

export type ChannelProviderId =
  | "telegram"
  | "lark"
  | "dingtalk"
  | "wechat"
  | "wecom"
  | "slack"
  | "discord";

export type PromptAttachment = {
  id: string;
  kind: "image" | "text";
  name: string;
  mimeType: string;
  data: string;
  runtimeData?: string;
  preview?: string;
  size?: number;
  storagePath?: string;
  storageUri?: string;
  summaryText?: string;
};

export type UserPromptMessage = {
  type: "user_prompt";
  prompt: string;
  attachments?: PromptAttachment[];
  capturedAt?: number;
  historyId?: string;
};

export type StreamMessage = (SDKMessage | UserPromptMessage | PromptLedgerMessage) & {
  capturedAt?: number;
  historyId?: string;
};

export type SessionStatus = "idle" | "running" | "completed" | "error";

export type AppUpdateState =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "unsupported"
  | "error";

export type AppUpdateStatus = {
  status: AppUpdateState;
  currentVersion: string;
  isPackaged: boolean;
  provider: "github";
  channel?: string;
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  checkedAt?: number;
  progress?: {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
  };
  error?: string;
};

export type AppUpdateActionResult = {
  success: boolean;
  status: AppUpdateStatus;
  error?: string;
};

export type SessionInfo = {
  id: string;
  title: string;
  status: SessionStatus;
  model?: string;
  claudeSessionId?: string;
  cwd?: string;
  runSurface?: AgentRunSurface;
  agentId?: string;
  slashCommands?: string[];
  workflowMarkdown?: string;
  workflowSourceLayer?: WorkflowScope;
  workflowSourcePath?: string;
  workflowState?: SessionWorkflowState;
  workflowError?: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type WorkflowCatalogEntry = {
  workflowId: string;
  sourceLayer: WorkflowScope;
  sourcePath: string;
  markdown: string;
  document: WorkflowSpecDocument;
};

export type SessionWorkflowCatalog = {
  sessionId: string;
  roots: Partial<Record<Exclude<WorkflowScope, "session">, string>>;
  entries: WorkflowCatalogEntry[];
  recommendedWorkflowId?: string;
  autoSelectedWorkflowId?: string;
  issues?: string[];
};

export type SessionHistoryCursor = {
  beforeCreatedAt: number;
  beforeId: string;
};

export type McpServerInfo = {
  name: string;
  type: "builtin" | "external";
  transport?: "stdio" | "http";
  command: string;
  args: string[];
  url?: stri
... (truncated)
```

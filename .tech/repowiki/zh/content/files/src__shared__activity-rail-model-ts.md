# src/shared/activity-rail-model.ts

> 模块：`shared` · 语言：`typescript` · 行数：2690

## 文件职责

活动时间线数据模型定义和 UI 渲染工具函数，包括节点类型、层级、音调、指标格式化和详情构建

## 关键符号

- `ActivityTimelineItem@0 - 时间线条目核心类型，包含 filterKey、layer、tone、nodeKind 等渲染属性`
- `ActivityExecutionMetrics@0 - 执行指标：输入/上下文/输出字符数、token 数、耗时、成功/失败计数`
- `ActivityDetailSection@0 - 详情区域的数据结构，支持 rows 和可选 raw 原始数据`
- `formatHookEventLabel@0 - 格式化 hook 事件标签`
- `buildHookDetailSections@0 - 构建 hook 质量信号详情分区`
- `buildToolOutputSection@0 - 构建工具输出详情分区`
- `formatDuration@0 - 格式化时长为可读字符串`
- `formatCost@0 - 格式化成本显示`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `./prompt-ledger.js`

## 对外暴露

- `ActivityRailTone`
- `ActivityRailLayer`
- `ActivityRailFilterKey`
- `ActivityStageKind`
- `ActivityTaskStepStatus`
- `ActivityPlanStepStatus`
- `ActivityMetricStatus`
- `ActivityNodeKind`
- `ActivityToolProvenance`
- `ActivityExecutionMetrics`
- `ActivityDetailRow`
- `ActivityDetailSection`
- `PromptAttachmentLike`
- `UserPromptMessageLike`
- `StreamMessageLike`
- `SessionLike`
- `PermissionRequestLike`
- `ActivityTimelineItem`
- `ActivityPlanStep`
- `ActivityTaskStep`
- `ActivityExecutionStep`
- `ActivityAnalysisCard`
- `ContextDistributionBucket`
- `ContextDistributionModel`
- `PromptAnalysisModel`
- `ActivityRailModel`
- `buildActivityRailModel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PromptLedgerBucket, PromptLedgerMessage, PromptLedgerSegment } from "./prompt-ledger.js";

export type ActivityRailTone = "neutral" | "info" | "success" | "warning" | "error";
export type ActivityRailLayer = "上下文" | "工具" | "结果" | "流程";
export type ActivityRailFilterKey = "all" | "attention" | "context" | "tool" | "result" | "flow";
export type ActivityStageKind = "inspect" | "implement" | "verify" | "deliver" | "plan" | "other";
export type ActivityTaskStepStatus = "pending" | "running" | "completed";
export type ActivityPlanStepStatus = "pending" | "running" | "completed" | "drifted";
export type ActivityMetricStatus = "neutral" | "running" | "success" | "failure";
export type ActivityNodeKind =
  | "context"
  | "plan"
  | "assistant_output"
  | "tool_input"
  | "retrieval"
  | "file_read"
  | "file_write"
  | "terminal"
  | "browser"
  | "memory"
  | "mcp"
  | "handoff"
  | "evaluation"
  | "error"
  | "lifecycle"
  | "permission"
  | "hook"
  | "omitted"
  | "agent_progress";
export type ActivityToolProvenance =
  | "local"
  | "mcp"
  | "sub_agent"
  | "a2a"
  | "transfer_agent"
  | "unknown";

export type ActivityExecutionMetrics = {
  inputChars: number;
  contextChars: number;
  outputChars: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  successCount: number;
  failureCount: number;
  totalCount: number;
  status: ActivityMetricStatus;
};

export type ActivityDetailRow = {
  label: string;
  value: string;
};

export type ActivityDetailSection = {
  id: string;
  title: string;
  summary?: string;
  rows: ActivityDetailRow[];
  raw?: string;
  rawLabel?: string;
};

export type PromptAttachmentLike = {
  id: string;
  kind: "image" | "text";
  name: string;
  mimeType: string;
  data: string;
  preview?: string;
  size?: number;
};

export type UserPromptMessageLike = {
  type: "user_prompt";
  prompt: string;
  attachments?: PromptAttachmentLike[];
  capturedAt?: number;
};

export type StreamMessageLike = (SDKMessage & { capturedAt?: number }) | UserPromptMessageLike | PromptLedgerMessage;

export type SessionLike = {
  id: string;
  title: string;
  status: "idle" | "running" | "completed" | "error";
  cwd?: string;
  slashCommands?: string[];
  messages: StreamMessageLike[];
};

export type PermissionRequestLike = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type ActivityTimelineItem = {
  id: string;
  filterKey: Exclude<ActivityRailFilterKey, "all">;
  layer: ActivityRailLayer;
  tone: ActivityRailTone;
  nodeKind: ActivityNodeKind;
  nodeSubtype?: string;
  title: string;
  preview: string;
  detail: string;
  round: number;
  sequence: number;
  statusLabel?: string;
  chips: string[];
  attention: boolean;
  toolName?: string;
  provenance?: ActivityToolProvenance;
  taskStepIds: string[];
  stageKind: ActivityStageKind;
  metrics: ActivityExecutionMetrics;
  detailSections: ActivityDetailSection[];
  parentTaskId?: string;
  agentDescription?: string;
};

export type ActivityPlanStep = {
  id: string;
  index: number;
  indexLabel: string;
  title: string;
  detail: string;
  round: number;
  kind: ActivityStageKind;
  status: ActivityPlanStepStatus;
  sourceTimelineId: string;
  timelineIds: string[];
  executionStepIds: string[];
  metrics: ActivityExecutionMetrics;
};

export type ActivityTaskStep = {
  id: string;
  title: string;
  detail: string;
  round: number;
  kind: ActivityStageKind;
  status: ActivityTaskStepStatus;
  timelineIds: string[];
  sourceTimelineId: string;
  planStepIds?: string[];
  metrics: ActivityExecutionMetrics;
};

export type ActivityExecutionStep = {
  id: string;
  title: string;
  detail: string;
  round: number;
  kind: ActivityStageKind;
  status: ActivityTaskStepStatus;
  timelineIds: string[];
  sourceTimelineId: string;
  planStepIds?: string[];
  metrics: ActivityExecutionMetrics;
};

export type ActivityAnalysisCard = {
  id: string;
  title: string;
  tone: ActivityRailTone;
  detail: string;
  supportingTimelineId?: string;
};

export type ContextDistribution
... (truncated)
```

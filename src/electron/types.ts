import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { PromptLedgerMessage } from "../shared/prompt-ledger.js";
import type { SessionWorkflowState, WorkflowScope, WorkflowSpecDocument } from "../shared/workflow-markdown.js";
import type { Note, NoteCreateInput, NoteUpdateInput } from "./libs/note-types.js";

export type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";
export type AgentRunSurface = "development" | "maintenance";

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

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
  models?: ApiModelConfig[];
  enabled: boolean;
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

// Server -> Client events
export type ServerEvent =
  | { type: "stream.message"; payload: { sessionId: string; message: StreamMessage } }
  | { type: "stream.user_prompt"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[]; capturedAt?: number; historyId?: string } }
  | { type: "session.status"; payload: { sessionId: string; status: SessionStatus; title?: string; cwd?: string; model?: string; error?: string; slashCommands?: string[] } }
  | { type: "session.workflow"; payload: { sessionId: string; markdown?: string; sourceLayer?: WorkflowScope; sourcePath?: string; state?: SessionWorkflowState; error?: string } }
  | { type: "session.workflow.catalog"; payload: SessionWorkflowCatalog }
  | { type: "session.list"; payload: { sessions: SessionInfo[]; archived?: boolean } }
  | { type: "session.history"; payload: { sessionId: string; status: SessionStatus; messages: StreamMessage[]; mode: "replace" | "prepend"; hasMore: boolean; nextCursor?: SessionHistoryCursor; slashCommands?: string[] } }
  | { type: "session.archived"; payload: { sessionId: string; session?: SessionInfo } }
  | { type: "session.unarchived"; payload: { sessionId: string; session?: SessionInfo } }
  | { type: "session.deleted"; payload: { sessionId: string } }
  | { type: "permission.request"; payload: { sessionId: string; toolUseId: string; toolName: string; input: unknown } }
  | { type: "runner.error"; payload: { sessionId?: string; message: string } }
  | { type: "agent.list"; payload: { agents: Array<{ id: string; name: string; description?: string; scope: string }> } }
  // Task system events
  | { type: "task.list"; payload: { tasks: Array<Record<string, unknown>> } }
  | { type: "task.updated"; payload: { task: Record<string, unknown> } }
  | { type: "task.deleted"; payload: { taskId: string } }
  | { type: "task.execution.started"; payload: { execution: Record<string, unknown> } }
  | { type: "task.execution.completed"; payload: { execution: Record<string, unknown> } }
  | { type: "task.execution.log"; payload: { log: unknown } }
  | { type: "task.execution.bundle"; payload: Record<string, unknown> }
  | { type: "task.settings"; payload: { settings: Record<string, unknown> } }
  | { type: "task.providers"; payload: { providers: Array<Record<string, unknown>> } }
  | { type: "task.stats"; payload: { stats: Record<string, unknown> } }
  | { type: "task.sync.completed"; payload: { provider: string; count: number } }
  | { type: "task.error"; payload: { message: string } }
  | { type: "task.execution.list"; payload: { taskId: string; executions: Array<Record<string, unknown>>; logs: Array<Record<string, unknown>>; subtasks?: Array<Record<string, unknown>>; artifacts?: Array<Record<string, unknown>> } }
  // Note CRUD events
  | { type: "note.list"; payload: { notes: Note[] } }
  | { type: "note.created"; payload: { note: Note } }
  | { type: "note.updated"; payload: { note: Note } }
  | { type: "note.deleted"; payload: { noteId: string } }
  | { type: "note.error"; payload: { message: string } };

// Client -> Server events
export type ClientEvent =
  | { type: "session.create"; payload: { title?: string; cwd?: string; allowedTools?: string } }
  | { type: "session.start"; payload: { title: string; prompt: string; cwd?: string; allowedTools?: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
  | { type: "session.continue"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
  | { type: "session.append"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[] } }
  | { type: "channel.message.receive"; payload: { provider: ChannelProviderId; text: string; externalConversationId?: string; externalMessageId?: string; senderId?: string; senderName?: string; channelName?: string; title?: string; allowedTools?: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides; receivedAt?: number } }
  | { type: "session.workflow.catalog.list"; payload: { sessionId: string } }
  | { type: "session.workflow.set"; payload: { sessionId: string; markdown: string; sourceLayer: WorkflowScope; sourcePath?: string } }
  | { type: "session.workflow.clear"; payload: { sessionId: string } }
  | { type: "session.stop"; payload: { sessionId: string } }
  | { type: "session.archive"; payload: { sessionId: string } }
  | { type: "session.unarchive"; payload: { sessionId: string } }
  | { type: "session.delete"; payload: { sessionId: string } }
  | { type: "session.list"; payload?: { archived?: boolean } }
  | { type: "session.history"; payload: { sessionId: string; before?: SessionHistoryCursor; limit?: number } }
  | { type: "permission.response"; payload: { sessionId: string; toolUseId: string; result: PermissionResult } }
  | { type: "agent.list"; payload: { cwd?: string } }
  // Task system client events
  | { type: "task.list"; payload?: { filter?: Record<string, unknown> } }
  | { type: "task.sync"; payload: { provider: string } }
  | { type: "task.execute"; payload: { taskId: string; options?: Record<string, unknown> } }
  | { type: "task.control"; payload: { taskId: string; action: "pause" | "resume" | "cancel" | "cancel-retry" } }
  | { type: "task.delete"; payload: { taskId: string } }
  | { type: "task.markStatus"; payload: { taskId: string; status: string } }
  | { type: "task.settings.get"; payload?: Record<string, unknown> }
  | { type: "task.settings.update"; payload: { settings: Record<string, unknown> } }
  | { type: "task.providers"; payload?: Record<string, unknown> }
  | { type: "task.stats"; payload?: Record<string, unknown> }
  | { type: "task.execution.logs"; payload: { taskId: string } }
  // Note CRUD client events
  | { type: "note.list" }
  | { type: "note.create"; payload: NoteCreateInput }
  | { type: "note.get"; payload: { noteId: string } }
  | { type: "note.update"; payload: { noteId: string; input: NoteUpdateInput } }
  | { type: "note.delete"; payload: { noteId: string } };

import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { SessionWorkflowState, WorkflowScope, WorkflowSpecDocument } from "../shared/workflow-markdown.js";

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
  imageModel?: string;
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
};

export type PromptAttachment = {
  id: string;
  kind: "image" | "text";
  name: string;
  mimeType: string;
  data: string;
  preview?: string;
  size?: number;
};

export type UserPromptMessage = {
  type: "user_prompt";
  prompt: string;
  attachments?: PromptAttachment[];
  capturedAt?: number;
};

export type StreamMessage = (SDKMessage | UserPromptMessage) & {
  capturedAt?: number;
};

export type SessionStatus = "idle" | "running" | "completed" | "error";

export type SessionInfo = {
  id: string;
  title: string;
  status: SessionStatus;
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

// Server -> Client events
export type ServerEvent =
  | { type: "stream.message"; payload: { sessionId: string; message: StreamMessage } }
  | { type: "stream.user_prompt"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[] } }
  | { type: "session.status"; payload: { sessionId: string; status: SessionStatus; title?: string; cwd?: string; error?: string; slashCommands?: string[] } }
  | { type: "session.workflow"; payload: { sessionId: string; markdown?: string; sourceLayer?: WorkflowScope; sourcePath?: string; state?: SessionWorkflowState; error?: string } }
  | { type: "session.workflow.catalog"; payload: SessionWorkflowCatalog }
  | { type: "session.list"; payload: { sessions: SessionInfo[] } }
  | { type: "session.history"; payload: { sessionId: string; status: SessionStatus; messages: StreamMessage[]; slashCommands?: string[] } }
  | { type: "session.deleted"; payload: { sessionId: string } }
  | { type: "permission.request"; payload: { sessionId: string; toolUseId: string; toolName: string; input: unknown } }
  | { type: "runner.error"; payload: { sessionId?: string; message: string } };

// Client -> Server events
export type ClientEvent =
  | { type: "session.create"; payload: { title?: string; cwd?: string; allowedTools?: string } }
  | { type: "session.start"; payload: { title: string; prompt: string; cwd?: string; allowedTools?: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
  | { type: "session.continue"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
  | { type: "session.workflow.catalog.list"; payload: { sessionId: string } }
  | { type: "session.workflow.set"; payload: { sessionId: string; markdown: string; sourceLayer: WorkflowScope; sourcePath?: string } }
  | { type: "session.workflow.clear"; payload: { sessionId: string } }
  | { type: "session.stop"; payload: { sessionId: string } }
  | { type: "session.delete"; payload: { sessionId: string } }
  | { type: "session.list" }
  | { type: "session.history"; payload: { sessionId: string } }
  | { type: "permission.response"; payload: { sessionId: string; toolUseId: string; result: PermissionResult } };

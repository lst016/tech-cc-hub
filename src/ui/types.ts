import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { SessionWorkflowState, WorkflowScope, WorkflowSpecDocument } from "../shared/workflow-markdown";

export type ApiModelConfigProfile = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

export type ApiConfigProfile = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  imageModel?: string;
  models?: ApiModelConfigProfile[];
  enabled: boolean;
  apiType?: "anthropic";
};

export type ApiConfigSettings = {
  profiles: ApiConfigProfile[];
};

export type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";

export type RuntimePermissionMode = "default" | "bypassPermissions" | "plan";
export type AgentRunSurface = "development" | "maintenance";

export type SkillSourceType = "manual" | "git";

export type SkillKind = "single" | "bundle";

export type InstalledSkillRecord = {
  id: string;
  name: string;
  kind: SkillKind;
  path: string;
  sourceType: SkillSourceType;
  installedAt?: number;
  syncEnabled?: boolean;
  remoteUrl?: string;
  remoteSubpath?: string;
  branch?: string;
  lastPulledAt?: number;
  lastCheckedAt?: number;
  checkEveryHours?: number;
  lastKnownCommit?: string;
  lastError?: string;
};

export type SkillInventory = {
  rootPath: string;
  skills: InstalledSkillRecord[];
};

export type SkillSyncRequest = {
  skillIds?: string[];
  force?: boolean;
};

export type SkillSyncResult = {
  skillId: string;
  skillName: string;
  status: "updated" | "checked" | "skipped" | "error";
  message?: string;
  previousCommit?: string;
  latestCommit?: string;
  checkedAt: number;
};

export type SkillSyncResponse = {
  results: SkillSyncResult[];
};

export type SettingsPageId = "profiles" | "routing" | "global-json" | "skills" | "system-maintenance";

export type RuntimeOverrides = {
  model?: string;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: RuntimePermissionMode;
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
};

export type StreamMessage = SDKMessage | UserPromptMessage;

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

import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";

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
  models?: ApiModelConfigProfile[];
  enabled: boolean;
  apiType?: "anthropic";
};

export type ApiConfigSettings = {
  profiles: ApiConfigProfile[];
};

export type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";

export type RuntimePermissionMode = "default" | "bypassPermissions" | "plan";

export type SkillSourceKind = "local" | "remote";

export type SkillScope = "single" | "bundle";

export type SkillSourceRecord = {
  id: string;
  name: string;
  kind: SkillSourceKind;
  enabled: boolean;
  path: string;
  gitUrl?: string;
  scope?: SkillScope;
  branch?: string;
  lastPulledAt?: number;
  lastCheckedAt?: number;
  checkEveryHours?: number;
  lastKnownCommit?: string;
  lastError?: string;
};

export type SkillRegistry = {
  sources: SkillSourceRecord[];
};

export type SkillSyncRequest = {
  sourceIds?: string[];
  force?: boolean;
};

export type SkillSyncResult = {
  sourceId: string;
  sourceName: string;
  status: "updated" | "checked" | "skipped" | "error";
  message?: string;
  previousCommit?: string;
  latestCommit?: string;
  checkedAt: number;
};

export type SkillSyncResponse = {
  results: SkillSyncResult[];
};

export type SettingsPageId = "profiles" | "routing" | "global-json" | "skills";

export type RuntimeOverrides = {
  model?: string;
  reasoningMode?: RuntimeReasoningMode;
  permissionMode?: RuntimePermissionMode;
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
  slashCommands?: string[];
  createdAt: number;
  updatedAt: number;
};

// Server -> Client events
export type ServerEvent =
  | { type: "stream.message"; payload: { sessionId: string; message: StreamMessage } }
  | { type: "stream.user_prompt"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[] } }
  | { type: "session.status"; payload: { sessionId: string; status: SessionStatus; title?: string; cwd?: string; error?: string } }
  | { type: "session.list"; payload: { sessions: SessionInfo[] } }
  | { type: "session.history"; payload: { sessionId: string; status: SessionStatus; messages: StreamMessage[] } }
  | { type: "session.deleted"; payload: { sessionId: string } }
  | { type: "permission.request"; payload: { sessionId: string; toolUseId: string; toolName: string; input: unknown } }
  | { type: "runner.error"; payload: { sessionId?: string; message: string } };

// Client -> Server events
export type ClientEvent =
  | { type: "session.create"; payload: { title?: string; cwd?: string; allowedTools?: string } }
  | { type: "session.start"; payload: { title: string; prompt: string; cwd?: string; allowedTools?: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
  | { type: "session.continue"; payload: { sessionId: string; prompt: string; attachments?: PromptAttachment[]; runtime?: RuntimeOverrides } }
  | { type: "session.stop"; payload: { sessionId: string } }
  | { type: "session.delete"; payload: { sessionId: string } }
  | { type: "session.list" }
  | { type: "session.history"; payload: { sessionId: string } }
  | { type: "permission.response"; payload: { sessionId: string; toolUseId: string; result: PermissionResult } };

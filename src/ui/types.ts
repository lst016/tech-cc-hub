import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { PromptLedgerMessage } from "../shared/prompt-ledger.js";
import type { SessionWorkflowState, WorkflowScope, WorkflowSpecDocument } from "../shared/workflow-markdown.js";

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
  analysisModel?: string;
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

// Source: skill-manager types (src/electron/libs/skill-manager/types.ts)
export type ManagedSkill = {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_ref: string | null;
  source_ref_resolved: string | null;
  source_subpath: string | null;
  source_branch: string | null;
  source_revision: string | null;
  remote_revision: string | null;
  central_path: string;
  content_hash: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  status: string;
  update_status: string;
  last_checked_at: number | null;
  last_check_error: string | null;
  targets: SkillTarget[];
  scenario_ids: string[];
  tags: string[];
};

export type SkillTarget = {
  id: string;
  skill_id: string;
  tool: string;
  target_path: string;
  mode: string;
  status: string;
  synced_at: number | null;
};

export type SkillToolToggle = {
  tool: string;
  display_name: string;
  installed: boolean;
  globally_enabled: boolean;
  enabled: boolean;
};

export type ToolInfo = {
  key: string;
  display_name: string;
  installed: boolean;
  skills_dir: string;
  enabled: boolean;
  is_custom: boolean;
  has_path_override: boolean;
  project_relative_skills_dir: string | null;
};

export type Scenario = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  skill_count: number;
  created_at: number;
  updated_at: number;
};

export type DiscoveredGroup = {
  name: string;
  fingerprint: string | null;
  locations: Array<{ id: string; tool: string; found_path: string }>;
  imported: boolean;
  found_at: number;
};

export type ScanResult = {
  tools_scanned: number;
  skills_found: number;
  groups: DiscoveredGroup[];
};

export type BatchImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export type BatchDeleteSkillsResult = {
  deleted: number;
  failed: string[];
};

export type AgentRuleDocuments = {
  systemDefaultMarkdown: string;
  userClaudeRoot: string;
  userAgentsPath: string;
  userAgentsMarkdown: string;
};

export type AppUpdateState =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
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

export type ChannelProviderId =
  | "telegram"
  | "lark"
  | "wechat";

export type ChannelTransportMode = "bot-api" | "lark-cli" | "lark-open-platform" | "weixin-native" | "weixin-openclaw";

export type ChannelConnectionConfig = {
  provider: ChannelProviderId;
  enabled: boolean;
  transport: ChannelTransportMode;
  displayName?: string;
  botTokenEnv?: string;
  chatIdEnv?: string;
  webhookUrlEnv?: string;
  appIdEnv?: string;
  appSecretEnv?: string;
  tenantKeyEnv?: string;
  cliCommand?: string;
  cliProfile?: string;
  cliSendArgsTemplate?: string;
  cliReceiveArgsTemplate?: string;
  notes?: string;
};

export type ChannelRuntimeConfig = {
  version: 1;
  defaultChannel?: ChannelProviderId;
  items: Partial<Record<ChannelProviderId, ChannelConnectionConfig>>;
};

export type SettingsPageId = "profiles" | "channels" | "plugins" | "global-json" | "skills" | "agent-rules" | "system-maintenance" | "about";

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
  | { type: "task.list"; payload: { tasks: UiTask[] } }
  | { type: "task.updated"; payload: { task: UiTask } }
  | { type: "task.deleted"; payload: { taskId: string } }
  | { type: "task.execution.started"; payload: { execution: UiTaskExecution } }
  | { type: "task.execution.completed"; payload: { execution: UiTaskExecution } }
  | { type: "task.execution.log"; payload: { log: UiTaskExecutionLog } }
  | { type: "task.execution.bundle"; payload: UiTaskExecutionBundle }
  | { type: "task.settings"; payload: { settings: UiTaskWorkflowSettings } }
  | { type: "task.providers"; payload: { providers: UiTaskProviderState[] } }
  | { type: "task.stats"; payload: { stats: UiTaskStats } }
  | { type: "task.sync.completed"; payload: { provider: string; count: number } }
  | { type: "task.error"; payload: { message: string } }
  | { type: "task.execution.list"; payload: UiTaskExecutionBundle }
  // Note CRUD events
  | { type: "note.list"; payload: { notes: UiNote[] } }
  | { type: "note.created"; payload: { note: UiNote } }
  | { type: "note.updated"; payload: { note: UiNote } }
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
  | { type: "task.list"; payload?: { filter?: UiTaskFilter } }
  | { type: "task.sync"; payload: { provider: string } }
  | { type: "task.execute"; payload: { taskId: string; options?: UiTaskExecutionOptions } }
  | { type: "task.control"; payload: { taskId: string; action: "pause" | "resume" | "cancel" | "cancel-retry" } }
  | { type: "task.delete"; payload: { taskId: string } }
  | { type: "task.markStatus"; payload: { taskId: string; status: string } }
  | { type: "task.settings.get"; payload?: {} }
  | { type: "task.settings.update"; payload: { settings: Partial<UiTaskWorkflowSettings> } }
  | { type: "task.providers"; payload?: {} }
  | { type: "task.stats"; payload?: {} }
  | { type: "task.execution.logs"; payload: { taskId: string } }
  // Note CRUD client events
  | { type: "note.list" }
  | { type: "note.create"; payload: { title: string; content: string } }
  | { type: "note.get"; payload: { noteId: string } }
  | { type: "note.update"; payload: { noteId: string; input: { title?: string; content?: string } } }
  | { type: "note.delete"; payload: { noteId: string } };

// Task system UI types
export type UiTaskProviderId = "lark" | "tb";

export type UiTaskStatus = "pending" | "in_progress" | "done" | "cancelled" | "queued" | "executing" | "retrying" | "paused" | "completed" | "failed";

export type UiTaskClaimState = "unclaimed" | "claimed" | "queued" | "running" | "retrying" | "released";

export type UiTaskPriority = "low" | "medium" | "high" | "urgent";

export type UiTask = {
  id: string;
  externalId: string;
  provider: UiTaskProviderId;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  priority: UiTaskPriority;
  dueDate?: number;
  sourceData: Record<string, unknown>;
  localStatus: UiTaskStatus;
  claimState: UiTaskClaimState;
  retryAttempt: number;
  retryDueAt?: number;
  lastError?: string;
  workspacePath?: string;
  driverId?: "claude" | "codex-app-server";
  model?: string;
  reasoningMode?: "disabled" | "low" | "medium" | "high" | "xhigh";
  maxCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  cancelRequestedAt?: number;
  pausedAt?: number;
  lastSyncedAt: number;
  lastExecutedAt?: number;
  executionSessionId?: string;
  createdAt: number;
  updatedAt: number;
};

export type UiTaskExecution = {
  id: string;
  taskId: string;
  sessionId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  attempt?: number;
  driverId?: "claude" | "codex-app-server";
  model?: string;
  reasoningMode?: "disabled" | "low" | "medium" | "high" | "xhigh";
  maxCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  startedAt: number;
  completedAt?: number;
  lastEventAt?: number;
  terminalReason?: string;
  result?: string;
  error?: string;
};

export type UiTaskExecutionLog = {
  id: string;
  executionId: string;
  taskId: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
};

export type UiTaskFilter = {
  provider?: string;
  status?: string;
  priority?: string;
  query?: string;
};

export type UiTaskStats = {
  total: number;
  pending: number;
  queued: number;
  executing: number;
  retrying: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
  estimatedCostUsd: number;
  byProvider: Record<string, number>;
};

export type UiTaskExecutionOptions = {
  model?: string;
  reasoningMode?: "disabled" | "low" | "medium" | "high" | "xhigh";
  workspacePath?: string;
  driverId?: "claude" | "codex-app-server";
  maxCostUsd?: number;
  promptTemplate?: string;
};

export type UiTaskSubtask = {
  id: string;
  taskId: string;
  executionId?: string;
  title: string;
  detail?: string;
  status: "pending" | "in_progress" | "done" | "blocked";
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type UiTaskArtifact = {
  id: string;
  taskId: string;
  executionId?: string;
  path: string;
  kind: "file" | "directory" | "summary";
  summary?: string;
  createdAt: number;
  updatedAt: number;
};

export type UiTaskExecutionBundle = {
  taskId: string;
  executions: UiTaskExecution[];
  logs: UiTaskExecutionLog[];
  subtasks: UiTaskSubtask[];
  artifacts: UiTaskArtifact[];
};

export type UiTaskProviderState = {
  id: UiTaskProviderId;
  name: string;
  enabled: boolean;
  valid: boolean;
  error?: string;
  capabilities: string[];
};

export type UiTaskWorkflowSettings = {
  pollingIntervalMs: number;
  maxConcurrentAgents: number;
  maxAutoRetries: number;
  maxRetryBackoffMs: number;
  stallTimeoutMs: number;
  defaultDriverId: "claude" | "codex-app-server";
  defaultReasoningMode: "disabled" | "low" | "medium" | "high" | "xhigh";
  maxCostUsd?: number;
  writeBackEnabled: boolean;
  promptTemplate?: string;
  tbCliCommand?: string;
  tbFetchArgsTemplate?: string;
  tbUpdateArgsTemplate?: string;
  tbCommentArgsTemplate?: string;
};

// Note CRUD UI types
export type UiNote = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

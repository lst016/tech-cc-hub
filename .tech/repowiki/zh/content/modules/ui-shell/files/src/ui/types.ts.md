# src/ui/types.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：582

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `ApiModelConfigProfile@20`
- `ApiProviderMode@26`
- `ApiConfigProfile@28`
- `ApiConfigSettings@51`
- `RuntimeReasoningMode@55`
- `RuntimePermissionMode@57`
- `AgentRunSurface@59`
- `ManagedSkill@62`
- `SkillTarget@86`
- `SkillToolToggle@96`
- `ToolInfo@104`
- `Scenario@115`
- `DiscoveredGroup@126`
- `ScanResult@134`
- `BatchImportResult@140`
- `BatchDeleteSkillsResult@146`
- `AgentRuleDocuments@151`
- `AppUpdateState@158`
- `AppUpdateStatus@169`
- `AppUpdateActionResult@190`
- `UiGitResult@196`
- `UiGitRepoStatus@198`
- `UiGitChangedFile@199`
- `UiGitBranch@200`
- `UiGitStashEntry@201`
- `UiGitCommitNode@202`
- `UiGitCommitDetail@203`
- `UiGitCommitDetailRequest@204`
- `UiGitCommitMessageSuggestion@205`
- `UiGitOperationLogEntry@206`
- `UiGitWorkbenchSnapshot@207`
- `UiGitDiffRequest@208`
- `UiGitDiffResult@209`
- `ChannelProviderId@210`
- `ChannelTransportMode@215`
- `ChannelConnectionConfig@217`
- `ChannelRuntimeConfig@238`
- `SettingsPageId@244`
- `RuntimeOverrides@246`
- `PromptAttachment@254`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `../shared/plan-progress.js`
- `../shared/prompt-ledger.js`
- `../shared/workflow-markdown.js`
- `../electron/libs/git/types.js`

## 对外暴露

- `ApiModelConfigProfile`
- `ApiProviderMode`
- `ApiConfigProfile`
- `ApiConfigSettings`
- `RuntimeReasoningMode`
- `RuntimePermissionMode`
- `AgentRunSurface`
- `ManagedSkill`
- `SkillTarget`
- `SkillToolToggle`
- `ToolInfo`
- `Scenario`
- `DiscoveredGroup`
- `ScanResult`
- `BatchImportResult`
- `BatchDeleteSkillsResult`
- `AgentRuleDocuments`
- `AppUpdateState`
- `AppUpdateStatus`
- `AppUpdateActionResult`
- `UiGitResult`
- `UiGitRepoStatus`
- `UiGitChangedFile`
- `UiGitBranch`
- `UiGitStashEntry`
- `UiGitCommitNode`
- `UiGitCommitDetail`
- `UiGitCommitDetailRequest`
- `UiGitCommitMessageSuggestion`
- `UiGitOperationLogEntry`
- `UiGitWorkbenchSnapshot`
- `UiGitDiffRequest`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { SessionPlanSnapshot } from "../shared/plan-progress.js";
import type { PromptLedgerMessage } from "../shared/prompt-ledger.js";
import type { SessionWorkflowState, WorkflowScope, WorkflowSpecDocument } from "../shared/workflow-markdown.js";
import type {
  GitBranch,
  GitChangedFile,
  GitCommitDetail,
  GitCommitDetailRequest,
  GitCommitMessageSuggestion,
  GitCommitNode,
  GitDiffRequest,
  GitDiffResult,
  GitOperationLogEntry,
  GitRepoStatus,
  GitResult,
  GitStashEntry,
  GitWorkbenchSnapshot,
} from "../electron/libs/git/types.js";

export type ApiModelConfigProfile = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

export type ApiProviderMode = "custom" | "deepseek" | "codex";

export type ApiConfigProfile = {
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
  models?: ApiModelConfigProfile[];
  enabled: boolean;
  provider?: ApiProviderMode;
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
  releaseUrl?: st
... (truncated)
```

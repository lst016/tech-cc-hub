# src/electron/libs/runner.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：1924

## 文件职责

Agent任务执行的核心模块，调用Claude Agent SDK运行任务、管理工具集、处理MCP服务器集成

## 关键符号

- `runClaude@0 - 核心执行函数，调用Claude Agent SDK执行任务，整合工具、MCP服务器、提示词构建、权限处理和结果处理`
- `getRequestedModelName@0 - 从运行时配置中提取请求的模型名称`
- `resolveOutputFormat@0 - 解析输出格式（plaintext、json等）`
- `maybeRunFigmaGuideOAuth@0 - 检查并引导用户完成Figma OAuth授权流程`
- `isFigmaMcpServerStatus@0 - 检查Figma MCP服务器状态`
- `buildEffectiveAllowedToolSet@0 - 构建最终允许使用的工具集，过滤内置和外部MCP工具`
- `parseAllowedTools@0 - 解析allowedTools字符串配置`
- `combineSystemPromptAppend@0 - 组合系统提示词追加内容`
- `supportsClaudeCodeAutoTruncate@0 - 判断是否支持Claude Code自动截断功能`
- `getClaudeCodeExtraArgs@0 - 获取Claude Code额外参数`
- `persistDiscoveredRuntimeConfig@0 - 持久化发现的运行时配置`
- `getBestMatchedSkillName@0 - 根据任务找到最佳匹配技能名称`
- `getSkillEnvCandidates@0 - 获取技能环境候选变量`
- `buildGlobalRuntimePromptAppend@0 - 构建全局运行时提示词追加内容`
- `getNormalizedSkillName@0 - 规范化技能名称`
- `normalizeSkillCredentialKey@0 - 规范化技能凭证键名`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `child_process`
- `fs`
- `path`
- `../../shared/runner-prompt.js`
- `../../shared/runner-status.js`
- `../../shared/builtin-mcp-registry.js`
- `./learning-hooks.js`
- `../../shared/plan-progress.js`
- `../types.js`
- `./agent-resolver.js`
- `./claude-settings.js`
- `./claude-project-memory.js`
- `./knowledge/knowledge-overview.js`
- `./config-store.js`
- `./external-mcp-servers.js`
- `./claude-code-plugins.js`
- `./figma-official-plugin.js`
- `./image-preprocessor.js`
- `./builtin-mcp-servers.js`
- `./runner-error.js`
- `./runtime-efficiency.js`
- `./session-store.js`
- `./system-prompt-presets.js`
- `./tool-output-sanitizer.js`
- `./util.js`

## 对外暴露

- `RunnerOptions`
- `RunnerHandle`
- `runClaude`
- `createPromptSource`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import {
  query,
  type EffortLevel,
  type HookCallbackMatcher,
  type PermissionResult,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  type ThinkingConfig,
} from "@anthropic-ai/claude-agent-sdk";
import { execFileSync } from "child_process";
import { existsSync, statSync } from "fs";
import { extname } from "path";

import { buildRunnerPromptContentBlocks } from "../../shared/runner-prompt.js";
import { isSuccessfulRunnerResult, shouldSuppressRunnerErrorAfterSuccessfulResult } from "../../shared/runner-status.js";
import type { BuiltinMcpServerName } from "../../shared/builtin-mcp-registry.js";
import {
  createLearnCaptureHook,
  createCorrectionDetectionHook,
  createCorrectionTrackingHook,
  createQualityGateHook,
  createSecretScanHook,
  createGitBlastRadiusHook,
  createCommitValidateHook,
  createToolCallBudgetHook,
  createDriftDetectorHook,
  createReadBeforeWriteHook,
} from "./learning-hooks.js";
import {
  normalizeTodoWriteArgs,
  normalizeUpdatePlanArgs,
  type SessionPlanSource,
  type UpdatePlanArgs,
} from "../../shared/plan-progress.js";
import type { AgentRunSurface, PromptAttachment, RuntimeOverrides, ServerEvent } from "../types.js";
import { resolveAgentRuntimeContext } from "./agent-resolver.js";
import {
  buildEnvForConfig,
  getClaudeCodeModelOption,
  getClaudeCodePath,
  getCurrentApiConfig,
  getGlobalRuntimeConfig,
  resolveApiConfigForModel,
} from "./claude-settings.js";
import { buildClaudeProjectMemoryPromptAppend } from "./claude-project-memory.js";
import { buildKnowledgeOverviewPromptAppend } from "./knowledge/knowledge-overview.js";
import { saveGlobalRuntimeConfig } from "./config-store.js";
import {
  getExternalMcpServers,
  isConfiguredExternalMcpTool,
} from "./external-mcp-servers.js";
import {
  CLAUDE_FIGMA_PLUGIN_ID,
  isClaudeCodePluginMcpTool,
  listClaudeCodePluginMcpServerNames,
  resolveEnabledClaudeCodeSdkPlugins,
} from "./claude-code-plugins.js";
import {
  FIGMA_REST_TOOL_NAMES,
  getFigmaOfficialPluginStatusFromConfig,
  isLikelyFigmaTokenFailureMessage,
} from "./figma-official-plugin.js";
import { summarizeBase64Image, summarizeLocalImageFile } from "./image-preprocessor.js";
import {
  getBuiltinMcpServers,
  listBuiltinMcpToolNames,
} from "./builtin-mcp-servers.js";
import { normalizeRunnerError } from "./runner-error.js";
import { resolveRuntimeEfficiencyProfile } from "./runtime-efficiency.js";
import type { Session } from "./session-store.js";
import {
  buildAdminConfigPromptAppend,
  buildBrowserWorkbenchPromptAppend,
  buildBuiltinMcpRegistryPromptAppend,
  buildClaudeCode2139FeaturePromptAppend,
  buildDesignParityPromptAppend,
  buildFeishuDocumentFetchPromptAppend,
  buildGlobalRuntimeSystemPromptExtAppend,
  buildToolCallOptimizationPromptAppend,
} from "./system-prompt-presets.js";
import {
  buildOversizedTextToolOutputReplacement,
  createTextToolOutputBlocks,
  buildToolImageReplacementText,
  extractInlineBase64ImageFromToolResponse,
} from "./tool-output-sanitizer.js";
import { getEnhancedEnv } from "./util.js";

export type RunnerOptions = {
  prompt: string;
  attachments?: PromptAttachment[];
  runtime?: RuntimeOverrides;
  session: Session;
  resumeSessionId?: string;
  onEvent: (event: ServerEvent) => void;
  onSessionUpdate?: (updates: Partial<Session>) => void;
};

export type RunnerHandle = {
  abort: () => void;
  appendPrompt: (prompt: string, attachments?: PromptAttachment[]) => Promise<void>;
  isClosed: () => boolean;
  reuseKey?: string;
};

type QueryWithMcpOAuth = Query & {
  mcpAuthenticate: (serverName: string, redirectUri?: string) => Promise<unknown>;
};

const DEFAULT_CWD = process.cwd();
const BUILTIN_MCP_TOOL_NAMES = listBuiltinMcpToolNames();
const CLAUDE_CODE_AUTO_TRUNCATE_ARGS: Record<string, string | null> = {
  "allow-auto-truncate": null,
};
let claudeCodeAutoTruncateSupport: boolean | null = null;
const ALWAYS_ALLOWED_TOOLS = new Set([
  "AskUserQuestion",
  ...BUILTIN_MCP_TOOL_NAMES,
]);
const SKILL_ENV_HINTS: Record<string, string[]> = {
  feishu: ["FEISHU", "LARK"],
  椋炰功: ["FEISHU", "LARK"],
  "figma瀹樻柟": ["FIGMA"],
  lark: ["LARK", "FEISHU"],
  telegram: ["TELEGRAM"],
  figma: ["FIGMA"],
  notion:
... (truncated)
```

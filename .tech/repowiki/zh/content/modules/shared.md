# shared

> Shared utilities, types, and constants for Desktop Agent workbench core functionality

This module contains cross-cutting concerns including slash command handling, attachment processing, plan/todo normalization, prompt token budgeting, activity tracking models, workflow management, and multi-model provider routing. These utilities are consumed by sessions, task orchestration, built-in browser, and multi-model routing components.

## 文件

### `src/shared/slash-commands.ts`

Extracts and normalizes slash commands from system init messages, merges command lists from multiple sources with deduplication

- `extractSlashCommandsFromMessages` (function) - Searches messages for system/init type containing slash_commands array, returns merged list
- `mergeSlashCommandLists` (function) - Merges multiple command arrays, deduplicates by lowercase key, returns sorted array
- `normalizeSlashCommandName` (function) - Trims whitespace, removes leading slashes, normalizes dots

### `src/shared/attachments.ts`

Handles attachment metadata for images and text files, estimates character counts for prompt injection, resolves image sources

- `AttachmentLike` (type) - Unified attachment shape: kind, data, runtimeData, mimeType, preview, name, size, storagePath, summaryText
- `createStoredUserPromptMessage` (function) - Creates user_prompt message with optional attachments array
- `estimateAttachmentPromptChars` (function) - Calculates character footprint when attachment content is embedded in prompt
- `resolveImageAttachmentSrc` (function) - Picks best image source from preview, runtimeData, data, or storageUri

### `src/shared/plan-progress.ts`

Normalizes plan/todo status values and arguments from different tool output formats (update_plan, todo_write)

- `normalizePlanStepStatus` (function) - Maps status variations like inProgress/complete/done to canonical pending/in_progress/completed
- `normalizeUpdatePlanArgs` (function) - Extracts explanation and plan array from update_plan tool output
- `normalizeTodoWriteArgs` (function) - Extracts plan array from todo_write output, supports todos/items/plan keys

### `src/shared/prompt-ledger.ts`

Tracks prompt composition: tokens, character counts, source attribution, and risk analysis for context window management

- `PromptLedgerBucket` (type) - Grouped source with id, label, sourceKind, chars, tokenEstimate, ratio
- `PromptLedgerSegment` (type) - Individual prompt segment with risks array: long_content, repeated_content, ambiguous_reference, missing_acceptance, tool_payload
- `estimatePromptLedgerTokens` (function) - Estimates tokens with CJK-aware tokenization and whitespace compression

### `src/shared/activity-rail-model.ts`

Type definitions for activity timeline, session state, and execution metrics in the UI rail components

- `SessionLike` (type) - Session snapshot: id, title, status, cwd, slashCommands, messages
- `StreamMessageLike` (type) - Union of SDK messages, user prompts, and prompt ledger messages
- `ActivityTimelineItem` (type) - UI timeline entry with filterKey, layer, tone, nodeKind, round, sequence

### `src/shared/builtin-mcp-registry.ts`

Static registry of built-in MCP server definitions for browser, admin, design, figma, cron, idea, plan, knowledge tools

- `BUILTIN_MCP_SERVERS` (const) - Readonly array of server definitions with name, tools, iconKey, description, toolGroups
- `BuiltinMcpServerDefinition` (type) - Server config: builtin type, command, envKeys, enabled, iconClassName, highlights

### `src/shared/channel-config.ts`

Channel configuration helpers for chat toggle settings

- `isChannelChatEnabled` (function) - Returns true if channel enabled and chatEnabled is true or undefined (defaults to true)

### `src/shared/codex-oauth.ts`

Codex OAuth model ID normalization and compact suffix handling for API provider routing

- `withCodexCompactModelSuffix` (function) - Duplicates model list, appending -openai-compact suffix to each
- `mergeCodexModelIds` (function) - Combines cache models with fallback list, filters newer models to front
- `CODEX_OAUTH_MODELS` (const) - Default merged model list with compact variants

### `src/shared/lark-channel.ts`

Empty placeholder (deprecated Lark CLI IM feature removed)

### `src/shared/lark-runtime-defaults.ts`

Ensures Lark CLI transport configuration in agent-runtime.json with default channel settings and environment variable handling

- `ensureLarkCliRuntimeDefaults` (function) - Injects default lark channel config, credential env names, system prompt extension into runtime config
- `LARK_CLI_SYSTEM_PROMPT_EXT` (const) - System prompt extension instructing skills to use lark-cli with tech-cc-hub admin MCP

### `src/shared/model-provider-routing.ts`

Routes model selection based on API provider (custom, deepseek, codex) compatibility

- `isCodexModelName` (function) - Detects gpt-5* or *codex* patterns, strips compact suffix for matching
- `isDeepSeekModelName` (function) - Checks if model name contains deepseek
- `pickProviderCompatibleModel` (function) - Selects primary model if compatible, falls back to secondary, returns empty string if none match

### `src/shared/preview-quick-open.ts`

Filters and ranks file entries for quick open preview based on query token matching

- `scorePreviewQuickOpenEntry` (function) - Assigns numeric score based on name/path exact match, prefix match, substring match, weighted by token position
- `filterPreviewQuickOpenEntries` (function) - Filters entries by score, sorts by score then path, returns top N results

### `src/shared/runner-prompt.ts`

Builds prompt content blocks for the runner by delegating to attachments module

- `buildRunnerPromptContentBlocks` (function) - Wraps buildAnthropicPromptContentBlocks with prompt and attachments

### `src/shared/runner-status.ts`

Determines if runner result indicates success and whether errors should be suppressed

- `isSuccessfulRunnerResult` (function) - Returns true if message.type is result and subtype is success
- `shouldSuppressRunnerErrorAfterSuccessfulResult` (function) - Returns true to suppress errors after successful result has been emitted

### `src/shared/workflow-markdown.ts`

Types and factory for workflow specification documents and session workflow state tracking

- `WorkflowSpecDocument` (type) - Workflow definition: workflowId, name, scope, mode, sections (goal, scopeText, rules), steps array
- `SessionWorkflowState` (type) - Session-bound workflow state: workflowId, currentStepId, status, step statuses array
- `createInitialSessionWorkflowState` (function) - Creates initial state from spec document with first step as current

### `src/shared/workflow-selector.ts`

Scores and selects workflow candidates based on prompt, tags, paths, and auto-bind criteria

- `selectWorkflowCandidates` (function) - Returns ranked candidates with recommended and autoSelected workflowId based on score >=45, gap >=10, explicit signals >0
- `scoreWorkflowDocument` (function) - Computes weighted score from scope, triggers, tags, paths; returns null on exclude tag/path match

## 关键概念

- **Slash Commands**：Forward-slash prefixed commands extracted from system init messages, normalized and merged across sources for session availability
- **Attachment Handling**：Unified model for images and text attachments with character estimation for prompt injection, preview resolution, and data URL normalization
- **Plan Normalization**：Canonical status values (pending/in_progress/completed) derived from varied tool output formats (update_plan, todo_write) regardless of field naming conventions
- **Prompt Ledger**：Context window accounting system with source attribution, token estimation, bucket grouping, segment-level risk detection for context management
- **Activity Rail**：Timeline model for UI with layered rendering (context/tools/result/flow), tone indicators, and round-based sequencing
- **Multi-Model Routing**：Provider-aware model selection for custom, deepseek, and codex backends with compatibility checking and fallback chains
- **Workflow Engine**：Markdown-based workflow specification with step execution, session-bound state, auto-advance, and context-based candidate selection
- **MCP Server Registry**：Static definitions for built-in servers (browser, admin, figma, etc.) with tool groups, descriptions, and icon mappings
- **Quick Open Filtering**：Fuzzy file matching with weighted scoring favoring exact matches, prefixes, and early token occurrence
- **Codex Compact Models**：Model naming convention with -openai-compact suffix for compact variants, merged with base models for API routing

## 内部关系

- `src/shared/runner-prompt.ts` -> `src/shared/attachments.ts`：Imports buildAnthropicPromptContentBlocks for prompt block construction
- `src/shared/workflow-selector.ts` -> `src/shared/workflow-markdown.ts`：Imports WorkflowScope and WorkflowSpecDocument types for selection logic
- `src/shared/activity-rail-model.ts` -> `src/shared/prompt-ledger.ts`：Imports PromptLedgerBucket, PromptLedgerMessage, PromptLedgerSegment types
- `src/shared/model-provider-routing.ts` -> `src/shared/codex-oauth.ts`：Imports CODEX_OAUTH_COMPACT_MODEL_SUFFIX for model name stripping

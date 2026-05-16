# src/electron/libs/system-prompt-presets.ts

> 模块：`electron` · 语言：`typescript` · 行数：176

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildBrowserWorkbenchPromptAppend@11`
- `buildAdminConfigPromptAppend@20`
- `buildToolCallOptimizationPromptAppend@27`
- `extractFeishuDocumentUrls@44`
- `buildFeishuDocumentFetchPromptAppend@52`
- `buildGlobalRuntimeSystemPromptExtAppend@80`
- `getSystemPromptExtLines@92`
- `isRecord@112`
- `buildBuiltinMcpRegistryPromptAppend@116`
- `buildClaudeCode2139FeaturePromptAppend@120`
- `buildDesignParityPromptAppend@124`
- `buildTechCCHubSystemPromptSources@135`
- `FEISHU_DOC_URL_PATTERN@7`
- `FEISHU_DOC_URL_TRAILING_PUNCTUATION@9`
- `MAX_FEISHU_DOC_URL_HINTS@10`
- `matches@46`
- `urls@47`
- `urls@57`
- `hasLarkCliCommand@61`
- `hasLarkCliProfile@63`
- `commands@67`
- `lines@82`
- `value@97`
- `trimmed@100`
- `BuiltinMcpServerName@4`

## 依赖输入

- `../../shared/prompt-ledger.js`
- `../../shared/builtin-mcp-registry.js`
- `./claude-code-compat-registry.js`

## 对外暴露

- `buildBrowserWorkbenchPromptAppend`
- `buildAdminConfigPromptAppend`
- `buildToolCallOptimizationPromptAppend`
- `extractFeishuDocumentUrls`
- `buildFeishuDocumentFetchPromptAppend`
- `buildGlobalRuntimeSystemPromptExtAppend`
- `buildBuiltinMcpRegistryPromptAppend`
- `buildClaudeCode2139FeaturePromptAppend`
- `buildDesignParityPromptAppend`
- `buildTechCCHubSystemPromptSources`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { PromptLedgerSource } from "../../shared/prompt-ledger.js";
import {
  buildBuiltinMcpPromptHints,
  type BuiltinMcpServerName,
} from "../../shared/builtin-mcp-registry.js";
import { buildClaudeCodeCompatPromptAppend } from "./claude-code-compat-registry.js";

const FEISHU_DOC_URL_PATTERN = /https?:\/\/[^\s<>"'`]*feishu\.cn\/(?:wiki|docx|docs)\/[^\s<>"'`]*/gi;
const FEISHU_DOC_URL_TRAILING_PUNCTUATION = /[),.;，。；、]+$/;
const MAX_FEISHU_DOC_URL_HINTS = 3;

export function buildBrowserWorkbenchPromptAppend(): string {
  return [
    "BrowserView rule: for current-page browsing, scraping, debugging, annotations, screenshots, cookies, storage, console logs, URL checks, and DOM inspection, use the built-in tech-cc-hub browser MCP tools instead of external browser skills.",
    "Use focused browser helpers when possible: http_ping/diagnose_port for service checks, browser_console_logs(waitFor) for HMR/build waits, browser_query_nodes/browser_get_element/browser_inspect_styles for DOM/style evidence, browser_query_nodes/browser_inspect_styles(fields) for compact output, and browser_apply_styles for temporary CSS preview.",
    "For Figma-backed UI fixes, gather DOM node fields (text, selector, box, attributes, componentStack, context.nearbyText) and use figma_match_ui_nodes to map rendered UI nodes to Figma nodes before editing.",
    "If the prompt contains <browser_annotations>, load/use the annotation-ui-fix skill; do not keep its multi-step SOP in global prompt context.",
  ].join("\n");
}

export function buildAdminConfigPromptAppend(): string {
  return [
    "运行配置持久化规则：如需向 `agent-runtime.json` 写入通用配置（如 `env`、`skillCredentials`、`closeSidebarOnBrowserOpen`），应优先使用 `mcp__tech-cc-hub-admin__set_global_runtime_config` 工具。",
    "工具只做合规持久化更新，不应回显任何密钥明文；返回值按字段名统计变化即可。",
  ].join("\n");
}

export function buildToolCallOptimizationPromptAppend(): string {
  return [
    "Tool-call budget: use tools only when the answer, code change, or verification depends on current external state; do not call tools for direct answers or obvious reasoning.",
    "Before the first tool call, group the needed evidence: if 2+ read-only searches, file reads, status checks, or log reads are independent, run them in one parallel/batched turn when the current tool surface supports it.",
    "Use the built-in `Task` tool for parallel investigation only when the work splits into 2+ independent code paths, modules, logs, or requirement sources. Give each Task one clear question, scope boundary, and expected output, then integrate the findings in the parent turn.",
    "Do not use `Task` for a single file read, a tightly dependent investigation chain, or an immediate blocker whose result is needed before the next local step; handle those directly in the parent turn.",
    "Known concrete files: read only the relevant ranges and batch those reads. Unknown target: run one bounded rg/find/Grep/Glob search to narrow to files and line numbers, then read only the best hits.",
    "Avoid fragmented chains such as ls -> cat -> grep -> cat when one rg/find search or one read-only batch can answer it.",
    "Default file reads should stay under 200 lines. After edits, verify only the changed ranges or decisive output; do not full-read a file just to confirm a small change.",
    "Batch read-only work when safe; keep writes, deletes, moves, installs, commits, and other side effects in separate calls.",
    "Stop exploring once the collected evidence is sufficient. Only add more tool calls when a new error, ambiguity, or explicit user request makes them necessary.",
    "After Edit/Write/MultiEdit, immediately run the smallest meaningful verification and report the result.",
    "Use bounded non-interactive shell commands; on Windows avoid unstable PowerShell surfaces and quote paths carefully.",
    "For scheduled tasks use the persistent tech-cc-hub cron MCP tools, not SDK CronCreate/CronDelete/CronList.",
  ].join("\n");
}

export function extractFeishuDocumentUrls(text: string): string[] {
  const matches = text.match(FEISHU_DOC_URL_PATTERN) ?? [];
  const urls = matches
    .map((url) => url.replace(FEISHU_DOC_URL_TRAILING_PUNCTUATION, ""))
    .filter
... (truncated)
```

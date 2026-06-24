import type { PromptLedgerSource } from "../../shared/prompt-ledger.js";
import { FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_HINTS } from "../../shared/figma-development-workflow.js";
import {
  buildBuiltinMcpPromptHints,
  type BuiltinMcpServerName,
} from "../../shared/builtin-mcp-registry.js";
import {
  buildClaudeCodeCompatPromptAppend,
  type ClaudeCodeCompatPromptAppendOptions,
} from "./claude/claude-code-compat-registry.js";

const FEISHU_DOC_URL_PATTERN = /https?:\/\/[^\s<>"'`]*feishu\.cn\/(?:wiki|docx|docs)\/[^\s<>"'`]*/gi;
const FEISHU_DOC_URL_TRAILING_PUNCTUATION = /[),.;，。；、]+$/;
const MAX_FEISHU_DOC_URL_HINTS = 3;

export function buildBrowserWorkbenchPromptAppend(): string {
  return [
    "BrowserView rule: for current-page browsing, scraping, debugging, annotations, screenshots, cookies, storage, console logs, fetch/XHR capture, URL checks, and DOM inspection, use the built-in tech-cc-hub browser MCP tools instead of external browser skills.",
    "Authenticated URL rule: when the user gives a URL that may depend on saved login state, cookies, SSO, internal/enterprise access, or task/doc systems, the first retrieval attempt must use browser_open_page or browser_get_state plus BrowserView inspection. Do not use WebFetch first for these URLs.",
    "WebFetch fallback rule: if WebFetch reports login required, 401/403, redirect to another host, SSO/OAuth/login, or asks to follow an auth redirect, immediately switch to browser_open_page and inspect the page with browser_extract_page/browser_snapshot_interactive instead of asking the user to paste task details.",
    "Current BrowserView first: before starting a dev server, opening localhost, or launching external browser automation, call browser_get_state. If the right-side BrowserView already has an active URL/title, reuse that page and inspect it with browser_extract_page/browser_query_nodes/browser_fetch_logs/browser_capture_visible.",
    "Do not run npm run dev or open a new local page just to inspect an already-open BrowserView. Start or reopen only after browser_get_state/http_ping/diagnose_port shows there is no usable page, the current URL is wrong, or the user explicitly asked to launch a service.",
    "Use focused browser helpers when possible: http_ping/diagnose_port for service checks, browser_console_logs(waitFor) for HMR/build waits, browser_fetch_logs for API request/response evidence after page interactions, browser_http_request for credentialed direct API probes from the current BrowserView session, browser_query_nodes/browser_get_element/browser_inspect_styles for DOM/style evidence, browser_query_nodes/browser_inspect_styles(fields) for compact output, and browser_apply_styles for temporary CSS preview.",
    "Save/display mismatch rule: when a UI save returns 200 but the screen still shows old data, capture the submitted payload, response body or responseJsonFields, direct BrowserView-session API result via browser_http_request when useful, and the next read response before editing frontend or backend code.",
    "For local services, a background Bash exit code only proves the launch command returned; verify readiness separately with diagnose_port/http_ping and inspect logs. Spring Boot /actuator/health 503 means the process is reachable but not ready.",
    "For Figma-backed UI fixes, gather DOM node fields (text, selector, box, attributes, componentStack, context.nearbyText) and use figma_match_ui_nodes to map rendered UI nodes to Figma nodes before editing.",
    "If the prompt contains <browser_annotations>, load/use the annotation-ui-fix skill; do not keep its multi-step SOP in global prompt context.",
  ].join("\n");
}

export function buildAdminConfigPromptAppend(): string {
  return [
    "运行配置持久化规则：如需向 `agent-runtime.json` 写入通用配置（如 `env`、`skillCredentials`、`systemPromptExt`），应优先使用 `mcp__tech-cc-hub-admin__set_global_runtime_config` 工具。",
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
    "Use bounded non-interactive shell commands; on Windows avoid unstable PowerShell surfaces and quote paths carefully. In Git Bash, protect Windows executable switches with double slashes when needed, for example `taskkill //PID 1234 //F`.",
    "For scheduled tasks use the persistent tech-cc-hub cron MCP tools, not SDK CronCreate/CronDelete/CronList.",
  ].join("\n");
}

export function extractFeishuDocumentUrls(text: string): string[] {
  const matches = text.match(FEISHU_DOC_URL_PATTERN) ?? [];
  const urls = matches
    .map((url) => url.replace(FEISHU_DOC_URL_TRAILING_PUNCTUATION, ""))
    .filter(Boolean);
  return Array.from(new Set(urls)).slice(0, MAX_FEISHU_DOC_URL_HINTS);
}

export function buildFeishuDocumentFetchPromptAppend(
  prompt: string,
  runtimeEnv: Record<string, string | undefined>,
): string | undefined {
  const urls = extractFeishuDocumentUrls(prompt);
  if (urls.length === 0) {
    return undefined;
  }

  const hasLarkCliCommand = Boolean(runtimeEnv.LARK_CLI_COMMAND?.trim());
  const hasLarkCliProfile = Boolean(runtimeEnv.LARK_CLI_PROFILE?.trim());
  if (!hasLarkCliCommand || !hasLarkCliProfile) {
    return undefined;
  }

  const commands = urls.map((url) =>
    `- \`$LARK_CLI_COMMAND --profile $LARK_CLI_PROFILE docs +fetch --doc "${url}" --format pretty 2>&1\``
  );

  return [
    "飞书/Lark 文档链接直读规则：当前用户输入包含 feishu.cn/wiki、feishu.cn/docx 或 feishu.cn/docs 链接。",
    "优先直接用 lark-cli 文档读取命令；不要先试 `wiki get`、`wiki nodes --help` 或泛化 `--help` 探路。",
    "Bash 命令：",
    ...commands,
    "读取返回 Markdown 后，直接基于文档内容回答用户。",
  ].join("\n");
}

export function buildGlobalRuntimeSystemPromptExtAppend(globalRuntimeConfig: unknown): string | undefined {
  const lines = getSystemPromptExtLines(globalRuntimeConfig);
  if (lines.length === 0) {
    return undefined;
  }

  return [
    "全局 System Prompt 扩展：",
    ...lines,
  ].join("\n");
}

function getSystemPromptExtLines(globalRuntimeConfig: unknown): string[] {
  if (!isRecord(globalRuntimeConfig)) {
    return [];
  }

  const value = globalRuntimeConfig.systemPromptExt;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildBuiltinMcpRegistryPromptAppend(enabledServerNames?: readonly BuiltinMcpServerName[]): string {
  return buildBuiltinMcpPromptHints(enabledServerNames);
}

export function buildClaudeCodeCompatFeaturePromptAppend(
  options?: ClaudeCodeCompatPromptAppendOptions,
): string {
  return buildClaudeCodeCompatPromptAppend(options);
}

export function buildClaudeCode2139FeaturePromptAppend(
  options?: ClaudeCodeCompatPromptAppendOptions,
): string {
  return buildClaudeCodeCompatFeaturePromptAppend(options);
}

export function buildDesignParityPromptAppend(): string {
  return [
    ...FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_HINTS,
    "Figma visual-first rule: for UI implementation, use figma_list_node_index to narrow the node, figma_export_node_images to save a local image, then design_inspect_image on the returned imagePath before coding from JSON.",
    "Figma reference-lock rule: before editing files, lock one reference tuple: Figma nodeId + exported local imagePath + design_inspect_image qualityGate.confidence >= 0.75 + the DOM target selector/region to repair. Compare and iterate against that same locked tuple.",
    "Figma wrong-reference recovery rule: if the first visual diff is mostly full-page, the diff worsens after an edit, aspect/size is far off, or the agent realizes the reference was cropped from the wrong node, stop patching and relock the reference with figma_list_node_index / figma_match_ui_nodes / figma_export_node_images.",
    "Figma 90% acceptance rule: after implementing, capture the target component and run design_compare_element_to_reference or design_compare_current_view with maxDifferenceRatio <= 0.10. If the report verdict fails or is invalid, keep iterating unless a real blocker remains.",
    "Element-level visual diff rule: when a selector/ref/xpath is known, use design_compare_element_to_reference instead of full-page comparison so the VLM/code loop patches the exact DOM region.",
    "Semantic visual diff rule: when the reference/candidate contains charts, Sankey diagrams, tables, labels, values, or flow topology, run design_compare_images_semantic after pixel diff and patch critical topology/text/value issues before styling details.",
    "设计还原规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，必须优先使用内置设计 MCP 工具。",
    "设计还原/视觉比对场景中，如果当前轮包含用户上传/粘贴的单张参考图，第一步必须调用 `design_inspect_image` 读取结构化视觉摘要；普通图像问答可由支持多模态的主模型直接读取图片。不要把同一张图传给 `design_compare_images` 的 reference 和 candidate。",
    "`design_capture_current_view` 可将当前 BrowserView 截图保存成 PNG；`design_compare_current_view` / `design_compare_images` 会返回当前截图、diff 图、三栏 comparison 图、JSON report、差异比例、差异边界、topDiffRegions 和 verdict；批量场景用 `design_compare_current_view_batch` / `design_compare_images_batch`。",
    "已有 JSON report 路径时用 `design_read_comparison_report` 复查差异和验收结论；需要找回最近视觉产物时用 `design_list_artifacts`，不要让用户手动翻目录。",
    "视觉比照时可按需设置 `ignoreRegions` 忽略时间戳/头像/动画等动态区域，设置 `maxDifferenceRatio` 形成通过/失败结论，文字抗锯齿噪声较多时可开启 `ignoreAntialiasing`，需要区分变亮/变暗时用 `diffColorMode: directional`。",
    "修 UI 时先生成当前截图和 comparison 图，再根据差异依次调整布局尺寸、间距、信息密度、颜色、字体、阴影和图标细节。",
  ].join("\n");
}

export function buildTechCCHubSystemPromptSources(): PromptLedgerSource[] {
  return [
    {
      id: "tech-cc-hub-browser-preset",
      label: "tech-cc-hub 内置浏览器预设",
      sourceKind: "system",
      text: buildBrowserWorkbenchPromptAppend(),
    },
    {
      id: "tech-cc-hub-admin-preset",
      label: "tech-cc-hub 配置治理预设",
      sourceKind: "system",
      text: buildAdminConfigPromptAppend(),
    },
    {
      id: "tech-cc-hub-tool-policy-preset",
      label: "tech-cc-hub 工具调用预设",
      sourceKind: "system",
      text: buildToolCallOptimizationPromptAppend(),
    },
    {
      id: "tech-cc-hub-design-preset",
      label: "tech-cc-hub 设计还原预设",
      sourceKind: "system",
      text: buildDesignParityPromptAppend(),
    },
    {
      id: "tech-cc-hub-builtin-mcp-registry-preset",
      label: "tech-cc-hub built-in MCP registry preset",
      sourceKind: "system",
      text: buildBuiltinMcpRegistryPromptAppend(),
    },
    {
      id: "tech-cc-hub-claude-code-compat-preset",
      label: "tech-cc-hub Claude Code compatibility preset",
      sourceKind: "system",
      text: buildClaudeCodeCompatFeaturePromptAppend(),
    },
  ];
}

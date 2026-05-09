import type { PromptLedgerSource } from "../../shared/prompt-ledger.js";
import { buildBuiltinMcpPromptHints } from "../../shared/builtin-mcp-registry.js";

export function buildBrowserWorkbenchPromptAppend(): string {
  return [
    "BrowserView rule: for current-page browsing, scraping, debugging, annotations, screenshots, cookies, storage, console logs, URL checks, and DOM inspection, use the built-in tech-cc-hub browser MCP tools instead of external browser skills.",
    "Use focused browser helpers when possible: http_ping/diagnose_port for service checks, browser_console_logs(waitFor) for HMR/build waits, browser_query_nodes/browser_get_element/browser_inspect_styles for DOM/style evidence, browser_query_nodes/browser_inspect_styles(fields) for compact output, and browser_apply_styles for temporary CSS preview.",
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
    "Tool discipline: call only tools present in the current tool list; discover schema-sensitive/deferred tools before use and do not invent missing tools.",
    "Known concrete files: read them in parallel; unknown target: search once with Grep/Glob/Bash rg/find to narrow, then read only the hits.",
    "Avoid fragmented chains such as ls -> cat -> grep -> cat when one search or one read-only batch can answer it.",
    "Batch read-only work when safe; keep writes, deletes, moves, installs, commits, and other side effects in separate calls.",
    "After Edit/Write/MultiEdit, immediately run the smallest meaningful verification and report the result.",
    "Use bounded non-interactive shell commands; on Windows avoid unstable PowerShell surfaces and quote paths carefully.",
    "For scheduled tasks use the persistent tech-cc-hub cron MCP tools, not SDK CronCreate/CronDelete/CronList.",
  ].join("\n");
}

export function buildBuiltinMcpRegistryPromptAppend(): string {
  return buildBuiltinMcpPromptHints();
}

export function buildDesignParityPromptAppend(): string {
  return [
    "设计还原规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，必须优先使用内置设计 MCP 工具。",
    "如果当前轮包含用户上传/粘贴的单张参考图，第一步必须调用 `design_inspect_image` 读取结构化视觉摘要；不要用 Read 读取图片，也不要把同一张图传给 `design_compare_images` 的 reference 和 candidate。",
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
  ];
}

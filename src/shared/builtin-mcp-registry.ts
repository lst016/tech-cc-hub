import { FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_HINTS } from "./figma-development-workflow.js";

export type BuiltinMcpServerName =
  | "tech-cc-hub-browser"
  | "tech-cc-hub-admin"
  | "tech-cc-hub-design"
  | "tech-cc-hub-figma"
  | "tech-cc-hub-cron"
  | "tech-cc-hub-idea"
  | "tech-cc-hub-plan"
  | "tech-cc-hub-knowledge"
  | "tech-cc-hub-image";

export type BuiltinMcpIconKey =
  | "activity"
  | "settings"
  | "sparkles"
  | "figma"
  | "timer"
  | "code"
  | "list"
  | "image";

export type BuiltinMcpToolInfo = {
  name: string;
  description: string;
  tag?: string;
  intent?: string;
  platforms?: readonly NodeJS.Platform[];
};

export type BuiltinMcpToolGroup = {
  title: string;
  summary?: string;
  tools: BuiltinMcpToolInfo[];
};

export type BuiltinMcpServerDefinition = {
  name: BuiltinMcpServerName;
  type: "builtin";
  command: "builtin";
  args: string[];
  envKeys: string[];
  enabled: boolean;
  iconKey: BuiltinMcpIconKey;
  description: string;
  iconClassName: string;
  highlights: string[];
  workflow?: Array<{
    label: string;
    description: string;
  }>;
  toolGroups: BuiltinMcpToolGroup[];
  promptHints?: string[];
};

export const DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-browser",
  "tech-cc-hub-admin",
  "tech-cc-hub-design",
  "tech-cc-hub-cron",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
  "tech-cc-hub-image",
];

const BUILTIN_MCP_ENABLED_SERVERS_SCHEMA_VERSION = 2;
const LEGACY_DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES: readonly BuiltinMcpServerName[] = DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES
  .filter((name) => name !== "tech-cc-hub-image");
const WINDOWS_ONLY_BUILTIN_MCP_TOOL_NAMES = new Set(["idea_restart", "idea_read_logs"]);

export const BUILTIN_MCP_SERVERS: readonly BuiltinMcpServerDefinition[] = [
  {
    name: "tech-cc-hub-browser",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "activity",
    description: "Built-in BrowserView automation for navigation, page reading, interaction, screenshots, storage, fetch/XHR capture, console logs, and local service diagnostics.",
    iconClassName: "border-blue-500/15 bg-blue-50 text-blue-700",
    highlights: ["BrowserView", "DOM read", "Interaction"],
    toolGroups: [
      {
        title: "Navigation and page state",
        tools: [
          { name: "browser_open_page", description: "Open or switch the BrowserView URL." },
          { name: "browser_close_page", description: "Close the current BrowserView page." },
          { name: "browser_get_state", description: "Read URL, title, loading, and navigation state." },
          { name: "browser_navigate", description: "Go back or forward." },
          { name: "browser_reload", description: "Reload the current page." },
          { name: "browser_wait_for", description: "Wait for load, selector, text, URL, time, or JavaScript conditions." },
        ],
      },
      {
        title: "Reading and diagnostics",
        tools: [
          { name: "browser_extract_page", description: "Extract page text, title, links, and image summary." },
          { name: "browser_extract_canvas", description: "Read semantic data and metadata from Canvas, WebGL, and SVG providers across page frames." },
          { name: "browser_wait_canvas", description: "Wait for any rendered-surface provider data to change, match text, or stabilize." },
          { name: "browser_get_element", description: "Read text, html, value, attributes, box, and style details." },
          { name: "browser_get_dom_stats", description: "Inspect DOM size and common element counts." },
          { name: "browser_snapshot_interactive", description: "Create @e1/@e2 references for interactive elements." },
          { name: "browser_query_nodes", description: "Query DOM nodes with CSS selectors or XPath." },
          { name: "browser_inspect_styles", description: "Read computed styles, CSS variables, and node style metadata." },
          { name: "browser_inspect_at_point", description: "Inspect the DOM node under a viewport coordinate." },
          { name: "browser_console_logs", description: "Read or wait for browser console output." },
          { name: "browser_fetch_logs", description: "Read captured Fetch/XHR requests, body previews, JSON fields, and response bodies." },
          { name: "browser_http_request", description: "Send a credentialed fetch from the current BrowserView page context." },
          { name: "browser_eval", description: "Run JavaScript in the current page context." },
          { name: "http_ping", description: "Lightweight URL health and status check." },
          { name: "diagnose_port", description: "Diagnose a local Windows port listener." },
          { name: "bash_batch", description: "Run a bounded batch of read-only shell commands through the browser tool host." },
        ],
      },
      {
        title: "Element and input interaction",
        tools: [
          { name: "browser_click_element", description: "Click an element by ref, selector, or XPath." },
          { name: "browser_dblclick_element", description: "Double-click an element." },
          { name: "browser_focus_element", description: "Focus an element." },
          { name: "browser_hover_element", description: "Hover an element." },
          { name: "browser_type_element", description: "Append text to an element." },
          { name: "browser_fill_element", description: "Clear and fill an input element." },
          { name: "browser_select_element", description: "Set a select element value." },
          { name: "browser_check_element", description: "Check a checkbox, radio, or role=checkbox element." },
          { name: "browser_uncheck_element", description: "Uncheck a checkbox or role=checkbox element." },
          { name: "browser_scroll_into_view", description: "Scroll an element into view." },
          { name: "browser_press_key", description: "Send a single key press." },
          { name: "browser_key_down", description: "Send keyDown for combinations." },
          { name: "browser_key_up", description: "Send keyUp for combinations." },
          { name: "browser_keyboard_type", description: "Type text through the keyboard." },
          { name: "browser_keyboard_insert_text", description: "Insert text directly at the focused element." },
          { name: "browser_mouse", description: "Send mouse move, down, up, and wheel events." },
          { name: "browser_scroll_page", description: "Scroll the page or a target element." },
        ],
      },
      {
        title: "Screenshots, storage, and previews",
        tools: [
          { name: "browser_capture_visible", description: "Capture the visible BrowserView area as a short data URL." },
          { name: "browser_save_screenshot", description: "Save a BrowserView screenshot file." },
          { name: "browser_save_pdf", description: "Print the page to a PDF file." },
          { name: "browser_cookies", description: "List, set, remove, or flush cookies." },
          { name: "browser_storage", description: "Get, set, remove, or clear localStorage/sessionStorage." },
          { name: "browser_apply_styles", description: "Temporarily inject inline styles for CSS preview." },
          { name: "browser_set_annotation_mode", description: "Enable or disable page annotation mode." },
        ],
      },
    ],
  },
  {
    name: "tech-cc-hub-admin",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "settings",
    description: "Controlled runtime configuration updates for agent-runtime.json, environment hints, skill credentials references, and runtime toggles.",
    iconClassName: "border-slate-500/15 bg-slate-50 text-slate-700",
    highlights: ["Config", "Env hints", "Credential refs"],
    toolGroups: [
      {
        title: "Runtime configuration",
        tools: [
          { name: "set_global_runtime_config", description: "Safely update global runtime config sections without exposing secret values." },
        ],
      },
    ],
  },
  {
    name: "tech-cc-hub-design",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "sparkles",
    description: "Visual parity toolchain for image inspection, BrowserView screenshots, image diff reports, hotspot analysis, and UI repair loops.",
    iconClassName: "border-accent/20 bg-accent/8 text-accent",
    highlights: ["Image summary", "BrowserView capture", "Diff report"],
    workflow: [
      { label: "Inspect", description: "image" },
      { label: "Capture", description: "view" },
      { label: "Compare", description: "diff" },
      { label: "Review", description: "report" },
    ],
    toolGroups: [
      {
        title: "Visual parity",
        summary: "Reference image understanding, current-view capture, pixel diff, history lookup, and batch regression.",
        tools: [
          { name: "design_inspect_image", description: "Read a structured visual summary from a local reference image." },
          { name: "design_capture_current_view", description: "Save the current BrowserView screenshot as a candidate image." },
          { name: "design_capture_current_region", description: "Save a pixel region from the current BrowserView screenshot." },
          { name: "design_capture_current_element", description: "Resolve a selector/ref/xpath, capture its padded BrowserView region, and save it as an image." },
          { name: "design_compare_current_view", description: "Compare the current BrowserView, region, or selector target with a local reference image." },
          { name: "design_compare_element_to_reference", description: "Compare a selector/ref/xpath element region with a local reference image." },
          { name: "design_compare_images", description: "Compare two local images and produce diff/report artifacts." },
          { name: "design_compare_images_semantic", description: "Use a vision model to compare two images semantically and return structured issues." },
          { name: "design_compare_current_view_batch", description: "Compare the current BrowserView against multiple reference images." },
          { name: "design_compare_images_batch", description: "Compare multiple local image pairs." },
          { name: "design_read_comparison_report", description: "Read a saved JSON comparison report." },
          { name: "design_list_artifacts", description: "List recent current, diff, comparison, and report artifacts." },
        ],
      },
    ],
  },
  {
    name: "tech-cc-hub-figma",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: false,
    iconKey: "figma",
    description: "Figma REST API tools backed by the user's locally saved Personal Access Token. Reads metadata/nodes, extracts design summaries and tokens, runs design-system/UX audits, generates Tailwind drafts, and inspects exports, comments, versions, library assets, variables, and dev resources without Codex OAuth.",
    iconClassName: "border-cyan-500/15 bg-cyan-50 text-cyan-700",
    highlights: ["PAT", "REST API", "UX audit"],
    workflow: [
      { label: "Token", description: "设置页保存" },
      { label: "Read", description: "文件/节点" },
      { label: "Inspect", description: "库/变量/评论" },
      { label: "Export", description: "图片资源" },
    ],
    toolGroups: [
      {
        title: "Figma REST",
        summary: "普通用户可用的 Figma Personal Access Token 模式，不依赖官方 Remote MCP OAuth。核心能力保持只读。",
        tools: [
          { name: "figma_get_current_user", description: "Read the Figma account attached to the saved token." },
          { name: "figma_get_file_metadata", description: "Read file metadata, or fall back to a lightweight file overview." },
          { name: "figma_read_design", description: "Read a Figma file or specific nodes from a Figma URL/file key." },
          { name: "figma_list_node_index", description: "List a compact node/text index for progressive disclosure before drilling into a large design branch." },
          { name: "figma_match_ui_nodes", description: "Map BrowserView DOM nodes or annotations to likely Figma nodes." },
          { name: "figma_summarize_design", description: "Convert Figma nodes into a compact Agent-friendly design tree." },
          { name: "figma_extract_design_tokens", description: "Extract color, typography, radius, spacing, and effect token candidates." },
          { name: "figma_get_design_playbook", description: "Get curated design-system and UX theory guidance before implementation." },
          { name: "figma_audit_design", description: "Audit selected Figma nodes with design-system, UX-law, token, accessibility, and componentization checks." },
          { name: "figma_generate_tailwind_code", description: "Generate a Tailwind HTML or React draft from selected Figma nodes." },
          { name: "figma_get_image_urls", description: "Create Figma image export URLs for node IDs." },
          { name: "figma_export_node_images", description: "Export Figma nodes to local PNG/JPG files for design_inspect_image and screenshot comparison." },
          { name: "figma_get_image_fills", description: "Read image fill download URLs referenced by the file." },
          { name: "figma_list_file_versions", description: "Read version history for a Figma file." },
          { name: "figma_list_file_comments", description: "Read comments from a Figma file." },
          { name: "figma_list_file_library", description: "Read published components, component sets, and styles in a file library." },
          { name: "figma_get_file_variables", description: "Read local or published variables from a file when the account supports Variables API." },
          { name: "figma_get_dev_resources", description: "Read Dev Resources attached to the file or selected nodes." },
        ],
      },
    ],
    promptHints: [
      ...FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_HINTS,
      "Figma PAT 规则：用户给出 figma.com 链接并且设置页已保存 Figma Token 时，先按需要选工具：元信息用 `figma_get_file_metadata`，节点 JSON 用 `figma_read_design`，Agent 轻量上下文用 `figma_summarize_design`，设计 token 用 `figma_extract_design_tokens`。",
      "需要增强设计判断时，先用 `figma_get_design_playbook` 选择 Carbon/Fluent/Primer/Ant/Material/Laws of UX 等约束；读到节点后用 `figma_audit_design` 做 UX、token、组件化、可访问性和场景状态审查。",
      "需要先出实现草稿时用 `figma_generate_tailwind_code`，但它只是 Tailwind/React 初稿；落地时必须按当前项目组件和视觉截图校对。视觉参考优先用 `figma_export_node_images` 生成本地图，再用 `design_inspect_image`；临时 URL 才用 `figma_get_image_urls`，图片填充用 `figma_get_image_fills`。",
      "需要设计系统上下文时用 `figma_list_file_library` 和 `figma_get_file_variables`；需要协作上下文时用 `figma_list_file_comments`、`figma_list_file_versions`、`figma_get_dev_resources`。",
      "Figma URL 中的 `node-id=1-2` 需要作为节点读取，工具会自动转换成 API 需要的 `1:2`。不要把 Figma PAT 当作官方 Remote MCP OAuth bearer token 使用；高级工具失败时优先提示用户补对应 PAT scope。",
      "Figma progressive disclosure rule: when a design response is too large or figma_read_design returns result.truncated=true, use `figma_list_node_index` or result.progressiveDisclosure.nodeIndex to pick the smallest relevant node, then call `figma_summarize_design` or `figma_read_design` with that nodeId and a small depth.",
      "Figma visual-first rule: for UI implementation, prefer `figma_list_node_index` -> `figma_export_node_images` before reading deep node JSON. A multimodal main model may inspect the exported image directly; for a text-only main model, use `design_inspect_image` first. `figma_get_image_urls` is only a URL lookup; exported local image paths are the implementation-grade visual reference.",
      "Figma reference-lock rule: before editing UI files, lock one tuple of Figma nodeId + exported local imagePath + visual evidence + DOM target selector/region. Direct multimodal inspection is valid; a text-only main model still requires `design_inspect_image` qualityGate.confidence >= 0.75. Compare and iterate against that same locked tuple; do not keep patching if the reference was cropped from the wrong node.",
      "Figma wrong-reference recovery rule: if diffBoundingBox is mostly full-page, aspect/size is far off, differenceRatio gets worse after an edit, or the agent says the reference crop is wrong, relock via `figma_list_node_index` / `figma_match_ui_nodes` / `figma_export_node_images` before further edits.",
      "Figma 90% acceptance rule: after implementing UI from Figma, capture the target component and compare it with `design_compare_element_to_reference` or `design_compare_current_view` using `maxDifferenceRatio <= 0.10`; if the report fails or is invalid, continue patching instead of stopping at functional correctness.",
      "Figma anchor rule: when the user provides a figma.com URL with node-id, pass that URL directly to `figma_list_node_index` with a query from the requested UI text (Chinese/English terms and `|` alternatives are OK). Do not ask the user to manually provide a Frame number before trying the node/text index.",
      "UI-to-Figma mapping rule: when the issue is about a concrete rendered UI element, first gather DOM evidence with `browser_query_nodes` or annotations using fields like `text`, `selector`, `box`, `attributes`, `componentStack`, and `context.nearbyText`, then call `figma_match_ui_nodes` with the same Figma URL to map UI nodes to Figma nodeIds before editing.",
    ],
  },
  {
    name: "tech-cc-hub-cron",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "timer",
    description: "Persistent scheduled task management for creating, listing, updating, and deleting background agent follow-up tasks.",
    iconClassName: "border-amber-500/15 bg-amber-50 text-amber-700",
    highlights: ["Create", "List", "Update", "Delete"],
    toolGroups: [
      {
        title: "Scheduled tasks",
        tools: [
          { name: "create_scheduled_task", description: "Create a persistent scheduled task." },
          { name: "list_scheduled_tasks", description: "List scheduled tasks and execution state." },
          { name: "update_scheduled_task", description: "Update an agent-created scheduled task." },
          { name: "delete_scheduled_task", description: "Delete a scheduled task by id." },
        ],
      },
    ],
  },
  {
    name: "tech-cc-hub-idea",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: false,
    iconKey: "code",
    description: "IntelliJ IDEA 2021-2026 启动与复用能力。优先使用 JetBrains Toolbox 脚本适配热更新启动，再回退到最新安装的 IDEA 启动器。",
    iconClassName: "border-sky-500/15 bg-sky-50 text-sky-700",
    highlights: ["IDEA 2021-2026", "复用已运行 IDE", "前台/就绪检查"],
    workflow: [
      { label: "状态", description: "检测" },
      { label: "解析", description: "启动器" },
      { label: "打开", description: "复用" },
      { label: "就绪", description: "等待/前台" },
    ],
    toolGroups: [
      {
        title: "IDEA 启动与复用",
        summary: "Java/Spring 本地验证时复用用户已运行的 IntelliJ IDEA，避免重复启动 jar 或 bootRun 进程。",
        tools: [
          { name: "idea_status", description: "检测已安装的 IDEA 启动器和正在运行的 IDEA 进程。" },
          { name: "idea_open", description: "通过 Toolbox 脚本或最新 IDEA 启动器打开项目/文件；可用时优先复用已运行 IDEA。" },
          { name: "idea_run", description: "Explicit escape hatch: start Spring Boot from tech-cc-hub with Maven/Gradle when the user asks for an external service process." },
          { name: "idea_restart", description: "Rerun the current IntelliJ IDEA Run Configuration for the requested/open project; does not start Maven/Gradle from tech-cc-hub.", platforms: ["win32"] },
          { name: "idea_read_logs", description: "Read the current IntelliJ IDEA Run console logs for the requested/open project; restores the clipboard and does not start Maven/Gradle.", platforms: ["win32"] },
          { name: "idea_focus", description: "把已运行的 IDEA 窗口拉到前台，不启动新的 IDE。" },
          { name: "idea_wait_ready", description: "在启动或复用请求后等待 IDEA 进入运行状态。" },
        ],
      },
    ],
    promptHints: [
      "IDEA 控制规则：处理 Java/Spring 本地运行或验证任务时，如果用户可能已经打开 IntelliJ IDEA，优先使用内置 tech-cc-hub IDEA MCP 工具。",
      "使用 mcp__tech-cc-hub-idea__idea_status 检查本机 IDEA 可用性，使用 mcp__tech-cc-hub-idea__idea_open 复用或打开项目/文件。",
      "启动或打开后如果需要证明 IDEA 已运行，使用 mcp__tech-cc-hub-idea__idea_wait_ready；如果需要把已有 IDE 拉到前台，使用 mcp__tech-cc-hub-idea__idea_focus。",
      "如果用户说“重启 IDEA 里的项目/后端”“把这个项目重新跑起来”或类似意图，使用 mcp__tech-cc-hub-idea__idea_restart；它会聚焦 IDEA 并触发当前 Run Configuration 的 Rerun，不要改用 Maven/Gradle/bootRun。",
      "如果用户要看“正在运行的日志”“IDEA 后端日志”“刚才重启后的日志”，使用 mcp__tech-cc-hub-idea__idea_read_logs 抓取 IDEA 当前 Run 控制台文本；不要为了读取日志启动新的 Maven/Gradle/bootRun 进程。",
      "Only use mcp__tech-cc-hub-idea__idea_run when the user explicitly asks tech-cc-hub to start an external Spring Boot process outside IDEA; then verify readiness with diagnose_port/http_ping and the returned logPath.",
      "When multiple IDEA versions are installed, pass version or launcherPath to idea_status/idea_open instead of assuming the newest IDE is the user's active run-config owner.",
      "如果 idea_open 返回 reusedExisting=true，应把 IDEA 视为用户持有的运行面；除非用户明确要求，不要再启动重复的 java -jar、bootRun 或类似长驻应用进程。",
      "IDEA MCP 基于启动器实现以兼容 IDEA 2021-2026：优先使用 JetBrains Toolbox 脚本支持热更新启动，再回退到最新安装的 idea64/idea 启动器。",
    ],
  },
  {
    name: "tech-cc-hub-plan",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "list",
    description: "OpenAI Codex-compatible update_plan tool for live task checklist progress.",
    iconClassName: "border-emerald-500/15 bg-emerald-50 text-emerald-700",
    highlights: ["update_plan", "Checklist", "Codex-compatible"],
    toolGroups: [
      {
        title: "Plan progress",
        summary: "Codex-compatible checklist updates for the current running session.",
        tools: [
          { name: "update_plan", description: "Update the current task plan with pending, in_progress, and completed steps." },
        ],
      },
    ],
    promptHints: [
      "Plan progress rule: for multi-step work, use the built-in plan tool `mcp__tech-cc-hub-plan__update_plan` to keep a Codex-compatible checklist visible in Usage.",
      "The `update_plan` input must match OpenAI Codex shape: `{ explanation?: string, plan: [{ step: string, status: \"pending\" | \"in_progress\" | \"completed\" }] }`.",
      "Maintain at most one `in_progress` item; update the checklist when moving between phases and finish with all applicable items marked `completed`.",
    ],
  },
  {
    name: "tech-cc-hub-knowledge",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "list",
    description: "Local-first Knowledge Engine with managed CodeGraph under .tech/codegraph and structured Memory.",
    iconClassName: "border-violet-500/15 bg-violet-50 text-violet-700",
    highlights: ["CodeGraph", ".tech", "Memory"],
    workflow: [
      { label: "Auto", description: "index/sync" },
      { label: "Search", description: "symbols" },
      { label: "Context", description: "graph" },
      { label: "Remember", description: "memory" },
    ],
    toolGroups: [
      {
        title: "Knowledge Engine",
        summary: "Managed code graph plus durable memory. CodeGraph DB/cache live under .tech/codegraph.",
        tools: [
          { name: "codegraph_status", description: "Check managed CodeGraph health, backend, stats, and .tech/codegraph paths." },
          { name: "codegraph_sync", description: "Create or incrementally refresh the managed CodeGraph index; missing indexes full-scan automatically." },
          { name: "codegraph_search", description: "Search code symbols and routes from the existing managed index before broad source exploration; does not auto-index or sync." },
          { name: "codegraph_context", description: "Build compact graph context for a task or requirement from the existing managed index; does not auto-index or sync." },
          { name: "codegraph_impact", description: "Trace impact radius for a CodeGraph node id from the existing managed index; does not auto-index or sync." },
          { name: "memory_update", description: "Add, update, or soft-delete structured Memory entries." },
        ],
      },
    ],
    promptHints: [
      "CodeGraph retrieval rule: for each new user turn that needs source-code evidence, treat CodeGraph as the primary code map when an index is already available and call `mcp__tech-cc-hub-knowledge__codegraph_search` or `mcp__tech-cc-hub-knowledge__codegraph_context` before broad `Read`/`Grep`/`Glob`/`Task` source exploration. Fall back to focused source tools when CodeGraph has no useful result, is unavailable, or returns an error; do not retry a failed CodeGraph lookup in the same turn.",
      "Low-power CodeGraph rule: if a CodeGraph tool is slow, times out, or says it is temporarily bypassed, stop using CodeGraph for that turn and use focused `Read`/`Grep`/`Glob` instead.",
      "CodeGraph freshness rule: retrieval tools are fast-path only and do not auto-initialize `.tech/codegraph` or run incremental sync. Use codegraph_sync mode=index only for explicit refresh/indexing requests.",
      "CodeGraph context rule: do not re-read source code that `codegraph_context` already returned unless you are verifying a small changed range.",
      "Managed CodeGraph storage rule: CodeGraph is owned by tech-cc-hub and must use `.tech/codegraph`; do not create or rely on upstream `.codegraph` directories.",
      "CodeGraph tools do not require an LLM or embedding model; do not block CodeGraph status, sync, search, context, or impact on profile configuration.",
      ".tech storage rule: `.tech/codegraph` may contain managed local DB/cache files; `.tech/memory` remains readable Markdown/JSON only. Do not create `.qoder` compatibility files under `.tech`.",
      "Use `memory_update` for durable decisions, pitfalls, project rules, and user communication preferences that should survive future sessions.",
    ],
  },
  {
    name: "tech-cc-hub-image",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "image",
    description: "Built-in image generation and editing via OpenAI Images compatible API. Saves generated images locally and returns path-only tool results.",
    iconClassName: "border-fuchsia-500/15 bg-fuchsia-50 text-fuchsia-700",
    highlights: ["Text-to-image", "Reference edit", "Local asset"],
    workflow: [
      { label: "意图", description: "画/改图" },
      { label: "调用", description: "image_generate" },
      { label: "落盘", description: "本地文件" },
      { label: "回显", description: "图片卡片" },
    ],
    toolGroups: [
      {
        title: "Image generation",
        summary: "文生图、参考图编辑。结果只返回本地路径与元数据，不返回 base64。",
        tools: [
          { name: "image_generate", description: "根据 prompt 生成新图，或基于参考图编辑。最多 4 张，默认 1 张。" },
        ],
      },
    ],
    promptHints: [
      "Image generation rule: 当用户要求画图、生成视觉资产、做海报/插画/banner/sprite，或基于参考图编辑（替换背景、改颜色、修改主体）时，调用 `mcp__tech-cc-hub-image__image_generate`。无参考图走文生图，有参考图走编辑。",
      "Image generation vs inspect: 仅分析截图、读取界面内容时使用 `design_inspect_image`，不要调用 `image_generate`。只有明确要生成或编辑图片时才调用生图工具。",
      "Image generation reference rule: 用户附带参考图时，传完整的 `storagePath` 绝对路径到 `referenceImagePaths`，不能传 image.png 等占位文件名。",
      "Image generation cost rule: 未获得明确生成/编辑意图时，不主动产生付费图片请求；默认生成 1 张，单次最多 4 张。429 不自动重试。",
      "Image generation output rule: 生成成功后在最终回答中简短说明结果（模型、尺寸、张数、本地路径），不复制 base64。工具结果已落盘，路径会自动渲染为图片卡片。",
      "Image generation unconfigured rule: 工具返回 NOT_CONFIGURED 时，提示用户到 设置 → 模型路由 → 生图模型 配置一个支持 OpenAI Images 兼容接口的模型；返回 UNSUPPORTED_PROVIDER 时说明 Codex OAuth 不能替代标准 Image API Key。",
    ],
  },
] as const;

export function getBuiltinMcpServerDefinition(name: string): BuiltinMcpServerDefinition | undefined {
  return BUILTIN_MCP_SERVERS.find((server) => server.name === name);
}

export function listBuiltinMcpServerInfos(
  enabledServerNames: readonly BuiltinMcpServerName[] = DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES,
): Array<Pick<BuiltinMcpServerDefinition, "name" | "type" | "command" | "args" | "envKeys" | "enabled">> {
  const enabledNames = new Set(enabledServerNames);
  return BUILTIN_MCP_SERVERS.map(({ name, type, command, args, envKeys }) => ({
    name,
    type,
    command,
    args: [...args],
    envKeys: [...envKeys],
    enabled: enabledNames.has(name),
  }));
}

export function resolveEnabledBuiltinMcpServerNames(config: unknown): BuiltinMcpServerName[] {
  const configured = getConfiguredEnabledBuiltinMcpServerNames(config);
  if (!configured) {
    return [...DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES];
  }
  const enabledNames = normalizeBuiltinMcpServerConfigNames(configured);
  return shouldMigrateLegacyDefaultEnabledServers(config, enabledNames)
    ? [...DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES]
    : enabledNames;
}

export function filterEnabledBuiltinMcpServerNames(
  serverNames: readonly BuiltinMcpServerName[],
  config: unknown,
): BuiltinMcpServerName[] {
  const enabledNames = new Set(resolveEnabledBuiltinMcpServerNames(config));
  return serverNames.filter((serverName) => enabledNames.has(serverName));
}

export function buildNextBuiltinMcpServerEnabledConfig(
  config: unknown,
  serverName: BuiltinMcpServerName,
  enabled: boolean,
): Record<string, unknown> {
  const nextConfig = isRecord(config) ? { ...config } : {};
  const currentEnabledNames = new Set(resolveEnabledBuiltinMcpServerNames(config));
  if (enabled) {
    currentEnabledNames.add(serverName);
  } else {
    currentEnabledNames.delete(serverName);
  }

  const mcp = isRecord(nextConfig.mcp) ? { ...nextConfig.mcp } : {};
  const builtin = isRecord(mcp.builtin) ? { ...mcp.builtin } : {};
  builtin.schemaVersion = BUILTIN_MCP_ENABLED_SERVERS_SCHEMA_VERSION;
  builtin.enabledServers = BUILTIN_MCP_SERVERS
    .map((server) => server.name)
    .filter((name) => currentEnabledNames.has(name));
  mcp.builtin = builtin;
  nextConfig.mcp = mcp;

  return nextConfig;
}

export function isBuiltinMcpServerName(value: unknown): value is BuiltinMcpServerName {
  return BUILTIN_MCP_SERVERS.some((server) => server.name === value);
}

function getConfiguredEnabledBuiltinMcpServerNames(config: unknown): unknown[] | null {
  if (!isRecord(config)) {
    return null;
  }

  const mcp = isRecord(config.mcp) ? config.mcp : null;
  const builtin = mcp && isRecord(mcp.builtin) ? mcp.builtin : null;
  if (builtin && Array.isArray(builtin.enabledServers)) {
    return builtin.enabledServers;
  }

  const legacyBuiltin = isRecord(config.builtinMcpServers) ? config.builtinMcpServers : null;
  if (legacyBuiltin && Array.isArray(legacyBuiltin.enabledServers)) {
    return legacyBuiltin.enabledServers;
  }

  return null;
}

function normalizeBuiltinMcpServerConfigNames(value: unknown[]): BuiltinMcpServerName[] {
  const names = new Set(value.filter(isBuiltinMcpServerName));
  return BUILTIN_MCP_SERVERS
    .map((server) => server.name)
    .filter((serverName) => names.has(serverName));
}

function shouldMigrateLegacyDefaultEnabledServers(
  config: unknown,
  enabledNames: readonly BuiltinMcpServerName[],
): boolean {
  if (getBuiltinMcpEnabledServersSchemaVersion(config) >= BUILTIN_MCP_ENABLED_SERVERS_SCHEMA_VERSION) {
    return false;
  }

  return enabledNames.length === LEGACY_DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES.length
    && enabledNames.every((name) => LEGACY_DEFAULT_ENABLED_BUILTIN_MCP_SERVER_NAMES.includes(name));
}

function getBuiltinMcpEnabledServersSchemaVersion(config: unknown): number {
  if (!isRecord(config) || !isRecord(config.mcp) || !isRecord(config.mcp.builtin)) {
    return 0;
  }

  const value = config.mcp.builtin.schemaVersion;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type BuiltinMcpPlatformOptions = {
  platform?: NodeJS.Platform;
};

function isToolAvailableOnPlatform(tool: BuiltinMcpToolInfo, platform: NodeJS.Platform): boolean {
  return !tool.platforms || tool.platforms.includes(platform);
}

function isPromptHintAvailableOnPlatform(hint: string, platform: NodeJS.Platform): boolean {
  if (platform === "win32") {
    return true;
  }
  return !Array.from(WINDOWS_ONLY_BUILTIN_MCP_TOOL_NAMES).some((toolName) => hint.includes(toolName));
}

export function listBuiltinMcpToolNames(options: BuiltinMcpPlatformOptions = {}): string[] {
  const platform = options.platform ?? process.platform;
  return BUILTIN_MCP_SERVERS.flatMap((server) => (
    server.toolGroups.flatMap((group) => group.tools
      .filter((tool) => isToolAvailableOnPlatform(tool, platform))
      .map((tool) => tool.name))
  ));
}

export function buildBuiltinMcpPromptHints(
  enabledServerNames?: readonly BuiltinMcpServerName[],
  options: BuiltinMcpPlatformOptions = {},
): string {
  const enabledNames = enabledServerNames ? new Set(enabledServerNames) : null;
  const platform = options.platform ?? process.platform;
  return BUILTIN_MCP_SERVERS
    .filter((server) => !enabledNames || enabledNames.has(server.name))
    .flatMap((server) => server.promptHints ?? [])
    .filter((hint) => isPromptHintAvailableOnPlatform(hint, platform))
    .join("\n");
}

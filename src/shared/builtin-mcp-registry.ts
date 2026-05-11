export type BuiltinMcpServerName =
  | "tech-cc-hub-browser"
  | "tech-cc-hub-admin"
  | "tech-cc-hub-design"
  | "tech-cc-hub-figma"
  | "tech-cc-hub-cron"
  | "tech-cc-hub-idea"
  | "tech-cc-hub-plan";

export type BuiltinMcpIconKey =
  | "activity"
  | "settings"
  | "sparkles"
  | "figma"
  | "timer"
  | "code"
  | "list";

export type BuiltinMcpToolInfo = {
  name: string;
  description: string;
  tag?: string;
  intent?: string;
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

export const BUILTIN_MCP_SERVERS: readonly BuiltinMcpServerDefinition[] = [
  {
    name: "tech-cc-hub-browser",
    type: "builtin",
    command: "builtin",
    args: [],
    envKeys: [],
    enabled: true,
    iconKey: "activity",
    description: "Built-in BrowserView automation for navigation, page reading, interaction, screenshots, storage, console logs, and local service diagnostics.",
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
          { name: "browser_get_element", description: "Read text, html, value, attributes, box, and style details." },
          { name: "browser_get_dom_stats", description: "Inspect DOM size and common element counts." },
          { name: "browser_snapshot_interactive", description: "Create @e1/@e2 references for interactive elements." },
          { name: "browser_query_nodes", description: "Query DOM nodes with CSS selectors or XPath." },
          { name: "browser_inspect_styles", description: "Read computed styles, CSS variables, and node style metadata." },
          { name: "browser_inspect_at_point", description: "Inspect the DOM node under a viewport coordinate." },
          { name: "browser_console_logs", description: "Read or wait for browser console output." },
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
          { name: "design_compare_current_view", description: "Compare the current BrowserView with a local reference image." },
          { name: "design_compare_images", description: "Compare two local images and produce diff/report artifacts." },
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
    enabled: true,
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
          { name: "figma_summarize_design", description: "Convert Figma nodes into a compact Agent-friendly design tree." },
          { name: "figma_extract_design_tokens", description: "Extract color, typography, radius, spacing, and effect token candidates." },
          { name: "figma_get_design_playbook", description: "Get curated design-system and UX theory guidance before implementation." },
          { name: "figma_audit_design", description: "Audit selected Figma nodes with design-system, UX-law, token, accessibility, and componentization checks." },
          { name: "figma_generate_tailwind_code", description: "Generate a Tailwind HTML or React draft from selected Figma nodes." },
          { name: "figma_get_image_urls", description: "Create Figma image export URLs for node IDs." },
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
      "Figma PAT 规则：用户给出 figma.com 链接并且设置页已保存 Figma Token 时，先按需要选工具：元信息用 `figma_get_file_metadata`，节点 JSON 用 `figma_read_design`，Agent 轻量上下文用 `figma_summarize_design`，设计 token 用 `figma_extract_design_tokens`。",
      "需要增强设计判断时，先用 `figma_get_design_playbook` 选择 Carbon/Fluent/Primer/Ant/Material/Laws of UX 等约束；读到节点后用 `figma_audit_design` 做 UX、token、组件化、可访问性和场景状态审查。",
      "需要先出实现草稿时用 `figma_generate_tailwind_code`，但它只是 Tailwind/React 初稿；落地时必须按当前项目组件和视觉截图校对。视觉参考用 `figma_get_image_urls`，图片填充用 `figma_get_image_fills`。",
      "需要设计系统上下文时用 `figma_list_file_library` 和 `figma_get_file_variables`；需要协作上下文时用 `figma_list_file_comments`、`figma_list_file_versions`、`figma_get_dev_resources`。",
      "Figma URL 中的 `node-id=1-2` 需要作为节点读取，工具会自动转换成 API 需要的 `1:2`。不要把 Figma PAT 当作官方 Remote MCP OAuth bearer token 使用；高级工具失败时优先提示用户补对应 PAT scope。",
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
    description: "Persistent scheduled task management for creating, listing, and deleting background agent follow-up tasks.",
    iconClassName: "border-amber-500/15 bg-amber-50 text-amber-700",
    highlights: ["Create", "List", "Delete"],
    toolGroups: [
      {
        title: "Scheduled tasks",
        tools: [
          { name: "create_scheduled_task", description: "Create a persistent scheduled task." },
          { name: "list_scheduled_tasks", description: "List scheduled tasks and execution state." },
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
    enabled: true,
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
          { name: "idea_focus", description: "把已运行的 IDEA 窗口拉到前台，不启动新的 IDE。" },
          { name: "idea_wait_ready", description: "在启动或复用请求后等待 IDEA 进入运行状态。" },
        ],
      },
    ],
    promptHints: [
      "IDEA 控制规则：处理 Java/Spring 本地运行或验证任务时，如果用户可能已经打开 IntelliJ IDEA，优先使用内置 tech-cc-hub IDEA MCP 工具。",
      "使用 mcp__tech-cc-hub-idea__idea_status 检查本机 IDEA 可用性，使用 mcp__tech-cc-hub-idea__idea_open 复用或打开项目/文件。",
      "启动或打开后如果需要证明 IDEA 已运行，使用 mcp__tech-cc-hub-idea__idea_wait_ready；如果需要把已有 IDE 拉到前台，使用 mcp__tech-cc-hub-idea__idea_focus。",
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
] as const;

export function getBuiltinMcpServerDefinition(name: string): BuiltinMcpServerDefinition | undefined {
  return BUILTIN_MCP_SERVERS.find((server) => server.name === name);
}

export function listBuiltinMcpServerInfos(): Array<Pick<BuiltinMcpServerDefinition, "name" | "type" | "command" | "args" | "envKeys" | "enabled">> {
  return BUILTIN_MCP_SERVERS.map(({ name, type, command, args, envKeys, enabled }) => ({
    name,
    type,
    command,
    args: [...args],
    envKeys: [...envKeys],
    enabled,
  }));
}

export function listBuiltinMcpToolNames(): string[] {
  return BUILTIN_MCP_SERVERS.flatMap((server) => (
    server.toolGroups.flatMap((group) => group.tools.map((tool) => tool.name))
  ));
}

export function buildBuiltinMcpPromptHints(): string {
  return BUILTIN_MCP_SERVERS
    .flatMap((server) => server.promptHints ?? [])
    .join("\n");
}

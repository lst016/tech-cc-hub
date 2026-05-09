export type BuiltinMcpServerName =
  | "tech-cc-hub-browser"
  | "tech-cc-hub-admin"
  | "tech-cc-hub-design"
  | "tech-cc-hub-cron"
  | "tech-cc-hub-idea";

export type BuiltinMcpIconKey =
  | "activity"
  | "settings"
  | "sparkles"
  | "timer"
  | "code";

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

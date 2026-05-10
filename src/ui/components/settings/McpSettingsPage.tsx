import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronDown,
  Code2,
  GitCompare,
  Image,
  ListChecks,
  ScanSearch,
  ServerCog,
  Settings,
  Timer,
  WandSparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getBuiltinMcpServerDefinition,
  type BuiltinMcpIconKey,
  type BuiltinMcpServerDefinition,
} from "../../../shared/builtin-mcp-registry";
import type { McpServerInfo } from "../../types";

type McpServerEntry = McpServerInfo & {
  expanded?: boolean;
};

type BuiltinToolInfo = {
  name: string;
  description: string;
  icon?: LucideIcon;
  tag?: string;
  intent?: string;
};

type BuiltinToolGroup = {
  title: string;
  summary?: string;
  tools: BuiltinToolInfo[];
};

type McpTab = "builtin" | "external";

type BuiltinServerMeta = {
  icon: LucideIcon;
  description: string;
  iconClassName: string;
  highlights: string[];
  workflow?: Array<{
    label: string;
    description: string;
  }>;
};

const BUILTIN_ICON_MAP: Record<BuiltinMcpIconKey, LucideIcon> = {
  activity: Activity,
  settings: Settings,
  sparkles: WandSparkles,
  timer: Timer,
  code: Code2,
  list: ListChecks,
};

const BUILTIN_TOOL_GROUPS: Record<string, BuiltinToolGroup[]> = {
  "tech-cc-hub-browser": [
    {
      title: "页面与导航",
      tools: [
        { name: "browser_open_page", description: "打开或切换右侧 BrowserView URL" },
        { name: "browser_close_page", description: "关闭当前浏览器工作台页面" },
        { name: "browser_get_state", description: "读取 URL、标题、加载、前进后退状态" },
        { name: "browser_navigate", description: "执行 back / forward 导航" },
        { name: "browser_reload", description: "刷新当前页面" },
        { name: "browser_wait_for", description: "等待加载、元素、文本、URL、时间或 JS 条件" },
      ],
    },
    {
      title: "页面读取",
      tools: [
        { name: "browser_extract_page", description: "提取正文、标题、链接、图片等页面摘要" },
        { name: "browser_get_element", description: "读取 text/html/value/attr/title/url/count/box/styles" },
        { name: "browser_get_dom_stats", description: "统计 DOM 规模和常见标签" },
        { name: "browser_query_nodes", description: "按 CSS selector 或 XPath 查询节点" },
        { name: "browser_inspect_styles", description: "读取计算样式、CSS 变量和节点信息" },
        { name: "browser_inspect_at_point", description: "按视口坐标反查 DOM 线索" },
        { name: "browser_console_logs", description: "读取或等待浏览器控制台日志" },
        { name: "browser_eval", description: "在页面上下文执行 JavaScript" },
      ],
    },
    {
      title: "元素交互",
      tools: [
        { name: "browser_snapshot_interactive", description: "生成 @e1/@e2 交互元素 ref 快照" },
        { name: "browser_click_element", description: "点击 ref、CSS selector 或 XPath 元素" },
        { name: "browser_dblclick_element", description: "双击目标元素" },
        { name: "browser_focus_element", description: "聚焦目标元素" },
        { name: "browser_hover_element", description: "触发目标元素悬停事件" },
        { name: "browser_type_element", description: "向目标输入元素追加文本" },
        { name: "browser_fill_element", description: "清空并填写目标输入元素" },
        { name: "browser_select_element", description: "设置 select 元素 value" },
        { name: "browser_check_element", description: "勾选 checkbox/radio/role=checkbox" },
        { name: "browser_uncheck_element", description: "取消勾选 checkbox/role=checkbox" },
        { name: "browser_scroll_into_view", description: "把目标元素滚动到视口中间" },
      ],
    },
    {
      title: "键鼠输入",
      tools: [
        { name: "browser_press_key", description: "发送单次按键，如 Enter、Tab、Escape" },
        { name: "browser_key_down", description: "发送 keyDown，用于组合键" },
        { name: "browser_key_up", description: "发送 keyUp，用于组合键" },
        { name: "browser_keyboard_type", description: "向当前焦点发送逐字符键盘输入" },
        { name: "browser_keyboard_insert_text", description: "向当前焦点直接插入文本" },
        { name: "browser_mouse", description: "发送 move/down/up/wheel 鼠标事件" },
        { name: "browser_scroll_page", description: "滚动页面或指定元素" },
      ],
    },
    {
      title: "截图与会话数据",
      tools: [
        { name: "browser_capture_visible", description: "截取可见区域并返回短 data URL 片段" },
        { name: "browser_save_screenshot", description: "保存 BrowserView 可见区域截图文件" },
        { name: "browser_save_pdf", description: "将当前页面打印为 PDF 文件" },
        { name: "browser_cookies", description: "list/set/remove/flush 当前 session cookies" },
        { name: "browser_storage", description: "get/set/remove/clear localStorage 或 sessionStorage" },
        { name: "browser_set_annotation_mode", description: "开启或关闭页面标注模式" },
      ],
    },
    {
      title: "诊断与样式预览",
      tools: [
        { name: "http_ping", description: "轻量检测 URL 存活和响应状态" },
        { name: "diagnose_port", description: "诊断 Windows 本地端口占用进程" },
        { name: "browser_apply_styles", description: "临时注入 inline style 预览 CSS 效果" },
      ],
    },
  ],
  "tech-cc-hub-admin": [
    {
      title: "运行配置",
      tools: [
        { name: "set_global_runtime_config", description: "受控修改全局运行配置、环境变量提示和技能凭证引用" },
      ],
    },
  ],
  "tech-cc-hub-design": [
    {
      title: "视觉还原",
      summary: "参考图理解、BrowserView 截图采集、像素 diff、热点报告和批量回归都在这里集中呈现。",
      tools: [
        {
          name: "design_inspect_image",
          description: "读取本地参考图的结构化视觉摘要",
          icon: ScanSearch,
          tag: "读图",
          intent: "先理解参考图",
        },
        {
          name: "design_capture_current_view",
          description: "保存当前 BrowserView 截图作为设计候选图",
          icon: Camera,
          tag: "采集",
          intent: "保存当前页面",
        },
        {
          name: "design_compare_current_view",
          description: "当前 BrowserView 与参考图做截图 diff，输出热点区域和 report",
          icon: GitCompare,
          tag: "比对",
          intent: "页面对齐参考图",
        },
        {
          name: "design_compare_images",
          description: "比较两张本地图片并输出 diff、热点区域和 report",
          icon: Image,
          tag: "离线",
          intent: "两张截图互比",
        },
        {
          name: "design_compare_current_view_batch",
          description: "当前 BrowserView 一次性对比多张本地参考图，复用增强 diff 参数",
          icon: GitCompare,
          tag: "批量",
          intent: "多参考图回归",
        },
        {
          name: "design_compare_images_batch",
          description: "批量比较多组本地参考图和候选图，支持独立阈值和忽略区域",
          icon: Image,
          tag: "批量",
          intent: "多截图回归",
        },
        {
          name: "design_read_comparison_report",
          description: "读取历史 JSON report，恢复差异比例、热点区域和验收结论",
          icon: ScanSearch,
          tag: "报告",
          intent: "复查比对结果",
        },
        {
          name: "design_list_artifacts",
          description: "列出最近 current、diff、comparison 和 report 视觉产物",
          icon: Image,
          tag: "历史",
          intent: "找最近产物",
        },
      ],
    },
  ],
  "tech-cc-hub-cron": [
    {
      title: "定时任务",
      tools: [
        { name: "create_scheduled_task", description: "创建持久化定时任务" },
        { name: "list_scheduled_tasks", description: "查看定时任务和执行状态" },
        { name: "delete_scheduled_task", description: "删除指定定时任务" },
      ],
    },
  ],
  "tech-cc-hub-idea": [
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
  "tech-cc-hub-plan": [
    {
      title: "计划进度",
      summary: "兼容 OpenAI Codex update_plan 输入形状，给当前会话输出 Usage 进度清单。",
      tools: [
        { name: "update_plan", description: "用 pending / in_progress / completed 更新当前任务计划。" },
      ],
    },
  ],
};

const BUILTIN_SERVER_META: Record<string, BuiltinServerMeta> = {
  "tech-cc-hub-browser": {
    icon: Activity,
    description: "内置 BrowserView 自动化能力，覆盖导航、读取、交互、截图和诊断。",
    iconClassName: "border-blue-500/15 bg-blue-50 text-blue-700",
    highlights: ["BrowserView", "DOM 读取", "键鼠交互"],
  },
  "tech-cc-hub-admin": {
    icon: Settings,
    description: "应用运行配置管理能力，用于受控调整全局运行时设置。",
    iconClassName: "border-slate-500/15 bg-slate-50 text-slate-700",
    highlights: ["配置", "环境变量", "凭证引用"],
  },
  "tech-cc-hub-design": {
    icon: WandSparkles,
    description: "视觉还原工具链，帮助 Agent 少读大图、先摘要、再截图比照、看热点报告并迭代修 UI。",
    iconClassName: "border-accent/20 bg-accent/8 text-accent",
    highlights: ["结构化摘要", "BrowserView 截图", "Report 回看"],
    workflow: [
      { label: "读参考图", description: "inspect" },
      { label: "截当前页", description: "capture" },
      { label: "做 diff", description: "compare" },
      { label: "看报告", description: "report" },
    ],
  },
  "tech-cc-hub-cron": {
    icon: Timer,
    description: "持久化定时任务能力，用于创建、查看和删除后台计划任务。",
    iconClassName: "border-amber-500/15 bg-amber-50 text-amber-700",
    highlights: ["创建", "列表", "删除"],
  },
  "tech-cc-hub-idea": {
    icon: Code2,
    description: "IntelliJ IDEA 2021-2026 启动与复用能力。优先使用 JetBrains Toolbox 脚本适配热更新启动，再回退到最新安装的 IDEA 启动器。",
    iconClassName: "border-sky-500/15 bg-sky-50 text-sky-700",
    highlights: ["IDEA 2021-2026", "复用已运行 IDE", "前台/就绪检查"],
    workflow: [
      { label: "状态", description: "检测" },
      { label: "解析", description: "启动器" },
      { label: "打开", description: "复用" },
      { label: "就绪", description: "等待/前台" },
    ],
  },
  "tech-cc-hub-plan": {
    icon: ListChecks,
    description: "OpenAI Codex 兼容的 update_plan 计划进度能力，用于在 Usage 中展示本轮任务清单。",
    iconClassName: "border-emerald-500/15 bg-emerald-50 text-emerald-700",
    highlights: ["update_plan", "计划清单", "Codex 兼容"],
  },
};

type ElectronClient = {
  sendClientEvent: (event: unknown) => void;
  onServerEvent: (callback: (event: unknown) => void) => () => void;
};

function getElectron(): ElectronClient | null {
  const e = window.electron as ElectronClient | undefined;
  return e?.onServerEvent ? e : null;
}

export function McpSettingsPage() {
  const [builtin, setBuiltin] = useState<McpServerEntry[]>([]);
  const [external, setExternal] = useState<McpServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<McpTab>("builtin");

  useEffect(() => {
    const electron = getElectron();
    if (!electron) {
      const fallbackTimer = window.setTimeout(() => {
        setError("Electron IPC 未就绪，无法获取 MCP 服务器列表。");
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(fallbackTimer);
    }

    const unsubscribe = electron.onServerEvent((event: unknown) => {
      const evt = event as { type: string; payload?: { builtin?: McpServerInfo[]; external?: McpServerInfo[] } };
      if (evt.type === "mcp.list" && evt.payload) {
        setBuiltin((evt.payload.builtin ?? []).map((s) => ({ ...s, expanded: false })));
        setExternal((evt.payload.external ?? []).map((s) => ({ ...s, expanded: false })));
        setLoading(false);
      }
    });

    electron.sendClientEvent({ type: "mcp.list" });

    // Fallback timeout
    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const toggleExpand = (index: number, isExternal: boolean) => {
    const setter = isExternal ? setExternal : setBuiltin;
    setter((prev) => prev.map((s, i) => i === index ? { ...s, expanded: !s.expanded } : s));
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-ink-600">
          查看当前已加载的 MCP 服务器。内置 MCP 由应用自动提供，外部 MCP 在全局配置的 <code className="rounded bg-surface-secondary px-1 py-0.5 text-xs">mcpServers</code> 中定义。
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <svg aria-hidden="true" className="h-5 w-5 animate-spin text-accent" viewBox="0 0 100 101" fill="none">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
          </svg>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg bg-surface-secondary p-1" role="tablist" aria-label="MCP 服务器类型">
            <McpTabButton
              active={activeTab === "builtin"}
              count={builtin.length}
              label="内置 MCP"
              onClick={() => setActiveTab("builtin")}
            />
            <McpTabButton
              active={activeTab === "external"}
              count={external.length}
              label="外部 MCP"
              onClick={() => setActiveTab("external")}
            />
          </div>

          <section>
            {activeTab === "builtin" ? (
              <div className="space-y-2">
                {builtin.length === 0 ? (
                  <p className="text-sm text-ink-400">无内置 MCP 服务器</p>
                ) : (
                  builtin.map((server, index) => (
                    <ServerCard
                      key={server.name}
                      server={server}
                      onToggle={() => toggleExpand(index, false)}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {external.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-ink-900/10 px-5 py-8 text-center">
                    <p className="text-sm text-ink-400">暂无已配置的外部 MCP 服务器</p>
                    <p className="mt-1 text-xs text-muted">在「全局配置」页面的 <code className="rounded bg-surface-secondary px-1">mcpServers</code> 中添加</p>
                  </div>
                ) : (
                  external.map((server, index) => (
                    <ServerCard
                      key={server.name}
                      server={server}
                      onToggle={() => toggleExpand(index, true)}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function McpTabButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`flex min-h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${active ? "bg-white text-ink-800 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-accent/10 text-accent" : "bg-white/70 text-ink-400"}`}>{count}</span>
    </button>
  );
}

function getBuiltinToolGroups(serverName: string): BuiltinToolGroup[] {
  return BUILTIN_TOOL_GROUPS[serverName] ?? getBuiltinMcpServerDefinition(serverName)?.toolGroups ?? [];
}

function getBuiltinServerMeta(serverName: string): BuiltinServerMeta | undefined {
  return BUILTIN_SERVER_META[serverName] ?? toBuiltinServerMeta(getBuiltinMcpServerDefinition(serverName));
}

function toBuiltinServerMeta(definition: BuiltinMcpServerDefinition | undefined): BuiltinServerMeta | undefined {
  if (!definition) return undefined;
  return {
    icon: BUILTIN_ICON_MAP[definition.iconKey],
    description: definition.description,
    iconClassName: definition.iconClassName,
    highlights: definition.highlights,
    workflow: definition.workflow,
  };
}

function formatExternalServerSummary(server: McpServerInfo): string {
  if (server.transport === "http") {
    return `HTTP · ${server.url ?? "未配置 URL"}`;
  }
  return server.command;
}

function ServerCard({ server, onToggle }: { server: McpServerEntry; onToggle: () => void }) {
  const toolGroups = server.type === "builtin" ? getBuiltinToolGroups(server.name) : [];
  const toolCount = toolGroups.reduce((count, group) => count + group.tools.length, 0);
  const serverMeta = server.type === "builtin" ? getBuiltinServerMeta(server.name) : undefined;
  const ServerIcon = serverMeta?.icon ?? ServerCog;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-soft transition-colors hover:border-ink-900/15">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-100/70"
        onClick={onToggle}
      >
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${serverMeta?.iconClassName ?? "border-ink-900/10 bg-surface-secondary text-ink-500"}`}>
          <ServerIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="block truncate text-sm font-semibold text-ink-800">{server.name}</span>
            {serverMeta?.highlights.map((highlight) => (
              <span key={highlight} className="rounded-full bg-bg-100 px-2 py-0.5 text-[11px] font-medium text-muted">
                {highlight}
              </span>
            ))}
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-400">
            {server.type === "builtin" ? `内置 · 由应用自动提供${toolCount ? ` · ${toolCount} 个工具` : ""}` : formatExternalServerSummary(server)}
          </span>
          {serverMeta?.description && (
            <span className="mt-1 block text-xs leading-5 text-muted">
              {serverMeta.description}
            </span>
          )}
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${server.enabled ? "bg-success/10 text-success" : "bg-surface-secondary text-ink-400"}`}>
          {server.enabled && <CheckCircle2 className="h-3 w-3" />}
          {server.enabled ? "启用" : "禁用"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${server.expanded ? "rotate-180" : ""}`} />
      </button>

      {server.expanded && (
        <div className="border-t border-ink-900/8 px-4 py-3">
          {server.type === "external" && (
            <div className="space-y-2">
              {server.transport === "http" ? (
                <>
                  <DetailRow label="类型" value="http" mono />
                  {server.url && <DetailRow label="URL" value={server.url} mono />}
                </>
              ) : (
                <>
                  <DetailRow label="命令" value={server.command} mono />
                  {server.args.length > 0 && (
                    <DetailRow label="参数" value={server.args.join(" ")} mono />
                  )}
                  {server.envKeys.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-ink-500">环境变量</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {server.envKeys.map((key) => (
                          <code key={key} className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-ink-600">{key}=***</code>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {server.type === "builtin" && (
            <BuiltinToolsPanel serverName={server.name} groups={toolGroups} />
          )}
        </div>
      )}
    </div>
  );
}

function BuiltinToolsPanel({ serverName, groups }: { serverName: string; groups: BuiltinToolGroup[] }) {
  const toolCount = groups.reduce((count, group) => count + group.tools.length, 0);
  const serverMeta = getBuiltinServerMeta(serverName);

  if (groups.length === 0) {
    return (
      <p className="text-xs text-ink-400">
        内置 MCP 服务器由应用自动管理，在 Agent 运行时始终可用。该服务器暂未登记静态工具说明。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-900/8 bg-bg-100 px-3.5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-700">内置运行时能力</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              内置 MCP 服务器由应用自动管理，在 Agent 运行时始终可用。
            </p>
          </div>
          <span className="rounded-full border border-ink-900/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-500">
            {toolCount} tools
          </span>
        </div>
        {serverMeta?.workflow && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {serverMeta.workflow.map((step, index) => (
              <div key={step.label} className="flex min-w-0 items-center gap-2 rounded-lg border border-ink-900/8 bg-white px-2.5 py-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/8 text-[11px] font-bold text-accent">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-ink-700">{step.label}</span>
                  <span className="block truncate text-[11px] text-muted">{step.description}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={`${serverName}-${group.title}`} className="border-t border-ink-900/8 pt-3 first:border-t-0 first:pt-0">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-ink-700">{group.title}</span>
              <span className="text-[11px] text-muted">{group.tools.length}</span>
              {group.summary && (
                <span className="text-[11px] leading-5 text-muted">{group.summary}</span>
              )}
            </div>
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {group.tools.map((tool) => {
                const ToolIcon = tool.icon ?? Wrench;
                return (
                  <div key={tool.name} className="min-w-0 rounded-xl border border-ink-900/8 bg-white px-3 py-2.5 transition-colors hover:border-accent/20 hover:bg-accent-subtle">
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-secondary text-ink-500">
                        <ToolIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <code className="break-all text-[11px] font-semibold leading-4 text-ink-800">{tool.name}</code>
                          {tool.tag && (
                            <span className="rounded-full bg-accent/8 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{tool.tag}</span>
                          )}
                        </span>
                        {tool.intent && (
                          <span className="mt-1 block text-[11px] font-medium text-ink-600">{tool.intent}</span>
                        )}
                        <span className="mt-1 block text-xs leading-5 text-ink-500">{tool.description}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-xs font-medium text-ink-500 w-14">{label}</span>
      {mono ? (
        <code className="min-w-0 break-all rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-ink-700">{value}</code>
      ) : (
        <span className="text-xs text-ink-700">{value}</span>
      )}
    </div>
  );
}

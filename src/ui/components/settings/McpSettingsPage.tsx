import { useEffect, useState } from "react";
import type { McpServerInfo } from "../../types";

type McpServerEntry = McpServerInfo & {
  expanded?: boolean;
};

type BuiltinToolInfo = {
  name: string;
  description: string;
};

type BuiltinToolGroup = {
  title: string;
  tools: BuiltinToolInfo[];
};

type McpTab = "builtin" | "external";

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
      tools: [
        { name: "design_capture_current_view", description: "保存当前 BrowserView 截图作为设计候选图" },
        { name: "design_inspect_image", description: "读取本地参考图的结构化视觉摘要" },
        { name: "design_compare_current_view", description: "当前 BrowserView 与参考图做截图 diff" },
        { name: "design_compare_images", description: "比较两张本地图片并输出 diff 产物" },
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
          查看当前已加载的 MCP 服务器。内置 MCP 由应用自动提供，外部 MCP 在全局配置的 <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">mcpServers</code> 中定义。
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
          <div className="inline-flex rounded-lg bg-ink-100 p-1" role="tablist" aria-label="MCP 服务器类型">
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
                  <div className="rounded-2xl border border-dashed border-ink-200 px-5 py-8 text-center">
                    <p className="text-sm text-ink-400">暂无已配置的外部 MCP 服务器</p>
                    <p className="mt-1 text-xs text-ink-300">在「全局配置」页面的 <code className="rounded bg-ink-100 px-1">mcpServers</code> 中添加</p>
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

function ServerCard({ server, onToggle }: { server: McpServerEntry; onToggle: () => void }) {
  const toolGroups = server.type === "builtin" ? BUILTIN_TOOL_GROUPS[server.name] ?? [] : [];
  const toolCount = toolGroups.reduce((count, group) => count + group.tools.length, 0);

  return (
    <div className="rounded-2xl border border-ink-200 bg-white shadow-soft transition-colors hover:border-ink-300">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold ${server.type === "builtin" ? "border-accent/20 bg-accent/8 text-accent" : "border-ink-200 bg-ink-50 text-ink-500"}`}>
          {server.type === "builtin" ? "B" : "E"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-800">{server.name}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-400">
            {server.type === "builtin" ? `内置 · 由应用自动提供${toolCount ? ` · ${toolCount} 个工具` : ""}` : server.command}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${server.enabled ? "bg-success/10 text-success" : "bg-ink-100 text-ink-400"}`}>
          {server.enabled ? "启用" : "禁用"}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${server.expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {server.expanded && (
        <div className="border-t border-ink-100 px-4 py-3">
          {server.type === "external" && (
            <div className="space-y-2">
              <DetailRow label="命令" value={server.command} mono />
              {server.args.length > 0 && (
                <DetailRow label="参数" value={server.args.join(" ")} mono />
              )}
              {server.envKeys.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-ink-500">环境变量</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {server.envKeys.map((key) => (
                      <code key={key} className="rounded-md bg-ink-50 px-2 py-0.5 text-xs text-ink-600">{key}=***</code>
                    ))}
                  </div>
                </div>
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

  if (groups.length === 0) {
    return (
      <p className="text-xs text-ink-400">
        内置 MCP 服务器由应用自动管理，在 Agent 运行时始终可用。该服务器暂未登记静态工具说明。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-400">
          内置 MCP 服务器由应用自动管理，在 Agent 运行时始终可用。
        </p>
        <span className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-500">
          {toolCount} tools
        </span>
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={`${serverName}-${group.title}`} className="border-t border-ink-100 pt-3 first:border-t-0 first:pt-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-700">{group.title}</span>
              <span className="text-[11px] text-ink-300">{group.tools.length}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {group.tools.map((tool) => (
                <div key={tool.name} className="min-w-0 rounded-lg bg-ink-50 px-3 py-2">
                  <code className="block truncate text-[11px] font-semibold text-ink-700">{tool.name}</code>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{tool.description}</p>
                </div>
              ))}
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
        <code className="min-w-0 break-all rounded-md bg-ink-50 px-2 py-0.5 text-xs text-ink-700">{value}</code>
      ) : (
        <span className="text-xs text-ink-700">{value}</span>
      )}
    </div>
  );
}

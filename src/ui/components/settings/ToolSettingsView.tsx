// Source: CV from skills-manager views/Settings.tsx (agent management section)
// Adapted: Tauri API → Electron IPC, i18n → Chinese
// Not yet wired: path editing, custom agent add/remove, enable/disable all, project path editing
import { useCallback, useMemo, useState } from "react";
import {
  RefreshCw, CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { ToolInfo, Scenario } from "../../types";
import { cn } from "./skill-utils";

const MAINSTREAM_AGENT_KEYS = new Set([
  "claude_code", "cursor", "codex", "gemini_cli", "github_copilot",
  "opencode", "windsurf", "kiro", "antigravity", "amp",
]);

function compactHomePath(path: string) {
  return path
    .replace(/\/Users\/[^/]+/, "~")
    .replace(/\/home\/[^/]+/, "~")
    .replace(/^[A-Za-z]:\\Users\\[^\\]+/, "~");
}

interface Props {
  tools: ToolInfo[];
  scenarios: Scenario[];
  onRefresh: () => void;
}

export function ToolSettingsView({ tools, scenarios: _scenarios, onRefresh }: Props) {
  const [togglingTools, setTogglingTools] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showMoreAgents, setShowMoreAgents] = useState(false);

  const invoke = useCallback(
    <T,>(channel: string, ...args: unknown[]): Promise<T> =>
      (window.electron as typeof window.electron & { invoke: (c: string, ...a: unknown[]) => Promise<T> }).invoke(channel, ...args),
    [],
  );

  // Computed
  const installedTools = useMemo(() => tools.filter((t) => t.installed), [tools]);
  const enabledTools = useMemo(() => tools.filter((t) => t.installed && t.enabled), [tools]);
  const customTools = useMemo(() => tools.filter((t) => t.is_custom), [tools]);
  const builtInTools = useMemo(() => tools.filter((t) => !t.is_custom), [tools]);

  const sortTools = useCallback((items: typeof tools) =>
    [...items].sort((a, b) => {
      const r = Number(b.installed) - Number(a.installed);
      if (r !== 0) return r;
      const r2 = Number(b.enabled) - Number(a.enabled);
      if (r2 !== 0) return r2;
      return a.display_name.localeCompare(b.display_name);
    }), []);

  const displayedBuiltIn = useMemo(() => sortTools(builtInTools), [builtInTools, sortTools]);
  const displayedCustom = useMemo(() => sortTools(customTools), [customTools, sortTools]);

  const mainstreamTools = useMemo(
    () => displayedBuiltIn.filter((t) => MAINSTREAM_AGENT_KEYS.has(t.key)),
    [displayedBuiltIn],
  );
  const secondaryTools = useMemo(
    () => displayedBuiltIn.filter((t) => !MAINSTREAM_AGENT_KEYS.has(t.key)),
    [displayedBuiltIn],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
    toast.success("已刷新");
  };

  const handleToggleTool = async (key: string, enabled: boolean) => {
    setTogglingTools((prev) => new Set(prev).add(key));
    try {
      await invoke("skills:setToolEnabled", key, enabled);
      await onRefresh();
    } catch {
      toast.error("操作失败");
    } finally {
      setTogglingTools((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const renderAgentCard = (agent: ToolInfo) => (
    <div
      key={agent.key}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-md border px-3 py-2.5 transition-colors",
        agent.installed && agent.enabled
          ? "border-[#E5E6EB] bg-white"
          : agent.installed
            ? "border-[#F2F3F5] bg-white"
            : "border-[#F2F3F5] bg-[#F5F6F8]",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {agent.installed ? (
            <button
              onClick={() => handleToggleTool(agent.key, !agent.enabled)}
              disabled={togglingTools.has(agent.key)}
              className="shrink-0 outline-none"
              title={agent.enabled ? "禁用此工具" : "启用此工具"}
            >
              {togglingTools.has(agent.key) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#86909C]" />
              ) : agent.enabled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-amber-500" />
              )}
            </button>
          ) : (
            <Circle className="h-3.5 w-3.5 text-[#C9CDD4]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "truncate text-[13px] font-medium",
              agent.installed ? "text-[#4E5969]" : "text-[#86909C]",
            )}>
              {agent.display_name}
            </h3>
            <span className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              agent.installed
                ? agent.enabled
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
                : "bg-[#F2F3F5] text-[#86909C]",
            )}>
              {agent.installed
                ? agent.enabled ? "已启用" : "已禁用"
                : "未安装"}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {agent.is_custom && (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                自定义
              </span>
            )}
            {agent.has_path_override && !agent.is_custom && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                路径已覆盖
              </span>
            )}
          </div>

          <p className="truncate text-[12px] font-mono leading-tight text-[#86909C]" title={agent.skills_dir}>
            {agent.installed ? compactHomePath(agent.skills_dir) : "未安装"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[#1D2129]">工具配置</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E6EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#86909C] hover:text-[#4E5969] hover:bg-[#F5F6F8] transition-colors outline-none disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          刷新
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#86909C]">
        <span>已检测 <span className="font-medium text-[#4E5969]">{installedTools.length}</span> 个工具</span>
        <span>已启用 <span className="font-medium text-[#4E5969]">{enabledTools.length}</span> 个</span>
        <span>自定义 <span className="font-medium text-[#4E5969]">{customTools.length}</span> 个</span>
      </div>

      {/* Mainstream agents */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-[#4E5969]">内置工具</h3>
          <span className="text-[12px] text-[#86909C]">{mainstreamTools.length}</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {mainstreamTools.map(renderAgentCard)}
        </div>
      </div>

      {/* Secondary agents */}
      {secondaryTools.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowMoreAgents((v) => !v)}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#86909C] transition-colors hover:text-[#4E5969] outline-none"
          >
            {showMoreAgents ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            更多工具 ({secondaryTools.length})
          </button>
          {showMoreAgents && (
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {secondaryTools.map(renderAgentCard)}
            </div>
          )}
        </div>
      )}

      {/* Custom agents */}
      {displayedCustom.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-medium text-[#4E5969]">自定义工具</h3>
            <span className="text-[12px] text-[#86909C]">{displayedCustom.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {displayedCustom.map(renderAgentCard)}
          </div>
        </div>
      )}
    </div>
  );
}

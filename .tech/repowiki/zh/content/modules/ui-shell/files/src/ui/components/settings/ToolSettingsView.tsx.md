# src/ui/components/settings/ToolSettingsView.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：241

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `compactHomePath@16`
- `ToolSettingsView@29`
- `MAINSTREAM_AGENT_KEYS@11`
- `invoke@34`
- `installedTools@42`
- `enabledTools@43`
- `customTools@44`
- `builtInTools@45`
- `sortTools@46`
- `r@49`
- `r2@51`
- `displayedBuiltIn@55`
- `displayedCustom@57`
- `mainstreamTools@58`
- `secondaryTools@63`
- `handleRefresh@67`
- `handleToggleTool@74`
- `next@84`
- `renderAgentCard@90`
- `Props@23`
- `onRefresh@27`

## 依赖输入

- `react`
- `lucide-react`
- `sonner`
- `../../types`
- `./skill-utils`

## 对外暴露

- `ToolSettingsView`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
                <CheckCircle2 className="h-3.5
... (truncated)
```

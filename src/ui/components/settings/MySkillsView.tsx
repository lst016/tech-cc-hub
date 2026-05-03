// Source: CV from skills-manager views/MySkills.tsx
// Adapted: Tauri API → Electron IPC, react-router → props, i18n → Chinese
// Simplified: no Git backup, no drag-and-drop, no detail panel, no tag editing
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, LayoutGrid, List, CheckCircle2, Circle, GitBranch,
  HardDrive, Globe, Layers, RotateCcw,
  Loader2, SquareCheck, Square, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { ManagedSkill, Scenario, ToolInfo } from "../../types";
import { SyncDots } from "./SyncDots";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn } from "./skill-utils";

// Tag color rotation (CV from upstream lib/skillTags.ts)
const TAG_COLORS = [
  "bg-blue-500/15 text-blue-600",
  "bg-emerald-500/15 text-emerald-600",
  "bg-violet-500/15 text-violet-600",
  "bg-amber-500/15 text-amber-600",
  "bg-rose-500/15 text-rose-600",
  "bg-cyan-500/15 text-cyan-600",
  "bg-orange-500/15 text-orange-600",
  "bg-pink-500/15 text-pink-600",
];
const TAG_ACTIVE_COLORS = [
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-violet-500 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-cyan-500 text-white",
  "bg-orange-500 text-white",
  "bg-pink-500 text-white",
];

function getTagColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag);
  return TAG_COLORS[(idx === -1 ? 0 : idx) % TAG_COLORS.length];
}
function getTagActiveColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag);
  return TAG_ACTIVE_COLORS[(idx === -1 ? 0 : idx) % TAG_ACTIVE_COLORS.length];
}

function sourceIcon(type: string) {
  switch (type) {
    case "git": case "skillssh": return <GitBranch className="h-3 w-3" />;
    case "local": case "import": return <HardDrive className="h-3 w-3" />;
    default: return <Globe className="h-3 w-3" />;
  }
}

function sourceTypeLabel(skill: ManagedSkill): string {
  return skill.source_type === "skillssh" ? "skills.sh" : skill.source_type;
}

function canRefresh(skill: ManagedSkill): boolean {
  return skill.source_type === "git" || skill.source_type === "skillssh"
    || ((skill.source_type === "local" || skill.source_type === "import") && !!skill.source_ref);
}

interface Props {
  skills: ManagedSkill[];
  scenarios: Scenario[];
  tools: ToolInfo[];
  onRefresh: () => void;
}

export function MySkillsView({ skills, scenarios, tools, onRefresh }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterMode, setFilterMode] = useState<"all" | "enabled" | "available">("all");
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Multi-select state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);

  const electronApi = window.electron as typeof window.electron & {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };

  const invoke = useCallback(
    <T,>(channel: string, ...args: unknown[]): Promise<T> =>
      electronApi.invoke(channel, ...args) as Promise<T>,
    [electronApi],
  );

  // Active scenario (first one)
  const activeScenario = scenarios[0] ?? null;

  // Fetch all tags
  useEffect(() => {
    invoke<string[]>("skills:getAllTags").then(setAllTags).catch(() => {});
  }, [skills, invoke]);

  // Filtered + sorted skills
  const filtered = useMemo(() => {
    let result = skills.filter((skill) => {
      const matchesSearch = !search
        || skill.name.toLowerCase().includes(search.toLowerCase())
        || (skill.description || "").toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (sourceFilters.size > 0 && !sourceFilters.has(skill.source_type)) return false;
      if (tagFilters.size > 0 && !skill.tags.some((t) => tagFilters.has(t))) return false;
      if (!activeScenario) return true;
      const enabledInScenario = skill.scenario_ids.includes(activeScenario.id);
      if (filterMode === "enabled") return enabledInScenario;
      if (filterMode === "available") return !enabledInScenario;
      return true;
    });
    if (activeScenario) {
      result.sort((a, b) => {
        const aEnabled = a.scenario_ids.includes(activeScenario.id) ? 0 : 1;
        const bEnabled = b.scenario_ids.includes(activeScenario.id) ? 0 : 1;
        if (aEnabled !== bEnabled) return aEnabled - bEnabled;
        return a.name.localeCompare(b.name);
      });
    }
    return result;
  }, [skills, search, sourceFilters, tagFilters, filterMode, activeScenario]);

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const isAllSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const anyDisabled = skills.filter((s) => selectedIds.has(s.id)).some(
    (s) => activeScenario ? !s.scenario_ids.includes(activeScenario.id) : false,
  );
  const anyRefreshableSelected = skills.some((s) => selectedIds.has(s.id) && canRefresh(s));
  const refreshableSelectedCount = skills.filter((s) => selectedIds.has(s.id) && canRefresh(s)).length;

  const handleSelectAll = () => {
    setSelectedIds(isAllSelected ? new Set() : new Set(filtered.map((s) => s.id)));
  };
  const exitMultiSelect = () => {
    setIsMultiSelect(false);
    setSelectedIds(new Set());
  };

  // Toggle filter helper
  const toggleFilter = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  };

  // Status badge
  const statusBadge = (skill: ManagedSkill) => {
    if (skill.update_status === "update_available") {
      return { label: "可更新", className: "bg-amber-500/12 text-amber-600" };
    }
    if (skill.update_status === "source_missing") {
      return { label: "源缺失", className: "bg-red-500/10 text-red-600" };
    }
    if (skill.update_status === "error") {
      return { label: "错误", className: "bg-red-500/10 text-red-600" };
    }
    return null;
  };

  // Single skill delete
  const handleDeleteSkill = useCallback(async (skill: ManagedSkill) => {
    setDeletingIds((prev) => {
      if (prev.has(skill.id)) return prev;
      const next = new Set(prev); next.add(skill.id); return next;
    });
    try {
      await invoke("skills:deleteManagedSkill", skill.id);
      toast.success(`${skill.name} 已删除`);
    } catch (e) {
      toast.error(`删除失败: ${String(e)}`);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev); next.delete(skill.id); return next;
      });
      onRefresh();
    }
  }, [invoke, onRefresh]);

  // Batch delete
  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      const result = await invoke<{ deleted: number; failed: string[] }>("skills:deleteManagedSkills", ids);
      if (result.deleted > 0) toast.success(`已删除 ${result.deleted} 个技能`);
      if (result.failed.length > 0) toast.error(`${result.failed.length} 个删除失败`);
    } catch (e) {
      toast.error(`批量删除失败: ${String(e)}`);
    } finally {
      exitMultiSelect();
      setBatchDeleteConfirm(false);
      onRefresh();
    }
  };

  // Toggle skill in scenario
  const handleToggleScenario = async (skill: ManagedSkill) => {
    if (!activeScenario) return;
    const enabled = skill.scenario_ids.includes(activeScenario.id);
    try {
      if (enabled) {
        await invoke("skills:removeSkillFromScenario", skill.id, activeScenario.id);
        toast.success(`${skill.name} 已在当前场景中禁用`);
      } else {
        await invoke("skills:addSkillToScenario", skill.id, activeScenario.id);
        toast.success(`${skill.name} 已在当前场景中启用`);
      }
      onRefresh();
    } catch (e) {
      toast.error(`操作失败: ${String(e)}`);
    }
  };

  // Batch toggle scenario
  const handleBatchToggleScenario = async () => {
    if (!activeScenario) return;
    const selectedSkills = skills.filter((s) => selectedIds.has(s.id));
    const enabling = anyDisabled;
    let count = 0;
    for (const skill of selectedSkills) {
      try {
        const enabled = skill.scenario_ids.includes(activeScenario.id);
        if (enabling && !enabled) {
          await invoke("skills:addSkillToScenario", skill.id, activeScenario.id);
          count++;
        } else if (!enabling && enabled) {
          await invoke("skills:removeSkillFromScenario", skill.id, activeScenario.id);
          count++;
        }
      } catch { /* continue */ }
    }
    if (count > 0) toast.success(enabling ? `已启用 ${count} 个技能` : `已禁用 ${count} 个技能`);
    onRefresh();
  };

  // Batch refresh
  const handleBatchRefresh = async () => {
    const refreshable = skills.filter((s) => selectedIds.has(s.id) && canRefresh(s));
    if (refreshable.length === 0) return;
    setBatchUpdating(true);
    try {
      const result = await invoke<{ refreshed: number; unchanged: number; failed: string[] }>(
        "skills:batchUpdateSkills", refreshable.map((s) => s.id),
      );
      if (result.refreshed > 0) toast.success(`已更新 ${result.refreshed} 个技能`);
      if (result.unchanged > 0) toast(`${result.unchanged} 个技能已是最新`);
    } catch (e) {
      toast.error(`更新失败: ${String(e)}`);
    } finally {
      setBatchUpdating(false);
      onRefresh();
    }
  };

  // Count for filters
  const enabledCount = useMemo(
    () => activeScenario ? skills.filter((s) => s.scenario_ids.includes(activeScenario.id)).length : skills.length,
    [skills, activeScenario],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-[#1D2129] flex items-center gap-2">
          我的技能
          <span className="inline-flex items-center rounded-full bg-[#F2F3F5] px-2 py-0.5 text-[12px] font-medium text-[#86909C]">
            {skills.length}
          </span>
        </h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#86909C]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能..."
            className="w-full rounded-lg border border-[#E5E6EB] bg-white pl-9 pr-3 py-2 text-[13px] text-[#1D2129] outline-none placeholder:text-[#C9CDD4] focus:border-accent"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-lg border border-[#E5E6EB] bg-[#F5F6F8] p-0.5">
          {([
            ["all", "全部"],
            ["enabled", `已启用 ${enabledCount}`],
            ["available", "可启用"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                filterMode === mode
                  ? "bg-white text-[#1D2129] shadow-sm"
                  : "text-[#86909C] hover:text-[#4E5969]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* View mode + multi-select toggles */}
        <button
          type="button"
          onClick={() => setViewMode("grid")}
          className={cn(
            "rounded-md p-2 transition-colors",
            viewMode === "grid" ? "bg-[#E5E6EB] text-[#4E5969]" : "text-[#86909C] hover:text-[#4E5969]",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "rounded-md p-2 transition-colors",
            viewMode === "list" ? "bg-[#E5E6EB] text-[#4E5969]" : "text-[#86909C] hover:text-[#4E5969]",
          )}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => isMultiSelect ? exitMultiSelect() : setIsMultiSelect(true)}
          className={cn(
            "rounded-md p-2 transition-colors",
            isMultiSelect ? "bg-[#E5E6EB] text-[#4E5969]" : "text-[#86909C] hover:text-[#4E5969]",
          )}
          title={isMultiSelect ? "取消选择" : "多选模式"}
        >
          <SquareCheck className="h-4 w-4" />
        </button>
      </div>

      {/* Source + Tag filters */}
      <div className="flex flex-wrap items-center gap-1">
        {(["local", "import", "git", "skillssh"] as const).map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setSourceFilters(toggleFilter(sourceFilters, src))}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors",
              sourceFilters.has(src)
                ? "bg-accent text-white"
                : "bg-[#F2F3F5] text-[#86909C] hover:text-[#4E5969]",
            )}
          >
            {src === "skillssh" ? "skills.sh" : src}
          </button>
        ))}
        {allTags.length > 0 && (
          <>
            <span className="mx-0.5 h-3 w-px bg-[#E5E6EB]" />
            {allTags.map((tag) => {
              const isActive = tagFilters.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilters(toggleFilter(tagFilters, tag))}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors",
                    isActive ? getTagActiveColor(tag, allTags) : getTagColor(tag, allTags),
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Multi-select toolbar */}
      {isMultiSelect && (
        <div className="flex items-center gap-2 px-1 py-1.5">
          <span className="text-[13px] text-[#86909C]">
            {selectedIds.size > 0 ? `已选 ${selectedIds.size} 项` : "点击选择技能"}
          </span>
          {selectedIds.size > 0 && (
            <>
              {anyRefreshableSelected && (
                <button
                  type="button"
                  onClick={handleBatchRefresh}
                  disabled={batchUpdating}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <RotateCcw className={cn("h-3.5 w-3.5", batchUpdating && "animate-spin")} />
                  更新 {refreshableSelectedCount}
                </button>
              )}
              <button
                type="button"
                onClick={() => setBatchDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600/90 px-2.5 py-1 text-[13px] font-medium text-white hover:bg-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除 {selectedIds.size}
              </button>
              {activeScenario && (
                <button
                  type="button"
                  onClick={handleBatchToggleScenario}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-white",
                    anyDisabled ? "bg-emerald-600/90 hover:bg-emerald-500" : "bg-amber-600/90 hover:bg-amber-500",
                  )}
                >
                  {anyDisabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {anyDisabled ? "启用选中" : "禁用选中"}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleSelectAll}
            className="rounded-md px-2.5 py-1 text-[13px] font-medium text-[#86909C] hover:text-[#4E5969] hover:bg-[#F2F3F5]"
          >
            {isAllSelected ? "取消全选" : "全选"}
          </button>
          <button
            type="button"
            onClick={exitMultiSelect}
            className="rounded-md px-2.5 py-1 text-[13px] font-medium text-[#86909C] hover:text-[#4E5969] hover:bg-[#F2F3F5]"
          >
            取消
          </button>
        </div>
      )}

      {/* Skills grid/list */}
      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-20 pt-10 text-center">
          <Layers className="mb-4 h-12 w-12 text-[#C9CDD4]" />
          <h3 className="mb-1.5 text-[14px] font-semibold text-[#4E5969]">没有找到技能</h3>
          <p className="text-[13px] text-[#86909C]">
              {skills.length === 0 ? "还没有安装任何技能，请前往「发现安装」添加" : "没有匹配当前筛选条件的技能"}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "pb-8",
            viewMode === "grid"
              ? "grid grid-cols-2 gap-3 lg:grid-cols-3"
              : "flex flex-col gap-0.5",
          )}
        >
          {filtered.map((skill) => {
            const isSynced = skill.targets.length > 0;
            const enabledInScenario = activeScenario
              ? skill.scenario_ids.includes(activeScenario.id)
              : false;
            const badge = statusBadge(skill);

            if (viewMode === "grid") {
              return (
                <div
                  key={skill.id}
                  className={cn(
                    "group relative flex h-full flex-col rounded-xl border bg-white transition-all hover:border-[#C9CDD4] hover:bg-[#F5F6F8]",
                    enabledInScenario && "border-l-2 border-l-accent",
                    isMultiSelect && "cursor-pointer",
                    isMultiSelect && selectedIds.has(skill.id) && "ring-1 ring-accent border-accent/40",
                  )}
                  onClick={isMultiSelect ? () => toggleSelect(skill.id) : undefined}
                >
                  {deletingIds.has(skill.id) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                      <Loader2 className="h-5 w-5 animate-spin text-[#86909C]" />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1.5">
                    {isMultiSelect ? (
                      selectedIds.has(skill.id)
                        ? <SquareCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                        : <Square className="h-3.5 w-3.5 shrink-0 text-[#C9CDD4]" />
                    ) : isSynced ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-[#C9CDD4]" />
                    )}
                    <h3 className="flex-1 truncate text-[14px] font-semibold text-[#1D2129]" title={skill.name}>
                      {skill.name}
                    </h3>
                  </div>

                  {/* Body */}
                  <div className="px-3.5 pb-3">
                    <p className="text-[13px] leading-[18px] text-[#86909C] truncate">
                      {skill.description || "—"}
                    </p>
                    {badge && (
                      <div className="mt-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium", badge.className)}>
                          {badge.label}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {skill.tags.map((tag) => (
                        <span
                          key={tag}
                          className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTagColor(tag, allTags))}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#F2F3F5] px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[#86909C]">
                        {sourceIcon(skill.source_type)}
                        {sourceTypeLabel(skill)}
                      </span>
                      {enabledInScenario && activeScenario && (
                        <>
                          <span className="text-[#C9CDD4]">·</span>
                          <span className="truncate text-[12px] font-medium text-amber-600">
                            {activeScenario.name}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SyncDots skill={skill} tools={tools} limit={6} size="sm" />
                      <button
                        type="button"
                        onClick={() => handleToggleScenario(skill)}
                        disabled={!activeScenario}
                        className={cn(
                          "rounded px-2 py-1 text-[12px] font-medium transition-colors outline-none",
                          enabledInScenario
                            ? "text-emerald-600 hover:bg-emerald-500/10"
                            : "text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#4E5969]",
                        )}
                      >
                        {enabledInScenario ? "已启用" : "启用"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // List view
            return (
              <div
                key={skill.id}
                className={cn(
                  "group relative flex items-center gap-3.5 rounded-xl border border-transparent bg-white px-3.5 py-3 transition-all hover:border-[#E5E6EB] hover:bg-[#F5F6F8]",
                  enabledInScenario && "border-l-2 border-l-accent",
                  isMultiSelect && "cursor-pointer",
                  isMultiSelect && selectedIds.has(skill.id) && "ring-1 ring-accent border-accent/40",
                )}
                onClick={isMultiSelect ? () => toggleSelect(skill.id) : undefined}
              >
                {deletingIds.has(skill.id) && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#86909C]" />
                  </div>
                )}
                {isMultiSelect ? (
                  selectedIds.has(skill.id)
                    ? <SquareCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                    : <Square className="h-3.5 w-3.5 shrink-0 text-[#C9CDD4]" />
                ) : isSynced ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-[#C9CDD4]" />
                )}

                <h3 className="w-[180px] shrink-0 truncate text-[14px] font-semibold text-[#4E5969]" title={skill.name}>
                  {skill.name}
                </h3>

                <p className="min-w-0 flex-1 truncate text-[13px] text-[#86909C]">
                  {skill.description || "—"}
                </p>

                <div className="flex shrink-0 items-center gap-1.5">
                  {skill.tags.map((tag) => (
                    <span key={tag} className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium", getTagColor(tag, allTags))}>
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  {badge && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium", badge.className)}>
                      {badge.label}
                    </span>
                  )}
                  <SyncDots skill={skill} tools={tools} limit={6} size="sm" />
                  <span className="inline-flex items-center gap-1 text-[12px] text-[#86909C]">
                    {sourceIcon(skill.source_type)}
                    {sourceTypeLabel(skill)}
                  </span>
                  {enabledInScenario && activeScenario && (
                    <span className="text-[12px] font-medium text-amber-600">{activeScenario.name}</span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleScenario(skill)}
                    disabled={!activeScenario}
                    className={cn(
                      "rounded px-2 py-0.5 text-[12px] font-medium transition-colors outline-none",
                      enabledInScenario
                        ? "text-emerald-600 hover:bg-emerald-500/10"
                        : "text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#4E5969]",
                    )}
                  >
                    {enabledInScenario ? "已启用" : "启用"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSkill(skill)}
                    className="rounded p-0.5 text-[#86909C] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="删除技能"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch delete confirm */}
      <ConfirmDialog
        open={batchDeleteConfirm}
        message={`确定要删除选中的 ${selectedIds.size} 个技能吗？此操作不可撤销。`}
        details={skills.filter((s) => selectedIds.has(s.id)).map((s) => s.name)}
        onClose={() => setBatchDeleteConfirm(false)}
        onConfirm={handleBatchDelete}
      />
    </div>
  );
}

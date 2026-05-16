# src/ui/components/settings/MySkillsView.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：679

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getTagColor@37`
- `getTagActiveColor@42`
- `sourceIcon@46`
- `sourceTypeLabel@54`
- `canRefresh@58`
- `MySkillsView@70`
- `TAG_COLORS@17`
- `TAG_ACTIVE_COLORS@27`
- `idx@39`
- `idx@43`
- `electronApi@85`
- `invoke@89`
- `activeScenario@97`
- `filtered@105`
- `result@106`
- `matchesSearch@107`
- `enabledInScenario@114`
- `aEnabled@121`
- `bEnabled@122`
- `toggleSelect@131`
- `next@133`
- `isAllSelected@138`
- `anyDisabled@139`
- `anyRefreshableSelected@142`
- `refreshableSelectedCount@143`
- `handleSelectAll@144`
- `exitMultiSelect@148`
- `toggleFilter@154`
- `next@155`
- `statusBadge@161`
- `handleDeleteSkill@175`
- `next@178`
- `next@187`
- `handleBatchDelete@194`
- `ids@195`
- `result@197`
- `handleToggleScenario@210`
- `enabled@212`
- `handleBatchToggleScenario@228`
- `selectedSkills@230`

## 依赖输入

- `react`
- `lucide-react`
- `sonner`
- `../../types`
- `./SyncDots`
- `./ConfirmDialog`
- `./skill-utils`

## 对外暴露

- `MySkillsView`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
      if (sourceFilters.size > 0 && !sourceFilters.has(skill.source_t
... (truncated)
```

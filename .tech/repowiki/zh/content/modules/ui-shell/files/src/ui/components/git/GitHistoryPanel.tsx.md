# src/ui/components/git/GitHistoryPanel.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：301

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitHistoryPanel@9`
- `CommitRow@96`
- `ToggleIcon@191`
- `ToolbarIcon@216`
- `Pill@224`
- `buildLaneRanges@236`
- `getActiveLanes@254`
- `buildBranchOptions@261`
- `commitBelongsToBranch@269`
- `normalizeRefs@281`
- `normalizeRefName@289`
- `isTagRef@293`
- `formatRef@297`
- `GRAPH_COLORS@4`
- `GRAPH_LANE_WIDTH@6`
- `GRAPH_LEFT_OFFSET@7`
- `GRAPH_ROW_HEIGHT@8`
- `branchOptions@29`
- `visibleHistory@30`
- `maxLane@37`
- `graphWidth@38`
- `laneRanges@39`
- `refs@114`
- `lane@115`
- `color@116`
- `isMerge@117`
- `message@118`
- `lineColor@131`
- `left@132`
- `ranges@238`
- `lane@242`
- `range@243`
- `names@263`
- `normalizedFilter@271`
- `normalized@277`
- `onBranchFilterChange@24`
- `onSelectCommit@25`
- `onSelectCommit@112`
- `onChange@201`

## 依赖输入

- `lucide-react`
- `react`
- `../../types`

## 对外暴露

- `GitHistoryPanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { ChevronDown, CircleDot, GitBranch, GitMerge, RotateCcw, Tag, Target } from "lucide-react";
import { useMemo, useState } from "react";
import type { UiGitBranch, UiGitCommitNode } from "../../types";

const GRAPH_COLORS = ["#4d91ff", "#f4bf37", "#db4b93", "#22c55e", "#b16cff", "#38bdf8"];
const GRAPH_LANE_WIDTH = 14;
const GRAPH_LEFT_OFFSET = 12;
const GRAPH_ROW_HEIGHT = 28;

export function GitHistoryPanel({
  history,
  branches,
  currentBranch,
  selectedHash,
  branchFilter,
  onBranchFilterChange,
  onSelectCommit,
}: {
  history: UiGitCommitNode[];
  branches: UiGitBranch[];
  currentBranch?: string | null;
  selectedHash: string | null;
  branchFilter: string;
  onBranchFilterChange: (branch: string) => void;
  onSelectCommit: (hash: string) => void;
}) {
  const [showTags, setShowTags] = useState(true);
  const [showMerges, setShowMerges] = useState(true);
  const branchOptions = useMemo(() => buildBranchOptions(branches, currentBranch), [branches, currentBranch]);
  const visibleHistory = useMemo(() => {
    return history
      .filter((commit) => showMerges || commit.parents.length <= 1)
      .filter((commit) => showTags || !commit.refs.some(isTagRef))
      .filter((commit) => branchFilter === "all" || commitBelongsToBranch(commit, branchFilter, currentBranch))
      .slice(0, 120);
  }, [branchFilter, currentBranch, history, showMerges, showTags]);
  const maxLane = visibleHistory.reduce((max, commit) => Math.max(max, commit.graphLane), 0);
  const graphWidth = Math.max(78, GRAPH_LEFT_OFFSET + (maxLane + 2) * GRAPH_LANE_WIDTH);
  const laneRanges = useMemo(() => buildLaneRanges(visibleHistory), [visibleHistory]);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white text-slate-700">
      <div className="flex h-8 shrink-0 items-center border-b border-slate-200 bg-slate-50 px-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
          <ChevronDown className="h-3.5 w-3.5" />
          <span>GRAPH</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{visibleHistory.length}</span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <label className="flex h-6 min-w-0 items-center gap-1 rounded px-1.5 text-[11px] text-slate-700">
            <GitBranch className="h-3.5 w-3.5 text-[#4d91ff]" />
            <select
              value={branchFilter}
              onChange={(event) => onBranchFilterChange(event.target.value)}
              className="max-w-[150px] bg-transparent font-semibold text-slate-800 outline-none"
            >
              <option className="bg-white" value="all">Auto</option>
              {branchOptions.map((branch) => (
                <option className="bg-white" key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </label>
          <ToggleIcon checked={showTags} label="Tags" icon={<Tag className="h-3.5 w-3.5" />} onChange={setShowTags} />
          <ToggleIcon checked={showMerges} label="Merges" icon={<GitMerge className="h-3.5 w-3.5" />} onChange={setShowMerges} />
          <ToolbarIcon title="定位当前分支"><Target className="h-3.5 w-3.5" /></ToolbarIcon>
          <ToolbarIcon title="刷新视图"><RotateCcw className="h-3.5 w-3.5" /></ToolbarIcon>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {visibleHistory.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-xs text-slate-400">
            <GitBranch className="h-6 w-6" />
            <p className="mt-2">没有匹配的提交</p>
          </div>
        ) : (
          <div className="min-w-[620px] py-1">
            {visibleHistory.map((commit, index) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                graphWidth={graphWidth}
                activeLanes={getActiveLanes(laneRanges, index)}
                first={index === 0}
                last={index === visibleHistory.length - 1}
                selected={selectedHash === commit.hash}
... (truncated)
```

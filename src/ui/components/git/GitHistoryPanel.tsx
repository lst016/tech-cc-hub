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
                onSelectCommit={onSelectCommit}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CommitRow({
  commit,
  graphWidth,
  activeLanes,
  first,
  last,
  selected,
  onSelectCommit,
}: {
  commit: UiGitCommitNode;
  graphWidth: number;
  activeLanes: number[];
  first: boolean;
  last: boolean;
  selected: boolean;
  onSelectCommit: (hash: string) => void;
}) {
  const refs = normalizeRefs(commit.refs);
  const lane = Math.max(0, commit.graphLane);
  const color = GRAPH_COLORS[lane % GRAPH_COLORS.length] ?? GRAPH_COLORS[0];
  const isMerge = commit.parents.length > 1;
  const message = commit.message || "(no message)";

  return (
    <button
      type="button"
      onClick={() => onSelectCommit(commit.hash)}
      className={`group flex w-full items-center text-left text-[13px] leading-none outline-none ${
        selected ? "bg-blue-50" : "bg-transparent hover:bg-slate-50"
      }`}
      style={{ height: GRAPH_ROW_HEIGHT }}
    >
      <div className="relative h-full shrink-0" style={{ width: graphWidth }}>
        {activeLanes.map((lineLane) => {
          const lineColor = GRAPH_COLORS[lineLane % GRAPH_COLORS.length] ?? GRAPH_COLORS[0];
          const left = GRAPH_LEFT_OFFSET + lineLane * GRAPH_LANE_WIDTH;
          return (
            <span
              key={lineLane}
              className="absolute w-0.5 rounded-full"
              style={{
                backgroundColor: lineColor,
                bottom: last ? GRAPH_ROW_HEIGHT / 2 : 0,
                left,
                top: first ? GRAPH_ROW_HEIGHT / 2 : 0,
              }}
            />
          );
        })}
        {lane > 0 && (
          <span
            className="absolute h-0.5 rounded-full"
            style={{
              backgroundColor: color,
              left: GRAPH_LEFT_OFFSET,
              top: GRAPH_ROW_HEIGHT / 2 - 1,
              width: lane * GRAPH_LANE_WIDTH,
            }}
          />
        )}
        <span
          className="absolute flex items-center justify-center rounded-full border-2 bg-white"
          style={{
            borderColor: color,
            color,
            height: isMerge ? 13 : 12,
            left: GRAPH_LEFT_OFFSET + lane * GRAPH_LANE_WIDTH - 6,
            top: GRAPH_ROW_HEIGHT / 2 - 6,
            width: isMerge ? 13 : 12,
          }}
        >
          {isMerge && <CircleDot className="h-2.5 w-2.5" />}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
        <span className={`min-w-0 truncate font-semibold ${selected ? "text-slate-950" : "text-slate-800"}`} title={message}>
          {message}
        </span>
        {refs.slice(0, 2).map((ref) => (
          <Pill
            key={ref}
            color={isTagRef(ref) ? "#6d28d9" : "#075985"}
            background={isTagRef(ref) ? "#ede9fe" : "#dbeafe"}
            label={formatRef(ref)}
          />
        ))}
        <span className="shrink-0 truncate text-[12px] text-slate-500" title={commit.authorName}>
          {commit.authorName || "-"}
        </span>
      </div>
    </button>
  );
}

function ToggleIcon({
  checked,
  label,
  icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  icon?: React.ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] hover:bg-slate-100 ${checked ? "text-slate-700" : "text-slate-400"}`}
      title={label}
      aria-pressed={checked}
    >
      {icon ?? <CircleDot className="h-3.5 w-3.5" />}
      {label === "Auto" && <span>Auto</span>}
    </button>
  );
}

function ToolbarIcon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={title}>
      {children}
    </button>
  );
}

function Pill({ color, background, label }: { color: string; background: string; label: string }) {
  return (
    <span
      className="inline-flex max-w-36 shrink-0 items-center truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none"
      style={{ background, color }}
      title={label}
    >
      {label}
    </span>
  );
}

function buildLaneRanges(commits: UiGitCommitNode[]) {
  const ranges = new Map<number, { start: number; end: number }>();
  ranges.set(0, { start: 0, end: Math.max(0, commits.length - 1) });

  commits.forEach((commit, index) => {
    const lane = Math.max(0, commit.graphLane);
    const range = ranges.get(lane);
    if (!range) {
      ranges.set(lane, { start: index, end: index });
      return;
    }
    range.start = Math.min(range.start, index);
    range.end = Math.max(range.end, index);
  });

  return ranges;
}

function getActiveLanes(ranges: Map<number, { start: number; end: number }>, rowIndex: number) {
  return Array.from(ranges.entries())
    .filter(([, range]) => rowIndex >= range.start && rowIndex <= range.end)
    .map(([lane]) => lane)
    .sort((a, b) => a - b);
}

function buildBranchOptions(branches: UiGitBranch[], currentBranch?: string | null) {
  const names = branches
    .map((branch) => branch.name.replace(/^origin\//, "origin/"))
    .filter((name) => name !== "origin/HEAD");
  if (currentBranch) names.unshift(currentBranch);
  return Array.from(new Set(names));
}

function commitBelongsToBranch(commit: UiGitCommitNode, branchFilter: string, currentBranch?: string | null) {
  const normalizedFilter = branchFilter.replace(/^origin\//, "");
  if (commit.branches.some((branch) => branch === branchFilter || branch.replace(/^origin\//, "") === normalizedFilter)) return true;
  if (currentBranch && branchFilter === currentBranch) {
    return commit.refs.some((ref) => normalizeRefName(ref) === currentBranch);
  }
  return commit.refs.some((ref) => {
    const normalized = normalizeRefName(ref);
    return normalized === branchFilter || normalized === normalizedFilter;
  });
}

function normalizeRefs(refs: string[]) {
  return refs
    .map((ref) => ref.trim())
    .filter(Boolean)
    .map((ref) => ref.replace(/^HEAD ->\s*/, ""))
    .filter((ref) => ref !== "HEAD" && ref !== "origin/HEAD");
}

function normalizeRefName(ref: string) {
  return ref.replace(/^HEAD ->\s*/, "").replace(/^tag:\s*/, "").trim();
}

function isTagRef(ref: string) {
  return ref.startsWith("tag: ");
}

function formatRef(ref: string) {
  return ref.replace(/^tag:\s*/, "");
}

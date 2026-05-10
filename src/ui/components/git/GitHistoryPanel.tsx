import {
  Gitgraph,
  MergeStyle,
  TemplateName,
  templateExtend,
  type CommitOptions,
} from "@gitgraph/react";
import { GitBranch, Search } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import type { UiGitBranch, UiGitCommitNode } from "../../types";
import { formatRelativeTime } from "./git-ui-utils";

const GRAPH_MESSAGE_WIDTH = 620;
const GRAPH_MESSAGE_HEIGHT = 54;

const gitgraphTemplate = templateExtend(TemplateName.Metro, {
  colors: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#7c3aed", "#0891b2"],
  branch: {
    lineWidth: 2,
    spacing: 16,
    mergeStyle: MergeStyle.Bezier,
    label: { display: false },
  },
  commit: {
    spacing: 58,
    dot: {
      size: 5,
      strokeWidth: 3,
      strokeColor: "#ffffff",
    },
    message: {
      display: true,
      displayAuthor: false,
      displayHash: false,
      color: "#0f172a",
      font: "600 12px Inter, ui-sans-serif, system-ui, sans-serif",
    },
  },
  tag: {
    bgColor: "#dcfce7",
    borderRadius: 8,
    color: "#047857",
    font: "600 10px Inter, ui-sans-serif, system-ui, sans-serif",
    pointerWidth: 6,
    strokeColor: "#86efac",
  },
});

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
  const [query, setQuery] = useState("");
  const [showTags, setShowTags] = useState(true);
  const [showMerges, setShowMerges] = useState(true);
  const branchOptions = useMemo(() => buildBranchOptions(branches, currentBranch), [branches, currentBranch]);
  const visibleHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return history
      .filter((commit) => showMerges || commit.parents.length <= 1)
      .filter((commit) => showTags || !commit.refs.some(isTagRef))
      .filter((commit) => branchFilter === "all" || commitBelongsToBranch(commit, branchFilter, currentBranch))
      .filter((commit) => {
        if (!normalizedQuery) return true;
        return [
          commit.message,
          commit.shortHash,
          commit.hash,
          commit.authorName,
          ...commit.refs,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .slice(0, 120);
  }, [branchFilter, currentBranch, history, query, showMerges, showTags]);
  const graphData = visibleHistory.map((commit) => toGitgraphCommit(commit, selectedHash, onSelectCommit));
  const graphKey = `${branchFilter}:${showTags}:${showMerges}:${graphData.map((commit) => commit.hash).join(":")}:${selectedHash ?? ""}`;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex h-8 min-w-[160px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="shrink-0 text-slate-500">分支筛选</span>
            <select
              value={branchFilter}
              onChange={(event) => onBranchFilterChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent font-semibold text-slate-900 outline-none"
            >
              <option value="all">全部分支</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </label>

          <Toggle
            checked={branchFilter === "all"}
            label="All branches"
            onChange={(checked) => onBranchFilterChange(checked ? "all" : currentBranch || branchOptions[0] || "all")}
          />
          <Toggle checked={showTags} label="Tags" onChange={setShowTags} />
          <Toggle checked={showMerges} label="Merges" onChange={setShowMerges} />

          <label className="ml-auto flex h-8 min-w-[170px] flex-1 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-500 focus-within:border-blue-300 focus-within:bg-white">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="搜索提交"
            />
          </label>
        </div>
      </div>

      <div className="grid h-8 shrink-0 grid-cols-[92px_minmax(300px,1fr)_96px_86px_72px] items-center border-b border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-500">
        <span>图谱</span>
        <span>提交信息</span>
        <span>作者</span>
        <span>时间</span>
        <span>提交哈希</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white px-3 py-2">
        {graphData.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center text-xs text-slate-400">
            <GitBranch className="h-6 w-6" />
            <p className="mt-2">没有匹配的提交</p>
          </div>
        ) : (
          <div className="gitgraph-history min-w-[760px]">
            <Gitgraph
              key={graphKey}
              options={{
                template: gitgraphTemplate,
                initCommitOffsetX: 12,
                initCommitOffsetY: 18,
              }}
            >
              {(gitgraph) => {
                gitgraph.import(graphData);
              }}
            </Gitgraph>
          </div>
        )}
      </div>
    </section>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-xs text-slate-700 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
      />
      {label}
    </label>
  );
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

function toGitgraphCommit(commit: UiGitCommitNode, selectedHash: string | null, onSelectCommit: (hash: string) => void) {
  const refs = normalizeRefs(commit.refs);
  return {
    hash: commit.hash,
    parents: commit.parents,
    author: {
      name: commit.authorName || "unknown",
      email: commit.authorEmail || "",
      timestamp: new Date(commit.committedAt).getTime(),
    },
    refs,
    subject: commit.message || "(no message)",
    body: "",
    renderMessage: renderCommitMessage(commit, refs, selectedHash === commit.hash, onSelectCommit),
  };
}

function renderCommitMessage(
  commit: UiGitCommitNode,
  refs: string[],
  selected: boolean,
  onSelectCommit: (hash: string) => void,
): CommitOptions["renderMessage"] {
  return () => (
    <foreignObject x="8" y="-22" width={GRAPH_MESSAGE_WIDTH} height={GRAPH_MESSAGE_HEIGHT}>
      <div
        onClick={() => onSelectCommit(commit.hash)}
        style={{
          background: selected ? "#eff6ff" : "transparent",
          border: selected ? "1px solid #bfdbfe" : "1px solid transparent",
          borderRadius: 6,
          boxSizing: "border-box",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) 88px 72px 66px",
          height: "100%",
          overflow: "hidden",
          padding: "6px 8px",
          width: "100%",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#0f172a",
              fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: "16px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={commit.message}
          >
            {commit.message || "(no message)"}
          </div>
          {refs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, overflow: "hidden" }}>
              {refs.slice(0, 3).map((ref) => (
                <Pill
                  key={ref}
                  color={isTagRef(ref) ? "#047857" : "#0369a1"}
                  background={isTagRef(ref) ? "#dcfce7" : "#e0f2fe"}
                  label={formatRef(ref)}
                />
              ))}
            </div>
          )}
        </div>
        <Cell>{commit.authorName || "-"}</Cell>
        <Cell>{formatRelativeTime(commit.committedAt)}</Cell>
        <Cell mono>{commit.shortHash}</Cell>
      </div>
    </foreignObject>
  ) as ReactElement<SVGElement>;
}

function Cell({ children, mono }: { children: string; mono?: boolean }) {
  return (
    <div
      style={{
        alignItems: "center",
        color: "#64748b",
        display: "flex",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
        minWidth: 0,
        overflow: "hidden",
        paddingLeft: 8,
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={children}
    >
      {children}
    </div>
  );
}

function Pill({ color, background, label }: { color: string; background: string; label: string }) {
  return (
    <span
      style={{
        background,
        borderRadius: 999,
        color,
        display: "inline-flex",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: "13px",
        maxWidth: 160,
        overflow: "hidden",
        padding: "1px 6px",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      {label}
    </span>
  );
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

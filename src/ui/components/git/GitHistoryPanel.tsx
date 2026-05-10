import { GitGraph } from "lucide-react";
import type { UiGitCommitNode } from "../../types";
import { formatRelativeTime } from "./git-ui-utils";

export function GitHistoryPanel({ history }: { history: UiGitCommitNode[] }) {
  return (
    <section className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">History</p>
          <h3 className="text-sm font-semibold text-slate-950">提交历史</h3>
        </div>
        <GitGraph className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto">
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
            暂无提交历史
          </p>
        ) : (
          <div className="space-y-1.5">
            {history.slice(0, 40).map((commit) => (
              <div key={commit.hash} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-xl border border-transparent px-2 py-2 hover:border-slate-200 hover:bg-slate-50">
                <div className="flex justify-center pt-1">
                  <span
                    className="inline-flex h-3 w-3 rounded-full border-2 border-white bg-slate-800 shadow"
                    style={{ marginLeft: Math.min(commit.graphLane, 4) * 4 }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-800" title={commit.message}>{commit.message}</div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-mono">{commit.shortHash}</span>
                    <span className="truncate">{commit.authorName}</span>
                    <span className="shrink-0">{formatRelativeTime(commit.committedAt)}</span>
                  </div>
                  {commit.refs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {commit.refs.slice(0, 3).map((ref) => (
                        <span key={ref} className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

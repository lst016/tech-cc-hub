import { GitBranch, RefreshCw } from "lucide-react";
import type { UiGitWorkbenchSnapshot } from "../../types";
import { formatAheadBehind, repoDisplayName } from "./git-ui-utils";

export function GitStatusHeader({
  snapshot,
  loading,
  actionBusy,
  onRefresh,
}: {
  snapshot: UiGitWorkbenchSnapshot | null;
  loading: boolean;
  actionBusy: string | null;
  onRefresh: () => void;
}) {
  const status = snapshot?.status ?? null;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <GitBranch className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-950">{repoDisplayName(status)}</h2>
              <p className="truncate text-[11px] text-slate-500">{status?.repoRoot || "未连接 Git 仓库"}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || Boolean(actionBusy)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          title="刷新 Git 状态"
          aria-label="刷新 Git 状态"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="text-slate-400">分支</div>
          <div className="mt-0.5 truncate font-semibold text-slate-800" title={status?.currentBranch ?? ""}>
            {status?.currentBranch ?? "-"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="text-slate-400">远端</div>
          <div className="mt-0.5 truncate font-semibold text-slate-800">{formatAheadBehind(status)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="text-slate-400">改动</div>
          <div className="mt-0.5 font-semibold text-slate-800">{status?.changedCount ?? 0}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="text-slate-400">暂存</div>
          <div className="mt-0.5 font-semibold text-slate-800">{status?.stagedCount ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

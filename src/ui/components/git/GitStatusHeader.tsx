import { ChevronDown, Download, GitBranch, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
import type { UiGitWorkbenchSnapshot } from "../../types";
import { formatAheadBehind, repoDisplayName } from "./git-ui-utils";

type MaybePromise<T> = T | Promise<T>;

export function GitStatusHeader({
  snapshot,
  loading,
  actionBusy,
  onRefresh,
  onPull,
  onPush,
  onCheckoutBranch,
}: {
  snapshot: UiGitWorkbenchSnapshot | null;
  loading: boolean;
  actionBusy: string | null;
  onRefresh: () => void;
  onPull: () => MaybePromise<unknown>;
  onPush: () => MaybePromise<unknown>;
  onCheckoutBranch: (name: string) => MaybePromise<unknown>;
}) {
  const status = snapshot?.status ?? null;
  const branchNames = Array.from(new Set((snapshot?.branches ?? [])
    .filter((branch) => !branch.remote)
    .map((branch) => branch.name)));
  const currentBranch = status?.currentBranch ?? "";
  const busyPull = actionBusy === "pull";
  const busyPush = actionBusy === "push";

  if (currentBranch && !branchNames.includes(currentBranch)) {
    branchNames.unshift(currentBranch);
  }

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <label className="relative flex h-8 min-w-0 flex-[1.3] items-center rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <GitBranch className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <select
            value={status?.repoRoot ?? ""}
            disabled
            className="min-w-0 flex-1 appearance-none truncate bg-transparent pr-5 font-semibold outline-none disabled:text-slate-800"
            title={status?.repoRoot ?? ""}
          >
            <option>{repoDisplayName(status)}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
        </label>

        <label className="relative flex h-8 min-w-[128px] flex-1 items-center rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <GitBranch className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <select
            value={currentBranch}
            disabled={!snapshot || Boolean(actionBusy)}
            onChange={(event) => onCheckoutBranch(event.target.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent pr-5 font-semibold outline-none disabled:text-slate-500"
            title="切换分支"
          >
            {!currentBranch && <option value="">无分支</option>}
            {branchNames.map((branch) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
        </label>

        <div className="hidden h-8 items-center gap-2 rounded-md border border-transparent px-2 text-xs text-slate-500 min-[860px]:flex">
          <span className="font-semibold text-slate-700">{formatAheadBehind(status)}</span>
          {status?.upstream && <span className="truncate">{status.upstream}</span>}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || Boolean(actionBusy)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="刷新 Git 状态"
            aria-label="刷新 Git 状态"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onPull}
            disabled={!snapshot || Boolean(actionBusy)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className={`h-3.5 w-3.5 ${busyPull ? "animate-pulse" : ""}`} />
            拉取
          </button>
          <button
            type="button"
            onClick={onPush}
            disabled={!snapshot || Boolean(actionBusy)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Upload className={`h-3.5 w-3.5 ${busyPush ? "animate-pulse" : ""}`} />
            推送{status?.ahead ? ` ${status.ahead}` : ""}
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400"
            title="更多 Git 操作"
            aria-label="更多 Git 操作"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

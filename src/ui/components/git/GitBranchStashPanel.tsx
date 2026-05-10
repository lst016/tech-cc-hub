import { Archive, GitBranch, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { UiGitBranch, UiGitStashEntry } from "../../types";

export function GitBranchStashPanel({
  branches,
  stashes,
  currentBranch,
  actionBusy,
  onCreateBranch,
  onCheckoutBranch,
  onStashSave,
  onStashApply,
  onStashDrop,
}: {
  branches: UiGitBranch[];
  stashes: UiGitStashEntry[];
  currentBranch?: string | null;
  actionBusy: string | null;
  onCreateBranch: (name: string, checkout: boolean) => void;
  onCheckoutBranch: (name: string) => void;
  onStashSave: (message?: string) => void;
  onStashApply: (ref: string) => void;
  onStashDrop: (ref: string) => void;
}) {
  const [branchName, setBranchName] = useState("");
  const [stashMessage, setStashMessage] = useState("");
  const localBranches = useMemo(() => branches.filter((branch) => !branch.remote), [branches]);
  const disabled = Boolean(actionBusy);

  return (
    <section className="bg-white px-4 py-3">
      <div className="grid gap-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Branches</p>
              <h3 className="text-sm font-semibold text-slate-950">分支</h3>
            </div>
            <GitBranch className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              placeholder="new-branch"
            />
            <button
              type="button"
              disabled={disabled || !branchName.trim()}
              onClick={() => {
                onCreateBranch(branchName, true);
                setBranchName("");
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white disabled:bg-slate-200 disabled:text-slate-400"
              title="创建并切换分支"
              aria-label="创建并切换分支"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200">
            {localBranches.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-400">暂无本地分支</div>
            ) : localBranches.map((branch) => {
              const current = branch.name === currentBranch || branch.current;
              return (
                <button
                  key={branch.name}
                  type="button"
                  disabled={disabled || current}
                  onClick={() => onCheckoutBranch(branch.name)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 ${
                    current ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-600 hover:bg-slate-50"
                  } disabled:cursor-default`}
                >
                  <span className="truncate">{branch.name}</span>
                  {current && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">当前</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Stash</p>
              <h3 className="text-sm font-semibold text-slate-950">暂存栈</h3>
            </div>
            <Archive className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={stashMessage}
              onChange={(event) => setStashMessage(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              placeholder="stash message"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onStashSave(stashMessage);
                setStashMessage("");
              }}
              className="h-9 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200">
            {stashes.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-400">暂无 stash</div>
            ) : stashes.map((stash) => (
              <div key={stash.ref} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-slate-400">{stash.ref}</div>
                    <div className="mt-0.5 truncate text-xs font-medium text-slate-700" title={stash.message}>
                      {stash.message || "stash"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onStashApply(stash.ref)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onStashDrop(stash.ref)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="删除 stash"
                      aria-label="删除 stash"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

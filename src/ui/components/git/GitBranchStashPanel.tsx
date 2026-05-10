import { Archive, GitBranch, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { UiGitBranch, UiGitStashEntry } from "../../types";

type BranchStashMode = "branches" | "stashes";

export function GitBranchStashPanel({
  branches,
  stashes,
  currentBranch,
  actionBusy,
  initialMode = "branches",
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
  initialMode?: BranchStashMode;
  onCreateBranch: (name: string, checkout: boolean) => void;
  onCheckoutBranch: (name: string) => void;
  onStashSave: (message?: string) => void;
  onStashApply: (ref: string) => void;
  onStashDrop: (ref: string) => void;
}) {
  const [mode, setMode] = useState<BranchStashMode>(initialMode);
  const [branchName, setBranchName] = useState("");
  const [stashMessage, setStashMessage] = useState("");
  const localBranches = useMemo(() => branches.filter((branch) => !branch.remote), [branches]);
  const remoteBranches = useMemo(() => branches.filter((branch) => branch.remote), [branches]);
  const disabled = Boolean(actionBusy);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex h-10 shrink-0 items-center gap-4 border-b border-slate-200 px-3">
        <button
          type="button"
          onClick={() => setMode("branches")}
          className={`h-10 border-b-2 px-1 text-xs font-semibold ${mode === "branches" ? "border-blue-600 text-slate-950" : "border-transparent text-slate-500"}`}
        >
          分支 ({localBranches.length})
        </button>
        <button
          type="button"
          onClick={() => setMode("stashes")}
          className={`h-10 border-b-2 px-1 text-xs font-semibold ${mode === "stashes" ? "border-blue-600 text-slate-950" : "border-transparent text-slate-500"}`}
        >
          暂存 ({stashes.length})
        </button>
      </div>

      {mode === "branches" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <input
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300"
              placeholder="new-branch"
            />
            <button
              type="button"
              disabled={disabled || !branchName.trim()}
              onClick={() => {
                onCreateBranch(branchName, true);
                setBranchName("");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </button>
          </div>
          <BranchGroup
            title="本地分支"
            branches={localBranches}
            currentBranch={currentBranch}
            disabled={disabled}
            onCheckoutBranch={onCheckoutBranch}
          />
          <BranchGroup
            title="远端分支"
            branches={remoteBranches}
            currentBranch={currentBranch}
            disabled={disabled}
            onCheckoutBranch={onCheckoutBranch}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <input
              value={stashMessage}
              onChange={(event) => setStashMessage(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300"
              placeholder="stash message"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onStashSave(stashMessage);
                setStashMessage("");
              }}
              className="h-8 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <div className="rounded-md border border-slate-200">
            {stashes.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-slate-400">暂无 stash</div>
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
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onStashDrop(stash.ref)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
      )}
    </section>
  );
}

function BranchGroup({
  title,
  branches,
  currentBranch,
  disabled,
  onCheckoutBranch,
}: {
  title: string;
  branches: UiGitBranch[];
  currentBranch?: string | null;
  disabled: boolean;
  onCheckoutBranch: (name: string) => void;
}) {
  return (
    <section className="mb-4">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
        {title === "本地分支" ? <GitBranch className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        {title} ({branches.length})
      </div>
      <div className="rounded-md border border-slate-200">
        {branches.length === 0 ? (
          <div className="px-3 py-5 text-center text-xs text-slate-400">暂无{title}</div>
        ) : branches.map((branch) => {
          const current = branch.name === currentBranch || branch.current;
          return (
            <button
              key={branch.name}
              type="button"
              disabled={disabled || current}
              onClick={() => onCheckoutBranch(branch.name)}
              className={`flex h-8 w-full items-center justify-between gap-2 border-b border-slate-100 px-3 text-left text-xs last:border-b-0 ${
                current ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-600 hover:bg-slate-50"
              } disabled:cursor-default`}
            >
              <span className="truncate">{branch.name}</span>
              {current && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-blue-700">当前</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

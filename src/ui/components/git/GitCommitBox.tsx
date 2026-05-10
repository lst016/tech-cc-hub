import { GitCommitHorizontal, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import type { UiGitWorkbenchSnapshot } from "../../types";

export function GitCommitBox({
  snapshot,
  actionBusy,
  onCommit,
  onPush,
}: {
  snapshot: UiGitWorkbenchSnapshot | null;
  actionBusy: string | null;
  onCommit: (message: string, body?: string) => void;
  onPush: () => void;
}) {
  const [message, setMessage] = useState("");
  const [body, setBody] = useState("");
  const stagedCount = snapshot?.status.stagedCount ?? 0;
  const ahead = snapshot?.status.ahead ?? 0;
  const canCommit = stagedCount > 0 && message.trim().length > 0 && !actionBusy;
  const busyCommit = actionBusy === "commit";
  const busyPush = actionBusy === "push";

  return (
    <section className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Commit</p>
          <h3 className="text-sm font-semibold text-slate-950">提交</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          {stagedCount} staged
        </span>
      </div>

      <input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
        placeholder="Summary"
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-2 h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
        placeholder="Description"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canCommit}
          onClick={() => {
            onCommit(message, body);
            setMessage("");
            setBody("");
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busyCommit ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommitHorizontal className="h-4 w-4" />}
          Commit
        </button>
        <button
          type="button"
          disabled={Boolean(actionBusy)}
          onClick={onPush}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busyPush ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Push {ahead > 0 ? ahead : ""}
        </button>
      </div>
    </section>
  );
}

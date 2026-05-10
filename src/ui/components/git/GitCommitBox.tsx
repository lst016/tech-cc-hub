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
    <section className="shrink-0 border-t border-slate-200 bg-white">
      <div className="flex h-9 items-center gap-4 border-b border-slate-200 px-3">
        <button type="button" className="h-9 border-b-2 border-blue-600 px-1 text-xs font-semibold text-slate-950">
          提交
        </button>
        <div className="text-xs text-slate-500">暂存的改动 ({stagedCount})</div>
        <div className="ml-auto text-[11px] text-slate-400">提交前请先在左侧选择文件暂存</div>
      </div>

      <div className="grid gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            value={message}
            maxLength={72}
            onChange={(event) => setMessage(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300"
            placeholder="提交摘要"
          />
          <span className="w-10 text-right text-[10px] text-slate-400">{message.length}/72</span>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="h-14 w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs leading-4 text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
          placeholder="详细描述（可选）"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!canCommit}
            onClick={() => {
              onCommit(message, body);
              setMessage("");
              setBody("");
            }}
            className="inline-flex h-8 min-w-28 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {busyCommit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommitHorizontal className="h-3.5 w-3.5" />}
            提交 ({stagedCount})
          </button>
          <button
            type="button"
            disabled={Boolean(actionBusy)}
            onClick={onPush}
            className="inline-flex h-8 min-w-28 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busyPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            推送{ahead > 0 ? ` ${ahead}` : ""}
          </button>
        </div>
      </div>
    </section>
  );
}

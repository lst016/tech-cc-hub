import { GitCommitHorizontal, Loader2, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { UiGitCommitMessageSuggestion, UiGitWorkbenchSnapshot } from "../../types";

type MaybePromise<T> = T | Promise<T>;

export function GitCommitBox({
  snapshot,
  actionBusy,
  onCommit,
  onGenerateMessage,
  onGenerateMessageRefined,
  onPush,
  compact = false,
}: {
  snapshot: UiGitWorkbenchSnapshot | null;
  actionBusy: string | null;
  onCommit: (message: string, body?: string) => MaybePromise<boolean | void>;
  onGenerateMessage?: () => Promise<UiGitCommitMessageSuggestion | null>;
  onGenerateMessageRefined?: () => Promise<UiGitCommitMessageSuggestion | null>;
  onPush: () => MaybePromise<boolean | void>;
  compact?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [body, setBody] = useState("");
  const [refiningMessage, setRefiningMessage] = useState(false);
  const messageRef = useRef(message);
  const bodyRef = useRef(body);
  const stagedCount = snapshot?.status.stagedCount ?? 0;
  const ahead = snapshot?.status.ahead ?? 0;
  const canCommit = stagedCount > 0 && message.trim().length > 0 && !actionBusy;
  const canCommitAndPush = canCommit;
  const canPushAhead = stagedCount === 0 && ahead > 0 && !actionBusy;
  const canGenerate = stagedCount > 0 && !actionBusy && !refiningMessage && Boolean(onGenerateMessage);
  const busyCommit = actionBusy === "commit";
  const busyGenerate = actionBusy === "generateCommitMessage";
  const busyPush = actionBusy === "push";
  const pushLabel = stagedCount > 0 ? "提交并推送" : `推送${ahead > 0 ? ` ${ahead}` : ""}`;

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  const handleGenerateMessage = async () => {
    if (!onGenerateMessage || !canGenerate) return;
    const suggestion = await onGenerateMessage();
    if (!suggestion) {
      toast.error("生成提交信息失败。");
      return;
    }

    setMessage(suggestion.message);
    setBody(suggestion.body ?? "");
    messageRef.current = suggestion.message;
    bodyRef.current = suggestion.body ?? "";
    toast.success("已先填写本地提交摘要。", {
      description: onGenerateMessageRefined
        ? "AI 正在后台精修，完成后会自动替换。"
        : "已按暂存文件生成中文摘要。",
    });

    if (!onGenerateMessageRefined) return;

    const fastMessage = suggestion.message;
    const fastBody = suggestion.body ?? "";
    setRefiningMessage(true);
    try {
      const refined = await onGenerateMessageRefined();
      if (!refined) return;
      if (messageRef.current !== fastMessage || bodyRef.current !== fastBody) {
        toast.info("AI 精修已完成，已保留你手动修改的内容。");
        return;
      }

      setMessage(refined.message);
      setBody(refined.body ?? "");
      messageRef.current = refined.message;
      bodyRef.current = refined.body ?? "";
      toast.success("已用 AI 精修提交信息。", {
        description: `已根据暂存区 diff 生成中文摘要${refined.model ? ` · ${refined.model}` : ""}。`,
      });
    } finally {
      setRefiningMessage(false);
    }
  };

  const clearCommitDraft = () => {
    setMessage("");
    setBody("");
    messageRef.current = "";
    bodyRef.current = "";
  };

  const handleCommit = async () => {
    if (!canCommit) return;
    const committed = await onCommit(message, body);
    if (committed === false) return;
    clearCommitDraft();
  };

  const handlePush = async () => {
    if (stagedCount > 0) {
      if (!canCommitAndPush) return;
      const committed = await onCommit(message, body);
      if (committed === false) return;
      clearCommitDraft();
      await onPush();
      return;
    }

    if (!canPushAhead) return;
    await onPush();
  };

  return (
    <section className="shrink-0 border-t border-slate-200 bg-white">
      <div className={`${compact ? "h-8" : "h-9"} flex items-center justify-between gap-2 border-b border-slate-200 px-3`}>
        <div className="text-xs font-semibold text-slate-950">提交</div>
        {!compact && <div className="min-w-0 flex-1 truncate text-right text-[11px] text-slate-400">提交前请先在左侧选择文件暂存</div>}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            已暂存 {stagedCount}
          </div>
          {onGenerateMessage && (
            <button
              type="button"
              disabled={!canGenerate}
              onClick={() => { void handleGenerateMessage(); }}
              title="先本地秒填中文摘要，再后台 AI 精修"
              className="inline-flex h-6 items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {busyGenerate || refiningMessage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI 填写
            </button>
          )}
        </div>
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
        <div className={compact ? "grid grid-cols-2 gap-2" : "flex items-center justify-end gap-2"}>
          <button
            type="button"
            disabled={!canCommit}
            onClick={() => { void handleCommit(); }}
            className={`${compact ? "min-w-0 px-2" : "min-w-28 px-3"} inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400`}
          >
            {busyCommit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommitHorizontal className="h-3.5 w-3.5" />}
            提交 ({stagedCount})
          </button>
          <button
            type="button"
            disabled={stagedCount > 0 ? !canCommitAndPush : !canPushAhead}
            onClick={() => { void handlePush(); }}
            title={stagedCount > 0 ? "先提交已暂存文件，再推送新的 commit" : "推送当前分支已提交的 commit"}
            className={`${compact ? "min-w-0 px-2" : "min-w-28 px-3"} inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50`}
          >
            {busyPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {pushLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

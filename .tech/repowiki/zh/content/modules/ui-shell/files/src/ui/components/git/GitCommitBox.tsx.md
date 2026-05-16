# src/ui/components/git/GitCommitBox.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：186

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitCommitBox@7`
- `messageRef@28`
- `bodyRef@29`
- `stagedCount@30`
- `ahead@31`
- `canCommit@32`
- `canCommitAndPush@33`
- `canPushAhead@34`
- `canGenerate@35`
- `busyCommit@36`
- `busyGenerate@37`
- `busyPush@38`
- `pushLabel@39`
- `handleGenerateMessage@48`
- `suggestion@51`
- `fastMessage@68`
- `fastBody@70`
- `refined@73`
- `clearCommitDraft@91`
- `handleCommit@98`
- `committed@101`
- `handlePush@105`
- `committed@109`
- `MaybePromise@5`
- `onCommit@19`
- `onPush@22`

## 依赖输入

- `lucide-react`
- `react`
- `sonner`
- `../../types`

## 对外暴露

- `GitCommitBox`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
        <div className="flex shrink-0 items-center gap-1.5
... (truncated)
```

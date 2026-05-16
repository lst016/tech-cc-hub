# src/ui/components/git/GitConfirmDialog.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：70

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitConfirmDialog@12`
- `danger@23`
- `MaybePromise@2`
- `GitConfirmDialogState@4`
- `onConfirm@10`
- `onClose@20`

## 依赖输入

- `lucide-react`

## 对外暴露

- `GitConfirmDialogState`
- `GitConfirmDialog`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { AlertTriangle, X } from "lucide-react";

type MaybePromise<T> = T | Promise<T>;

export type GitConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "warning" | "danger";
  onConfirm: () => MaybePromise<unknown>;
};

export function GitConfirmDialog({
  state,
  busy,
  onClose,
}: {
  state: GitConfirmDialogState | null;
  busy: boolean;
  onClose: () => void;
}) {
  if (!state) return null;
  const danger = state.tone === "danger";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/18 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-950">{state.title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭确认弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{state.description}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void state.onConfirm();
            }}
            className={`h-9 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-55 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-950 hover:bg-slate-800"}`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

```

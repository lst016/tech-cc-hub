# src/ui/components/StartSessionModal.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：100

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `StartSessionModal@10`
- `handleSelectDirectory@23`
- `result@25`
- `StartSessionModalProps@2`
- `onCwdChange@6`
- `onStart@7`
- `onClose@8`

## 依赖输入

- `react`

## 对外暴露

- `StartSessionModal`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useEffect, useState } from "react";

interface StartSessionModalProps {
  cwd: string;
  pendingStart: boolean;
  onCwdChange: (value: string) => void;
  onStart: () => void;
  onClose: () => void;
}

export function StartSessionModal({
  cwd,
  pendingStart,
  onCwdChange,
  onStart,
  onClose,
}: StartSessionModalProps) {
  const [recentCwds, setRecentCwds] = useState<string[]>([]);

  useEffect(() => {
    window.electron.getRecentCwds().then(setRecentCwds).catch(console.error);
  }, []);

  const handleSelectDirectory = async () => {
    const result = await window.electron.selectDirectory();
    if (result) onCwdChange(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/20 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-ink-800">新建会话</div>
          <button
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-tertiary hover:text-ink-700"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">选一个工作目录，先建一个空会话，后面直接聊天就行。</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">工作目录</span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                placeholder="/path/to/project"
                value={cwd}
                onChange={(event) => onCwdChange(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={handleSelectDirectory}
                className="rounded-xl border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-surface-tertiary"
              >
                选择...
              </button>
            </div>
            {recentCwds.length > 0 && (
              <div className="mt-2 grid w-full gap-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-light">最近使用</div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {recentCwds.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={`truncate whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${cwd === path ? "border-accent/60 bg-accent/10 text-ink-800" : "border-ink-900/10 bg-white text-muted hover:border-ink-900/20 hover:text-ink-700"}`}
                      onClick={() => onCwdChange(path)}
                      title={path}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </label>
          <button
            className="flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onStart}
            disabled={pendingStart || !cwd.trim()}
          >
            {pendingStart ? (
              <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 100 101" fill="none">
                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895
... (truncated)
```

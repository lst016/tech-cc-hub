# src/ui/components/settings/CodeEditor.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：98

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `CodeEditor@13`
- `lineNumbersRef@23`
- `lines@24`
- `syncLineNumbersScroll@31`
- `textarea@51`
- `start@53`
- `end@54`
- `nextValue@55`
- `CodeEditorProps@3`
- `onChange@7`

## 依赖输入

- `react`

## 对外暴露

- `CodeEditor`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useRef, useMemo } from "react";
import type { ChangeEventHandler, KeyboardEventHandler, UIEventHandler } from "react";

type CodeEditorProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
};

export function CodeEditor({
  id,
  value,
  onChange,
  placeholder,
  minHeight = "360px",
  className = "",
  readOnly = false,
}: CodeEditorProps) {
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    if (!value) {
      return 1;
    }
    return Math.max(value.split("\n").length, 1);
  }, [value]);

  const syncLineNumbersScroll = (nextScrollTop: number) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = nextScrollTop;
    }
  };

  const handleScroll: UIEventHandler<HTMLTextAreaElement> = (event) => {
    syncLineNumbersScroll(event.currentTarget.scrollTop);
  };

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onChange(event.target.value);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key !== "Tab") {
      return;
    }
    event.preventDefault();

    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const nextValue = `${value.slice(0, start)}  ${value.slice(end)}`;

    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    });
  };

  return (
    <div
      className={`mt-2 flex min-h-0 flex-col rounded-2xl border border-ink-900/10 bg-white/95 ${className}`}
      style={{ minHeight }}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl">
        <div
          ref={lineNumbersRef}
          className="h-full select-none overflow-hidden border-r border-ink-900/10 bg-ink-900/6 px-3 py-3 text-xs leading-6 text-muted"
          aria-hidden="true"
        >
          <div className="min-h-full text-right">
            {Array.from({ length: lines }).map((_, index) => (
              <div key={index} className="h-6 pr-2 text-right tabular-nums">
                {index + 1}
              </div>
            ))}
          </div>
        </div>
        <textarea
          id={id}
          className={`h-full min-h-0 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent p-3 font-mono text-xs leading-6 outline-none ring-0 transition-all placeholder:text-muted focus:ring-0 ${readOnly ? "text-ink-700" : "text-ink-800"}`}
          value={value}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

```

import { useRef, useMemo } from "react";
import type { ChangeEventHandler, KeyboardEventHandler, UIEventHandler } from "react";

type CodeEditorProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
};

export function CodeEditor({
  id,
  value,
  onChange,
  placeholder,
  minHeight = "360px",
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
    <div className="mt-2 rounded-2xl border border-ink-900/10 bg-white/95">
      <div className="flex overflow-hidden rounded-2xl">
        <div
          ref={lineNumbersRef}
          className="select-none overflow-y-auto border-r border-ink-900/10 bg-ink-900/6 py-3 px-3 text-xs leading-6 text-muted"
          aria-hidden="true"
        >
          <div className="text-right" style={{ minHeight }}>
            {Array.from({ length: lines }).map((_, index) => (
              <div key={index} className="h-6 pr-2 text-right tabular-nums">
                {index + 1}
              </div>
            ))}
          </div>
        </div>
        <textarea
          id={id}
          className={`h-full min-h-0 min-w-0 flex-1 resize-none border-0 bg-transparent p-3 font-mono text-xs leading-6 outline-none ring-0 transition-all placeholder:text-muted focus:ring-0 ${readOnly ? "text-ink-700" : "text-ink-800"}`}
          style={{ minHeight }}
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

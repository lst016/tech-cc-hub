# src/ui/components/ComposerContextCard.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：78

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `ComposerContextCard@14`
- `toneClass@26`
- `badgeClass@33`
- `ComposerContextTone@1`
- `ComposerContextCardProps@2`
- `onRemove@11`

## 对外暴露

- `ComposerContextTone`
- `ComposerContextCardProps`
- `ComposerContextCard`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
export type ComposerContextTone = "code" | "browser" | "file" | "message";

export type ComposerContextCardProps = {
  index: number;
  tone: ComposerContextTone;
  label: string;
  title: string;
  meta?: string;
  detail?: string;
  onOpen?: () => void;
  onRemove: () => void;
  onCopy?: () => void;
};

export function ComposerContextCard({
  index,
  tone,
  label,
  title,
  meta,
  detail,
  onOpen,
  onRemove,
  onCopy,
}: ComposerContextCardProps) {
  const toneClass = tone === "code"
    ? "border-[#d0d7de] bg-white text-[#0969da]"
    : tone === "browser"
      ? "border-accent/16 bg-white text-accent"
      : tone === "file"
        ? "border-black/8 bg-white text-ink-800"
        : "border-accent/18 bg-[rgba(253,244,241,0.86)] text-ink-800";
  const badgeClass = tone === "code" ? "bg-[#0969da]" : "bg-accent";

  return (
    <div
      className={`inline-flex h-9 max-w-[340px] items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-[0_8px_18px_rgba(15,18,24,0.06)] ${toneClass}`}
      title={[title, meta, detail].filter(Boolean).join("\n")}
    >
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${badgeClass}`}>
        {index}
      </span>
      <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] text-muted">
        {label}
      </span>
      <button
        type="button"
        className="min-w-0 truncate text-left font-semibold hover:underline disabled:hover:no-underline"
        onClick={onOpen}
        disabled={!onOpen}
      >
        {title}
      </button>
      {meta && <span className="shrink-0 text-[11px] font-medium text-muted">{meta}</span>}
      {onCopy && (
        <button
          type="button"
          className="rounded-full p-1 text-muted transition hover:bg-black/5 hover:text-ink-700"
          onClick={onCopy}
          aria-label={`复制${label}引用`}
        >
          ⧉
        </button>
      )}
      <button
        type="button"
        className="rounded-full p-1 text-muted transition hover:bg-black/5 hover:text-ink-700"
        onClick={onRemove}
        aria-label={`移除${label}引用 ${index}`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

```

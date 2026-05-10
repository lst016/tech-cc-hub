import { Check, FileText, Search, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { UiGitChangedFile } from "../../types";
import { fileStatusClassName, fileStatusLabel, shortenPath } from "./git-ui-utils";

export function GitChangesList({
  files,
  selected,
  actionBusy,
  onSelect,
  onStage,
  onUnstage,
}: {
  files: UiGitChangedFile[];
  selected: { path: string; staged: boolean } | null;
  actionBusy: string | null;
  onSelect: (file: UiGitChangedFile) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return files;
    return files.filter((file) => file.path.toLowerCase().includes(normalized));
  }, [files, query]);
  const staged = filtered.filter((file) => file.staged);
  const unstaged = filtered.filter((file) => !file.staged);
  const disabled = Boolean(actionBusy);

  return (
    <section className="min-h-0 border-b border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Changes</p>
            <h3 className="text-sm font-semibold text-slate-950">改动文件</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            {files.length}
          </span>
        </div>
        <label className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500 focus-within:border-slate-300 focus-within:bg-white">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="搜索文件"
          />
        </label>
      </div>

      <div className="max-h-[44vh] min-h-0 overflow-y-auto px-2 py-2">
        {renderGroup("已暂存", staged, {
          selected,
          disabled,
          actionIcon: <Undo2 className="h-3.5 w-3.5" />,
          actionLabel: "取消暂存",
          onSelect,
          onAction: onUnstage,
        })}
        {renderGroup("未暂存", unstaged, {
          selected,
          disabled,
          actionIcon: <Check className="h-3.5 w-3.5" />,
          actionLabel: "暂存",
          onSelect,
          onAction: onStage,
        })}
        {filtered.length === 0 && (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <FileText className="h-5 w-5 text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-500">没有匹配的改动</p>
          </div>
        )}
      </div>
    </section>
  );
}

function renderGroup(
  title: string,
  files: UiGitChangedFile[],
  options: {
    selected: { path: string; staged: boolean } | null;
    disabled: boolean;
    actionIcon: React.ReactNode;
    actionLabel: string;
    onSelect: (file: UiGitChangedFile) => void;
    onAction: (paths: string[]) => void;
  },
) {
  if (files.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold text-slate-500">
        <span>{title}</span>
        <button
          type="button"
          disabled={options.disabled}
          onClick={() => options.onAction(files.map((file) => file.path))}
          className="rounded-lg px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
        >
          全部
        </button>
      </div>
      <div className="space-y-1">
        {files.map((file) => {
          const active = options.selected?.path === file.path && options.selected?.staged === file.staged;
          return (
            <button
              key={`${file.staged ? "s" : "u"}-${file.path}`}
              type="button"
              onClick={() => options.onSelect(file)}
              className={`group flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${
                active ? "border-slate-300 bg-slate-100" : "border-transparent hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${fileStatusClassName(file.status)}`}>
                {fileStatusLabel(file.status)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-800" title={file.path}>{shortenPath(file.path)}</span>
                {file.oldPath && <span className="block truncate text-[10px] text-slate-400">from {shortenPath(file.oldPath, 42)}</span>}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  options.onAction([file.path]);
                }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-900 group-hover:opacity-100"
                title={options.actionLabel}
                aria-label={options.actionLabel}
              >
                {options.actionIcon}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

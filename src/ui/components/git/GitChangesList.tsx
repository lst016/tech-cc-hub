import { FileText, Minus, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { UiGitChangedFile } from "../../types";
import { fileStatusClassName, fileStatusLabel } from "./git-ui-utils";

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
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return files;
    return files.filter((file) => file.path.toLowerCase().includes(normalizedQuery));
  }, [files, normalizedQuery]);
  const staged = filtered.filter((file) => file.staged);
  const unstaged = filtered.filter((file) => !file.staged);
  const disabled = Boolean(actionBusy);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-950">改动</div>
          <div className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{files.length}</div>
        </div>
        <label className="mt-2 flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 focus-within:border-blue-300 focus-within:bg-white">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="搜索文件"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs">
        <FileGroup
          title="未暂存"
          files={unstaged}
          selected={selected}
          disabled={disabled}
          actionIcon={<Plus className="h-3.5 w-3.5" />}
          actionLabel="暂存"
          emptyLabel="没有未暂存改动"
          onSelect={onSelect}
          onAction={onStage}
        />
        <FileGroup
          title="已暂存"
          files={staged}
          selected={selected}
          disabled={disabled}
          actionIcon={<Minus className="h-3.5 w-3.5" />}
          actionLabel="取消暂存"
          emptyLabel="没有已暂存文件"
          onSelect={onSelect}
          onAction={onUnstage}
        />

        {filtered.length === 0 && (
          <div className="mt-8 flex flex-col items-center justify-center text-center text-xs text-slate-400">
            <FileText className="h-5 w-5" />
            <p className="mt-2">没有匹配文件</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FileGroup({
  title,
  files,
  selected,
  disabled,
  actionIcon,
  actionLabel,
  emptyLabel,
  onSelect,
  onAction,
}: {
  title: string;
  files: UiGitChangedFile[];
  selected: { path: string; staged: boolean } | null;
  disabled: boolean;
  actionIcon: ReactNode;
  actionLabel: string;
  emptyLabel: string;
  onSelect: (file: UiGitChangedFile) => void;
  onAction: (paths: string[]) => void;
}) {
  const sortedFiles = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);

  return (
    <section className="mb-3">
      <div className="mb-1 flex h-7 items-center justify-between rounded px-1 text-[11px] font-semibold text-slate-500">
        <span>{title} ({files.length})</span>
        {files.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction(files.map((file) => file.path))}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            title={`${actionLabel}全部文件`}
            aria-label={`${actionLabel}全部文件`}
          >
            {actionIcon}
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <div className="px-2 py-2 text-[11px] text-slate-400">{emptyLabel}</div>
      ) : (
        <div>{sortedFiles.map((file) => renderFileRow(file, { selected, disabled, actionIcon, actionLabel, onSelect, onAction }))}</div>
      )}
    </section>
  );
}

function renderFileRow(
  file: UiGitChangedFile,
  options: {
    selected: { path: string; staged: boolean } | null;
    disabled: boolean;
    actionIcon: ReactNode;
    actionLabel: string;
    onSelect: (file: UiGitChangedFile) => void;
    onAction: (paths: string[]) => void;
  },
) {
  const { name, directory } = splitFilePath(file.path);
  const active = options.selected?.path === file.path && options.selected?.staged === file.staged;
  return (
    <div
      key={`${file.staged ? "s" : "u"}-${file.path}`}
      className={`group flex h-8 items-center gap-1 rounded px-1 ${
        active ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={() => options.onSelect(file)}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        title={file.path}
      >
        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${fileStatusClassName(file.status)}`}>
          {fileStatusLabel(file.status)}
        </span>
        <span className="min-w-0 truncate font-medium">{name}</span>
        {directory && <span className="min-w-0 truncate text-[11px] text-slate-400">{directory}</span>}
      </button>
      <button
        type="button"
        disabled={options.disabled}
        onClick={() => options.onAction([file.path])}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 opacity-0 hover:bg-white hover:text-slate-900 disabled:opacity-30 group-hover:opacity-100 focus:opacity-100"
        title={options.actionLabel}
        aria-label={options.actionLabel}
      >
        {options.actionIcon}
      </button>
    </div>
  );
}

function splitFilePath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const name = parts.pop() ?? path;
  return {
    name,
    directory: parts.join("/"),
  };
}

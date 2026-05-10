import { html as diffToHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import { Copy, FileText, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { UiGitCommitDetail } from "../../types";
import { fileStatusClassName, fileStatusLabel, formatRelativeTime, shortenPath } from "./git-ui-utils";

export function GitCommitDetailPanel({
  detail,
  loading,
}: {
  detail: UiGitCommitDetail | null;
  loading: boolean;
}) {
  const diffHtml = useMemo(() => {
    const diff = detail?.diff?.trim();
    if (!diff) return "";
    return diffToHtml(diff, {
      drawFileList: false,
      matching: "lines",
      outputFormat: "line-by-line",
      renderNothingWhenEmpty: false,
    });
  }, [detail?.diff]);

  return (
    <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
        <div className="text-xs font-semibold text-slate-950">提交详情</div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>

      {!detail ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center text-xs text-slate-400">
          <FileText className="h-6 w-6" />
          <p className="mt-2">选择提交查看详情</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-slate-200 px-3 py-3">
            <h3 className="text-sm font-semibold leading-5 text-slate-950">{detail.message || "(no message)"}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>{detail.authorName}</span>
              <span>{formatRelativeTime(detail.committedAt)}</span>
              <span className="font-mono">{detail.committedAt.replace("T", " ").slice(0, 19)}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              <span className="shrink-0">提交:</span>
              <span className="min-w-0 flex-1 truncate font-mono">{detail.hash}</span>
              <button
                type="button"
                onClick={() => { void navigator.clipboard?.writeText(detail.hash); }}
                className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-white hover:text-slate-900"
                title="复制提交哈希"
                aria-label="复制提交哈希"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            {detail.body && detail.body !== detail.message && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{detail.body}</p>
            )}
          </div>

          <div className="border-b border-slate-200 px-3 py-2">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>变更文件</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{detail.files.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">
              {detail.files.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-slate-400">这次提交没有文件列表</div>
              ) : detail.files.map((file) => (
                <div key={`${file.status}-${file.path}`} className="flex h-7 items-center gap-2 border-b border-slate-100 px-2 text-xs last:border-b-0">
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${fileStatusClassName(file.status)}`}>
                    {fileStatusLabel(file.status)}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={file.path}>{shortenPath(file.path, 46)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-[280px] bg-[#fbfcfe]">
            {diffHtml ? (
              <div className="git-diff-viewer min-w-[560px] text-[11px]" dangerouslySetInnerHTML={{ __html: diffHtml }} />
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center text-xs text-slate-400">
                <FileText className="h-5 w-5" />
                <p className="mt-2">没有文本 diff</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

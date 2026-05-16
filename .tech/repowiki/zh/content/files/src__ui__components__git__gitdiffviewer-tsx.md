# src/ui/components/git/GitDiffViewer.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：62

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitDiffViewer@7`
- `EmptyDiff@52`
- `diffHtml@17`
- `diff@18`

## 依赖输入

- `diff2html`
- `lucide-react`
- `react`
- `../../types`
- `./git-ui-utils`
- `diff2html/bundles/css/diff2html.min.css`

## 对外暴露

- `GitDiffViewer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { html as diffToHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import { FileText, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { UiGitChangedFile, UiGitDiffResult } from "../../types";
import { shortenPath } from "./git-ui-utils";

export function GitDiffViewer({
  file,
  diffResult,
  loading,
}: {
  file: UiGitChangedFile | null;
  diffResult: UiGitDiffResult | null;
  loading: boolean;
}) {
  const diffHtml = useMemo(() => {
    const diff = diffResult?.diff?.trim();
    if (!diff || diff.startsWith("# ")) return "";
    return diffToHtml(diff, {
      drawFileList: false,
      matching: "lines",
      outputFormat: "line-by-line",
      renderNothingWhenEmpty: false,
    });
  }, [diffResult?.diff]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold text-slate-950" title={file?.path ?? ""}>
            {file ? shortenPath(file.path, 64) : "选择文件查看 diff"}
          </h3>
        </div>
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fbfcfe]">
        {!file ? (
          <EmptyDiff title="没有选中文件" description="从左侧改动列表选择一个文件。" />
        ) : diffResult?.diff?.startsWith("# ") ? (
          <EmptyDiff title="Diff 读取失败" description={diffResult.diff.replace(/^#\s*/, "")} />
        ) : diffHtml ? (
          <div className="git-diff-viewer min-w-[560px] text-[11px]" dangerouslySetInnerHTML={{ __html: diffHtml }} />
        ) : (
          <EmptyDiff title="没有文本 diff" description="可能是二进制文件，或文件内容暂无差异。" />
        )}
      </div>
    </section>
  );
}

function EmptyDiff({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[248px] flex-col items-center justify-center px-8 text-center">
      <FileText className="h-6 w-6 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

```

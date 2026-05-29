import { useMemo, useState } from "react";
import type { StreamMessage } from "../../types";
import {
  collectCompletedPreviewFileChanges,
  resolvePreviewFileChangePath,
} from "../../utils/preview-file-refresh";
import { PREVIEW_OPEN_FILE_EVENT, type PreviewOpenFileDetail } from "../../events";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessageContentItems(message: StreamMessage): unknown[] {
  const envelope = message as { message?: unknown };
  if (!isRecord(envelope.message)) return [];
  const content = envelope.message.content;
  return Array.isArray(content) ? content : content ? [content] : [];
}

function getProcessGroupSummary(groupMessages: Array<{ message: StreamMessage }>): string {
  let toolUseCount = 0;
  let toolResultCount = 0;
  const toolLabels = new Map<string, number>();

  for (const item of groupMessages) {
    for (const content of getMessageContentItems(item.message)) {
      if (!isRecord(content)) continue;
      if (content.type === "tool_use") {
        toolUseCount += 1;
        const name = typeof content.name === "string" ? content.name : "tool";
        toolLabels.set(name, (toolLabels.get(name) ?? 0) + 1);
      }
      if (content.type === "tool_result") {
        toolResultCount += 1;
      }
    }
  }

  const labelPreview = Array.from(toolLabels.entries())
    .slice(0, 4)
    .map(([name, count]) => `${name} ${count}`)
    .join(" · ");
  const parts = [
    toolUseCount ? `${toolUseCount} 个工具调用` : "",
    toolResultCount ? `${toolResultCount} 条工具返回` : "",
    labelPreview,
  ].filter(Boolean);
  return parts.join(" · ") || `${groupMessages.length} 条过程事件`;
}

function normalizeComparablePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

function buildProcessChangedFiles(
  messages: Array<{ message: StreamMessage }>,
  workspace?: string,
): Array<{ path: string; displayPath: string; operationCount: number }> {
  const changes = collectCompletedPreviewFileChanges(messages.map((entry) => entry.message));
  const grouped = new Map<string, { path: string; displayPath: string; operationCount: number }>();
  const normalizedWorkspace = workspace ? normalizeComparablePath(workspace).replace(/\/+$/, "") : "";

  for (const change of changes) {
    const resolvedPath = resolvePreviewFileChangePath(workspace, change.path);
    const normalizedResolvedPath = normalizeComparablePath(resolvedPath);
    const existing = grouped.get(normalizedResolvedPath);
    if (existing) {
      existing.operationCount += 1;
      continue;
    }

    let displayPath = resolvedPath;
    if (workspace && normalizedWorkspace && normalizedResolvedPath.startsWith(`${normalizedWorkspace}/`)) {
      displayPath = resolvedPath.slice(workspace.length + 1);
    }

    grouped.set(normalizedResolvedPath, {
      path: resolvedPath,
      displayPath,
      operationCount: 1,
    });
  }

  return Array.from(grouped.values());
}

function formatProcessDetailValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim() || "(empty)";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getProcessEntryDetail(message: StreamMessage): string {
  const content = (message as { message?: { content?: unknown[] } }).message?.content;
  if (!Array.isArray(content) || content.length === 0) {
    return "无过程详情";
  }

  return content.map((item) => {
    if (!isRecord(item)) {
      return formatProcessDetailValue(item);
    }

    if (item.type === "tool_use") {
      const name = typeof item.name === "string" ? item.name : "tool";
      return [`工具调用：${name}`, formatProcessDetailValue(item.input)].filter(Boolean).join("\n");
    }

    if (item.type === "tool_result") {
      return ["工具返回：", formatProcessDetailValue(item.content ?? item)].join("\n");
    }

    return formatProcessDetailValue(item);
  }).join("\n\n");
}

function getProcessEntryLabel(message: StreamMessage): string {
  return message.type === "user" ? "过程输出" : "过程";
}

function CompactProcessDetails({ message }: { message: StreamMessage }) {
  const detail = getProcessEntryDetail(message);

  return (
    <pre className="ml-4 mb-1 max-h-64 overflow-auto rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2 text-[11px] leading-5 text-muted/80 [white-space:pre-wrap] [word-break:break-word]">
      {detail}
    </pre>
  );
}

function CompactProcessRow({
  entry,
}: {
  entry: { originalIndex: number; message: StreamMessage };
}) {
  const [expanded, setExpanded] = useState(false);
  const label = getProcessEntryLabel(entry.message);
  const summary = getProcessGroupSummary([entry]);

  return (
    <div id={`chat-message-${entry.originalIndex}`}>
      <button
        type="button"
        className="flex max-w-full items-center gap-1.5 py-0.5 text-left text-[11px] leading-5 text-muted/58 transition hover:text-muted"
        onClick={() => setExpanded((value) => !value)}
      >
        <svg
          className={`h-2 w-2 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
        <span className="h-1 w-1 shrink-0 rounded-full bg-muted/35" />
        <span className="shrink-0 text-muted/70">{label}</span>
        <span className="min-w-0 truncate">{summary}</span>
      </button>
      {expanded && <CompactProcessDetails message={entry.message} />}
    </div>
  );
}

export function ProcessGroupCard({
  messages,
  workspace,
}: {
  messages: Array<{ originalIndex: number; message: StreamMessage }>;
  workspace?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const summary = useMemo(() => getProcessGroupSummary(messages), [messages]);
  const changedFiles = useMemo(() => buildProcessChangedFiles(messages, workspace), [messages, workspace]);
  const visibleChangedFiles = showAllFiles ? changedFiles : changedFiles.slice(0, 4);
  const remainingChangedFileCount = Math.max(0, changedFiles.length - visibleChangedFiles.length);

  return (
    <div className="my-0.5">
      {changedFiles.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-[24px] border border-black/6 bg-white/84 shadow-[0_12px_28px_rgba(30,38,52,0.05)]">
          <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#f3f6fb] text-ink-700">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    <path d="M8 4.5h8l3 3V19.5H8z" />
                    <path d="M13 4.5V8h6M10.5 12h6M10.5 15.5h6" />
                  </svg>
                </span>
                <span>已修改 {changedFiles.length} 个文件</span>
              </div>
              <p className="mt-1 text-xs text-muted">点击文件在右侧预览打开</p>
            </div>
          </div>
          <div className="divide-y divide-black/6">
            {visibleChangedFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-900/[0.03]"
                onClick={() => window.dispatchEvent(new CustomEvent<PreviewOpenFileDetail>(PREVIEW_OPEN_FILE_EVENT, {
                  detail: { filePath: file.path },
                }))}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800" title={file.path}>
                  {file.displayPath}
                </span>
                {file.operationCount > 1 && (
                  <span className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-medium text-muted">
                    {file.operationCount} 次
                  </span>
                )}
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
          {(remainingChangedFileCount > 0 || showAllFiles) && (
            <div className="px-4 py-2.5">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700 transition hover:text-accent"
                onClick={() => setShowAllFiles((current) => !current)}
              >
                <span>{showAllFiles ? "收起" : `再显示 ${remainingChangedFileCount} 个文件`}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 transition-transform ${showAllFiles ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className="flex max-w-full items-center gap-1 px-0.5 py-0 text-left text-[11px] leading-5 text-muted/62 transition hover:text-muted"
        onClick={() => setExpanded((value) => !value)}
      >
        <svg
          className={`h-2.5 w-2.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
        <span className="shrink-0">过程明细</span>
        <span className="min-w-0 truncate">
          {messages.length} 条 · {summary}
        </span>
      </button>
      {expanded && (
        <div className="ml-3 border-l border-black/5 pl-2">
          {messages.map((entry, index) => (
            <CompactProcessRow
              key={`${entry.originalIndex}-${index}`}
              entry={entry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

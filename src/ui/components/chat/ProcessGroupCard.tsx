import { memo, useMemo, useState } from "react";
import type { StreamMessage } from "../../types";
import {
  collectCompletedPreviewFileChanges,
  resolvePreviewFileChangePath,
  type PreviewFileChangeEvent,
} from "../../utils/preview-file-refresh";
import {
  parseGeneratedImageResult,
  type GeneratedImageResult,
} from "../../utils/generated-image-result";
import { PREVIEW_OPEN_FILE_EVENT, type PreviewOpenFileDetail } from "../../events";
import { GeneratedImageResultCard } from "./GeneratedImageResultCard";

type ChangedFileSummary = {
  path: string;
  displayPath: string;
  operation: PreviewFileChangeEvent["operation"];
  operationCount: number;
  additions: number;
  deletions: number;
};

const PROCESS_ROW_BATCH_SIZE = 120;

type SuccessfulGeneratedImageResult = Extract<GeneratedImageResult, {
  isImageGeneration: true;
  success: true;
}>;

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
): ChangedFileSummary[] {
  const changes = collectCompletedPreviewFileChanges(messages.map((entry) => entry.message));
  const grouped = new Map<string, ChangedFileSummary>();
  const normalizedWorkspace = workspace ? normalizeComparablePath(workspace).replace(/\/+$/, "") : "";

  for (const change of changes) {
    const resolvedPath = resolvePreviewFileChangePath(workspace, change.path);
    const normalizedResolvedPath = normalizeComparablePath(resolvedPath);
    const existing = grouped.get(normalizedResolvedPath);
    if (existing) {
      existing.operationCount += 1;
      existing.additions += change.additions;
      existing.deletions += change.deletions;
      existing.operation = change.operation;
      continue;
    }

    let displayPath = resolvedPath;
    if (workspace && normalizedWorkspace && normalizedResolvedPath.startsWith(`${normalizedWorkspace}/`)) {
      displayPath = resolvedPath.slice(workspace.length + 1);
    }

    grouped.set(normalizedResolvedPath, {
      path: resolvedPath,
      displayPath,
      operation: change.operation,
      operationCount: 1,
      additions: change.additions,
      deletions: change.deletions,
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

function getToolResultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (isRecord(item) && typeof item.text === "string") {
        return item.text;
      }
      return formatProcessDetailValue(item);
    }).join("\n");
  }

  if (isRecord(content) && typeof content.text === "string") {
    return content.text;
  }

  return formatProcessDetailValue(content);
}

function collectGeneratedImageResults(
  messages: Array<{ message: StreamMessage }>,
): SuccessfulGeneratedImageResult[] {
  const results: SuccessfulGeneratedImageResult[] = [];
  const resultKeys = new Set<string>();

  for (const entry of messages) {
    for (const content of getMessageContentItems(entry.message)) {
      if (!isRecord(content) || content.type !== "tool_result") continue;

      const result = parseGeneratedImageResult(getToolResultText(content.content));
      if (!result.isImageGeneration || !result.success) continue;

      const key = result.artifacts.map((artifact) => artifact.path).join("\u0000");
      if (resultKeys.has(key)) continue;
      resultKeys.add(key);
      results.push(result);
    }
  }

  return results;
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
      return ["工具返回：", getToolResultText(item.content ?? item)].join("\n");
    }

    return formatProcessDetailValue(item);
  }).join("\n\n");
}

function getProcessEntryLabel(message: StreamMessage): string {
  return message.type === "user" ? "过程输出" : "过程";
}

function compactPath(path: string, limit = 58): string {
  if (path.length <= limit) return path;
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts.pop() ?? path;
  const directory = parts.slice(-2).join("/");
  const prefix = directory ? `${directory}/` : "";
  const compact = `${prefix}${fileName}`;
  if (compact.length <= limit) return compact;
  return `...${compact.slice(Math.max(0, compact.length - limit + 3))}`;
}

function operationLabel(operation: PreviewFileChangeEvent["operation"]): string {
  switch (operation) {
    case "created":
      return "已新增";
    case "deleted":
      return "已删除";
    case "renamed":
      return "已重命名";
    case "written":
      return "已写入";
    case "edited":
    default:
      return "已编辑";
  }
}

function buildPreviewText(changedFiles: ChangedFileSummary[], summary: string): string {
  if (changedFiles.length === 0) return summary;
  const primary = changedFiles[0]!;
  const suffix = changedFiles.length > 1 ? `，另有 ${changedFiles.length - 1} 个文件` : "";
  return `Agent 已完成过程调用，并整理出 ${operationLabel(primary.operation)} ${compactPath(primary.displayPath, 44)}${suffix}。点击文件可在右侧预览并跳到首个修改。`;
}

function CompactProcessDetails({ message }: { message: StreamMessage }) {
  const detail = getProcessEntryDetail(message);

  return (
    <pre className="mb-1 ml-4 overflow-visible rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2 text-[11px] leading-5 text-muted/80 [white-space:pre-wrap] [word-break:break-word]">
      {detail}
    </pre>
  );
}

function CompactProcessRow({
  entry,
  messageIdPrefix,
}: {
  entry: { originalIndex: number; message: StreamMessage };
  messageIdPrefix: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = getProcessEntryLabel(entry.message);
  const summary = getProcessGroupSummary([entry]);

  return (
    <div id={`${messageIdPrefix}-message-${entry.originalIndex}`}>
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

function ChangePreviewPopover({
  changedFiles,
  summary,
  visible,
}: {
  changedFiles: ChangedFileSummary[];
  summary: string;
  visible: boolean;
}) {
  const primary = changedFiles[0];
  const previewText = buildPreviewText(changedFiles, summary);
  const totalAdditions = changedFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = changedFiles.reduce((sum, file) => sum + file.deletions, 0);

  return (
    <div className={`pointer-events-none absolute bottom-[calc(100%+10px)] left-0 z-20 w-[min(480px,calc(100vw-7rem))] rounded-[20px] border border-black/8 bg-white/96 px-4 py-3 text-left shadow-[0_20px_50px_rgba(30,38,52,0.18)] backdrop-blur-xl transition ${visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
      <div className="truncate text-sm font-semibold text-ink-900">
        {changedFiles.length === 1 && primary ? `${operationLabel(primary.operation)} ${compactPath(primary.displayPath, 44)}` : `已整理 ${changedFiles.length} 个文件改动`}
      </div>
      <div className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted">
        {previewText}
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-black/10 text-ink-500">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 12h16M12 4v16" />
          </svg>
        </span>
        <span className="shrink-0">文件预览</span>
        {primary && <span className="min-w-0 truncate font-mono">{compactPath(primary.displayPath, 28)}</span>}
        {changedFiles.length > 1 && <span className="shrink-0">+{changedFiles.length - 1}</span>}
        {(totalAdditions > 0 || totalDeletions > 0) && (
          <span className="ml-auto shrink-0 font-medium">
            <span className="text-emerald-600">+{totalAdditions}</span>
            <span className="mx-1 text-muted/55">-</span>
            <span className="text-red-600">{totalDeletions}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ChangedFileRow({ file }: { file: ChangedFileSummary }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <button
      type="button"
      className="relative flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-900/[0.03]"
      onMouseEnter={() => setPreviewOpen(true)}
      onMouseLeave={() => setPreviewOpen(false)}
      onFocus={() => setPreviewOpen(true)}
      onBlur={() => setPreviewOpen(false)}
      onClick={() => {
        setPreviewOpen(true);
        window.dispatchEvent(new CustomEvent<PreviewOpenFileDetail>(PREVIEW_OPEN_FILE_EVENT, {
          detail: { filePath: file.path, revealFirstChange: true },
        }));
      }}
    >
      <ChangePreviewPopover changedFiles={[file]} summary={file.displayPath} visible={previewOpen} />
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-[#f3f6fb] text-ink-600">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M8 4.5h8l3 3V19.5H8z" />
          <path d="M13 4.5V8h6M10.5 12h6M10.5 15.5h6" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-900">
          <span className="shrink-0">{operationLabel(file.operation)}</span>
          <span className="min-w-0 truncate font-mono text-[13px]" title={file.path}>{file.displayPath}</span>
        </div>
        {file.operationCount > 1 && (
          <div className="mt-0.5 text-[11px] text-muted">{file.operationCount} 次写入合并</div>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        <span className="text-emerald-600">+{file.additions}</span>
        <span className="mx-1 text-muted/45">-</span>
        <span className="text-red-600">{file.deletions}</span>
      </span>
    </button>
  );
}

const TurnFileChangesCard = memo(function TurnFileChangesCard({
  messages,
  workspace,
}: {
  messages: Array<{ originalIndex: number; message: StreamMessage }>;
  workspace?: string;
}) {
  const [showAllFiles, setShowAllFiles] = useState(false);
  const changedFiles = useMemo(
    () => buildProcessChangedFiles(messages, workspace),
    [messages, workspace],
  );
  const visibleChangedFiles = showAllFiles ? changedFiles : changedFiles.slice(0, 4);
  const remainingChangedFileCount = Math.max(0, changedFiles.length - visibleChangedFiles.length);
  const totalAdditions = changedFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = changedFiles.reduce((sum, file) => sum + file.deletions, 0);

  if (changedFiles.length === 0) return null;

  return (
    <div
      data-turn-file-changes
      className="relative mt-2 overflow-visible rounded-[24px] border border-black/6 bg-white/84 shadow-[0_12px_28px_rgba(30,38,52,0.05)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-900">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#f3f6fb] text-ink-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M8 4.5h8l3 3V19.5H8z" />
                <path d="M13 4.5V8h6M10.5 12h6M10.5 15.5h6" />
              </svg>
            </span>
            <span className="min-w-0 truncate">已修改 {changedFiles.length} 个文件</span>
          </div>
          <p className="mt-1 text-xs text-muted">点击文件在右侧预览，并跳到首个修改处</p>
        </div>
        <div className="shrink-0 text-sm font-semibold tabular-nums">
          <span className="text-emerald-600">+{totalAdditions}</span>
          <span className="mx-1 text-muted/45">-</span>
          <span className="text-red-600">{totalDeletions}</span>
        </div>
      </div>
      <div className="divide-y divide-black/6 rounded-b-[24px]">
        {visibleChangedFiles.map((file) => (
          <ChangedFileRow key={file.path} file={file} />
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
  );
});

const ProcessGroupCard = memo(function ProcessGroupCard({
  messages,
  messageIdPrefix = "chat",
}: {
  messages: Array<{ originalIndex: number; message: StreamMessage }>;
  messageIdPrefix?: string;
}) {

  const [expanded, setExpanded] = useState(false);
  const [visibleProcessCount, setVisibleProcessCount] = useState(PROCESS_ROW_BATCH_SIZE);
  const summary = useMemo(() => getProcessGroupSummary(messages), [messages]);
  const generatedImages = useMemo(() => collectGeneratedImageResults(messages), [messages]);
  const visibleProcessMessages = expanded ? messages.slice(0, visibleProcessCount) : [];
  const remainingProcessMessageCount = Math.max(0, messages.length - visibleProcessMessages.length);

  return (
    <div className="my-0.5">
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
          {visibleProcessMessages.map((entry, index) => (
            <CompactProcessRow
              key={`${entry.originalIndex}-${index}`}
              entry={entry}
              messageIdPrefix={messageIdPrefix}
            />
          ))}
          {remainingProcessMessageCount > 0 && (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-accent/25 hover:text-accent"
              onClick={() => setVisibleProcessCount((current) => Math.min(messages.length, current + PROCESS_ROW_BATCH_SIZE))}
            >
              再显示 {Math.min(PROCESS_ROW_BATCH_SIZE, remainingProcessMessageCount)} 条过程
            </button>
          )}
        </div>
      )}
      {generatedImages.map((result) => (
        <GeneratedImageResultCard
          key={result.artifacts.map((artifact) => artifact.path).join("\u0000")}
          mode={result.mode}
          model={result.model}
          profileName={result.profileName}
          artifacts={result.artifacts}
          outputHint={result.outputHint}
        />
      ))}
    </div>
  );
});

export default ProcessGroupCard;
export { ProcessGroupCard, TurnFileChangesCard };

import { useState } from "react";
import { ChevronDown, CornerDownLeft, ListOrdered, Pencil, Trash2, X } from "lucide-react";
import type { PromptAttachment } from "../../types";
import type {
  CodeReferenceDraft,
  FileReferenceDraft,
  MessageReferenceDraft,
} from "../../store/useAppStore";
import { copyTextToClipboard as copyText } from "../../utils/clipboard";
import {
  getBrowserAnnotationHoverTitle,
  getBrowserAnnotationLabel,
  getCodeReferenceFileLabel,
  getCodeReferenceLineLabel,
  getMessageReferenceLabel,
  type BrowserAnnotationPromptInput,
} from "./prompt-context-blocks";
import {
  countStructuredContextBlocks,
  getQueuedPromptPreview,
  type QueuedMessageDraft,
} from "./prompt-queue";
import { estimateTokensFromText, formatShortTime } from "./prompt-formatters";
import { OPEN_BROWSER_WORKBENCH_URL_EVENT, PREVIEW_OPEN_FILE_EVENT } from "../../events";
import { ComposerContextCard } from "../ComposerContextCard";

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function getQueuedMessagePanelDetail(queuedMessage: QueuedMessageDraft) {
  const contextCount = countStructuredContextBlocks(queuedMessage.prompt);
  const promptPreview = getQueuedPromptPreview(queuedMessage.prompt, contextCount);
  const label = promptPreview
    || (queuedMessage.attachments.length === 1
      ? `附件：${queuedMessage.attachments[0].name}`
      : `${queuedMessage.attachments.length} 个附件`);

  return { contextCount, label };
}

export function QueuedMessagesPanel({
  queue,
  isRunning,
  onClear,
  onAppend,
  onEdit,
  onRemove,
}: {
  queue: QueuedMessageDraft[];
  isRunning: boolean;
  onClear: () => void;
  onAppend: (queuedMessage: QueuedMessageDraft) => void;
  onEdit: (queuedMessage: QueuedMessageDraft) => void;
  onRemove: (queueId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (queue.length === 0) return null;

  const nextQueuedMessage = queue[0]!;
  const { label: nextLabel } = getQueuedMessagePanelDetail(nextQueuedMessage);

  return (
    <div
      role="region"
      aria-label="待发送队列"
      data-queued-messages-panel
      className="mb-3 min-w-0 overflow-hidden rounded-2xl border border-ink-900/8 bg-surface-cream shadow-soft"
    >
      <div className={`flex min-h-10 items-center justify-between gap-3 px-3 ${collapsed ? "" : "border-b border-ink-900/6"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
            <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="shrink-0 text-xs font-semibold text-ink-800">待发送队列</div>
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-surface-tertiary px-1.5 text-[10px] font-semibold tabular-nums text-ink-600">
            {queue.length}
          </span>
          {collapsed && (
            <button
              type="button"
              className="hidden min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-muted transition hover:bg-white hover:text-accent focus-visible:outline-2 focus-visible:outline-accent/40 sm:block"
              onClick={() => onEdit(nextQueuedMessage)}
              title={nextLabel}
            >
              下一条：{nextLabel}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted">
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition hover:bg-error-light/70 hover:text-error focus-visible:outline-2 focus-visible:outline-error/30"
            onClick={onClear}
            aria-label="清空待发送队列"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            清空队列
          </button>
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition hover:bg-white hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-accent/40"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展开待发送队列" : "收起待发送队列"}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`} aria-hidden="true" />
            {collapsed ? "展开" : "收起"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="queued-messages-scroll max-h-[216px] overflow-y-auto overscroll-contain">
          {queue.map((queuedMessage, index) => {
            const { contextCount, label } = getQueuedMessagePanelDetail(queuedMessage);

            return (
              <div
                key={queuedMessage.id}
                data-queued-message-row
                data-queue-next={index === 0 ? "true" : undefined}
                aria-current={index === 0 ? "true" : undefined}
                className={`queued-message-row group grid min-w-0 items-center gap-x-2.5 gap-y-1 border-b border-ink-900/6 px-3 py-2.5 text-xs text-ink-700 transition-colors last:border-b-0 hover:bg-white ${index === 0 ? "bg-white/80" : "bg-white/35"}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-semibold tabular-nums ${index === 0 ? "bg-accent-subtle text-accent" : "bg-surface-tertiary text-ink-500"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <button
                    type="button"
                    className="min-w-0 max-w-full overflow-hidden text-left text-[13px] font-medium leading-5 text-ink-800 transition hover:text-accent focus-visible:rounded focus-visible:outline-2 focus-visible:outline-accent/40 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]"
                    onClick={() => onEdit(queuedMessage)}
                    title={label}
                  >
                    {label}
                  </button>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[10px] leading-4 text-ink-500">
                    <span className={index === 0 ? "font-semibold text-accent" : "font-medium text-ink-500"}>
                      {index === 0 ? "下一条" : `排队 ${index + 1}`}
                    </span>
                    {queuedMessage.attachments.length > 0 && (
                      <>
                        <span className="text-ink-400" aria-hidden="true">·</span>
                        <span>附件 {queuedMessage.attachments.length}</span>
                      </>
                    )}
                    {contextCount > 0 && (
                      <>
                        <span className="text-ink-400" aria-hidden="true">·</span>
                        <span>上下文 {contextCount}</span>
                      </>
                    )}
                    <span className="text-ink-400" aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatShortTime(queuedMessage.createdAt)}</span>
                  </div>
                </div>
                <div className="queued-message-actions flex min-w-0 items-center justify-end gap-0.5">
                  {isRunning && (
                    <button
                      type="button"
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-accent-subtle px-2 text-[11px] font-semibold text-accent transition hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-accent/40"
                      onClick={() => onAppend(queuedMessage)}
                      title="把这条消息作为补充命令插入当前执行"
                    >
                      <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      插入
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-ink-600 transition-colors hover:bg-surface-tertiary hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-accent/40"
                    onClick={() => onEdit(queuedMessage)}
                    aria-label={`编辑排队消息 ${index + 1}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    编辑
                  </button>
                  <button
                    type="button"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-error-light/70 hover:text-error focus-visible:outline-2 focus-visible:outline-error/30"
                    onClick={() => onRemove(queuedMessage.id)}
                    aria-label={`移除排队消息 ${index + 1}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: PromptAttachment[];
  onRemove: (attachmentId: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex max-w-full items-center gap-2 rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs text-ink-700">
          <span className="shrink-0 rounded-full bg-accent/18 px-2 py-0.5 text-[11px] text-[#ffb290]">
            {attachment.kind === "image" ? "图片" : "文本"}
          </span>
          <span className="truncate max-w-[180px]">{attachment.name}</span>
          <button
            type="button"
            className="rounded-full p-1 text-muted hover:bg-black/5 hover:text-ink-700"
            onClick={() => onRemove(attachment.id)}
            aria-label={`移除附件 ${attachment.name}`}
          >
            <RemoveIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

export function MessageFileReferenceChips({
  messageReferences,
  fileReferences,
  onRemoveMessage,
  onRemoveFile,
  onClear,
}: {
  messageReferences: MessageReferenceDraft[];
  fileReferences: FileReferenceDraft[];
  onRemoveMessage: (referenceId: string) => void;
  onRemoveFile: (referenceId: string) => void;
  onClear: () => void;
}) {
  if (messageReferences.length === 0 && fileReferences.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {messageReferences.map((reference, index) => (
        <ComposerContextCard
          key={reference.id}
          index={index + 1}
          tone="message"
          label="消息"
          title={getMessageReferenceLabel(reference)}
          meta={`${estimateTokensFromText(reference.text)} tok`}
          detail={`${reference.sourceRole}${reference.capturedAt ? ` · ${formatShortTime(reference.capturedAt)}` : ""}\n${reference.text}`}
          onCopy={() => void copyText(reference.text)}
          onRemove={() => onRemoveMessage(reference.id)}
        />
      ))}
      {fileReferences.map((reference, index) => (
        <ComposerContextCard
          key={reference.id}
          index={messageReferences.length + index + 1}
          tone="file"
          label={reference.kind === "directory" ? "目录" : "文件"}
          title={reference.label}
          meta="路径引用"
          detail={`${reference.workspaceRoot}\n${reference.path}`}
          onOpen={() => {
            if (reference.kind === "file") {
              window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath: reference.path } }));
            }
          }}
          onCopy={() => void copyText(reference.path)}
          onRemove={() => onRemoveFile(reference.id)}
        />
      ))}
      {(messageReferences.length > 1 || fileReferences.length > 1) && (
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700"
          onClick={onClear}
        >
          清空消息/文件引用
        </button>
      )}
    </div>
  );
}

export function CodeReferenceChips({
  codeReferences,
  editingId,
  editingComment,
  onEditingCommentChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onClear,
}: {
  codeReferences: CodeReferenceDraft[];
  editingId: string | null;
  editingComment: string;
  onEditingCommentChange: (comment: string) => void;
  onStartEdit: (reference: CodeReferenceDraft) => void;
  onSaveEdit: (referenceId: string, comment: string) => void;
  onCancelEdit: () => void;
  onRemove: (referenceId: string) => void;
  onClear: () => void;
}) {
  if (codeReferences.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {codeReferences.map((reference, index) => {
        const isEditing = editingId === reference.id;
        return (
          <div
            key={reference.id}
            className={`inline-flex min-h-9 max-w-[360px] items-center gap-1.5 rounded-full border border-[#d0d7de] bg-white px-2.5 text-xs font-semibold text-ink-800 shadow-[0_8px_18px_rgba(15,18,24,0.07)] ${isEditing ? "py-1" : ""}`}
            title={`页面地址：${reference.filePath}\n行号：L${getCodeReferenceLineLabel(reference)}\n${reference.comment ?? "代码引用会随消息一起发送"}`}
          >
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${reference.kind === "comment" ? "bg-[#bf3989]" : "bg-[#0969da]"}`}>
              {index + 1}
            </span>
            <span className="shrink-0 rounded-md bg-[#f6f8fa] px-1.5 py-0.5 text-[10px] text-[#57606a]">
              {reference.kind === "comment" ? "评论" : "代码"}
            </span>
            <button
              type="button"
              className="min-w-0 truncate text-left text-xs font-semibold text-[#0969da] hover:underline"
              onClick={() => window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath: reference.filePath, startLine: reference.startLine } }))}
              title={`跳回预览里的代码位置：${reference.filePath}:L${getCodeReferenceLineLabel(reference)}`}
            >
              {getCodeReferenceFileLabel(reference)} · L{getCodeReferenceLineLabel(reference)}
            </button>
            {isEditing ? (
              <input
                value={editingComment}
                onChange={(event) => onEditingCommentChange(event.target.value)}
                className="h-7 w-40 min-w-0 flex-1 rounded-full border border-black/10 bg-surface-secondary px-2 text-xs font-medium text-ink-800 outline-none focus:border-accent"
                placeholder="给这段代码补一句说明"
              />
            ) : reference.comment ? (
              <span className="min-w-0 truncate text-left text-xs font-medium text-muted">
                {reference.comment}
              </span>
            ) : null}
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/10"
                  onClick={() => onSaveEdit(reference.id, editingComment)}
                  aria-label={`保存代码引用 ${index + 1} 评论`}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-[10px] font-semibold text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                  onClick={onCancelEdit}
                  aria-label={`取消编辑代码引用 ${index + 1} 评论`}
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                onClick={() => onStartEdit(reference)}
                aria-label={`编辑代码引用 ${index + 1} 评论`}
              >
                ✎
              </button>
            )}
            <button
              type="button"
              className="rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
              onClick={() => void copyText(`${reference.filePath}:L${getCodeReferenceLineLabel(reference)}\n${reference.code}`)}
              aria-label={`复制代码引用 ${index + 1}`}
            >
              ⧉
            </button>
            <button
              type="button"
              className="rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
              onClick={() => onRemove(reference.id)}
              aria-label={`移除代码引用 ${index + 1}`}
            >
              <RemoveIcon />
            </button>
          </div>
        );
      })}
      {codeReferences.length > 1 && (
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700"
          onClick={onClear}
        >
          清空代码引用
        </button>
      )}
    </div>
  );
}

export function BrowserAnnotationChips({
  annotations,
  onRemove,
  onClear,
}: {
  annotations: BrowserAnnotationPromptInput[];
  onRemove: (annotationId: string) => void;
  onClear: () => void;
}) {
  if (annotations.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {annotations.slice().reverse().map((annotation, index) => {
        const label = getBrowserAnnotationLabel(annotation, index);
        return (
          <div
            key={annotation.id}
            role="button"
            tabIndex={0}
            className="inline-flex h-10 max-w-[280px] cursor-pointer items-center gap-2 rounded-full border border-black/8 bg-white px-3 text-sm font-semibold text-ink-800 shadow-[0_10px_24px_rgba(15,18,24,0.08)] transition hover:border-accent/20"
            title={getBrowserAnnotationHoverTitle(annotation)}
            onClick={() => {
              if (annotation.url) {
                window.dispatchEvent(new CustomEvent(OPEN_BROWSER_WORKBENCH_URL_EVENT, { detail: { url: annotation.url } }));
              }
            }}
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <span className="min-w-0 truncate">{label}</span>
            <span className="hidden max-w-[90px] truncate text-[11px] font-medium text-muted sm:inline">
              {annotation.title || annotation.url}
            </span>
            <button
              type="button"
              className="ml-1 rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(annotation.id);
              }}
              aria-label={`移除浏览器批注 ${index + 1}`}
            >
              <RemoveIcon />
            </button>
          </div>
        );
      })}
      {annotations.length > 1 && (
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700"
          onClick={onClear}
        >
          清空
        </button>
      )}
    </div>
  );
}

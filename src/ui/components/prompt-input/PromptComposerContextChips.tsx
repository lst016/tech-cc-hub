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
  if (queue.length === 0) return null;

  return (
    <div className="mb-3 min-w-0 overflow-hidden rounded-2xl border border-black/6 bg-[#f6f8fb] px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="shrink-0 text-xs font-medium text-ink-700">待发送队列 · {queue.length} 条</div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] text-muted">
          <span className="min-w-0">运行中可点「插入」作为补充命令；空闲后会自动续发。</span>
          <button
            type="button"
            className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 font-semibold transition hover:text-accent"
            onClick={onClear}
          >
            清空队列
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        {queue.map((queuedMessage, index) => {
          const contextCount = countStructuredContextBlocks(queuedMessage.prompt);
          const promptPreview = getQueuedPromptPreview(queuedMessage.prompt, contextCount);
          const label = promptPreview
            || (queuedMessage.attachments.length === 1
              ? `附件：${queuedMessage.attachments[0].name}`
              : `${queuedMessage.attachments.length} 个附件`);

          return (
            <div key={queuedMessage.id} className="group grid min-w-0 grid-cols-[auto,minmax(0,1fr)] items-start gap-x-2 gap-y-2 overflow-hidden rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs text-ink-700 transition hover:border-accent/18 hover:shadow-[0_10px_24px_rgba(30,38,52,0.06)] sm:grid-cols-[auto,minmax(0,1fr),auto]">
              <span className="mt-0.5 shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">
                {index === 0 ? "下一条" : `排队 ${index + 1}`}
              </span>
              <button
                type="button"
                className="min-w-0 overflow-hidden text-left leading-5 transition hover:text-accent [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]"
                onClick={() => onEdit(queuedMessage)}
                title={label}
              >
                {label}
              </button>
              <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:col-span-1 sm:justify-end">
                {queuedMessage.attachments.length > 0 && (
                  <span className="shrink-0 rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11px] text-muted">
                    附件 {queuedMessage.attachments.length}
                  </span>
                )}
                {contextCount > 0 && (
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    上下文 {contextCount}
                  </span>
                )}
                <span className="shrink-0 text-[11px] text-muted">{formatShortTime(queuedMessage.createdAt)}</span>
                {isRunning && (
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-accent/18 bg-accent/8 px-2.5 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/14"
                    onClick={() => onAppend(queuedMessage)}
                    title="把这条消息作为补充命令插入当前执行"
                  >
                    插入
                  </button>
                )}
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-black/6 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-700 shadow-sm transition-colors hover:border-accent/20 hover:bg-accent/8 hover:text-accent"
                  onClick={() => onEdit(queuedMessage)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                  onClick={() => onRemove(queuedMessage.id)}
                  aria-label="移除待发送消息"
                >
                  <RemoveIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
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

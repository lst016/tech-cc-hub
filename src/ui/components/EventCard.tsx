import { memo, useEffect, useMemo, useRef, useState } from "react";
import type {
  PermissionResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, StreamMessage } from "../types";
import type { PermissionRequest } from "../store/useAppStore";
import { useAppStore } from "../store/useAppStore";
import MDContent from "../render/markdown";
import { DecisionPanel } from "./DecisionPanel";
import { resolveImageAttachmentSrc } from "../../shared/attachments";
import { copyTextToClipboard as copyText } from "../utils/clipboard";
import { PREVIEW_OPEN_FILE_EVENT, PROMPT_FOCUS_EVENT } from "../events";

type MessageContent = SDKAssistantMessage["message"]["content"][number];
type ToolResultContent = SDKUserMessage["message"]["content"][number];
type ToolStatus = "pending" | "success" | "error";

type SystemInitMessage = SDKMessage & {
  subtype?: string;
  session_id?: string;
  model?: string;
  permissionMode?: string;
  cwd?: string;
};

type AskUserQuestionInput = {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
};

type BrowserAnnotationsPayload = {
  count?: number;
  items?: unknown[];
};

type BrowserAnnotationSummary = {
  index: number;
  label: string;
};

const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
const MAX_VISIBLE_LINES = 8;
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const setToolStatus = (toolUseId: string | undefined, status: ToolStatus) => {
  if (!toolUseId) return;
  toolStatusMap.set(toolUseId, status);
  toolStatusListeners.forEach((listener) => listener());
};

const useToolStatus = (toolUseId: string | undefined) => {
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolUseId ? toolStatusMap.get(toolUseId) : undefined,
  );

  useEffect(() => {
    if (!toolUseId) return;
    const handleUpdate = () => setStatus(toolStatusMap.get(toolUseId));
    toolStatusListeners.add(handleUpdate);
    return () => {
      toolStatusListeners.delete(handleUpdate);
    };
  }, [toolUseId]);

  return status;
};

const getRecordString = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  return typeof value === "string" ? value : null;
};

const formatTime = (value?: number) => {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `${hh}:${mm}`;
  }
  return `${date.getMonth() + 1}-${date.getDate()} ${hh}:${mm}`;
};

const formatMinutes = (ms: number | undefined) =>
  typeof ms !== "number" ? "-" : `${(ms / 60000).toFixed(2)} min`;

const formatUsd = (usd: number | undefined) =>
  typeof usd !== "number" ? "-" : `$${usd.toFixed(2)}`;

const formatTokens = (tokens: number | undefined) => {
  if (typeof tokens !== "number") return "-";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(4)} M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)} k`;
  return String(tokens);
};

const compactPreview = (text: string, limit = 160) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
};

const getSkillDisplayName = (input: Record<string, unknown>) => {
  for (const key of ["skill", "skillName", "name", "id"]) {
    const value = getRecordString(input, key)?.trim();
    if (value) return value.replace(/^\/+/, "");
  }

  const pathValue =
    getRecordString(input, "skill_path") ||
    getRecordString(input, "skillPath") ||
    getRecordString(input, "file_path") ||
    getRecordString(input, "path");
  if (pathValue) {
    const normalized = pathValue.replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const parent = parts[parts.length - 2];
    if (last?.toLowerCase() === "skill.md" && parent) return parent;
    if (last) return last.replace(/^\/+/, "");
  }

  const text = getRecordString(input, "description") || getRecordString(input, "prompt") || "";
  const match = text.match(/\/([A-Za-z0-9_.-]+)\s+skill/i) || text.match(/skill[:\s`"']+\/?([A-Za-z0-9_.-]+)/i);
  return match?.[1] || null;
};

const appendTextToComposer = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  const { prompt, setPrompt } = useAppStore.getState();
  setPrompt(prompt.trim() ? `${prompt.trim()}\n\n${trimmed}` : trimmed);
  window.dispatchEvent(new CustomEvent(PROMPT_FOCUS_EVENT));
};

const appendMessageReferenceToComposer = (
  text: string,
  sourceRole: "user" | "assistant" | "tool" | "system",
  sourceLabel: string,
  kind: "selection" | "message" = "message",
  capturedAt?: number,
) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  const { activeSessionId, addMessageReference } = useAppStore.getState();
  addMessageReference(activeSessionId, {
    kind,
    sourceRole,
    sourceLabel,
    text: trimmed,
    capturedAt,
  });
  window.dispatchEvent(new CustomEvent(PROMPT_FOCUS_EVENT));
};

const StatusDot = ({
  variant = "accent",
  active = false,
}: {
  variant?: "accent" | "success" | "error" | "muted";
  active?: boolean;
}) => {
  const colorClass =
    variant === "success"
      ? "bg-emerald-500"
      : variant === "error"
        ? "bg-red-500"
        : variant === "muted"
          ? "bg-slate-300"
          : "bg-accent";

  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {active && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", colorClass)} />}
      <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", colorClass)} />
    </span>
  );
};

const SectionLabel = ({
  children,
  active = false,
  variant = "muted",
}: {
  children: string;
  active?: boolean;
  variant?: "accent" | "success" | "error" | "muted";
}) => (
  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
    <StatusDot variant={variant} active={active} />
    <span>{children}</span>
  </div>
);

const IconButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="grid h-7 w-7 place-items-center rounded-full border border-black/8 bg-white/80 text-[13px] text-muted opacity-0 shadow-sm transition hover:border-accent/30 hover:text-accent group-hover:opacity-100"
  >
    {label === "复制" ? "⧉" : label === "引用" ? "↩" : "⋯"}
  </button>
);

const getAskUserQuestionSignature = (input?: AskUserQuestionInput | null) => {
  if (!input?.questions?.length) return "";
  return input.questions
    .map((question) => {
      const options = (question.options ?? []).map((option) => `${option.label}|${option.description ?? ""}`).join(",");
      return `${question.question}|${question.header ?? ""}|${question.multiSelect ? "1" : "0"}|${options}`;
    })
    .join("||");
};

export function isMarkdown(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const patterns: RegExp[] = [/^#{1,6}\s+/m, /```[\s\S]*?```/, /^\s*[-*]\s+/m, /^\s*\d+\.\s+/m, /\|.+\|/];
  return patterns.some((pattern) => pattern.test(text));
}

function extractTagContent(input: string, tag: string): string | null {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
}

type ThoughtBlock = {
  label: string;
  text: string;
};

function extractThoughtBlocks(input: string): { visibleText: string; thoughts: ThoughtBlock[] } {
  if (!input.trim()) return { visibleText: input, thoughts: [] };

  let visibleText = input;
  const thoughts: ThoughtBlock[] = [];
  const taggedPatterns: Array<{ label: string; pattern: RegExp }> = [
    { label: "思考过程", pattern: /<thinking>([\s\S]*?)<\/thinking>/gi },
    { label: "思考过程", pattern: /<think>([\s\S]*?)<\/think>/gi },
    { label: "分析过程", pattern: /<analysis>([\s\S]*?)<\/analysis>/gi },
  ];

  taggedPatterns.forEach(({ label, pattern }) => {
    visibleText = visibleText.replace(pattern, (_match, content: string) => {
      const text = content.trim();
      if (text) thoughts.push({ label, text });
      return "";
    });
  });

  visibleText = visibleText.replace(/```(?:thinking|thought|analysis)\s*\n([\s\S]*?)```/gi, (_match, content: string) => {
    const text = content.trim();
    if (text) thoughts.push({ label: "思考过程", text });
    return "";
  });

  return {
    visibleText: visibleText.replace(/\n{3,}/g, "\n\n").trim(),
    thoughts,
  };
}

const getBrowserAnnotationSummaryLabel = (item: unknown, index: number): string => {
  if (!item || typeof item !== "object") return `标注 ${index + 1}`;
  const record = item as Record<string, unknown>;
  const comment = typeof record.comment === "string" ? record.comment.trim() : "";
  if (comment) return comment;

  const target = record.target && typeof record.target === "object" ? (record.target as Record<string, unknown>) : null;
  if (target?.type === "text" && typeof target.value === "string" && target.value.trim()) return target.value.trim();
  if (target?.type === "image") return (typeof target.alt === "string" && target.alt.trim()) || "图片";

  const dom = record.dom && typeof record.dom === "object" ? (record.dom as Record<string, unknown>) : null;
  const domContext = dom?.context && typeof dom.context === "object" ? (dom.context as Record<string, unknown>) : null;
  const nearbyText = typeof domContext?.nearbyText === "string" ? domContext.nearbyText.trim() : "";
  if (nearbyText) return nearbyText.slice(0, 60);

  const page = record.page && typeof record.page === "object" ? (record.page as Record<string, unknown>) : null;
  const pageTitle = typeof page?.title === "string" ? page.title.trim() : "";
  if (pageTitle) return pageTitle;

  const pageUrl = typeof page?.url === "string" ? page.url.trim() : "";
  if (pageUrl) {
    try {
      const hostname = new URL(pageUrl).hostname;
      return hostname;
    } catch {
      return pageUrl.slice(0, 50);
    }
  }

  return typeof dom?.selector === "string" && dom.selector ? dom.selector : `标注 ${index + 1}`;
};

function extractBrowserAnnotationsPrompt(prompt: string): {
  visiblePrompt: string;
  annotations: BrowserAnnotationSummary[];
} {
  const blocks = Array.from(prompt.matchAll(/<browser_annotations>\s*([\s\S]*?)\s*<\/browser_annotations>/g));
  if (blocks.length === 0) {
    return { visiblePrompt: prompt, annotations: [] };
  }

  const annotations = blocks.reduce<BrowserAnnotationSummary[]>((items, block) => {
    try {
      const payload = JSON.parse(block[1]) as BrowserAnnotationsPayload;
      if (Array.isArray(payload.items)) {
        payload.items.forEach((item) => {
          items.push({
            index: items.length + 1,
            label: getBrowserAnnotationSummaryLabel(item, items.length),
          });
        });
        return items;
      }
      if (typeof payload.count === "number") {
        for (let index = 0; index < payload.count; index += 1) {
          items.push({ index: items.length + 1, label: `标注 ${items.length + 1}` });
        }
        return items;
      }
    } catch {
      items.push({ index: items.length + 1, label: `标注 ${items.length + 1}` });
      return items;
    }
    items.push({ index: items.length + 1, label: `标注 ${items.length + 1}` });
    return items;
  }, []);

  return {
    visiblePrompt: prompt.replace(/<browser_annotations>[\s\S]*?<\/browser_annotations>/g, "").trim(),
    annotations,
  };
}

const BrowserAnnotationChip = ({ annotation }: { annotation: BrowserAnnotationSummary }) => (
  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-accent/15 bg-white/90 px-3 py-2 text-sm font-semibold text-ink-800 shadow-[0_10px_24px_rgba(210,106,61,0.08)]">
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
      {annotation.index}
    </span>
    <span className="truncate">{annotation.label}</span>
  </div>
);

const AttachmentChip = ({ attachment }: { attachment: PromptAttachment }) => (
  <div className="rounded-2xl border border-black/6 bg-[#eef2f8] px-3 py-2">
    <div className="truncate text-xs font-semibold text-ink-800">{attachment.name}</div>
    <div className="mt-1 text-[11px] text-muted">{attachment.kind === "image" ? "图片附件" : "文本附件"}</div>
  </div>
);

const CollapsibleText = ({
  text,
  className,
  maxLines = MAX_VISIBLE_LINES,
  renderMarkdown = false,
  referenceSourceRole = "assistant",
  referenceSourceLabel = "聊天选区",
  referenceCapturedAt,
}: {
  text: string;
  className?: string;
  maxLines?: number;
  renderMarkdown?: boolean;
  referenceSourceRole?: "user" | "assistant" | "tool" | "system";
  referenceSourceLabel?: string;
  referenceCapturedAt?: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectionDraft, setSelectionDraft] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => text.split("\n"), [text]);
  const hasMore = lines.length > maxLines || text.length > 1400;
  const visibleText = hasMore && !expanded ? lines.slice(0, maxLines).join("\n") : text;

  const handleSelectionCapture = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    if (!selection || selectedText.length === 0 || selection.rangeCount === 0) {
      setSelectionDraft(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if ((anchorNode && !container.contains(anchorNode)) || (focusNode && !container.contains(focusNode))) {
      setSelectionDraft(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    setSelectionDraft({
      text: selectedText,
      x: rect.left + rect.width / 2,
      y: Math.max(12, rect.top - 38),
    });
  };

  useEffect(() => {
    if (!selectionDraft) return;
    const clearSelectionDraft = (event?: Event) => {
      if (event?.target && containerRef.current?.contains(event.target as Node)) return;
      setSelectionDraft(null);
    };

    window.addEventListener("mousedown", clearSelectionDraft);
    window.addEventListener("scroll", clearSelectionDraft, true);
    window.addEventListener("resize", clearSelectionDraft);
    return () => {
      window.removeEventListener("mousedown", clearSelectionDraft);
      window.removeEventListener("scroll", clearSelectionDraft, true);
      window.removeEventListener("resize", clearSelectionDraft);
    };
  }, [selectionDraft]);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseUp={handleSelectionCapture}
      onKeyUp={handleSelectionCapture}
    >
      {selectionDraft && (
        <button
          type="button"
          className="fixed z-[80] inline-flex h-8 items-center gap-1 rounded-full border border-accent/24 bg-white/96 px-3 text-xs font-semibold text-accent shadow-[0_12px_30px_rgba(15,18,24,0.18)] transition hover:border-accent/42 hover:bg-accent/8"
          style={{ left: selectionDraft.x, top: selectionDraft.y, transform: "translateX(-50%)" }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            appendMessageReferenceToComposer(
              selectionDraft.text,
              referenceSourceRole,
              referenceSourceLabel,
              "selection",
              referenceCapturedAt,
            );
            setSelectionDraft(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <span>↩</span>
          <span>引用选区</span>
        </button>
      )}
      {renderMarkdown ? (
        <MDContent text={visibleText} />
      ) : (
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-5">{visibleText}</pre>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-accent/20 bg-white/80 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/8"
        >
          <span>{expanded ? "收起" : `展开剩余 ${Math.max(lines.length - maxLines, 1)} 行`}</span>
        </button>
      )}
    </div>
  );
};

const ThoughtDisplay = ({
  thoughts,
  showIndicator = false,
}: {
  thoughts: ThoughtBlock[];
  showIndicator?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(() => compactPreview(thoughts.map((item) => item.text).join("\n"), 72), [thoughts]);

  if (thoughts.length === 0) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-[20px] border border-[#d0d7de] bg-[#f6f8fa]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-[#57606a] transition hover:bg-white/72"
      >
        <StatusDot variant="success" active={showIndicator} />
        <span className="font-semibold uppercase tracking-[0.16em]">Thought</span>
        <span className="min-w-0 flex-1 truncate">{expanded ? "已展开思考过程" : preview}</span>
        <span className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold">
          {expanded ? "收起" : "展开"}
        </span>
      </button>
      {expanded && (
        <div className="grid gap-3 border-t border-[#d0d7de] bg-white px-4 py-3">
          {thoughts.map((thought, index) => (
            <div key={`${thought.label}-${index}`} className="rounded-2xl border border-black/6 bg-[#f6f8fa] px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold text-[#57606a]">
                {thought.label} {thoughts.length > 1 ? index + 1 : ""}
              </div>
              <CollapsibleText
                text={thought.text}
                maxLines={10}
                renderMarkdown={isMarkdown(thought.text)}
                referenceSourceRole="assistant"
                referenceSourceLabel={thought.label}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UserMessageCard = ({
  message,
  showIndicator = false,
}: {
  message: { type: "user_prompt"; prompt: string; attachments?: PromptAttachment[]; capturedAt?: number };
  showIndicator?: boolean;
}) => {
  const { visiblePrompt, annotations } = useMemo(() => extractBrowserAnnotationsPrompt(message.prompt), [message.prompt]);
  const hasVisiblePrompt = visiblePrompt.trim().length > 0;
  const hasAttachments = Boolean(message.attachments?.length);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);

  return (
    <div className="group mt-5 flex flex-col items-end">
      <SectionLabel active={showIndicator} variant="accent">用户</SectionLabel>
      <div className="flex w-full justify-end gap-2">
        <IconButton
          label="引用"
          onClick={() => appendMessageReferenceToComposer(visiblePrompt || message.prompt, "user", "用户消息", "message", message.capturedAt)}
        />
        <IconButton label="复制" onClick={() => void copyText(visiblePrompt || message.prompt)} />
        {hasVisiblePrompt ? (
          <div className="max-w-[78%] rounded-[26px] rounded-tr-[8px] border border-accent/16 bg-[linear-gradient(180deg,rgba(253,244,241,0.98),rgba(255,255,255,0.96))] px-5 py-4 text-ink-800 shadow-[0_18px_34px_rgba(210,106,61,0.08)]">
            <CollapsibleText
              text={visiblePrompt}
              renderMarkdown
              maxLines={24}
              referenceSourceRole="user"
              referenceSourceLabel="用户消息"
              referenceCapturedAt={message.capturedAt}
            />
          </div>
        ) : !hasAttachments && annotations.length === 0 ? (
          <div className="max-w-[78%] rounded-[22px] border border-black/6 bg-[#eef2f8] px-4 py-3 text-sm text-muted">
            已发送附件
          </div>
        ) : null}
      </div>
      <div className="mt-1 h-5 text-[11px] text-muted opacity-0 transition group-hover:opacity-100">
        {formatTime(message.capturedAt)}
      </div>
      {annotations.length > 0 && (
        <div className="mt-2 flex w-full max-w-[78%] flex-wrap justify-end gap-2">
          {annotations.map((annotation) => (
            <BrowserAnnotationChip key={annotation.index} annotation={annotation} />
          ))}
        </div>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-3 grid w-full max-w-[78%] gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {message.attachments.map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} />
            ))}
          </div>
          {message.attachments.map((attachment) => {
            if (attachment.kind === "image") {
              const imageSrc = resolveImageAttachmentSrc(attachment);
              return (
                <div key={`${attachment.id}-preview`} className="overflow-hidden rounded-2xl border border-black/6 bg-[#eef2f8] p-2">
                  <button type="button" className="block w-full" onClick={() => setLightboxImage({ src: imageSrc, name: attachment.name })}>
                    <img src={imageSrc} alt={attachment.name} className="max-h-64 w-full rounded-xl object-contain" />
                  </button>
                </div>
              );
            }

            return (
              <div key={`${attachment.id}-preview`} className="rounded-2xl border border-black/6 bg-[#eef2f8] p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
                  <span>{attachment.name}</span>
                  <button
                    type="button"
                    className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] transition hover:text-accent"
                    onClick={() => void copyText(attachment.preview || attachment.data)}
                  >
                    复制文本
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm text-ink-700">
                  {attachment.preview || attachment.data}
                </pre>
              </div>
            );
          })}
        </div>
      )}
      {lightboxImage && (
        <button
          type="button"
          className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-8"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage.src} alt={lightboxImage.name} className="max-h-full max-w-full rounded-2xl bg-white object-contain shadow-2xl" />
        </button>
      )}
    </div>
  );
};

const AssistantTextCard = ({
  title,
  text,
  showIndicator = false,
  tone = "normal",
}: {
  title: string;
  text: string;
  showIndicator?: boolean;
  tone?: "normal" | "thinking";
}) => {
  const [expanded, setExpanded] = useState(tone !== "thinking");
  const thoughtExtraction = useMemo(() => extractThoughtBlocks(text), [text]);
  const visibleAssistantText = thoughtExtraction.visibleText || text;

  if (tone === "thinking") {
    return (
      <div className="group mt-5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mb-2 flex w-full items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
        >
          <StatusDot variant="success" active={showIndicator} />
          <span>{title}</span>
          <span className="ml-auto rounded-full border border-black/8 bg-white/70 px-2 py-0.5 text-[11px] normal-case tracking-normal">
            {expanded ? "收起" : compactPreview(text, 48)}
          </span>
        </button>
        {expanded && (
          <div className="rounded-[22px] border border-black/6 bg-[#f4f7fb] px-4 py-3 text-sm text-ink-700">
            <CollapsibleText
              text={text}
              renderMarkdown={isMarkdown(text)}
              referenceSourceRole="assistant"
              referenceSourceLabel={title}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group mt-5">
      <SectionLabel active={showIndicator} variant="success">{title}</SectionLabel>
      <ThoughtDisplay thoughts={thoughtExtraction.thoughts} showIndicator={showIndicator} />
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 rounded-[26px] rounded-tl-[8px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.94))] px-5 py-4 text-ink-800 shadow-[0_14px_30px_rgba(30,38,52,0.055)]">
          <MDContent text={visibleAssistantText} />
        </div>
        <IconButton label="引用" onClick={() => appendMessageReferenceToComposer(visibleAssistantText, "assistant", title)} />
        <IconButton label="复制" onClick={() => void copyText(visibleAssistantText)} />
      </div>
    </div>
  );
};

const getToolLabel = (name: string) => {
  const map: Record<string, string> = {
    Bash: "命令",
    Read: "读取",
    Write: "写入",
    Edit: "编辑",
    MultiEdit: "批量编辑",
    Grep: "搜索",
    Glob: "匹配",
    WebFetch: "网页抓取",
    WebSearch: "网页搜索",
    Task: "子 Agent",
    Agent: "子 Agent",
    TodoWrite: "计划更新",
    Browser: "浏览器",
    AskUserQuestion: "向你提问",
  };
  return map[name] ?? name;
};

const getToolSummary = (messageContent: Extract<MessageContent, { type: "tool_use" }>) => {
  const input = (messageContent.input ?? {}) as Record<string, unknown>;
  switch (messageContent.name) {
    case "Bash":
      return getRecordString(input, "command");
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return getRecordString(input, "file_path") || getRecordString(input, "path");
    case "Glob":
    case "Grep":
      return [getRecordString(input, "pattern"), getRecordString(input, "path")].filter(Boolean).join(" · ");
    case "WebFetch":
      return getRecordString(input, "url");
    case "WebSearch":
      return getRecordString(input, "query");
    case "Skill":
      return getSkillDisplayName(input);
    case "Task":
    case "Agent":
      return getRecordString(input, "description") || getRecordString(input, "prompt");
    default:
      return getRecordString(input, "description") || getRecordString(input, "query") || getRecordString(input, "url");
  }
};

type ToolGroupSummaryModel = {
  total: number;
  labels: Array<{ label: string; count: number }>;
};

const buildToolGroupSummary = (contents: MessageContent[]): ToolGroupSummaryModel | null => {
  const counts = new Map<string, number>();
  contents.forEach((content) => {
    if (content.type !== "tool_use" || content.name === "AskUserQuestion") return;
    const label = getToolLabel(content.name);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  if (total < 2) return null;
  return {
    total,
    labels: Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
  };
};

const ToolGroupSummary = ({ summary }: { summary: ToolGroupSummaryModel | null }) => {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;
  const shortLabel = summary.labels.map((item) => `${item.label} ${item.count}`).join(" · ");

  return (
    <div className="mt-4 overflow-hidden rounded-[20px] border border-black/6 bg-white/88 shadow-[0_10px_22px_rgba(30,38,52,0.035)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700"
        onClick={() => setExpanded((value) => !value)}
      >
        <StatusDot variant="accent" />
        <span className="font-semibold">工具摘要</span>
        <span className="min-w-0 flex-1 truncate">本轮使用 {summary.total} 个工具：{shortLabel}</span>
        <span className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
          {expanded ? "收起" : "展开"}
        </span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-2 border-t border-black/6 px-4 py-3">
          {summary.labels.map((item) => (
            <span key={item.label} className="rounded-full border border-accent/14 bg-accent/8 px-2.5 py-1 text-xs font-semibold text-accent">
              {item.label} · {item.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const ToolUseCard = ({
  messageContent,
  showIndicator = false,
}: {
  messageContent: MessageContent;
  showIndicator?: boolean;
}) => {
  const isToolUse = messageContent.type === "tool_use";
  const toolUseId = isToolUse ? messageContent.id : undefined;
  const toolStatus = useToolStatus(toolUseId);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (toolUseId && !toolStatusMap.has(toolUseId)) setToolStatus(toolUseId, "pending");
  }, [toolUseId]);

  if (!isToolUse) return null;

  const status = toolStatus ?? "pending";
  const summary = getToolSummary(messageContent);
  const rawInput = JSON.stringify(messageContent.input ?? {}, null, 2);
  const isAgentTool = messageContent.name === "Task" || messageContent.name === "Agent";
  const isPending = status === "pending";
  const statusText = status === "success" ? "完成" : status === "error" ? "失败" : "执行中";
  const statusClass =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-accent/20 bg-accent/8 text-accent";
  const input = (messageContent.input ?? {}) as Record<string, unknown>;
  const command = getRecordString(input, "command");
  const cwd = getRecordString(input, "cwd");
  const filePath = getRecordString(input, "file_path") || getRecordString(input, "path");
  const patch = getRecordString(input, "patch") || getRecordString(input, "diff");
  const query = getRecordString(input, "query");
  const url = getRecordString(input, "url");
  const todos = Array.isArray(input.todos) ? input.todos : Array.isArray(input.items) ? input.items : [];

  return (
    <div className={cx(
      "mt-3 overflow-hidden rounded-[22px] border shadow-[0_10px_22px_rgba(30,38,52,0.035)]",
      isAgentTool
        ? "border-accent/18 bg-[linear-gradient(180deg,rgba(255,248,244,0.94),rgba(255,255,255,0.86))]"
        : "border-black/6 bg-[#f4f7fb]",
    )}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <StatusDot variant={status === "error" ? "error" : status === "success" ? "success" : "accent"} active={isPending && showIndicator} />
        <span className="shrink-0 rounded-lg bg-white/80 px-2.5 py-1 text-sm font-semibold text-accent">
          {getToolLabel(messageContent.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{summary || messageContent.name}</span>
        <span className={cx("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusClass)}>
          {statusText}
        </span>
      </button>
      {isAgentTool && summary && (
        <div className="border-t border-accent/10 px-4 pb-3 text-xs leading-5 text-muted">
          子 Agent 会在后台执行这个子任务；需要看完整链路时，可以切到右侧「执行轨迹」。
        </div>
      )}
      {expanded && (
        <div className="border-t border-black/6 bg-white/52 px-4 py-3">
          {messageContent.name === "Bash" && command && (
            <div className="mb-3 rounded-2xl border border-black/6 bg-white px-3 py-2">
              <div className="mb-1 text-[11px] font-semibold text-muted">命令</div>
              <code className="block whitespace-pre-wrap break-words rounded-xl bg-[#f6f8fb] px-3 py-2 font-mono text-xs text-ink-800">{command}</code>
              {cwd && <div className="mt-2 text-[11px] text-muted">cwd: {cwd}</div>}
            </div>
          )}
          {["Read", "Write", "Edit", "MultiEdit"].includes(messageContent.name) && filePath && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs text-ink-700">
              <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">文件</span>
              <span className="min-w-0 flex-1 truncate" title={filePath}>{filePath}</span>
              <button
                type="button"
                className="rounded-full border border-black/8 bg-white px-2 py-0.5 font-semibold text-muted transition hover:text-accent"
                onClick={() => window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath } }))}
              >
                定位
              </button>
            </div>
          )}
          {patch && (
            <div className="mb-3 rounded-2xl border border-black/6 bg-white px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted">
                <span>Patch / Diff</span>
                <span>{patch.split("\n").filter((line) => line.startsWith("+")).length} 新增 · {patch.split("\n").filter((line) => line.startsWith("-")).length} 删除</span>
              </div>
              <CollapsibleText text={patch} maxLines={12} />
            </div>
          )}
          {(messageContent.name === "WebSearch" || messageContent.name === "WebFetch") && (query || url) && (
            <div className="mb-3 rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs text-ink-700">
              <span className="mr-2 rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
                {messageContent.name === "WebSearch" ? "搜索" : "网页"}
              </span>
              <span>{query || url}</span>
            </div>
          )}
          {messageContent.name === "TodoWrite" && todos.length > 0 && (
            <div className="mb-3 rounded-2xl border border-black/6 bg-white px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold text-muted">计划清单</div>
              <div className="grid gap-1">
                {todos.slice(0, 12).map((todo, index) => {
                  const record = todo && typeof todo === "object" ? todo as Record<string, unknown> : {};
                  const content = String(record.content ?? record.text ?? record.title ?? `步骤 ${index + 1}`);
                  const status = String(record.status ?? "");
                  return (
                    <div key={index} className="flex items-center gap-2 rounded-xl bg-[#f6f8fb] px-2 py-1.5 text-xs text-ink-700">
                      <span className={cx("h-2 w-2 rounded-full", status === "completed" ? "bg-emerald-500" : status === "in_progress" ? "bg-accent" : "bg-slate-300")} />
                      <span className="min-w-0 flex-1 truncate">{content}</span>
                      {status && <span className="shrink-0 text-muted">{status}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">输入参数</div>
            <button
              type="button"
              className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:border-accent/30 hover:text-accent"
              onClick={() => void copyText(rawInput)}
            >
              复制 JSON
            </button>
          </div>
          <CollapsibleText text={rawInput} maxLines={10} />
        </div>
      )}
    </div>
  );
};

const ToolResult = ({ messageContent }: { messageContent: ToolResultContent }) => {
  const isToolResult = typeof messageContent !== "string" && messageContent.type === "tool_result";
  const toolUseId = isToolResult ? messageContent.tool_use_id : undefined;
  const status: ToolStatus = isToolResult && messageContent.is_error ? "error" : "success";
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isToolResult) {
      setToolStatus(toolUseId, status);
    }
  }, [isToolResult, status, toolUseId]);

  if (!isToolResult) return null;

  const content = (() => {
    if (messageContent.is_error) {
      return extractTagContent(String(messageContent.content), "tool_use_error") || String(messageContent.content);
    }
    if (Array.isArray(messageContent.content)) {
      return messageContent.content
        .map((item) => (typeof item === "string" ? item : "text" in item ? item.text ?? "" : ""))
        .join("\n");
    }
    return String(messageContent.content);
  })();

  const isError = Boolean(messageContent.is_error);
  const isLong = content.length > 2400 || content.split("\n").length > 40;
  const visibleContent = isLong && !expanded ? `${content.slice(0, 2400)}\n\n...已截断，展开查看完整工具输出` : content;

  return (
    <div className="mt-3 rounded-[22px] border border-black/6 bg-[#f4f7fb] px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        <StatusDot variant={isError ? "error" : "success"} />
        <span>工具输出</span>
        <span className="ml-auto normal-case tracking-normal text-muted">{compactPreview(content, 64)}</span>
      </div>
      {isError && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-semibold">工具失败</span>
          <span className="min-w-0 flex-1">优先看失败步骤的上下文和错误正文，再决定是否让 Agent 修复。</span>
          <button
            type="button"
            className="rounded-full border border-red-200 bg-white px-2 py-0.5 font-semibold"
            onClick={() => void copyText(content)}
          >
            复制诊断
          </button>
          <button
            type="button"
            className="rounded-full border border-red-200 bg-white px-2 py-0.5 font-semibold"
            onClick={() => appendTextToComposer(`请根据这段工具失败诊断继续修复：\n\n${content.slice(0, 3000)}`)}
          >
            让 Agent 修复
          </button>
        </div>
      )}
      <CollapsibleText
        text={visibleContent}
        renderMarkdown={!isError && isMarkdown(content)}
        className={isError ? "text-red-600" : "text-ink-700"}
        referenceSourceRole="tool"
        referenceSourceLabel="工具输出"
      />
      {isLong && (
        <button
          type="button"
          className="mt-3 rounded-full border border-black/8 bg-white px-3 py-1 text-xs font-semibold text-muted transition hover:text-accent"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起长输出" : "展开完整输出"}
        </button>
      )}
    </div>
  );
};

const AskUserQuestionCard = ({
  messageContent,
  permissionRequest,
  onPermissionResult,
}: {
  messageContent: MessageContent;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
}) => {
  if (messageContent.type !== "tool_use") return null;

  const input = messageContent.input as AskUserQuestionInput | null;
  const questions = input?.questions ?? [];
  const currentSignature = getAskUserQuestionSignature(input);
  const requestSignature = getAskUserQuestionSignature(permissionRequest?.input as AskUserQuestionInput | undefined);
  const isActiveRequest = permissionRequest && currentSignature === requestSignature;

  if (isActiveRequest && onPermissionResult) {
    return (
      <div className="mt-4">
        <DecisionPanel
          request={permissionRequest}
          onSubmit={(result) => onPermissionResult(permissionRequest.toolUseId, result)}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[22px] border border-accent/16 bg-accent/8 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent">
        <StatusDot variant="accent" />
        <span>向你提问</span>
      </div>
      {questions.map((question, index) => (
        <div key={index} className="text-sm text-ink-700">
          {question.question}
        </div>
      ))}
    </div>
  );
};

const SystemInfoCard = ({ message, showIndicator = false }: { message: SDKMessage; showIndicator?: boolean }) => {
  if (message.type !== "system" || !("subtype" in message) || message.subtype !== "init") return null;

  const systemMsg = message as SystemInitMessage;

  return (
    <div className="mt-4 overflow-hidden rounded-[20px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,249,252,0.9))] px-4 py-3 shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
      <SectionLabel active={showIndicator} variant="success">系统初始化</SectionLabel>
      <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
        <InfoItem name="会话 ID" value={systemMsg.session_id || "-"} />
        <InfoItem name="模型" value={systemMsg.model || "-"} />
        <InfoItem name="权限" value={systemMsg.permissionMode || "-"} />
        <InfoItem name="目录" value={systemMsg.cwd || "-"} wide />
      </div>
    </div>
  );
};

const InfoItem = ({ name, value, wide = false }: { name: string; value: string; wide?: boolean }) => (
  <div
    className={cx(
      "min-w-0 rounded-xl border border-black/6 bg-white/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-accent/18 hover:bg-white/88",
      wide && "sm:col-span-2",
    )}
  >
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent/55" />
      <span>{name}</span>
    </div>
    <div className="mt-1.5 truncate font-mono text-[13px] leading-5 text-ink-800" title={value}>{value}</div>
  </div>
);

const SessionResult = ({ message }: { message: SDKResultMessage }) => {
  const costTitle = `这是 SDK 返回的 total_cost_usd 字段，使用 SDK 内置价格表估算；自定义代理/new-api/折扣倍率/缓存计费可能与它不一致，真实扣费请以 new-api 后台为准。`;

  return (
    <div className="mt-5">
      <SectionLabel variant="success">本轮结果</SectionLabel>
      <div className="rounded-[26px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,247,250,0.92))] px-4 py-4 shadow-[0_12px_26px_rgba(30,38,52,0.05)]">
        <div className="grid gap-2 sm:grid-cols-4">
          <MetricPill label="总耗时" value={formatMinutes(message.duration_ms)} />
          <MetricPill label="API 耗时" value={formatMinutes(message.duration_api_ms)} />
          <MetricPill label="输入" value={formatTokens(message.usage?.input_tokens)} />
          <MetricPill label="输出" value={formatTokens(message.usage?.output_tokens)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-800">用量</span>
          <span
            title={costTitle}
            className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700"
          >
            SDK返回估值 {formatUsd(message.total_cost_usd)}
          </span>
          <span className="text-xs text-muted">非真实扣费，new-api 账单为准</span>
        </div>
      </div>
    </div>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-[#eef2f8] px-3 py-2">
    <div className="text-[11px] font-semibold text-muted">{label}</div>
    <div className="mt-1 text-sm font-semibold text-ink-800">{value}</div>
  </div>
);

function MessageCardBase({
  message,
  isLast = false,
  isRunning = false,
  permissionRequest,
  onPermissionResult,
}: {
  message: StreamMessage;
  isLast?: boolean;
  isRunning?: boolean;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
}) {
  const showIndicator = isLast && isRunning;

  if (message.type === "user_prompt") {
    return <UserMessageCard message={message} showIndicator={showIndicator} />;
  }

  const sdkMessage = message as SDKMessage;

  if (sdkMessage.type === "system") {
    return <SystemInfoCard message={sdkMessage} showIndicator={showIndicator} />;
  }

  if (sdkMessage.type === "result") {
    if (sdkMessage.subtype === "success") {
      return <SessionResult message={sdkMessage} />;
    }
    return (
      <div className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        <div className="mb-2 text-sm font-semibold">会话错误</div>
        <pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(sdkMessage, null, 2)}</pre>
      </div>
    );
  }

  if (sdkMessage.type === "assistant") {
    const toolGroupSummary = buildToolGroupSummary(sdkMessage.message.content as MessageContent[]);
    return (
      <>
        <ToolGroupSummary summary={toolGroupSummary} />
        {sdkMessage.message.content.map((content: MessageContent, index: number) => {
          const isLastContent = index === sdkMessage.message.content.length - 1;
          if (content.type === "thinking") {
            return (
              <AssistantTextCard
                key={index}
                title="思考"
                text={content.thinking}
                tone="thinking"
                showIndicator={isLastContent && showIndicator}
              />
            );
          }
          if (content.type === "text") {
            return (
              <AssistantTextCard
                key={index}
                title="助手"
                text={content.text}
                showIndicator={isLastContent && showIndicator}
              />
            );
          }
          if (content.type === "tool_use") {
            if (content.name === "AskUserQuestion") {
              return (
                <AskUserQuestionCard
                  key={index}
                  messageContent={content}
                  permissionRequest={permissionRequest}
                  onPermissionResult={onPermissionResult}
                />
              );
            }
            return <ToolUseCard key={index} messageContent={content} showIndicator={isLastContent && showIndicator} />;
          }
          return null;
        })}
      </>
    );
  }

  if (sdkMessage.type === "user") {
    const contents = Array.isArray(sdkMessage.message.content)
      ? sdkMessage.message.content
      : [sdkMessage.message.content];
    return (
      <>
        {contents.map((content: ToolResultContent, index: number) => (
          <ToolResult key={index} messageContent={content} />
        ))}
      </>
    );
  }

  return null;
}

export const MessageCard = memo(MessageCardBase);
export { MessageCard as EventCard };

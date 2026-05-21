import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { OPEN_BROWSER_WORKBENCH_URL_EVENT, PREVIEW_OPEN_FILE_EVENT, PROMPT_FOCUS_EVENT } from "../events";
import { extractCodeReferencesPrompt, type CodeReferencePromptSummary } from "../utils/code-reference-prompt";

type MessageContent = SDKAssistantMessage["message"]["content"][number];
type ToolResultContent = SDKUserMessage["message"]["content"][number];
type ToolStatus = "pending" | "success" | "error";
type UserPromptRevisionHandler = (prompt: string, attachments: PromptAttachment[], historyId: string) => Promise<boolean> | boolean;

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

type BrowserAnnotationSourceCandidate = {
  component?: string;
  file?: string;
  line?: number;
  column?: number;
  framework?: string;
  source?: string;
  confidence?: string;
};

type BrowserAnnotationSummary = {
  index: number;
  label: string;
  comment?: string;
  expectation?: string;
  pageTitle?: string;
  pageUrl?: string;
  target?: string;
  selector?: string;
  xpath?: string;
  path?: string;
  componentStack?: string[];
  sourceCandidates?: BrowserAnnotationSourceCandidate[];
  componentStackConfidence?: string;
  position?: { x: number; y: number };
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
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className="grid h-7 w-7 place-items-center rounded-full border border-black/8 bg-white/80 text-[13px] text-muted opacity-0 shadow-sm transition hover:border-accent/30 hover:text-accent group-hover:opacity-100"
  >
    {label === "复制" ? "⧉" : label === "引用" ? "↩" : label === "修改" ? "✎" : "⋯"}
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

const getStringRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" ? value as Record<string, unknown> : null
);

const getTextSnippet = (value: unknown, maxLength = 90): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
};

const parseFirstJsonObject = (value: string): unknown | null => {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Browser annotation blocks include human-readable guidance before the JSON.
  }

  const start = trimmed.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, index + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
};

const getBrowserAnnotationTargetText = (value: unknown, maxLength = 120): string | undefined => {
  if (typeof value === "string") return getTextSnippet(value, maxLength);
  const record = getStringRecord(value);
  if (!record) return undefined;
  if (record.type === "text") return getTextSnippet(record.value, maxLength);
  if (record.type === "image") {
    return getTextSnippet(record.alt, maxLength) || getTextSnippet(record.url, maxLength) || "图片";
  }
  return getTextSnippet(record.value, maxLength)
    || getTextSnippet(record.text, maxLength)
    || getTextSnippet(record.label, maxLength)
    || getTextSnippet(record.alt, maxLength);
};

const formatBrowserAnnotationUrl = (url?: string) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
};

const formatBrowserAnnotationSource = (candidate: BrowserAnnotationSourceCandidate) => {
  const fileLine = [
    candidate.file,
    typeof candidate.line === "number" ? `:${candidate.line}` : "",
    typeof candidate.column === "number" ? `:${candidate.column}` : "",
  ].filter(Boolean).join("");
  const label = fileLine || candidate.component || candidate.source || "";
  const meta = [
    candidate.component && fileLine ? candidate.component : null,
    candidate.framework,
    candidate.confidence,
  ].filter(Boolean).join(" ");
  return meta ? `${label} (${meta})` : label;
};

const getBrowserAnnotationSummary = (item: unknown, index: number): BrowserAnnotationSummary => {
  if (!item || typeof item !== "object") return { index: index + 1, label: `标注 ${index + 1}` };
  const record = item as Record<string, unknown>;
  const comment = getTextSnippet(record.comment);
  const expectation = getTextSnippet(record.expectation, 160);

  const dom = getStringRecord(record.dom);
  const targetText = getBrowserAnnotationTargetText(record.target)
    || getBrowserAnnotationTargetText(dom?.target)
    || getTextSnippet(dom?.text, 120)
    || getTextSnippet(dom?.ariaLabel, 120);
  const domContext = getStringRecord(dom?.context);
  const nearbyText = getTextSnippet(domContext?.nearbyText, 120);

  const page = getStringRecord(record.page);
  const pageTitle = getTextSnippet(page?.title, 70);
  const pageUrl = getTextSnippet(page?.url, 140);
  const selector = getTextSnippet(dom?.selector, 120);
  const xpath = getTextSnippet(dom?.xpath, 120);
  const path = getTextSnippet(dom?.path, 120);
  const componentStack = Array.isArray(dom?.componentStack)
    ? dom.componentStack
      .map((name) => getTextSnippet(name, 60))
      .filter((name): name is string => Boolean(name))
      .slice(0, 8)
    : undefined;
  const sourceCandidates = Array.isArray(dom?.sourceCandidates)
    ? dom.sourceCandidates
      .map((candidate) => {
        const item = getStringRecord(candidate);
        if (!item) return null;
        const sourceCandidate: BrowserAnnotationSourceCandidate = {
          component: getTextSnippet(item.component, 80),
          file: getTextSnippet(item.file, 140),
          line: typeof item.line === "number" ? item.line : undefined,
          column: typeof item.column === "number" ? item.column : undefined,
          framework: getTextSnippet(item.framework, 20),
          source: getTextSnippet(item.source, 40),
          confidence: getTextSnippet(item.confidence, 20),
        };
        return sourceCandidate.component || sourceCandidate.file ? sourceCandidate : null;
      })
      .filter((candidate): candidate is BrowserAnnotationSourceCandidate => Boolean(candidate))
      .slice(0, 3)
    : undefined;
  const componentStackConfidence = getTextSnippet(dom?.componentStackConfidence, 20);

  const nodePosition = getStringRecord(record.nodePosition);
  const x = typeof nodePosition?.x === "number" ? nodePosition.x : undefined;
  const y = typeof nodePosition?.y === "number" ? nodePosition.y : undefined;
  const position = typeof x === "number" && typeof y === "number" ? { x, y } : undefined;

  const label = targetText
    || nearbyText
    || comment
    || expectation
    || pageTitle
    || formatBrowserAnnotationUrl(pageUrl)
    || selector
    || `标注 ${index + 1}`;

  return {
    index: index + 1,
    label,
    comment,
    expectation,
    pageTitle,
    pageUrl,
    target: targetText || nearbyText,
    selector,
    xpath,
    path,
    componentStack,
    sourceCandidates,
    componentStackConfidence,
    position,
  };
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
      const payload = parseFirstJsonObject(block[1]) as BrowserAnnotationsPayload | null;
      if (payload && Array.isArray(payload.items)) {
        payload.items.forEach((item) => {
          items.push(getBrowserAnnotationSummary(item, items.length));
        });
        return items;
      }
      if (payload && typeof payload.count === "number") {
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

const getBrowserAnnotationSourceTitle = (candidate?: BrowserAnnotationSourceCandidate) => {
  if (!candidate) return undefined;
  const fileName = candidate.file?.split(/[\\/]/).filter(Boolean).pop();
  if (fileName) {
    const lineLabel = typeof candidate.line === "number"
      ? ` · L${candidate.line}${typeof candidate.column === "number" ? `:${candidate.column}` : ""}`
      : "";
    return `${fileName}${lineLabel}`;
  }
  return candidate.component || candidate.source;
};

const openBrowserAnnotationPage = (url?: string) => {
  if (!url) return;
  window.dispatchEvent(new CustomEvent(OPEN_BROWSER_WORKBENCH_URL_EVENT, { detail: { url } }));
};

const openBrowserAnnotationSource = (candidate?: BrowserAnnotationSourceCandidate) => {
  if (!candidate?.file) return false;
  window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, {
    detail: { filePath: candidate.file, startLine: candidate.line },
  }));
  return true;
};

const annotationValueClassName =
  "min-w-0 overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]";

const BrowserAnnotationMetaRow = ({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) => (
  <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] gap-1">
    <span className="font-semibold text-ink-700">{label}</span>
    {children ?? (
      <span className={annotationValueClassName} title={value}>
        {value}
      </span>
    )}
  </div>
);

const BrowserAnnotationChip = ({ annotation }: { annotation: BrowserAnnotationSummary }) => {
  const source = annotation.sourceCandidates?.[0];
  const sourceTitle = getBrowserAnnotationSourceTitle(source);
  const pageLabel = formatBrowserAnnotationUrl(annotation.pageUrl);
  const headerLabel = annotation.target
    || annotation.label
    || annotation.comment
    || annotation.pageTitle
    || pageLabel
    || `浏览器标注 ${annotation.index}`;
  const locatorPreview = annotation.selector || annotation.xpath || annotation.path;
  const pageText = annotation.pageUrl
    ? `${annotation.pageTitle ? `${annotation.pageTitle} · ` : ""}${pageLabel || annotation.pageUrl}`
    : undefined;
  const title = [
    annotation.target ? `元素：${annotation.target}` : null,
    annotation.comment,
    annotation.expectation ? `期望：${annotation.expectation}` : null,
    source ? formatBrowserAnnotationSource(source) : null,
    annotation.pageUrl,
    annotation.selector,
    annotation.xpath,
    annotation.path,
  ].filter(Boolean).join("\n");
  const hasDetail = Boolean(
    annotation.comment
    || annotation.expectation
    || annotation.target
    || locatorPreview
    || (pageText && sourceTitle)
    || annotation.position
  );

  return (
    <div className="w-full max-w-[min(680px,100%)] min-w-0 overflow-hidden rounded-2xl border border-accent/15 bg-white/94 px-3 py-3 text-left text-xs text-ink-800 shadow-[0_10px_24px_rgba(210,106,61,0.08)]" title={title}>
      <div className="flex min-w-0 items-center gap-2 overflow-hidden text-sm font-semibold">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
          {annotation.index}
        </span>
        <span className="shrink-0 rounded-md bg-[#fff7ed] px-1.5 py-0.5 text-[10px] text-[#9a3412]">
          元素
        </span>
        {source?.file || annotation.pageUrl ? (
          <button
            type="button"
            className="min-w-0 truncate text-left text-accent transition hover:underline"
            onClick={() => {
              if (!openBrowserAnnotationSource(source)) {
                openBrowserAnnotationPage(annotation.pageUrl);
              }
            }}
            title={headerLabel}
          >
            {headerLabel}
          </button>
        ) : (
          <span className="min-w-0 truncate" title={headerLabel}>{headerLabel}</span>
        )}
      </div>
      <div className="mt-2 grid gap-1.5 text-[11px] leading-5 text-muted">
        {annotation.target && (
          <BrowserAnnotationMetaRow label="内容" value={annotation.target} />
        )}
        {annotation.comment && (
          <BrowserAnnotationMetaRow label="说明" value={annotation.comment} />
        )}
        {annotation.expectation && (
          <BrowserAnnotationMetaRow label="期望" value={annotation.expectation} />
        )}
        {locatorPreview && (
          <code className="block max-h-20 max-w-full overflow-auto whitespace-pre-wrap rounded-xl bg-[#fff7ed] px-2.5 py-2 text-[10px] leading-4 text-[#7c2d12] [overflow-wrap:anywhere]" title={locatorPreview}>
            {compactPreview(locatorPreview, 180)}
          </code>
        )}
        {sourceTitle && source && (
          <BrowserAnnotationMetaRow label="来源" value={formatBrowserAnnotationSource(source)} />
        )}
        {pageText && (
          <BrowserAnnotationMetaRow label="页面">
            <button
              type="button"
              className={`${annotationValueClassName} text-left text-accent transition hover:underline`}
              onClick={() => openBrowserAnnotationPage(annotation.pageUrl)}
              title={pageText}
            >
              {pageText}
            </button>
          </BrowserAnnotationMetaRow>
        )}
        {annotation.position && (
          <BrowserAnnotationMetaRow label="坐标" value={`x ${annotation.position.x}, y ${annotation.position.y}`} />
        )}
        {!hasDetail && (
          <BrowserAnnotationMetaRow label="提示" value="这条浏览器标注没有保存元素内容，可回到页面重新标注一次。" />
        )}
      </div>
    </div>
  );
};

const getCodeReferenceLineLabel = (reference: CodeReferencePromptSummary) => {
  if (reference.rangeLabel) return reference.rangeLabel;
  if (typeof reference.startLine !== "number") return "";
  return reference.startLine === reference.endLine || typeof reference.endLine !== "number"
    ? `${reference.startLine}`
    : `${reference.startLine}-${reference.endLine}`;
};

const CodeReferenceChip = ({ reference }: { reference: CodeReferencePromptSummary }) => {
  const lineLabel = getCodeReferenceLineLabel(reference);
  const title = [
    reference.filePath,
    lineLabel ? `L${lineLabel}` : null,
    reference.comment,
  ].filter(Boolean).join("\n");

  return (
    <div className="max-w-full rounded-2xl border border-[#0969da]/15 bg-white/94 px-3 py-3 text-left text-xs text-ink-800 shadow-[0_10px_24px_rgba(9,105,218,0.08)]" title={title}>
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${reference.kind === "comment" ? "bg-[#bf3989]" : "bg-[#0969da]"}`}>
          {reference.index}
        </span>
        <span className="shrink-0 rounded-md bg-[#f6f8fa] px-1.5 py-0.5 text-[10px] text-[#57606a]">
          {reference.kind === "comment" ? "评论" : "代码"}
        </span>
        {reference.filePath ? (
          <button
            type="button"
            className="min-w-0 truncate text-left text-[#0969da] transition hover:underline"
            onClick={() => window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, {
              detail: { filePath: reference.filePath, startLine: reference.startLine },
            }))}
          >
            {reference.fileName || reference.filePath}{lineLabel ? ` · L${lineLabel}` : ""}
          </button>
        ) : (
          <span className="min-w-0 truncate">{lineLabel ? `L${lineLabel}` : `代码引用 ${reference.index}`}</span>
        )}
      </div>
      {(reference.comment || reference.selectionPreview) && (
        <div className="mt-2 grid gap-1.5 text-[11px] leading-5 text-muted">
          {reference.comment && (
            <div className="min-w-0">
              <span className="font-semibold text-ink-700">说明 </span>
              <span className="break-words">{reference.comment}</span>
            </div>
          )}
          {reference.selectionPreview && (
            <code className="block max-h-20 overflow-hidden whitespace-pre-wrap break-words rounded-xl bg-[#f6f8fa] px-2.5 py-2 text-[10px] leading-4 text-[#57606a]">
              {compactPreview(reference.selectionPreview, 180)}
            </code>
          )}
        </div>
      )}
    </div>
  );
};

const isSyntheticAttachmentPrompt = (text: string) => {
  const normalized = text.trim().replace(/\s+/g, " ");
  return /^The user uploaded (?:an image|\d+ images?)\b/i.test(normalized);
};

const extractPromptContextBlocks = (prompt: string) => (
  Array.from(prompt.matchAll(/<(browser_annotations|code_references)>[\s\S]*?<\/\1>/g), (match) => match[0].trim())
    .filter(Boolean)
);

const buildRevisedPromptWithContext = (visiblePrompt: string, contextBlocks: string[]) => (
  contextBlocks.length > 0
    ? `${visiblePrompt}\n\n${contextBlocks.join("\n\n")}`
    : visiblePrompt
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
      className={cx("min-w-0 max-w-full [overflow-wrap:anywhere]", className)}
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
        <pre className="m-0 max-w-full whitespace-pre-wrap break-words font-mono text-[12px] leading-5 [overflow-wrap:anywhere]">{visibleText}</pre>
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
  revisionDisabled = false,
  onRevisePrompt,
}: {
  message: { type: "user_prompt"; prompt: string; attachments?: PromptAttachment[]; capturedAt?: number; historyId?: string };
  showIndicator?: boolean;
  revisionDisabled?: boolean;
  onRevisePrompt?: UserPromptRevisionHandler;
}) => {
  const { visiblePrompt, annotations, codeReferences } = useMemo(() => {
    const browserResult = extractBrowserAnnotationsPrompt(message.prompt);
    const codeResult = extractCodeReferencesPrompt(browserResult.visiblePrompt);
    return {
      visiblePrompt: codeResult.visiblePrompt,
      annotations: browserResult.annotations,
      codeReferences: codeResult.codeReferences,
    };
  }, [message.prompt]);
  const hasVisiblePrompt = visiblePrompt.trim().length > 0;
  const hasAttachments = Boolean(message.attachments?.length);
  const shouldHidePromptBubble = hasAttachments && isSyntheticAttachmentPrompt(visiblePrompt);
  const editablePrompt = visiblePrompt || message.prompt;
  const promptContextBlocks = useMemo(() => extractPromptContextBlocks(message.prompt), [message.prompt]);
  const canRevisePrompt = hasVisiblePrompt && !shouldHidePromptBubble && Boolean(message.historyId) && Boolean(onRevisePrompt) && !revisionDisabled;
  const [isEditing, setIsEditing] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState("");
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const end = editor.value.length;
    editor.setSelectionRange(end, end);
  }, [isEditing]);

  const startRevision = () => {
    setRevisionDraft(editablePrompt);
    setIsEditing(true);
  };

  const cancelRevision = () => {
    setIsEditing(false);
    setRevisionDraft("");
    setRevisionSubmitting(false);
  };

  const handleRevise = () => {
    startRevision();
  };

  const submitRevision = async () => {
    const trimmedDraft = revisionDraft.trim();
    if (!trimmedDraft || !message.historyId || !onRevisePrompt || revisionSubmitting) return;
    setRevisionSubmitting(true);
    const revisedPrompt = buildRevisedPromptWithContext(trimmedDraft, promptContextBlocks);
    const sent = await onRevisePrompt(revisedPrompt, message.attachments ?? [], message.historyId);
    if (sent) {
      setIsEditing(false);
      setRevisionDraft("");
    }
    setRevisionSubmitting(false);
  };

  useEffect(() => {
    if (!lightboxImage) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const preventScroll = (event: WheelEvent | TouchEvent) => {
      event.preventDefault();
    };

    document.addEventListener("wheel", preventScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", preventScroll, { capture: true, passive: false });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.removeEventListener("wheel", preventScroll, { capture: true });
      document.removeEventListener("touchmove", preventScroll, { capture: true });
    };
  }, [lightboxImage]);

  return (
    <div className="group mt-5 flex flex-col items-end">
      <SectionLabel active={showIndicator} variant="accent">用户</SectionLabel>
      <div className="flex w-full justify-end gap-2">
        {!isEditing && canRevisePrompt && <IconButton label="修改" onClick={handleRevise} />}
        {!isEditing && (
          <>
            <IconButton
              label="引用"
              onClick={() => appendMessageReferenceToComposer(visiblePrompt || message.prompt, "user", "用户消息", "message", message.capturedAt)}
            />
            <IconButton label="复制" onClick={() => void copyText(visiblePrompt || message.prompt)} />
          </>
        )}
        {isEditing ? (
          <form
            className="w-full max-w-[78%] rounded-[26px] rounded-tr-[8px] border border-accent/20 bg-white px-4 py-3 shadow-[0_18px_34px_rgba(210,106,61,0.10)]"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRevision();
            }}
          >
            <textarea
              ref={editorRef}
              value={revisionDraft}
              onChange={(event) => setRevisionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRevision();
                  return;
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void submitRevision();
                }
              }}
              className="max-h-[38vh] min-h-28 w-full resize-y rounded-[18px] border border-black/8 bg-[#fbfcfe] px-4 py-3 text-sm leading-6 text-ink-800 outline-none transition focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-accent/30 hover:text-accent"
                onClick={cancelRevision}
                disabled={revisionSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!revisionDraft.trim() || revisionSubmitting}
              >
                发送
              </button>
            </div>
          </form>
        ) : hasVisiblePrompt && !shouldHidePromptBubble ? (
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
        ) : !hasAttachments && annotations.length === 0 && codeReferences.length === 0 ? (
          <div className="max-w-[78%] rounded-[22px] border border-black/6 bg-[#eef2f8] px-4 py-3 text-sm text-muted">
            已发送附件
          </div>
        ) : null}
      </div>
      <div className="mt-1 h-5 text-[11px] text-muted opacity-0 transition group-hover:opacity-100">
        {formatTime(message.capturedAt)}
      </div>
      {annotations.length > 0 && (
        <div className="mt-2 grid w-full max-w-[78%] min-w-0 justify-items-end gap-2 overflow-hidden">
          {annotations.map((annotation) => (
            <BrowserAnnotationChip key={annotation.index} annotation={annotation} />
          ))}
        </div>
      )}
      {codeReferences.length > 0 && (
        <div className="mt-2 grid w-full max-w-[78%] gap-2">
          {codeReferences.map((reference) => (
            <CodeReferenceChip key={`${reference.index}:${reference.filePath ?? "unknown"}:${reference.rangeLabel ?? ""}`} reference={reference} />
          ))}
        </div>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <div className="chat-attachment-list mt-2 grid w-full max-w-[78%] gap-2">
          {message.attachments.map((attachment) => {
            if (attachment.kind === "image") {
              const imageSrc = resolveImageAttachmentSrc(attachment);
              return (
                <div key={`${attachment.id}-preview`} className="overflow-hidden rounded-2xl border border-black/6 bg-[#eef2f8] px-2 py-2">
                  <button
                    type="button"
                    className="chat-attachment-image-row flex w-full min-w-0 items-center gap-3 text-left"
                    onClick={() => setLightboxImage({ src: imageSrc, name: attachment.name })}
                  >
                    <span className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/6 bg-white">
                      <img src={imageSrc} alt={attachment.name} className="chat-attachment-image-thumb block max-h-full max-w-full object-contain" />
                    </span>
                    <span className="chat-attachment-meta flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-accent">图片</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-800">{attachment.name}</span>
                    </span>
                  </button>
                </div>
              );
            }

            return (
              <div key={`${attachment.id}-preview`} className="rounded-2xl border border-black/6 bg-[#eef2f8] p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-accent">文本</span>
                    <span className="min-w-0 truncate">{attachment.name}</span>
                  </div>
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
      {lightboxImage && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.name}
          className="fixed inset-0 z-[2147483647] flex h-dvh w-dvw items-center justify-center overflow-hidden bg-black/70 p-8"
          onClick={() => setLightboxImage(null)}
          onWheel={(event) => event.preventDefault()}
          onTouchMove={(event) => event.preventDefault()}
        >
          {lightboxImage.src ? (
            <div
              className="flex h-[min(82vh,760px)] w-[min(88vw,1100px)] items-center justify-center overflow-hidden rounded-2xl bg-black/20"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={lightboxImage.src}
                alt={lightboxImage.name}
                className="block max-h-full max-w-full object-contain shadow-2xl"
                draggable={false}
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-white px-5 py-4 text-sm text-ink-700 shadow-2xl">
              图片预览地址为空
            </div>
          )}
        </div>,
        document.body,
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
        <div
          className="min-w-0 flex-1 rounded-[26px] rounded-tl-[8px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.94))] px-5 py-4 text-ink-800 shadow-[0_14px_30px_rgba(30,38,52,0.055)]"
        >
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

const ToolProcessGroup = ({
  contents,
  showIndicator = false,
}: {
  contents: Array<Extract<MessageContent, { type: "tool_use" }>>;
  showIndicator?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  if (contents.length === 0) return null;

  const firstContent = contents[0]!;
  const summary = buildToolGroupSummary(contents);
  const shortLabel = summary
    ? summary.labels.map((item) => `${item.label} ${item.count}`).join(" · ")
    : `${getToolLabel(firstContent.name)} · ${getToolSummary(firstContent) || firstContent.name}`;

  return (
    <div className="mt-3 overflow-hidden rounded-[22px] border border-black/6 bg-white/72 shadow-[0_10px_22px_rgba(30,38,52,0.03)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <StatusDot variant="accent" active={showIndicator && !expanded} />
        <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-accent">过程明细</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {contents.length} 个工具调用 · {shortLabel}
        </span>
        <span className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
          {expanded ? "收起" : "查看"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-black/6 px-3 pb-3">
          {contents.map((content, index) => (
            <ToolUseCard
              key={content.id || index}
              messageContent={content}
              showIndicator={showIndicator && index === contents.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const isToolResultContent = (content: ToolResultContent): content is Extract<ToolResultContent, { type: "tool_result" }> =>
  typeof content !== "string" && content.type === "tool_result";

const getToolResultStatus = (messageContent: Extract<ToolResultContent, { type: "tool_result" }>): ToolStatus =>
  messageContent.is_error ? "error" : "success";

const getToolResultDisplayContent = (messageContent: Extract<ToolResultContent, { type: "tool_result" }>): string => {
  if (messageContent.is_error) {
    return extractTagContent(String(messageContent.content), "tool_use_error") || String(messageContent.content);
  }
  if (Array.isArray(messageContent.content)) {
    return messageContent.content
      .map((item) => (typeof item === "string" ? item : "text" in item ? item.text ?? "" : ""))
      .join("\n");
  }
  return String(messageContent.content);
};

const ToolResult = ({ messageContent }: { messageContent: ToolResultContent }) => {
  const isToolResult = isToolResultContent(messageContent);
  const toolUseId = isToolResult ? messageContent.tool_use_id : undefined;
  const status: ToolStatus = isToolResult ? getToolResultStatus(messageContent) : "success";
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isToolResult) {
      setToolStatus(toolUseId, status);
    }
  }, [isToolResult, status, toolUseId]);

  if (!isToolResult) return null;

  const content = getToolResultDisplayContent(messageContent);

  const isError = Boolean(messageContent.is_error);
  const preview = compactPreview(content, 100);

  return (
    <div className="mt-3 rounded-[22px] border border-black/6 bg-[#f4f7fb] px-4 py-3">
      <div className="flex items-center gap-2">
        <StatusDot variant={isError ? "error" : "success"} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">工具输出</span>
        <span className="min-w-0 flex-1 truncate text-[11px] normal-case tracking-normal text-muted">{preview}</span>
        <button
          type="button"
          className="shrink-0 grid h-5 w-5 place-items-center rounded-full border border-black/8 bg-white text-muted transition hover:border-accent/30 hover:text-accent"
          onClick={() => setExpanded((value) => !value)}
        >
          <svg
            className={cx("h-3 w-3 transition-transform", expanded && "rotate-180")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      {isError && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
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
      {expanded && (
        <div className="mt-3 border-t border-black/6 pt-3">
          <CollapsibleText
            text={content}
            renderMarkdown={!isError && isMarkdown(content)}
            className={isError ? "text-red-600" : "text-ink-700"}
            referenceSourceRole="tool"
            referenceSourceLabel="工具输出"
          />
        </div>
      )}
    </div>
  );
};

const ToolResultGroup = ({ contents }: { contents: ToolResultContent[] }) => {
  const [expanded, setExpanded] = useState(false);
  const toolResults = useMemo(() => contents.filter(isToolResultContent), [contents]);

  useEffect(() => {
    toolResults.forEach((content) => {
      setToolStatus(content.tool_use_id, getToolResultStatus(content));
    });
  }, [toolResults]);

  if (toolResults.length === 0) return null;

  const hasError = toolResults.some((content) => content.is_error);
  const preview = compactPreview(
    toolResults.map((content) => getToolResultDisplayContent(content)).filter(Boolean).join("\n"),
    100,
  );

  return (
    <div className={cx(
      "mt-3 overflow-hidden rounded-[22px] border px-4 py-3",
      hasError ? "border-red-200 bg-red-50" : "border-black/6 bg-[#f4f7fb]",
    )}>
      <div className="flex items-center gap-2">
        <StatusDot variant={hasError ? "error" : "success"} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">过程输出</span>
        <span className="min-w-0 flex-1 truncate text-[11px] normal-case tracking-normal text-muted">
          {toolResults.length} 条工具返回{hasError ? " · 有失败" : ""}{preview ? ` · ${preview}` : ""}
        </span>
        <button
          type="button"
          className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:border-accent/30 hover:text-accent"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起" : "查看"}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-black/6 pt-1">
          {toolResults.map((content, index) => (
            <ToolResult key={`${content.tool_use_id ?? "tool-result"}-${index}`} messageContent={content} />
          ))}
        </div>
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
        <InfoItem name="目录" value={systemMsg.cwd || "-"} />
      </div>
    </div>
  );
};

const InfoItem = ({ name, value, wide = false }: { name: string; value: string; wide?: boolean }) => (
  <div
    className={cx(
      "min-w-0 overflow-hidden rounded-xl border border-black/6 bg-white/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-accent/18 hover:bg-white/88",
      wide && "sm:col-span-2",
    )}
  >
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent/55" />
      <span>{name}</span>
    </div>
    <div className="mt-1.5 min-w-0 overflow-hidden truncate whitespace-nowrap font-mono text-[13px] leading-5 text-ink-800" title={value}>{value}</div>
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
          <span className="text-xs text-muted">非真实扣费</span>
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
  onReviseUserPrompt,
}: {
  message: StreamMessage;
  isLast?: boolean;
  isRunning?: boolean;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
  onReviseUserPrompt?: UserPromptRevisionHandler;
}) {
  const showIndicator = isLast && isRunning;

  if (message.type === "user_prompt") {
    return (
      <UserMessageCard
        message={message}
        showIndicator={showIndicator}
        revisionDisabled={isRunning}
        onRevisePrompt={onReviseUserPrompt}
      />
    );
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
    const messageContents = sdkMessage.message.content as MessageContent[];
    const processToolContents = messageContents.filter((content): content is Extract<MessageContent, { type: "tool_use" }> =>
      content.type === "tool_use" && content.name !== "AskUserQuestion",
    );
    const firstProcessToolIndex = messageContents.findIndex((content) =>
      content.type === "tool_use" && content.name !== "AskUserQuestion",
    );

    return (
      <>
        {messageContents.map((content: MessageContent, index: number) => {
          const isLastContent = index === messageContents.length - 1;
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
            if (index !== firstProcessToolIndex) {
              return null;
            }
            return (
              <ToolProcessGroup
                key="tool-process-group"
                contents={processToolContents}
                showIndicator={showIndicator}
              />
            );
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
    return <ToolResultGroup contents={contents as ToolResultContent[]} />;
  }

  return null;
}

export const MessageCard = memo(MessageCardBase);
export { MessageCard as EventCard };

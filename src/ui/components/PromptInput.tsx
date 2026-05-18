import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { ArrowUp, Menu, Sparkles, Square } from "lucide-react";
import type {
  ApiConfigProfile,
  ClientEvent,
  PromptAttachment,
  RuntimeOverrides,
  RuntimeReasoningMode,
} from "../types";
import {
  getCodeReferenceSessionKey,
  useAppStore,
  type CodeReferenceDraft,
  type FileReferenceDraft,
  type MessageReferenceDraft,
  type PermissionRequest,
} from "../store/useAppStore";
import { copyTextToClipboard as copyText } from "../utils/clipboard";
import { resetBrowserWorkbenchAnnotationState } from "../utils/browser-annotation-reset";
import { getSlashCommandContext, getSlashCommandQuery, isCompletedSlashCommandContext, isDismissedSlashCommandQuery } from "../utils/slash-command-input";
import { buildSlashCommandDisplayParts, type SlashCommandDisplayPart, serializeSlashCommandDraft } from "../utils/slash-command-display";
import { getPromptParagraphInputAction, insertTextIntoPrompt, resolvePromptEditorInputCursor, shouldBlockPromptEnterAfterComposition, shouldInsertPromptNewline, shouldSubmitPromptOnEnter } from "../utils/prompt-editor-keyboard";
import {
  ADD_PROMPT_ATTACHMENT_EVENT,
  OPEN_BROWSER_WORKBENCH_URL_EVENT,
  PREVIEW_OPEN_FILE_EVENT,
  PROMPT_FOCUS_EVENT,
  PROMPT_SENT_EVENT,
  PROMPT_SUBMIT_EVENT,
  type AddPromptAttachmentDetail,
} from "../events";
import { ComposerContextCard } from "./ComposerContextCard";
import { DecisionPanel } from "./DecisionPanel";
import { ModelSelect } from "./ModelSelect";
import { getAvailableModelsForProfiles, getEnabledProfiles } from "./settings/settings-utils";

const DEFAULT_ALLOWED_TOOLS = "*";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;
const IME_ENTER_GRACE_MS = 120;
const SESSION_TITLE_TIMEOUT_MS = 1800;
const FILE_MENTION_PREVIEW_LIMIT = 10;
const FILE_MENTION_SCAN_LIMIT = 260;
const FILE_MENTION_SCAN_DEPTH = 4;
const FILE_MENTION_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "node_modules",
]);
const EMPTY_CODE_REFERENCES: CodeReferenceDraft[] = [];
const EMPTY_FILE_REFERENCES: FileReferenceDraft[] = [];
const EMPTY_MESSAGE_REFERENCES: MessageReferenceDraft[] = [];

type SlashCommandOption = {
  name: string;
  description?: string;
};

type SlashCommandPayloadItem = string | SlashCommandOption;

type PromptOptimizeResult = {
  success: boolean;
  optimizedPrompt?: string;
  model?: string;
  error?: string;
};

async function generateSessionTitleOrFallback(titleSeed: string): Promise<string> {
  if (!titleSeed.trim()) return titleSeed;

  let timeoutId: number | undefined;
  try {
    const generatedTitle = await Promise.race([
      window.electron.generateSessionTitle(titleSeed),
      new Promise<string>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(titleSeed), SESSION_TITLE_TIMEOUT_MS);
      }),
    ]);
    const trimmedTitle = generatedTitle.trim();
    return trimmedTitle || titleSeed;
  } catch (error) {
    console.warn("Falling back to draft title after title generation failed:", error);
    return titleSeed;
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

function normalizeSlashCommandList(commands?: SlashCommandPayloadItem[]): SlashCommandOption[] {
  const normalized = new Map<string, SlashCommandOption>();
  for (const command of commands ?? []) {
    const name = (typeof command === "string" ? command : command.name).replace(/^\//, "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = normalized.get(key);
    const description = typeof command === "string" ? undefined : command.description?.trim();
    normalized.set(key, {
      name: existing?.name ?? name,
      description: existing?.description || description || undefined,
    });
  }
  return Array.from(normalized.values());
}

function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
}

type FileMentionOption = {
  path: string;
  label: string;
  name: string;
  kind: "file" | "directory";
};

type FileMentionContext = {
  start: number;
  end: number;
  query: string;
};

type PreviewDirectoryEntry = {
  name?: string;
  path?: string;
  filePath?: string;
  type?: string;
  kind?: string;
  isDirectory?: boolean;
};

type PreviewDirectoryResponse =
  | PreviewDirectoryEntry[]
  | {
      success?: boolean;
      entries?: PreviewDirectoryEntry[];
      error?: string;
    };

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
  disabled?: boolean;
  leftOffset?: number;
  rightOffset?: number;
}

const MAX_TEXT_ATTACHMENT_LENGTH = 20_000;
const MAX_IMAGE_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.88;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const TEXT_FILE_PATTERN = /\.(txt|md|markdown|json|ya?ml|xml|svg|csv|tsv|log|js|jsx|ts|tsx|py|rb|java|go|rs|sh|css|html|sql|toml|ini|env)$/i;
const SVG_MIME_TYPE = "image/svg+xml";
const REASONING_OPTIONS: Array<{ value: RuntimeReasoningMode; label: string }> = [
  { value: "disabled", label: "关闭思考" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "xhigh", label: "超高" },
];

function buildBrowserAnnotationsPrompt(annotations: BrowserWorkbenchAnnotation[]) {
  if (annotations.length === 0) return "";
  const payload = {
    type: "browser_annotations",
    version: 1,
    count: annotations.length,
    items: annotations.slice().reverse().map((annotation, index) => ({
      type: "browser_annotation",
      index: index + 1,
      id: annotation.id,
      comment: annotation.comment?.trim() || "",
      expectation: annotation.expectation?.trim() || "",
      page: {
        url: annotation.url,
        title: annotation.title,
      },
      nodePosition: {
        x: Math.round(annotation.point.x),
        y: Math.round(annotation.point.y),
      },
      target: annotation.domHint?.target ?? (
        annotation.domHint?.text
          ? { type: "text", value: annotation.domHint.text }
          : undefined
      ),
      dom: annotation.domHint ? {
        tagName: annotation.domHint.tagName,
        role: annotation.domHint.role,
        ariaLabel: annotation.domHint.ariaLabel,
        selector: annotation.domHint.selector ?? annotation.domHint.selectorCandidates[0],
        selectorCandidates: annotation.domHint.selectorCandidates,
        path: annotation.domHint.path,
        xpath: annotation.domHint.xpath,
        boundingBox: annotation.domHint.boundingBox,
        componentStack: annotation.domHint.componentStack,
        sourceCandidates: annotation.domHint.sourceCandidates,
        componentStackSource: annotation.domHint.componentStackSource,
        componentStackConfidence: annotation.domHint.componentStackConfidence,
        context: annotation.domHint.context,
      } : undefined,
    })),
  };

  return [
    "<browser_annotations>",
    "This browser annotation block is the CURRENT DOM-targeting source of truth for the latest user request.",
    "Treat older screenshots, older browser annotations, and earlier modal/dialog work in resumed session history as stale unless the user explicitly asks to continue that same old target.",
    "Treat browser annotations as the primary DOM-targeting context for this request.",
    "Use page.url plus dom.selector/dom.xpath/dom.path before searching code by visible text.",
    "If an item has expectation, treat comment as the observed problem and expectation as the desired state.",
    "If dom.sourceCandidates exists, use high-confidence file/line candidates before broader search.",
    "If dom.componentStack exists, use those component names as the first code-location bridge before generic grep.",
    "If dom.context.ancestorChain or dom.context.nearbyText exists, use it to identify the page section before grepping generic button/link text.",
    "If the selector looks too generic, inspect the same page location or use xpath/path to resolve the real interactive element first.",
    "Only fall back to grep/searching for visible text when the DOM clues are clearly insufficient.",
    JSON.stringify(payload, null, 2),
    "</browser_annotations>",
  ].join("\n");
}

function mergePromptWithBrowserAnnotations(prompt: string, annotations: BrowserWorkbenchAnnotation[]) {
  const annotationPrompt = buildBrowserAnnotationsPrompt(annotations);
  if (!annotationPrompt) return prompt;
  return [prompt.trim(), annotationPrompt].filter(Boolean).join("\n\n");
}

function getBrowserAnnotationTargetLabel(annotation: BrowserWorkbenchAnnotation) {
  const target = annotation.domHint?.target;
  if (target?.type === "text" && target.value.trim()) return target.value.trim();
  if (target?.type === "image") return target.alt?.trim() || target.url?.trim() || "图片";
  const text = annotation.domHint?.text?.trim();
  if (text) return text;
  const ariaLabel = annotation.domHint?.ariaLabel?.trim();
  if (ariaLabel) return ariaLabel;
  const nearbyText = annotation.domHint?.context?.nearbyText?.trim();
  if (nearbyText) return nearbyText.slice(0, 90);
  return annotation.domHint?.selector || annotation.domHint?.path || "";
}

function getBrowserAnnotationLabel(annotation: BrowserWorkbenchAnnotation, index: number) {
  const targetLabel = getBrowserAnnotationTargetLabel(annotation);
  if (targetLabel) return targetLabel.slice(0, 80);
  const comment = annotation.comment?.trim();
  if (comment) return comment;
  const pageTitle = annotation.title?.trim();
  if (pageTitle) return pageTitle;
  if (annotation.url) {
    try {
      return new URL(annotation.url).hostname;
    } catch {
      return annotation.url.slice(0, 50);
    }
  }
  return annotation.domHint?.text?.trim() || annotation.domHint?.selector || `批注 ${index + 1}`;
}

function getBrowserAnnotationHoverTitle(annotation: BrowserWorkbenchAnnotation) {
  const targetLabel = getBrowserAnnotationTargetLabel(annotation);
  return [
    targetLabel ? `元素内容：${targetLabel}` : null,
    annotation.comment?.trim() ? `说明：${annotation.comment.trim()}` : null,
    annotation.expectation?.trim() ? `期望：${annotation.expectation.trim()}` : null,
    annotation.title || annotation.url ? `页面：${annotation.title || annotation.url}` : null,
    annotation.domHint?.selector ? `Selector：${annotation.domHint.selector}` : null,
    annotation.domHint?.xpath ? `XPath：${annotation.domHint.xpath}` : null,
    annotation.url,
  ].filter(Boolean).join("\n");
}

type InlineOption = {
  value: string;
  label: string;
};

function InlineDropdown({
  label,
  value,
  options,
  disabled,
  onChange,
  minWidthClass,
}: {
  label: string;
  value: string;
  options: InlineOption[];
  disabled: boolean;
  minWidthClass: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const displayLabel = options.find((option) => option.value === value)?.label ?? (options[0]?.label ?? "请选择");

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex h-8 ${minWidthClass} items-center justify-between gap-1 rounded-xl bg-white px-2 text-xs text-ink-700`}
    >
      <span
        className={`whitespace-nowrap text-muted ${disabled ? "" : "cursor-pointer select-none"}`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        {label}
      </span>
      <button
        type="button"
        className={`inline-flex h-7 min-w-[58px] items-center justify-between gap-1 rounded-lg bg-white px-2 text-[13px] text-ink-800 transition ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-secondary"}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className="max-w-[58px] truncate">{displayLabel}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""} text-ink-500`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="absolute right-0 bottom-full z-20 mb-2 w-full overflow-hidden rounded-xl border border-black/12 bg-white/98 shadow-lg">
          <div className="max-h-40 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`flex h-9 w-full items-center px-3 text-left text-sm transition ${option.value === value ? "bg-accent-subtle text-accent" : "text-ink-800 hover:bg-surface-secondary"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PROMPT_QUEUE_STORAGE_KEY = "tech-cc-hub:prompt-queue";

type QueuedMessageDraft = {
  id: string;
  prompt: string;
  attachments: PromptAttachment[];
  createdAt: number;
};

function readQueuedMessagesFromStorage(): Record<string, QueuedMessageDraft[]> {
  try {
    const stored = localStorage.getItem(PROMPT_QUEUE_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, QueuedMessageDraft[]>;
  } catch {
    return {};
  }
}

function writeQueuedMessagesToStorage(queueBySession: Record<string, QueuedMessageDraft[]>) {
  try {
    const allEmpty = Object.keys(queueBySession).every(
      (sessionId) => (queueBySession[sessionId] ?? []).length === 0,
    );
    if (allEmpty) {
      localStorage.removeItem(PROMPT_QUEUE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PROMPT_QUEUE_STORAGE_KEY, JSON.stringify(queueBySession));
  } catch (error) {
    console.warn("Failed to persist prompt queue:", error);
  }
}

function getCodeReferenceLineLabel(reference: CodeReferenceDraft) {
  return reference.startLine === reference.endLine
    ? `${reference.startLine}`
    : `${reference.startLine}-${reference.endLine}`;
}

function getCodeReferenceFileLabel(reference: CodeReferenceDraft) {
  return reference.fileName || reference.filePath.split(/[\\/]/).pop() || reference.filePath;
}

function buildCodeReferencesPrompt(references: CodeReferenceDraft[]) {
  if (references.length === 0) return "";

  const payload = {
    type: "code_references",
    version: 2,
    count: references.length,
    items: references.map((reference, index) => {
      const truncated = reference.code.length > 8000;
      return {
        type: reference.kind === "comment" ? "code_comment" : "code_selection",
        index: index + 1,
        id: reference.id,
        file: {
          path: reference.filePath,
          name: getCodeReferenceFileLabel(reference),
          language: reference.language || "plaintext",
        },
        range: {
          startLine: reference.startLine,
          endLine: reference.endLine,
          label: getCodeReferenceLineLabel(reference),
        },
        comment: reference.comment?.trim() || undefined,
        selection: {
          text: truncated ? `${reference.code.slice(0, 8000)}\n...<selection truncated>` : reference.code,
          truncated,
          originalLength: reference.code.length,
        },
      };
    }),
  };

  return [
    "<code_references>",
    "This structured block is the CURRENT code-selection source of truth from the Workspace Preview pane.",
    "Use file.path and range before searching broadly. Treat comments as user intent attached to that exact range.",
    JSON.stringify(payload, null, 2),
    "</code_references>",
  ].join("\n");
}

function mergePromptWithCodeReferences(prompt: string, references: CodeReferenceDraft[]) {
  const referencePrompt = buildCodeReferencesPrompt(references);
  if (!referencePrompt) return prompt;
  return [prompt.trim(), referencePrompt].filter(Boolean).join("\n\n");
}

function getMessageReferenceLabel(reference: MessageReferenceDraft) {
  return reference.kind === "selection" ? `${reference.sourceLabel} · 选区` : reference.sourceLabel;
}

function buildMessageReferencesPrompt(references: MessageReferenceDraft[]) {
  if (references.length === 0) return "";

  const payload = {
    type: "message_references",
    version: 1,
    count: references.length,
    items: references.map((reference, index) => {
      const truncated = reference.text.length > 6000;
      return {
        type: reference.kind === "selection" ? "message_selection" : "message_reference",
        index: index + 1,
        id: reference.id,
        source: {
          role: reference.sourceRole,
          label: reference.sourceLabel,
          capturedAt: reference.capturedAt,
        },
        selection: {
          text: truncated ? `${reference.text.slice(0, 6000)}\n...<message reference truncated>` : reference.text,
          truncated,
          originalLength: reference.text.length,
        },
      };
    }),
  };

  return [
    "<message_references>",
    "This structured block contains user-selected chat message context. Treat it as current user intent attached to the latest prompt.",
    JSON.stringify(payload, null, 2),
    "</message_references>",
  ].join("\n");
}

function mergePromptWithMessageReferences(prompt: string, references: MessageReferenceDraft[]) {
  const referencePrompt = buildMessageReferencesPrompt(references);
  if (!referencePrompt) return prompt;
  return [prompt.trim(), referencePrompt].filter(Boolean).join("\n\n");
}

function buildFileReferencesPrompt(references: FileReferenceDraft[]) {
  if (references.length === 0) return "";

  const payload = {
    type: "file_references",
    version: 1,
    count: references.length,
    items: references.map((reference, index) => ({
      type: reference.kind === "directory" ? "directory_reference" : "file_reference",
      index: index + 1,
      id: reference.id,
      file: {
        path: reference.path,
        name: reference.name,
        label: reference.label,
        kind: reference.kind,
        workspaceRoot: reference.workspaceRoot,
      },
    })),
  };

  return [
    "<file_references>",
    "This structured block contains explicit file or directory references selected through @ mention. Use paths before searching broadly.",
    JSON.stringify(payload, null, 2),
    "</file_references>",
  ].join("\n");
}

function mergePromptWithFileReferences(prompt: string, references: FileReferenceDraft[]) {
  const referencePrompt = buildFileReferencesPrompt(references);
  if (!referencePrompt) return prompt;
  return [prompt.trim(), referencePrompt].filter(Boolean).join("\n\n");
}

function normalizeMentionPath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function getRelativeMentionPath(workspaceRoot: string, filePath: string) {
  const normalizedRoot = normalizeMentionPath(workspaceRoot).replace(/\/$/, "");
  const normalizedPath = normalizeMentionPath(filePath);
  if (normalizedPath === normalizedRoot) return normalizedPath.split("/").pop() || normalizedPath;
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}

function getFileMentionContext(promptValue: string, cursorIndex: number): FileMentionContext | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, promptValue.length));
  const beforeCursor = promptValue.slice(0, safeCursor);
  const match = beforeCursor.match(/(^|[\s([{"'`，。；：！？])@([^\s@]*)$/u);
  if (!match) return null;
  const query = match[2] ?? "";
  return {
    start: safeCursor - query.length - 1,
    end: safeCursor,
    query,
  };
}

function getPromptTextFromEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node instanceof HTMLElement) {
    if (node.dataset.promptEditorSentinel) {
      return "";
    }
    const commandName = node.dataset.slashCommandName;
    if (commandName) {
      return `/${commandName}`;
    }
  }
  if (node instanceof HTMLBRElement) {
    return "\n";
  }

  let text = "";
  node.childNodes.forEach((child) => {
    text += getPromptTextFromEditorNode(child);
  });
  return text;
}

function getPromptTextFromEditor(editor: HTMLElement) {
  let text = "";
  editor.childNodes.forEach((child) => {
    text += getPromptTextFromEditorNode(child);
  });
  return text.replace(/\n+$/, "");
}

function getNodePromptLength(node: Node): number {
  return getPromptTextFromEditorNode(node).length;
}

function getEditorBoundaryOffset(editor: HTMLElement, targetNode: Node, targetOffset: number) {
  let offset = 0;
  let found = false;

  const visit = (node: Node) => {
    if (found) return;
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += Math.min(targetOffset, node.textContent?.length ?? 0);
      } else {
        for (let index = 0; index < Math.min(targetOffset, node.childNodes.length); index += 1) {
          offset += getNodePromptLength(node.childNodes[index]);
        }
      }
      found = true;
      return;
    }

    if (node instanceof HTMLElement && node.dataset.slashCommandName) {
      offset += getNodePromptLength(node);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE || node instanceof HTMLBRElement) {
      offset += getNodePromptLength(node);
      return;
    }

    node.childNodes.forEach(visit);
  };

  visit(editor);
  return offset;
}

function getSelectionOffsetInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getPromptTextFromEditor(editor).length;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return getPromptTextFromEditor(editor).length;
  return getEditorBoundaryOffset(editor, range.startContainer, range.startOffset);
}

function getSelectionRangeInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  const fallback = getPromptTextFromEditor(editor).length;
  if (!selection || selection.rangeCount === 0) return { start: fallback, end: fallback };
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return { start: fallback, end: fallback };
  }
  const start = getEditorBoundaryOffset(editor, range.startContainer, range.startOffset);
  const end = getEditorBoundaryOffset(editor, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function findEditorPositionForOffset(editor: HTMLElement, offset: number): { node: Node; offset: number } {
  let remaining = Math.max(0, offset);

  const visit = (node: Node): { node: Node; offset: number } | null => {
    if (node instanceof HTMLElement && node.dataset.promptEditorSentinel) {
      return null;
    }

    if (node instanceof HTMLElement && node.dataset.slashCommandName) {
      const length = getNodePromptLength(node);
      if (remaining <= length) {
        return {
          node: editor,
          offset: Array.prototype.indexOf.call(editor.childNodes, node) + 1,
        };
      }
      remaining -= length;
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0;
      if (remaining <= textLength) {
        return { node, offset: remaining };
      }
      remaining -= textLength;
      return null;
    }

    if (node instanceof HTMLBRElement) {
      if (remaining <= 1) {
        return {
          node: editor,
          offset: Array.prototype.indexOf.call(editor.childNodes, node) + 1,
        };
      }
      remaining -= 1;
      return null;
    }

    for (const child of Array.from(node.childNodes)) {
      const position = visit(child);
      if (position) return position;
    }
    return null;
  };

  for (const child of Array.from(editor.childNodes)) {
    const position = visit(child);
    if (position) return position;
  }

  return { node: editor, offset: editor.childNodes.length };
}

function restoreEditorSelection(editor: HTMLElement, offset: number) {
  const position = findEditorPositionForOffset(editor, offset);
  const range = document.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createSlashCommandIconElement() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "h-[18px] w-[18px] shrink-0 translate-y-[3px]");

  for (const d of [
    "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
    "m3.3 7 8.7 5 8.7-5",
    "M12 22V12",
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }

  return svg;
}

function appendPromptTextNode(fragment: DocumentFragment, text: string) {
  const segments = text.split("\n");
  segments.forEach((segment, index) => {
    if (index > 0) {
      fragment.appendChild(document.createElement("br"));
    }
    if (segment) {
      fragment.appendChild(document.createTextNode(segment));
    }
  });
}

function appendPromptEditorSentinel(fragment: DocumentFragment) {
  const sentinel = document.createElement("br");
  sentinel.dataset.promptEditorSentinel = "true";
  fragment.appendChild(sentinel);
}

function renderPromptEditorContent(editor: HTMLElement, parts: SlashCommandDisplayPart[]) {
  const fragment = document.createDocumentFragment();
  let rawPromptText = "";

  for (const part of parts) {
    if (part.type === "text") {
      rawPromptText += part.text;
      appendPromptTextNode(fragment, part.text);
      continue;
    }

    rawPromptText += part.raw;
    const token = document.createElement("span");
    token.dataset.slashCommandName = part.commandName;
    token.contentEditable = "false";
    token.className = "inline-flex max-w-[240px] items-center gap-1.5 align-baseline font-medium text-[#2f80ed]";
    token.title = part.description || part.raw;
    token.appendChild(createSlashCommandIconElement());

    const label = document.createElement("span");
    label.className = "truncate";
    label.textContent = part.displayName;
    token.appendChild(label);
    fragment.appendChild(token);
  }

  if (rawPromptText.endsWith("\n") || rawPromptText.length === 0) {
    appendPromptEditorSentinel(fragment);
  }

  editor.replaceChildren(fragment);
}

async function collectFileMentionOptions(workspaceRoot: string): Promise<FileMentionOption[]> {
  const root = workspaceRoot.trim();
  if (!root || !window.electron?.listPreviewDirectory) return [];

  const bridge = window.electron as typeof window.electron & {
    listPreviewDirectory?: (input: { cwd: string; path: string }) => Promise<PreviewDirectoryResponse>;
  };
  const seen = new Set<string>();
  const options: FileMentionOption[] = [];

  const visit = async (directoryPath: string, depth: number): Promise<void> => {
    if (depth > FILE_MENTION_SCAN_DEPTH || options.length >= FILE_MENTION_SCAN_LIMIT) return;
    const response = await bridge.listPreviewDirectory?.({ cwd: root, path: directoryPath });
    const entries = Array.isArray(response)
      ? response
      : response?.success === false
        ? []
        : response?.entries ?? [];

    for (const entry of entries) {
      if (options.length >= FILE_MENTION_SCAN_LIMIT) return;
      const name = entry.name?.trim();
      if (!name) continue;

      const isDirectory = entry.isDirectory === true || entry.type === "directory" || entry.kind === "directory";
      if (isDirectory && FILE_MENTION_IGNORED_DIRS.has(name)) continue;

      const entryPath = entry.path || entry.filePath || `${directoryPath.replace(/\/$/, "")}/${name}`;
      const normalizedPath = normalizeMentionPath(entryPath);
      if (seen.has(normalizedPath)) continue;
      seen.add(normalizedPath);

      const label = getRelativeMentionPath(root, normalizedPath);
      options.push({
        path: normalizedPath,
        label,
        name,
        kind: isDirectory ? "directory" : "file",
      });

      if (isDirectory) {
        await visit(normalizedPath, depth + 1);
      }
    }
  };

  await visit(root, 0);
  return options.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.label.localeCompare(b.label, "zh-CN");
  });
}

function buildQueuedPrompt(queue: QueuedMessageDraft[]) {
  if (queue.length === 1) return queue[0].prompt;
  return queue
    .map((item, index) => {
      const content = item.prompt.trim() || "(no text, attachments only)";
      return `Queued message ${index + 1}:\n${content}`;
    })
    .join("\n\n---\n\n");
}

function countStructuredContextBlocks(prompt: string) {
  const matches = prompt.match(/<(?:browser_annotations|code_references|message_references|file_references)>/g);
  return matches?.length ?? 0;
}

function getQueuedPromptPreview(prompt: string, contextCount: number) {
  const visiblePrompt = prompt
    .replace(/<(browser_annotations|code_references|message_references|file_references)>[\s\S]*?<\/\1>/g, "")
    .trim();
  if (visiblePrompt) return visiblePrompt;
  if (contextCount > 0) return `${contextCount} 个结构化上下文`;
  return prompt.trim();
}

function mergeQueuedAttachments(queue: QueuedMessageDraft[]) {
  return queue.flatMap((item) => item.attachments);
}

function buildDraftTitle(prompt: string, attachments: PromptAttachment[]): string {
  const trimmed = prompt.trim();
  if (trimmed) return trimmed;
  if (attachments.length === 1) return `附件：${attachments[0].name}`;
  return `${attachments.length} 个附件`;
}

function formatShortTime(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function readFileAsDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await readFileAsDataUrl(blob);
}

async function downscaleImageFile(file: File): Promise<{ dataUrl: string; mimeType: string; size: number }> {
  if (file.type === "image/gif") {
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, mimeType: file.type, size: file.size };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, mimeType: file.type, size: file.size };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, mimeType: file.type, size: file.size };
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY);
    });

    if (!blob) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, mimeType: file.type, size: file.size };
    }

    return {
      dataUrl: await blobToDataUrl(blob),
      mimeType: "image/jpeg",
      size: blob.size,
    };
  } finally {
    bitmap?.close();
  }
}

function isTextFile(file: File): boolean {
  return file.type.startsWith("text/") || TEXT_FILE_PATTERN.test(file.name);
}

async function fileToAttachment(file: File): Promise<PromptAttachment> {
  if (file.type === SVG_MIME_TYPE || /\.svg$/i.test(file.name)) {
    const text = await readFileAsText(file);
    const normalizedText = text.length > MAX_TEXT_ATTACHMENT_LENGTH
      ? `${text.slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}\n\n[已截断：原文件约 ${text.length} 字符]`
      : text;
    return {
      id: crypto.randomUUID(),
      kind: "text",
      name: file.name || `矢量图-${Date.now()}.svg`,
      mimeType: file.type || SVG_MIME_TYPE,
      data: normalizedText,
      preview: normalizedText,
      size: file.size,
    };
  }

  if (file.type.startsWith("image/")) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`暂不支持 ${file.type} 图片格式，请优先使用 PNG、JPEG、GIF 或 WebP。`);
    }
    const normalizedImage = await downscaleImageFile(file);
    return {
      id: crypto.randomUUID(),
      kind: "image",
      name: file.name || `图片-${Date.now()}.png`,
      mimeType: normalizedImage.mimeType,
      data: normalizedImage.dataUrl,
      preview: normalizedImage.dataUrl,
      size: normalizedImage.size,
    };
  }

  if (isTextFile(file)) {
    const text = await readFileAsText(file);
    const normalizedText = text.length > MAX_TEXT_ATTACHMENT_LENGTH
        ? `${text.slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}\n\n[已截断，原始长度 ${text.length} 字符]`
      : text;
    return {
      id: crypto.randomUUID(),
      kind: "text",
      name: file.name || `文本-${Date.now()}.txt`,
      mimeType: file.type || "text/plain",
      data: normalizedText,
      preview: normalizedText,
      size: file.size,
    };
  }

  throw new Error(`暂不支持附件类型：${file.name || file.type || "未知文件"}`);
}

export function usePromptActions(sendEvent: (event: ClientEvent) => void) {
  const prompt = useAppStore((state) => state.prompt);
  const browserAnnotations = useAppStore((state) => state.browserAnnotations);
  const browserWorkbenchBySessionId = useAppStore((state) => state.browserWorkbenchBySessionId);
  const cwd = useAppStore((state) => state.cwd);
  const apiConfigSettings = useAppStore((state) => state.apiConfigSettings);
  const runtimeModel = useAppStore((state) => state.runtimeModel);
  const reasoningMode = useAppStore((state) => state.reasoningMode);
  const permissionMode = useAppStore((state) => state.permissionMode);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const activeSession = useAppStore((state) => (state.activeSessionId ? (state.sessions[state.activeSessionId] ?? state.archivedSessions[state.activeSessionId]) : undefined));
  const setPrompt = useAppStore((state) => state.setPrompt);
  const clearBrowserAnnotations = useAppStore((state) => state.clearBrowserAnnotations);
  const setBrowserWorkbenchAnnotations = useAppStore((state) => state.setBrowserWorkbenchAnnotations);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);

  const isRunning = activeSession?.status === "running";
  const activeBrowserAnnotations = activeSessionId
    ? browserWorkbenchBySessionId[activeSessionId]?.annotations ?? browserAnnotations
    : browserAnnotations;
  const slashCommandCwd = activeSession?.cwd?.trim() || cwd.trim();
  const [workspaceSlashCommands, setWorkspaceSlashCommands] = useState<SlashCommandOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    const electronApi = window.electron as typeof window.electron & {
      invoke?: <T>(channel: string, ...args: unknown[]) => Promise<T>;
    };
    if (!electronApi.invoke) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setWorkspaceSlashCommands([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    void electronApi.invoke<{ commands?: SlashCommandPayloadItem[] }>("slash-commands:list", { cwd: slashCommandCwd || undefined })
      .then((payload) => {
        if (!cancelled) {
          setWorkspaceSlashCommands(normalizeSlashCommandList(payload?.commands));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load slash commands:", error);
          setWorkspaceSlashCommands([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slashCommandCwd]);
  const slashCommands = useMemo(() => {
    return normalizeSlashCommandList([
      ...workspaceSlashCommands,
      ...(activeSession?.slashCommands ?? []),
    ]);
  }, [activeSession?.slashCommands, workspaceSlashCommands]);
  const enabledProfiles = useMemo(() => getEnabledProfiles(apiConfigSettings.profiles), [apiConfigSettings.profiles]);
  const activeProfile = enabledProfiles[0];
  const availableModels = useMemo(() => getAvailableModelsForProfiles(enabledProfiles), [enabledProfiles]);
  const activeSessionModel = activeSession?.model?.trim();
  const resolveSessionRuntimeModel = useCallback((): string => {
    if (activeSessionModel) return activeSessionModel;
    const messages = activeSession?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const messageModel = "model" in messages[index] ? (messages[index] as { model?: string }).model : undefined;
      if (typeof messageModel === "string") {
        const trimmedMessageModel = messageModel.trim();
        if (trimmedMessageModel) {
          return trimmedMessageModel;
        }
      }
    }

    return "";
  }, [activeSession?.messages, activeSessionModel]);

  // Unknown slash-prefixed text may be an absolute path, so let the runtime
  // interpret exact supported commands and send every other value as text.
  const validatePromptDraft = useCallback((promptValue: string) => {
    void promptValue;
    return null;
  }, []);

  const buildRuntimeOverrides = useCallback((): RuntimeOverrides | null => {
    const selectedModel = runtimeModel.trim() || activeProfile?.model?.trim() || resolveSessionRuntimeModel();
    if (!selectedModel) {
      setGlobalError("请先在设置里启用配置，并至少提供一个模型。");
      return null;
    }

    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setGlobalError("当前选择的模型不在已启用配置的模型列表里，请重新选择。");
      return null;
    }

    return {
      model: selectedModel,
      reasoningMode,
      permissionMode: permissionMode === "plan" ? "bypassPermissions" : permissionMode,
    };
  }, [activeProfile, availableModels, permissionMode, reasoningMode, resolveSessionRuntimeModel, runtimeModel, setGlobalError]);

  const prepareAttachmentsForDispatch = useCallback(async (
    promptValue: string,
    attachments: PromptAttachment[],
  ): Promise<PromptAttachment[] | null> => {
    void promptValue;
    return attachments;
  }, []);

  const sendPromptDraft = useCallback(async (
    promptValue: string,
    attachments: PromptAttachment[] = [],
    options: { clearPrompt?: boolean; displayUserPrompt?: boolean; replaceHistoryId?: string } = {},
  ) => {
    const { clearPrompt = true, displayUserPrompt = true, replaceHistoryId } = options;
    if (!promptValue.trim() && attachments.length === 0) return false;
    const runtime = buildRuntimeOverrides();
    if (!runtime) return false;
    const preparedAttachments = await prepareAttachmentsForDispatch(promptValue, attachments);
    if (!preparedAttachments) return false;

    if (!activeSessionId) {
      let title = "";
      setPendingStart(true);
      const titleSeed = buildDraftTitle(promptValue, attachments);
      title = promptValue.trim() ? await generateSessionTitleOrFallback(titleSeed) : titleSeed;
      sendEvent({
        type: "session.start",
        payload: { title, prompt: promptValue, cwd: cwd.trim() || undefined, allowedTools: DEFAULT_ALLOWED_TOOLS, attachments: preparedAttachments, runtime }
      });
    } else {
      if (activeSession?.status === "running") {
        setGlobalError("当前会话仍在执行中，请等待这一轮完成。");
        return false;
      }
      const validationError = validatePromptDraft(promptValue);
      if (validationError) {
        setGlobalError(validationError);
        return false;
      }
      sendEvent({
        type: "session.continue",
        payload: {
          sessionId: activeSessionId,
          prompt: promptValue,
          attachments: preparedAttachments,
          runtime,
          displayUserPrompt,
          replaceHistoryId,
        },
      });
    }
    if (clearPrompt) {
      setPrompt("");
    }
    setGlobalError(null);
    return true;
  }, [activeSession, activeSessionId, buildRuntimeOverrides, cwd, prepareAttachmentsForDispatch, sendEvent, setGlobalError, setPendingStart, setPrompt, validatePromptDraft]);

  const handleSend = useCallback((attachments: PromptAttachment[] = []) => {
    const promptWithAnnotations = mergePromptWithBrowserAnnotations(prompt, activeBrowserAnnotations);
    return sendPromptDraft(promptWithAnnotations, attachments).then((sent) => {
      if (sent) {
        if (activeSessionId) {
          setBrowserWorkbenchAnnotations(activeSessionId, []);
        }
        clearBrowserAnnotations();
      }
      return sent;
    });
  }, [activeBrowserAnnotations, activeSessionId, clearBrowserAnnotations, prompt, sendPromptDraft, setBrowserWorkbenchAnnotations]);

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    sendEvent({ type: "session.stop", payload: { sessionId: activeSessionId } });
    window.setTimeout(() => {
      sendEvent({ type: "session.list" });
      sendEvent({ type: "session.history", payload: { sessionId: activeSessionId } });
    }, 250);
  }, [activeSessionId, sendEvent]);

  const handleStartFromModal = useCallback(() => {
    if (!cwd.trim()) {
      setGlobalError("开始会话前必须填写工作目录。");
      return;
    }
    if (prompt.trim()) {
      void sendPromptDraft(prompt, [], { clearPrompt: true });
      return;
    }

    setPendingStart(true);
    sendEvent({
        type: "session.create",
        payload: {
        title: "新聊天",
        cwd: cwd.trim(),
        allowedTools: DEFAULT_ALLOWED_TOOLS,
      },
    });
    setGlobalError(null);
  }, [cwd, prompt, sendEvent, sendPromptDraft, setGlobalError, setPendingStart]);

    return {
      prompt,
      setPrompt,
      isRunning,
      handleSend,
      handleStop,
      handleStartFromModal,
      slashCommands,
      activeSessionId,
      browserAnnotations: activeBrowserAnnotations,
      sendPromptDraft,
      validatePromptDraft,
    };
  }

export function PromptInput({
  sendEvent,
  onSendMessage,
  permissionRequest,
  onPermissionResult,
  disabled = false,
  leftOffset = 320,
  rightOffset = 340,
}: PromptInputProps) {
  const { prompt, setPrompt, isRunning, handleStop, slashCommands, activeSessionId, browserAnnotations, sendPromptDraft, validatePromptDraft } = usePromptActions(sendEvent);
  const setBrowserAnnotations = useAppStore((state) => state.setBrowserAnnotations);
  const setBrowserWorkbenchAnnotations = useAppStore((state) => state.setBrowserWorkbenchAnnotations);
  const clearBrowserAnnotations = useAppStore((state) => state.clearBrowserAnnotations);
  const apiConfigSettings = useAppStore((state) => state.apiConfigSettings);
  const runtimeModel = useAppStore((state) => state.runtimeModel);
  const setRuntimeModel = useAppStore((state) => state.setRuntimeModel);
  const reasoningMode = useAppStore((state) => state.reasoningMode);
  const setReasoningMode = useAppStore((state) => state.setReasoningMode);
  const cwd = useAppStore((state) => state.cwd);
  const codeReferencesBySessionId = useAppStore((state) => state.codeReferencesBySessionId);
  const messageReferencesBySessionId = useAppStore((state) => state.messageReferencesBySessionId);
  const fileReferencesBySessionId = useAppStore((state) => state.fileReferencesBySessionId);
  const removeCodeReference = useAppStore((state) => state.removeCodeReference);
  const updateCodeReference = useAppStore((state) => state.updateCodeReference);
  const clearCodeReferences = useAppStore((state) => state.clearCodeReferences);
  const removeMessageReference = useAppStore((state) => state.removeMessageReference);
  const clearMessageReferences = useAppStore((state) => state.clearMessageReferences);
  const addFileReference = useAppStore((state) => state.addFileReference);
  const removeFileReference = useAppStore((state) => state.removeFileReference);
  const clearFileReferences = useAppStore((state) => state.clearFileReferences);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const promptDraftRef = useRef(prompt);
  const pendingCursorOffsetRef = useRef<number | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileMentionCacheRef = useRef<{ cwd: string; options: FileMentionOption[] } | null>(null);
  const isComposingRef = useRef(false);
  const compositionEndedAtRef = useRef(0);
  const compositionEnterPendingRef = useRef(false);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [queuedMessagesBySession, setQueuedMessagesBySession] = useState<Record<string, QueuedMessageDraft[]>>(readQueuedMessagesFromStorage);
  const [showSlashBrowser, setShowSlashBrowser] = useState(false);
  const [dismissedSlashQuery, setDismissedSlashQuery] = useState<string | null>(null);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [fileMentionOptions, setFileMentionOptions] = useState<FileMentionOption[]>([]);
  const [fileMentionLoading, setFileMentionLoading] = useState(false);
  const [fileMentionActiveIndex, setFileMentionActiveIndex] = useState(0);
  const [editingCodeReferenceId, setEditingCodeReferenceId] = useState<string | null>(null);
  const [editingCodeReferenceComment, setEditingCodeReferenceComment] = useState("");
  const [optimizingPrompt, setOptimizingPrompt] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const autoDispatchRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const setGlobalError = useAppStore((state) => state.setGlobalError);
  const codeReferenceSessionKey = getCodeReferenceSessionKey(activeSessionId);
  const activeSessionCwd = useAppStore((state) => {
    if (!activeSessionId) return "";
    return (state.sessions[activeSessionId] ?? state.archivedSessions[activeSessionId])?.cwd ?? "";
  });
  const effectiveCwd = cwd.trim() || activeSessionCwd.trim();
  const codeReferences = codeReferencesBySessionId[codeReferenceSessionKey] || EMPTY_CODE_REFERENCES;
  const messageReferences = messageReferencesBySessionId[codeReferenceSessionKey] || EMPTY_MESSAGE_REFERENCES;
  const fileReferences = fileReferencesBySessionId[codeReferenceSessionKey] || EMPTY_FILE_REFERENCES;
  const slashDisplayParts = useMemo(() => buildSlashCommandDisplayParts(prompt, slashCommands), [prompt, slashCommands]);
  const slashCommandContext = useMemo(() => {
    const context = getSlashCommandContext(prompt, cursorIndex || prompt.length);
    return isCompletedSlashCommandContext(prompt, context) ? null : context;
  }, [cursorIndex, prompt]);
  const slashQuery = slashCommandContext?.query ?? getSlashCommandQuery(prompt, cursorIndex || prompt.length);
  const fileMentionContext = useMemo(
    () => getFileMentionContext(prompt, cursorIndex || prompt.length),
    [cursorIndex, prompt],
  );
  const currentSessionQueue = useMemo(() => {
    if (!activeSessionId) return [];
    return queuedMessagesBySession[activeSessionId] ?? [];
  }, [activeSessionId, queuedMessagesBySession]);
  const hasDraft = prompt.trim().length > 0
    || attachments.length > 0
    || browserAnnotations.length > 0
    || codeReferences.length > 0
    || messageReferences.length > 0
    || fileReferences.length > 0;
  const filteredSlashCommands = useMemo(() => {
    const activeSlashQuery = showSlashBrowser ? "" : slashQuery;
    if (activeSlashQuery === null) return [];

    const normalizedSlashQuery = activeSlashQuery.toLowerCase();
    const matchedCommands = !activeSlashQuery
      ? slashCommands
      : slashCommands.filter((command) => {
          const name = command.name.toLowerCase();
          const description = command.description?.toLowerCase() ?? "";
          return name.includes(normalizedSlashQuery) || description.includes(normalizedSlashQuery);
        });

    return matchedCommands;
  }, [showSlashBrowser, slashCommands, slashQuery]);
  const slashPaletteDismissed = isDismissedSlashCommandQuery(prompt, dismissedSlashQuery, showSlashBrowser, cursorIndex || prompt.length);
  const showSlashPalette = (slashQuery !== null || showSlashBrowser)
    && filteredSlashCommands.length > 0
    && !slashPaletteDismissed
    && !disabled;
  const filteredFileMentionOptions = useMemo(() => {
    if (!fileMentionContext) return [];
    const query = normalizeMentionPath(fileMentionContext.query.replace(/^["']|["']$/g, "")).toLowerCase();
    const matched = !query
      ? fileMentionOptions
      : fileMentionOptions.filter((option) => {
          const label = option.label.toLowerCase();
          const name = option.name.toLowerCase();
          return label.includes(query) || name.includes(query);
        });
    return matched
      .slice()
      .sort((a, b) => {
        if (!query) return 0;
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aScore = (aLabel.startsWith(query) ? 0 : aName.startsWith(query) ? 1 : aLabel.includes(`/${query}`) ? 2 : 3) + (a.kind === "file" ? 0 : 0.2);
        const bScore = (bLabel.startsWith(query) ? 0 : bName.startsWith(query) ? 1 : bLabel.includes(`/${query}`) ? 2 : 3) + (b.kind === "file" ? 0 : 0.2);
        return aScore - bScore || a.label.localeCompare(b.label, "zh-CN");
      })
      .slice(0, FILE_MENTION_PREVIEW_LIMIT);
  }, [fileMentionContext, fileMentionOptions]);
  const showFileMentionPalette = Boolean(fileMentionContext) && !showSlashPalette && !disabled && (fileMentionLoading || filteredFileMentionOptions.length > 0);
  const enabledProfiles = useMemo<ApiConfigProfile[]>(() => getEnabledProfiles(apiConfigSettings.profiles), [apiConfigSettings.profiles]);
  const availableModels = useMemo(() => {
    return getAvailableModelsForProfiles(enabledProfiles);
  }, [enabledProfiles]);
  const activeProfile = enabledProfiles[0];
  const selectedRuntimeModel = runtimeModel.trim() || activeProfile?.model?.trim() || availableModels[0] || "";
  useEffect(() => {
    promptDraftRef.current = prompt;
  }, [prompt]);

  const focusPromptEditor = useCallback((offset?: number) => {
    if (typeof offset === "number") {
      pendingCursorOffsetRef.current = Math.max(0, offset);
    }
    window.setTimeout(() => {
      const editor = promptRef.current;
      if (!editor) return;
      editor.focus();
      if (pendingCursorOffsetRef.current !== null) {
        restoreEditorSelection(editor, pendingCursorOffsetRef.current);
        pendingCursorOffsetRef.current = null;
      }
    }, 0);
  }, []);

  const setPromptDraft = useCallback((nextPrompt: string, nextCursorIndex = nextPrompt.length) => {
    promptDraftRef.current = nextPrompt;
    pendingCursorOffsetRef.current = nextCursorIndex;
    const editor = promptRef.current;
    if (editor && !isComposingRef.current) {
      renderPromptEditorContent(editor, buildSlashCommandDisplayParts(nextPrompt, slashCommands));
      editor.dataset.renderedPrompt = nextPrompt;
      if (document.activeElement === editor) {
        restoreEditorSelection(editor, nextCursorIndex);
      }
      pendingCursorOffsetRef.current = null;
    }
    setPrompt(nextPrompt);
    setCursorIndex(nextCursorIndex);
  }, [setPrompt, slashCommands]);

  const isCompositionSettling = useCallback(() => (
    Date.now() - compositionEndedAtRef.current < IME_ENTER_GRACE_MS
  ), []);

  const clearCompositionEnterGuard = useCallback(() => {
    compositionEnterPendingRef.current = false;
    compositionEndedAtRef.current = 0;
  }, []);

  const getCurrentPromptDraft = useCallback(() => {
    const nextPrompt = promptRef.current ? getPromptTextFromEditor(promptRef.current) : promptDraftRef.current;
    promptDraftRef.current = nextPrompt;
    if (nextPrompt !== prompt) {
      setPrompt(nextPrompt);
    }
    return nextPrompt;
  }, [prompt, setPrompt]);

  const handleOptimizePrompt = useCallback(async () => {
    if (disabled || optimizingPrompt) return;

    const sourcePrompt = prompt.trim();
    if (!sourcePrompt) {
      setGlobalError("请先在输入框里写一段 prompt。");
      focusPromptEditor();
      return;
    }

    setOptimizingPrompt(true);
    setSubmissionStatus("正在优化 Prompt...");
    try {
      const result = await window.electron.invoke<PromptOptimizeResult>("prompt:optimize", {
        prompt: sourcePrompt,
        model: selectedRuntimeModel || undefined,
      });

      if (!result?.success || !result.optimizedPrompt?.trim()) {
        setGlobalError(result?.error || "Prompt 优化失败。");
        return;
      }

      const optimizedPrompt = result.optimizedPrompt.trim();
      setPromptDraft(optimizedPrompt, optimizedPrompt.length);
      setShowSlashBrowser(false);
      setDismissedSlashQuery(null);
      setGlobalError(null);
      focusPromptEditor(optimizedPrompt.length);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Prompt 优化失败。");
    } finally {
      setSubmissionStatus(null);
      setOptimizingPrompt(false);
    }
  }, [disabled, focusPromptEditor, optimizingPrompt, prompt, selectedRuntimeModel, setGlobalError, setPromptDraft]);

  const clearComposer = useCallback(() => {
    setPromptDraft("", 0);
    setAttachments([]);
    setFileMentionActiveIndex(0);
    setSlashActiveIndex(0);
    clearCodeReferences(activeSessionId);
    clearMessageReferences(activeSessionId);
    clearFileReferences(activeSessionId);
    if (activeSessionId) {
      setBrowserWorkbenchAnnotations(activeSessionId, []);
    }
    clearBrowserAnnotations();
    void resetBrowserWorkbenchAnnotationState(window.electron, activeSessionId ?? undefined)
      .catch((error) => console.warn("Failed to reset browser annotation state:", error));
    setShowSlashBrowser(false);
    setDismissedSlashQuery(null);
  }, [activeSessionId, clearBrowserAnnotations, clearCodeReferences, clearFileReferences, clearMessageReferences, setBrowserWorkbenchAnnotations, setPromptDraft]);

  const clearPromptDraftText = useCallback(() => {
    setPromptDraft("", 0);
    setShowSlashBrowser(false);
    setDismissedSlashQuery(null);
  }, [setPromptDraft]);

  const syncPromptEditorState = useCallback(() => {
    const editor = promptRef.current;
    if (!editor) {
      setCursorIndex(prompt.length);
      return;
    }
    const nextPrompt = getPromptTextFromEditor(editor);
    const nextCursor = getSelectionOffsetInEditor(editor);
    promptDraftRef.current = nextPrompt;
    setCursorIndex(nextCursor);
    if (nextPrompt !== prompt) {
      setPrompt(nextPrompt);
    }
  }, [prompt, setPrompt]);

  const removeQueuedDraft = useCallback((queueId: string, sessionId = activeSessionId) => {
    if (!sessionId) return;
    setQueuedMessagesBySession((current) => {
      const nextQueue = (current[sessionId] ?? []).filter((item) => item.id !== queueId);
      if (nextQueue.length === 0) {
        const rest = { ...current };
        delete rest[sessionId];
        return rest;
      }
      return {
        ...current,
        [sessionId]: nextQueue,
      };
    });
  }, [activeSessionId]);

  const prepareQueuedAttachmentsForDispatch = useCallback(async (
    promptValue: string,
    draftAttachments: PromptAttachment[],
  ): Promise<PromptAttachment[] | null> => {
    void promptValue;
    return draftAttachments;
  }, []);

  const appendQueuedDraft = useCallback(async (queuedMessage: QueuedMessageDraft) => {
    if (!activeSessionId) return;
    const preparedAttachments = await prepareQueuedAttachmentsForDispatch(queuedMessage.prompt, queuedMessage.attachments);
    if (!preparedAttachments) return;

    sendEvent({
      type: "session.append",
      payload: {
        sessionId: activeSessionId,
        prompt: queuedMessage.prompt,
        attachments: preparedAttachments,
      },
    });
    removeQueuedDraft(queuedMessage.id, activeSessionId);
    onSendMessage?.();
    window.dispatchEvent(new CustomEvent(PROMPT_SENT_EVENT));
  }, [activeSessionId, onSendMessage, prepareQueuedAttachmentsForDispatch, removeQueuedDraft, sendEvent]);

  const editQueuedDraft = useCallback((queuedMessage: QueuedMessageDraft) => {
    setPromptDraft(queuedMessage.prompt, queuedMessage.prompt.length);
    setAttachments(queuedMessage.attachments);
    removeQueuedDraft(queuedMessage.id, activeSessionId);
    focusPromptEditor(queuedMessage.prompt.length);
  }, [activeSessionId, focusPromptEditor, removeQueuedDraft, setPromptDraft]);

  const queueCurrentDraft = useCallback((promptOverride?: string) => {
    if (!activeSessionId) return false;
    const currentPrompt = promptOverride ?? promptDraftRef.current;
    const currentHasDraft = currentPrompt.trim().length > 0
      || attachments.length > 0
      || browserAnnotations.length > 0
      || codeReferences.length > 0
      || messageReferences.length > 0
      || fileReferences.length > 0;
    if (!currentHasDraft) return false;

    const promptWithCodeReferences = mergePromptWithCodeReferences(currentPrompt, codeReferences);
    const promptWithFileReferences = mergePromptWithFileReferences(promptWithCodeReferences, fileReferences);
    const promptWithMessageReferences = mergePromptWithMessageReferences(promptWithFileReferences, messageReferences);
    const promptWithAnnotations = mergePromptWithBrowserAnnotations(promptWithMessageReferences, browserAnnotations);
    const validationError = validatePromptDraft(promptWithAnnotations);
    if (validationError) {
      setGlobalError(validationError);
      return false;
    }

    const nextQueuedMessage: QueuedMessageDraft = {
      id: crypto.randomUUID(),
      prompt: promptWithAnnotations,
      attachments,
      createdAt: Date.now(),
    };

    setQueuedMessagesBySession((current) => ({
      ...current,
      [activeSessionId]: [...(current[activeSessionId] ?? []), nextQueuedMessage],
    }));
    clearComposer();
    setGlobalError(null);
    window.dispatchEvent(new CustomEvent(PROMPT_SENT_EVENT));
    return true;
  }, [activeSessionId, attachments, browserAnnotations, clearComposer, codeReferences, fileReferences, messageReferences, setGlobalError, validatePromptDraft]);

  const submitCurrentInput = useCallback(async () => {
    const promptSnapshot = getCurrentPromptDraft();
    const currentHasDraft = promptSnapshot.trim().length > 0
      || attachments.length > 0
      || browserAnnotations.length > 0
      || codeReferences.length > 0
      || messageReferences.length > 0
      || fileReferences.length > 0;
    if (!currentHasDraft) return false;
    if (submitInFlightRef.current) return false;

    submitInFlightRef.current = true;
    try {
      if (isRunning) {
        return queueCurrentDraft(promptSnapshot);
      }

      const attachmentsSnapshot = attachments;
      const promptWithCodeReferences = mergePromptWithCodeReferences(promptSnapshot, codeReferences);
      const promptWithFileReferences = mergePromptWithFileReferences(promptWithCodeReferences, fileReferences);
      const promptWithMessageReferences = mergePromptWithMessageReferences(promptWithFileReferences, messageReferences);
      const promptWithAnnotations = mergePromptWithBrowserAnnotations(promptWithMessageReferences, browserAnnotations);
      const validationError = validatePromptDraft(promptWithAnnotations);
      if (validationError) {
        setGlobalError(validationError);
        return false;
      }

      setSubmissionStatus("正在发送...");
      clearPromptDraftText();

      const sent = await sendPromptDraft(promptWithAnnotations, attachmentsSnapshot, { clearPrompt: false });
      if (sent) {
        clearComposer();
        onSendMessage?.();
        window.dispatchEvent(new CustomEvent(PROMPT_SENT_EVENT));
      } else {
        setPromptDraft(promptSnapshot, promptSnapshot.length);
        setAttachments(attachmentsSnapshot);
      }
      return sent;
    } finally {
      setSubmissionStatus(null);
      submitInFlightRef.current = false;
    }
  }, [attachments, browserAnnotations, clearComposer, clearPromptDraftText, codeReferences, fileReferences, getCurrentPromptDraft, isRunning, messageReferences, onSendMessage, queueCurrentDraft, sendPromptDraft, setGlobalError, setPromptDraft, validatePromptDraft]);

  useEffect(() => {
    const handlePromptSubmit = () => {
      if (disabled) return;
      void submitCurrentInput();
    };

    window.addEventListener(PROMPT_SUBMIT_EVENT, handlePromptSubmit);
    return () => window.removeEventListener(PROMPT_SUBMIT_EVENT, handlePromptSubmit);
  }, [disabled, submitCurrentInput]);

  const insertFileMention = useCallback((option: FileMentionOption) => {
    if (!fileMentionContext) return;
    const before = prompt.slice(0, fileMentionContext.start).replace(/[ \t]+$/g, "");
    const after = prompt.slice(fileMentionContext.end).replace(/^[ \t]+/g, "");
    const joiner = before && after ? " " : "";
    const nextPrompt = `${before}${joiner}${after}`;
    const nextCursor = before.length + joiner.length;

    addFileReference(activeSessionId, {
      kind: option.kind,
      path: option.path,
      name: option.name,
      label: option.label,
      workspaceRoot: effectiveCwd,
    });
    setPromptDraft(nextPrompt, nextCursor);
    setFileMentionActiveIndex(0);
    focusPromptEditor(nextCursor);
  }, [activeSessionId, addFileReference, effectiveCwd, fileMentionContext, focusPromptEditor, prompt, setPromptDraft]);

  const selectSlashCommand = useCallback((command: SlashCommandOption) => {
    const context = slashCommandContext;
    const before = context ? prompt.slice(0, context.start) : prompt.slice(0, cursorIndex || prompt.length);
    const after = context ? prompt.slice(context.end) : prompt.slice(cursorIndex || prompt.length);
    const replacement = serializeSlashCommandDraft(command.name, "");
    const nextPrompt = `${before}${replacement}${after.replace(/^\s+/u, "")}`;
    const nextCursor = before.length + replacement.length;
    setPromptDraft(nextPrompt, nextCursor);
    setDismissedSlashQuery(command.name.toLowerCase());
    setShowSlashBrowser(false);
    focusPromptEditor(nextCursor);
  }, [cursorIndex, focusPromptEditor, prompt, setPromptDraft, slashCommandContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const keyboardEvent = {
      key: e.key,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      nativeEvent: {
        isComposing: e.nativeEvent.isComposing,
        keyCode: e.nativeEvent.keyCode,
        which: e.nativeEvent.which,
      },
    };
    if (e.key === "Enter") {
      if (isComposingRef.current) {
        return;
      }
      e.preventDefault();
    }
    if (shouldBlockPromptEnterAfterComposition(keyboardEvent, isComposingRef.current)) {
      compositionEnterPendingRef.current = true;
      return;
    }
    if (e.key !== "Enter" && !e.nativeEvent.isComposing && !isComposingRef.current) {
      clearCompositionEnterGuard();
    }
    if (showSlashPalette) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSlashActiveIndex((current) => {
          const count = filteredSlashCommands.length;
          if (count === 0) return 0;
          return e.key === "ArrowDown"
            ? (current + 1) % count
            : (current - 1 + count) % count;
        });
        return;
      }
      if (((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") && filteredSlashCommands.length > 0) {
        e.preventDefault();
        const command = filteredSlashCommands[slashActiveIndex] ?? filteredSlashCommands[0];
        selectSlashCommand(command);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashBrowser(false);
        setDismissedSlashQuery(slashQuery?.toLowerCase() ?? null);
        return;
      }
    }
    if (showFileMentionPalette) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setFileMentionActiveIndex((current) => {
          const count = filteredFileMentionOptions.length;
          if (count === 0) return 0;
          return e.key === "ArrowDown"
            ? (current + 1) % count
            : (current - 1 + count) % count;
        });
        return;
      }
      if (((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") && filteredFileMentionOptions.length > 0) {
        e.preventDefault();
        insertFileMention(filteredFileMentionOptions[fileMentionActiveIndex] ?? filteredFileMentionOptions[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setFileMentionOptions([]);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      focusPromptEditor();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      clearCompositionEnterGuard();
      void submitCurrentInput();
      return;
    }
    if (shouldInsertPromptNewline(keyboardEvent)) {
      e.preventDefault();
      clearCompositionEnterGuard();
      const editor = promptRef.current;
      const currentPrompt = editor ? getPromptTextFromEditor(editor) : promptDraftRef.current;
      const fallbackCursor = cursorIndex || currentPrompt.length;
      const selection = editor ? getSelectionRangeInEditor(editor) : { start: fallbackCursor, end: fallbackCursor };
      const nextDraft = insertTextIntoPrompt(currentPrompt, "\n", selection.start, selection.end);
      setPromptDraft(nextDraft.prompt, nextDraft.cursorIndex);
      focusPromptEditor(nextDraft.cursorIndex);
      return;
    }
    if (shouldSubmitPromptOnEnter(keyboardEvent, isComposingRef.current)) {
      e.preventDefault();
      clearCompositionEnterGuard();
      void submitCurrentInput();
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    if (!hasDraft && isRunning) {
      handleStop();
      return;
    }
    void submitCurrentInput();
  };

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    try {
      const nextAttachments = await Promise.all(fileArray.map((file) => fileToAttachment(file)));
      setAttachments((current) => [...current, ...nextAttachments]);
      setGlobalError(null);
    } catch (error) {
      console.error(error);
      setGlobalError(error instanceof Error ? error.message : "读取附件失败。");
    }
  }, [setGlobalError]);

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (clipboardFiles.length === 0) {
      return;
    }

    event.preventDefault();
    await addFiles(clipboardFiles);
  }, [addFiles]);

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      await addFiles(event.target.files);
    }
    event.target.value = "";
  }, [addFiles]);

  const handleComposerDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(true);
  }, [disabled]);

  const handleComposerDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  }, [disabled]);

  const handleComposerDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setIsDraggingFiles(false);
  }, []);

  const handleComposerDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);

    if (event.dataTransfer.files.length > 0) {
      await addFiles(event.dataTransfer.files);
      focusPromptEditor();
    }
  }, [addFiles, disabled, focusPromptEditor]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const previousPrompt = promptDraftRef.current;
    const nextPrompt = getPromptTextFromEditor(target);
    const nextCursor = resolvePromptEditorInputCursor(previousPrompt, nextPrompt, getSelectionOffsetInEditor(target));
    promptDraftRef.current = nextPrompt;
    pendingCursorOffsetRef.current = nextCursor;
    setPrompt(nextPrompt);
    setCursorIndex(nextCursor);
    target.style.height = "auto";
    const scrollHeight = target.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      target.style.height = `${MAX_HEIGHT}px`;
      target.style.overflowY = "auto";
    } else {
      target.style.height = `${scrollHeight}px`;
      target.style.overflowY = "hidden";
    }
  };

  const handleBeforeInput = useCallback((event: InputEvent) => {
    const action = getPromptParagraphInputAction(
      {
        inputType: event.inputType,
        isComposing: event.isComposing,
      },
      isComposingRef.current,
      showSlashPalette || showFileMentionPalette,
      compositionEnterPendingRef.current || isCompositionSettling(),
    );
    if (action === "allow") return;

    event.preventDefault();
    if (event.inputType === "insertParagraph") {
      clearCompositionEnterGuard();
    }
    if (action === "submit") {
      void submitCurrentInput();
    }
  }, [clearCompositionEnterGuard, isCompositionSettling, showFileMentionPalette, showSlashPalette, submitCurrentInput]);

  useEffect(() => {
    if (!promptRef.current) return;
    promptRef.current.style.height = "auto";
    const scrollHeight = promptRef.current.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      promptRef.current.style.height = `${MAX_HEIGHT}px`;
      promptRef.current.style.overflowY = "auto";
    } else {
      promptRef.current.style.height = `${scrollHeight}px`;
      promptRef.current.style.overflowY = "hidden";
    }
  }, [prompt]);

  useEffect(() => {
    const editor = promptRef.current;
    if (!editor) return;
    const listener = (event: Event) => {
      handleBeforeInput(event as InputEvent);
    };
    editor.addEventListener("beforeinput", listener);
    return () => {
      editor.removeEventListener("beforeinput", listener);
    };
  }, [handleBeforeInput]);

  useLayoutEffect(() => {
    const editor = promptRef.current;
    if (!editor) return;

    const isActive = document.activeElement === editor;
    const cursorOffset = pendingCursorOffsetRef.current ?? (isActive ? getSelectionOffsetInEditor(editor) : null);
    if (editor.dataset.renderedPrompt !== prompt && !isComposingRef.current) {
      renderPromptEditorContent(editor, slashDisplayParts);
      editor.dataset.renderedPrompt = prompt;
    }
    if (isActive && cursorOffset !== null && !isComposingRef.current) {
      restoreEditorSelection(editor, cursorOffset);
    }
    pendingCursorOffsetRef.current = null;
  }, [prompt, slashDisplayParts]);

  useEffect(() => {
    const handlePromptFocus = () => {
      focusPromptEditor();
    };

    window.addEventListener(PROMPT_FOCUS_EVENT, handlePromptFocus);
    return () => window.removeEventListener(PROMPT_FOCUS_EVENT, handlePromptFocus);
  }, [focusPromptEditor]);

  useEffect(() => {
    const handleAddPromptAttachment = (event: Event) => {
      const detail = (event as CustomEvent<AddPromptAttachmentDetail>).detail;
      if (!detail || detail.kind !== "image" || !detail.data) return;
      setAttachments((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: "image",
          name: detail.name || `browser-screenshot-${Date.now()}.png`,
          mimeType: detail.mimeType || "image/png",
          data: detail.data,
          preview: detail.preview || detail.data,
          size: detail.size,
        },
      ]);
      setGlobalError(null);
    };

    window.addEventListener(ADD_PROMPT_ATTACHMENT_EVENT, handleAddPromptAttachment);
    return () => window.removeEventListener(ADD_PROMPT_ATTACHMENT_EVENT, handleAddPromptAttachment);
  }, [setGlobalError]);

  useEffect(() => {
    setFileMentionActiveIndex(0);
  }, [fileMentionContext?.query]);

  useEffect(() => {
    setSlashActiveIndex(0);
  }, [showSlashBrowser, slashQuery]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusPromptEditor();
      }
    };

    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [focusPromptEditor]);

  useEffect(() => {
    if (!fileMentionContext || disabled) return;
    const workspaceRoot = effectiveCwd;
    if (!workspaceRoot) return;

    const cached = fileMentionCacheRef.current;
    if (cached?.cwd === workspaceRoot) {
      setFileMentionOptions(cached.options);
      return;
    }

    let cancelled = false;
    setFileMentionLoading(true);
    void collectFileMentionOptions(workspaceRoot)
      .then((options) => {
        if (cancelled) return;
        fileMentionCacheRef.current = { cwd: workspaceRoot, options };
        setFileMentionOptions(options);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setFileMentionOptions([]);
      })
      .finally(() => {
        if (!cancelled) setFileMentionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, effectiveCwd, fileMentionContext]);

  useEffect(() => {
    if (!activeSessionId || disabled || isRunning || currentSessionQueue.length === 0) {
      autoDispatchRef.current = null;
      return;
    }

    const queuedSnapshot = currentSessionQueue.slice();
    const dispatchKey = `${activeSessionId}:${queuedSnapshot.map((item) => item.id).join(",")}`;
    if (autoDispatchRef.current === dispatchKey) {
      return;
    }

    autoDispatchRef.current = dispatchKey;

    void (async () => {
      const queuedIds = new Set(queuedSnapshot.map((item) => item.id));
      const sent = await sendPromptDraft(buildQueuedPrompt(queuedSnapshot), mergeQueuedAttachments(queuedSnapshot), { clearPrompt: false });
      if (sent) {
        setQueuedMessagesBySession((current) => {
          const remainingQueue = (current[activeSessionId] ?? []).filter((item) => !queuedIds.has(item.id));
          if (remainingQueue.length === 0) {
            const rest = { ...current };
            delete rest[activeSessionId];
            return rest;
          }
          return {
            ...current,
            [activeSessionId]: remainingQueue,
          };
        });
        onSendMessage?.();
        window.dispatchEvent(new CustomEvent(PROMPT_SENT_EVENT));
      }

      autoDispatchRef.current = null;
    })();
  }, [activeSessionId, currentSessionQueue, disabled, isRunning, onSendMessage, sendPromptDraft]);

  useEffect(() => {
    writeQueuedMessagesToStorage(queuedMessagesBySession);
  }, [queuedMessagesBySession]);

  useEffect(() => {
    const composerElement = composerRef.current;
    if (!composerElement) return;

    const updateComposerOffset = () => {
      const rect = composerElement.getBoundingClientRect();
      document.documentElement.style.setProperty("--composer-bottom-offset", `${Math.ceil(rect.height)}px`);
    };

    const resizeObserver = new ResizeObserver(updateComposerOffset);
    resizeObserver.observe(composerElement);
    window.addEventListener("resize", updateComposerOffset);

    updateComposerOffset();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateComposerOffset);
      document.documentElement.style.removeProperty("--composer-bottom-offset");
    };
  }, []);

  return (
    <section
      ref={composerRef}
      className="fixed bottom-0 left-0 right-0 z-[120] bg-gradient-to-t from-[rgba(229,234,240,0.64)] via-[rgba(229,234,240,0.12)] to-transparent px-3 pb-3 pt-3 lg:pb-4"
      style={{
        marginLeft: `${leftOffset}px`,
        marginRight: `${rightOffset}px`,
      }}
    >
      {submissionStatus && (
        <div className="mx-auto mb-3 flex w-fit max-w-[min(720px,calc(100vw-80px))] items-center gap-2 rounded-full border border-accent/20 bg-white/95 px-4 py-2 text-sm font-medium text-ink-800 shadow-[0_14px_36px_rgba(24,32,46,0.12)] backdrop-blur-xl">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
          <span>{submissionStatus}</span>
        </div>
      )}
      {showSlashPalette && (
        <div className="relative z-[130] mx-auto mb-3 w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]">
          <div className="overflow-hidden rounded-[24px] border border-black/6 bg-white/94 shadow-[0_18px_50px_rgba(30,38,52,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-2 text-xs font-medium text-muted">
              <span>可用 Slash 命令</span>
              <span>{filteredSlashCommands.length} 个</span>
            </div>
            <div className="grid max-h-[min(42vh,320px)] gap-1 overflow-y-auto overflow-x-hidden p-2">
              {filteredSlashCommands.map((command, index) => (
                <button
                  key={command.name}
                  type="button"
                  className={`min-w-0 rounded-xl px-3 py-2 text-left text-sm transition-colors ${index === slashActiveIndex ? "bg-accent/10 text-accent" : "text-ink-700 hover:bg-surface-secondary"}`}
                  onClick={() => {
                    selectSlashCommand(command);
                  }}
                >
                  <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
                    <span className="shrink-0 font-medium">/{command.name}</span>
                    <span className="min-w-0 truncate text-xs font-normal text-muted" title={command.description || "Enter/Tab 选择"}>
                      {command.description || "Enter/Tab 选择"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showFileMentionPalette && (
        <div className="mx-auto mb-3 w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]">
          <div className="overflow-hidden rounded-[22px] border border-[#d0d7de] bg-white/96 shadow-[0_18px_50px_rgba(30,38,52,0.10)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4 py-2 text-xs font-medium text-muted">
              <span>@ 文件提及</span>
              <div className="flex items-center gap-2">
                <span>{fileMentionLoading ? "扫描工作区..." : `${filteredFileMentionOptions.length} 个候选`}</span>
                <button
                  type="button"
                  className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:text-accent"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const workspaceRoot = effectiveCwd;
                    if (!workspaceRoot) return;
                    fileMentionCacheRef.current = null;
                    setFileMentionLoading(true);
                    void collectFileMentionOptions(workspaceRoot)
                      .then((options) => {
                        fileMentionCacheRef.current = { cwd: workspaceRoot, options };
                        setFileMentionOptions(options);
                      })
                      .finally(() => setFileMentionLoading(false));
                  }}
                >
                  刷新
                </button>
              </div>
            </div>
            <div className="grid max-h-[min(42vh,320px)] gap-1 overflow-y-auto p-2">
              {filteredFileMentionOptions.map((option, index) => (
                <button
                  key={option.path}
                  type="button"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${index === fileMentionActiveIndex ? "bg-[#ddf4ff] text-[#0969da]" : "text-ink-700 hover:bg-surface-secondary"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertFileMention(option)}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[12px] ${option.kind === "directory" ? "border-[#d0d7de] bg-[#f6f8fa] text-[#57606a]" : "border-[#bfd7ff] bg-[#ddf4ff] text-[#0969da]"}`}>
                    {option.kind === "directory" ? "⌁" : "□"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                  <span className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 text-[11px] text-muted">
                    {option.kind === "directory" ? "目录" : "文件"}
                  </span>
                </button>
              ))}
              {!fileMentionLoading && filteredFileMentionOptions.length === 0 && (
                <div className="px-4 py-5 text-center text-sm text-muted">
                  没找到匹配文件，试试缩短关键词。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div
        className={`relative mx-auto w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] rounded-[18px] border bg-white px-4 pb-3 pt-4 shadow-[0_10px_30px_rgba(15,18,24,0.07)] transition-colors xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)] ${isDraggingFiles ? "border-accent/45 shadow-[0_18px_42px_rgba(255,122,64,0.16)]" : "border-[#d9dde3]"}`}
        onDragEnter={handleComposerDragEnter}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={(event) => { void handleComposerDrop(event); }}
      >
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-[22px] border border-dashed border-accent/45 bg-white/75 text-sm font-semibold text-accent shadow-inner backdrop-blur-sm">
            松开添加附件
          </div>
        )}
        {currentSessionQueue.length > 0 && (
          <div className="mb-3 min-w-0 overflow-hidden rounded-2xl border border-black/6 bg-[#f6f8fb] px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="shrink-0 text-xs font-medium text-ink-700">待发送队列 · {currentSessionQueue.length} 条</div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] text-muted">
                <span className="min-w-0">运行中可点「插入」作为补充命令；空闲后会自动续发。</span>
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-black/8 bg-white px-2 py-0.5 font-semibold transition hover:text-accent"
                  onClick={() => {
                    if (!activeSessionId) return;
                    setQueuedMessagesBySession((current) => {
                      const next = { ...current };
                      delete next[activeSessionId];
                      return next;
                    });
                  }}
                >
                  清空队列
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              {currentSessionQueue.map((queuedMessage, index) => {
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
                      onClick={() => editQueuedDraft(queuedMessage)}
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
                          onClick={() => appendQueuedDraft(queuedMessage)}
                          title="把这条消息作为补充命令插入当前执行"
                        >
                          插入
                        </button>
                      )}
                      <button
                        type="button"
                        className="shrink-0 rounded-full border border-black/6 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-700 shadow-sm transition-colors hover:border-accent/20 hover:bg-accent/8 hover:text-accent"
                        onClick={() => editQueuedDraft(queuedMessage)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                        onClick={() => removeQueuedDraft(queuedMessage.id)}
                        aria-label="移除待发送消息"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {permissionRequest?.toolName === "AskUserQuestion" && onPermissionResult && (
          <div className="mb-3">
            <DecisionPanel
              request={permissionRequest}
              compact
              onSubmit={(result) => onPermissionResult(permissionRequest.toolUseId, result)}
            />
          </div>
        )}
        {attachments.length > 0 && (
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
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  aria-label={`移除附件 ${attachment.name}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {(messageReferences.length > 0 || fileReferences.length > 0) && (
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
                onRemove={() => removeMessageReference(activeSessionId, reference.id)}
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
                onRemove={() => removeFileReference(activeSessionId, reference.id)}
              />
            ))}
            {(messageReferences.length > 1 || fileReferences.length > 1) && (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700"
                onClick={() => {
                  clearMessageReferences(activeSessionId);
                  clearFileReferences(activeSessionId);
                }}
              >
                清空消息/文件引用
              </button>
            )}
          </div>
        )}

        {codeReferences.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {codeReferences.map((reference, index) => {
              const isEditing = editingCodeReferenceId === reference.id;
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
                      value={editingCodeReferenceComment}
                      onChange={(event) => setEditingCodeReferenceComment(event.target.value)}
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
                        onClick={() => {
                          updateCodeReference(activeSessionId, reference.id, {
                            comment: editingCodeReferenceComment.trim() || undefined,
                          });
                          setEditingCodeReferenceId(null);
                          setEditingCodeReferenceComment("");
                        }}
                        aria-label={`保存代码引用 ${index + 1} 评论`}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="rounded-full px-2 py-1 text-[10px] font-semibold text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                        onClick={() => {
                          setEditingCodeReferenceId(null);
                          setEditingCodeReferenceComment("");
                        }}
                        aria-label={`取消编辑代码引用 ${index + 1} 评论`}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                      onClick={() => {
                        setEditingCodeReferenceId(reference.id);
                        setEditingCodeReferenceComment(reference.comment ?? "");
                      }}
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
                    onClick={() => removeCodeReference(activeSessionId, reference.id)}
                    aria-label={`移除代码引用 ${index + 1}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
            {codeReferences.length > 1 && (
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700"
                onClick={() => clearCodeReferences(activeSessionId)}
              >
                清空代码引用
              </button>
            )}
          </div>
        )}

        {browserAnnotations.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {browserAnnotations.slice().reverse().map((annotation, index) => {
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
                      const nextAnnotations = browserAnnotations.filter((item) => item.id !== annotation.id);
                      if (activeSessionId) {
                        setBrowserWorkbenchAnnotations(activeSessionId, nextAnnotations);
                      } else {
                        setBrowserAnnotations(nextAnnotations);
                      }
                    }}
                    aria-label={`移除浏览器批注 ${index + 1}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
            {browserAnnotations.length > 1 && (
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700"
                onClick={() => {
                  if (activeSessionId) {
                    setBrowserWorkbenchAnnotations(activeSessionId, []);
                  } else {
                    clearBrowserAnnotations();
                  }
                }}
              >
                清空
              </button>
            )}
          </div>
        )}

        <div className="relative grid gap-2">
          {!prompt && !promptFocused && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 px-1 pb-2 pt-0 text-[17px] leading-7 text-[#a6a8ad]">
              {disabled
                ? "先创建或选择一个会话..."
                : attachments.length > 0
                    ? "可以继续补充文字说明，或直接发送附件..."
                    : isRunning
                      ? "当前仍在执行中，你可以继续输入，系统会自动排队续发..."
                      : "描述计划，@ 引用上下文，/ 使用命令"}
            </div>
          )}
          <div
            ref={promptRef}
            role="textbox"
            aria-multiline="true"
            aria-label="输入提示"
            aria-disabled={disabled}
            contentEditable={!disabled}
            suppressContentEditableWarning
            tabIndex={disabled ? -1 : 0}
            className="relative z-10 max-h-[180px] min-h-[86px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-1 pb-2 pt-0 text-[17px] leading-7 text-ink-800 caret-ink-800 focus:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            onInput={handleInput}
            onSelect={syncPromptEditorState}
            onClick={syncPromptEditorState}
            onKeyUp={syncPromptEditorState}
            onKeyDown={handleKeyDown}
            onFocus={() => setPromptFocused(true)}
            onBlur={() => setPromptFocused(false)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              compositionEndedAtRef.current = Date.now();
            }}
            onPaste={(event) => { void handlePaste(event); }}
          />
        </div>
        <div className="mt-2 flex min-h-10 items-center justify-between gap-3 overflow-visible">
          <div className="flex min-w-max items-center gap-2 text-[#73777f]">
            <ModelSelect
              label="模型"
              value={selectedRuntimeModel}
              models={availableModels}
              disabled={disabled || availableModels.length === 0}
              onChange={setRuntimeModel}
              variant="composer"
              placement="top"
              className="min-w-[112px] max-w-[112px] bg-transparent hover:bg-[#f4f6f8]"
              placeholder={availableModels.length === 0 ? "请先配置模型" : "选择模型"}
            />
            <InlineDropdown
              label="思考强度"
              value={reasoningMode}
              disabled={disabled}
              onChange={(value) => setReasoningMode(value as RuntimeReasoningMode)}
              minWidthClass="min-w-[118px] bg-transparent hover:bg-[#f4f6f8]"
              options={REASONING_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </div>
          <div className="ml-auto flex min-w-max shrink-0 items-center gap-1 text-[#9ca0a7]">
            <button
              type="button"
              className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-50 ${showSlashBrowser ? "bg-[#ecfaf7] text-[#00ad9a]" : ""}`}
              onClick={() => setShowSlashBrowser((value) => !value)}
              aria-label="打开 Slash 命令列表"
              title="Slash 命令"
              disabled={disabled || slashCommands.length === 0}
            >
              <Menu className="h-[19px] w-[19px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-50 ${optimizingPrompt ? "bg-[#ecfaf7] text-[#00ad9a]" : ""}`}
              onClick={() => { void handleOptimizePrompt(); }}
              aria-label="优化 Prompt"
              title="优化 Prompt"
              disabled={disabled || optimizingPrompt}
            >
              <Sparkles className={`h-[19px] w-[19px] ${optimizingPrompt ? "animate-pulse" : ""}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`grid h-9 w-9 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${!hasDraft && isRunning ? "bg-error text-white hover:bg-error/90" : "bg-[#111111] text-white hover:bg-black"}`}
              onClick={handleButtonClick}
              aria-label={!hasDraft && isRunning ? "停止会话" : isRunning ? "加入待发送队列" : "发送提示"}
              disabled={disabled}
            >
              {!hasDraft && isRunning ? (
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <ArrowUp className="h-5 w-5 stroke-[2.4]" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.txt,.md,.markdown,.json,.yaml,.yml,.xml,.svg,.csv,.tsv,.log,.js,.jsx,.ts,.tsx,.py,.rb,.java,.go,.rs,.sh,.css,.html,.sql,.toml,.ini,.env"
          onChange={(event) => { void handleFileInputChange(event); }}
        />
      </div>
    </section>
  );
}

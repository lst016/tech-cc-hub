import type {
  CodeReferenceDraft,
  FileReferenceDraft,
  MessageReferenceDraft,
} from "../../store/useAppStore";

type BrowserAnnotationTarget = {
  type?: string;
  value?: string;
  alt?: string;
  url?: string;
};

type BrowserAnnotationDomHint = {
  target?: BrowserAnnotationTarget;
  text?: string;
  tagName?: string;
  role?: string;
  ariaLabel?: string;
  selector?: string;
  selectorCandidates?: string[];
  path?: string;
  xpath?: string;
  hitTagName?: string;
  hitPath?: string;
  hitXPath?: string;
  hitBoundingBox?: unknown;
  boundingBox?: unknown;
  computedStyle?: unknown;
  componentStack?: unknown;
  sourceCandidates?: unknown;
  componentStackSource?: unknown;
  componentStackConfidence?: unknown;
  context?: {
    nearbyText?: string;
    [key: string]: unknown;
  };
};

export type BrowserAnnotationPromptInput = {
  id: string;
  url: string;
  title?: string;
  comment?: string;
  expectation?: string;
  styleEdits?: unknown;
  point: { x: number; y: number };
  domHint?: BrowserAnnotationDomHint;
};

export function buildBrowserAnnotationsPrompt(annotations: BrowserAnnotationPromptInput[]) {
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
      styleEdits: annotation.styleEdits,
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
        selector: annotation.domHint.selector ?? annotation.domHint.selectorCandidates?.[0],
        selectorCandidates: annotation.domHint.selectorCandidates,
        path: annotation.domHint.path,
        xpath: annotation.domHint.xpath,
        hitTagName: annotation.domHint.hitTagName,
        hitPath: annotation.domHint.hitPath,
        hitXPath: annotation.domHint.hitXPath,
        hitBoundingBox: annotation.domHint.hitBoundingBox,
        boundingBox: annotation.domHint.boundingBox,
        computedStyle: annotation.domHint.computedStyle,
        componentStack: annotation.domHint.componentStack,
        sourceCandidates: annotation.domHint.sourceCandidates,
        componentStackSource: annotation.domHint.componentStackSource,
        componentStackConfidence: annotation.domHint.componentStackConfidence,
        context: annotation.domHint.context,
      } : undefined,
    })),
  };

  // 浏览器批注来自当前页面，优先级要高于旧截图和历史会话里的 DOM 线索。
  return [
    "<browser_annotations>",
    "This browser annotation block is the CURRENT DOM-targeting source of truth for the latest user request.",
    "Treat older screenshots, older browser annotations, and earlier modal/dialog work in resumed session history as stale unless the user explicitly asks to continue that same old target.",
    "Treat browser annotations as the primary DOM-targeting context for this request.",
    "Use page.url plus dom.selector/dom.xpath/dom.path before searching code by visible text.",
    "If an item has expectation, treat comment as the observed problem and expectation as the desired state.",
    "If an item has styleEdits, use those CSS before/after values as the requested visual delta; apply them to the owning source or design token rather than leaving temporary inline preview styles.",
    "If dom.computedStyle exists, use it as the current visual baseline for the marked element.",
    "If dom.sourceCandidates exists, use high-confidence file/line candidates before broader search.",
    "If dom.componentStack exists, use those component names as the first code-location bridge before generic grep.",
    "If dom.context.ancestorChain or dom.context.nearbyText exists, use it to identify the page section before grepping generic button/link text.",
    "If the selector looks too generic, inspect the same page location or use xpath/path to resolve the real interactive element first.",
    "Only fall back to grep/searching for visible text when the DOM clues are clearly insufficient.",
    JSON.stringify(payload, null, 2),
    "</browser_annotations>",
  ].join("\n");
}

export function mergePromptWithBrowserAnnotations(prompt: string, annotations: BrowserAnnotationPromptInput[]) {
  const annotationPrompt = buildBrowserAnnotationsPrompt(annotations);
  if (!annotationPrompt) return prompt;
  return [prompt.trim(), annotationPrompt].filter(Boolean).join("\n\n");
}

function getBrowserAnnotationTargetLabel(annotation: BrowserAnnotationPromptInput) {
  const target = annotation.domHint?.target;
  if (target?.type === "text" && target.value?.trim()) return target.value.trim();
  if (target?.type === "image") return target.alt?.trim() || target.url?.trim() || "图片";
  const text = annotation.domHint?.text?.trim();
  if (text) return text;
  const ariaLabel = annotation.domHint?.ariaLabel?.trim();
  if (ariaLabel) return ariaLabel;
  const nearbyText = annotation.domHint?.context?.nearbyText?.trim();
  if (nearbyText) return nearbyText.slice(0, 90);
  return annotation.domHint?.selector || annotation.domHint?.path || "";
}

export function getBrowserAnnotationLabel(annotation: BrowserAnnotationPromptInput, index: number) {
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

export function getBrowserAnnotationHoverTitle(annotation: BrowserAnnotationPromptInput) {
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

export function getCodeReferenceLineLabel(reference: CodeReferenceDraft) {
  return reference.startLine === reference.endLine
    ? `${reference.startLine}`
    : `${reference.startLine}-${reference.endLine}`;
}

export function getCodeReferenceFileLabel(reference: CodeReferenceDraft) {
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

export function mergePromptWithCodeReferences(prompt: string, references: CodeReferenceDraft[]) {
  const referencePrompt = buildCodeReferencesPrompt(references);
  if (!referencePrompt) return prompt;
  return [prompt.trim(), referencePrompt].filter(Boolean).join("\n\n");
}

export function getMessageReferenceLabel(reference: MessageReferenceDraft) {
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

export function mergePromptWithMessageReferences(prompt: string, references: MessageReferenceDraft[]) {
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

export function mergePromptWithFileReferences(prompt: string, references: FileReferenceDraft[]) {
  const referencePrompt = buildFileReferencesPrompt(references);
  if (!referencePrompt) return prompt;
  return [prompt.trim(), referencePrompt].filter(Boolean).join("\n\n");
}

export function mergePromptWithComposerContext(
  prompt: string,
  context: {
    codeReferences: CodeReferenceDraft[];
    fileReferences: FileReferenceDraft[];
    messageReferences: MessageReferenceDraft[];
    browserAnnotations: BrowserAnnotationPromptInput[];
  },
) {
  // 保持合并顺序稳定，避免历史里的结构化块顺序在不同入口间漂移。
  const withCodeReferences = mergePromptWithCodeReferences(prompt, context.codeReferences);
  const withFileReferences = mergePromptWithFileReferences(withCodeReferences, context.fileReferences);
  const withMessageReferences = mergePromptWithMessageReferences(withFileReferences, context.messageReferences);
  return mergePromptWithBrowserAnnotations(withMessageReferences, context.browserAnnotations);
}

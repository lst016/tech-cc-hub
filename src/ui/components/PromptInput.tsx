import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiConfigProfile,
  ClientEvent,
  PromptAttachment,
  RuntimeOverrides,
  RuntimeReasoningMode,
} from "../types";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_ALLOWED_TOOLS = "Read,Edit,Bash";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;
const SLASH_PREVIEW_LIMIT = 8;
const SLASH_QUERY_LIMIT = 16;

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
  disabled?: boolean;
  leftOffset?: number;
  rightOffset?: number;
}

const MAX_TEXT_ATTACHMENT_LENGTH = 20_000;
const MAX_IMAGE_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.88;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const TEXT_FILE_PATTERN = /\.(txt|md|markdown|json|ya?ml|xml|csv|tsv|log|js|jsx|ts|tsx|py|rb|java|go|rs|sh|css|html|sql|toml|ini|env)$/i;
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

function getBrowserAnnotationLabel(annotation: BrowserWorkbenchAnnotation, index: number) {
  const comment = annotation.comment?.trim();
  if (comment) return comment;
  const target = annotation.domHint?.target;
  if (target?.type === "text" && target.value.trim()) return target.value.trim();
  if (target?.type === "image") return target.alt?.trim() || "鍥剧墖";
  return annotation.domHint?.text?.trim() || annotation.domHint?.selector || `鎵规敞 ${index + 1}`;
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

  const displayLabel = options.find((option) => option.value === value)?.label ?? (options[0]?.label ?? "璇烽€夋嫨");

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
      className={`relative inline-flex h-9 ${minWidthClass} items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/92 px-3 text-xs text-ink-700 shadow-[0_10px_28px_rgba(15,18,24,0.06)]`}
    >
      <span className="text-muted">{label}</span>
      <button
        type="button"
        className={`inline-flex h-8 min-w-[96px] items-center justify-between gap-2 rounded-lg border border-black/12 px-3 text-[13px] text-ink-800 transition ${disabled ? "cursor-not-allowed bg-black/5 opacity-60" : "cursor-pointer bg-white hover:bg-surface-secondary"}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className="max-w-[170px] truncate">{displayLabel}</span>
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

type QueuedMessageDraft = {
  id: string;
  prompt: string;
  attachments: PromptAttachment[];
  createdAt: number;
};

function buildQueuedPrompt(queue: QueuedMessageDraft[]) {
  if (queue.length === 1) return queue[0].prompt;
  return queue
    .map((item, index) => {
      const content = item.prompt.trim() || "(no text, attachments only)";
      return `Queued message ${index + 1}:\n${content}`;
    })
    .join("\n\n---\n\n");
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
  if (file.type.startsWith("image/")) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`暂不支持 ${file.type} 图片格式，请优先使用 PNG、JPEG、GIF 或 WebP。`);
    }
    const normalizedImage = await downscaleImageFile(file);
    return {
      id: crypto.randomUUID(),
      kind: "image",
      name: file.name || `鍥剧墖-${Date.now()}.png`,
      mimeType: normalizedImage.mimeType,
      data: normalizedImage.dataUrl,
      preview: normalizedImage.dataUrl,
      size: normalizedImage.size,
    };
  }

  if (isTextFile(file)) {
    const text = await readFileAsText(file);
    const normalizedText = text.length > MAX_TEXT_ATTACHMENT_LENGTH
      ? `${text.slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}\n\n[宸叉埅鏂紝鍘熷闀垮害 ${text.length} 瀛楃]`
      : text;
    return {
      id: crypto.randomUUID(),
      kind: "text",
      name: file.name || `鏂囨湰-${Date.now()}.txt`,
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
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
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
  const slashCommands = useMemo(() => activeSession?.slashCommands ?? [], [activeSession?.slashCommands]);
  const activeProfile = apiConfigSettings.profiles.find((profile) => profile.enabled) ?? apiConfigSettings.profiles[0];
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

  const validatePromptDraft = useCallback((promptValue: string) => {
    if (promptValue.startsWith("/") && slashCommands.length > 0) {
      const slashName = promptValue.trim().slice(1).split(/\s+/)[0];
      const normalized = slashCommands.map((command) => command.replace(/^\//, ""));
      if (slashName && !normalized.includes(slashName)) {
        return `当前会话不支持 /${slashName}。可用命令请从下方联想列表中选择。`;
      }
    }

    return null;
  }, [slashCommands]);

  const buildRuntimeOverrides = useCallback((): RuntimeOverrides | null => {
    const selectedModel = runtimeModel.trim() || activeProfile?.model?.trim() || resolveSessionRuntimeModel();
    if (!selectedModel) {
      setGlobalError("请先在设置里启用配置，并至少提供一个模型。");
      return null;
    }

    const availableModels = activeProfile
      ? Array.from(
          new Set([
            activeProfile.model,
            ...(activeProfile.models ?? []).map((item) => item.name),
          ]),
        ).filter(Boolean)
      : [];

    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setGlobalError("当前选择的模型不在已启用配置的模型列表里，请重新选择。");
      return null;
    }

    return {
      model: selectedModel,
      reasoningMode,
      permissionMode,
      agentId: selectedAgentId || undefined,
    };
  }, [activeProfile, activeSessionModel, permissionMode, reasoningMode, resolveSessionRuntimeModel, runtimeModel, selectedAgentId, setGlobalError]);

  const prepareAttachmentsForDispatch = useCallback(async (
    promptValue: string,
    attachments: PromptAttachment[],
  ): Promise<PromptAttachment[] | null> => {
    void promptValue;
    // 涓存椂鍏抽棴鍥剧墖棰勫鐞嗘嫤鎴細褰撳墠閾捐矾浼氬奖鍝嶈亰澶╁浘鐗囬瑙堝拰鐪熷疄闄勪欢浼犻€掋€?
    // 鍏堣鍥剧墖鎸夊墠绔?downscale 鍚庣殑 data URL 鍘熸牱鍙戦€侊紝淇濊瘉鏍稿績鑱婂ぉ/鎴浘鍙傝€冨姛鑳藉彲鐢ㄣ€?
    return attachments;

    const hasImageAttachments = attachments.some((attachment) => attachment.kind === "image");
    const imageModel = activeProfile?.imageModel?.trim();
    const selectedModel = runtimeModel.trim() || activeProfile?.model?.trim() || resolveSessionRuntimeModel();

    if (!hasImageAttachments) {
      return attachments;
    }

    if (!imageModel) {
      setGlobalError("当前配置没有图片预处理模型，不能可靠识别图片。请先在设置 -> 接口配置里选择支持图片的模型后再发送。");
      return null;
    }

    const result = await window.electron.preprocessImageAttachments({
      prompt: promptValue,
      selectedModel,
      attachments,
    });

    if (!result.success) {
      setGlobalError(result.error || "图片预处理失败。");
      return null;
    }

    return result.attachments;
  }, [activeProfile?.imageModel, activeProfile?.model, activeSessionModel, resolveSessionRuntimeModel, runtimeModel, setGlobalError]);

  const sendPromptDraft = useCallback(async (
    promptValue: string,
    attachments: PromptAttachment[] = [],
    options: { clearPrompt?: boolean } = {},
  ) => {
    const { clearPrompt = true } = options;
    if (!promptValue.trim() && attachments.length === 0) return false;
    const runtime = buildRuntimeOverrides();
    if (!runtime) return false;
    const preparedAttachments = await prepareAttachmentsForDispatch(promptValue, attachments);
    if (!preparedAttachments) return false;

    if (!activeSessionId) {
      let title = "";
      try {
        setPendingStart(true);
        const titleSeed = buildDraftTitle(promptValue, attachments);
        title = promptValue.trim() ? await window.electron.generateSessionTitle(titleSeed) : titleSeed;
      } catch (error) {
        console.error(error);
        setPendingStart(false);
        setGlobalError("生成会话标题失败。");
        return false;
      }
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
      sendEvent({ type: "session.continue", payload: { sessionId: activeSessionId, prompt: promptValue, attachments: preparedAttachments, runtime } });
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
  const availableAgents = useAppStore((state) => state.availableAgents);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const permissionMode = useAppStore((state) => state.permissionMode);
  const setPermissionMode = useAppStore((state) => state.setPermissionMode);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const compositionEndedAtRef = useRef(0);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [queuedMessagesBySession, setQueuedMessagesBySession] = useState<Record<string, QueuedMessageDraft[]>>({});
  const [showSlashBrowser, setShowSlashBrowser] = useState(false);
  const autoDispatchRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const setGlobalError = useAppStore((state) => state.setGlobalError);
  const slashQuery = prompt.startsWith("/") ? prompt.trim().slice(1).split(/\s+/)[0] ?? "" : "";
  const activeQueue = useMemo(() => {
    if (!activeSessionId) return [];
    return queuedMessagesBySession[activeSessionId] ?? [];
  }, [activeSessionId, queuedMessagesBySession]);
  const hasDraft = prompt.trim().length > 0 || attachments.length > 0 || browserAnnotations.length > 0;
  const filteredSlashCommands = useMemo(() => {
    const matchedCommands = !slashQuery
      ? slashCommands
      : slashCommands.filter((command) => command.replace(/^\//, "").includes(slashQuery));

    if (showSlashBrowser) {
      return matchedCommands;
    }

    if (!slashQuery) {
      return matchedCommands.slice(0, SLASH_PREVIEW_LIMIT);
    }
    return matchedCommands.slice(0, SLASH_QUERY_LIMIT);
  }, [showSlashBrowser, slashCommands, slashQuery]);
  const showSlashPalette = (prompt.startsWith("/") || showSlashBrowser) && filteredSlashCommands.length > 0 && !disabled;
  const activeProfile = useMemo<ApiConfigProfile | undefined>(() => {
    return apiConfigSettings.profiles.find((profile) => profile.enabled) ?? apiConfigSettings.profiles[0];
  }, [apiConfigSettings]);
  const availableModels = useMemo(() => {
    if (!activeProfile) return [];
    return Array.from(
      new Set([
        activeProfile.model,
        activeProfile.expertModel,
        ...(activeProfile.models ?? []).map((item) => item.name),
      ]),
    )
      .map((item) => item?.trim() ?? "")
      .filter(Boolean);
  }, [activeProfile]);
  const clearComposer = useCallback(() => {
    setPrompt("");
    setAttachments([]);
    if (activeSessionId) {
      setBrowserWorkbenchAnnotations(activeSessionId, []);
    }
    clearBrowserAnnotations();
    void window.electron.clearBrowserWorkbenchAnnotations?.(activeSessionId ?? undefined);
    setShowSlashBrowser(false);
  }, [activeSessionId, clearBrowserAnnotations, setBrowserWorkbenchAnnotations, setPrompt]);

  const removeQueuedDraft = useCallback((queueId: string) => {
    if (!activeSessionId) return;
    setQueuedMessagesBySession((current) => {
      const nextQueue = (current[activeSessionId] ?? []).filter((item) => item.id !== queueId);
      if (nextQueue.length === 0) {
        const rest = { ...current };
        delete rest[activeSessionId];
        return rest;
      }
      return {
        ...current,
        [activeSessionId]: nextQueue,
      };
    });
  }, [activeSessionId]);

  const appendQueuedDraft = useCallback((queuedMessage: QueuedMessageDraft) => {
    if (!activeSessionId) return;
    sendEvent({
      type: "session.append",
      payload: {
        sessionId: activeSessionId,
        prompt: queuedMessage.prompt,
        attachments: queuedMessage.attachments,
      },
    });
    removeQueuedDraft(queuedMessage.id);
    onSendMessage?.();
  }, [activeSessionId, onSendMessage, removeQueuedDraft, sendEvent]);

  const editQueuedDraft = useCallback((queuedMessage: QueuedMessageDraft) => {
    setPrompt(queuedMessage.prompt);
    setAttachments(queuedMessage.attachments);
    removeQueuedDraft(queuedMessage.id);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }, [removeQueuedDraft, setPrompt]);

  const queueCurrentDraft = useCallback(() => {
    if (!activeSessionId) return false;
    if (!hasDraft) return false;

    const promptWithAnnotations = mergePromptWithBrowserAnnotations(prompt, browserAnnotations);
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
    return true;
  }, [activeSessionId, attachments, browserAnnotations, clearComposer, hasDraft, prompt, setGlobalError, validatePromptDraft]);

  const submitCurrentInput = useCallback(async () => {
    if (!hasDraft) return false;
    if (submitInFlightRef.current) return false;

    submitInFlightRef.current = true;
    try {
      if (isRunning) {
        return queueCurrentDraft();
      }

      const promptSnapshot = prompt;
      const attachmentsSnapshot = attachments;
      const promptWithAnnotations = mergePromptWithBrowserAnnotations(promptSnapshot, browserAnnotations);
      const hasImageAttachments = attachmentsSnapshot.some((attachment) => attachment.kind === "image");
      const validationError = validatePromptDraft(promptWithAnnotations);
      if (validationError) {
        setGlobalError(validationError);
        return false;
      }

      clearComposer();
      setSubmissionStatus(hasImageAttachments ? "姝ｅ湪鍘嬬缉骞惰瘑鍒浘鐗囷紝鏈湴瑙嗚妯″瀷鍙兘闇€瑕佸嚑鍗佺..." : "姝ｅ湪鍙戦€?..");

      const sent = await sendPromptDraft(promptWithAnnotations, attachmentsSnapshot, { clearPrompt: false });
      if (sent) {
        onSendMessage?.();
      } else {
        setPrompt(promptSnapshot);
        setAttachments(attachmentsSnapshot);
      }
      return sent;
    } finally {
      setSubmissionStatus(null);
      submitInFlightRef.current = false;
    }
  }, [attachments, browserAnnotations, clearComposer, hasDraft, isRunning, onSendMessage, prompt, queueCurrentDraft, sendPromptDraft, setGlobalError, setPrompt, validatePromptDraft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    const justEndedComposition = Date.now() - compositionEndedAtRef.current < 80;
    if (e.nativeEvent.isComposing || isComposingRef.current || justEndedComposition) return;
    e.preventDefault();
    void submitCurrentInput();
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

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
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
    if (!activeSessionId || disabled || isRunning || activeQueue.length === 0) {
      autoDispatchRef.current = null;
      return;
    }

    const queuedSnapshot = activeQueue.slice();
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
      }

      autoDispatchRef.current = null;
    })();
  }, [activeQueue, activeSessionId, disabled, isRunning, onSendMessage, sendPromptDraft]);

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
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(229,234,240,0.72)] via-[rgba(229,234,240,0.18)] to-transparent pb-6 px-3 pt-10 lg:pb-8"
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
        <div className="mx-auto mb-3 w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]">
          <div className="overflow-hidden rounded-[24px] border border-black/6 bg-white/94 shadow-[0_18px_50px_rgba(30,38,52,0.08)] backdrop-blur">
            <div className="border-b border-black/6 px-4 py-2 text-xs font-medium text-muted">
              鍙敤 Slash 鍛戒护
            </div>
            <div className="grid max-h-[min(42vh,320px)] gap-1 overflow-y-auto p-2">
              {filteredSlashCommands.map((command) => (
                <button
                  key={command}
                  type="button"
                  className="rounded-xl px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-surface-secondary"
                  onClick={() => {
                    const suffix = prompt.includes(" ") ? prompt.slice(prompt.indexOf(" ")) : "";
                    setPrompt(`/${command.replace(/^\//, "")}${suffix}`);
                    setShowSlashBrowser(false);
                    promptRef.current?.focus();
                  }}
                >
                  <span className="font-medium text-accent">/{command.replace(/^\//, "")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] rounded-[30px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,251,0.94))] px-4 py-3 shadow-[0_24px_60px_rgba(30,38,52,0.08)] backdrop-blur-xl xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]">
        {activeQueue.length > 0 && (
          <div className="mb-3 rounded-2xl border border-black/6 bg-[#f6f8fb] px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-ink-700">待发送队列 · {activeQueue.length} 条</div>
              <div className="text-[11px] text-muted">运行中可点「插入」作为补充命令；空闲后会自动续发。</div>
            </div>
            <div className="grid gap-2">
              {activeQueue.map((queuedMessage, index) => {
                const label = queuedMessage.prompt.trim()
                  || (queuedMessage.attachments.length === 1
                    ? `附件：${queuedMessage.attachments[0].name}`
                    : `${queuedMessage.attachments.length} 个附件`);
                return (
                  <div key={queuedMessage.id} className="group flex items-center gap-2 rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs text-ink-700 transition hover:border-accent/18 hover:shadow-[0_10px_24px_rgba(30,38,52,0.06)]">
                    <span className="shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {index === 0 ? "下一条" : `排队 ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left transition hover:text-accent"
                      onClick={() => editQueuedDraft(queuedMessage)}
                      title="点击编辑这条待发送消息"
                    >
                      {label}
                    </button>
                    {queuedMessage.attachments.length > 0 && (
                      <span className="shrink-0 rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11px] text-muted">
                        附件 {queuedMessage.attachments.length}
                      </span>
                    )}
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
                      className="rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                      onClick={() => removeQueuedDraft(queuedMessage.id)}
                      aria-label="移除待发送消息"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex max-w-full items-center gap-2 rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs text-ink-700">
                <span className="shrink-0 rounded-full bg-accent/18 px-2 py-0.5 text-[11px] text-[#ffb290]">
                  {attachment.kind === "image" ? "鍥剧墖" : "鏂囨湰"}
                </span>
                <span className="truncate max-w-[180px]">{attachment.name}</span>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted hover:bg-black/5 hover:text-ink-700"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  aria-label={`绉婚櫎闄勪欢 ${attachment.name}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {browserAnnotations.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {browserAnnotations.slice().reverse().map((annotation, index) => {
              const label = getBrowserAnnotationLabel(annotation, index);
              return (
                <div
                  key={annotation.id}
                  className="inline-flex h-10 max-w-[240px] items-center gap-2 rounded-full border border-black/8 bg-white px-3 text-sm font-semibold text-ink-800 shadow-[0_10px_24px_rgba(15,18,24,0.08)]"
                  title="浏览器批注会以结构化 JSON 随消息一起发送"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate">{label}</span>
                  <button
                    type="button"
                    className="ml-1 rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink-700"
                    onClick={() => {
                      const nextAnnotations = browserAnnotations.filter((item) => item.id !== annotation.id);
                      if (activeSessionId) {
                        setBrowserWorkbenchAnnotations(activeSessionId, nextAnnotations);
                      } else {
                        setBrowserAnnotations(nextAnnotations);
                      }
                    }}
                    aria-label={`绉婚櫎娴忚鍣ㄦ壒娉?${index + 1}`}
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
                娓呯┖
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-3">
          {slashCommands.length > 0 && (
            <button
              type="button"
              className={`flex h-10 shrink-0 items-center justify-center rounded-2xl border px-3 text-sm transition-colors ${showSlashBrowser ? "border-accent/30 bg-accent-subtle text-accent" : "border-black/6 bg-white text-ink-700 hover:bg-surface-secondary"}`}
              onClick={() => setShowSlashBrowser((value) => !value)}
              aria-label="鎵撳紑 Slash 鍛戒护鍒楄〃"
              disabled={disabled}
            >
              /
            </button>
          )}
          <button
            type="button"
            className="flex h-10 shrink-0 items-center justify-center rounded-2xl border border-black/6 bg-white px-3 text-sm text-ink-700 transition-colors hover:bg-surface-secondary"
            onClick={() => fileInputRef.current?.click()}
            aria-label="娣诲姞闄勪欢"
            disabled={disabled}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21.44 11.05 12.25 20.24a6 6 0 1 1-8.49-8.49l9.2-9.19a4 4 0 1 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            rows={1}
            className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-7 text-ink-800 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={
              disabled
                ? "先创建或选择一个会话..."
                : attachments.length > 0
                    ? "可以继续补充文字说明，或直接发送附件..."
                    : isRunning
                      ? "当前仍在执行中，你可以继续输入，系统会自动排队续发..."
                      : "直接描述你希望 Agent 处理的事情..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              compositionEndedAtRef.current = Date.now();
            }}
            onInput={handleInput}
            onPaste={(event) => { void handlePaste(event); }}
            ref={promptRef}
            disabled={disabled}
          />
          <button
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_12px_24px_rgba(15,18,24,0.26)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${!hasDraft && isRunning ? "bg-error text-white hover:bg-error/90" : "bg-white text-ink-900 hover:bg-[#f3f5f8]"}`}
            onClick={handleButtonClick}
            aria-label={!hasDraft && isRunning ? "停止会话" : isRunning ? "加入待发送队列" : "发送提示"}
            disabled={disabled}
          >
            {!hasDraft && isRunning ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" /></svg>
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/6 pt-3">
          <InlineDropdown
            label="Agent"
            value={selectedAgentId}
            disabled={disabled || availableAgents.length === 0}
            onChange={setSelectedAgentId}
            minWidthClass="min-w-[180px]"
            options={
              availableAgents.length === 0
                ? [{ value: "", label: "默认" }]
                : [{ value: "", label: "默认" }, ...availableAgents.map((a) => ({ value: a.id, label: a.name }))]
            }
          />
          <InlineDropdown
            label="模型"
            value={runtimeModel}
            disabled={disabled || availableModels.length === 0}
            onChange={setRuntimeModel}
            minWidthClass="min-w-[200px]"
            options={
              availableModels.length === 0
                ? [{ value: "", label: "请先配置模型" }]
                : availableModels.map((model) => ({ value: model, label: model }))
            }
          />
          <InlineDropdown
            label="思考强度"
            value={reasoningMode}
            disabled={disabled}
            onChange={(value) => setReasoningMode(value as RuntimeReasoningMode)}
            minWidthClass="min-w-[180px]"
            options={REASONING_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
          <label className="inline-flex min-w-[180px] cursor-pointer items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/92 px-3 py-2 text-xs text-ink-700 shadow-[0_10px_28px_rgba(15,18,24,0.06)]">
            <span className="text-muted">Plan 模式</span>
            <button
              type="button"
              role="switch"
              aria-checked={permissionMode === "plan"}
              aria-label="切换 Plan 模式"
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition ${permissionMode === "plan" ? "border-[#f59a55] bg-[#ffddb8]" : "border-black/20 bg-black/10"} disabled:opacity-60`}
              onClick={() => setPermissionMode(permissionMode === "plan" ? "bypassPermissions" : "plan")}
              disabled={disabled}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-4 translate-y-[1px] rounded-full bg-white transition ${permissionMode === "plan" ? "translate-x-4" : "translate-x-0.5"} shadow`}
              />
            </button>
          </label>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/png,image/jpeg,image/gif,image/webp,.txt,.md,.markdown,.json,.yaml,.yml,.xml,.csv,.tsv,.log,.js,.jsx,.ts,.tsx,.py,.rb,.java,.go,.rs,.sh,.css,.html,.sql,.toml,.ini,.env"
          onChange={(event) => { void handleFileInputChange(event); }}
        />
      </div>
    </section>
  );
}

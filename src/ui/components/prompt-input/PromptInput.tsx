import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { SetStateAction } from "react";
import { ArrowUp, Menu, Sparkles, Square } from "lucide-react";
import type {
  ApiConfigProfile,
  ClientEvent,
  PromptAttachment,
} from "../../types";
import {
  getCodeReferenceSessionKey,
  getPromptDraftSessionKey,
  useAppStore,
  type CodeReferenceDraft,
  type FileReferenceDraft,
  type MessageReferenceDraft,
  type PermissionRequest,
} from "../../store/useAppStore";
import { getPlainTextFromClipboardData } from "../../utils/clipboard-text";
import { resetBrowserWorkbenchAnnotationState } from "../../utils/browser-annotation-reset";
import { getSlashCommandContext, getSlashCommandQuery, isCompletedSlashCommandContext, isDismissedSlashCommandQuery } from "../../utils/slash-command-input";
import { buildSlashCommandDisplayParts, serializeSlashCommandDraft } from "../../utils/slash-command-display";
import { getPromptTextFromEditor, getSelectionOffsetInEditor, getSelectionRangeInEditor, renderPromptEditorContent, restoreEditorSelection } from "../../utils/prompt-editor-content";
import { getPromptParagraphInputAction, insertTextIntoPrompt, resolvePromptEditorInputCursor, shouldBlockPromptEnterAfterComposition, shouldInsertPromptNewline, shouldSubmitPromptOnEnter, shouldSuppressPromptAutoReplacement } from "../../utils/prompt-editor-keyboard";
import { usePromptActions, type SlashCommandOption } from "./usePromptActions";
import {
  collectFileMentionOptions,
  getFileMentionContext,
  normalizeMentionPath,
  scoreFileMentionOption,
  type FileMentionOption,
} from "./file-mention-options";
import { fileToAttachment, hasDraggedFiles } from "./prompt-attachments";
import {
  buildQueuedPrompt,
  mergeQueuedAttachments,
  readQueuedMessagesFromStorage,
  writeQueuedMessagesToStorage,
  type QueuedMessageDraft,
} from "./prompt-queue";
import {
  mergePromptWithComposerContext,
} from "./prompt-context-blocks";
import {
  ADD_PROMPT_ATTACHMENT_EVENT,
  PROMPT_FOCUS_EVENT,
  PROMPT_SENT_EVENT,
  PROMPT_SUBMIT_EVENT,
  type AddPromptAttachmentDetail,
} from "../../events";
import { DecisionPanel } from "../DecisionPanel";
import { ComposerModelMenu } from "./ComposerModelMenu";
import {
  AttachmentChips,
  BrowserAnnotationChips,
  CodeReferenceChips,
  MessageFileReferenceChips,
  QueuedMessagesPanel,
} from "./PromptComposerContextChips";
import { PromptComposerTerminalStrip } from "./PromptComposerTerminalStrip";
import {
  getEnabledProfiles,
  getRoutedModelOptionsForProfiles,
  resolveAvailableModelName,
} from "../settings/settings-utils";


const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;
const IME_ENTER_GRACE_MS = 120;
const FILE_MENTION_PREVIEW_LIMIT = 10;
const COMPOSER_SURFACE_WIDTH_CLASS = "w-full min-w-[min(430px,_100%)] max-w-[clamp(920px,_calc(100vw-420px),_1320px)] xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]";
const EMPTY_CODE_REFERENCES: CodeReferenceDraft[] = [];
const EMPTY_FILE_REFERENCES: FileReferenceDraft[] = [];
const EMPTY_MESSAGE_REFERENCES: MessageReferenceDraft[] = [];
const EMPTY_ATTACHMENTS: PromptAttachment[] = [];

type PromptOptimizeResult = {
  success: boolean;
  optimizedPrompt?: string;
  model?: string;
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

export function PromptInput({
  sendEvent,
  onSendMessage,
  permissionRequest,
  onPermissionResult,
  disabled = false,
  leftOffset = 320,
  rightOffset = 340,
}: PromptInputProps) {
  const storeCwd = useAppStore((state) => state.cwd);
  const storeActiveSessionId = useAppStore((state) => state.activeSessionId);
  const storeActiveSessionCwd = useAppStore((state) => {
    if (!storeActiveSessionId) return "";
    return (state.sessions[storeActiveSessionId] ?? state.archivedSessions[storeActiveSessionId])?.cwd ?? "";
  });
  const selectedWorkspaceCwd = (storeCwd.trim() || storeActiveSessionCwd.trim());
  const { prompt, setPrompt, isRunning, handleStop, slashCommands, activeSessionId, browserAnnotations, sendPromptDraft, validatePromptDraft } = usePromptActions(
    sendEvent,
    { workspaceCwd: selectedWorkspaceCwd },
  );
  const setBrowserAnnotations = useAppStore((state) => state.setBrowserAnnotations);
  const setBrowserWorkbenchAnnotations = useAppStore((state) => state.setBrowserWorkbenchAnnotations);
  const clearBrowserAnnotations = useAppStore((state) => state.clearBrowserAnnotations);
  const apiConfigSettings = useAppStore((state) => state.apiConfigSettings);
  const runtimeModel = useAppStore((state) => state.runtimeModel);
  const setRuntimeModel = useAppStore((state) => state.setRuntimeModel);
  const setSessionModel = useAppStore((state) => state.setSessionModel);
  const reasoningMode = useAppStore((state) => state.reasoningMode);
  const setReasoningMode = useAppStore((state) => state.setReasoningMode);
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
  const [attachmentsBySessionId, setAttachmentsBySessionId] = useState<Record<string, PromptAttachment[]>>({});
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
  const composerDraftSessionKey = getPromptDraftSessionKey(activeSessionId);
  const codeReferenceSessionKey = getCodeReferenceSessionKey(activeSessionId);
  const activeSessionCwd = useAppStore((state) => {
    if (!activeSessionId) return "";
    return (state.sessions[activeSessionId] ?? state.archivedSessions[activeSessionId])?.cwd ?? "";
  });
  const activeSessionModel = useAppStore((state) => {
    if (!activeSessionId) return "";
    return (state.sessions[activeSessionId] ?? state.archivedSessions[activeSessionId])?.model?.trim() ?? "";
  });
  const effectiveCwd = activeSessionCwd.trim() || selectedWorkspaceCwd;
  const attachments = attachmentsBySessionId[composerDraftSessionKey] ?? EMPTY_ATTACHMENTS;
  const setAttachments = useCallback((nextAttachments: SetStateAction<PromptAttachment[]>) => {
    setAttachmentsBySessionId((current) => {
      const currentAttachments = current[composerDraftSessionKey] ?? EMPTY_ATTACHMENTS;
      const resolvedAttachments = typeof nextAttachments === "function"
        ? nextAttachments(currentAttachments)
        : nextAttachments;
      if (resolvedAttachments.length === 0) {
        if (!current[composerDraftSessionKey]) return current;
        const nextBySession = { ...current };
        delete nextBySession[composerDraftSessionKey];
        return nextBySession;
      }
      return {
        ...current,
        [composerDraftSessionKey]: resolvedAttachments,
      };
    });
  }, [composerDraftSessionKey]);
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
    if (!query) {
      return fileMentionOptions.slice(0, FILE_MENTION_PREVIEW_LIMIT);
    }

    return fileMentionOptions
      .map((option) => {
        const score = scoreFileMentionOption(option, query);
        return score === null
          ? null
          : {
              option,
              score: score + (option.kind === "file" ? 0 : 0.2),
            };
      })
      .filter((item): item is { option: FileMentionOption; score: number } => Boolean(item))
      .sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label, "zh-CN"))
      .slice(0, FILE_MENTION_PREVIEW_LIMIT)
      .map((item) => item.option);
  }, [fileMentionContext, fileMentionOptions]);
  const showFileMentionPalette = Boolean(fileMentionContext) && !showSlashPalette && !disabled && (fileMentionLoading || filteredFileMentionOptions.length > 0);
  const enabledProfiles = useMemo<ApiConfigProfile[]>(() => getEnabledProfiles(apiConfigSettings.profiles), [apiConfigSettings.profiles]);
  const routedModelOptions = useMemo(() => getRoutedModelOptionsForProfiles(enabledProfiles), [enabledProfiles]);
  const availableModels = useMemo(() => routedModelOptions.map((option) => option.value), [routedModelOptions]);
  const modelSelectOptions = useMemo(() => routedModelOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.routeLabel,
    badge: option.routingWeight > 0 ? `W${option.routingWeight}` : option.providerLabel,
    title: `${option.value} -> ${option.routeLabel}`,
  })), [routedModelOptions]);
  const activeProfile = enabledProfiles[0];
  const explicitRuntimeModel = activeSessionModel || runtimeModel.trim();
  const selectedRuntimeModel = resolveAvailableModelName(
    explicitRuntimeModel || routedModelOptions[0]?.value || activeProfile?.model?.trim(),
    availableModels,
  );
  const handleRuntimeModelChange = useCallback((model: string) => {
    const nextModel = model.trim();
    setRuntimeModel(nextModel);
    if (activeSessionId) {
      setSessionModel(activeSessionId, nextModel);
      sendEvent({
        type: "session.set_model",
        payload: {
          sessionId: activeSessionId,
          model: nextModel,
        },
      });
    }
  }, [activeSessionId, sendEvent, setRuntimeModel, setSessionModel]);
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
  }, [activeSessionId, clearBrowserAnnotations, clearCodeReferences, clearFileReferences, clearMessageReferences, setAttachments, setBrowserWorkbenchAnnotations, setPromptDraft]);

  const clearPromptDraftText = useCallback(() => {
    setPromptDraft("", 0);
    setShowSlashBrowser(false);
    setDismissedSlashQuery(null);
  }, [setPromptDraft]);

  const removeBrowserAnnotationDraft = useCallback((annotationId: string) => {
    const nextAnnotations = browserAnnotations.filter((item) => item.id !== annotationId);
    if (activeSessionId) {
      setBrowserWorkbenchAnnotations(activeSessionId, nextAnnotations);
    } else {
      setBrowserAnnotations(nextAnnotations);
    }
    void window.electron.removeBrowserWorkbenchAnnotation?.(annotationId, activeSessionId ?? undefined)
      .catch((error) => console.warn("Failed to remove browser annotation marker:", error));
  }, [activeSessionId, browserAnnotations, setBrowserAnnotations, setBrowserWorkbenchAnnotations]);

  const clearBrowserAnnotationDrafts = useCallback(() => {
    if (activeSessionId) {
      setBrowserWorkbenchAnnotations(activeSessionId, []);
    } else {
      clearBrowserAnnotations();
    }
    void window.electron.clearBrowserWorkbenchAnnotations(activeSessionId ?? undefined)
      .catch((error) => console.warn("Failed to clear browser annotation markers:", error));
  }, [activeSessionId, clearBrowserAnnotations, setBrowserWorkbenchAnnotations]);

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
  }, [activeSessionId, focusPromptEditor, removeQueuedDraft, setAttachments, setPromptDraft]);

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

    const promptWithAnnotations = mergePromptWithComposerContext(currentPrompt, {
      codeReferences,
      fileReferences,
      messageReferences,
      browserAnnotations,
    });
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
      const promptWithAnnotations = mergePromptWithComposerContext(promptSnapshot, {
        codeReferences,
        fileReferences,
        messageReferences,
        browserAnnotations,
      });
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
  }, [attachments, browserAnnotations, clearComposer, clearPromptDraftText, codeReferences, fileReferences, getCurrentPromptDraft, isRunning, messageReferences, onSendMessage, queueCurrentDraft, sendPromptDraft, setAttachments, setGlobalError, setPromptDraft, validatePromptDraft]);

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
  }, [setAttachments, setGlobalError]);

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    const clipboardFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (clipboardFiles.length > 0) {
      event.preventDefault();
      await addFiles(clipboardFiles);
      return;
    }

    const plainText = getPlainTextFromClipboardData(event.clipboardData);
    if (!plainText) return;

    event.preventDefault();
    const editor = promptRef.current ?? event.currentTarget;
    editor.focus();

    const currentPrompt = getPromptTextFromEditor(editor);
    const fallbackCursor = cursorIndex || currentPrompt.length;
    const selection = getSelectionRangeInEditor(editor) ?? { start: fallbackCursor, end: fallbackCursor };
    const nextDraft = insertTextIntoPrompt(currentPrompt, plainText, selection.start, selection.end);
    setPromptDraft(nextDraft.prompt, nextDraft.cursorIndex);
    focusPromptEditor(nextDraft.cursorIndex);
  }, [addFiles, cursorIndex, disabled, focusPromptEditor, setPromptDraft]);

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
    const nativeEvent = e.nativeEvent as InputEvent;
    const composingInputType = nativeEvent.inputType === "insertCompositionText" || nativeEvent.inputType === "deleteCompositionText";
    if (nativeEvent.isComposing || composingInputType) {
      isComposingRef.current = true;
    }
    const previousPrompt = promptDraftRef.current;
    const nextPrompt = getPromptTextFromEditor(target);
    const nextCursor = resolvePromptEditorInputCursor(previousPrompt, nextPrompt, getSelectionOffsetInEditor(target));
    promptDraftRef.current = nextPrompt;
    pendingCursorOffsetRef.current = nextCursor;
    // Avoid repainting native edits; replacing contenteditable children clears the browser undo stack.
    target.dataset.renderedPrompt = nextPrompt;
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
    if (shouldSuppressPromptAutoReplacement({
      inputType: event.inputType,
      isComposing: event.isComposing,
      data: event.data,
    }, isComposingRef.current)) {
      event.preventDefault();
      return;
    }
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
  }, [setAttachments, setGlobalError]);

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
        <div className={`prompt-composer-surface relative z-[130] mx-auto mb-3 ${COMPOSER_SURFACE_WIDTH_CLASS}`}>
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
        <div className={`prompt-composer-surface mx-auto mb-3 ${COMPOSER_SURFACE_WIDTH_CLASS}`}>
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
        className={`prompt-composer-surface prompt-composer-card relative mx-auto ${COMPOSER_SURFACE_WIDTH_CLASS} rounded-[18px] border bg-white px-4 pb-3 pt-4 shadow-[0_10px_30px_rgba(15,18,24,0.07)] transition-colors ${isDraggingFiles ? "border-accent/45 shadow-[0_18px_42px_rgba(255,122,64,0.16)]" : "border-[#d9dde3]"}`}
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
        <div className="prompt-composer-body min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <QueuedMessagesPanel
          queue={currentSessionQueue}
          isRunning={isRunning}
          onClear={() => {
            if (!activeSessionId) return;
            setQueuedMessagesBySession((current) => {
              const next = { ...current };
              delete next[activeSessionId];
              return next;
            });
          }}
          onAppend={(queuedMessage) => { void appendQueuedDraft(queuedMessage); }}
          onEdit={editQueuedDraft}
          onRemove={removeQueuedDraft}
        />
        {permissionRequest?.toolName === "AskUserQuestion" && onPermissionResult && (
          <div className="mb-3">
            <DecisionPanel
              request={permissionRequest}
              compact
              onSubmit={(result) => onPermissionResult(permissionRequest.toolUseId, result)}
            />
          </div>
        )}
        <AttachmentChips
          attachments={attachments}
          onRemove={(attachmentId) => setAttachments((current) => current.filter((item) => item.id !== attachmentId))}
        />

        <MessageFileReferenceChips
          messageReferences={messageReferences}
          fileReferences={fileReferences}
          onRemoveMessage={(referenceId) => removeMessageReference(activeSessionId, referenceId)}
          onRemoveFile={(referenceId) => removeFileReference(activeSessionId, referenceId)}
          onClear={() => {
            clearMessageReferences(activeSessionId);
            clearFileReferences(activeSessionId);
          }}
        />

        <CodeReferenceChips
          codeReferences={codeReferences}
          editingId={editingCodeReferenceId}
          editingComment={editingCodeReferenceComment}
          onEditingCommentChange={setEditingCodeReferenceComment}
          onStartEdit={(reference) => {
            setEditingCodeReferenceId(reference.id);
            setEditingCodeReferenceComment(reference.comment ?? "");
          }}
          onSaveEdit={(referenceId, comment) => {
            updateCodeReference(activeSessionId, referenceId, {
              comment: comment.trim() || undefined,
            });
            setEditingCodeReferenceId(null);
            setEditingCodeReferenceComment("");
          }}
          onCancelEdit={() => {
            setEditingCodeReferenceId(null);
            setEditingCodeReferenceComment("");
          }}
          onRemove={(referenceId) => removeCodeReference(activeSessionId, referenceId)}
          onClear={() => clearCodeReferences(activeSessionId)}
        />

        <BrowserAnnotationChips
          annotations={browserAnnotations}
          onRemove={removeBrowserAnnotationDraft}
          onClear={clearBrowserAnnotationDrafts}
        />

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
          <PromptComposerTerminalStrip workspaceCwd={selectedWorkspaceCwd} />
          <div
            ref={promptRef}
            role="textbox"
            aria-multiline="true"
            aria-label="输入提示"
            aria-disabled={disabled}
            contentEditable={disabled ? false : "plaintext-only"}
            suppressContentEditableWarning
            tabIndex={disabled ? -1 : 0}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="prompt-composer-editor relative z-10 min-h-[86px] w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words bg-transparent px-1 pb-2 pt-0 text-[17px] leading-7 text-ink-800 caret-ink-800 focus:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            style={{ maxHeight: MAX_HEIGHT }}
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
        </div>
        <div className="prompt-composer-footer mt-2 flex min-h-10 items-center justify-between gap-3 overflow-visible">
          <div className="prompt-composer-runtime-controls flex min-w-max items-center gap-2 text-[#73777f]">
            <ComposerModelMenu
              modelValue={selectedRuntimeModel}
              modelOptions={modelSelectOptions}
              reasoningValue={reasoningMode}
              disabled={disabled || availableModels.length === 0}
              onModelChange={handleRuntimeModelChange}
              onReasoningChange={setReasoningMode}
              placeholder={availableModels.length === 0 ? "请先配置模型" : "选择模型"}
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

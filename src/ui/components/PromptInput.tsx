import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientEvent, PromptAttachment } from "../types";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_ALLOWED_TOOLS = "Read,Edit,Bash";
const SEND_COOLDOWN_MS = 3_000;
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
  disabled?: boolean;
}

const MAX_TEXT_ATTACHMENT_LENGTH = 20_000;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const TEXT_FILE_PATTERN = /\.(txt|md|markdown|json|ya?ml|xml|csv|tsv|log|js|jsx|ts|tsx|py|rb|java|go|rs|sh|css|html|sql|toml|ini|env)$/i;

type QueuedMessageDraft = {
  id: string;
  prompt: string;
  attachments: PromptAttachment[];
  createdAt: number;
};

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

function isTextFile(file: File): boolean {
  return file.type.startsWith("text/") || TEXT_FILE_PATTERN.test(file.name);
}

async function fileToAttachment(file: File): Promise<PromptAttachment> {
  if (file.type.startsWith("image/")) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`暂不支持 ${file.type} 图片格式，请优先使用 PNG、JPEG、GIF 或 WebP。`);
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      id: crypto.randomUUID(),
      kind: "image",
      name: file.name || `图片-${Date.now()}.png`,
      mimeType: file.type,
      data: dataUrl,
      preview: dataUrl,
      size: file.size,
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
  const cwd = useAppStore((state) => state.cwd);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const isRunning = activeSession?.status === "running";
  const slashCommands = activeSession?.slashCommands ?? [];

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

  const sendPromptDraft = useCallback(async (
    promptValue: string,
    attachments: PromptAttachment[] = [],
    options: { clearPrompt?: boolean } = {},
  ) => {
    const { clearPrompt = true } = options;
    if (!promptValue.trim() && attachments.length === 0) return false;

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
        payload: { title, prompt: promptValue, cwd: cwd.trim() || undefined, allowedTools: DEFAULT_ALLOWED_TOOLS, attachments }
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
      sendEvent({ type: "session.continue", payload: { sessionId: activeSessionId, prompt: promptValue, attachments } });
    }
    if (clearPrompt) {
      setPrompt("");
    }
    setGlobalError(null);
    return true;
  }, [activeSession, activeSessionId, cwd, sendEvent, setGlobalError, setPendingStart, setPrompt, validatePromptDraft]);

  const handleSend = useCallback((attachments: PromptAttachment[] = []) => {
    return sendPromptDraft(prompt, attachments);
  }, [prompt, sendPromptDraft]);

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    sendEvent({ type: "session.stop", payload: { sessionId: activeSessionId } });
  }, [activeSessionId, sendEvent]);

  const handleStartFromModal = useCallback(() => {
    if (!cwd.trim()) {
      setGlobalError("开始会话前必须填写工作目录。");
      return;
    }
    void handleSend([]);
  }, [cwd, handleSend, setGlobalError]);

  return {
    prompt,
    setPrompt,
    isRunning,
    handleSend,
    handleStop,
    handleStartFromModal,
    slashCommands,
    activeSessionId,
    sendPromptDraft,
    validatePromptDraft,
  };
}

export function PromptInput({ sendEvent, onSendMessage, disabled = false }: PromptInputProps) {
  const { prompt, setPrompt, isRunning, handleSend, handleStop, slashCommands, activeSessionId, sendPromptDraft, validatePromptDraft } = usePromptActions(sendEvent);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [queuedMessagesBySession, setQueuedMessagesBySession] = useState<Record<string, QueuedMessageDraft[]>>({});
  const [sendLockedUntil, setSendLockedUntil] = useState<number | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [showSlashBrowser, setShowSlashBrowser] = useState(false);
  const autoDispatchRef = useRef<string | null>(null);
  const setGlobalError = useAppStore((state) => state.setGlobalError);
  const slashQuery = prompt.startsWith("/") ? prompt.trim().slice(1).split(/\s+/)[0] ?? "" : "";
  const activeQueue = useMemo(() => {
    if (!activeSessionId) return [];
    return queuedMessagesBySession[activeSessionId] ?? [];
  }, [activeSessionId, queuedMessagesBySession]);
  const isCooldownLocked = cooldownRemainingMs > 0;
  const hasDraft = prompt.trim().length > 0 || attachments.length > 0;
  const filteredSlashCommands = useMemo(() => {
    if (!slashQuery) {
      return slashCommands.slice(0, 8);
    }
    return slashCommands
      .filter((command) => command.replace(/^\//, "").includes(slashQuery))
      .slice(0, 8);
  }, [slashCommands, slashQuery]);
  const showSlashPalette = (prompt.startsWith("/") || showSlashBrowser) && filteredSlashCommands.length > 0 && !disabled;

  const startSendCooldown = useCallback(() => {
    const nextLockedUntil = Date.now() + SEND_COOLDOWN_MS;
    setSendLockedUntil(nextLockedUntil);
    setCooldownRemainingMs(SEND_COOLDOWN_MS);
  }, []);

  const clearComposer = useCallback(() => {
    setPrompt("");
    setAttachments([]);
    setShowSlashBrowser(false);
  }, [setPrompt]);

  const removeQueuedDraft = useCallback((queueId: string) => {
    if (!activeSessionId) return;
    setQueuedMessagesBySession((current) => {
      const nextQueue = (current[activeSessionId] ?? []).filter((item) => item.id !== queueId);
      if (nextQueue.length === 0) {
        const { [activeSessionId]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [activeSessionId]: nextQueue,
      };
    });
  }, [activeSessionId]);

  const queueCurrentDraft = useCallback(() => {
    if (!activeSessionId) return false;
    if (!hasDraft) return false;

    const validationError = validatePromptDraft(prompt);
    if (validationError) {
      setGlobalError(validationError);
      return false;
    }

    const nextQueuedMessage: QueuedMessageDraft = {
      id: crypto.randomUUID(),
      prompt,
      attachments,
      createdAt: Date.now(),
    };

    setQueuedMessagesBySession((current) => ({
      ...current,
      [activeSessionId]: [...(current[activeSessionId] ?? []), nextQueuedMessage],
    }));
    clearComposer();
    setGlobalError(null);
    startSendCooldown();
    return true;
  }, [activeSessionId, attachments, clearComposer, hasDraft, prompt, setGlobalError, startSendCooldown, validatePromptDraft]);

  const submitCurrentInput = useCallback(async () => {
    if (!hasDraft) return false;

    if (isCooldownLocked) {
      return false;
    }

    if (isRunning) {
      return queueCurrentDraft();
    }

    const sent = await handleSend(attachments);
    if (sent) {
      clearComposer();
      startSendCooldown();
      onSendMessage?.();
    }
    return sent;
  }, [attachments, clearComposer, handleSend, hasDraft, isCooldownLocked, isRunning, onSendMessage, queueCurrentDraft, startSendCooldown]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled || isCooldownLocked) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    void submitCurrentInput();
  };

  const handleButtonClick = () => {
    if (disabled) return;
    if (isCooldownLocked) {
      if (!isRunning || hasDraft) return;
    }
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
    if (!sendLockedUntil) {
      setCooldownRemainingMs(0);
      return;
    }

    const updateCountdown = () => {
      const nextRemaining = Math.max(0, sendLockedUntil - Date.now());
      setCooldownRemainingMs(nextRemaining);
      if (nextRemaining === 0) {
        setSendLockedUntil(null);
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 120);
    return () => window.clearInterval(timer);
  }, [sendLockedUntil]);

  useEffect(() => {
    if (!activeSessionId || disabled || isRunning || activeQueue.length === 0) {
      autoDispatchRef.current = null;
      return;
    }

    const nextQueuedMessage = activeQueue[0];
    const dispatchKey = `${activeSessionId}:${nextQueuedMessage.id}`;
    if (autoDispatchRef.current === dispatchKey) {
      return;
    }

    autoDispatchRef.current = dispatchKey;

    void (async () => {
      const sent = await sendPromptDraft(nextQueuedMessage.prompt, nextQueuedMessage.attachments, { clearPrompt: false });
      if (sent) {
        setQueuedMessagesBySession((current) => {
          const remainingQueue = (current[activeSessionId] ?? []).filter((item) => item.id !== nextQueuedMessage.id);
          if (remainingQueue.length === 0) {
            const { [activeSessionId]: _removed, ...rest } = current;
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

  return (
    <section className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 pt-8 lg:ml-[320px] lg:pb-8 xl:mr-[320px]">
      {showSlashPalette && (
        <div className="mx-auto mb-3 w-full max-w-full lg:max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-card">
            <div className="border-b border-ink-900/5 px-4 py-2 text-xs font-medium text-muted">
              可用 Slash 命令
            </div>
            <div className="grid gap-1 p-2">
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
      <div className="mx-auto w-full max-w-full rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card lg:max-w-3xl">
        {activeQueue.length > 0 && (
          <div className="mb-3 rounded-2xl border border-ink-900/10 bg-surface-secondary/80 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-ink-700">待发送队列 · {activeQueue.length} 条</div>
              <div className="text-[11px] text-muted">当前轮结束后会自动续发</div>
            </div>
            <div className="grid gap-2">
              {activeQueue.map((queuedMessage, index) => {
                const label = queuedMessage.prompt.trim()
                  || (queuedMessage.attachments.length === 1
                    ? `附件：${queuedMessage.attachments[0].name}`
                    : `${queuedMessage.attachments.length} 个附件`);
                return (
                  <div key={queuedMessage.id} className="flex items-center gap-2 rounded-2xl border border-ink-900/8 bg-white/80 px-3 py-2 text-xs text-ink-700">
                    <span className="shrink-0 rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] text-accent">
                      {index === 0 ? "下一条" : `排队 ${index + 1}`}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted transition-colors hover:bg-ink-900/10 hover:text-ink-700"
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
              <div key={attachment.id} className="flex max-w-full items-center gap-2 rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-2 text-xs text-ink-700">
                <span className="shrink-0 rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] text-accent">
                  {attachment.kind === "image" ? "图片" : "文本"}
                </span>
                <span className="truncate max-w-[180px]">{attachment.name}</span>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted hover:bg-ink-900/10 hover:text-ink-700"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  aria-label={`移除附件 ${attachment.name}`}
                  disabled={isCooldownLocked}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3">
          {slashCommands.length > 0 && (
            <button
              type="button"
              className={`flex h-9 shrink-0 items-center justify-center rounded-xl border px-3 text-sm transition-colors ${showSlashBrowser ? "border-accent/40 bg-accent-subtle text-accent" : "border-ink-900/10 text-ink-700 hover:bg-surface-secondary"}`}
              onClick={() => setShowSlashBrowser((value) => !value)}
              aria-label="打开 Slash 命令列表"
              disabled={disabled || isCooldownLocked}
            >
              /
            </button>
          )}
          <button
            type="button"
            className="flex h-9 shrink-0 items-center justify-center rounded-xl border border-ink-900/10 px-3 text-sm text-ink-700 transition-colors hover:bg-surface-secondary"
            onClick={() => fileInputRef.current?.click()}
            aria-label="添加附件"
            disabled={disabled || isCooldownLocked}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21.44 11.05 12.25 20.24a6 6 0 1 1-8.49-8.49l9.2-9.19a4 4 0 1 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={
              disabled
                ? "先创建或选择一个会话..."
                : isCooldownLocked
                  ? `消息已送出，${Math.ceil(cooldownRemainingMs / 1000)} 秒后可继续输入…`
                  : attachments.length > 0
                    ? "可以继续补充文字说明，或直接发送附件…"
                    : isRunning
                      ? "当前仍在执行中，你可以继续输入，系统会自动排队续发…"
                      : "直接描述你希望 Agent 处理的事情..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={(event) => { void handlePaste(event); }}
            ref={promptRef}
            disabled={disabled || isCooldownLocked}
          />
          <button
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${!hasDraft && isRunning ? "bg-error text-white hover:bg-error/90" : "bg-accent text-white hover:bg-accent-hover"}`}
            onClick={handleButtonClick}
            aria-label={!hasDraft && isRunning ? "停止会话" : isRunning ? "加入待发送队列" : "发送提示"}
            disabled={disabled || (isCooldownLocked && hasDraft)}
          >
            {!hasDraft && isRunning ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" /></svg>
            )}
          </button>
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
      <div className="mx-auto mt-2 flex w-full max-w-full items-center justify-between px-2 text-xs text-muted lg:max-w-3xl">
        <span>Enter 发送，Shift + Enter 换行；发送后输入框会锁定 3 秒；支持粘贴图片和文本文件</span>
        {slashCommands.length > 0 ? <span>输入 / 或点击 / 按钮查看当前会话支持的命令；运行中继续发送会自动排队</span> : <span>发送后会自动显示执行链路；运行中继续发送会自动排队</span>}
      </div>
    </section>
  );
}

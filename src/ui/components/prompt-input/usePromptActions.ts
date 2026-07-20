import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClientEvent,
  PromptAttachment,
  RuntimeOverrides,
} from "../../types";
import { useAppStore } from "../../store/useAppStore";
import {
  PROMPT_FORK_RESULT_EVENT,
  type PromptForkResultDetail,
} from "../../events";
import { buildDraftTitle } from "./prompt-queue";
import {
  mergePromptWithBrowserAnnotations,
} from "./prompt-context-blocks";
import {
  getLinkedWorkspaceContextForCwd,
  mergePromptWithLinkedWorkspaceContext,
} from "./linked-workspaces";
import { areModelNamesEquivalent } from "../../../shared/models/model-provider-routing";
import {
  getEnabledProfiles,
  getAutomaticRoutedModelOptionsForProfiles,
  getModelDeploymentOptionsForProfiles,
  resolveAvailableModelName,
} from "../settings/settings-utils";

const DEFAULT_ALLOWED_TOOLS = "*";
const SESSION_TITLE_TIMEOUT_MS = 1800;
const FORK_EXECUTION_TIMEOUT_MS = 15_000;

export type SlashCommandOption = {
  name: string;
  description?: string;
  icon?: string;
};

type SlashCommandPayloadItem = string | SlashCommandOption;

type PendingForkExecution = {
  sourceSessionId: string;
  requestId: string;
  forkTitle: string;
  knownSessionIds: Set<string>;
  prompt: string;
  agentPrompt?: string;
  workspaceContext?: Extract<ClientEvent, { type: "session.continue" }>["payload"]["workspaceContext"];
  attachments: PromptAttachment[];
  runtime: RuntimeOverrides;
  timeoutId: number;
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
    const icon = typeof command === "string" ? undefined : command.icon?.trim();
    normalized.set(key, {
      name: existing?.name ?? name,
      description: existing?.description || description || undefined,
      icon: existing?.icon || icon || undefined,
    });
  }
  return Array.from(normalized.values());
}

export function usePromptActions(
  sendEvent: (event: ClientEvent) => void,
  options?: { workspaceCwd?: string },
) {
  const prompt = useAppStore((state) => state.prompt);
  const browserAnnotations = useAppStore((state) => state.browserAnnotations);
  const browserWorkbenchBySessionId = useAppStore((state) => state.browserWorkbenchBySessionId);
  const cwd = useAppStore((state) => state.cwd);
  const apiConfigSettings = useAppStore((state) => state.apiConfigSettings);
  const runtimeModel = useAppStore((state) => state.runtimeModel);
  const runtimeConfigProfileId = useAppStore((state) => state.runtimeConfigProfileId);
  const reasoningMode = useAppStore((state) => state.reasoningMode);
  const permissionMode = useAppStore((state) => state.permissionMode);
  const workflowMode = useAppStore((state) => state.workflowMode);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const activeSession = useAppStore((state) => (state.activeSessionId ? (state.sessions[state.activeSessionId] ?? state.archivedSessions[state.activeSessionId]) : undefined));
  const sessions = useAppStore((state) => state.sessions);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const clearBrowserAnnotations = useAppStore((state) => state.clearBrowserAnnotations);
  const setBrowserWorkbenchAnnotations = useAppStore((state) => state.setBrowserWorkbenchAnnotations);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);

  const isRunning = activeSession?.status === "running";
  const activeBrowserAnnotations = activeSessionId
    ? browserWorkbenchBySessionId[activeSessionId]?.annotations ?? browserAnnotations
    : browserAnnotations;
  const selectedWorkspaceCwd = options?.workspaceCwd?.trim() || "";
  const effectiveWorkspaceCwd = activeSession?.cwd?.trim() || selectedWorkspaceCwd || cwd.trim();
  const slashCommandCwd = effectiveWorkspaceCwd;
  const [workspaceSlashCommands, setWorkspaceSlashCommands] = useState<SlashCommandOption[]>([]);
  const pendingForkExecutionRef = useRef<PendingForkExecution | null>(null);

  const finishPendingForkExecution = useCallback((detail: PromptForkResultDetail) => {
    const pending = pendingForkExecutionRef.current;
    if (!pending || pending.requestId !== detail.requestId) return;
    window.clearTimeout(pending.timeoutId);
    pendingForkExecutionRef.current = null;
    window.dispatchEvent(new CustomEvent<PromptForkResultDetail>(PROMPT_FORK_RESULT_EVENT, {
      detail,
    }));
  }, []);

  useEffect(() => () => {
    const pending = pendingForkExecutionRef.current;
    if (pending) {
      window.clearTimeout(pending.timeoutId);
      pendingForkExecutionRef.current = null;
    }
  }, []);

  useEffect(() => {
    const pending = pendingForkExecutionRef.current;
    if (!pending || !activeSessionId || !activeSession) return;
    if (activeSessionId === pending.sourceSessionId || pending.knownSessionIds.has(activeSessionId)) return;
    if (activeSession.title !== pending.forkTitle || activeSession.status !== "idle" || !activeSession.hydrated) return;

    try {
      sendEvent({
        type: "session.continue",
        payload: {
          sessionId: activeSessionId,
          prompt: pending.prompt,
          agentPrompt: pending.agentPrompt,
          workspaceContext: pending.workspaceContext,
          attachments: pending.attachments,
          runtime: pending.runtime,
        },
      });
      finishPendingForkExecution({
        sourceSessionId: pending.sourceSessionId,
        requestId: pending.requestId,
        forkedSessionId: activeSessionId,
        success: true,
      });
    } catch (error) {
      finishPendingForkExecution({
        sourceSessionId: pending.sourceSessionId,
        requestId: pending.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [activeSession, activeSessionId, finishPendingForkExecution, sendEvent]);

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
    const runtimeCommandNames = activeSession?.slashCommands;
    const runtimeNameKeys = runtimeCommandNames
      ? new Set(runtimeCommandNames.map((name) => name.replace(/^\//, "").trim().toLowerCase()))
      : null;
    const workspaceDescriptions = runtimeNameKeys
      ? workspaceSlashCommands.filter((command) => runtimeNameKeys.has(command.name.toLowerCase()))
      : workspaceSlashCommands;

    return normalizeSlashCommandList([
      ...workspaceDescriptions,
      ...(activeSession?.slashCommandDetails ?? []),
      ...(runtimeCommandNames ?? []),
    ]);
  }, [activeSession?.slashCommandDetails, activeSession?.slashCommands, workspaceSlashCommands]);
  const enabledProfiles = useMemo(() => getEnabledProfiles(apiConfigSettings.profiles), [apiConfigSettings.profiles]);
  const activeProfile = enabledProfiles[0];
  const routedModelOptions = useMemo(() => getModelDeploymentOptionsForProfiles(enabledProfiles), [enabledProfiles]);
  const sharedRoutedModelOptions = useMemo(() => getAutomaticRoutedModelOptionsForProfiles(enabledProfiles), [enabledProfiles]);
  const availableModels = useMemo(() => routedModelOptions.map((option) => option.value), [routedModelOptions]);
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

  // 未知的斜杠开头内容也可能是绝对路径，这里只做发送链路校验，不拦截文本。
  const validatePromptDraft = useCallback((promptValue: string) => {
    void promptValue;
    return null;
  }, []);

  const buildRuntimeOverrides = useCallback((): RuntimeOverrides | null => {
    const sessionRuntimeModel = resolveSessionRuntimeModel();
    const explicitConfigProfileId = activeSession?.configProfileId?.trim() || runtimeConfigProfileId.trim();
    const routedRuntimeModel = explicitConfigProfileId
      ? undefined
      : sharedRoutedModelOptions.find((option) => areModelNamesEquivalent(option.value, sessionRuntimeModel || runtimeModel.trim()))?.value;
    const selectedModel = resolveAvailableModelName(
      routedRuntimeModel
        || (explicitConfigProfileId ? sessionRuntimeModel || runtimeModel.trim() : undefined)
        || sharedRoutedModelOptions[0]?.value
        || activeProfile?.model?.trim(),
      availableModels,
    );
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
      configProfileId: explicitConfigProfileId || undefined,
      reasoningMode,
      permissionMode,
      workflowMode,
    };
  }, [activeProfile, activeSession?.configProfileId, availableModels, permissionMode, reasoningMode, resolveSessionRuntimeModel, runtimeConfigProfileId, runtimeModel, setGlobalError, sharedRoutedModelOptions, workflowMode]);

  const sendPromptDraft = useCallback(async (
    promptValue: string,
    attachments: PromptAttachment[] = [],
    options: { clearPrompt?: boolean; displayUserPrompt?: boolean; replaceHistoryId?: string; agentPrompt?: string } = {},
  ) => {
    const { clearPrompt = true, displayUserPrompt = true, replaceHistoryId, agentPrompt } = options;
    const promptForAgentInput = agentPrompt ?? promptValue;
    if (!promptValue.trim() && !promptForAgentInput.trim() && attachments.length === 0) return false;
    const linkedWorkspaceContext = getLinkedWorkspaceContextForCwd(effectiveWorkspaceCwd);
    const promptForAgent = linkedWorkspaceContext
      ? mergePromptWithLinkedWorkspaceContext(promptForAgentInput, linkedWorkspaceContext)
      : promptForAgentInput;
    const runtime = buildRuntimeOverrides();
    if (!runtime) return false;

    if (!activeSessionId) {
      let title = "";
      setPendingStart(true);
      const titleSeed = buildDraftTitle(promptValue, attachments);
      title = promptValue.trim() ? await generateSessionTitleOrFallback(titleSeed) : titleSeed;
      sendEvent({
        type: "session.start",
        payload: {
          title,
          prompt: promptValue,
          agentPrompt: promptForAgent === promptValue ? undefined : promptForAgent,
          workspaceContext: linkedWorkspaceContext ?? undefined,
          cwd: effectiveWorkspaceCwd || undefined,
          allowedTools: DEFAULT_ALLOWED_TOOLS,
          attachments,
          runtime,
        },
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
          agentPrompt: promptForAgent === promptValue ? undefined : promptForAgent,
          workspaceContext: linkedWorkspaceContext ?? undefined,
          attachments,
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
  }, [activeSession, activeSessionId, buildRuntimeOverrides, effectiveWorkspaceCwd, sendEvent, setGlobalError, setPendingStart, setPrompt, validatePromptDraft]);

  const forkPromptDraft = useCallback(async (
    upToMessageId: string,
    requestId: string,
    promptValue: string,
    attachments: PromptAttachment[] = [],
    options: { agentPrompt?: string } = {},
  ) => {
    const sourceSessionId = activeSessionId?.trim();
    const forkPointMessageId = upToMessageId.trim();
    if (!sourceSessionId || !forkPointMessageId || !requestId.trim()) return false;
    if (pendingForkExecutionRef.current) {
      setGlobalError("已有一条消息正在 Fork 执行，请稍候。");
      return false;
    }

    const promptForAgentInput = options.agentPrompt ?? promptValue;
    if (!promptValue.trim() && !promptForAgentInput.trim() && attachments.length === 0) return false;
    const validationError = validatePromptDraft(promptValue);
    if (validationError) {
      setGlobalError(validationError);
      return false;
    }

    const linkedWorkspaceContext = getLinkedWorkspaceContextForCwd(effectiveWorkspaceCwd);
    const promptForAgent = linkedWorkspaceContext
      ? mergePromptWithLinkedWorkspaceContext(promptForAgentInput, linkedWorkspaceContext)
      : promptForAgentInput;
    const runtime = buildRuntimeOverrides();
    if (!runtime) return false;

    const forkTitle = `${activeSession?.title?.trim() || "新聊天"}（分支）`;
    const normalizedRequestId = requestId.trim();
    const timeoutId = window.setTimeout(() => {
      const pending = pendingForkExecutionRef.current;
      if (!pending || pending.requestId !== normalizedRequestId) return;
      finishPendingForkExecution({
        sourceSessionId,
        requestId: normalizedRequestId,
        success: false,
        error: "Fork 创建超时，请重试。消息仍保留在待发送队列中。",
      });
    }, FORK_EXECUTION_TIMEOUT_MS);

    pendingForkExecutionRef.current = {
      sourceSessionId,
      requestId: normalizedRequestId,
      forkTitle,
      knownSessionIds: new Set(Object.keys(sessions)),
      prompt: promptValue,
      agentPrompt: promptForAgent === promptValue ? undefined : promptForAgent,
      workspaceContext: linkedWorkspaceContext ?? undefined,
      attachments,
      runtime,
      timeoutId,
    };

    try {
      sendEvent({
        type: "session.fork",
        payload: {
          sessionId: sourceSessionId,
          upToMessageId: forkPointMessageId,
          title: forkTitle,
        },
      });
    } catch (error) {
      finishPendingForkExecution({
        sourceSessionId,
        requestId: normalizedRequestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    setGlobalError(null);
    return true;
  }, [activeSession?.title, activeSessionId, buildRuntimeOverrides, effectiveWorkspaceCwd, finishPendingForkExecution, sendEvent, sessions, setGlobalError, validatePromptDraft]);

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
      sendEvent({ type: "session.list", payload: { limit: 80 } });
      sendEvent({ type: "session.history", payload: { sessionId: activeSessionId } });
    }, 250);
  }, [activeSessionId, sendEvent]);

  const handleStartFromModal = useCallback(() => {
    if (!effectiveWorkspaceCwd) {
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
        cwd: effectiveWorkspaceCwd,
        allowedTools: DEFAULT_ALLOWED_TOOLS,
      },
    });
    setGlobalError(null);
  }, [effectiveWorkspaceCwd, prompt, sendEvent, sendPromptDraft, setGlobalError, setPendingStart]);

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
    forkPromptDraft,
    validatePromptDraft,
  };
}

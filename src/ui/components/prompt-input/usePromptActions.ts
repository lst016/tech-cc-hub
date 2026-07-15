import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ClientEvent,
  PromptAttachment,
  RuntimeOverrides,
} from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { buildDraftTitle } from "./prompt-queue";
import {
  mergePromptWithBrowserAnnotations,
} from "./prompt-context-blocks";
import {
  getLinkedWorkspaceContextForCwd,
  mergePromptWithLinkedWorkspaceContext,
} from "./linked-workspaces";
import {
  getEnabledProfiles,
  getModelDeploymentOptionsForProfiles,
  resolveAvailableModelName,
} from "../settings/settings-utils";

const DEFAULT_ALLOWED_TOOLS = "*";
const SESSION_TITLE_TIMEOUT_MS = 1800;

export type SlashCommandOption = {
  name: string;
  description?: string;
};

type SlashCommandPayloadItem = string | SlashCommandOption;

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
  const routedModelOptions = useMemo(() => getModelDeploymentOptionsForProfiles(enabledProfiles), [enabledProfiles]);
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
    const selectedModel = resolveAvailableModelName(
      sessionRuntimeModel || runtimeModel.trim() || routedModelOptions[0]?.value || activeProfile?.model?.trim(),
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
      configProfileId: activeSession?.configProfileId?.trim() || runtimeConfigProfileId.trim() || undefined,
      reasoningMode,
      permissionMode: permissionMode === "plan" ? "bypassPermissions" : permissionMode,
      workflowMode,
    };
  }, [activeProfile, activeSession?.configProfileId, availableModels, permissionMode, reasoningMode, resolveSessionRuntimeModel, routedModelOptions, runtimeConfigProfileId, runtimeModel, setGlobalError, workflowMode]);

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
    validatePromptDraft,
  };
}

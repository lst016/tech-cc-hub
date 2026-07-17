import { useCallback, useMemo } from "react";

import { useAppStore } from "../../store/useAppStore.js";
import { useBtwStore } from "../../store/useBtwStore.js";
import type { ClientEvent, PromptAttachment, RuntimeReasoningMode } from "../../types.js";
import type { PromptInputController } from "./PromptInput.js";

const EMPTY_SLASH_COMMANDS: string[] = [];

export function useBtwPromptController(
  threadId: string | null,
  sendEvent: (event: ClientEvent) => void,
): PromptInputController | null {
  const thread = useBtwStore((state) => threadId ? state.threads[threadId] : undefined);
  const setDraft = useBtwStore((state) => state.setDraft);
  const setAttachments = useBtwStore((state) => state.setAttachments);
  const setModel = useBtwStore((state) => state.setModel);
  const setReasoningMode = useBtwStore((state) => state.setReasoningMode);
  const setThreadError = useBtwStore((state) => state.setThreadError);
  const fallbackModel = useAppStore((state) => state.runtimeModel);
  const fallbackConfigProfileId = useAppStore((state) => state.runtimeConfigProfileId);
  const fallbackReasoningMode = useAppStore((state) => state.reasoningMode);
  const parentSlashCommands = useAppStore((state) => {
    if (!thread) return EMPTY_SLASH_COMMANDS;
    return (state.sessions[thread.parentSessionId] ?? state.archivedSessions[thread.parentSessionId])?.slashCommands ?? EMPTY_SLASH_COMMANDS;
  });

  const updatePrompt = useCallback((value: string) => {
    if (threadId) setDraft(threadId, value);
  }, [setDraft, threadId]);
  const updateAttachments = useCallback((value: PromptAttachment[]) => {
    if (threadId) setAttachments(threadId, value);
  }, [setAttachments, threadId]);
  const updateModel = useCallback((value: string, configProfileId?: string) => {
    if (threadId) setModel(threadId, value, configProfileId);
  }, [setModel, threadId]);
  const updateReasoningMode = useCallback((value: RuntimeReasoningMode) => {
    if (threadId) setReasoningMode(threadId, value);
  }, [setReasoningMode, threadId]);
  const updateError = useCallback((value: string | null) => {
    if (threadId) setThreadError(threadId, value);
  }, [setThreadError, threadId]);

  return useMemo(() => {
    if (!thread) return null;
    return {
      scope: "btw",
      activeSessionId: thread.id,
      prompt: thread.draft,
      setPrompt: updatePrompt,
      attachments: thread.attachments,
      setAttachments: updateAttachments,
      cwd: thread.cwd ?? "",
      model: thread.model?.trim() || fallbackModel.trim(),
      configProfileId: thread.configProfileId?.trim() || fallbackConfigProfileId.trim() || undefined,
      reasoningMode: thread.reasoningMode ?? fallbackReasoningMode,
      isRunning: thread.status === "running",
      browserAnnotations: [],
      slashCommands: parentSlashCommands.map((command) => ({ name: command.replace(/^\//, "") })),
      handleStop: () => sendEvent({ type: "btw.thread.stop", payload: { threadId: thread.id } }),
      setModel: updateModel,
      setReasoningMode: updateReasoningMode,
      setError: updateError,
      validatePromptDraft: () => null,
      sendPromptDraft: async (prompt: string, attachments: PromptAttachment[] = []) => {
        if ((!prompt.trim() && attachments.length === 0) || thread.status === "running") return false;
        sendEvent({
          type: "btw.thread.send",
          payload: {
            threadId: thread.id,
            prompt,
            attachments,
            runtime: {
              model: thread.model?.trim() || fallbackModel.trim() || undefined,
              configProfileId: thread.configProfileId?.trim() || fallbackConfigProfileId.trim() || undefined,
              reasoningMode: thread.reasoningMode ?? fallbackReasoningMode,
              permissionMode: thread.permissionMode,
            },
          },
        });
        updateError(null);
        return true;
      },
    } satisfies PromptInputController;
  }, [fallbackConfigProfileId, fallbackModel, fallbackReasoningMode, parentSlashCommands, sendEvent, thread, updateAttachments, updateError, updateModel, updatePrompt, updateReasoningMode]);
}

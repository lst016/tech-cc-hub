export const RUNNER_NON_FAILURE_TERMINAL_REASONS = new Set([
  "completed",
  "background_requested",
  "tool_deferred",
]);

export function getRunnerTerminalReason(
  message: { terminal_reason?: unknown },
): string | undefined {
  return typeof message.terminal_reason === "string" && message.terminal_reason.trim()
    ? message.terminal_reason.trim()
    : undefined;
}

export function isSuccessfulRunnerResult(
  message: { type?: unknown; subtype?: unknown; terminal_reason?: unknown },
): boolean {
  if (message.type !== "result" || message.subtype !== "success") return false;
  const terminalReason = getRunnerTerminalReason(message);
  return terminalReason === undefined || RUNNER_NON_FAILURE_TERMINAL_REASONS.has(terminalReason);
}

type RunnerMessageOriginLike = {
  kind?: unknown;
  server?: unknown;
  from?: unknown;
  senderTaskId?: unknown;
  subkind?: unknown;
};

function readRunnerMessageOrigin(value: unknown): RunnerMessageOriginLike | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as RunnerMessageOriginLike
    : undefined;
}

export function isRunnerResultForPromptOrigin(
  message: { origin?: unknown },
  promptOrigin: RunnerMessageOriginLike,
): boolean {
  const resultOrigin = readRunnerMessageOrigin(message.origin);
  const resultKind = typeof resultOrigin?.kind === "string" ? resultOrigin.kind : undefined;
  const promptKind = typeof promptOrigin.kind === "string" ? promptOrigin.kind : undefined;
  if (!resultKind || !promptKind) return true;
  if (resultKind !== promptKind) return false;

  if (promptKind === "channel" && typeof promptOrigin.server === "string") {
    return resultOrigin?.server === promptOrigin.server;
  }
  if (promptKind === "peer" && typeof promptOrigin.from === "string") {
    return resultOrigin?.from === promptOrigin.from;
  }
  if (promptKind === "observer") {
    return resultOrigin?.from === promptOrigin.from
      && resultOrigin?.senderTaskId === promptOrigin.senderTaskId;
  }

  // task-notification subkind is intentionally not compared. SDK background
  // completions may omit it even when the scheduled prompt included it.
  return true;
}

export function getRunnerTerminalReasonLabel(reason: string | undefined): string | undefined {
  if (!reason || reason === "completed") return undefined;
  const labels: Record<string, string> = {
    background_requested: "已转入后台",
    tool_deferred: "工具已延后",
    blocking_limit: "触发阻断限制",
    rapid_refill_breaker: "触发速率保护",
    prompt_too_long: "提示词过长",
    image_error: "图像处理失败",
    model_error: "模型调用失败",
    api_error: "API 调用失败",
    malformed_tool_use_exhausted: "工具参数重试耗尽",
    aborted_streaming: "流式响应已中断",
    aborted_tools: "工具执行已中断",
    stop_hook_prevented: "停止钩子阻止完成",
    hook_stopped: "钩子终止了执行",
    max_turns: "达到最大轮次",
    budget_exhausted: "预算已用尽",
    structured_output_retry_exhausted: "结构化输出重试耗尽",
    tool_deferred_unavailable: "延后工具不可用",
    turn_setup_failed: "执行轮次初始化失败",
  };
  return labels[reason] ?? reason;
}

export function isEmptySuccessfulRunnerResult(
  message: { type?: unknown; subtype?: unknown; result?: unknown; terminal_reason?: unknown },
  hasAssistantTextActivity: boolean,
): boolean {
  return isSuccessfulRunnerResult(message) &&
    !hasAssistantTextActivity &&
    typeof message.result === "string" &&
    message.result.trim().length === 0;
}

export function shouldBypassProviderResumeAfterEmptySuccess(
  messages: ReadonlyArray<{
    type?: unknown;
    subtype?: unknown;
    result?: unknown;
    is_error?: unknown;
    terminal_reason?: unknown;
  }>,
): boolean {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type !== "result") continue;
    return message.is_error !== true && isEmptySuccessfulRunnerResult(message, false);
  }
  return false;
}

export function shouldAutoContinueUnfinishedPlan(
  message: { type?: unknown; subtype?: unknown; result?: unknown; terminal_reason?: unknown },
  options: {
    backgroundActive: boolean;
    hasAssistantTextActivity: boolean;
    hasUnfinishedPlan: boolean;
    retryCount: number;
    maxRetries: number;
  },
): boolean {
  return !options.backgroundActive
    && options.hasUnfinishedPlan
    && options.retryCount < options.maxRetries
    && isSuccessfulRunnerResult(message)
    && !isEmptySuccessfulRunnerResult(message, options.hasAssistantTextActivity);
}

export function shouldSuppressRunnerErrorAfterSuccessfulResult(hasEmittedSuccessfulResult: boolean): boolean {
  return hasEmittedSuccessfulResult;
}

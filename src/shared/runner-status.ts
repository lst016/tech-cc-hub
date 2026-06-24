export function isSuccessfulRunnerResult(message: { type?: unknown; subtype?: unknown }): boolean {
  return message.type === "result" && message.subtype === "success";
}

export function isEmptySuccessfulRunnerResult(
  message: { type?: unknown; subtype?: unknown; result?: unknown },
  hasAssistantTextActivity: boolean,
): boolean {
  return isSuccessfulRunnerResult(message) &&
    !hasAssistantTextActivity &&
    typeof message.result === "string" &&
    message.result.trim().length === 0;
}

export function shouldSuppressRunnerErrorAfterSuccessfulResult(hasEmittedSuccessfulResult: boolean): boolean {
  return hasEmittedSuccessfulResult;
}

export type ContinuationPromptPolicyInput = {
  resumeSessionId?: string;
  useStatelessContinuation: boolean;
};

export type ContinuationPromptPolicy = {
  mode: "thin-provider-resume" | "contextual-continuation";
  injectProjectRuntime: boolean;
  injectDevLoopPrompt: boolean;
  includeHistoryInPromptLedger: boolean;
};

export function resolveContinuationPromptPolicy(
  input: ContinuationPromptPolicyInput,
): ContinuationPromptPolicy {
  const shouldResumeProviderSession = Boolean(input.resumeSessionId && !input.useStatelessContinuation);

  if (shouldResumeProviderSession) {
    return {
      mode: "thin-provider-resume",
      injectProjectRuntime: false,
      injectDevLoopPrompt: false,
      includeHistoryInPromptLedger: false,
    };
  }

  return {
    mode: "contextual-continuation",
    injectProjectRuntime: true,
    injectDevLoopPrompt: true,
    includeHistoryInPromptLedger: true,
  };
}

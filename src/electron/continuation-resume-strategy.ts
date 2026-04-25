import type { SessionStatus } from "./types.js";

export type ContinuationResumeStrategyInput = {
  apiSupportsRemoteResume: boolean;
  sessionStatus: SessionStatus;
  claudeSessionId?: string;
};

export type ContinuationResumeStrategy = {
  resumeSessionId?: string;
  useStatelessContinuation: boolean;
};

export function resolveContinuationResumeStrategy(
  input: ContinuationResumeStrategyInput,
): ContinuationResumeStrategy {
  const hasProviderSession = Boolean(input.claudeSessionId);
  const shouldResumeProviderSession =
    hasProviderSession && (input.apiSupportsRemoteResume || input.sessionStatus === "paused");

  return {
    resumeSessionId: shouldResumeProviderSession ? input.claudeSessionId : undefined,
    useStatelessContinuation: !shouldResumeProviderSession,
  };
}

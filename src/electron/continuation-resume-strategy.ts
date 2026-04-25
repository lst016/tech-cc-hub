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

  return {
    resumeSessionId: hasProviderSession ? input.claudeSessionId : undefined,
    useStatelessContinuation: !hasProviderSession,
  };
}

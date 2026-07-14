export const MAX_RETAINED_BROWSER_WORKBENCHES = 2;

export type BrowserWorkbenchRetentionCandidate = {
  sessionId: string;
  hasLiveView: boolean;
};

export function selectBrowserWorkbenchEvictionIds(
  candidates: BrowserWorkbenchRetentionCandidate[],
  activeSessionId: string,
  maxRetained = MAX_RETAINED_BROWSER_WORKBENCHES,
): string[] {
  const liveCandidates = candidates.filter((candidate) => candidate.hasLiveView);
  let excess = Math.max(0, liveCandidates.length - Math.max(1, maxRetained));
  if (excess === 0) return [];

  const evictions: string[] = [];
  for (const candidate of liveCandidates) {
    if (excess === 0) break;
    if (candidate.sessionId === activeSessionId) continue;
    evictions.push(candidate.sessionId);
    excess -= 1;
  }
  return evictions;
}

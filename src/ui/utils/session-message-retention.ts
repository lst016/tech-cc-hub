export const MAX_RETAINED_HYDRATED_SESSIONS = 6;

export type RetainableSessionMessages = {
  status: string;
  hydrated: boolean;
  messages: unknown[];
};

export function touchRecentSessionId(recentSessionIds: string[], sessionId: string | null): string[] {
  if (!sessionId) return recentSessionIds;
  return [...recentSessionIds.filter((id) => id !== sessionId), sessionId];
}

export function selectSessionMessageEvictionIds(
  sessions: Record<string, RetainableSessionMessages>,
  recentSessionIds: string[],
  activeSessionId: string | null,
  maxRetained = MAX_RETAINED_HYDRATED_SESSIONS,
): string[] {
  const protectedIds = new Set(
    Object.entries(sessions)
      .filter(([, session]) => session.status === "running")
      .map(([sessionId]) => sessionId),
  );
  if (activeSessionId) protectedIds.add(activeSessionId);

  const retainedRecentIds = recentSessionIds.slice(-Math.max(1, maxRetained));
  for (const sessionId of retainedRecentIds) protectedIds.add(sessionId);

  return Object.entries(sessions)
    .filter(([sessionId, session]) => (
      !protectedIds.has(sessionId) && session.hydrated && session.messages.length > 0
    ))
    .map(([sessionId]) => sessionId);
}

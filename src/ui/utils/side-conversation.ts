import type { SessionView } from "../store/useAppStore.js";
import type { SessionStatus } from "../types.js";

export function buildSideConversationTargets(
  sessions: Record<string, SessionView>,
  primarySessionId: string,
): SessionView[] {
  return Object.values(sessions)
    .filter((session) => session.id !== primarySessionId)
    .sort((left, right) => (
      (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0)
    ));
}

export function canSendSideConversationDraft(input: {
  draft: string;
  connected: boolean;
  status?: SessionStatus;
  model?: string;
}): boolean {
  return input.connected
    && Boolean(input.draft.trim())
    && input.status !== "running"
    && Boolean(input.model?.trim());
}

export function createSideConversationRequestId(primarySessionId: string): string {
  return `sidechat:${primarySessionId}:${crypto.randomUUID()}`;
}

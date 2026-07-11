export const COLLAPSED_SESSION_RAIL_LIMIT = 10;
export const SESSION_PREVIEW_FALLBACK = "暂无回复摘要";

const PREVIEW_MARGIN = 12;
const PREVIEW_GAP = 12;
const PREVIEW_TOP_OFFSET = 10;

function normalizePreviewText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractLatestAssistantSummary(messages: readonly unknown[], partial?: string): string {
  const normalizedPartial = normalizePreviewText(partial ?? "");
  if (normalizedPartial) return normalizedPartial;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (!isRecord(entry) || entry.type !== "assistant" || !isRecord(entry.message)) continue;

    const message = entry.message;
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;

    const text = message.content
      .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === "text")
      .map((block) => typeof block.text === "string" ? block.text : "")
      .join(" ");
    const normalizedText = normalizePreviewText(text);
    if (normalizedText) return normalizedText;
  }

  return SESSION_PREVIEW_FALLBACK;
}

export function selectCollapsedRailSessions<
  T extends { id: string; title: string; updatedAt?: number; archivedAt?: number },
>(sessions: Record<string, T>, limit = COLLAPSED_SESSION_RAIL_LIMIT): T[] {
  const boundedLimit = Math.max(0, Math.floor(limit));

  return Object.values(sessions)
    .filter((session) => session.archivedAt === undefined)
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(0, boundedLimit);
}

export function clampSessionPreviewPosition(
  anchor: { right: number; top: number },
  viewport: { width: number; height: number },
  cardWidth: number,
  cardHeight: number,
): { left: number; top: number } {
  const maxLeft = Math.max(PREVIEW_MARGIN, viewport.width - cardWidth - PREVIEW_MARGIN);
  const maxTop = Math.max(PREVIEW_MARGIN, viewport.height - cardHeight - PREVIEW_MARGIN);

  return {
    left: Math.min(Math.max(anchor.right + PREVIEW_GAP, PREVIEW_MARGIN), maxLeft),
    top: Math.min(Math.max(anchor.top - PREVIEW_TOP_OFFSET, PREVIEW_MARGIN), maxTop),
  };
}

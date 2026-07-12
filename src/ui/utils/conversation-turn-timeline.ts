export type ConversationTurn = {
  index: number;
  originalIndex: number;
  summary: string;
  capturedAt?: number;
  assistantSummary?: string;
  activityLabels?: string[];
  toolCount?: number;
};

export type ConversationTurnPreviewContentState = {
  currentIndex: number | null;
  previousIndex: number | null;
  version: number;
};

export function advanceConversationTurnPreviewContent(
  state: ConversationTurnPreviewContentState,
  nextIndex: number,
  retainPrevious: boolean,
): ConversationTurnPreviewContentState {
  if (state.currentIndex === nextIndex) return state;
  return {
    currentIndex: nextIndex,
    previousIndex: retainPrevious ? state.currentIndex : null,
    version: state.version + 1,
  };
}

export type ConversationTurnSource = {
  originalIndex: number;
  message: {
    type?: unknown;
    prompt?: unknown;
    capturedAt?: unknown;
    attachments?: unknown;
    message?: unknown;
  };
};

const TURN_SUMMARY_MAX_LENGTH = 48;
const ASSISTANT_SUMMARY_MAX_LENGTH = 180;
const CONVERSATION_TURN_MARK_ROW_HEIGHT = 12;
const CONVERSATION_TURN_MARK_CENTER_OFFSET = 8;
const CONVERSATION_TURN_TIMELINE_MIN_CHAT_WIDTH = 920;

export const CONVERSATION_TURN_TIMELINE_LEFT_OFFSET = 16;

export function shouldShowConversationTurnTimeline(chatViewportWidth: number): boolean {
  return chatViewportWidth >= CONVERSATION_TURN_TIMELINE_MIN_CHAT_WIDTH;
}

export function getConversationTurnMarkWidth(
  turnIndex: number,
  activeIndex: number,
  previewIndex: number | null,
): number {
  if (previewIndex === null) return turnIndex === activeIndex ? 10 : 8;

  const distance = Math.abs(turnIndex - previewIndex);
  if (distance === 0) return 40;
  if (distance === 1) return 32;
  if (distance === 2) return 24;
  if (distance === 3) return 16;
  return 12;
}

export function getConversationTurnPreviewOffset(
  visibleTurnIndexes: readonly number[],
  previewIndex: number | null,
): number | null {
  if (previewIndex === null) return null;
  const visibleIndex = visibleTurnIndexes.indexOf(previewIndex);
  if (visibleIndex < 0) return null;
  return CONVERSATION_TURN_MARK_CENTER_OFFSET + visibleIndex * CONVERSATION_TURN_MARK_ROW_HEIGHT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function summarizePrompt(prompt: string): string {
  return summarizeText(prompt, TURN_SUMMARY_MAX_LENGTH);
}

function getBaseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function readAttachmentLabels(attachments: unknown): string[] {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter(isRecord)
    .map((attachment) => typeof attachment.name === "string" ? attachment.name.trim() : "")
    .filter(Boolean);
}

function appendActivityLabel(turn: ConversationTurn, label: string): void {
  const normalized = label.trim();
  if (!normalized) return;
  const labels = turn.activityLabels ?? [];
  if (labels.includes(normalized)) return;
  turn.activityLabels = [...labels, normalized];
}

function enrichTurnFromAssistant(turn: ConversationTurn, envelope: unknown): void {
  if (!isRecord(envelope) || !Array.isArray(envelope.content)) return;
  const text = envelope.content
    .filter(isRecord)
    .filter((content) => content.type === "text" && typeof content.text === "string")
    .map((content) => content.text as string)
    .join(" ");
  const assistantSummary = summarizeText(text, ASSISTANT_SUMMARY_MAX_LENGTH);
  if (assistantSummary) turn.assistantSummary = assistantSummary;

  for (const content of envelope.content.filter(isRecord)) {
    if (content.type !== "tool_use") continue;
    turn.toolCount = (turn.toolCount ?? 0) + 1;
    if (!isRecord(content.input)) continue;
    const path = [content.input.file_path, content.input.path]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (path) appendActivityLabel(turn, getBaseName(path));
  }
}

export function buildConversationTurns(sources: readonly ConversationTurnSource[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let currentTurn: ConversationTurn | null = null;

  for (const source of sources) {
    if (source.message.type === "user_prompt" && typeof source.message.prompt === "string") {
      const attachmentLabels = readAttachmentLabels(source.message.attachments);
      currentTurn = {
        index: turns.length,
        originalIndex: source.originalIndex,
        summary: summarizePrompt(source.message.prompt),
        capturedAt: typeof source.message.capturedAt === "number" ? source.message.capturedAt : undefined,
        ...(attachmentLabels.length > 0 ? { activityLabels: attachmentLabels } : {}),
      };
      turns.push(currentTurn);
      continue;
    }

    if (currentTurn && source.message.type === "assistant") {
      enrichTurnFromAssistant(currentTurn, source.message.message);
    }
  }

  return turns;
}

export function findActiveConversationTurnIndex(turnTops: readonly number[], viewportCenterY: number): number {
  if (turnTops.length === 0) return -1;

  let firstMountedIndex = -1;
  let activeIndex = -1;
  for (let index = 0; index < turnTops.length; index += 1) {
    const top = turnTops[index];
    if (typeof top !== "number" || !Number.isFinite(top)) continue;
    if (firstMountedIndex < 0) firstMountedIndex = index;
    if (top > viewportCenterY) break;
    activeIndex = index;
  }
  return activeIndex >= 0 ? activeIndex : firstMountedIndex;
}

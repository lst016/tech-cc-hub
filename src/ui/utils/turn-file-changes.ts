import type { StreamMessage } from "../types.js";
import { collectCompletedPreviewFileChanges } from "./preview-file-refresh.js";

export type IndexedProcessMessage = {
  originalIndex: number;
  message: StreamMessage;
};

export type TurnFileChangeSourceEntry = {
  type: string;
  key: string;
  originalIndex?: number;
  message?: StreamMessage;
  messages?: IndexedProcessMessage[];
};

export type TurnFileChangesEntry = {
  type: "turn_file_changes";
  key: string;
  originalIndex: number;
  messages: IndexedProcessMessage[];
};

function isTurnBoundary(entry: TurnFileChangeSourceEntry): boolean {
  return entry.type === "separator"
    || (entry.type === "message" && entry.message?.type === "user_prompt");
}

export function appendTurnFileChangeEntries<T extends TurnFileChangeSourceEntry>(
  entries: readonly T[],
  keyPrefix: string,
): Array<T | TurnFileChangesEntry> {
  const result: Array<T | TurnFileChangesEntry> = [];
  let turnProcessMessages: IndexedProcessMessage[] = [];

  const flushTurnFileChanges = () => {
    if (turnProcessMessages.length === 0) return;

    const messages = turnProcessMessages;
    turnProcessMessages = [];
    const changes = collectCompletedPreviewFileChanges(messages.map((entry) => entry.message));
    if (changes.length === 0) return;

    const first = messages[0]!;
    const last = messages[messages.length - 1]!;
    result.push({
      type: "turn_file_changes",
      key: `${keyPrefix}-turn-files-${first.originalIndex}-${last.originalIndex}`,
      originalIndex: last.originalIndex,
      messages,
    });
  };

  for (const entry of entries) {
    if (isTurnBoundary(entry)) {
      flushTurnFileChanges();
    }

    result.push(entry);
    if (entry.type === "process_group" && entry.messages) {
      turnProcessMessages.push(...entry.messages);
    }
  }

  flushTurnFileChanges();
  return result;
}

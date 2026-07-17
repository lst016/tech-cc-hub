import { Suspense, useMemo, useState } from "react";
import type { StreamMessage } from "../../types.js";
import { appendTurnFileChangeEntries, type TurnFileChangesEntry } from "../../utils/turn-file-changes.js";
import { MessageCard } from "../EventCard.js";
import {
  ProcessGroupCard,
  ProcessHistoryDisclosure,
  TurnFileChangesCard,
} from "./ProcessGroupCard.js";

function MarkdownLoadFallback() {
  return (
    <div className="mt-1 flex flex-col gap-2 px-1">
      <div className="h-3 w-5/12 rounded-full bg-ink-900/10" />
      <div className="h-3 w-full rounded-full bg-ink-900/10" />
      <div className="h-3 w-8/12 rounded-full bg-ink-900/10" />
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessageContentItems(message: StreamMessage): unknown[] {
  const envelope = message as { message?: unknown };
  if (!isRecord(envelope.message)) return [];
  const content = envelope.message.content;
  return Array.isArray(content) ? content : content ? [content] : [];
}

function isProcessMessage(message: StreamMessage): boolean {
  if (!isRecord(message)) return false;
  const contentItems = getMessageContentItems(message);
  if (contentItems.length === 0) return false;

  if (message.type === "assistant") {
    return contentItems.every((item) => (
      isRecord(item)
      && item.type === "tool_use"
      && item.name !== "AskUserQuestion"
    ));
  }

  if (message.type === "user") {
    return contentItems.every((item) => isRecord(item) && item.type === "tool_result");
  }

  return false;
}

type ChatTranscriptEntry =
  | { type: "message"; key: string; originalIndex: number; message: StreamMessage }
  | { type: "process_group"; key: string; originalIndex: number; messages: Array<{ originalIndex: number; message: StreamMessage }> }
  | TurnFileChangesEntry;

export function buildChatTranscriptEntries(
  messages: StreamMessage[],
  keyPrefix: string,
): ChatTranscriptEntry[] {
  const entries: Array<Exclude<ChatTranscriptEntry, TurnFileChangesEntry>> = [];
  let pendingProcessGroup: Array<{ originalIndex: number; message: StreamMessage }> = [];

  const flushProcessGroup = () => {
    if (pendingProcessGroup.length === 0) return;
    const first = pendingProcessGroup[0]!;
    const last = pendingProcessGroup[pendingProcessGroup.length - 1]!;
    entries.push({
      type: "process_group",
      key: `${keyPrefix}-process-${first.originalIndex}-${last.originalIndex}`,
      originalIndex: first.originalIndex,
      messages: pendingProcessGroup,
    });
    pendingProcessGroup = [];
  };

  messages.forEach((message, index) => {
    if (isProcessMessage(message)) {
      pendingProcessGroup.push({ originalIndex: index, message });
      return;
    }

    flushProcessGroup();
    entries.push({
      type: "message",
      key: `${keyPrefix}-msg-${index}`,
      originalIndex: index,
      message,
    });
  });

  flushProcessGroup();
  return appendTurnFileChangeEntries(entries, keyPrefix);
}

export function ChatTranscript({
  messages,
  sessionId,
  workspace,
  isRunning,
  emptyMessage,
  keyPrefix = "transcript",
}: {
  messages: StreamMessage[];
  sessionId?: string;
  workspace?: string;
  isRunning: boolean;
  emptyMessage?: StreamMessage;
  keyPrefix?: string;
}) {
  const entries = useMemo(() => buildChatTranscriptEntries(
    messages.length > 0 ? messages : emptyMessage ? [emptyMessage] : [],
    keyPrefix,
  ), [emptyMessage, keyPrefix, messages]);
  const [expandedProcessHistoryKey, setExpandedProcessHistoryKey] = useState<string | null>(null);
  const processHistoryExpanded = expandedProcessHistoryKey === keyPrefix;
  const processHistorySummary = useMemo(() => {
    let firstIndex = -1;
    let groupCount = 0;
    let eventCount = 0;

    entries.forEach((entry, index) => {
      if (entry.type !== "process_group") return;
      if (firstIndex === -1) firstIndex = index;
      groupCount += 1;
      eventCount += entry.messages.length;
    });

    return { firstIndex, groupCount, eventCount };
  }, [entries]);

  return (
    <>
      {entries.map((entry, index) => {
        if (entry.type === "turn_file_changes") {
          return (
            <div key={entry.key}>
              <TurnFileChangesCard messages={entry.messages} workspace={workspace} />
            </div>
          );
        }

        const isLastMessage = entries
          .slice(index + 1)
          .every((nextEntry) => nextEntry.type === "turn_file_changes");
        if (entry.type === "process_group") {
          return (
            <div key={entry.key} id={`${keyPrefix}-message-${entry.originalIndex}`}>
              {index === processHistorySummary.firstIndex && (
                <ProcessHistoryDisclosure
                  expanded={processHistoryExpanded}
                  groupCount={processHistorySummary.groupCount}
                  eventCount={processHistorySummary.eventCount}
                  onToggle={() => setExpandedProcessHistoryKey((current) => (
                    current === keyPrefix ? null : keyPrefix
                  ))}
                />
              )}
              <ProcessGroupCard
                messages={entry.messages}
                messageIdPrefix={keyPrefix}
                showProcessSummary={processHistoryExpanded}
              />
            </div>
          );
        }

        return (
          <div key={entry.key} id={`${keyPrefix}-message-${entry.originalIndex}`}>
            <Suspense fallback={<MarkdownLoadFallback />}>
              <MessageCard
                message={entry.message}
                sessionId={sessionId}
                isLast={isLastMessage}
                isRunning={isRunning}
              />
            </Suspense>
          </div>
        );
      })}
    </>
  );
}

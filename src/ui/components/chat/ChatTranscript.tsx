import { Suspense, useMemo } from "react";
import type { StreamMessage } from "../../types";
import { MessageCard } from "../EventCard";
import { ProcessGroupCard } from "./ProcessGroupCard";

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
      isRecord(item) &&
      item.type === "tool_use" &&
      item.name !== "AskUserQuestion"
    ));
  }

  if (message.type === "user") {
    return contentItems.every((item) => isRecord(item) && item.type === "tool_result");
  }

  return false;
}

type ChatTranscriptEntry =
  | { type: "message"; key: string; originalIndex: number; message: StreamMessage }
  | { type: "process_group"; key: string; originalIndex: number; messages: Array<{ originalIndex: number; message: StreamMessage }> };

export function buildChatTranscriptEntries(
  messages: StreamMessage[],
  keyPrefix: string,
): ChatTranscriptEntry[] {
  const entries: ChatTranscriptEntry[] = [];
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
  return entries;
}

export function ChatTranscript({
  messages,
  workspace,
  isRunning,
  emptyMessage,
  keyPrefix = "transcript",
}: {
  messages: StreamMessage[];
  workspace?: string;
  isRunning: boolean;
  emptyMessage?: StreamMessage;
  keyPrefix?: string;
}) {
  const renderMessages = messages.length > 0 ? messages : emptyMessage ? [emptyMessage] : [];
  const entries = useMemo(() => buildChatTranscriptEntries(renderMessages, keyPrefix), [keyPrefix, renderMessages]);

  return (
    <>
      {entries.map((entry, index) => {
        const isLastMessage = index === entries.length - 1;
        if (entry.type === "process_group") {
          return (
            <div key={entry.key} id={`${keyPrefix}-message-${entry.originalIndex}`}>
              <ProcessGroupCard
                messages={entry.messages}
                workspace={workspace}
                messageIdPrefix={keyPrefix}
              />
            </div>
          );
        }

        return (
          <div key={entry.key} id={`${keyPrefix}-message-${entry.originalIndex}`}>
            <Suspense fallback={<MarkdownLoadFallback />}>
              <MessageCard
                message={entry.message}
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

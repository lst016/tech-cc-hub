import { useEffect, useMemo, useRef } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { MessageCircle, Plus, X } from "lucide-react";

import { useBtwStore } from "../store/useBtwStore.js";
import type { ClientEvent } from "../types.js";
import { ChatTranscript } from "./chat/ChatTranscript.js";
import { PromptInput } from "./prompt-input/PromptInput.js";
import { useBtwPromptController } from "./prompt-input/useBtwPromptController.js";

export type SideConversationPanelProps = {
  parentSessionId: string;
  connected: boolean;
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
};

const EMPTY_THREAD_IDS: string[] = [];

export function SideConversationPanel({
  parentSessionId,
  connected,
  sendEvent,
  onSendMessage,
}: SideConversationPanelProps) {
  const threadIds = useBtwStore((state) => state.threadIdsByParent[parentSessionId] ?? EMPTY_THREAD_IDS);
  const activeThreadId = useBtwStore((state) => state.activeThreadIdByParent[parentSessionId] ?? null);
  const activeThread = useBtwStore((state) => activeThreadId ? state.threads[activeThreadId] : undefined);
  const threadsById = useBtwStore((state) => state.threads);
  const threads = useMemo(
    () => threadIds.map((threadId) => threadsById[threadId]).filter((thread) => Boolean(thread)),
    [threadIds, threadsById],
  );
  const setActiveThread = useBtwStore((state) => state.setActiveThread);
  const resolvePermissionRequest = useBtwStore((state) => state.resolvePermissionRequest);
  const clearThread = useBtwStore((state) => state.clearThread);
  const controller = useBtwPromptController(activeThreadId, sendEvent);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowOutputRef = useRef(true);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !shouldFollowOutputRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeThread?.messages.length, activeThread?.partialMessage]);

  const createThread = () => {
    if (!connected) return;
    sendEvent({ type: "btw.thread.create", payload: { parentSessionId } });
  };
  const closeThread = (threadId: string) => {
    sendEvent({ type: "btw.thread.close", payload: { threadId } });
    clearThread(threadId);
  };
  const handlePermissionResult = (toolUseId: string, result: PermissionResult) => {
    if (!activeThreadId) return;
    sendEvent({
      type: "btw.thread.permission.response",
      payload: { threadId: activeThreadId, toolUseId, result },
    });
    resolvePermissionRequest(activeThreadId, toolUseId);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="侧边对话">
      <header className="border-b border-black/6 bg-white/92 px-2 py-2">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="侧聊线程">
          <MessageCircle className="mx-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`flex min-w-0 shrink-0 items-center rounded-lg border text-xs ${thread.id === activeThreadId ? "border-accent/35 bg-[#fff4ee] text-accent" : "border-black/8 bg-white text-ink-700"}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={thread.id === activeThreadId}
                className="max-w-32 truncate px-2 py-1.5"
                onClick={() => setActiveThread(parentSessionId, thread.id)}
              >
                <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${thread.status === "running" ? "animate-pulse bg-emerald-500" : thread.status === "error" ? "bg-red-500" : "bg-ink-300"}`} />
                {thread.title}
              </button>
              <button
                type="button"
                className="mr-1 grid h-5 w-5 place-items-center rounded hover:bg-black/6"
                aria-label={`关闭 ${thread.title}`}
                onClick={() => closeThread(thread.id)}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-dashed border-black/15 text-ink-500 hover:border-accent/40 hover:bg-[#fff4ee] hover:text-accent disabled:opacity-50"
            aria-label="新建侧聊线程"
            onClick={createThread}
            disabled={!connected}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {activeThread && controller ? (
        <>
          <div
            ref={scrollRef}
            role="region"
            aria-label="侧边对话消息"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
            onScroll={(event) => {
              const element = event.currentTarget;
              shouldFollowOutputRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
            }}
          >
            {activeThread.error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{activeThread.error}</div>
            )}
            {activeThread.messages.length === 0 && !activeThread.partialMessage.trim() ? (
              <div className="grid min-h-48 place-items-center text-center text-xs leading-5 text-muted">
                <div>
                  <MessageCircle className="mx-auto mb-2 h-6 w-6 text-accent/55" aria-hidden="true" />
                  这是临时侧聊，不会写入主会话。
                </div>
              </div>
            ) : (
              <ChatTranscript
                messages={activeThread.messages}
                workspace={activeThread.cwd}
                isRunning={activeThread.status === "running"}
                keyPrefix={`sidechat-${activeThread.id}`}
              />
            )}
            {(activeThread.partialVisible || activeThread.partialMessage.trim()) && (
              <div className="mt-3 whitespace-pre-wrap rounded-xl border border-accent/15 bg-white px-3 py-2 text-sm leading-6 text-ink-800 shadow-sm">
                {activeThread.partialMessage || "正在思考…"}
              </div>
            )}
          </div>

          <PromptInput
            key={activeThread.id}
            controller={controller}
            embedded
            sendEvent={sendEvent}
            onSendMessage={onSendMessage}
            permissionRequest={activeThread.permissionRequests[0]}
            onPermissionResult={handlePermissionResult}
            disabled={!connected}
          />
        </>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-muted">
          <div>
            <p>当前没有侧聊线程</p>
            <button
              type="button"
              className="mt-3 rounded-lg border border-accent/25 bg-[#fff4ee] px-3 py-1.5 text-xs font-medium text-accent disabled:opacity-50"
              onClick={createThread}
              disabled={!connected}
            >
              新建侧聊
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

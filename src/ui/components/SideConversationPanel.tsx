import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MessageCircle, Plus, Send, Square } from "lucide-react";
import type { ClientEvent } from "../types.js";
import { useAppStore } from "../store/useAppStore.js";
import { buildSideConversationTargets, canSendSideConversationDraft } from "../utils/side-conversation.js";
import { DecisionPanel } from "./DecisionPanel.js";
import { ChatTranscript } from "./chat/ChatTranscript.js";

export type SideConversationPanelProps = {
  primarySessionId: string;
  sideSessionId: string | null;
  connected: boolean;
  partialMessage: string;
  onSelectSession: (sessionId: string | null) => void;
  onCreateSession: () => void;
  onRequestHistory: (sessionId: string) => void;
  sendEvent: (event: ClientEvent) => void;
};

export function SideConversationPanel({
  primarySessionId,
  sideSessionId,
  connected,
  partialMessage,
  onSelectSession,
  onCreateSession,
  onRequestHistory,
  sendEvent,
}: SideConversationPanelProps) {
  const sessions = useAppStore((state) => state.sessions);
  const apiConfigSettings = useAppStore((state) => state.apiConfigSettings);
  const runtimeModel = useAppStore((state) => state.runtimeModel);
  const reasoningMode = useAppStore((state) => state.reasoningMode);
  const permissionMode = useAppStore((state) => state.permissionMode);
  const workflowMode = useAppStore((state) => state.workflowMode);
  const resolvePermissionRequest = useAppStore((state) => state.resolvePermissionRequest);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowOutputRef = useRef(true);
  const targets = useMemo(
    () => buildSideConversationTargets(sessions, primarySessionId),
    [primarySessionId, sessions],
  );
  const sideSession = sideSessionId ? sessions[sideSessionId] : undefined;
  const enabledProfile = apiConfigSettings.profiles.find((profile) => profile.enabled) ?? apiConfigSettings.profiles[0];
  const model = sideSession?.model?.trim() || runtimeModel.trim() || enabledProfile?.model?.trim() || "";
  const isRunning = sideSession?.status === "running";
  const canSend = canSendSideConversationDraft({ draft, connected, status: sideSession?.status, model });
  const permissionRequest = sideSession?.permissionRequests[0];

  useEffect(() => {
    if (sideSessionId && !sideSession) onSelectSession(null);
  }, [onSelectSession, sideSession, sideSessionId]);

  useEffect(() => {
    if (sideSession && !sideSession.hydrated) onRequestHistory(sideSession.id);
  }, [onRequestHistory, sideSession]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !shouldFollowOutputRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [partialMessage, sideSession?.messages.length]);

  const handleSend = () => {
    if (!sideSessionId || !canSend) return;
    sendEvent({
      type: "session.continue",
      payload: {
        sessionId: sideSessionId,
        prompt: draft.trim(),
        runtime: {
          model,
          reasoningMode,
          permissionMode: permissionMode === "plan" ? "bypassPermissions" : permissionMode,
          workflowMode,
        },
      },
    });
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="侧边对话">
      <header className="flex items-center gap-2 border-b border-black/6 px-3 py-2.5">
        <MessageCircle className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <select
          aria-label="选择侧聊会话"
          value={sideSessionId ?? ""}
          onChange={(event) => onSelectSession(event.target.value || null)}
          className="h-8 min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 text-xs font-medium text-ink-800 outline-none focus:border-accent/40"
        >
          <option value="">选择会话</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>{target.title || "未命名会话"}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCreateSession}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold text-ink-700 transition hover:bg-black/[0.03]"
          aria-label="新建侧聊"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          新建
        </button>
      </header>

      <div
        ref={scrollRef}
        role="region"
        aria-label="侧聊消息"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldFollowOutputRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
        }}
      >
        {targets.length === 0 && !sideSession ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted">
            <div>
              <p>当前没有其他会话</p>
              <button type="button" onClick={onCreateSession} className="mt-3 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white">新建侧聊</button>
            </div>
          </div>
        ) : !sideSession ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted">请选择一个侧聊会话</div>
        ) : (
          <div className="space-y-3">
            {sideSession.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{sideSession.error}</div>
            )}
            <ChatTranscript messages={sideSession.messages} workspace={sideSession.cwd} isRunning={isRunning} keyPrefix={`sidechat-${sideSession.id}`} />
            {partialMessage.trim() && (
              <div className="whitespace-pre-wrap rounded-xl border border-accent/15 bg-white px-3 py-2 text-sm leading-6 text-ink-800 shadow-sm">{partialMessage}</div>
            )}
            {permissionRequest && sideSessionId && (
              <DecisionPanel
                request={permissionRequest}
                compact
                onSubmit={(result) => {
                  sendEvent({
                    type: "permission.response",
                    payload: { sessionId: sideSessionId, toolUseId: permissionRequest.toolUseId, result },
                  });
                  resolvePermissionRequest(sideSessionId, permissionRequest.toolUseId);
                }}
              />
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-black/6 bg-white/80 p-3">
        <textarea
          aria-label="输入侧聊消息"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!sideSession || !connected}
          placeholder={sideSession ? "输入侧聊消息，Enter 发送" : "请先选择或新建侧聊"}
          rows={3}
          className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-sm leading-6 text-ink-800 outline-none transition focus:border-accent/40 disabled:cursor-not-allowed disabled:bg-black/[0.02]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted">{!connected ? "连接已断开" : !model ? "请先配置模型" : sideSession?.title || "未选择会话"}</span>
          {isRunning && sideSessionId ? (
            <button
              type="button"
              aria-label="停止侧聊"
              onClick={() => sendEvent({ type: "session.stop", payload: { sessionId: sideSessionId } })}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />停止
            </button>
          ) : (
            <button
              type="button"
              aria-label="发送侧聊消息"
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />发送
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

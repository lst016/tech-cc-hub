import { Bot, CheckCircle2, CircleStop, Loader2, MessageSquareText, Wrench } from "lucide-react";
import { ChatTranscript } from "../chat/ChatTranscript";
import type { WorkflowAgentSummary } from "../../utils/workflow-agent-transcripts";

function statusTone(status: WorkflowAgentSummary["status"]) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed" || status === "killed") return "border-red-200 bg-red-50 text-red-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function statusLabel(status: WorkflowAgentSummary["status"]) {
  if (status === "completed") return "Done";
  if (status === "failed") return "Failed";
  if (status === "killed") return "Stopped";
  return "Running";
}

function StatusIcon({ status }: { status: WorkflowAgentSummary["status"] }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === "failed" || status === "killed") return <CircleStop className="h-4 w-4" aria-hidden="true" />;
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export function WorkflowAgentTranscriptPanel({
  agent,
  workspace,
  isRunning,
}: {
  agent?: WorkflowAgentSummary;
  workspace?: string;
  isRunning: boolean;
}) {
  if (!agent) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
        <div className="border-b border-black/6 bg-white px-5 py-3">
          <div className="text-sm font-semibold text-ink-900">Agent transcript</div>
        </div>
        <div className="chat-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 text-center">
          <div className="max-w-xs text-sm text-muted">Select an agent card in chat to inspect its transcript.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
      <div className="sticky top-0 z-10 border-b border-black/6 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900">Agent transcript</div>
            <div className="mt-0.5 truncate text-xs text-muted">{agent.title}</div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(agent.status)}`}>
            <StatusIcon status={agent.status} />
            {statusLabel(agent.status)}
          </span>
        </div>
      </div>

      <div className="chat-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto bg-white px-5 pb-8 pt-4">
        <div className="chat-stream-content mx-auto w-full max-w-[920px]">
          <div className="mb-4 rounded-[18px] border border-black/6 bg-white px-3.5 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-black/6 bg-[#f4f7fb] text-accent">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-900">{agent.title}</div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-muted">
                  <span className="max-w-full truncate rounded-full bg-ink-900/5 px-2 py-0.5 font-medium text-ink-700">{agent.role}</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                    {agent.messageCount} messages
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                    {agent.toolCount} tools
                  </span>
                </div>
              </div>
            </div>
            {agent.latestSummary && (
              <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-ink-600">{agent.latestSummary}</p>
            )}
          </div>

          <ChatTranscript
            messages={agent.transcript}
            workspace={workspace}
            isRunning={isRunning && agent.status === "running"}
            keyPrefix={`workflow-agent-${agent.id}`}
            emptyMessage={{
              type: "assistant",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "This agent has started, but no child transcript messages have arrived yet." }],
              },
            } as never}
          />
        </div>
      </div>
    </div>
  );
}

import { Bot, CheckCircle2, CircleStop, Loader2, MessageSquareText, Wrench } from "lucide-react";
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

export function WorkflowAgentCard({
  agent,
  selected,
  onOpen,
}: {
  agent: WorkflowAgentSummary;
  selected: boolean;
  onOpen: (agentId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(agent.id)}
      className={`mt-3 flex w-full items-start gap-3 rounded-[22px] border px-4 py-3 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition ${
        selected
          ? "border-accent/40 bg-accent/8"
          : "border-black/6 bg-white/78 hover:border-accent/25 hover:bg-white"
      }`}
      title="Open agent transcript"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-black/6 bg-[#f4f7fb] text-accent">
        <Bot className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink-900">{agent.title}</span>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(agent.status)}`}>
            <StatusIcon status={agent.status} />
            {statusLabel(agent.status)}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2 text-[12px] text-muted">
          <span className="rounded-full bg-ink-900/5 px-2 py-0.5 font-medium text-ink-700">{agent.role}</span>
          <span className="inline-flex items-center gap-1">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            {agent.messageCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            {agent.toolCount}
          </span>
        </span>
        {agent.latestSummary && (
          <span className="mt-2 block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-5 text-ink-600">
            {agent.latestSummary}
          </span>
        )}
      </span>
    </button>
  );
}

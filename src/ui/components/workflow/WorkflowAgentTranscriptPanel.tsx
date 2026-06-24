import { Bot, CheckCircle2, CircleStop, Copy, ExternalLink, Loader2, MessageSquareText, Play, RotateCw, Wrench } from "lucide-react";
import { ChatTranscript } from "../chat/ChatTranscript";
import type { WorkflowAgentSummary } from "../../utils/workflow-agent-transcripts";
import type { WorkflowRunAction, WorkflowRunRecord, WorkflowRunStatus } from "../../../shared/workflows/workflow-runs";

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

function workflowRunStatusLabel(status: WorkflowRunStatus) {
  if (status === "launching") return "Launching";
  if (status === "running") return "Running";
  if (status === "backgrounded") return "Background";
  if (status === "completed") return "Done";
  if (status === "failed") return "Failed";
  if (status === "killed") return "Stopped";
  return "Unknown";
}

function workflowRunStatusTone(status: WorkflowRunStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed" || status === "killed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "backgrounded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function shortId(value?: string): string {
  if (!value) return "-";
  return value.length <= 18 ? value : `${value.slice(0, 10)}...${value.slice(-5)}`;
}

function formatRunTime(value?: number): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function canStopWorkflowRun(status: WorkflowRunStatus): boolean {
  return status === "launching" || status === "running" || status === "backgrounded";
}

function WorkflowRunSummary({
  run,
  onAction,
}: {
  run: WorkflowRunRecord;
  onAction?: (action: WorkflowRunAction, run: WorkflowRunRecord) => void;
}) {
  return (
    <div className="mb-4 rounded-[18px] border border-black/6 bg-white px-3.5 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-900">{run.workflowName || "Workflow run"}</span>
            <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${workflowRunStatusTone(run.status)}`}>
              {workflowRunStatusLabel(run.status)}
            </span>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="truncate">task {shortId(run.taskId)}</span>
            <span className="truncate">run {shortId(run.runId)}</span>
            <span>{formatRunTime(run.updatedAt)}</span>
          </div>
          {run.scriptPath && (
            <div className="mt-2 truncate rounded-lg bg-ink-900/[0.035] px-2 py-1 text-[11px] font-medium text-ink-600">
              {run.scriptPath}
            </div>
          )}
          {(run.warning || run.error) && (
            <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-[12px] leading-5 text-red-700">
              {run.error || run.warning}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {run.runId && run.taskType !== "remote_agent" && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2.5 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
              onClick={() => onAction?.("resume", run)}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Resume
            </button>
          )}
          {run.scriptPath && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/6 bg-white px-2.5 text-[12px] font-medium text-ink-700 hover:bg-slate-50"
              onClick={() => onAction?.("rerun", run)}
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-run
            </button>
          )}
          {run.scriptPath && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/6 bg-white text-ink-600 hover:bg-slate-50"
              title="Copy script path"
              aria-label="Copy script path"
              onClick={() => void navigator.clipboard?.writeText(run.scriptPath ?? "")}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {run.sessionUrl && (
            <a
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/6 bg-white text-ink-600 hover:bg-slate-50"
              href={run.sessionUrl}
              target="_blank"
              rel="noreferrer"
              title="Open session"
              aria-label="Open session"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {canStopWorkflowRun(run.status) && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 text-[12px] font-medium text-red-700 hover:bg-red-100"
              onClick={() => onAction?.("stop", run)}
            >
              <CircleStop className="h-3.5 w-3.5" aria-hidden="true" />
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkflowAgentTranscriptPanel({
  agent,
  workflowRun,
  onWorkflowRunAction,
  workspace,
  isRunning,
}: {
  agent?: WorkflowAgentSummary;
  workflowRun?: WorkflowRunRecord;
  onWorkflowRunAction?: (action: WorkflowRunAction, run: WorkflowRunRecord) => void;
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
          {workflowRun && (
            <WorkflowRunSummary run={workflowRun} onAction={onWorkflowRunAction} />
          )}

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

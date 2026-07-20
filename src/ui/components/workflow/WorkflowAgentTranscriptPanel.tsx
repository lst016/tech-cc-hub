import { CircleStop, Copy, ExternalLink, Loader2, Play, RotateCw, Sparkles } from "lucide-react";
import type { WorkflowRunAction, WorkflowRunRecord, WorkflowRunStatus } from "../../../shared/workflows/workflow-runs";
import {
  buildWorkflowAgentTranscriptView,
  type WorkflowAgentSummary,
} from "../../utils/workflow-agent-transcripts";
import { ChatTranscript } from "../chat/ChatTranscript";

function statusLabel(status: WorkflowAgentSummary["status"]) {
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  if (status === "killed") return "已停止";
  if (status === "stopped") return "已停止";
  if (status === "paused") return "已暂停";
  if (status === "unknown") return "已结束";
  return "运行中";
}

function statusTone(status: WorkflowAgentSummary["status"]) {
  if (status === "failed" || status === "killed") return "text-red-600";
  if (status === "running") return "text-[#7654cf]";
  if (status === "paused" || status === "stopped") return "text-amber-700";
  return "text-muted";
}

function agentLabel(role: string) {
  if (role === "Subagent" || role === "Task") return "智能体";
  if (role === "Workflow") return "工作流";
  if (role === "Background task") return "后台任务";
  return role;
}

function StatusIcon({ status }: { status: WorkflowAgentSummary["status"] }) {
  if (status === "failed" || status === "killed") {
    return <CircleStop className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (status === "running") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  }
  return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
}

function workflowRunStatusLabel(status: WorkflowRunStatus) {
  if (status === "launching") return "正在启动";
  if (status === "running") return "运行中";
  if (status === "backgrounded") return "后台运行";
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  if (status === "killed") return "已停止";
  return "未知";
}

function workflowRunStatusTone(status: WorkflowRunStatus) {
  if (status === "completed") return "text-emerald-700";
  if (status === "failed" || status === "killed") return "text-red-700";
  if (status === "backgrounded") return "text-amber-700";
  return "text-[#7654cf]";
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

function AgentProgressSummary({
  status,
  summary,
  updateCount,
}: {
  status: WorkflowAgentSummary["status"];
  summary: string;
  updateCount: number;
}) {
  return (
    <section data-workflow-agent-progress className="mb-5 border-b border-black/6 pb-5" aria-label="智能体当前进度">
      <div className={`flex items-center gap-2 text-[12px] font-medium ${statusTone(status)}`}>
        <StatusIcon status={status} />
        <span>{status === "running" ? "正在执行" : statusLabel(status)}</span>
        <span className="font-normal text-muted-light">· {updateCount} 次进度更新</span>
      </div>
      <p className="mt-2 text-[14px] leading-6 text-ink-700">{summary}</p>
    </section>
  );
}

function WorkflowRunSummary({
  run,
  onAction,
}: {
  run: WorkflowRunRecord;
  onAction?: (action: WorkflowRunAction, run: WorkflowRunRecord) => void;
}) {
  return (
    <section className="mb-5 border-b border-black/6 pb-4" aria-label="工作流运行信息">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] leading-5">
            <span className="font-medium text-ink-800">{run.workflowName || "工作流"}</span>
            <span className={workflowRunStatusTone(run.status)}>{workflowRunStatusLabel(run.status)}</span>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-light">
            <span className="truncate">task {shortId(run.taskId)}</span>
            <span className="truncate">run {shortId(run.runId)}</span>
            <span>{formatRunTime(run.updatedAt)}</span>
          </div>
          {run.scriptPath && (
            <div className="mt-2 truncate rounded-md bg-ink-900/[0.035] px-2 py-1 text-[11px] font-medium text-ink-600">
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#f2ecff] px-2.5 text-[12px] font-medium text-[#7654cf] hover:bg-[#e9dfff]"
              onClick={() => onAction?.("resume", run)}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Resume
            </button>
          )}
          {run.scriptPath && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink-600 hover:bg-slate-100"
              onClick={() => onAction?.("rerun", run)}
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-run
            </button>
          )}
          {run.scriptPath && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100"
              title="复制脚本路径"
              aria-label="复制脚本路径"
              onClick={() => void navigator.clipboard?.writeText(run.scriptPath ?? "")}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {run.sessionUrl && (
            <a
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100"
              href={run.sessionUrl}
              target="_blank"
              rel="noreferrer"
              title="打开会话"
              aria-label="打开会话"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {canStopWorkflowRun(run.status) && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
              onClick={() => onAction?.("stop", run)}
            >
              <CircleStop className="h-3.5 w-3.5" aria-hidden="true" />
              Stop
            </button>
          )}
        </div>
      </div>
    </section>
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
      <div data-workflow-agent-transcript className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
        <div className="border-b border-black/6 bg-white px-5 py-3">
          <div className="text-sm font-semibold text-ink-900">智能体记录</div>
        </div>
        <div className="chat-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 text-center">
          <div className="max-w-xs text-sm text-muted">在对话中选择一条智能体更新，即可查看完整记录。</div>
        </div>
      </div>
    );
  }

  const transcriptView = buildWorkflowAgentTranscriptView(agent);
  const showProgress = Boolean(transcriptView.latestProgress)
    && (agent.status === "running" || transcriptView.messages.length === 0);

  return (
    <div data-workflow-agent-transcript className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-black/6 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#f2ecff] text-[#8264d7] ring-1 ring-[#e8defd]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink-900">{agent.title}</div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 truncate text-[11px] text-muted">
              <span>{agentLabel(agent.role)}</span>
              {transcriptView.messages.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{transcriptView.messages.length} 条消息</span>
                </>
              )}
              {agent.toolCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{agent.toolCount} 次工具</span>
                </>
              )}
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium ${statusTone(agent.status)}`}>
            <StatusIcon status={agent.status} />
            {statusLabel(agent.status)}
          </span>
        </div>
      </header>

      <div className="chat-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto bg-white px-5 pb-8 pt-4">
        <div className="chat-stream-content mx-auto w-full max-w-[920px]">
          {workflowRun && (
            <WorkflowRunSummary run={workflowRun} onAction={onWorkflowRunAction} />
          )}

          {showProgress && (
            <AgentProgressSummary
              status={agent.status}
              summary={transcriptView.latestProgress}
              updateCount={transcriptView.statusEventCount}
            />
          )}

          <ChatTranscript
            messages={transcriptView.messages}
            workspace={workspace}
            isRunning={isRunning && agent.status === "running"}
            keyPrefix={`workflow-agent-${agent.id}`}
            presentation="agent"
            emptyMessage={showProgress ? undefined : ({
              type: "assistant",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "智能体已启动，正在等待首条进展。" }],
              },
            } as never)}
          />
        </div>
      </div>
    </div>
  );
}

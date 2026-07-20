import { ChevronRight, Sparkles } from "lucide-react";
import type { WorkflowAgentSummary } from "../../utils/workflow-agent-transcripts";

function statusLabel(status: WorkflowAgentSummary["status"]) {
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  if (status === "killed") return "已停止";
  if (status === "stopped") return "已停止";
  if (status === "paused") return "已暂停";
  if (status === "unknown") return "已结束";
  return "运行中";
}

function agentLabel(role: string) {
  if (role === "Subagent" || role === "Task") return "智能体";
  if (role === "Workflow") return "工作流";
  if (role === "Background task") return "后台任务";
  return role;
}

function statusTone(status: WorkflowAgentSummary["status"]) {
  if (status === "failed" || status === "killed") {
    return {
      icon: "bg-red-50 text-red-600 ring-red-100",
      text: "text-red-600",
    };
  }
  return {
    icon: "bg-[#f2ecff] text-[#8264d7] ring-[#e8defd]",
    text: status === "running" ? "text-[#7654cf]" : status === "stopped" || status === "paused" ? "text-amber-700" : "text-muted",
  };
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
  const tone = statusTone(agent.status);
  const showSummary = agent.latestSummary.trim()
    && agent.latestSummary.trim() !== agent.title.trim();

  return (
    <button
      type="button"
      data-workflow-agent-card
      data-workflow-agent-status={agent.status}
      data-workflow-agent-parent-id={agent.parentAgentId}
      data-workflow-agent-depth={agent.depth ?? 1}
      aria-current={selected ? "true" : undefined}
      aria-label={`打开${agentLabel(agent.role)}记录：${agent.title}`}
      onClick={() => onOpen(agent.id)}
      style={(agent.depth ?? 1) > 1 ? {
        marginLeft: `${Math.min(((agent.depth ?? 1) - 1) * 16, 48)}px`,
        width: `calc(100% - ${Math.min(((agent.depth ?? 1) - 1) * 16, 48)}px)`,
      } : undefined}
      className={`group mt-3 block w-full rounded-[14px] px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7ae0]/45 ${
        selected ? "bg-[#faf8ff]" : "hover:bg-ink-900/[0.025]"
      }`}
      title="打开智能体记录"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[10px] ring-1 ${tone.icon}`}>
          <Sparkles
            className={`h-3.5 w-3.5 ${agent.status === "running" ? "motion-safe:animate-pulse" : ""}`}
            aria-hidden="true"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2 text-[13px] leading-5">
            <span className="shrink-0 font-medium text-ink-700">{agentLabel(agent.role)}</span>
            <span className={tone.text}>{statusLabel(agent.status)}</span>
            <ChevronRight
              className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-light/70 transition-transform group-hover:translate-x-0.5 group-hover:text-[#8264d7] ${
                selected ? "translate-x-0.5 text-[#8264d7]" : ""
              }`}
              aria-hidden="true"
            />
          </span>

          <span className="mt-1 block text-[14px] font-medium leading-5 text-ink-900">
            {agent.title}
          </span>
          {showSummary && (
            <span className="mt-1 block line-clamp-2 text-[13px] leading-5 text-ink-600">
              {agent.latestSummary}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

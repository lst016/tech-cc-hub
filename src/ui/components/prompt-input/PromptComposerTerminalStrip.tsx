import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Square, TerminalSquare } from "lucide-react";

type TerminalProcessStatus = "running" | "exited" | "killed" | "error";

type TerminalProcessInfo = {
  id: string;
  command: string;
  cwd: string;
  shell: string;
  pid?: number;
  startedAt: number;
  endedAt?: number;
  exitCode?: number | null;
  signal?: string | null;
  stdoutTail: string;
  stderrTail: string;
  status: TerminalProcessStatus;
  error?: string;
  running: boolean;
};

type TerminalProcessListResult = {
  success: boolean;
  processes: TerminalProcessInfo[];
  error?: string;
};

type TerminalProcessStopResult = {
  success: boolean;
  process?: TerminalProcessInfo;
  error?: string;
};

function sortProcesses(left: TerminalProcessInfo, right: TerminalProcessInfo) {
  if (left.running && !right.running) return -1;
  if (!left.running && right.running) return 1;
  return right.startedAt - left.startedAt;
}

function sortProcessesForWorkspace(left: TerminalProcessInfo, right: TerminalProcessInfo, workspaceCwd: string) {
  const normalizedWorkspace = workspaceCwd.trim().toLowerCase();
  const leftInWorkspace = normalizedWorkspace && left.cwd.trim().toLowerCase() === normalizedWorkspace;
  const rightInWorkspace = normalizedWorkspace && right.cwd.trim().toLowerCase() === normalizedWorkspace;
  if (leftInWorkspace && !rightInWorkspace) return -1;
  if (!leftInWorkspace && rightInWorkspace) return 1;
  return sortProcesses(left, right);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatProcessTime(processInfo: TerminalProcessInfo) {
  const end = processInfo.endedAt ?? Date.now();
  return formatDuration(end - processInfo.startedAt);
}

export function PromptComposerTerminalStrip({ workspaceCwd = "" }: { workspaceCwd?: string }) {
  const [processes, setProcesses] = useState<TerminalProcessInfo[]>([]);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(() => new Set());

  const refreshProcesses = useCallback(async () => {
    try {
      const result = await window.electron.invoke<TerminalProcessListResult>("terminal:list");
      if (!result.success || !Array.isArray(result.processes)) return;
      setProcesses(result.processes.filter((processInfo) => processInfo.running));
    } catch {
      setProcesses([]);
    }
  }, []);

  useEffect(() => {
    void refreshProcesses();
    const timer = window.setInterval(() => {
      void refreshProcesses();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [refreshProcesses]);

  const orderedProcesses = useMemo(
    () => [...processes].sort((left, right) => sortProcessesForWorkspace(left, right, workspaceCwd)),
    [processes, workspaceCwd],
  );
  const visibleProcesses = useMemo(() => orderedProcesses.slice(0, 4), [orderedProcesses]);
  const hiddenCount = Math.max(0, orderedProcesses.length - visibleProcesses.length);

  const handleStopProcess = useCallback(async (processId: string) => {
    setStoppingIds((current) => new Set(current).add(processId));
    try {
      const result = await window.electron.invoke<TerminalProcessStopResult>("terminal:stop", { id: processId });
      if (result.process) {
        setProcesses((current) => current.filter((processInfo) => processInfo.id !== result.process?.id));
      }
      await refreshProcesses();
    } finally {
      setStoppingIds((current) => {
        const next = new Set(current);
        next.delete(processId);
        return next;
      });
    }
  }, [refreshProcesses]);

  if (visibleProcesses.length === 0) return null;

  return (
    <div className="mb-3 rounded-[18px] border border-[#d6e4ff] bg-[linear-gradient(180deg,#f8fbff_0%,#f4f8ff_100%)] px-3 py-3 shadow-[0_8px_24px_rgba(59,130,246,0.08)]">
      <div className="flex min-w-0 items-center gap-2 text-[12px] text-[#315072]">
        <TerminalSquare className="h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />
        <span className="shrink-0 font-semibold">Managed terminal</span>
        <span className="truncate text-[#64748b]">Background commands like npm run dev stay pinned here until you stop them.</span>
      </div>
      <div className="mt-3 grid gap-2">
        {visibleProcesses.map((processInfo) => (
          <div
            key={processInfo.id}
            className="flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-[#cfe0ff] bg-white px-3 py-2 text-[12px] text-[#0f172a]"
            title={`${processInfo.command} (${processInfo.cwd})`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#16a34a]" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono font-semibold">{processInfo.command}</span>
                <span className="shrink-0 text-[#64748b]">{formatProcessTime(processInfo)}</span>
                {processInfo.pid ? <span className="shrink-0 text-[#94a3b8]">PID {processInfo.pid}</span> : null}
              </div>
              <div className="truncate text-[11px] text-[#64748b]">{processInfo.cwd}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleStopProcess(processInfo.id);
              }}
              disabled={stoppingIds.has(processInfo.id)}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#fecaca] bg-[#fff7f7] px-3 text-[#dc2626] transition hover:bg-[#fee2e2] disabled:cursor-wait disabled:opacity-60"
              aria-label={`Stop terminal process ${processInfo.command}`}
              title="Stop terminal process"
            >
              {stoppingIds.has(processInfo.id)
                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                : <Square className="h-3 w-3 fill-current" aria-hidden="true" />}
              <span className="text-[11px] font-semibold">Stop</span>
            </button>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="inline-flex items-center rounded-full border border-[#dbeafe] bg-white px-3 py-1.5 text-[12px] text-[#64748b]">
            {hiddenCount} more background commands
          </div>
        )}
      </div>
    </div>
  );
}

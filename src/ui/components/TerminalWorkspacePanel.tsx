import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Loader2, Square } from "lucide-react";
import { isLikelyLongRunningTerminalCommand } from "../utils/terminal-long-running";

type TerminalRunResult = {
  success: boolean;
  command: string;
  cwd: string;
  shell: string;
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  elapsedMs: number;
  error?: string;
};

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

type TerminalProcessStartResult = {
  success: boolean;
  process?: TerminalProcessInfo;
  error?: string;
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

type TerminalEntry = {
  id: string;
  command: string;
  cwd?: string;
  result?: TerminalRunResult;
  processId?: string;
  error?: string;
};

function buildPrompt(path: string) {
  return `PS ${path}>`;
}

function buildStatusText(result: TerminalRunResult) {
  if (result.timedOut) return "Process timed out";
  if (result.exitCode === 0) return "";
  return `Process exited with code ${result.exitCode ?? "unknown"}`;
}

function normalizeTerminalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/No handler registered.*terminal:run/i.test(message)) {
    return "Terminal backend is not loaded. Restart the Electron dev process and try again.";
  }
  return message;
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

function formatProcessStatus(processInfo: TerminalProcessInfo) {
  if (processInfo.status === "running") return "running";
  if (processInfo.status === "killed") return "stopped";
  if (processInfo.status === "error") return "error";
  if (processInfo.exitCode === 0) return "exited 0";
  return `exited ${processInfo.exitCode ?? "unknown"}`;
}

function mergeProcess(current: TerminalProcessInfo[], next: TerminalProcessInfo) {
  return [next, ...current.filter((item) => item.id !== next.id)].sort(sortProcesses);
}

function sortProcesses(left: TerminalProcessInfo, right: TerminalProcessInfo) {
  if (left.running && !right.running) return -1;
  if (!left.running && right.running) return 1;
  return right.startedAt - left.startedAt;
}

function ProcessOutput({ processInfo }: { processInfo: TerminalProcessInfo }) {
  if (!processInfo.stdoutTail && !processInfo.stderrTail && !processInfo.error) return null;
  return (
    <div className="mt-2 grid gap-1">
      {processInfo.stdoutTail && (
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] text-[#111827]">
          {processInfo.stdoutTail}
        </pre>
      )}
      {(processInfo.stderrTail || processInfo.error) && (
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#fecaca] bg-[#fff7f7] px-2 py-1.5 text-[12px] text-[#dc2626]">
          {processInfo.error ? `${processInfo.error}\n${processInfo.stderrTail}` : processInfo.stderrTail}
        </pre>
      )}
    </div>
  );
}

function ProcessRow({
  processInfo,
  stopping,
  onStop,
}: {
  processInfo: TerminalProcessInfo;
  stopping: boolean;
  onStop: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${processInfo.running ? "animate-pulse bg-[#16a34a]" : "bg-[#94a3b8]"}`} />
            <span className="truncate font-mono text-[12px] font-semibold text-[#111827]" title={processInfo.command}>
              {processInfo.command}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#64748b]">
            <span>{formatProcessStatus(processInfo)}</span>
            <span>{formatProcessTime(processInfo)}</span>
            {processInfo.pid ? <span>PID {processInfo.pid}</span> : null}
            <span className="max-w-full truncate font-mono" title={processInfo.cwd}>{processInfo.cwd}</span>
          </div>
        </div>
        {processInfo.running && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onStop(processInfo.id);
            }}
            disabled={stopping}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#fecaca] bg-[#fff7f7] px-2 text-[11px] font-semibold text-[#dc2626] transition hover:bg-[#fee2e2] disabled:cursor-wait disabled:opacity-60"
            title="Stop background process"
          >
            {stopping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            Stop
          </button>
        )}
      </div>
      <ProcessOutput processInfo={processInfo} />
    </div>
  );
}

export function TerminalWorkspacePanel({ cwd }: { cwd?: string }) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [processes, setProcesses] = useState<TerminalProcessInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const workspacePath = useMemo(() => cwd?.trim() || "", [cwd]);
  const promptPath = workspacePath || "~";

  const processById = useMemo(() => {
    const lookup = new Map<string, TerminalProcessInfo>();
    for (const processInfo of processes) {
      lookup.set(processInfo.id, processInfo);
    }
    return lookup;
  }, [processes]);

  const visibleProcesses = useMemo(
    () => [...processes].sort(sortProcesses).slice(0, 8),
    [processes],
  );

  const runningProcessCount = useMemo(
    () => processes.filter((processInfo) => processInfo.running).length,
    [processes],
  );

  const refreshProcesses = useCallback(async () => {
    try {
      const result = await window.electron.invoke<TerminalProcessListResult>("terminal:list");
      if (result.success && Array.isArray(result.processes)) {
        setProcesses(result.processes.sort(sortProcesses));
      }
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries, running, processes]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setEntries([]);
    }
  }, []);

  const handleStopProcess = useCallback(async (processId: string) => {
    setStoppingIds((current) => new Set(current).add(processId));
    try {
      const result = await window.electron.invoke<TerminalProcessStopResult>("terminal:stop", { id: processId });
      if (result.process) {
        setProcesses((current) => mergeProcess(current, result.process!));
      }
      if (!result.success && result.error) {
        setEntries((current) => [
          ...current,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            command: `stop ${processId}`,
            cwd: workspacePath,
            error: result.error,
          },
        ]);
      }
      void refreshProcesses();
    } catch (error) {
      const message = normalizeTerminalError(error);
      setEntries((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command: `stop ${processId}`,
          cwd: workspacePath,
          error: message,
        },
      ]);
    } finally {
      setStoppingIds((current) => {
        const next = new Set(current);
        next.delete(processId);
        return next;
      });
    }
  }, [refreshProcesses, workspacePath]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || running) return;

    const entry: TerminalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      command: trimmed,
      cwd: workspacePath,
    };
    setEntries((current) => [...current, entry]);
    setCommand("");

    if (isLikelyLongRunningTerminalCommand(trimmed)) {
      try {
        const result = await window.electron.invoke<TerminalProcessStartResult>("terminal:start", {
          command: trimmed,
          cwd: workspacePath || undefined,
        });
        if (!result.success || !result.process) {
          throw new Error(result.error || "Failed to start background process.");
        }
        setProcesses((current) => mergeProcess(current, result.process!));
        setEntries((current) => current.map((item) => (
          item.id === entry.id ? { ...item, processId: result.process!.id } : item
        )));
      } catch (error) {
        const message = normalizeTerminalError(error);
        setEntries((current) => current.map((item) => (
          item.id === entry.id ? { ...item, error: message } : item
        )));
      } finally {
        void refreshProcesses();
      }
      return;
    }

    setRunning(true);

    try {
      const result = await window.electron.invoke<TerminalRunResult>("terminal:run", {
        command: trimmed,
        cwd: workspacePath || undefined,
        timeoutMs: 120_000,
      });
      setEntries((current) => current.map((item) => (
        item.id === entry.id ? { ...item, result } : item
      )));
    } catch (error) {
      const message = normalizeTerminalError(error);
      setEntries((current) => current.map((item) => (
        item.id === entry.id ? { ...item, error: message } : item
      )));
    } finally {
      setRunning(false);
    }
  }, [command, refreshProcesses, running, workspacePath]);

  return (
    <div
      data-testid="terminal-workspace-panel"
      className="flex h-full min-h-0 w-full cursor-text flex-col bg-[#fbfbfc] text-[#111827]"
      onClick={focusInput}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 font-mono text-[13px] leading-6">
        {visibleProcesses.length > 0 && (
          <section className="mb-4 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-3 font-sans">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-[#64748b]" />
                <div className="min-w-0">
                  <h3 className="truncate text-[12px] font-semibold text-[#111827]">Background processes</h3>
                  <p className="truncate text-[11px] text-[#64748b]">
                    {runningProcessCount} running, dev/watch commands stay here until stopped.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void refreshProcesses();
                }}
                className="h-7 rounded-md border border-[#e5e7eb] bg-white px-2 text-[11px] font-semibold text-[#475569] transition hover:bg-[#f1f5f9]"
              >
                Refresh
              </button>
            </div>
            <div className="grid gap-2">
              {visibleProcesses.map((processInfo) => (
                <ProcessRow
                  key={processInfo.id}
                  processInfo={processInfo}
                  stopping={stoppingIds.has(processInfo.id)}
                  onStop={handleStopProcess}
                />
              ))}
            </div>
          </section>
        )}

        {entries.map((entry) => {
          const statusText = entry.result ? buildStatusText(entry.result) : "";
          const processInfo = entry.processId ? processById.get(entry.processId) : undefined;
          return (
            <div key={entry.id} className="mb-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-[#0f172a]">{buildPrompt(entry.cwd || promptPath)}</span>
                <span className="min-w-0 break-words text-[#111827]">{entry.command}</span>
                {!entry.result && !entry.error && !entry.processId && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#6b7280]" aria-hidden="true" />
                )}
              </div>
              {entry.processId && (
                <div className="mt-1 rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 py-1.5 font-sans text-[12px] text-[#1d4ed8]">
                  Registered as background process {entry.processId.slice(0, 8)}
                  {processInfo ? ` · ${formatProcessStatus(processInfo)} · ${formatProcessTime(processInfo)}` : ""}
                </div>
              )}
              {entry.error && (
                <pre className="mt-1 whitespace-pre-wrap break-words text-[#dc2626]">{entry.error}</pre>
              )}
              {entry.result?.stdout && (
                <pre className="mt-1 whitespace-pre-wrap break-words text-[#111827]">{entry.result.stdout}</pre>
              )}
              {entry.result?.stderr && (
                <pre className="mt-1 whitespace-pre-wrap break-words text-[#dc2626]">{entry.result.stderr}</pre>
              )}
              {statusText && (
                <div className="mt-1 text-[#6b7280]">{statusText}</div>
              )}
            </div>
          );
        })}

        <form onSubmit={handleSubmit} className="flex min-w-0 items-baseline gap-2">
          <label htmlFor="terminal-command-input" className="shrink-0 text-[#0f172a]">
            {buildPrompt(promptPath)}
          </label>
          <input
            ref={inputRef}
            id="terminal-command-input"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            autoFocus
            autoComplete="off"
            aria-label="Terminal command"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[#111827] caret-[#111827] outline-none disabled:cursor-wait"
          />
          {running && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#6b7280]" aria-hidden="true" />}
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

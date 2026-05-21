import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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

type TerminalEntry = {
  id: string;
  command: string;
  cwd?: string;
  result?: TerminalRunResult;
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

export function TerminalWorkspacePanel({ cwd }: { cwd?: string }) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const workspacePath = useMemo(() => cwd?.trim() || "", [cwd]);
  const promptPath = workspacePath || "~";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries, running]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setEntries([]);
    }
  }, []);

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
  }, [command, running, workspacePath]);

  return (
    <div
      data-testid="terminal-workspace-panel"
      className="flex h-full min-h-0 w-full cursor-text flex-col bg-[#fbfbfc] text-[#111827]"
      onClick={focusInput}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 font-mono text-[13px] leading-6">
        {entries.map((entry) => {
          const statusText = entry.result ? buildStatusText(entry.result) : "";
          return (
            <div key={entry.id} className="mb-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-[#0f172a]">{buildPrompt(entry.cwd || promptPath)}</span>
                <span className="min-w-0 break-words text-[#111827]">{entry.command}</span>
                {!entry.result && !entry.error && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#6b7280]" aria-hidden="true" />
                )}
              </div>
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

type SessionTerminalStatus = "completed" | "error";

export type SessionCodeGraphAutoSyncEvent = {
  sessionId: string;
  cwd?: string | null;
  previousStatus?: string | null;
  nextStatus: string;
};

export type SessionCodeGraphAutoSyncOptions = {
  sync: (workspaceRoot: string) => Promise<unknown>;
  logInfo?: (message: string) => void;
  logWarn?: (message: string, error: unknown) => void;
};

const TERMINAL_STATUSES = new Set<SessionTerminalStatus>(["completed", "error"]);

export function shouldAutoSyncCodeGraphAfterSessionTurn(event: SessionCodeGraphAutoSyncEvent): boolean {
  return (
    event.previousStatus === "running" &&
    TERMINAL_STATUSES.has(event.nextStatus as SessionTerminalStatus) &&
    Boolean(event.cwd?.trim())
  );
}

export function createSessionCodeGraphAutoSyncScheduler(options: SessionCodeGraphAutoSyncOptions) {
  const pendingWorkspaceRoots = new Set<string>();
  const runningWorkspaceRoots = new Set<string>();

  async function drainWorkspace(workspaceRoot: string): Promise<void> {
    if (runningWorkspaceRoots.has(workspaceRoot)) {
      return;
    }

    runningWorkspaceRoots.add(workspaceRoot);
    try {
      while (pendingWorkspaceRoots.delete(workspaceRoot)) {
        try {
          await options.sync(workspaceRoot);
          options.logInfo?.(`[codegraph][turn-autosync] synced ${workspaceRoot}`);
        } catch (error) {
          options.logWarn?.(`[codegraph][turn-autosync] sync failed for ${workspaceRoot}`, error);
        }
      }
    } finally {
      runningWorkspaceRoots.delete(workspaceRoot);
      if (pendingWorkspaceRoots.has(workspaceRoot)) {
        void drainWorkspace(workspaceRoot);
      }
    }
  }

  return (event: SessionCodeGraphAutoSyncEvent): void => {
    if (!shouldAutoSyncCodeGraphAfterSessionTurn(event)) {
      return;
    }

    const workspaceRoot = event.cwd?.trim();
    if (!workspaceRoot) {
      return;
    }

    pendingWorkspaceRoots.add(workspaceRoot);
    void drainWorkspace(workspaceRoot);
  };
}

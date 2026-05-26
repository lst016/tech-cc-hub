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
  minIntervalMs?: number;
  retryDelayMs?: number;
  now?: () => number;
};

const TERMINAL_STATUSES = new Set<SessionTerminalStatus>(["completed", "error"]);
const DEFAULT_MIN_INTERVAL_MS = 5 * 60 * 1_000;
const DEFAULT_RETRY_DELAY_MS = 2 * 60 * 1_000;

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
  const scheduledWorkspaceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const nextEligibleAtByWorkspace = new Map<string, number>();
  const minIntervalMs = Math.max(0, options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  const now = options.now ?? (() => Date.now());

  function scheduleWorkspaceDrain(workspaceRoot: string, delayMs: number): void {
    if (scheduledWorkspaceTimers.has(workspaceRoot)) {
      return;
    }

    if (delayMs <= 0) {
      void drainWorkspace(workspaceRoot);
      return;
    }

    const timer = setTimeout(() => {
      scheduledWorkspaceTimers.delete(workspaceRoot);
      void drainWorkspace(workspaceRoot);
    }, delayMs);
    scheduledWorkspaceTimers.set(workspaceRoot, timer);
  }

  async function drainWorkspace(workspaceRoot: string): Promise<void> {
    if (runningWorkspaceRoots.has(workspaceRoot)) {
      return;
    }
    if (!pendingWorkspaceRoots.has(workspaceRoot)) {
      return;
    }

    const nextEligibleAt = nextEligibleAtByWorkspace.get(workspaceRoot) ?? 0;
    const waitMs = nextEligibleAt - now();
    if (waitMs > 0) {
      scheduleWorkspaceDrain(workspaceRoot, waitMs);
      return;
    }

    runningWorkspaceRoots.add(workspaceRoot);
    try {
      pendingWorkspaceRoots.delete(workspaceRoot);
      try {
        await options.sync(workspaceRoot);
        nextEligibleAtByWorkspace.set(workspaceRoot, now() + minIntervalMs);
        options.logInfo?.(`[codegraph][turn-autosync] synced ${workspaceRoot}`);
      } catch (error) {
        nextEligibleAtByWorkspace.set(workspaceRoot, now() + retryDelayMs);
        options.logWarn?.(`[codegraph][turn-autosync] sync failed for ${workspaceRoot}`, error);
      }
    } finally {
      runningWorkspaceRoots.delete(workspaceRoot);
      if (pendingWorkspaceRoots.has(workspaceRoot)) {
        const nextEligibleAt = nextEligibleAtByWorkspace.get(workspaceRoot) ?? 0;
        scheduleWorkspaceDrain(workspaceRoot, nextEligibleAt - now());
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
    const nextEligibleAt = nextEligibleAtByWorkspace.get(workspaceRoot) ?? 0;
    scheduleWorkspaceDrain(workspaceRoot, nextEligibleAt - now());
  };
}

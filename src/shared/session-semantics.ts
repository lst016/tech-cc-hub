export type SessionExecutionMode = "foreground" | "background";

export type SessionBaseStatus = "idle" | "running" | "completed" | "error";

export type SessionSemanticStatus =
  | "idle"
  | "running"
  | "blocked"
  | "waiting_input"
  | "completed"
  | "error";

export type SessionSemanticState = {
  sessionId: string;
  executionMode: SessionExecutionMode;
  status: SessionSemanticStatus;
  model?: string;
  effort?: string;
  permissionMode?: string;
  blockerSummary?: string;
};

export type SessionSemanticInput = {
  sessionId: string;
  executionMode?: SessionExecutionMode;
  status: SessionBaseStatus;
  model?: string;
  effort?: string;
  permissionMode?: string;
  pendingPermissionCount?: number;
  blockerSummary?: string;
};

export function buildSessionSemanticState(input: SessionSemanticInput): SessionSemanticState {
  const pendingPermissionCount = Math.max(0, input.pendingPermissionCount ?? 0);
  const blockerSummary = input.blockerSummary?.trim();

  return {
    sessionId: input.sessionId,
    executionMode: input.executionMode ?? "foreground",
    status: resolveSessionSemanticStatus(input.status, pendingPermissionCount, blockerSummary),
    model: input.model,
    effort: input.effort,
    permissionMode: input.permissionMode,
    blockerSummary: pendingPermissionCount > 0
      ? `Waiting for ${pendingPermissionCount} permission response${pendingPermissionCount === 1 ? "" : "s"}.`
      : blockerSummary || undefined,
  };
}

function resolveSessionSemanticStatus(
  status: SessionBaseStatus,
  pendingPermissionCount: number,
  blockerSummary: string | undefined,
): SessionSemanticStatus {
  if (status === "error") return "error";
  if (status === "completed") return "completed";
  if (pendingPermissionCount > 0) return "waiting_input";
  if (blockerSummary) return "blocked";
  if (status === "running") return "running";
  return "idle";
}

// -----------------------------------------------------------------------------
// Background agent model — Phase 4 of the Claude Code 2.1.161 compat workflow.
// -----------------------------------------------------------------------------

export type BackgroundAgentStatus =
  | "queued"
  | "running"
  | "waiting_input"
  | "blocked"
  | "completed"
  | "failed"
  | "stale"
  | "detached";

export type BackgroundAgentViewModel = {
  id: string;
  sessionId: string;
  label: string;
  status: BackgroundAgentStatus;
  doneCount?: number;
  totalCount?: number;
  longestRunningMs?: number;
  worktreePath?: string;
  model?: string;
  effort?: string;
  permissionMode?: string;
  blockerSummary?: string;
  lastEventAt: string;
};

export type BackgroundAgentInput = {
  id: string;
  sessionId: string;
  label: string;
  status: BackgroundAgentStatus;
  doneCount?: number;
  totalCount?: number;
  longestRunningMs?: number;
  worktreePath?: string;
  model?: string;
  effort?: string;
  permissionMode?: string;
  blockerSummary?: string;
  lastEventAt: string;
  staleAfterMs?: number;
};

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

export function buildBackgroundAgentViewModel(input: BackgroundAgentInput): BackgroundAgentViewModel {
  const status = maybeMarkStale(input, input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS);
  return {
    id: input.id,
    sessionId: input.sessionId,
    label: input.label,
    status,
    doneCount: input.doneCount,
    totalCount: input.totalCount,
    longestRunningMs: input.longestRunningMs,
    worktreePath: input.worktreePath,
    model: input.model,
    effort: input.effort,
    permissionMode: input.permissionMode,
    blockerSummary: input.blockerSummary,
    lastEventAt: input.lastEventAt,
  };
}

function maybeMarkStale(input: BackgroundAgentInput, staleAfterMs: number): BackgroundAgentStatus {
  if (input.status === "stale" || input.status === "completed" || input.status === "failed" || input.status === "detached") {
    return input.status;
  }
  const last = Date.parse(input.lastEventAt);
  if (Number.isNaN(last)) return input.status;
  const ageMs = Date.now() - last;
  if (ageMs > staleAfterMs) return "stale";
  return input.status;
}

export function summarizeBackgroundAgents(agents: BackgroundAgentViewModel[]): {
  total: number;
  running: number;
  blocked: number;
  waitingInput: number;
  stale: number;
  done: number;
  failed: number;
  detached: number;
} {
  const summary = { total: agents.length, running: 0, blocked: 0, waitingInput: 0, stale: 0, done: 0, failed: 0, detached: 0 };
  for (const a of agents) {
    if (a.status === "running") summary.running += 1;
    else if (a.status === "blocked") summary.blocked += 1;
    else if (a.status === "waiting_input") summary.waitingInput += 1;
    else if (a.status === "stale") summary.stale += 1;
    else if (a.status === "completed") summary.done += 1;
    else if (a.status === "failed") summary.failed += 1;
    else if (a.status === "detached") summary.detached += 1;
  }
  return summary;
}

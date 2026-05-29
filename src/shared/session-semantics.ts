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

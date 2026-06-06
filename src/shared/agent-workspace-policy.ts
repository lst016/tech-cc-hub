// src/shared/agent-workspace-policy.ts
// -----------------------------------------------------------------------------
// Phase 5 of the Claude Code 2.1.161 compatibility workflow.
// Multi-agent workflows need explicit workspace policies so parallel write
// lanes cannot corrupt the main checkout. This module is the type + resolver
// layer; the runner/executor wiring lives elsewhere.
// -----------------------------------------------------------------------------

export type AgentWorkspacePolicy = "shared" | "isolated" | "readonly";

export type AgentWorkspaceLeaseStatus = "active" | "merge-ready" | "blocked" | "cleaned";

export type AgentWorkspaceLease = {
  taskId: string;
  laneId: string;
  policy: AgentWorkspacePolicy;
  rootPath: string;
  worktreePath?: string;
  sourceBranch?: string;
  status: AgentWorkspaceLeaseStatus;
};

export type ResolveWorkspacePolicyInput = {
  parallelWriteLanes: number;
  isMultiAgent: boolean;
  userOverride?: AgentWorkspacePolicy;
  singleAgentSharedAllowed?: boolean;
};

export type ResolveWorkspacePolicyResult = {
  policy: AgentWorkspacePolicy;
  reason: string;
  worktreePathSuggestion?: string;
};

export const DEFAULT_WORKTREE_ROOT = ".worktrees";

export function resolveAgentWorkspacePolicy(input: ResolveWorkspacePolicyInput): ResolveWorkspacePolicyResult {
  if (input.userOverride) {
    return { policy: input.userOverride, reason: "user override" };
  }
  if (input.isMultiAgent && input.parallelWriteLanes > 1) {
    return {
      policy: "isolated",
      reason: `multi-agent run with ${input.parallelWriteLanes} write lanes`,
      worktreePathSuggestion: `${DEFAULT_WORKTREE_ROOT}/lane-${input.parallelWriteLanes}`,
    };
  }
  if (input.parallelWriteLanes > 1) {
    return { policy: "isolated", reason: "multiple write lanes detected" };
  }
  if (input.singleAgentSharedAllowed) {
    return { policy: "shared", reason: "single agent, no parallel write" };
  }
  return { policy: "isolated", reason: "default-safe: isolated" };
}

// Cleanup guard: refuse to clean a worktree with uncommitted changes unless
// the caller explicitly forces it. Mirrors the workflow lane semantics from
// Claude Code 2.1.161's "isolated worktree" guidance.
export function canCleanupWorktree(lease: AgentWorkspaceLease, dirty: boolean, force: boolean): { ok: boolean; reason: string } {
  if (lease.status === "cleaned") return { ok: false, reason: "already cleaned" };
  if (dirty && !force) return { ok: false, reason: "worktree has uncommitted changes; pass force=true to override" };
  if (lease.policy === "readonly") return { ok: false, reason: "readonly policy never cleans" };
  return { ok: true, reason: "ok" };
}

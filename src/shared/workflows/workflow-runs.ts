export type WorkflowRunStatus =
  | "launching"
  | "running"
  | "backgrounded"
  | "completed"
  | "failed"
  | "killed"
  | "unknown";

export type WorkflowRunSource =
  | "sdk-workflow-tool"
  | "slash-command"
  | "launcher"
  | "prompt-auto"
  | "unknown";

export type WorkflowRunTaskType = "local_workflow" | "remote_agent";
export type WorkflowRunAction = "resume" | "rerun" | "stop";

export type WorkflowRunFailureKind =
  | "script_error"
  | "agent_failed"
  | "permission_denied"
  | "runtime_error"
  | "unknown";

export type WorkflowRunRecord = {
  id: string;
  sessionId: string;
  taskId: string;
  taskType?: WorkflowRunTaskType;
  workflowName?: string;
  runId?: string;
  source: WorkflowRunSource;
  status: WorkflowRunStatus;
  summary?: string;
  scriptPath?: string;
  transcriptDir?: string;
  sessionUrl?: string;
  warning?: string;
  error?: string;
  failureKind?: WorkflowRunFailureKind;
  launchedAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type WorkflowRunPatch = Partial<Omit<WorkflowRunRecord, "sessionId" | "taskId">> & {
  sessionId: string;
  taskId: string;
};

export function createWorkflowRunId(sessionId: string, taskId: string): string {
  return `${sessionId}:${taskId}`;
}

export function isTerminalWorkflowRunStatus(status: WorkflowRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "killed";
}

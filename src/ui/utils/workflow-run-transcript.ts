import type { WorkflowRunRecord } from "../../shared/workflows/workflow-runs.js";

export type WorkflowRunTranscriptAgent = {
  id: string;
  taskId: string;
};

export function findWorkflowRunForTranscript(
  agent: WorkflowRunTranscriptAgent | undefined,
  runs: WorkflowRunRecord[],
): WorkflowRunRecord | undefined {
  if (!agent) return undefined;
  return runs.find((run) => run.taskId === agent.taskId || run.taskId === agent.id);
}

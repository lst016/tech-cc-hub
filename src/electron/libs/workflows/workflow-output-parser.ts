import type { WorkflowRunPatch, WorkflowRunStatus, WorkflowRunTaskType } from "../../../shared/workflows/workflow-runs.js";

type ExtractInput = {
  sessionId: string;
  message: unknown;
  toolUseNames: ReadonlyMap<string, string>;
  knownWorkflowTaskIds?: ReadonlySet<string>;
};

type WorkflowOutput = {
  status: "async_launched" | "remote_launched";
  taskId: string;
  taskType?: WorkflowRunTaskType;
  workflowName?: string;
  runId?: string;
  summary?: string;
  transcriptDir?: string;
  scriptPath?: string;
  sessionUrl?: string;
  warning?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getMessageContentBlocks(message: unknown): unknown[] {
  if (!isRecord(message)) return [];
  const envelope = message.message;
  if (isRecord(envelope)) {
    const content = envelope.content;
    return Array.isArray(content) ? content : content ? [content] : [];
  }
  const content = message.content;
  return Array.isArray(content) ? content : content ? [content] : [];
}

function isWorkflowToolName(toolName: string | undefined): boolean {
  if (!toolName) return false;
  const normalized = toolName.trim().toLowerCase();
  return normalized === "workflow"
    || normalized.endsWith("__workflow")
    || normalized.endsWith(":workflow")
    || normalized.endsWith("/workflow");
}

export function collectWorkflowToolUseNames(message: unknown, toolUseNames: Map<string, string>): void {
  if (!isRecord(message) || message.type !== "assistant") {
    return;
  }

  for (const item of getMessageContentBlocks(message)) {
    if (!isRecord(item) || item.type !== "tool_use") continue;
    const toolUseId = getString(item, "id");
    const toolName = getString(item, "name");
    if (toolUseId && toolName && isWorkflowToolName(toolName)) {
      toolUseNames.set(toolUseId, toolName);
    }
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function contentCandidates(value: unknown): unknown[] {
  if (typeof value === "string") {
    return [parseJsonObject(value)].filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) return contentCandidates(item);
      const text = getString(item, "text");
      if (text) return contentCandidates(text);
      return contentCandidates(item);
    });
  }

  if (isRecord(value)) {
    return [value];
  }

  return [];
}

function normalizeTaskType(value: string | undefined): WorkflowRunTaskType | undefined {
  if (value === "local_workflow" || value === "remote_agent") {
    return value;
  }
  return undefined;
}

function parseWorkflowOutput(value: unknown): WorkflowOutput | null {
  for (const candidate of contentCandidates(value)) {
    if (!isRecord(candidate)) continue;
    const status = getString(candidate, "status");
    const taskId = getString(candidate, "taskId") ?? getString(candidate, "task_id");
    if ((status !== "async_launched" && status !== "remote_launched") || !taskId) {
      continue;
    }

    return {
      status,
      taskId,
      taskType: normalizeTaskType(getString(candidate, "taskType") ?? getString(candidate, "task_type")),
      workflowName: getString(candidate, "workflowName") ?? getString(candidate, "workflow_name"),
      runId: getString(candidate, "runId") ?? getString(candidate, "run_id"),
      summary: getString(candidate, "summary"),
      transcriptDir: getString(candidate, "transcriptDir") ?? getString(candidate, "transcript_dir"),
      scriptPath: getString(candidate, "scriptPath") ?? getString(candidate, "script_path"),
      sessionUrl: getString(candidate, "sessionUrl") ?? getString(candidate, "session_url"),
      warning: getString(candidate, "warning"),
    };
  }
  return null;
}

function getMessageTimestamp(message: unknown): number {
  if (isRecord(message) && typeof message.capturedAt === "number") {
    return message.capturedAt;
  }
  return Date.now();
}

function compactPatch(patch: WorkflowRunPatch): WorkflowRunPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as WorkflowRunPatch;
}

function extractToolResultPatches(input: ExtractInput): WorkflowRunPatch[] {
  if (!isRecord(input.message) || input.message.type !== "user") {
    return [];
  }

  const patches: WorkflowRunPatch[] = [];
  const timestamp = getMessageTimestamp(input.message);

  for (const item of getMessageContentBlocks(input.message)) {
    if (!isRecord(item) || item.type !== "tool_result") continue;
    const toolUseId = getString(item, "tool_use_id");
    const toolName = toolUseId ? input.toolUseNames.get(toolUseId) : undefined;
    if (!isWorkflowToolName(toolName)) continue;

    const output = parseWorkflowOutput(item.content)
      ?? parseWorkflowOutput(item.tool_use_result)
      ?? parseWorkflowOutput((input.message as Record<string, unknown>).tool_use_result);
    if (!output) continue;

    patches.push(compactPatch({
      sessionId: input.sessionId,
      taskId: output.taskId,
      taskType: output.taskType,
      workflowName: output.workflowName,
      runId: output.runId,
      source: "sdk-workflow-tool",
      status: "running",
      summary: output.summary,
      transcriptDir: output.transcriptDir,
      scriptPath: output.scriptPath,
      sessionUrl: output.sessionUrl,
      warning: output.warning,
      launchedAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  return patches;
}

function mapTaskStatus(status: string | undefined): WorkflowRunStatus | undefined {
  if (status === "completed" || status === "failed" || status === "killed" || status === "running") {
    return status;
  }
  if (status === "backgrounded" || status === "background") {
    return "backgrounded";
  }
  return undefined;
}

function classifyFailureKind(record: Record<string, unknown>): WorkflowRunPatch["failureKind"] {
  const text = [
    getString(record, "error"),
    getString(record, "summary"),
    getString(record, "description"),
    isRecord(record.patch) ? getString(record.patch, "error") : undefined,
  ].filter(Boolean).join("\n").toLowerCase();

  if (!text) return undefined;
  if (text.includes("permission") || text.includes("canusetool") || text.includes("denied")) return "permission_denied";
  if (text.includes("script") || text.includes("parse") || text.includes("syntax")) return "script_error";
  if (text.includes("agent")) return "agent_failed";
  if (text.includes("runtime") || text.includes("sdk") || text.includes("process")) return "runtime_error";
  return "unknown";
}

function extractTaskEventPatch(input: ExtractInput): WorkflowRunPatch[] {
  if (!isRecord(input.message) || input.message.type !== "system") {
    return [];
  }

  const subtype = getString(input.message, "subtype");
  if (
    subtype !== "task_started"
    && subtype !== "task_progress"
    && subtype !== "task_updated"
    && subtype !== "task_notification"
  ) {
    return [];
  }

  const taskId = getString(input.message, "task_id");
  if (!taskId) return [];

  const taskType = normalizeTaskType(getString(input.message, "task_type"));
  const workflowName = getString(input.message, "workflow_name");
  const isKnownWorkflowTask = input.knownWorkflowTaskIds?.has(taskId) ?? true;
  const isWorkflowStart = subtype === "task_started" && (taskType === "local_workflow" || Boolean(workflowName));
  if (!isWorkflowStart && !isKnownWorkflowTask) {
    return [];
  }

  const timestamp = getMessageTimestamp(input.message);
  const patch = isRecord(input.message.patch) ? input.message.patch : {};
  const patchStatus = isRecord(patch) ? mapTaskStatus(getString(patch, "status")) : undefined;
  const status: WorkflowRunStatus =
    subtype === "task_updated"
      ? patchStatus ?? "unknown"
      : subtype === "task_started" || subtype === "task_progress"
        ? "running"
        : "unknown";
  const summary =
    getString(input.message, "summary")
    ?? getString(input.message, "description")
    ?? getString(input.message, "prompt");
  const error = getString(input.message, "error") ?? (isRecord(patch) ? getString(patch, "error") : undefined);

  return [compactPatch({
    sessionId: input.sessionId,
    taskId,
    taskType,
    workflowName,
    source: subtype === "task_started" ? "slash-command" : undefined,
    status,
    summary,
    error,
    failureKind: status === "failed" ? classifyFailureKind(input.message) : undefined,
    launchedAt: subtype === "task_started" ? timestamp : undefined,
    updatedAt: timestamp,
    completedAt: status === "completed" || status === "failed" || status === "killed" ? timestamp : undefined,
  })];
}

export function extractWorkflowRunPatchesFromMessage(input: ExtractInput): WorkflowRunPatch[] {
  return [
    ...extractToolResultPatches(input),
    ...extractTaskEventPatch(input),
  ];
}

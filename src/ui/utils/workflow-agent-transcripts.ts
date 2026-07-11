import type { StreamMessage } from "../types.js";

export type WorkflowAgentStatus = "running" | "completed" | "failed" | "killed" | "unknown";
type WorkflowParentSessionStatus = "idle" | "running" | "completed" | "error";

export type WorkflowAgentSummary = {
  id: string;
  taskId: string;
  title: string;
  role: string;
  status: WorkflowAgentStatus;
  latestSummary: string;
  messageCount: number;
  toolCount: number;
  startedAt?: number;
  updatedAt?: number;
  transcript: StreamMessage[];
};

type MutableWorkflowAgentSummary = WorkflowAgentSummary & {
  toolUseId?: string;
  taskType?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getPatchStatus(record: Record<string, unknown>): WorkflowAgentStatus | undefined {
  const patch = record.patch;
  if (!isRecord(patch)) return undefined;
  const status = getString(patch, "status");
  if (status === "completed" || status === "failed" || status === "killed" || status === "running") {
    return status;
  }
  return undefined;
}

function getMessageTime(message: StreamMessage): number | undefined {
  const capturedAt = (message as { capturedAt?: unknown }).capturedAt;
  return typeof capturedAt === "number" ? capturedAt : undefined;
}

function getContentItems(message: StreamMessage): unknown[] {
  const envelope = message as { message?: unknown };
  if (!isRecord(envelope.message)) return [];
  const content = envelope.message.content;
  return Array.isArray(content) ? content : content ? [content] : [];
}

function countToolUses(messages: StreamMessage[]): number {
  return messages.reduce((total, message) => {
    if (message.type !== "assistant") return total;
    return total + getContentItems(message).filter((item) => isRecord(item) && item.type === "tool_use").length;
  }, 0);
}

function getParentToolUseId(message: StreamMessage): string | undefined {
  const parentToolUseId = (message as { parent_tool_use_id?: unknown }).parent_tool_use_id;
  return typeof parentToolUseId === "string" && parentToolUseId.trim() ? parentToolUseId.trim() : undefined;
}

function getMessageTaskId(message: StreamMessage): string | undefined {
  const taskId = (message as { task_id?: unknown }).task_id;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : undefined;
}

function getLinkedToolUseIds(message: StreamMessage): string[] {
  const ids: string[] = [];
  for (const item of getContentItems(message)) {
    if (!isRecord(item)) continue;
    if (item.type === "tool_use") {
      const id = getString(item, "id");
      if (id) ids.push(id);
    }
    if (item.type === "tool_result") {
      const id = getString(item, "tool_use_id");
      if (id) ids.push(id);
    }
  }
  return ids;
}

function isUnlinkedTaskFallbackMessage(message: StreamMessage): boolean {
  if (message.type !== "user") return false;
  const contentItems = getContentItems(message);
  return contentItems.length > 0
    && contentItems.every((item) => isRecord(item) && item.type === "tool_result");
}

function isTaskTranscriptSubtype(subtype: string | undefined) {
  return subtype === "task_started"
    || subtype === "task_progress"
    || subtype === "task_updated"
    || subtype === "task_notification";
}

function roleLabel(taskType?: string, workflowName?: string): string {
  if (workflowName) return workflowName;
  if (taskType === "sub_agent") return "Subagent";
  if (taskType === "local_workflow") return "Workflow";
  if (taskType === "background" || taskType === "background_task") return "Background task";
  return "Task";
}

export function buildWorkflowAgentSummaries(
  messages: StreamMessage[],
  parentSessionStatus?: WorkflowParentSessionStatus,
): WorkflowAgentSummary[] {
  const agents = new Map<string, MutableWorkflowAgentSummary>();
  const taskByToolUseId = new Map<string, string>();
  const hiddenTasks = new Set<string>();

  for (const message of messages) {
    if (message.type !== "system") continue;
    const record = message as unknown as Record<string, unknown>;
    const subtype = getString(record, "subtype");
    if (subtype !== "task_started" && subtype !== "task_progress" && subtype !== "task_updated") continue;

    const taskId = getString(record, "task_id");
    if (!taskId) continue;
    if (record.skip_transcript === true) {
      hiddenTasks.add(taskId);
      continue;
    }

    const existing = agents.get(taskId);
    const description = getString(record, "description");
    const summary = getString(record, "summary");
    const prompt = getString(record, "prompt");
    const taskType = getString(record, "task_type");
    const workflowName = getString(record, "workflow_name");
    const toolUseId = getString(record, "tool_use_id") ?? existing?.toolUseId;
    const timestamp = getMessageTime(message);

    if (toolUseId) taskByToolUseId.set(toolUseId, taskId);

    const next: MutableWorkflowAgentSummary = existing ?? {
      id: taskId,
      taskId,
      title: description ?? summary ?? workflowName ?? taskId.slice(0, 8),
      role: roleLabel(taskType, workflowName),
      status: "running",
      latestSummary: summary ?? description ?? prompt ?? "",
      messageCount: 0,
      toolCount: 0,
      startedAt: timestamp,
      updatedAt: timestamp,
      transcript: [],
      toolUseId,
      taskType,
    };

    if (description) next.title = description;
    if (workflowName || taskType) next.role = roleLabel(taskType, workflowName);
    if (summary || description || prompt) next.latestSummary = summary ?? description ?? prompt ?? next.latestSummary;
    if (timestamp) {
      next.startedAt = next.startedAt ?? timestamp;
      next.updatedAt = timestamp;
    }
    if (toolUseId) next.toolUseId = toolUseId;
    if (taskType) next.taskType = taskType;
    if (subtype === "task_updated") next.status = getPatchStatus(record) ?? next.status;
    if (subtype === "task_progress" && next.status === "unknown") next.status = "running";
    agents.set(taskId, next);
  }

  const activeTaskIds: string[] = [];
  const appended = new Map<string, Set<StreamMessage>>();
  const appendToAgent = (taskId: string | undefined, message: StreamMessage) => {
    if (!taskId) return false;
    const agent = agents.get(taskId);
    if (!agent) return false;
    const seen = appended.get(taskId) ?? new Set<StreamMessage>();
    if (seen.has(message)) return true;
    seen.add(message);
    appended.set(taskId, seen);
    agent.transcript.push(message);
    return true;
  };

  for (const message of messages) {
    if (message.type === "system") {
      const record = message as unknown as Record<string, unknown>;
      const subtype = getString(record, "subtype");
      const taskId = getString(record, "task_id");
      if (!taskId || hiddenTasks.has(taskId)) continue;
      if (isTaskTranscriptSubtype(subtype)) {
        appendToAgent(taskId, message);
      }
      if (subtype === "task_started") {
        if (!activeTaskIds.includes(taskId)) activeTaskIds.push(taskId);
        continue;
      }
      if (subtype === "task_updated") {
        const status = getPatchStatus(record);
        if (status === "completed" || status === "failed" || status === "killed") {
          const index = activeTaskIds.indexOf(taskId);
          if (index >= 0) activeTaskIds.splice(index, 1);
        }
      }
      continue;
    }

    if (appendToAgent(getMessageTaskId(message), message)) {
      continue;
    }

    const parentToolUseId = getParentToolUseId(message);
    if (appendToAgent(parentToolUseId ? taskByToolUseId.get(parentToolUseId) : undefined, message)) {
      continue;
    }

    const linkedTaskId = getLinkedToolUseIds(message)
      .map((id) => taskByToolUseId.get(id))
      .find((taskId): taskId is string => Boolean(taskId));
    if (appendToAgent(linkedTaskId, message)) {
      continue;
    }

    if (activeTaskIds.length === 1 && isUnlinkedTaskFallbackMessage(message)) {
      appendToAgent(activeTaskIds[0], message);
    }
  }

  const fallbackStatus = getTerminalFallbackStatus(parentSessionStatus);

  return Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    taskId: agent.taskId,
    title: agent.title,
    role: agent.role,
    status: agent.status === "running" && agent.taskType !== "local_workflow" && fallbackStatus
      ? fallbackStatus
      : agent.status,
    latestSummary: agent.latestSummary,
    messageCount: agent.transcript.length,
    toolCount: countToolUses(agent.transcript),
    startedAt: agent.startedAt,
    updatedAt: agent.updatedAt,
    transcript: agent.transcript,
  }));
}

function getTerminalFallbackStatus(status: WorkflowParentSessionStatus | undefined): WorkflowAgentStatus | undefined {
  if (status === "completed") return "completed";
  if (status === "error") return "failed";
  if (status === "idle") return "killed";
  return undefined;
}

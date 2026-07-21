import type { StreamMessage } from "../types.js";

export type WorkflowAgentStatus = "running" | "paused" | "completed" | "failed" | "killed" | "stopped" | "unknown";
type WorkflowParentSessionStatus = "idle" | "running" | "completed" | "error";

export type WorkflowAgentSummary = {
  id: string;
  taskId: string;
  title: string;
  role: string;
  agentType?: string;
  taskPrompt?: string;
  status: WorkflowAgentStatus;
  latestSummary: string;
  messageCount: number;
  toolCount: number;
  startedAt?: number;
  updatedAt?: number;
  parentAgentId?: string;
  depth?: number;
  transcript: StreamMessage[];
};

export type WorkflowAgentTranscriptView = {
  messages: StreamMessage[];
  statusEventCount: number;
  latestProgress: string;
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
  if (status === "completed" || status === "failed" || status === "killed" || status === "running" || status === "paused") {
    return status;
  }
  return undefined;
}

function getNotificationStatus(record: Record<string, unknown>): WorkflowAgentStatus | undefined {
  const status = getString(record, "status");
  if (status === "completed" || status === "failed") return status;
  if (status === "stopped") return "stopped";
  return undefined;
}

function getTaskStatus(record: Record<string, unknown>, subtype: string | undefined): WorkflowAgentStatus | undefined {
  if (subtype === "task_updated") return getPatchStatus(record);
  if (subtype === "task_notification") return getNotificationStatus(record);
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

function getParentAgentId(message: StreamMessage): string | undefined {
  const parentAgentId = (message as { parent_agent_id?: unknown }).parent_agent_id;
  return typeof parentAgentId === "string" && parentAgentId.trim() ? parentAgentId.trim() : undefined;
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
  return subtype === "task_progress"
    || subtype === "task_updated"
    || subtype === "task_notification";
}

function isTaskStatusSubtype(subtype: string | undefined) {
  return subtype === "task_started" || isTaskTranscriptSubtype(subtype);
}

function getTaskStatusText(record: Record<string, unknown>): string | undefined {
  const patch = isRecord(record.patch) ? record.patch : undefined;
  return getString(record, "summary")
    ?? getString(record, "description")
    ?? (patch ? getString(patch, "description") : undefined)
    ?? (patch ? getString(patch, "error") : undefined);
}

function getSubagentRetryText(message: StreamMessage): string | undefined {
  if (message.type !== "tool_progress") return undefined;
  const retry = (message as { subagent_retry?: unknown }).subagent_retry;
  if (!isRecord(retry)) return undefined;
  const attempt = typeof retry.attempt === "number" ? retry.attempt : undefined;
  const maxRetries = typeof retry.max_retries === "number" ? retry.max_retries : undefined;
  const retryDelayMs = typeof retry.retry_delay_ms === "number" ? retry.retry_delay_ms : undefined;
  if (attempt === undefined || maxRetries === undefined) return "子智能体正在重试";
  const delay = retryDelayMs === undefined ? "" : `，等待 ${(retryDelayMs / 1000).toFixed(1)} 秒`;
  return `子智能体重试 ${attempt}/${maxRetries}${delay}`;
}

function normalizeTaskTitle(title: string): string {
  const separatorIndex = title.indexOf(":");
  if (separatorIndex < 1) return title;

  const prefix = title.slice(0, separatorIndex).trim().toLowerCase();
  const detail = title.slice(separatorIndex + 1).trim();
  return detail.toLowerCase().startsWith(`${prefix}:`) ? detail : title;
}

function normalizeTaskType(taskType?: string): string | undefined {
  return taskType?.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const WORKFLOW_AGENT_PROMPT_PATTERNS = [
  /(?:agent\s*\(\s*|prompt\s*:\s*)String\.raw`((?:\\`|[^`])*)`/gs,
  /agent\s*\(\s*`((?:\\`|[^`])*)`/gs,
];

function getDisplayTaskPrompt(prompt: string, taskType?: string, workflowName?: string): string {
  if (normalizeTaskType(taskType) !== "local_workflow" && !workflowName) return prompt;

  const prompts: string[] = [];
  const seen = new Set<string>();
  for (const pattern of WORKFLOW_AGENT_PROMPT_PATTERNS) {
    for (const match of prompt.matchAll(pattern)) {
      const value = match[1]?.replace(/\\`/g, "`").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      prompts.push(value);
    }
  }
  return prompts.join("\n\n") || prompt;
}

function roleLabel(taskType?: string, workflowName?: string): string {
  const normalizedTaskType = normalizeTaskType(taskType);
  if (normalizedTaskType === "local_agent" || normalizedTaskType === "remote_agent") return "Agent";
  if (normalizedTaskType === "sub_agent") return "Subagent";
  if (normalizedTaskType === "local_workflow" || workflowName) return "Workflow";
  if (
    normalizedTaskType === "local_bash"
    || normalizedTaskType === "background"
    || normalizedTaskType === "background_task"
  ) return "Background task";
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
    if (subtype === "init") {
      continue;
    }
    if (subtype === "background_tasks_changed") {
      // This is a per-process level signal. Its IDs must not be correlated
      // with task_started/task_notification edge events.
      continue;
    }
    if (
      subtype !== "task_started"
      && subtype !== "task_progress"
      && subtype !== "task_updated"
      && subtype !== "task_notification"
    ) continue;

    const taskId = getString(record, "task_id");
    if (!taskId) continue;
    if (record.skip_transcript === true) {
      hiddenTasks.add(taskId);
      continue;
    }

    const existing = agents.get(taskId);
    const patch = isRecord(record.patch) ? record.patch : undefined;
    const description = getString(record, "description") ?? (patch ? getString(patch, "description") : undefined);
    const displayDescription = description ? normalizeTaskTitle(description) : undefined;
    const summary = getString(record, "summary");
    const taskType = getString(record, "task_type");
    const workflowName = getString(record, "workflow_name");
    const agentType = getString(record, "subagent_type") ?? existing?.agentType;
    const prompt = getString(record, "prompt");
    const toolUseId = getString(record, "tool_use_id") ?? existing?.toolUseId;
    const parentAgentId = getString(record, "parent_agent_id") ?? existing?.parentAgentId;
    const timestamp = getMessageTime(message);

    if (toolUseId) taskByToolUseId.set(toolUseId, taskId);

    const next: MutableWorkflowAgentSummary = existing ?? {
      id: taskId,
      taskId,
      title: displayDescription ?? summary ?? workflowName ?? taskId.slice(0, 8),
      role: roleLabel(taskType, workflowName),
      agentType,
      taskPrompt: prompt ? getDisplayTaskPrompt(prompt, taskType, workflowName) : undefined,
      status: "running",
      latestSummary: summary ?? displayDescription ?? "",
      messageCount: 0,
      toolCount: 0,
      startedAt: timestamp,
      updatedAt: timestamp,
      transcript: [],
      depth: 1,
      parentAgentId,
      toolUseId,
      taskType,
    };

    if (displayDescription && subtype === "task_started") next.title = displayDescription;
    if (workflowName || taskType) next.role = roleLabel(taskType, workflowName);
    if (agentType) next.agentType = agentType;
    if (prompt) next.taskPrompt = getDisplayTaskPrompt(prompt, taskType ?? next.taskType, workflowName);
    if (summary || displayDescription) next.latestSummary = summary ?? displayDescription ?? next.latestSummary;
    if (timestamp) {
      next.startedAt = next.startedAt ?? timestamp;
      next.updatedAt = timestamp;
    }
    if (toolUseId) next.toolUseId = toolUseId;
    if (taskType) next.taskType = taskType;
    if (parentAgentId) next.parentAgentId = parentAgentId;
    next.status = getTaskStatus(record, subtype) ?? next.status;
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
      if (subtype === "task_updated" || subtype === "task_notification") {
        const status = getTaskStatus(record, subtype);
        if (status === "running") {
          if (!activeTaskIds.includes(taskId)) activeTaskIds.push(taskId);
        } else if (status === "completed" || status === "failed" || status === "killed" || status === "stopped") {
          const index = activeTaskIds.indexOf(taskId);
          if (index >= 0) activeTaskIds.splice(index, 1);
        }
      }
      continue;
    }

    if (appendToAgent(getMessageTaskId(message), message)) {
      const taskId = getMessageTaskId(message);
      const parentAgentId = getParentAgentId(message);
      const agent = taskId ? agents.get(taskId) : undefined;
      if (agent && parentAgentId) agent.parentAgentId = parentAgentId;
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

  const getDepth = (agent: MutableWorkflowAgentSummary): number => {
    let depth = 1;
    let parentAgentId = agent.parentAgentId;
    const visited = new Set([agent.id]);
    while (parentAgentId && !visited.has(parentAgentId) && depth < 8) {
      visited.add(parentAgentId);
      depth += 1;
      parentAgentId = agents.get(parentAgentId)?.parentAgentId;
    }
    return depth;
  };

  return Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    taskId: agent.taskId,
    title: agent.title,
    role: agent.role,
    agentType: agent.agentType,
    taskPrompt: agent.taskPrompt,
    status: agent.status === "running" && agent.taskType !== "local_workflow" && fallbackStatus
      ? fallbackStatus
      : agent.status,
    latestSummary: agent.latestSummary,
    messageCount: agent.transcript.length,
    toolCount: countToolUses(agent.transcript),
    startedAt: agent.startedAt,
    updatedAt: agent.updatedAt,
    parentAgentId: agent.parentAgentId,
    depth: getDepth(agent),
    transcript: agent.transcript,
  }));
}

export function buildWorkflowAgentTranscriptView(
  agent: WorkflowAgentSummary,
): WorkflowAgentTranscriptView {
  const messages: StreamMessage[] = [];
  let statusEventCount = 0;
  let latestProgress = "";

  for (const message of agent.transcript) {
    const retryText = getSubagentRetryText(message);
    if (retryText) {
      statusEventCount += 1;
      latestProgress = retryText;
      continue;
    }
    if (message.type === "system") {
      const record = message as unknown as Record<string, unknown>;
      if (isTaskStatusSubtype(getString(record, "subtype"))) {
        statusEventCount += 1;
        latestProgress = getTaskStatusText(record) ?? latestProgress;
        continue;
      }
    }
    messages.push(message);
  }

  return {
    messages,
    statusEventCount,
    latestProgress: latestProgress || agent.latestSummary,
  };
}

function getTerminalFallbackStatus(status: WorkflowParentSessionStatus | undefined): WorkflowAgentStatus | undefined {
  if (status === "completed") return "completed";
  if (status === "error") return "failed";
  if (status === "idle") return "killed";
  return undefined;
}

import { TASK_TOOL_NAMES } from "./claude-agent-teams.js";

export type PlanStepStatus = "pending" | "in_progress" | "completed";

export type PlanItemArg = {
  step: string;
  status: PlanStepStatus;
};

export type UpdatePlanArgs = {
  explanation?: string;
  plan: PlanItemArg[];
};

export type SessionPlanSource = "update_plan" | "task_create";

export type SessionPlanSnapshot = UpdatePlanArgs & {
  sessionId: string;
  turnId?: string;
  updatedAt: number;
  source: SessionPlanSource;
  toolName?: string;
  toolUseId?: string;
};

export function hasIncompletePlan(plan: readonly PlanItemArg[] | undefined): boolean {
  return Boolean(plan?.some((item) => item.status !== "completed"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePlanStepStatus(value: unknown): PlanStepStatus | null {
  if (value === "pending") return "pending";
  if (value === "in_progress" || value === "inProgress") return "in_progress";
  if (value === "completed" || value === "complete" || value === "done") return "completed";
  return null;
}

function normalizePlanItem(input: unknown, fallbackIndex: number): PlanItemArg | null {
  if (!isRecord(input)) return null;

  const rawStep =
    input.step ??
    input.content ??
    input.text ??
    input.title ??
    input.name ??
    `Step ${fallbackIndex + 1}`;
  const step = typeof rawStep === "string" ? rawStep.trim() : String(rawStep).trim();
  if (!step) return null;

  const status = normalizePlanStepStatus(input.status) ?? "pending";
  return { step, status };
}

export function normalizeUpdatePlanArgs(input: unknown): UpdatePlanArgs | null {
  if (!isRecord(input) || !Array.isArray(input.plan)) return null;

  const plan = input.plan
    .map((item, index) => normalizePlanItem(item, index))
    .filter((item): item is PlanItemArg => Boolean(item));
  if (plan.length === 0) return null;

  const explanation = typeof input.explanation === "string" && input.explanation.trim()
    ? input.explanation.trim()
    : undefined;

  return { explanation, plan };
}

export function normalizeTaskCreateArgs(input: unknown): UpdatePlanArgs | null {
  if (!isRecord(input)) return null;

  const items = Array.isArray(input.items)
    ? input.items
    : Array.isArray(input.plan)
      ? input.plan
      : isRecord(input.item)
        ? [input.item]
        : [];

  const plan = items
    .map((item, index) => normalizePlanItem(item, index))
    .filter((item): item is PlanItemArg => Boolean(item));
  if (plan.length === 0) return null;

  return { plan };
}

export function extractPlanSnapshotFromMessage(
  sessionId: string,
  message: unknown,
): SessionPlanSnapshot | null {
  if (!isRecord(message) || message.type !== "assistant" || !isRecord(message.message)) return null;
  const content = Array.isArray(message.message.content) ? message.message.content : [];
  let snapshot: SessionPlanSnapshot | null = null;

  for (const item of content) {
    if (!isRecord(item) || item.type !== "tool_use") continue;
    const toolName = typeof item.name === "string" ? item.name : "";
    const toolUseId = typeof item.id === "string" ? item.id : undefined;
    const turnId = typeof message.uuid === "string" ? message.uuid : undefined;
    const updatedAt = typeof message.capturedAt === "number" ? message.capturedAt : Date.now();

    if (toolName === "update_plan" || toolName.endsWith("__update_plan") || toolName.endsWith(":update_plan") || toolName.endsWith("/update_plan")) {
      const args = normalizeUpdatePlanArgs(item.input);
      if (args) snapshot = { sessionId, turnId, updatedAt, source: "update_plan", toolName, toolUseId, ...args };
      continue;
    }

    if ((TASK_TOOL_NAMES as readonly string[]).includes(toolName)) {
      const input = toolName === "TaskUpdate" ? { item: item.input } : item.input;
      const args = normalizeTaskCreateArgs(input);
      if (args) snapshot = { sessionId, turnId, updatedAt, source: "task_create", toolName, toolUseId, ...args };
    }
  }

  return snapshot;
}

export function deriveLatestPlanSnapshot(
  sessionId: string,
  messages: readonly unknown[],
  fallback?: SessionPlanSnapshot,
): SessionPlanSnapshot | undefined {
  return messages.reduce<SessionPlanSnapshot | undefined>((latest, message) => (
    extractPlanSnapshotFromMessage(sessionId, message) ?? latest
  ), fallback);
}

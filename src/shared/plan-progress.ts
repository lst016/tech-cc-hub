export type PlanStepStatus = "pending" | "in_progress" | "completed";

export type PlanItemArg = {
  step: string;
  status: PlanStepStatus;
};

export type UpdatePlanArgs = {
  explanation?: string;
  plan: PlanItemArg[];
};

export type SessionPlanSource = "update_plan" | "todo_write";

export type SessionPlanSnapshot = UpdatePlanArgs & {
  sessionId: string;
  turnId?: string;
  updatedAt: number;
  source: SessionPlanSource;
  toolName?: string;
  toolUseId?: string;
};

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

export function normalizeTodoWriteArgs(input: unknown): UpdatePlanArgs | null {
  if (!isRecord(input)) return null;

  const items = Array.isArray(input.todos)
    ? input.todos
    : Array.isArray(input.items)
      ? input.items
      : Array.isArray(input.plan)
        ? input.plan
        : [];

  const plan = items
    .map((item, index) => normalizePlanItem(item, index))
    .filter((item): item is PlanItemArg => Boolean(item));
  if (plan.length === 0) return null;

  return { plan };
}

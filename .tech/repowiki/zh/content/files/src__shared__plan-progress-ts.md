# src/shared/plan-progress.ts

> 模块：`shared` · 语言：`typescript` · 行数：85

## 文件职责

标准化来自 update_plan 和 todo_write 工具的输出，构建会话计划快照

## 关键符号

- `SessionPlanSnapshot@0 - 会话计划快照：包含 sessionId、plan 步骤数组、source、updatedAt`
- `normalizeUpdatePlanArgs@0 - 标准化 update_plan 工具参数`
- `normalizeTodoWriteArgs@0 - 标准化 todo_write 工具参数，支持 todos/items/plan 字段兼容`

## 对外暴露

- `PlanStepStatus`
- `PlanItemArg`
- `UpdatePlanArgs`
- `SessionPlanSource`
- `SessionPlanSnapshot`
- `normalizePlanStepStatus`
- `normalizeUpdatePlanArgs`
- `normalizeTodoWriteArgs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```

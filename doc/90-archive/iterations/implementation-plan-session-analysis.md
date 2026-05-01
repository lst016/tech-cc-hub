---
doc_id: "PRD-100-63"
title: "会话执行分析与右栏增强 Implementation Plan"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-20"
owners:
  - "Product"
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "delivery"
  - "plan"
  - "analysis"
  - "activity-rail"
---

# 会话执行分析与右栏增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先完成右侧执行轨迹的双轨 Step 增强与数据对象拆分，为后续单会话分析页、人工标注和 AI 调优记录打好底座。

**Architecture:** 保留 `sessions/messages` 作为唯一事实源，在共享模型层新增 `plan steps` 与 `execution steps` 的双轨投影，再由右侧 UI 消费这些新对象。首批实现只做右栏增强和模型层扩展，不在本轮引入完整数据库表与独立分析页路由。

**Tech Stack:** Electron 39、React 19、TypeScript 5.9、Zustand、Node test、better-sqlite3

---

### Task 1: 扩展共享模型为双轨 Step 投影

**Files:**
- Modify: `src/shared/activity-rail-model.ts`
- Test: `src/electron/activity-rail-model.test.ts`

- [ ] **Step 1: 写失败测试，描述 plan/execution 双轨对象**

```ts
test("buildActivityRailModel exposes plan steps separately from execution steps", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-split",
      title: "Trace Session",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "修复右栏并验证",
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. 检查现状\n2. 修改组件\n3. 运行构建验证",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "assistant",
          capturedAt: 1100,
          uuid: "assistant-read",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-read",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-read", name: "Read", input: { file_path: "src/ui/components/ActivityRail.tsx" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 1400,
          uuid: "user-read",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-read", content: "file content", is_error: false },
            ],
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSteps.length, 3);
  assert.equal(model.executionSteps.length, 1);
  assert.equal(model.planSteps[0]?.indexLabel, "Step 1");
  assert.equal(model.executionSteps[0]?.title, "检查现状");
  assert.deepEqual(model.executionSteps[0]?.planStepIds, [model.planSteps[0]?.id]);
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm run transpile:electron`

Run: `node --test src/electron/activity-rail-model.test.ts`

Expected: FAIL，报错指出 `planSteps` / `executionSteps` 字段不存在，或断言长度不匹配。

- [ ] **Step 3: 最小实现双轨 Step 类型和投影**

```ts
export type ActivityPlanStepStatus = "pending" | "running" | "completed" | "drifted";

export type ActivityPlanStep = {
  id: string;
  index: number;
  indexLabel: string;
  title: string;
  detail: string;
  round: number;
  status: ActivityPlanStepStatus;
  sourceTimelineId: string;
  executionStepIds: string[];
};

export type ActivityExecutionStep = {
  id: string;
  title: string;
  detail: string;
  round: number;
  kind: ActivityStageKind;
  status: ActivityTaskStepStatus;
  timelineIds: string[];
  sourceTimelineId: string;
  planStepIds: string[];
  metrics: ActivityExecutionMetrics;
};

type ParsedPlan = {
  round: number;
  sequence: number;
  sourceTimelineId: string;
  planSteps: ActivityPlanStep[];
};
```

```ts
function assignTimelineToExecutionSteps(
  timelineChronological: ActivityTimelineItem[],
  parsedPlan: ParsedPlan | null,
  sessionStatus: SessionLike["status"],
): { executionSteps: ActivityExecutionStep[]; planSteps: ActivityPlanStep[] } {
  if (!parsedPlan) {
    return { executionSteps: [], planSteps: [] };
  }

  const planSteps = parsedPlan.planSteps.map((step) => ({
    ...step,
    executionStepIds: [],
    status: "pending" as ActivityPlanStepStatus,
  }));

  const executionSteps = parsedPlan.planSteps.map((step) => ({
    id: `${step.id}-execution`,
    title: step.title,
    detail: step.detail,
    round: step.round,
    kind: classifyStageKindFromText(step.title),
    status: "pending" as ActivityTaskStepStatus,
    timelineIds: [] as string[],
    sourceTimelineId: step.sourceTimelineId,
    planStepIds: [step.id],
    metrics: createEmptyMetrics(),
  }));

  // 后续循环里沿用当前的 timeline -> step 分配逻辑
  return { executionSteps, planSteps };
}
```

- [ ] **Step 4: 跑测试，确认新模型通过**

Run: `npm run transpile:electron`

Run: `node --test src/electron/activity-rail-model.test.ts`

Expected: PASS，新增双轨 Step 测试通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts
git commit -m "feat(activity-rail): split plan and execution steps"
```

### Task 2: 让右侧 UI 真正展示双轨 Step

**Files:**
- Modify: `src/ui/components/ActivityRail.tsx`
- Test: `src/electron/activity-rail-model.test.ts`

- [ ] **Step 1: 写失败测试，约束右栏模型文案和映射数据**

```ts
test("buildActivityRailModel exposes labels for plan and execution sections", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-sections",
      title: "Trace Session",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "修复右栏并验证",
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. 检查现状\n2. 修改组件\n3. 运行构建验证",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSectionTitle, "AI 计划步骤");
  assert.equal(model.executionSectionTitle, "实际执行步骤");
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm run transpile:electron`

Run: `node --test src/electron/activity-rail-model.test.ts`

Expected: FAIL，报错指出 section title 字段缺失。

- [ ] **Step 3: 以最小改动改造右栏组件结构**

```tsx
function PlanStepCard({
  step,
  active,
  onClick,
}: {
  step: ActivityPlanStep;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-2xl border p-3 text-left transition",
        active
          ? "border-info/25 bg-info-light/55 shadow-sm"
          : "border-black/5 bg-white/70 hover:border-black/10 hover:bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-info">{step.indexLabel}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClasses(step.status === "completed" ? "success" : step.status === "running" ? "info" : step.status === "drifted" ? "warning" : "neutral")}`}>
          {PLAN_STEP_STATUS_LABELS[step.status]}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold text-ink-900">{step.title}</div>
      <div className="mt-2 text-[11px] text-ink-500">映射执行步骤 {step.executionStepIds.length}</div>
    </button>
  );
}
```

```tsx
<section className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-sm font-semibold text-ink-900">{model.planSectionTitle}</h2>
    <span className="text-[11px] text-ink-500">{model.planSteps.length} 步</span>
  </div>
  <div className="space-y-2">
    {model.planSteps.map((step) => (
      <PlanStepCard
        key={step.id}
        step={step}
        active={selectedPlanStepId === step.id}
        onClick={() => setSelectedPlanStepId(step.id)}
      />
    ))}
  </div>
</section>

<section className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-sm font-semibold text-ink-900">{model.executionSectionTitle}</h2>
    <span className="text-[11px] text-ink-500">{model.executionSteps.length} 步</span>
  </div>
  <div className="space-y-2">
    {model.executionSteps.map((step) => (
      <TaskStepCard
        key={step.id}
        step={step}
        active={selectedExecutionStepId === step.id}
        onClick={() => setSelectedExecutionStepId(step.id)}
      />
    ))}
  </div>
</section>
```

- [ ] **Step 4: 跑测试与编译，确认 UI 改造不破坏现有模型**

Run: `npm run transpile:electron`

Run: `npm run build`

Expected: 两条命令都 exit 0。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/components/ActivityRail.tsx src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts
git commit -m "feat(activity-rail): render dual-track step sections"
```

### Task 3: 为后续标注与会话分析页铺底对象

**Files:**
- Modify: `src/shared/activity-rail-model.ts`
- Modify: `src/ui/components/ActivityRail.tsx`
- Test: `src/electron/activity-rail-model.test.ts`

- [ ] **Step 1: 写失败测试，要求 execution step 暴露后续操作所需字段**

```ts
test("execution steps expose plan mapping and stable ids for follow-up actions", () => {
  const model = buildActivityRailModel(
    {
      id: "session-follow-up",
      title: "Trace Session",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "修复右栏并验证",
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. 检查现状\n2. 修改组件\n3. 运行构建验证",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  const executionStep = model.executionSteps[0];
  assert.ok(executionStep?.id);
  assert.ok(Array.isArray(executionStep?.planStepIds));
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm run transpile:electron`

Run: `node --test src/electron/activity-rail-model.test.ts`

Expected: FAIL，直到 `executionSteps` 暴露稳定映射字段。

- [ ] **Step 3: 为 UI 预留动作位和跳转位，但不做完整逻辑**

```tsx
function StepActionBar() {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] text-ink-600">
        标记
      </button>
      <button type="button" className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] text-ink-600">
        备注
      </button>
      <button type="button" className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] text-ink-600">
        AI 调优
      </button>
    </div>
  );
}
```

```tsx
<div className="mt-3 text-[11px] text-ink-500">
  对应计划步骤 {step.planStepIds.length}
</div>
<StepActionBar />
```

- [ ] **Step 4: 跑构建与测试，确认铺底改动稳定**

Run: `npm run transpile:electron`

Run: `npm run build`

Expected: 两条命令都 exit 0。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/shared/activity-rail-model.ts src/ui/components/ActivityRail.tsx src/electron/activity-rail-model.test.ts
git commit -m "refactor(activity-rail): prepare follow-up action hooks"
```

### Task 4: 最终回归验证

**Files:**
- Verify only

- [ ] **Step 1: 运行共享模型测试**

Run: `npm run transpile:electron`

Run: `node --test src/electron/activity-rail-model.test.ts`

Expected: PASS。

- [ ] **Step 2: 运行构建**

Run: `npm run build`

Expected: PASS。

- [ ] **Step 3: 做 Electron 级人工验证准备**

Run: `npm run dev`

Expected: Electron 真窗口可打开，右侧能看到 `AI 计划步骤` 和 `实际执行步骤` 两块区域。

- [ ] **Step 4: 记录人工验收点**

```md
- 右侧顶部摘要是否仍为单行指标
- AI 原始 Step 1/2/3/4/5 是否独立展示
- 实际执行步骤是否与节点联动
- 原始输入 / 原始返回是否可读
- 右侧详情抽屉是否仍在右侧而不是底部
```

- [ ] **Step 5: 整理并提交**

```bash
git add src/shared/activity-rail-model.ts src/ui/components/ActivityRail.tsx src/electron/activity-rail-model.test.ts doc/40-product/1.0.0/40-delivery/63-实施计划-会话执行分析与右栏增强.md
git commit -m "feat(activity-rail): add dual-track execution view"
```

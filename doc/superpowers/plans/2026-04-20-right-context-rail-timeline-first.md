---
doc_id: "SP-001"
title: "Right Context Rail Timeline-First Implementation Plan"
doc_type: "delivery"
layer: "L3"
status: "active"
version: "1.0.0"
last_updated: "2026-04-20"
owners:
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "superpowers"
  - "plan"
  - "activity-rail"
  - "timeline"
---

# Right Context Rail Timeline-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current metric-heavy right rail with a timeline-first execution analysis rail that surfaces live trace, selected-step detail, and compact analysis insights.

**Architecture:** Extract a pure right-rail view-model builder from the current `ActivityRail` message-walking logic so we can test the trace semantics independently from React. Then rebuild the UI around that model with timeline-first sections: summary strip, filters, live timeline, selected-step detail, and compact analysis insights.

**Tech Stack:** React 19, TypeScript, Zustand session state, Claude Agent SDK message types, Node test runner for pure model tests, Electron real-window QA.

---

### Task 1: Lock The Timeline-First View Model

**Files:**
- Create: `src/shared/activity-rail-model.ts`
- Create: `src/electron/activity-rail-model.test.ts`
- Modify: `src/ui/components/ActivityRail.tsx`

- [ ] **Step 1: Write the failing test**

```ts
test("buildActivityRailModel prioritizes trace items and attention signals", () => {
  const model = buildActivityRailModel(
    {
      id: "session-1",
      title: "Trace Session",
      status: "completed",
      cwd: "D:/workspace/demo",
      messages: [
        { type: "user_prompt", prompt: "analyze this image", attachments: [{ id: "img-1", kind: "image", name: "banana.png", mimeType: "image/png", data: "data:image/png;base64,AAAA" }] },
        {
          type: "assistant",
          uuid: "assistant-1",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-1",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "README.md" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null },
          },
        } as never,
        {
          type: "user",
          uuid: "user-1",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-1", content: "ENOENT", is_error: true },
            ],
          },
        } as never,
        {
          type: "result",
          uuid: "result-1",
          session_id: "remote-1",
          subtype: "success",
          duration_ms: 3900,
          duration_api_ms: 3200,
          total_cost_usd: 0.0123,
          usage: { input_tokens: 5392, output_tokens: 120, cache_creation_input_tokens: null, cache_read_input_tokens: 0 },
          result: "The image says BANANA.",
        } as never,
      ],
    },
    [{ toolUseId: "perm-1", toolName: "Bash", input: { command: "rm -rf tmp" } }],
    "BANANA",
  );

  assert.equal(model.timeline[0]?.title, "等待人工确认 Bash");
  assert.equal(model.filters.attention, 2);
  assert.equal(model.summary.latestResultLabel, "已完成");
  assert.equal(model.analysisCards[0]?.title, "当前阻塞");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run transpile:electron && node --test dist-electron/electron/activity-rail-model.test.js`
Expected: FAIL because `buildActivityRailModel` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildActivityRailModel(session, permissionRequests, partialMessage) {
  return {
    summary: { latestResultLabel: "已完成" },
    filters: { all: 0, attention: 0, tool: 0, context: 0, result: 0, flow: 0 },
    timeline: [],
    selectedTimelineId: null,
    detail: null,
    analysisCards: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run transpile:electron && node --test dist-electron/electron/activity-rail-model.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts
git commit -m "feat: add timeline-first activity rail model"
```

### Task 2: Rebuild ActivityRail Around Timeline + Detail + Analysis

**Files:**
- Modify: `src/ui/components/ActivityRail.tsx`
- Reuse: `src/shared/activity-rail-model.ts`

- [ ] **Step 1: Write the failing UI expectation into the model test**

```ts
assert.equal(model.primarySectionTitle, "实时执行轨迹");
assert.equal(model.detailCardTitle, "步骤详情");
assert.equal(model.analysisSectionTitle, "分析洞察");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run transpile:electron && node --test dist-electron/electron/activity-rail-model.test.js`
Expected: FAIL because the new section labels are missing.

- [ ] **Step 3: Write minimal UI implementation**

```tsx
export function ActivityRail({ session, partialMessage, globalError }) {
  const model = useMemo(
    () => buildActivityRailModel(session, session?.permissionRequests ?? [], partialMessage),
    [session, partialMessage],
  );

  return (
    <aside>
      <section>{model.primarySectionTitle}</section>
      <section>{model.timeline.map((item) => <button key={item.id}>{item.title}</button>)}</section>
      <section>{model.detailCardTitle}</section>
      <section>{model.analysisSectionTitle}</section>
    </aside>
  );
}
```

- [ ] **Step 4: Run build to verify the rail renders with the new structure**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ActivityRail.tsx src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts
git commit -m "feat: redesign right rail as timeline-first"
```

### Task 3: Verify Real-Window Behavior

**Files:**
- Verify only: `src/ui/components/ActivityRail.tsx`
- Verify only: `src/shared/activity-rail-model.ts`

- [ ] **Step 1: Run focused regression checks**

Run: `npm run transpile:electron`
Expected: PASS

- [ ] **Step 2: Run the pure model regression tests**

Run: `node --test dist-electron/electron/activity-rail-model.test.js dist-electron/electron/attachments.test.js dist-electron/electron/runner-attachments.test.js dist-electron/electron/stateless-continuation.test.js dist-electron/electron/csp.test.js dist-electron/electron/pathResolverCore.test.js`
Expected: PASS

- [ ] **Step 3: Run lint and production build**

Run: `npx eslint src/ui/components/ActivityRail.tsx src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Run real Electron window QA**

Run: start Electron, select a session, and verify the right rail shows:
- live timeline by default
- filter chips
- selected-step detail
- compact analysis cards instead of metric-dashboard-first layout

Expected: The right rail reads as execution trace analysis, not as a BI metric panel.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ActivityRail.tsx src/shared/activity-rail-model.ts src/electron/activity-rail-model.test.ts docs/superpowers/plans/2026-04-20-right-context-rail-timeline-first.md
git commit -m "feat: ship timeline-first right context rail"
```

# Sidebar Plan Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current conversation plan as a reference-style checklist popover from each eligible chat-list status indicator.

**Architecture:** Keep the existing `SessionView.latestPlan` pipeline unchanged. Add a pure UI model utility for counts and labels, a portal-based preview component for rendering, and minimal hover/focus state in `Sidebar`; add a query-flagged dev-shim fixture so Playwright can verify the actual rendered interaction.

**Tech Stack:** React 19, TypeScript, ReactDOM portals, Tailwind CSS, Node test runner, Playwright, Vite development shim.

---

## File Structure

- Create `src/ui/utils/session-plan-preview.ts`: pure progress summary and accessible-label helpers.
- Create `src/ui/components/SessionPlanPreview.tsx`: portal card, status icons, positioning, and checklist semantics.
- Modify `src/ui/components/Sidebar.tsx`: trigger state, hover/focus grace period, Escape handling, and preview mounting.
- Modify `src/ui/dev-electron-shim.ts`: deterministic `?qaPlanPreview=1` session/plan fixture.
- Create `test/electron/session-plan-preview.test.ts`: pure behavior regression tests.
- Create `test/electron/session-plan-preview-ui-source.test.ts`: source contract test for portal and accessibility wiring.
- Create `scripts/qa/sidebar-plan-preview-smoke.cjs`: browser interaction and screenshot verification.
- Modify `package.json`: expose the targeted visual smoke command.

### Task 1: Lock Plan Summary Semantics

**Files:**
- Create: `test/electron/session-plan-preview.test.ts`
- Create: `src/ui/utils/session-plan-preview.ts`

- [ ] **Step 1: Write the failing summary tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionPlanPreviewSummary } from "../../src/ui/utils/session-plan-preview.js";

test("summarizes completed, active, and pending plan steps", () => {
  const summary = buildSessionPlanPreviewSummary({
    sessionId: "session-1",
    source: "update_plan",
    updatedAt: 1,
    plan: [
      { step: "Inspect", status: "completed" },
      { step: "Implement", status: "in_progress" },
      { step: "Verify", status: "pending" },
    ],
  });
  assert.deepEqual(summary, {
    completed: 1,
    inProgress: 1,
    pending: 1,
    total: 3,
    label: "查看执行计划，已完成 1/3，1 项进行中",
  });
});

test("returns no summary for a missing or empty plan", () => {
  assert.equal(buildSessionPlanPreviewSummary(undefined), null);
  assert.equal(buildSessionPlanPreviewSummary({
    sessionId: "session-1",
    source: "update_plan",
    updatedAt: 1,
    plan: [],
  }), null);
});
```

- [ ] **Step 2: Compile and run the test to verify it fails**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-plan-preview.test.js`

Expected: compilation fails because `session-plan-preview.ts` does not exist.

- [ ] **Step 3: Implement the pure summary helper**

```ts
import type { SessionPlanSnapshot } from "../../shared/plan-progress.js";

export type SessionPlanPreviewSummary = {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
  label: string;
};

export function buildSessionPlanPreviewSummary(
  plan: SessionPlanSnapshot | undefined,
): SessionPlanPreviewSummary | null {
  if (!plan?.plan.length) return null;
  const completed = plan.plan.filter((item) => item.status === "completed").length;
  const inProgress = plan.plan.filter((item) => item.status === "in_progress").length;
  const pending = plan.plan.length - completed - inProgress;
  const suffix = inProgress > 0 ? `，${inProgress} 项进行中` : "";
  return {
    completed,
    inProgress,
    pending,
    total: plan.plan.length,
    label: `查看执行计划，已完成 ${completed}/${plan.plan.length}${suffix}`,
  };
}
```

- [ ] **Step 4: Run the targeted test and confirm it passes**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-plan-preview.test.js`

Expected: 2 tests pass.

### Task 2: Render and Wire the Checklist Popover

**Files:**
- Create: `src/ui/components/SessionPlanPreview.tsx`
- Modify: `src/ui/components/Sidebar.tsx`
- Create: `test/electron/session-plan-preview-ui-source.test.ts`

- [ ] **Step 1: Write a failing source contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sidebar plan preview uses a portal and accessible trigger contract", () => {
  const sidebar = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const preview = readFileSync("src/ui/components/SessionPlanPreview.tsx", "utf8");
  assert.match(sidebar, /aria-expanded=\{isPlanPreviewOpen\}/);
  assert.match(sidebar, /aria-controls=\{isPlanPreviewOpen \? planPreviewId : undefined\}/);
  assert.match(sidebar, /event\.key === "Escape"/);
  assert.match(preview, /createPortal/);
  assert.match(preview, /role="region"/);
  assert.match(preview, /data-session-plan-preview/);
});
```

- [ ] **Step 2: Run the source test and confirm it fails**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-plan-preview-ui-source.test.js`

Expected: failure because the component and trigger wiring do not exist.

- [ ] **Step 3: Implement `SessionPlanPreview`**

Define props with the exact contract below and render through `createPortal(..., document.body)`:

```ts
export interface SessionPlanPreviewProps {
  id: string;
  plan: SessionPlanSnapshot;
  anchor: { left: number; top: number; right: number; bottom: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
```

Calculate a 360-pixel card position using `anchor.right + 10`, clamp horizontal and vertical coordinates to a 12-pixel viewport margin, cap the checklist at `max-h-72`, and render each item with `data-plan-step-status={item.status}`. Completed rows use a checked circle, active rows use an accent spinner, and pending rows use an empty outlined circle.

- [ ] **Step 4: Add sidebar state and trigger wiring**

Add one preview state object containing `sessionId` and the trigger rectangle. Use a 120-millisecond close timer shared by trigger and card. For sessions with a non-empty plan, replace the decorative leading status element with a button that:

```tsx
aria-label={planSummary.label}
aria-expanded={isPlanPreviewOpen}
aria-controls={isPlanPreviewOpen ? planPreviewId : undefined}
onMouseEnter={(event) => openSessionPlanPreview(session.id, event.currentTarget)}
onMouseLeave={scheduleSessionPlanPreviewClose}
onFocus={(event) => openSessionPlanPreview(session.id, event.currentTarget)}
onBlur={scheduleSessionPlanPreviewClose}
onClick={(event) => event.stopPropagation()}
onKeyDown={(event) => {
  event.stopPropagation();
  if (event.key === "Escape") closeSessionPlanPreview();
}}
```

Mount one `SessionPlanPreview` after the sidebar so it is not clipped by the scroll container. Close it when the workspace collapses, the active conversation changes, or the window resizes.

- [ ] **Step 5: Run focused tests and build**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-plan-preview.test.js dist-test/test/electron/session-plan-preview-ui-source.test.js`

Expected: all targeted tests pass.

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

### Task 3: Add a Deterministic Visual Smoke Fixture

**Files:**
- Modify: `src/ui/dev-electron-shim.ts`
- Create: `scripts/qa/sidebar-plan-preview-smoke.cjs`
- Modify: `package.json`

- [ ] **Step 1: Add a query-gated plan fixture to the dev shim**

When `new URLSearchParams(window.location.search).get("qaPlanPreview") === "1"`, initialize the browser-preview session as running and emit this snapshot immediately after the initial session list:

```ts
{
  type: "session.plan.updated",
  payload: {
    sessionId: browserPreviewSessionId,
    source: "update_plan",
    updatedAt: Date.now(),
    explanation: "聊天列表计划预览验收",
    plan: [
      { step: "检查聊天列表现有数据链路", status: "completed" },
      { step: "实现计划清单悬浮预览", status: "completed" },
      { step: "验证键盘与边界定位", status: "in_progress" },
      { step: "运行定向测试与视觉验收", status: "pending" },
    ],
  },
}
```

- [ ] **Step 2: Create the Playwright smoke script**

The script starts `npm run dev:react -- --host 127.0.0.1 --port 4317 --strictPort`, opens `http://127.0.0.1:4317/?qaPlanPreview=1`, expands the workspace if needed, hovers the button whose name contains `查看执行计划`, asserts the four fixture rows and all three status attributes, saves `.omx/artifacts/sidebar-plan-preview.png`, verifies Escape closes the card after keyboard focus, and terminates the Vite process in `finally`.

- [ ] **Step 3: Add the package command**

Add this script entry:

```json
"qa:sidebar-plan-preview": "node scripts/qa/sidebar-plan-preview-smoke.cjs"
```

- [ ] **Step 4: Run the visual smoke**

Run: `npm run qa:sidebar-plan-preview`

Expected: `SIDEBAR_PLAN_PREVIEW_QA_OK` and a non-empty PNG at `.omx/artifacts/sidebar-plan-preview.png`.

### Task 4: Completion Audit and Score

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Run scoped static checks**

Run: `npx eslint src/ui/components/Sidebar.tsx src/ui/components/SessionPlanPreview.tsx src/ui/utils/session-plan-preview.ts src/ui/dev-electron-shim.ts test/electron/session-plan-preview.test.ts test/electron/session-plan-preview-ui-source.test.ts`

Expected: zero lint errors in changed TypeScript files.

- [ ] **Step 2: Re-run build, targeted tests, and Playwright smoke**

Run each command from Tasks 2 and 3 again after all edits. Every command must exit zero.

- [ ] **Step 3: Inspect the screenshot against the reference**

Confirm card placement, border/radius/shadow, status icon distinction, wrapping, density, and absence of clipping. Record the functional and visual evidence in the final handoff.

- [ ] **Step 4: Score the result**

Assign points using the design rubric: function 35, visual fidelity 25, interaction/accessibility 15, regression safety 15, and code quality 10. Do not mark completion below 85/100.

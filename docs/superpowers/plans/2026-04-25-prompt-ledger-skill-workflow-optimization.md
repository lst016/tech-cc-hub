# Prompt Ledger Skill/Workflow Optimization Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Prompt Ledger` a usable skill/workflow optimization workbench where `Prompt 分布` remains visible and left Trace node clicks update the scoped prompt diagnosis.

**Architecture:** Keep the current `SessionAnalysisPage` route and existing Prompt Ledger data model. Extract node-scope matching into a pure shared helper, then refactor only the `PromptLedgerPanel` layout so the distribution table is the main area and diagnosis becomes a side detail panel instead of a fixed bottom panel.

**Tech Stack:** Electron 39, React 19, TypeScript 5.9, Tailwind CSS v4, Node test runner.

---

## File Structure

- Modify: `src/shared/prompt-ledger.ts`
  - Add exported pure helper types and `derivePromptNodeScope(...)`.
  - Keep Prompt Ledger collection format unchanged.

- Modify: `src/ui/components/SessionAnalysisPage.tsx`
  - Import `derivePromptNodeScope`.
  - Replace duplicated in-component node relation logic.
  - Rework `PromptLedgerPanel` layout into compact summary + main distribution table + side diagnosis panel.
  - Add reset behavior when selected Trace node changes.

- Modify: `test/electron/activity-rail-model.test.ts`
  - Add pure helper tests for exact match, same-round fallback, empty match, and current prompt matching.

- Modify: `test/electron/session-analysis-page.test.ts`
  - Add static source tests that guard the new workbench layout and prevent reintroducing `h-[340px]` fixed bottom diagnosis.

---

### Task 1: Add Prompt Node Scope Helper

**Files:**
- Modify: `src/shared/prompt-ledger.ts`
- Test: `test/electron/activity-rail-model.test.ts`

- [ ] **Step 1: Write the failing test**

Add this import to `test/electron/activity-rail-model.test.ts`:

```ts
import {
  buildPromptLedgerMessage,
  derivePromptNodeScope,
  type PromptLedgerSegment,
} from "../../src/shared/prompt-ledger.js";
```

Replace the existing `buildPromptLedgerMessage` import with the combined import above.

Append these tests near the existing Prompt Ledger tests:

```ts
test("derivePromptNodeScope returns exact matches for node ids and tool names", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-tool-input",
      bucketId: "history-tool-input",
      label: "历史工具输入",
      sourceKind: "tool",
      segmentKind: "history_tool_input",
      chars: 120,
      tokenEstimate: 40,
      ratio: 1,
      sample: "Read ActivityRail",
      text: "Read ActivityRail",
      round: 2,
      nodeId: "tool-read",
      messageId: "assistant-read",
      toolName: "Read",
      risks: ["tool_payload"],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "tool-read",
    title: "Read",
    toolName: "Read",
    round: 2,
    nodeKind: "tool",
  });

  assert.equal(scope.mode, "exact");
  assert.deepEqual(scope.matchedIds, ["seg-tool-input"]);
  assert.equal(scope.tokenEstimate, 40);
  assert.match(scope.detail, /直接关联/);
});

test("derivePromptNodeScope falls back to same round when direct node match is missing", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-round-history",
      bucketId: "history-user-prompt",
      label: "历史用户输入",
      sourceKind: "history",
      segmentKind: "history_user_prompt",
      chars: 90,
      tokenEstimate: 30,
      ratio: 1,
      sample: "上一轮需求",
      text: "上一轮需求",
      round: 3,
      nodeId: "prompt-3-a",
      messageId: "prompt-3-a",
      risks: [],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "assistant-3-no-direct",
    title: "分析输出",
    round: 3,
    nodeKind: "result",
  });

  assert.equal(scope.mode, "round");
  assert.deepEqual(scope.matchedIds, ["seg-round-history"]);
  assert.match(scope.detail, /同轮/);
});

test("derivePromptNodeScope matches current prompt and attachments for user input node", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-current",
      bucketId: "current-prompt",
      label: "当前用户输入",
      sourceKind: "current",
      segmentKind: "current_prompt",
      chars: 60,
      tokenEstimate: 20,
      ratio: 0.5,
      sample: "继续优化",
      text: "继续优化",
      risks: [],
    },
    {
      id: "seg-attachment",
      bucketId: "current-attachments",
      label: "当前附件",
      sourceKind: "attachment",
      segmentKind: "attachment",
      chars: 300,
      tokenEstimate: 100,
      ratio: 0.5,
      sample: "screen.png(image)",
      risks: [],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "prompt-4-current",
    title: "发送用户输入",
    round: 4,
    nodeKind: "context",
  });

  assert.equal(scope.mode, "exact");
  assert.deepEqual(scope.matchedIds, ["seg-current", "seg-attachment"]);
  assert.equal(scope.tokenEstimate, 120);
});

test("derivePromptNodeScope reports empty when no node or round segment matches", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-other-round",
      bucketId: "history",
      label: "历史",
      sourceKind: "history",
      segmentKind: "history_user_prompt",
      chars: 60,
      tokenEstimate: 20,
      ratio: 1,
      sample: "其他轮次",
      text: "其他轮次",
      round: 1,
      risks: [],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "tool-edit-round-8",
    title: "Edit",
    toolName: "Edit",
    round: 8,
    nodeKind: "tool",
  });

  assert.equal(scope.mode, "empty");
  assert.deepEqual(scope.matchedIds, []);
  assert.equal(scope.tokenEstimate, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
FAIL
SyntaxError or export error mentioning derivePromptNodeScope
```

- [ ] **Step 3: Implement the minimal helper**

In `src/shared/prompt-ledger.ts`, add these exported types after `PromptLedgerBuildInput`:

```ts
export type PromptLedgerTimelineScopeItem = {
  id: string;
  title: string;
  toolName?: string;
  round?: number;
  nodeKind?: string;
};

export type PromptNodeScopeMode = "none" | "exact" | "round" | "empty";

export type PromptNodeScope = {
  exactIds: string[];
  roundIds: string[];
  matchedIds: string[];
  mode: PromptNodeScopeMode;
  label: string;
  detail: string;
  tokenEstimate: number;
  sourceLabels: string[];
};
```

Then add this helper before `estimatePromptLedgerTokens(...)`:

```ts
export function derivePromptNodeScope(
  segments: PromptLedgerSegment[],
  selectedTimelineItem: PromptLedgerTimelineScopeItem | null,
): PromptNodeScope {
  if (!selectedTimelineItem) {
    return {
      exactIds: [],
      roundIds: [],
      matchedIds: [],
      mode: "none",
      label: "未选择节点",
      detail: "从左侧 Trace Flow 选择节点后，这里会自动显示关联片段。",
      tokenEstimate: 0,
      sourceLabels: [],
    };
  }

  const exact = segments.filter((segment) => {
    if (segment.nodeId === selectedTimelineItem.id || segment.messageId === selectedTimelineItem.id) return true;
    if (
      selectedTimelineItem.toolName &&
      segment.toolName === selectedTimelineItem.toolName &&
      segment.round === selectedTimelineItem.round
    ) {
      return true;
    }
    if (
      selectedTimelineItem.nodeKind === "context" &&
      selectedTimelineItem.title === "发送用户输入" &&
      (segment.segmentKind === "current_prompt" || segment.segmentKind === "attachment")
    ) {
      return true;
    }
    return false;
  });

  const round = exact.length > 0
    ? []
    : segments.filter((segment) => (
      typeof selectedTimelineItem.round === "number" &&
      selectedTimelineItem.round > 0 &&
      segment.round === selectedTimelineItem.round
    ));

  const exactIds = exact.map((segment) => segment.id);
  const roundIds = round.map((segment) => segment.id);
  const matchedSegments = exact.length > 0 ? exact : round;
  const matchedIds = matchedSegments.map((segment) => segment.id);
  const mode: PromptNodeScopeMode = exact.length > 0 ? "exact" : round.length > 0 ? "round" : "empty";
  const tokenEstimate = matchedSegments.reduce((sum, segment) => sum + segment.tokenEstimate, 0);
  const sourceLabels = Array.from(new Set(matchedSegments.map(getPromptSegmentKindLabel))).slice(0, 4);
  const label = selectedTimelineItem.toolName || selectedTimelineItem.title;

  return {
    exactIds,
    roundIds,
    matchedIds,
    mode,
    label,
    tokenEstimate,
    sourceLabels,
    detail:
      mode === "exact"
        ? `已匹配 ${exactIds.length} 个直接关联片段。`
        : mode === "round"
          ? `没有直接节点片段，显示同轮 ${selectedTimelineItem.round} 的上下文。`
          : "这个节点暂时没有可追踪到 Prompt Ledger 的片段。",
  };
}

export function getPromptSegmentKindLabel(segment: Pick<PromptLedgerSegment, "sourceKind" | "segmentKind">): string {
  if (segment.segmentKind === "current_prompt") return "当前输入";
  if (segment.segmentKind === "attachment") return "附件";
  if (segment.segmentKind === "history_user_prompt") return "历史用户输入";
  if (segment.segmentKind === "history_assistant_output") return "历史 AI 输出";
  if (segment.segmentKind === "history_tool_input") return "工具输入";
  if (segment.segmentKind === "history_tool_output") return "工具输出";
  if (segment.sourceKind === "skill") return "Skill";
  if (segment.sourceKind === "workflow") return "Workflow";
  if (segment.sourceKind === "memory") return "记忆";
  if (segment.sourceKind === "project") return "项目";
  if (segment.sourceKind === "system") return "系统";
  return "来源";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/prompt-ledger.ts test/electron/activity-rail-model.test.ts
git commit -m "test: cover prompt ledger node scoping"
```

---

### Task 2: Replace In-Component Node Relation Logic

**Files:**
- Modify: `src/ui/components/SessionAnalysisPage.tsx`
- Test: `test/electron/session-analysis-page.test.ts`

- [ ] **Step 1: Write the failing static test**

Add these assertions to `test/electron/session-analysis-page.test.ts`:

```ts
assert.match(analysisPageSource, /derivePromptNodeScope/);
assert.doesNotMatch(analysisPageSource, /const nodeRelation = useMemo\(\(\) => \{/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
FAIL
The input did not match /derivePromptNodeScope/
```

- [ ] **Step 3: Use the shared helper in the UI**

In `src/ui/components/SessionAnalysisPage.tsx`, add `derivePromptNodeScope` to the existing prompt-ledger import:

```ts
import {
  derivePromptNodeScope,
  type PromptLedgerSegment,
  type PromptLedgerSourceKind,
} from "../../shared/prompt-ledger";
```

Replace the `const nodeRelation = useMemo(() => { ... }, [analysis.segments, selectedTimelineItem]);` block inside `PromptLedgerPanel` with:

```ts
  const nodeRelation = useMemo(
    () => derivePromptNodeScope(analysis.segments, selectedTimelineItem),
    [analysis.segments, selectedTimelineItem],
  );
  const nodeMatchedIds = useMemo(
    () => new Set(nodeRelation.matchedIds),
    [nodeRelation.matchedIds],
  );
  const nodeExactIds = useMemo(
    () => new Set(nodeRelation.exactIds),
    [nodeRelation.exactIds],
  );
  const nodeRoundIds = useMemo(
    () => new Set(nodeRelation.roundIds),
    [nodeRelation.roundIds],
  );
```

Replace references:

```ts
nodeRelation.matchedIds.has(segment.id)
```

with:

```ts
nodeMatchedIds.has(segment.id)
```

Replace references passed into `buildSegmentTraceLink(...)`:

```ts
nodeRelation.exactIds
nodeRelation.roundIds
```

with:

```ts
nodeExactIds
nodeRoundIds
```

Replace `nodeRelation.matchedIds.size` with `nodeRelation.matchedIds.length`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SessionAnalysisPage.tsx test/electron/session-analysis-page.test.ts
git commit -m "refactor: share prompt ledger node scoping"
```

---

### Task 3: Make Prompt Distribution the Main Workbench Area

**Files:**
- Modify: `src/ui/components/SessionAnalysisPage.tsx`
- Test: `test/electron/session-analysis-page.test.ts`

- [ ] **Step 1: Write the failing static UI guard**

Add these assertions to `test/electron/session-analysis-page.test.ts`:

```ts
assert.match(analysisPageSource, /data-prompt-ledger-workbench/);
assert.match(analysisPageSource, /data-prompt-ledger-distribution/);
assert.match(analysisPageSource, /data-prompt-ledger-diagnosis/);
assert.doesNotMatch(analysisPageSource, /h-\[340px\][^"]*shrink-0[^"]*上下文诊断/s);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
FAIL
The input did not match /data-prompt-ledger-workbench/
```

- [ ] **Step 3: Refactor the PromptLedgerPanel layout**

In `PromptLedgerPanel`, replace the root:

```tsx
return (
  <div className="flex h-full min-h-[680px] flex-col gap-3">
```

with:

```tsx
return (
  <div data-prompt-ledger-workbench className="flex h-full min-h-0 flex-col gap-2">
```

Replace the four metric cards grid class:

```tsx
<div className="grid shrink-0 gap-2 md:grid-cols-4">
```

with:

```tsx
<div className="grid shrink-0 gap-2 md:grid-cols-5">
```

Add a fifth compact metric card after `记录轮次`:

```tsx
<PromptMetricCard label="健康分" value={`${healthSummary.score}`} detail={healthSummary.label} tone={healthSummary.tone === "success" ? "success" : "warning"} />
```

Replace the health summary section class:

```tsx
<section className={cx("shrink-0 rounded-lg border p-3", tonePanelClass(healthSummary.tone))}>
```

with:

```tsx
<section className={cx("shrink-0 rounded-lg border px-3 py-2", tonePanelClass(healthSummary.tone))}>
```

Inside that section, remove the detailed two-column `healthSummary.details` and `healthSummary.nextActions` block, and replace it with:

```tsx
<div className="mt-2 grid gap-2 lg:grid-cols-3">
  {[...healthSummary.details.slice(0, 2), healthSummary.nextActions[0]].filter(Boolean).map((detail) => (
    <div key={detail} className="rounded border border-white/50 bg-white/50 px-2 py-1 text-[11px] leading-5">
      {detail}
    </div>
  ))}
</div>
```

Replace:

```tsx
<div className="flex min-h-0 flex-1 flex-col gap-3">
```

with:

```tsx
<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-3 max-xl:grid-cols-1">
```

Add `data-prompt-ledger-distribution` to the `<main>` element:

```tsx
<main data-prompt-ledger-distribution className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
```

Replace the diagnosis `<aside className="flex h-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">` with:

```tsx
<aside data-prompt-ledger-diagnosis className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white max-xl:min-h-[320px]">
```

- [ ] **Step 4: Run the static UI test**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SessionAnalysisPage.tsx test/electron/session-analysis-page.test.ts
git commit -m "fix: keep prompt distribution visible"
```

---

### Task 4: Reset Segment Selection When Left Trace Node Changes

**Files:**
- Modify: `src/ui/components/SessionAnalysisPage.tsx`
- Test: `test/electron/session-analysis-page.test.ts`

- [ ] **Step 1: Write the failing static test**

Add this assertion to `test/electron/session-analysis-page.test.ts`:

```ts
assert.match(analysisPageSource, /setScopeModeState\("node"\)/);
assert.match(analysisPageSource, /setSelectedSegmentId\(null\)/);
assert.match(analysisPageSource, /selectedTimelineItemId\]\)/);
```

- [ ] **Step 2: Run test to verify it fails if reset effect is missing**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
FAIL if no selectedTimelineItemId reset effect exists
```

- [ ] **Step 3: Add the reset effect**

Inside `PromptLedgerPanel`, after `handleSelectSegment`, add:

```tsx
  useEffect(() => {
    setScopeAnchorId(selectedTimelineItemId);
    setScopeModeState("node");
    setSelectedKind("all");
    setSelectedSegmentId(null);
    setGeneratedSummary(null);
  }, [selectedTimelineItemId]);
```

This ensures a left Trace node click resets old diagnosis state and lets `selectedSegment` recompute from the new node scope.

- [ ] **Step 4: Run test**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SessionAnalysisPage.tsx test/electron/session-analysis-page.test.ts
git commit -m "fix: sync prompt diagnosis with selected trace node"
```

---

### Task 5: Full Verification and Electron Restart

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test:activity-rail-model
```

Expected:

```text
pass
```

- [ ] **Step 2: Compile Electron**

Run:

```bash
npm run transpile:electron
```

Expected:

```text
exit code 0
```

- [ ] **Step 3: Build React**

Run:

```bash
npm run build
```

Expected:

```text
exit code 0
```

- [ ] **Step 4: Restart Electron client**

Run:

```bash
cmd.exe /c "cd /d D:\tool\tech-cc-hub && npm run dev > dev-restart.log 2>&1"
```

Expected:

```text
http://localhost:4173/ responds with 200
electron.exe starts from D:\tool\tech-cc-hub\node_modules\electron\dist\electron.exe
```

- [ ] **Step 5: Final commit if verification passes**

```bash
git status --short
git add src/shared/prompt-ledger.ts src/ui/components/SessionAnalysisPage.tsx test/electron/activity-rail-model.test.ts test/electron/session-analysis-page.test.ts
git commit -m "fix: improve prompt ledger optimization workbench"
```

Do not stage unrelated files such as `.omc/`, `.cursor/`, `.tmp/`, screenshots, or restart logs.

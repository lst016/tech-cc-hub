# Collapsed Session Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a narrow recent-conversation rail visible when the full sidebar is collapsed and show a title plus latest-assistant-reply card on hover or keyboard focus.

**Architecture:** `App.tsx` continues to own `showSidebar` and swaps the existing `Sidebar` for a focused `CollapsedSessionRail`. A pure `session-rail-preview.ts` module owns message extraction and recency selection; the rail owns pointer/focus state, unread transitions, and portal positioning. Existing session IPC is reused to hydrate a hovered conversation before its preview is needed.

**Tech Stack:** React 19, TypeScript, ReactDOM portals, Tailwind CSS, Zustand, Node test runner, Playwright, Vite development shim.

---

## File Structure

- Create `src/ui/utils/session-rail-preview.ts`: pure recent-session selection, assistant text extraction, and card positioning helpers.
- Create `src/ui/components/CollapsedSessionRail.tsx`: accessible rail buttons, status visuals, hover/focus lifecycle, and portal card.
- Modify `src/ui/App.tsx`: mount the rail when `showSidebar` is false, reserve its width, hydrate hovered histories, and pass live partial text.
- Modify `src/ui/dev-electron-shim.ts`: query-gated multi-session fixture with assistant replies.
- Create `test/electron/session-rail-preview.test.ts`: behavioral tests for extraction, selection, and positioning.
- Create `test/electron/collapsed-session-rail-ui.test.ts`: source contract for app wiring, accessibility, and portal rendering.
- Create `scripts/qa/collapsed-session-rail-smoke.cjs`: real browser interaction, keyboard checks, selection check, and screenshot capture.
- Modify `package.json`: expose `qa:collapsed-session-rail`.

### Task 1: Lock the Pure Preview Model

**Files:**
- Create: `test/electron/session-rail-preview.test.ts`
- Create: `src/ui/utils/session-rail-preview.ts`

- [ ] **Step 1: Write failing tests for summary extraction, recency order, and card clamping**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  clampSessionPreviewPosition,
  extractLatestAssistantSummary,
  selectCollapsedRailSessions,
} from "../../src/ui/utils/session-rail-preview.js";

const assistant = (text: string) => ({
  type: "assistant",
  message: { content: [{ type: "text", text }] },
});

test("uses a live partial before the latest readable assistant reply", () => {
  assert.equal(
    extractLatestAssistantSummary([
      assistant("older reply"),
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Read" }] } },
      assistant(" latest   reply "),
    ], " live   response "),
    "live response",
  );
  assert.equal(extractLatestAssistantSummary([assistant(" latest   reply ")]), "latest reply");
  assert.equal(extractLatestAssistantSummary([{ type: "system" }]), "暂无回复摘要");
});

test("selects the newest non-archived sessions without mutating input", () => {
  const sessions = {
    old: { id: "old", title: "Old", updatedAt: 10 },
    archived: { id: "archived", title: "Archived", updatedAt: 40, archivedAt: 41 },
    newest: { id: "newest", title: "Newest", updatedAt: 30 },
    middle: { id: "middle", title: "Middle", updatedAt: 20 },
  };
  assert.deepEqual(selectCollapsedRailSessions(sessions, 2).map((item) => item.id), ["newest", "middle"]);
  assert.deepEqual(Object.keys(sessions), ["old", "archived", "newest", "middle"]);
});

test("clamps a 480px card inside the viewport", () => {
  assert.deepEqual(
    clampSessionPreviewPosition({ right: 64, top: 900 }, { width: 600, height: 950 }, 480, 170),
    { left: 76, top: 768 },
  );
});
```

- [ ] **Step 2: Compile and run the test, confirming RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-rail-preview.test.js`

Expected: TypeScript fails because `session-rail-preview.ts` does not exist.

- [ ] **Step 3: Add the minimal pure helper implementation**

```ts
export const COLLAPSED_SESSION_RAIL_LIMIT = 10;
export const SESSION_PREVIEW_FALLBACK = "暂无回复摘要";

type RailSession = {
  id: string;
  title: string;
  updatedAt?: number;
  archivedAt?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSummary(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractLatestAssistantSummary(messages: readonly unknown[], partial = ""): string {
  const live = normalizeSummary(partial);
  if (live) return live;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const envelope = messages[index];
    if (!isRecord(envelope) || envelope.type !== "assistant" || !isRecord(envelope.message)) continue;
    const content = envelope.message.content;
    if (!Array.isArray(content)) continue;
    const text = normalizeSummary(content
      .filter((item): item is Record<string, unknown> => isRecord(item) && item.type === "text")
      .map((item) => typeof item.text === "string" ? item.text : "")
      .filter(Boolean)
      .join(" "));
    if (text) return text;
  }
  return SESSION_PREVIEW_FALLBACK;
}

export function selectCollapsedRailSessions<T extends RailSession>(sessions: Record<string, T>, limit = COLLAPSED_SESSION_RAIL_LIMIT): T[] {
  return Object.values(sessions)
    .filter((session) => session.archivedAt === undefined)
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(0, Math.max(0, limit));
}

export function clampSessionPreviewPosition(
  anchor: { right: number; top: number },
  viewport: { width: number; height: number },
  cardWidth: number,
  cardHeight: number,
) {
  const margin = 12;
  return {
    left: Math.max(margin, Math.min(anchor.right + margin, viewport.width - cardWidth - margin)),
    top: Math.max(margin, Math.min(anchor.top - 10, viewport.height - cardHeight - margin)),
  };
}
```

- [ ] **Step 4: Re-run the focused test, confirming GREEN**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-rail-preview.test.js`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the pure model with its regression tests**

Stage only `src/ui/utils/session-rail-preview.ts` and `test/electron/session-rail-preview.test.ts`. Use a Lore commit whose intent is to make collapsed-session previews deterministic and independently testable.

### Task 2: Build the Rail and Integrate It into the App Shell

**Files:**
- Create: `src/ui/components/CollapsedSessionRail.tsx`
- Modify: `src/ui/App.tsx`
- Create: `test/electron/collapsed-session-rail-ui.test.ts`

- [ ] **Step 1: Write the failing UI source contract**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("collapsed sidebar mounts an accessible session rail and preview portal", () => {
  const app = readFileSync("src/ui/App.tsx", "utf8");
  const rail = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");
  assert.match(app, /workspaceSidebarCollapsed/);
  assert.match(app, /COLLAPSED_SESSION_RAIL_WIDTH/);
  assert.match(app, /<CollapsedSessionRail/);
  assert.match(app, /requestCollapsedSessionPreviewHistory/);
  assert.match(rail, /createPortal/);
  assert.match(rail, /data-collapsed-session-rail/);
  assert.match(rail, /data-session-preview-card/);
  assert.match(rail, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(rail, /aria-expanded=\{isPreviewOpen\}/);
  assert.match(rail, /event\.key === "Escape"/);
});
```

- [ ] **Step 2: Compile and run the UI test, confirming RED**

Run: `npm run test:electron:build && node --test dist-test/test/electron/collapsed-session-rail-ui.test.js`

Expected: compilation or source read fails because `CollapsedSessionRail.tsx` is absent.

- [ ] **Step 3: Implement `CollapsedSessionRail`**

The component exports `COLLAPSED_SESSION_RAIL_WIDTH = 64` and accepts this exact contract:

```ts
export interface CollapsedSessionRailProps {
  sessions: Record<string, SessionView>;
  activeSessionId: string | null;
  partialMessagesBySessionId: Record<string, string>;
  topClassName: string;
  onPreviewSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
}
```

Render one real button per selected session. Use `aria-label={`打开会话：${session.title}`}`, `aria-current`, `aria-expanded`, and `aria-controls`. A 140ms shared close timer bridges the trigger/card pointer gap. Enter/Space call the same select function as click; Escape only closes the preview. Track status transitions in a ref so background `running -> completed/error` sessions receive an unread accent until selected. Render the preview with `createPortal(..., document.body)`, a fixed `w-[min(480px,calc(100vw-88px))]` card, a bold one-line title, and a three-line clamped summary.

- [ ] **Step 4: Wire the collapsed state in `App.tsx`**

Add:

```ts
const workspaceSidebarVisible = showSidebar;
const workspaceSidebarCollapsed = !showSidebar;
const sidebarOffset = workspaceSidebarVisible
  ? sidebarWidth
  : workspaceSidebarCollapsed
    ? COLLAPSED_SESSION_RAIL_WIDTH
    : 0;

const requestCollapsedSessionPreviewHistory = useCallback((sessionId: string) => {
  const session = sessions[sessionId];
  if (!connected || !session || session.hydrated || historyRequested.has(sessionId)) return;
  markHistoryRequested(sessionId);
  sendEvent({ type: "session.history", payload: { sessionId, limit: 80 } });
}, [connected, historyRequested, markHistoryRequested, sendEvent, sessions]);
```

Mount `CollapsedSessionRail` next to the existing conditional `Sidebar`, pass `partialMessagesBySessionId`, and use `setActiveSessionId` for selection. Keep the resize handle exclusive to the full sidebar. The computed `sidebarOffset` automatically moves the main surface, prompt composer, and new-message button.

- [ ] **Step 5: Run focused tests and build**

Run: `npm run test:electron:build && node --test dist-test/test/electron/session-rail-preview.test.js dist-test/test/electron/collapsed-session-rail-ui.test.js dist-test/test/electron/app-shell-layout.test.js dist-test/test/electron/sidebar-workspace-drawer.test.js dist-test/test/electron/goal-progress.test.js`

Expected: all tests pass.

Run: `npm run build`

Expected: `tsc -b` and Vite build exit zero.

- [ ] **Step 6: Commit the accessible app-shell integration**

Stage only the component, `App.tsx`, and the new UI contract test. The Lore message must state that the rail preserves full-sidebar and `/goal` behavior.

### Task 3: Add Deterministic Browser QA and Visual Evidence

**Files:**
- Modify: `src/ui/dev-electron-shim.ts`
- Create: `scripts/qa/collapsed-session-rail-smoke.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write the Playwright smoke script before adding the fixture**

The script starts `npm run dev:react -- --host 127.0.0.1 --port 4321 --strictPort`, opens `http://127.0.0.1:4321/?qaCollapsedSessionRail=1`, clicks the header button named `收起左侧栏`, and asserts `[data-collapsed-session-rail]` has at least three buttons. It hovers the inactive fixture titled `github提交下版本吧`, asserts its exact assistant summary in `[data-session-preview-card]`, saves `.omx/artifacts/collapsed-session-rail.png`, focuses a second mark and verifies Escape closes the card, then clicks it and verifies `aria-current="page"`. It terminates Vite in `finally` and prints `COLLAPSED_SESSION_RAIL_QA_OK`.

- [ ] **Step 2: Run the smoke script, confirming RED**

Run: `node scripts/qa/collapsed-session-rail-smoke.cjs`

Expected: fail because the query-gated multi-session fixture is not available.

- [ ] **Step 3: Add a query-gated multi-session fixture**

Inside `createFallbackElectron`, read `qaCollapsedSessionRail`. When enabled, `buildSessionListEvent()` returns three sessions with stable titles, statuses, timestamps, and ids. `buildSessionHistoryEvent(sessionId)` returns a user prompt plus a minimal assistant envelope for the requested fixture id:

```ts
const createQaAssistantMessage = (sessionId: string, text: string, capturedAt: number) => ({
  type: "assistant",
  message: { content: [{ type: "text", text }] },
  parent_tool_use_id: null,
  uuid: `${sessionId}-assistant`,
  session_id: sessionId,
  capturedAt,
}) as unknown as StreamMessage;
```

Change the existing `session.history` event handler to call `buildSessionHistoryEvent(event.payload.sessionId)`. Keep every fixture branch behind the query flag so normal browser preview behavior remains unchanged.

- [ ] **Step 4: Add the package script and run visual GREEN**

Add: `"qa:collapsed-session-rail": "node scripts/qa/collapsed-session-rail-smoke.cjs"`.

Run: `npm run qa:collapsed-session-rail`

Expected: `COLLAPSED_SESSION_RAIL_QA_OK`, zero unexpected page errors, and a non-empty screenshot.

- [ ] **Step 5: Inspect the screenshot**

Open `.omx/artifacts/collapsed-session-rail.png` and compare rail width/divider, mark spacing, active-mark length/contrast, card placement, 480px density, border/radius/shadow, title emphasis, three-line clamp, and viewport containment against the supplied reference. If visual fidelity is below 21/25, adjust styles and rerun the smoke test.

- [ ] **Step 6: Commit the deterministic visual gate**

Stage only the shim, QA script, and `package.json`. The Lore message must record the screenshot path and smoke result.

### Task 4: Completion Audit and 85-Point Score

**Files:**
- Verify only unless a failing check requires a scoped correction.

- [ ] **Step 1: Run scoped lint**

Run: `npx eslint src/ui/App.tsx src/ui/components/CollapsedSessionRail.tsx src/ui/utils/session-rail-preview.ts src/ui/dev-electron-shim.ts test/electron/session-rail-preview.test.ts test/electron/collapsed-session-rail-ui.test.ts`

Expected: zero errors and zero warnings attributable to changed files.

- [ ] **Step 2: Re-run compile, targeted regressions, build, and visual smoke**

Run the Task 2 focused test command, `npm run build`, and `npm run qa:collapsed-session-rail` from a clean worktree. Every command must exit zero.

- [ ] **Step 3: Check repository hygiene**

Run: `git diff --check && git status --short && git log --oneline -5`

Expected: no whitespace errors; only intentional artifacts ignored by Git; implementation split into reviewable Lore commits.

- [ ] **Step 4: Score against the approved rubric**

Award function up to 35, visual fidelity up to 25, interaction/accessibility up to 15, regression safety up to 15, and code quality/scope up to 10. Completion requires at least 85/100 and direct evidence for every awarded section.

# Current Session Plan Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-expanded current-session plan card with a bottom `x/x 步` trigger that reveals the full plan only while hovered or keyboard-focused.

**Architecture:** Keep active-session selection and completed-plan removal in `PromptInput`. Put transient expanded state and accessibility behavior inside `CurrentSessionPlanDock`, with the detailed card absolutely positioned above a compact trigger so opening it never changes composer geometry.

**Tech Stack:** React 19, TypeScript, Zustand-backed session data, Tailwind CSS, Node test runner, Playwright browser QA.

---

### Task 1: Lock the compact and hover contract with failing tests

**Files:**
- Modify: `test/electron/session-plan-preview-ui-source.test.ts`
- Modify: `scripts/qa/sidebar-plan-preview-smoke.cjs`

- [ ] **Step 1: Extend the source contract test**

Require the component source to contain a compact trigger, a separate popover, and explicit expanded state:

```ts
assert.match(dock, /data-plan-summary-trigger/);
assert.match(dock, /data-current-session-plan-popover/);
assert.match(dock, /aria-expanded=\{isExpanded\}/);
assert.match(dock, /\{summary\.completed\}\/\{summary\.total\} 步/);
```

- [ ] **Step 2: Extend browser QA around the desired states**

Locate the trigger and popover separately. Before hover, require only `2/4 步` to be visible and the popover to be hidden. After hover, require all four step rows to appear. Compare the composer rectangle before and after expansion, then move the pointer outside and require the popover to hide again:

```js
const surface = composer.locator("[data-current-session-plan-surface]");
const trigger = surface.locator("[data-plan-summary-trigger]");
const popover = surface.locator("[data-current-session-plan-popover]");
await expect(trigger).toHaveText("2/4 步");
await expect(popover).toBeHidden();
const composerBeforeHover = await composerCard.boundingBox();
await trigger.hover();
await expect(popover).toBeVisible();
expect(await composerCard.boundingBox()).toEqual(composerBeforeHover);
await page.mouse.move(1100, 100);
await expect(popover).toBeHidden();
```

Capture a compact screenshot before hover and the existing preview screenshot after hover.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/session-plan-preview-ui-source.test.js
```

Expected: FAIL because `data-plan-summary-trigger` and `data-current-session-plan-popover` do not exist.

- [ ] **Step 4: Run browser QA and verify RED**

Run:

```powershell
$env:SIDEBAR_PLAN_PREVIEW_QA_PORT='4336'
npm run qa:sidebar-plan-preview
```

Expected: FAIL because the current card exposes the step rows before hover.

- [ ] **Step 5: Commit the red tests**

Stage only the two test files and commit the expected failing contract with Lore trailers recording the RED evidence.

### Task 2: Implement the compact trigger and upward hover popover

**Files:**
- Modify: `src/ui/components/CurrentSessionPlanDock.tsx`
- Modify: `src/ui/components/prompt-input/PromptInput.tsx`

- [ ] **Step 1: Add local interaction state and a stable relationship**

Import `useId` and `useState`, then create `isExpanded` and `popoverId`. The containing section handles pointer entry/exit and focus entry/exit. Blur closes only when focus leaves the entire section:

```tsx
const [isExpanded, setIsExpanded] = useState(false);
const popoverId = useId();

onMouseEnter={() => setIsExpanded(true)}
onMouseLeave={() => setIsExpanded(false)}
onFocusCapture={() => setIsExpanded(true)}
onBlurCapture={(event) => {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
    setIsExpanded(false);
  }
}}
```

- [ ] **Step 2: Render only the compact trigger in normal layout**

The section reserves only the trigger height. Render a button with `data-plan-summary-trigger`, `aria-expanded={isExpanded}`, and `aria-controls={popoverId}`. Its only visible plan content is:

```tsx
<span>{summary.completed}/{summary.total} 步</span>
```

- [ ] **Step 3: Move full details into an upward overlay**

Render `data-current-session-plan-popover` in an absolute `bottom-full` container with bottom padding as a hover bridge. Use `hidden={!isExpanded}` so details are absent from layout until hover/focus. Preserve the existing title, progress badge, step statuses, and scroll limit inside the popover card.

- [ ] **Step 4: Keep the composer surface geometry compact**

Give `data-current-session-plan-surface` only the compact trigger height and retain centering above `.prompt-composer-card`. Do not introduce a portal, fixed positioning, or cross-session state.

- [ ] **Step 5: Run focused tests and browser QA to verify GREEN**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/session-plan-preview.test.js dist-test/test/electron/session-plan-preview-ui-source.test.js
$env:SIDEBAR_PLAN_PREVIEW_QA_PORT='4336'
npm run qa:sidebar-plan-preview
```

Expected: all focused tests pass and QA prints `SIDEBAR_PLAN_PREVIEW_QA_OK` with compact and expanded screenshots.

- [ ] **Step 6: Commit the implementation**

Stage the two production files and commit with Lore trailers describing the active-session and no-layout-shift constraints.

### Task 3: Verify visual fidelity and regression safety

**Files:**
- Verify: `.omx/artifacts/current-session-plan-compact.png`
- Verify: `.omx/artifacts/sidebar-plan-preview.png`
- Verify: `src/ui/components/CurrentSessionPlanDock.tsx`
- Verify: `src/ui/components/prompt-input/PromptInput.tsx`

- [ ] **Step 1: Run the complete focused regression set**

```powershell
npm run test:electron:build
node --test dist-test/test/electron/session-plan-preview.test.js dist-test/test/electron/session-plan-preview-ui-source.test.js dist-test/test/electron/session-rail-preview.test.js dist-test/test/electron/collapsed-session-rail-ui.test.js
```

Expected: 20 or more tests pass with zero failures.

- [ ] **Step 2: Run scoped lint and production build**

```powershell
npx eslint src/ui/components/CurrentSessionPlanDock.tsx src/ui/components/prompt-input/PromptInput.tsx test/electron/session-plan-preview-ui-source.test.ts
npm run build
```

Expected: ESLint exits 0 and Vite completes the production build; the existing chunk-size warning is acceptable.

- [ ] **Step 3: Run both browser regressions**

```powershell
$env:SIDEBAR_PLAN_PREVIEW_QA_PORT='4336'
npm run qa:sidebar-plan-preview
npm run qa:collapsed-session-rail
```

Expected: both scripts print their `_QA_OK` markers.

- [ ] **Step 4: Apply visual-verdict**

Compare the expanded screenshot to the supplied reference and inspect the compact screenshot. Require JSON verdict `pass`, `category_match: true`, and score at least 90. If lower, edit and repeat browser QA before continuing.

- [ ] **Step 5: Check final diff and commit verification adjustments**

Run `git diff --check` and `git status --short`. Commit any required QA-only adjustment with its own Lore verification evidence; otherwise leave the branch clean.

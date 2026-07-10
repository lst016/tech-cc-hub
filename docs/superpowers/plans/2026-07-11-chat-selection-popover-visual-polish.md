# Chat Selection Popover Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized chat selection popover with the approved compact segmented toolbar and restrained comment composer without changing any existing action or dismissal behavior.

**Architecture:** Keep selection state, reference creation, dismissal, and send handlers inside `SelectableText` in `EventCard.tsx`. Change only the popover's semantic attributes and Tailwind class groups, with a focused source-contract test protecting the segmented layout, responsive comment width, and expanded state.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4 utility classes, Node test runner, Playwright smoke QA

---

## File Structure

- Modify `src/ui/components/EventCard.tsx`: retain all current handlers and replace only selection-popover markup attributes and visual utility classes.
- Modify `test/electron/chat-selection-comment-actions.test.ts`: scope assertions to the selection-popover source and lock the approved layout/accessibility contract.
- Create `design-qa.md`: record reference-versus-runtime visual inspection and the final QA gate result.

### Task 1: Lock the approved popover contract with a failing regression test

**Files:**
- Modify: `test/electron/chat-selection-comment-actions.test.ts`
- Test: `test/electron/chat-selection-comment-actions.test.ts`

- [ ] **Step 1: Extend the existing test with a popover-scoped source fixture**

Replace the current test body with the following assertions so the test keeps the behavior contract and adds the approved visual/accessibility contract:

```ts
test("chat selection popover supports compact comment actions alongside quote", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const popoverSource = source.match(
    /selectionDraft && typeof document[\s\S]*?document\.body/,
  )?.[0] ?? "";

  assert.match(source, /kind: "selection" \| "message" \| "comment" = "message"/);
  assert.match(popoverSource, /<span>添加到对话<\/span>/);
  assert.match(popoverSource, /评论/);
  assert.match(popoverSource, /加入评论/);
  assert.match(popoverSource, /直接发送/);
  assert.match(source, /appendMessageReferenceToComposer\([\s\S]*"comment"/);

  assert.match(popoverSource, /role="group"/);
  assert.match(popoverSource, /aria-label="选区操作"/);
  assert.match(popoverSource, /aria-expanded=\{selectionDraft\.commentOpen\}/);
  assert.match(popoverSource, /divide-x divide-black\/10/);
  assert.match(popoverSource, /w-\[318px\] max-w-full/);
});
```

- [ ] **Step 2: Compile the focused test**

Run:

```powershell
npm run test:electron:build
```

Expected: TypeScript compilation succeeds and writes `dist-test/test/electron/chat-selection-comment-actions.test.js`.

- [ ] **Step 3: Run the focused test and verify the new contract fails**

Run:

```powershell
node --test dist-test/test/electron/chat-selection-comment-actions.test.js
```

Expected: FAIL on the first new layout assertion because `role="group"`, `aria-expanded`, and segmented divider classes are not present yet.

- [ ] **Step 4: Commit the failing regression test**

```powershell
git add -- test/electron/chat-selection-comment-actions.test.ts
git commit -m "Lock the compact selection-popover contract" -m "Add focused assertions for the approved segmented layout and expanded-state semantics before changing the UI.`n`nConstraint: Existing selection and comment actions must remain unchanged`nConfidence: high`nScope-risk: narrow`nTested: Test compilation; focused test fails on the missing visual contract`nNot-tested: Runtime presentation pending implementation"
```

### Task 2: Implement the compact segmented toolbar and comment composer

**Files:**
- Modify: `src/ui/components/EventCard.tsx:1116-1180`
- Test: `test/electron/chat-selection-comment-actions.test.ts`

- [ ] **Step 1: Replace the popover container and toolbar presentation**

Use the following outer container and toolbar markup while preserving the existing `style`, click handlers, and button labels:

```tsx
<div
  ref={selectionPopoverRef}
  className="fixed z-[80] flex w-max max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[12px] border border-black/10 bg-white/98 shadow-[0_8px_24px_rgba(15,18,24,0.13)] backdrop-blur"
  style={{ left: selectionDraft.x, top: selectionDraft.y, transform: "translateX(-50%)" }}
>
  <div
    role="group"
    aria-label="选区操作"
    className="flex h-[38px] items-stretch divide-x divide-black/10"
  >
    <button
      type="button"
      className="inline-flex items-center gap-1.5 bg-white px-3.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent/6 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/35"
      onClick={() => {
        addSelectionReference("selection");
        clearSelectionDraft();
      }}
    >
      <span aria-hidden="true">↩</span>
      <span>添加到对话</span>
    </button>
    <button
      type="button"
      aria-expanded={selectionDraft.commentOpen}
      className={cx(
        "inline-flex items-center bg-white px-3.5 text-[13px] font-medium transition-colors hover:bg-accent/6 hover:text-accent focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/35",
        selectionDraft.commentOpen ? "bg-accent/8 text-accent" : "text-ink-700",
      )}
      onClick={() => setSelectionDraft((current) => current ? { ...current, commentOpen: !current.commentOpen } : current)}
    >
      评论
    </button>
  </div>
```

- [ ] **Step 2: Replace only the expanded comment presentation classes**

Keep the textarea value/update handler and all three button handlers unchanged, but use these classes and attributes:

```tsx
{selectionDraft.commentOpen && (
  <div className="flex w-[318px] max-w-full flex-col gap-2 border-t border-black/8 bg-[#fbfcfd] p-2.5">
    <textarea
      value={selectionDraft.comment}
      onChange={(event) => setSelectionDraft((current) => current ? { ...current, comment: event.target.value } : current)}
      placeholder="写一句评论，之后可以一条条发送回复..."
      className="min-h-[76px] w-full resize-none rounded-[9px] border border-black/10 bg-white px-3 py-2.5 text-[13px] leading-5 text-ink-800 outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
    />
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        className="inline-flex h-[38px] items-center rounded-[8px] border border-black/10 bg-white px-3 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        onClick={() => setSelectionDraft((current) => current ? { ...current, commentOpen: false, comment: "" } : current)}
      >
        取消
      </button>
      <button
        type="button"
        className="inline-flex h-[38px] items-center rounded-[8px] border border-accent/24 bg-white px-3 text-xs font-semibold text-accent transition hover:bg-accent/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        onClick={() => {
          const trimmedComment = selectionDraft.comment.trim();
          if (!trimmedComment) return;
          addSelectionReference("comment", trimmedComment);
          clearSelectionDraft();
        }}
      >
        加入评论
      </button>
      <button
        type="button"
        className="inline-flex h-[38px] items-center rounded-[8px] bg-accent px-3 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-1"
        onClick={handleSendComment}
      >
        直接发送
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Run the focused test and verify it passes**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/chat-selection-comment-actions.test.js
```

Expected: PASS with one passing subtest and no failures.

- [ ] **Step 4: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build complete successfully with no new errors.

- [ ] **Step 5: Commit the implementation**

```powershell
git add -- src/ui/components/EventCard.tsx
git commit -m "Make text-selection actions feel native to the reading surface" -m "Use the approved segmented toolbar and restrained inline comment composer while leaving selection, reference, dismissal, and send handlers intact.`n`nConstraint: Preserve all current action labels and behavior`nRejected: Independent pill controls | They retain the oversized visual weight shown in the current UI`nConfidence: high`nScope-risk: narrow`nDirective: Do not couple future selection-capture changes to these presentation classes`nTested: Focused selection-comment regression and production build`nNot-tested: Runtime visual QA recorded separately"
```

### Task 3: Verify runtime behavior and visual fidelity

**Files:**
- Create: `design-qa.md`
- Verify: `scripts/qa/chat-selection-comment-smoke.cjs`

- [ ] **Step 1: Start the Electron-compatible development surface**

Run:

```powershell
npm run dev:react -- --host 127.0.0.1 --port 4173 --strictPort
```

Expected: Vite serves the UI at port 4173 using the repository's Electron shim path.

- [ ] **Step 2: Exercise the existing selection-comment smoke path**

Run in a second terminal while the development surface is active:

```powershell
node scripts/qa/chat-selection-comment-smoke.cjs
```

Expected: The script selects assistant text, opens `评论`, submits `加入评论`, and exits successfully without action lookup failures.

- [ ] **Step 3: Capture and compare both required states**

At the same desktop viewport used for the supplied screenshots:

1. Select assistant response text and capture the collapsed segmented toolbar.
2. Click `评论` and capture the expanded comment composer.
3. Compare border weight, radius, shadow, control height, whitespace, and anchoring against the approved A mockup and target screenshot.
4. Confirm the popover stays inside a narrow viewport and does not cover the selected text unnecessarily.

Expected: Both states match the approved A direction, with no P0, P1, or P2 visual defects.

- [ ] **Step 4: Write the blocking design QA report**

Create `design-qa.md` with this structure and replace each evidence line with the observed result:

```markdown
# Design QA: Chat Selection Popover

## Compared states

- Reference: supplied compact segmented-toolbar screenshot and approved A mockup.
- Runtime collapsed state: captured after selecting assistant text.
- Runtime expanded state: captured after clicking `评论`.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none, or list optional polish that does not block handoff.

## Interaction checks

- `添加到对话`: passed.
- `评论` expand/collapse: passed.
- `加入评论`: passed.
- `直接发送`: passed.
- outside-click, scroll, and resize dismissal: passed.
- narrow-window containment: passed.

final result: passed
```

If any P0, P1, or P2 issue exists, set `final result: blocked`, fix it, recapture both states, and repeat this step until the report says `final result: passed`.

- [ ] **Step 5: Commit the QA evidence**

```powershell
git add -- design-qa.md
git commit -m "Record visual proof for the compact selection popover" -m "Document the approved reference comparison and interaction checks after exercising both collapsed and expanded runtime states.`n`nConstraint: Visual handoff requires zero P0-P2 findings`nConfidence: high`nScope-risk: narrow`nTested: Playwright selection-comment smoke and manual state comparison`nNot-tested: Packaged Windows artifact; renderer-only change"
```

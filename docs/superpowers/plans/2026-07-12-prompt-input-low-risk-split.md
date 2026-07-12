# PromptInput Low-Risk Component Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the low-coupling palette and footer JSX from `PromptInput.tsx` while preserving every existing composer behavior.

**Architecture:** `PromptInput` remains the stateful orchestration component. Two new presentational modules receive typed values and callbacks, render the existing markup verbatim, and contain no app-store or file-system side effects.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Node test runner

---

### Task 1: Lock the split boundary

**Files:**
- Create: `test/electron/prompt-input-component-split.test.ts`

- [ ] **Step 1: Write the failing structural test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const promptInput = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
const palettes = readFileSync("src/ui/components/prompt-input/PromptComposerPalettes.tsx", "utf8");
const footer = readFileSync("src/ui/components/prompt-input/PromptComposerFooter.tsx", "utf8");

test("PromptInput composes low-risk presentational children", () => {
  assert.match(promptInput, /SlashCommandPalette/);
  assert.match(promptInput, /FileMentionPalette/);
  assert.match(promptInput, /PromptComposerFooter/);
  assert.doesNotMatch(promptInput, /filteredSlashCommands\.map/);
  assert.doesNotMatch(promptInput, /prompt-composer-footer mt-2/);
  assert.match(palettes, /filteredCommands\.map/);
  assert.match(palettes, /fileMentionOptions\.map/);
  assert.match(footer, /ComposerModelMenu/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/electron/prompt-input-component-split.test.ts`

Expected: FAIL because the new component files do not exist.

### Task 2: Extract palette components

**Files:**
- Create: `src/ui/components/prompt-input/PromptComposerPalettes.tsx`
- Modify: `src/ui/components/prompt-input/PromptInput.tsx:1387`

- [ ] **Step 1: Add typed presentational palettes**

Export `SlashCommandPalette` with `surfaceWidthClass`, `filteredCommands`, `activeIndex`, and `onSelect`. Export `FileMentionPalette` with `surfaceWidthClass`, `loading`, `fileMentionOptions`, `activeIndex`, `onRefresh`, and `onSelect`. Copy the current JSX, class names, labels, and event behavior verbatim.

- [ ] **Step 2: Keep file refresh logic in PromptInput**

Create a parent callback named `refreshFileMentionOptions` that clears the existing cache, toggles the existing loading state, calls `collectFileMentionOptions(effectiveCwd)`, and updates the existing option state. Pass this callback to `FileMentionPalette`.

- [ ] **Step 3: Replace the two inline palette blocks**

Render the extracted components under the unchanged `showSlashPalette` and `showFileMentionPalette` conditions.

- [ ] **Step 4: Run the structural test**

Run: `node --test test/electron/prompt-input-component-split.test.ts`

Expected: still FAIL only on the missing footer extraction.

### Task 3: Extract the footer component

**Files:**
- Create: `src/ui/components/prompt-input/PromptComposerFooter.tsx`
- Modify: `src/ui/components/prompt-input/PromptInput.tsx:1606`

- [ ] **Step 1: Add the typed footer component**

The footer props cover current model/reasoning values, disabled states, Slash visibility, optimization state, workflow state, goal state, expanded state, running/draft state, and the existing callbacks. Keep every current TooltipButton label, class, accessibility attribute, icon, and disabled condition verbatim.

- [ ] **Step 2: Replace the inline footer block**

Render `PromptComposerFooter` and pass parent-owned values and callbacks without moving state or side effects.

- [ ] **Step 3: Run the structural test and verify GREEN**

Run: `node --test test/electron/prompt-input-component-split.test.ts`

Expected: PASS.

### Task 4: Regression and quality gates

**Files:**
- Verify: `src/ui/components/prompt-input/PromptInput.tsx`
- Verify: `src/ui/components/prompt-input/PromptComposerPalettes.tsx`
- Verify: `src/ui/components/prompt-input/PromptComposerFooter.tsx`
- Verify: `test/electron/prompt-input-component-split.test.ts`

- [ ] **Step 1: Run focused prompt-input regressions**

Run: `node --test test/electron/prompt-input-*.test.ts`

Expected: all prompt-input tests pass.

- [ ] **Step 2: Run scoped lint**

Run: `npx eslint src/ui/components/prompt-input/PromptInput.tsx src/ui/components/prompt-input/PromptComposerPalettes.tsx src/ui/components/prompt-input/PromptComposerFooter.tsx test/electron/prompt-input-component-split.test.ts`

Expected: zero errors.

- [ ] **Step 3: Run the full build**

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 4: Run browser-preview smoke verification**

Start `npm run dev:react -- --host 127.0.0.1 --port 4328 --strictPort`, open the browser-preview URL, require one visible `.prompt-composer-editor[role='textbox']`, and require zero browser errors.

# GPT Structured Output Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent historical structured-output text from poisoning GPT continuations and surface terminal structured results as visible assistant output.

**Architecture:** Move structured-output intent detection into a pure shared helper that only examines explicit runtime configuration and the current display prompt. Keep runner streaming unchanged except for post-tool visibility tracking and a terminal-result assistant fallback.

**Tech Stack:** TypeScript 5.9, Node test runner, Electron runner, Claude Agent SDK 0.3.187.

---

### Task 1: Structured output intent

**Files:**
- Create: `src/shared/structured-output.ts`
- Create: `test/electron/structured-output.test.ts`
- Modify: `src/electron/libs/runner/runner.ts:409-476,884`

- [ ] **Step 1: Write the failing test**

Test an exported `resolveStructuredOutputIntent(runtimeOutputFormat, currentDisplayPrompt)` function. Assert explicit `json`/`none`, explicit current-turn phrases such as `请用 JSON 输出`, and false results for `StructuredOutput` and `structured_output_retry_exhausted`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:electron:build`

Expected: TypeScript fails because `src/shared/structured-output.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Return `explicit`, `prompt`, or `none`. Match only current prompt phrases using whitespace/word boundaries; do not accept concatenated tool names or underscore identifiers.

- [ ] **Step 4: Connect runner to current display prompt**

Replace the local broad detector with the shared helper and construct `PLAN_OUTPUT_FORMAT_SCHEMA` only when the returned intent is not `none`. Pass `currentDisplayPrompt`, never the stateless `prompt` or `systemPromptAppend`.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:electron:build && node --test dist-test/test/electron/structured-output.test.js`

Expected: all structured-output tests pass.

### Task 2: Visible terminal result fallback

**Files:**
- Modify: `src/electron/libs/runner/runner.ts:494-497,1105-1210,2972-2988`
- Create: `src/shared/runner-result-visibility.ts`
- Create: `test/electron/runner-result-visibility.test.ts`
- Modify: `test/electron/runner-empty-success.test.ts`

- [ ] **Step 1: Write the failing test**

Test pure helpers that track whether a tool call still needs a final visible response and return terminal `result.result` only when that response is still missing. Keep one small source-contract assertion for the runner wiring.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:electron:build`

Expected: TypeScript fails because `src/shared/runner-result-visibility.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement pure activity helpers, track `awaitingVisiblePostToolResponse` in the runner, and synthesize an assistant message from non-empty `result.result` before sending the result. Leave empty-success classification unchanged.

- [ ] **Step 4: Run focused tests**

Run: `npm run test:electron:build && node --test dist-test/test/electron/runner-empty-success.test.js dist-test/test/electron/runner-result-visibility.test.js dist-test/test/electron/structured-output.test.js dist-test/test/electron/runner-status.test.js`

Expected: all focused tests pass.

### Task 3: Verification

**Files:**
- Verify only; no new files.

- [ ] **Step 1: Run Electron compilation and focused tests**

Run: `npm run test:electron:build` followed by the three focused Node test files.

- [ ] **Step 2: Run production Electron transpile**

Run: `npm run transpile:electron`

- [ ] **Step 3: Run targeted lint**

Run: `npx eslint src/shared/structured-output.ts src/shared/runner-result-visibility.ts src/electron/libs/runner/runner.ts test/electron/structured-output.test.ts test/electron/runner-result-visibility.test.ts test/electron/runner-empty-success.test.ts`

- [ ] **Step 4: Check patch hygiene**

Run: `git diff --check` and `git status --short`.

- [ ] **Step 5: Report evidence and remaining risk**

Report exact commands and outcomes. Call out that a live GPT gateway replay is not deterministic in unit tests and remains a manual integration check.

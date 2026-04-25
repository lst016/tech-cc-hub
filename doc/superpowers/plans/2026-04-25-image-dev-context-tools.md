# Image Dev Context Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of `image_to_dev_context` so development tasks with image attachments produce session-scoped Markdown/JSON image documents before the main agent run.

**Architecture:** Add a focused artifact builder under `src/electron/libs`, reuse the existing image model summary path, and wire the trigger in `ipc-handlers.ts` before the main `runClaude` call. The first version emits synthetic stream messages so the execution rail can show the built-in tool node without introducing a new SDK tool protocol.

**Tech Stack:** Electron main process, TypeScript, Node `fs/promises`, Node test runner, existing Anthropic image-model preprocessing.

---

### Task 1: Artifact Builder

**Files:**
- Create: `src/electron/libs/image-dev-context.ts`
- Test: `src/electron/image-dev-context.test.ts`

- [ ] **Step 1: Write failing tests for artifact paths and manifest output**

Add tests that create two fake image attachments with `storagePath` / `storageUri`, call `createImageDevContextArtifacts`, and assert that `manifest.json`, `group-summary.md`, `group-spec.json`, and per-image `summary.md` / `spec.json` files exist.

Run:

```bash
npm run transpile:electron
node --test dist-electron/electron/image-dev-context.test.js
```

Expected: TypeScript fails because `image-dev-context.ts` does not exist.

- [ ] **Step 2: Implement the artifact builder**

Create `image-dev-context.ts` with:

- `ImageDevContextArtifactOptions`
- `ImageDevContextArtifactResult`
- `createImageDevContextArtifacts(options)`
- stable path helpers under `{userData}/session-artifacts/{sessionId}/image-dev-context/{batchId}`

The builder accepts already-produced per-image summaries/spec fragments and writes the session-scoped files.

- [ ] **Step 3: Run the test until green**

Run:

```bash
npm run transpile:electron
node --test dist-electron/electron/image-dev-context.test.js
```

Expected: PASS.

### Task 2: Image Model Document Generation

**Files:**
- Modify: `src/electron/libs/image-preprocessor.ts`
- Modify: `src/electron/libs/image-dev-context.ts`
- Test: `src/electron/image-dev-context.test.ts`

- [ ] **Step 1: Write failing test for model text to structured document conversion**

Add a test that feeds deterministic image-analysis text into the builder and asserts the generated Markdown includes task context and the JSON includes `role`, `summary`, `layout`, `components`, `texts`, `visualConstraints`, `devHints`, and `confidence`.

- [ ] **Step 2: Export a reusable image summary function**

Keep the existing image-model API call path, but add a dev-context wrapper that can request richer structured text for `summary.md` and `spec.json`.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm run transpile:electron
node --test dist-electron/electron/image-dev-context.test.js dist-electron/electron/libs/image-preprocessor-core.test.js
```

Expected: PASS.

### Task 3: Development Image Trigger

**Files:**
- Modify: `src/electron/ipc-handlers.ts`
- Test: `src/electron/image-dev-context.test.ts`

- [ ] **Step 1: Write failing tests for trigger classification**

Extract a pure helper such as `shouldCreateImageDevContext({ taskKind, attachments })` and test:

- returns true for `taskKind = "development"` and at least one image
- returns false for non-development tasks
- returns false for development tasks without images

- [ ] **Step 2: Wire trigger before `runClaude`**

In `session.start` / continue handling, after image attachments are known and `classifyDevLoop` has produced task kind, call the image-dev-context flow before the main agent run.

- [ ] **Step 3: Pass generated docs into the main prompt**

Append a compact note to the prompt that points the main model at `group-summary.md`, `group-spec.json`, and per-image specs. Do not attach raw images by default after successful document generation.

### Task 4: Execution Rail Visibility and Fallback

**Files:**
- Modify: `src/electron/ipc-handlers.ts`
- Modify: `src/shared/activity-rail-model.ts` if needed
- Test: existing build and focused tests

- [ ] **Step 1: Emit synthetic tool messages**

Emit stream messages that look like a visible built-in tool step:

- title: `图片转开发上下文`
- input: image count, trigger reason
- output: generated artifact paths and fallback status

- [ ] **Step 2: Add fallback behavior**

If document generation fails, emit a failed built-in tool message and continue with the existing image preprocessing summary path.

- [ ] **Step 3: Verify model and build**

Run:

```bash
npm run transpile:electron
node --test dist-electron/electron/image-dev-context.test.js
npm run build
```

Expected: PASS, with only existing Vite chunk-size warning if present.

### Task 5: Manual Smoke

**Files:**
- No new files unless a small QA script is useful.

- [ ] **Step 1: Start Electron**

Run:

```bash
npm run dev
```

- [ ] **Step 2: Create a development session with images**

Expected:

- execution rail shows `图片转开发上下文`
- generated document paths are visible in details
- main agent sees generated docs as context
- original image payloads are not persisted into long-lived history

---

## Self-Review

The plan covers the approved spec's first-stage deliverable: session artifacts, dual Markdown/JSON output, development-image trigger, visible execution node, and fallback to existing image summaries. It intentionally defers `ui_spec_to_code` because the spec marks it as a later tool after image context documents are stable.

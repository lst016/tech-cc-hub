# Cowart canvas annotation implementation plan

> **Execution note:** User approved implementation on 2026-07-10 and asked not
> to commit while iterative fixes are in progress.

**Goal:** Port Cowart's image annotation-to-conversation workflow into the
existing Codex Canvas plugin.

**Architecture:** Add persistent annotation objects to the existing Canvas
store and DOM renderer.  A server endpoint composes a selected image and its
related annotations into a project-local PNG and uses the current bound-chat
transport.  Generated results continue to use the established bridge/collector.

## Tasks

### 1. Lock the new object and transport contracts with smoke tests

**Files:**
- Modify: `plugins/codex-canvas/scripts/smoke.mjs`

- [ ] Add failing store tests for persistent annotation arrows/labels and
  source-image relationship preservation.
- [ ] Add failing route tests for the annotation edit endpoint and its bound
  chat payload.
- [ ] Add static interaction checks for annotation tool and edit action.

### 2. Persist Cowart-style annotation objects

**Files:**
- Modify: `plugins/codex-canvas/src/store.mjs`

- [ ] Accept, normalise, patch and reload `annotation-arrow` objects.
- [ ] Retain the source image relationship and annotation label metadata.
- [ ] Reject invalid points and preserve backwards compatibility for existing
  drawing/text/image objects.

### 3. Add canvas interaction and rendering

**Files:**
- Modify: `plugins/codex-canvas/public/index.html`
- Modify: `plugins/codex-canvas/public/styles.css`
- Modify: `plugins/codex-canvas/public/app.js`

- [ ] Add 标注 and 按标注修改 controls.
- [ ] Implement pointer down/move/up arrow creation with short-drag rejection.
- [ ] Automatically open the linked text label on successful arrow creation.
- [ ] Render/select/delete/reposition annotation arrows and labels with image
  ownership visibly clear.

### 4. Render the annotation reference and continue the bound conversation

**Files:**
- Modify: `plugins/codex-canvas/src/server.mjs`

- [ ] Add a route that fetches the source image and related annotations.
- [ ] Rasterise the image, arrowheads and labels to a project-local PNG.
- [ ] Send the PNG and Cowart-equivalent editing instruction through
  `sendImageToBoundChat` rather than a generic local image job.
- [ ] Return actionable transport errors without touching canvas objects.

### 5. Verify user-visible behaviour

**Files:**
- Modify: `plugins/codex-canvas/scripts/visual-smoke.mjs`
- Update only if expected layout changes: `plugins/codex-canvas/scripts/reference-screenshots/*`

- [ ] Run plugin smoke tests and the new focused checks.
- [ ] Run visual smoke and visual regression.
- [ ] Run the scoped Electron bridge tests and diff validation.

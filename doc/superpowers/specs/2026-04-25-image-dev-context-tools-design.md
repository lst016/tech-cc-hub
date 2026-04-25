# Image Dev Context Tools Design

**Date:** 2026-04-25
**Status:** approved for implementation
**Scope:** Development-task image handling, session-scoped image documents, and future UI-spec-to-code tooling

## Background

`tech-cc-hub` already has image protection logic that summarizes image attachments and prevents raw image/base64 content from bloating durable chat history. This solved the most urgent context-overflow problem, but the current behavior is still mostly implicit:

1. The user cannot clearly see that an image was converted into development context.
2. The main agent may still treat image handling as an incidental preprocessor instead of a first-class development capability.
3. Multi-image UI development tasks need both per-image facts and a grouped interpretation.
4. Future UI implementation work needs a stable bridge from image understanding to project-aware code changes.

The product direction is to make image handling a visible built-in capability: convert development-task images into reusable session documents first, then let the main agent work from those documents. Original images remain available only when the task genuinely needs visual review or UI reconstruction.

## Goals

1. For `development + images` tasks, generate structured session-scoped image context before the main agent starts development work.
2. Produce both human-readable Markdown and machine-readable JSON for each image and for the whole image batch.
3. Show the image conversion as a visible built-in tool node in the execution rail.
4. Keep the current image-summary interceptor as a fallback path when document generation fails.
5. Leave room for a second-stage `ui_spec_to_code` tool that turns image-derived UI specs into project-aware code patches.

## Non-Goals

1. Do not store image-derived documents in the user's project directory in the first version.
2. Do not remove the existing image interception and summary fallback.
3. Do not attempt full screenshot-to-code generation in the first version.
4. Do not persist raw base64 image content in long-lived session history.
5. Do not make every casual image upload trigger the development-document pipeline.

## Design Decisions

### 1. Built-In Tool Main Path

Add a built-in tool conceptually named `image_to_dev_context`.

It is triggered by the host application, not by the user manually typing a tool call. The trigger condition is:

```text
taskKind = development
and current user turn contains one or more image attachments
```

When triggered, the tool generates a session-local batch of image documents and emits a visible execution event. The main agent then receives the generated document summaries and paths as its primary image context.

The existing image preprocessor remains in place. If `image_to_dev_context` fails, the system falls back to the current summary-only image preprocessing behavior and continues the run.

### 2. Session-Scoped Artifact Directory

Generated artifacts should live under the app user-data area, not under the user's project.

Recommended layout:

```text
{userData}/session-artifacts/{sessionId}/image-dev-context/{batchId}/
  manifest.json
  group-summary.md
  group-spec.json
  images/
    {imageId}/
      source-meta.json
      summary.md
      spec.json
```

The session scope prevents project pollution. The batch scope prevents later image turns from overwriting earlier evidence.

### 3. Artifact Contract

`manifest.json` is the system index for a batch. It should contain:

```json
{
  "version": 1,
  "sessionId": "session-id",
  "batchId": "batch-id",
  "createdAt": "2026-04-25T00:00:00.000Z",
  "triggerReason": "development_with_images",
  "imageCount": 2,
  "groupSummaryPath": "group-summary.md",
  "groupSpecPath": "group-spec.json",
  "images": [
    {
      "imageId": "img_001",
      "fileName": "screen.png",
      "summaryPath": "images/img_001/summary.md",
      "specPath": "images/img_001/spec.json",
      "sourceMetaPath": "images/img_001/source-meta.json",
      "sourceStoragePath": "..."
    }
  ],
  "fallbackUsed": false
}
```

Per-image `summary.md` is optimized for the main agent to skim. It should cover:

1. Image role and likely purpose.
2. Visible page or module structure.
3. Important UI elements, text, forms, tables, errors, or state.
4. Details most relevant to the user's current development request.
5. Uncertain or low-confidence observations.

Per-image `spec.json` is optimized for workflow and tooling. First-version schema:

```json
{
  "version": 1,
  "imageId": "img_001",
  "role": "ui_mock",
  "source": {
    "fileName": "screen.png",
    "storagePath": "...",
    "mimeType": "image/png"
  },
  "taskContext": {
    "prompt": "user prompt",
    "intent": "frontend_dev"
  },
  "summary": "short stable summary",
  "layout": {
    "pageType": "form",
    "regions": [
      {
        "name": "header",
        "description": "top navigation and status area",
        "elements": ["title", "tabs", "actions"]
      }
    ]
  },
  "components": [
    {
      "type": "button",
      "label": "Generate",
      "text": "Generate",
      "locationHint": "right panel footer",
      "importance": "high"
    }
  ],
  "texts": [
    {
      "value": "Prompt Ledger",
      "kind": "heading"
    }
  ],
  "visualConstraints": {
    "styleHints": ["dense", "sidebar-layout"],
    "issues": ["prompt distribution panel is occluded"]
  },
  "devHints": {
    "probableTargets": ["ActivityRail", "PromptLedger"],
    "suggestedFocus": ["layout", "overflow", "panel height"]
  },
  "confidence": 0.82
}
```

Group artifacts should aggregate rather than duplicate all single-image details.

`group-summary.md` should explain:

1. What the image group represents.
2. How the images relate to each other.
3. Shared UI or workflow patterns.
4. Differences between screenshots.
5. What the main agent should inspect first.

`group-spec.json` should contain:

```json
{
  "version": 1,
  "batchId": "batch-id",
  "imageIds": ["img_001", "img_002"],
  "groupRole": "ui_flow",
  "overallSummary": "The screenshots describe a settings workflow.",
  "relationships": [
    {
      "from": "img_001",
      "to": "img_002",
      "type": "same_page_different_state",
      "description": "Second image shows the expanded detail panel."
    }
  ],
  "sharedComponents": ["tabs", "right rail", "drawer"],
  "developmentFocus": ["layout stability", "overflow behavior"],
  "recommendedInputsForAgent": [
    "group-summary.md",
    "group-spec.json"
  ],
  "confidence": 0.8
}
```

### 4. Main-Agent Input Policy

For the first main-agent run after image conversion:

1. Provide `group-summary.md` and `group-spec.json` as the primary image context.
2. Include per-image summary/spec paths and short excerpts.
3. Do not include raw image payloads by default.
4. If the task is visual reconstruction, UI comparison, screenshot diffing, or design fidelity work, allow the runtime to rehydrate the original images as runtime-only context.

This keeps most development tasks lightweight while preserving high-fidelity evidence for tasks that need it.

### 5. Execution Rail Presentation

Show `image_to_dev_context` as a visible built-in tool node.

Recommended node text:

```text
Title: 图片转开发上下文
Input: 3 张图片，开发任务，生成会话级图片文档
Output: 已生成 3 份单图文档 + 1 份组级文档
```

Expandable details should include:

1. `manifest.json`
2. `group-summary.md`
3. `group-spec.json`
4. Per-image `summary.md` and `spec.json`
5. Whether fallback was used
6. Failure message if fallback was used

This makes the behavior inspectable and avoids the current feeling of hidden magic.

### 6. Fallback Behavior

If `image_to_dev_context` fails:

1. Emit a failed tool node with the error summary.
2. Mark `fallbackUsed = true` where possible.
3. Continue through the existing image preprocessor summary path.
4. Do not send raw images directly as the default fallback.

The user should see that the primary image-document path failed, but the development task should continue.

## Future Tool: `ui_spec_to_code`

`ui_spec_to_code` is a second-stage tool. It consumes image-derived specs and current project context to generate project-aware UI code changes.

It should not perform image understanding itself. It should read:

1. `group-spec.json`
2. One or more per-image `spec.json` files
3. Project profile and technology stack
4. Target file or component context

The first version should support three modes:

1. `scaffold`: generate a page or component skeleton from the UI spec.
2. `patch`: apply minimal changes to an existing page or component.
3. `repair`: compare current implementation intent against the UI spec and repair visual or layout drift.

For `tech-cc-hub`, `patch` and `repair` should come before full page generation because the product is primarily used to develop existing projects.

Execution rail node:

```text
Title: UI规范生成代码
Input: group-spec + target component context
Output: generated patch / scaffold / repair result
```

## Integration Points

Likely first-version touch points:

1. `src/electron/libs/image-preprocessor.ts`
   Reuse the existing image-model call path and summary instruction structure.

2. `src/electron/libs/attachment-store.ts`
   Reuse stored source image references and avoid durable raw base64.

3. `src/electron/ipc-handlers.ts`
   Trigger `image_to_dev_context` before the main `runClaude` call for `development + images`.

4. `src/electron/libs/runner.ts`
   Keep raster image read guards and runtime-only rehydration behavior.

5. `src/shared/activity-rail-model.ts` and `src/ui/components/ActivityRail.tsx`
   Render the built-in tool node and artifact detail sections.

## Verification

Minimum implementation verification should include:

1. Unit tests for artifact path generation and manifest schema.
2. Unit tests for `development + images` trigger behavior.
3. Fallback test where image document generation fails and current summary preprocessing continues.
4. Build checks:
   - `npm run transpile:electron`
   - `npm run build`
5. Electron manual check:
   - Start a development session with images.
   - Confirm the execution rail shows `图片转开发上下文`.
   - Confirm the main run references generated documents rather than raw image payloads.
   - Confirm visual-review prompts can still rehydrate original images.

## Implementation Order

1. Add session-artifact path helpers and the image-dev-context artifact writer.
2. Implement `image_to_dev_context` using the existing image model configuration.
3. Wire `development + images` routing before the main agent call.
4. Emit visible built-in tool events for the execution rail.
5. Add fallback handling to the existing summary preprocessor.
6. Add focused tests and run build verification.
7. Implement `ui_spec_to_code` later, after the image-context documents are stable.

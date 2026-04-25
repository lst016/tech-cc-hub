# Default Dev Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tech-cc-hub` automatically classify development tasks, inject the right Dev Loop instruction, and show the chosen loop in Trace Viewer.

**Architecture:** Add a shared pure classifier in `src/shared/dev-loop.ts`, wire it into Electron session start/continue before calling the Agent SDK, and expose a typed `dev_loop` stream message to the existing activity rail model. The first implementation is an MVP: classification, prompt injection, and Trace visibility; actual browser/Electron automation loops remain follow-up work.

**Tech Stack:** TypeScript, Electron IPC, React Trace Viewer model, Node test runner.

---

## File Structure

- Create `src/shared/dev-loop.ts`
  - Owns `DevLoopMode`, `DevLoopTaskKind`, `DevLoopMessage`, classification rules, prompt addendum creation, prompt injection, and stream message construction.
- Create `test/electron/dev-loop.test.ts`
  - Tests the pure classifier and prompt injection behavior.
- Modify `test/electron/tsconfig.json`
  - Includes the new shared module and test file in the Electron test compile.
- Modify `src/electron/types.ts`
  - Adds `DevLoopMessage` to `StreamMessage`.
- Modify `src/electron/ipc-handlers.ts`
  - Classifies `session.start` and `session.continue`, emits a `dev_loop` stream message, injects the addendum into the actual prompt sent to the runner, and keeps `stream.user_prompt` as the original user text.
- Modify `src/shared/activity-rail-model.ts`
  - Converts `dev_loop` messages into Trace nodes with mode, task kind, confidence, reasons, and injected instructions.
- Modify `test/electron/activity-rail-model.test.ts`
  - Verifies Trace Viewer receives a Dev Loop node.

## Task 1: Shared Dev Loop Classifier

**Files:**
- Create: `src/shared/dev-loop.ts`
- Create: `test/electron/dev-loop.test.ts`
- Modify: `test/electron/tsconfig.json`

- [ ] **Step 1: Write the failing classifier tests**

Create `test/electron/dev-loop.test.ts` with tests for:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDevLoopToPrompt,
  classifyDevLoop,
  createDevLoopMessage,
} from "../../src/shared/dev-loop.js";

test("classifies screenshot or image tasks as visual dev loop", () => {
  const result = classifyDevLoop({
    prompt: "按照这张截图复刻页面布局",
    attachments: [{ id: "img-1", kind: "image", name: "target.png" }],
    cwd: "D:\\tool\\tech-cc-hub",
  });

  assert.equal(result.taskKind, "visual");
  assert.equal(result.loopMode, "visual-dev");
  assert.ok(result.reasons.some((reason) => reason.includes("附件")));
});

test("classifies tech-cc-hub UI tasks as electron window loop", () => {
  const result = classifyDevLoop({
    prompt: "修复右侧 Trace Viewer 的 UI 布局并截图验证",
    cwd: "D:\\tool\\tech-cc-hub",
  });

  assert.equal(result.taskKind, "electron");
  assert.equal(result.loopMode, "electron-window");
});

test("classifies backend code tasks as dev loop", () => {
  const result = classifyDevLoop({
    prompt: "修复后端 API 的分页 bug 并补测试",
    cwd: "D:\\workspace\\service",
  });

  assert.equal(result.taskKind, "code");
  assert.equal(result.loopMode, "dev");
});

test("keeps documentation-only tasks out of dev loop", () => {
  const result = classifyDevLoop({
    prompt: "更新 README 里的安装说明，不改代码",
    cwd: "D:\\tool\\tech-cc-hub",
  });

  assert.equal(result.taskKind, "docs");
  assert.equal(result.loopMode, "none");
});

test("injects instructions only when a loop is active", () => {
  const dev = classifyDevLoop({ prompt: "实现一个 React 组件", cwd: "D:\\workspace\\app" });
  const injected = applyDevLoopToPrompt("实现一个 React 组件", dev);

  assert.notEqual(injected, "实现一个 React 组件");
  assert.ok(injected.includes("Dev Loop"));
  assert.ok(injected.includes("验证"));

  const docs = classifyDevLoop({ prompt: "整理开发规范文档", cwd: "D:\\workspace\\app" });
  assert.equal(applyDevLoopToPrompt("整理开发规范文档", docs), "整理开发规范文档");
});

test("creates a typed dev loop stream message", () => {
  const classification = classifyDevLoop({ prompt: "按 Figma 改页面", cwd: "D:\\workspace\\app" });
  const message = createDevLoopMessage(classification, "classified");

  assert.equal(message.type, "dev_loop");
  assert.equal(message.phase, "classified");
  assert.equal(message.loopMode, "visual-dev");
  assert.ok(message.summary.includes("Dev Loop"));
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
```

Expected: fails with `Cannot find module '../../src/shared/dev-loop.js'`.

- [ ] **Step 3: Implement the classifier**

Add `src/shared/dev-loop.ts` with:

```ts
export type DevLoopTaskKind = "none" | "code" | "frontend" | "visual" | "electron" | "docs";
export type DevLoopMode = "none" | "dev" | "visual-dev" | "electron-window";
export type DevLoopPhase = "classified" | "prompt_injected" | "verified" | "paused" | "completed";

export type DevLoopClassification = {
  taskKind: DevLoopTaskKind;
  loopMode: DevLoopMode;
  confidence: number;
  reasons: string[];
  promptAddendum: string;
};

export type DevLoopAttachmentLike = {
  kind?: string;
  type?: string;
  name?: string;
  mimeType?: string;
};

export type DevLoopMessage = {
  type: "dev_loop";
  phase: DevLoopPhase;
  taskKind: DevLoopTaskKind;
  loopMode: DevLoopMode;
  confidence: number;
  summary: string;
  reasons: string[];
  instructions?: string;
  iteration?: number;
  capturedAt?: number;
  historyId?: string;
};
```

The implementation must use deterministic keyword rules:

- Documentation-only prompts containing `文档`, `README`, `说明`, `计划`, `规范` plus exclusion phrases such as `不改代码` return `docs/none`.
- Image attachments or keywords `截图`, `图片`, `Figma`, `复刻`, `按图`, `视觉`, `设计稿` return `visual/visual-dev`.
- `tech-cc-hub` cwd plus UI/window keywords `Trace`, `右侧`, `右栏`, `窗口`, `Electron`, `客户端`, `UI`, `布局` returns `electron/electron-window`.
- Frontend keywords `React`, `Vue`, `CSS`, `Tailwind`, `组件`, `页面`, `样式`, `布局` return `frontend/visual-dev`.
- Development keywords `修复`, `实现`, `开发`, `重构`, `测试`, `bug`, `API`, `接口`, `代码` return `code/dev`.
- Otherwise return `none/none`.

- [ ] **Step 4: Run the classifier tests to verify GREEN**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/dev-loop.test.js
```

Expected: all `dev-loop` tests pass.

- [ ] **Step 5: Commit classifier**

Run:

```bash
git add src/shared/dev-loop.ts test/electron/dev-loop.test.ts test/electron/tsconfig.json
git commit -m "feat: classify default dev loop tasks"
```

## Task 2: Prompt Injection and Stream Event Wiring

**Files:**
- Modify: `src/electron/types.ts`
- Modify: `src/electron/ipc-handlers.ts`

- [ ] **Step 1: Extend stream message typing**

In `src/electron/types.ts`, import `DevLoopMessage` and extend:

```ts
export type StreamMessage = (SDKMessage | UserPromptMessage | PromptLedgerMessage | DevLoopMessage) & {
  capturedAt?: number;
  historyId?: string;
};
```

- [ ] **Step 2: Wire `session.start`**

In `src/electron/ipc-handlers.ts`, before `buildPromptLedgerForRun`, classify:

```ts
const devLoop = classifyDevLoop({
  prompt: event.payload.prompt,
  attachments: event.payload.attachments,
  cwd,
  runSurface: event.payload.runtime?.runSurface,
});
const promptForRun = applyDevLoopToPrompt(event.payload.prompt, devLoop);
```

Emit:

```ts
emit({
  type: "stream.message",
  payload: {
    sessionId: session.id,
    message: createDevLoopMessage(devLoop, devLoop.loopMode === "none" ? "classified" : "prompt_injected"),
  },
});
```

Use `promptForRun` for `buildPromptLedgerForRun` and `runClaude`, while keeping `stream.user_prompt` as `event.payload.prompt`.

- [ ] **Step 3: Wire `session.continue`**

After the existing continuation prompt is resolved, classify the original visible prompt and inject into the actual `prompt` variable:

```ts
const devLoop = classifyDevLoop({
  prompt: event.payload.prompt,
  attachments: attachmentsForRun,
  cwd: session.cwd,
  runSurface: event.payload.runtime?.runSurface ?? session.runSurface,
});
const promptForRun = applyDevLoopToPrompt(prompt, devLoop);
```

Use `promptForRun` for `buildPromptLedgerForRun` and `runClaude`, while preserving original visible user prompt.

- [ ] **Step 4: Build Electron TypeScript**

Run:

```bash
npm run transpile:electron
```

Expected: TypeScript exits with code 0.

- [ ] **Step 5: Commit wiring**

Run:

```bash
git add src/electron/types.ts src/electron/ipc-handlers.ts
git commit -m "feat: inject default dev loop prompts"
```

## Task 3: Trace Viewer Dev Loop Node

**Files:**
- Modify: `src/shared/activity-rail-model.ts`
- Modify: `test/electron/activity-rail-model.test.ts`

- [ ] **Step 1: Write failing Trace model test**

Add a test in `test/electron/activity-rail-model.test.ts`:

```ts
test("shows dev loop classification as a trace node", () => {
  const result = buildActivityRailModel({
    messages: [
      {
        type: "dev_loop",
        phase: "prompt_injected",
        taskKind: "electron",
        loopMode: "electron-window",
        confidence: 0.9,
        summary: "Dev Loop 已启用：Electron 真窗口闭环。",
        reasons: ["tech-cc-hub UI 任务需要 Electron 真窗口验收"],
        instructions: "启动 Electron 真窗口并截图验证。",
        capturedAt: 1,
      },
    ],
  });

  const node = result.timelineItems.find((item) => item.title.includes("Dev Loop"));
  assert.ok(node);
  assert.equal(node.nodeKind, "evaluation");
  assert.ok(node.chips.some((chip) => chip.label === "electron-window"));
  assert.ok(node.detail.includes("Electron 真窗口"));
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/activity-rail-model.test.js
```

Expected: fails because `dev_loop` messages are not mapped into timeline nodes yet.

- [ ] **Step 3: Implement Trace mapping**

In `src/shared/activity-rail-model.ts`:

- Import `DevLoopMessage`.
- Extend `StreamMessageLike`.
- Add `isDevLoopMessage`.
- Add `buildDevLoopTimelineItem`.
- In the main message loop, handle `dev_loop` before SDK message handling.

The node should use:

- `nodeKind: "evaluation"`
- title `Dev Loop：${loopModeLabel}`
- chips for `taskKind`, `loopMode`, confidence percentage
- detail sections for `阶段`, `任务类型`, `闭环模式`, `原因`, `注入指令`

- [ ] **Step 4: Run Trace tests to verify GREEN**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/activity-rail-model.test.js
```

Expected: all activity rail tests pass.

- [ ] **Step 5: Commit Trace mapping**

Run:

```bash
git add src/shared/activity-rail-model.ts test/electron/activity-rail-model.test.ts
git commit -m "feat: show dev loop in trace viewer"
```

## Task 4: Full Verification and Restart

**Files:**
- No new source files expected.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/dev-loop.test.js
node --test dist-test/test/electron/activity-rail-model.test.js
node --test dist-test/test/electron/session-analysis-page.test.js
```

Expected: all focused tests pass.

- [ ] **Step 2: Run project verification**

Run:

```bash
npm run transpile:electron
npm run build
```

Expected: both commands exit with code 0. Vite chunk-size warnings are acceptable.

- [ ] **Step 3: Restart the Electron app**

Stop existing `tech-cc-hub` Electron/Vite processes and run:

```bash
cmd.exe /c npm run dev
```

Then verify:

```bash
curl http://localhost:4173/
```

Expected: HTTP 200 from the local Vite server and Electron window launched.

- [ ] **Step 4: Commit or report final state**

If Task 4 needed source changes, commit them. Otherwise report:

- branch name
- commits created
- commands run
- whether Electron restarted

## Self-Review

- Spec coverage: MVP items are covered by Task 1 classification, Task 2 prompt injection, and Task 3 Trace visibility. Full automatic screenshot/visual diff automation is intentionally left for follow-up because the design labels it as later expansion beyond the first MVP.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation placeholders remain.
- Type consistency: `DevLoopMode`, `DevLoopTaskKind`, `DevLoopPhase`, `DevLoopClassification`, and `DevLoopMessage` are named consistently across all tasks.

# Side Conversation Tab Session Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each side-chat Tab one temporary multi-turn conversation that reuses its Runner until runtime controls change or the Runner is stopped.

**Architecture:** `BtwRuntimeManager` owns one live Runner and one resolved runtime-config snapshot per thread. Matching follow-up turns use `appendPrompt`; model, reasoning, permission, stopped, closed, or failed Runner states rebuild from the fixed parent snapshot plus the Tab's private history. The IPC boundary prepares attachments once and passes separate display and agent forms into the manager.

**Tech Stack:** TypeScript, Electron main process, Zustand, Node test runner, ESLint.

---

### Task 1: Lock Tab-level Runner reuse with failing tests

**Files:**
- Modify: `test/electron/btw-runtime-manager.test.ts`
- Test: `test/electron/btw-runtime-manager.test.ts`

- [ ] **Step 1: Extend the harness to record appended prompts**

Add `appendedPrompts` and make each fake `RunnerHandle.appendPrompt` record the Runner session ID, prompt, attachments, and options.

```ts
const appendedPrompts: Array<{
  sessionId: string;
  prompt: string;
  attachments: PromptAttachment[];
  options?: { displayPrompt?: string; workspaceContext?: LinkedWorkspaceContext };
}> = [];
```

- [ ] **Step 2: Add a failing same-config multi-turn test**

Create one thread, send the first prompt, route an assistant message and completed status, then send a second prompt with the same runtime controls.

```ts
assert.equal(harness.runs.length, 1);
assert.equal(harness.appendedPrompts.length, 1);
assert.equal(harness.appendedPrompts[0].prompt, "第二轮追问");
assert.equal(harness.continuationHistories.length, 1);
```

- [ ] **Step 3: Add a failing config-change rebuild test**

After the first completed turn, send the next prompt with a different model. Assert that the old handle is aborted, a second Runner is created, `appendPrompt` is not used, and the second continuation history contains the first private turn.

```ts
assert.equal(harness.runs.length, 2);
assert.deepEqual(harness.aborted, [created.threadId]);
assert.equal(harness.appendedPrompts.length, 0);
assert.equal(harness.runs[1].runtime?.model, "gpt-next");
```

- [ ] **Step 4: Run the focused test and verify RED**

Run `npm run test:electron:build` and then `node --test dist-test/test/electron/btw-runtime-manager.test.js`.

Expected: the same-config test reports two Runner creations and zero appends.

### Task 2: Reuse or rebuild the thread Runner

**Files:**
- Modify: `src/electron/libs/btw-runtime-manager.ts`
- Test: `test/electron/btw-runtime-manager.test.ts`

- [ ] **Step 1: Store the resolved Runner configuration per runtime**

Add an internal value containing `model`, `reasoningMode`, and `permissionMode`, plus equality and resolution helpers. Add optional `runnerConfig` to `BtwRuntime`.

```ts
type BtwRunnerConfig = {
  model?: string;
  reasoningMode?: RuntimeOverrides["reasoningMode"];
  permissionMode?: RuntimeOverrides["permissionMode"];
};
```

- [ ] **Step 2: Split `send` into append and rebuild paths**

Reuse the handle only when it exists, is open, and has the same configuration. Build stateless continuation only for first send or rebuild.

```ts
const canAppend = Boolean(runtime.handle)
  && !runtime.handle!.isClosed()
  && sameRunnerConfig(runtime.runnerConfig, nextConfig);
```

Record and emit the user turn once. The append path calls:

```ts
await runtime.handle!.appendPrompt(agentPrompt, attachments, {
  displayPrompt,
  workspaceContext: input.workspaceContext,
});
```

The rebuild path increments generation, aborts the previous handle, starts a Runner from the fixed snapshot plus private history, and stores the returned handle and configuration.

- [ ] **Step 3: Make stop and append failure force later rebuild**

`stop` clears both `handle` and `runnerConfig`. If append throws, increment generation, abort and clear the handle/config, mark only that thread as error, and emit `btw.runner.error` plus `btw.thread.status`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npm run test:electron:build` and `node --test dist-test/test/electron/btw-runtime-manager.test.js`.

Expected: all manager tests pass, including same-config append, config-change rebuild, plan isolation, stop, close, and late-event isolation.

### Task 3: Unify attachment preparation and verify the feature slice

**Files:**
- Modify: `src/electron/ipc-handlers.ts`
- Modify: `test/electron/side-conversation-background-session.test.ts`

- [ ] **Step 1: Add a failing IPC source-contract assertion**

Require the BTW send branch to call `preparePromptAttachmentsForSession` and pass `agentAttachments` plus `displayAttachments` to the manager.

- [ ] **Step 2: Run the IPC test and verify RED**

Run the Electron test build and `node --test dist-test/test/electron/side-conversation-background-session.test.js`.

Expected: failure because the current branch forwards renderer attachments directly.

- [ ] **Step 3: Prepare attachments at the IPC boundary**

```ts
const { displayAttachments, agentAttachments } = await preparePromptAttachmentsForSession(event.payload.attachments);
await btwRuntimeManager.send({
  threadId: event.payload.threadId,
  prompt: event.payload.prompt,
  agentPrompt: event.payload.agentPrompt,
  workspaceContext: event.payload.workspaceContext,
  attachments: agentAttachments,
  displayAttachments,
  runtime: event.payload.runtime,
});
```

- [ ] **Step 4: Run complete verification**

Run the Electron test build; the manager, store, background-session, and UI side-chat tests; scoped ESLint on the four changed source/test files; and `git diff --check`.

Expected: compilation exits 0, all side-chat tests pass, ESLint exits 0, and the diff check reports no whitespace errors.

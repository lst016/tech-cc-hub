# Project Development Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first cross-project Project Development Runtime MVP: persistent project profiles, first-shot context packs, prompt injection, and Trace visibility.

**Architecture:** Keep the project runtime as pure shared logic plus a thin Electron persistence layer. `src/shared/project-profile.ts` detects stack, commands, preview targets, guardrails, and context packs; `SessionStore` persists profiles in `project_profiles`; `ipc-handlers.ts` loads/generates the profile before Agent runs and injects a context pack into the prompt; `activity-rail-model.ts` renders profile/context-pack messages as Trace nodes.

**Tech Stack:** TypeScript, Electron, better-sqlite3, Node test runner, existing Dev Loop and Activity Rail model.

---

## File Structure

- Create `src/shared/project-profile.ts`
  - Pure types and functions for profile detection, context-pack generation, prompt injection, and stream message creation.
- Create `test/electron/project-profile.test.ts`
  - Tests profile detection and context-pack prompt generation from synthetic file manifests.
- Modify `test/electron/tsconfig.json`
  - Includes the new shared module and test file.
- Modify `src/electron/libs/session-store.ts`
  - Adds `project_profiles` table and methods to upsert/load profiles by `cwd`.
- Create `test/electron/session-store-project-profile.test.ts`
  - Tests profile persistence using a temp SQLite database.
- Modify `src/electron/types.ts`
  - Adds `ProjectRuntimeMessage` to `StreamMessage`.
- Modify `src/electron/ipc-handlers.ts`
  - Generates/loads profile and context pack for `session.start` and `session.continue`, emits Trace messages, and injects context pack before Dev Loop addendum.
- Modify `src/shared/activity-rail-model.ts`
  - Renders `project_runtime` messages as Trace nodes.
- Modify `test/electron/activity-rail-model.test.ts`
  - Verifies Project Runtime nodes appear in the Trace model.

## Task 1: Pure Project Profile and Context Pack

**Files:**
- Create: `src/shared/project-profile.ts`
- Create: `test/electron/project-profile.test.ts`
- Modify: `test/electron/tsconfig.json`

- [ ] **Step 1: Write failing tests**

Create tests that assert:

```ts
const profile = buildProjectProfile({
  cwd: "D:\\workspace\\demo",
  files: [
    { path: "package.json", text: JSON.stringify({ scripts: { dev: "vite", build: "tsc -b && vite build", test: "vitest" }, dependencies: { react: "^19.0.0", vite: "^7.0.0" } }) },
    { path: "AGENTS.md", text: "UI 默认中文；不要清理未跟踪文件。" },
  ],
});

assert.equal(profile.cwd, "D:\\workspace\\demo");
assert.ok(profile.stack.some((item) => item.name === "React"));
assert.ok(profile.stack.some((item) => item.name === "Vite"));
assert.ok(profile.commands.some((item) => item.kind === "dev" && item.command === "npm run dev"));
assert.ok(profile.previewTargets.some((item) => item.kind === "web"));
assert.ok(profile.guardrails.some((item) => item.rule.includes("不要清理未跟踪文件")));
```

Also test:

```ts
const pack = buildFirstShotContextPack({
  profile,
  taskKind: "frontend",
  loopMode: "visual-dev",
  prompt: "修复登录页布局",
});
const injected = applyProjectRuntimeToPrompt("修复登录页布局", pack);

assert.ok(injected.includes("Project Profile"));
assert.ok(injected.includes("First-Shot Context Pack"));
assert.ok(injected.includes("npm run dev"));
assert.ok(injected.includes("npm run build"));
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
```

Expected: fails because `src/shared/project-profile.ts` does not exist.

- [ ] **Step 3: Implement pure module**

Implement types:

```ts
export type ProjectStackKind = "frontend" | "backend" | "electron" | "java" | "node" | "python" | "docs" | "unknown";
export type ProjectCommandKind = "install" | "dev" | "build" | "test" | "lint" | "typecheck" | "start" | "custom";
export type PreviewTargetKind = "web" | "electron" | "mobile" | "api-docs" | "unknown";
export type ProjectRuntimePhase = "profile_loaded" | "context_pack_generated";
```

Implement:

- `buildProjectProfile(input)`
- `buildFirstShotContextPack(input)`
- `applyProjectRuntimeToPrompt(prompt, pack)`
- `createProjectRuntimeMessage(phase, profile, pack?)`

Detection rules:

- `package.json` dependencies/scripts detect Node, React, Vue, Vite, Next, Electron.
- `pom.xml` detects Java/Maven.
- `build.gradle` detects Java/Gradle.
- `pyproject.toml` or `requirements.txt` detects Python.
- `AGENTS.md` / `CLAUDE.md` produce guardrails and important files.
- `npm run dev/build/test/lint/typecheck` commands are generated from matching scripts.
- Vite dev implies web preview target on port `5173`; Electron script/dependency implies electron preview.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/project-profile.test.js
```

Expected: all project profile tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/project-profile.ts test/electron/project-profile.test.ts test/electron/tsconfig.json
git commit -m "feat: detect project development profiles"
```

## Task 2: Persist Project Profiles

**Files:**
- Modify: `src/electron/libs/session-store.ts`
- Create: `test/electron/session-store-project-profile.test.ts`
- Modify: `test/electron/tsconfig.json`

- [ ] **Step 1: Write failing persistence test**

Test with a temp db:

```ts
const store = new SessionStore(dbPath);
const profile = buildProjectProfile({ cwd: tempProject, files: [{ path: "package.json", text: JSON.stringify({ scripts: { build: "vite build" } }) }] });
store.upsertProjectProfile(profile);
const loaded = store.getProjectProfile(tempProject);

assert.equal(loaded?.cwd, tempProject);
assert.ok(loaded?.commands.some((command) => command.command === "npm run build"));
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
```

Expected: fails because `SessionStore` has no project profile methods.

- [ ] **Step 3: Add persistence**

Add table:

```sql
create table if not exists project_profiles (
  cwd text primary key,
  data text not null,
  updated_at integer not null
)
```

Add methods:

- `getProjectProfile(cwd: string): ProjectProfile | null`
- `upsertProjectProfile(profile: ProjectProfile): void`

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/session-store-project-profile.test.js
```

Expected: persistence test passes.

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/session-store.ts test/electron/session-store-project-profile.test.ts test/electron/tsconfig.json
git commit -m "feat: persist project profiles"
```

## Task 3: Inject Context Pack and Emit Runtime Trace

**Files:**
- Modify: `src/electron/types.ts`
- Modify: `src/electron/ipc-handlers.ts`
- Modify: `src/shared/activity-rail-model.ts`
- Modify: `test/electron/activity-rail-model.test.ts`

- [ ] **Step 1: Write failing Trace test**

Add a model test with:

```ts
{
  type: "project_runtime",
  phase: "context_pack_generated",
  profileId: "profile-demo",
  cwd: "D:\\workspace\\demo",
  summary: "Context Pack 已生成",
  stack: ["React", "Vite"],
  commands: ["npm run dev", "npm run build"],
  guardrails: ["不要清理未跟踪文件"],
}
```

Assert timeline includes `Project Profile` or `Context Pack`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
```

Expected: fails because stream model does not accept `project_runtime`.

- [ ] **Step 3: Wire types and Trace mapping**

- Add `ProjectRuntimeMessage` to `StreamMessage`.
- Add to activity model `StreamMessageLike`.
- Map `project_runtime` to `nodeKind: "evaluation"`, `filterKey: "flow"`, title `Project Runtime：...`.

- [ ] **Step 4: Wire IPC injection**

In `session.start` and `session.continue`:

1. Load existing profile by `cwd`.
2. If missing, build from project manifest files.
3. Persist profile.
4. Build context pack using Dev Loop classification.
5. Emit `project_runtime` message.
6. Apply context pack to prompt before Dev Loop injection.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/activity-rail-model.test.js
npm run transpile:electron
```

Expected: tests and Electron TS pass.

- [ ] **Step 6: Commit**

```bash
git add src/electron/types.ts src/electron/ipc-handlers.ts src/shared/activity-rail-model.ts test/electron/activity-rail-model.test.ts
git commit -m "feat: inject project runtime context packs"
```

## Task 4: Full Verification and Restart

**Files:**
- No new files expected.

- [ ] **Step 1: Run focused tests**

```bash
npx tsc --project test/electron/tsconfig.json
node --test dist-test/test/electron/project-profile.test.js
node --test dist-test/test/electron/session-store-project-profile.test.js
node --test dist-test/test/electron/activity-rail-model.test.js
node --test dist-test/test/electron/dev-loop.test.js
node --test dist-test/test/electron/session-analysis-page.test.js
```

- [ ] **Step 2: Run builds**

```bash
npm run transpile:electron
npm run build
```

- [ ] **Step 3: Restart Electron**

Stop existing `tech-cc-hub` Electron/Vite processes, run:

```bash
cmd.exe /c npm run dev
```

Verify:

```bash
curl -I http://localhost:4173/
```

Expected: HTTP 200.

## Self-Review

- Spec coverage: Project Profile, Context Pack, persistence, Trace visibility, and minimal execution cockpit hooks are covered. Actual screenshot automation and command orchestration are deferred to the next slice.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: `ProjectProfile`, `FirstShotContextPack`, and `ProjectRuntimeMessage` are consistently named across tasks.

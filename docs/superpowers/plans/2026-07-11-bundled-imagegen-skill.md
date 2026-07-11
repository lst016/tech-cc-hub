# Bundled Imagegen Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle the official Codex `imagegen` system skill with tech-cc-hub, show its description in Chinese, and inject it for image-generation turns without changing its upstream body.

**Architecture:** A focused bundled-skill resolver locates the checked-in resource in development and `process.resourcesPath` after packaging. Slash discovery scans that root first, while the runner appends the same skill plus an application-level `image_gen` to `image_generate` compatibility note whenever the image MCP is enabled.

**Tech Stack:** Electron 39, TypeScript, Node test runner, electron-builder.

---

### Task 1: Lock the bundled resource contract

**Files:**
- Create: `test/electron/bundled-imagegen-skill.test.ts`
- Modify: `test/electron/packaged-runtime-dependencies.test.ts`
- Create: `skills/.system/imagegen/**`
- Modify: `electron-builder.json`

- [ ] **Step 1: Write the failing resource tests**

Add assertions that `skills/.system/imagegen/SKILL.md` exists, its frontmatter contains the approved Chinese description, its body still contains `# Image Generation Skill` and `Never modify scripts/image_gen.py`, all official companion files exist, and `electron-builder.json` copies `skills/.system/imagegen` to the same packaged path.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/bundled-imagegen-skill.test.js dist-test/test/electron/packaged-runtime-dependencies.test.js
```

Expected: failure because the bundled directory and builder resource entry do not exist.

- [ ] **Step 3: Copy the upstream resource and localize only the frontmatter description**

Mechanically copy every file from `%USERPROFILE%\.codex\skills\.system\imagegen` to `skills/.system/imagegen`. Change only the `description:` value in `SKILL.md`; preserve `LICENSE.txt`, `agents/openai.yaml`, `assets`, `references`, `scripts`, and the remaining `SKILL.md` content byte-for-byte.

- [ ] **Step 4: Package the resource**

Add this `extraResources` entry:

```json
{
  "from": "skills/.system/imagegen",
  "to": "skills/.system/imagegen",
  "filter": ["**/*"]
}
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: both test files pass.

### Task 2: Resolve and expose the bundled skill

**Files:**
- Create: `src/electron/libs/bundled-skills.ts`
- Modify: `src/electron/libs/slash-command-catalog.ts`
- Modify: `test/electron/bundled-imagegen-skill.test.ts`
- Modify: `test/electron/slash-commands.test.ts`

- [ ] **Step 1: Write failing resolver and slash-priority tests**

Test a pure resolver with explicit `{ isPackaged, resourcesPath, cwd }` inputs, verify development resolves `<cwd>/skills/.system/imagegen`, packaged mode resolves `<resourcesPath>/skills/.system/imagegen`, and verify the bundled skill root is first in `resolveSlashCommandRoots().skillRoots`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/bundled-imagegen-skill.test.js
```

Expected: module/function missing or bundled root absent.

- [ ] **Step 3: Implement the resolver**

Create exports equivalent to:

```ts
export type BundledSkillPathOptions = {
  isPackaged?: boolean;
  resourcesPath?: string;
  cwd?: string;
};

export function resolveBundledImagegenSkillDir(options?: BundledSkillPathOptions): string;
export function readBundledImagegenSkill(options?: BundledSkillPathOptions): { dir: string; filePath: string; content: string } | undefined;
export function buildBundledImagegenSkillPromptAppend(options?: BundledSkillPathOptions): string | undefined;
```

The prompt append includes the unmodified checked-in skill content and a separate tech-cc-hub bridge stating that `image_gen` maps to `mcp__tech-cc-hub-image__image_generate`, and relative resources/scripts resolve from the returned skill directory.

- [ ] **Step 4: Put the bundled root first in slash discovery**

Prepend `resolveBundledImagegenSkillDir()`'s parent (`skills/.system`) to `skillRoots`, before user Codex roots, so `/imagegen` deterministically uses the Chinese-description bundled definition.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command plus `node --test dist-test/test/electron/slash-commands.test.js`. Expected: pass.

### Task 3: Inject the skill only for image-capable turns

**Files:**
- Modify: `src/electron/libs/runner/runner.ts`
- Modify: `test/electron/runner-image-generation-context.test.ts`

- [ ] **Step 1: Write the failing runner wiring test**

Assert that runner imports `buildBundledImagegenSkillPromptAppend` and adds:

```ts
enabledBuiltinMcpServerSet.has("tech-cc-hub-image")
  ? buildBundledImagegenSkillPromptAppend()
  : undefined
```

to `combineSystemPromptAppend`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/runner-image-generation-context.test.js
```

Expected: failure because the runner does not inject the bundled skill.

- [ ] **Step 3: Add the minimal runner integration**

Import the helper and append it only when `tech-cc-hub-image` is enabled. Keep `image_generate`, routing, result JSON, and generated image cards unchanged.

- [ ] **Step 4: Run focused and regression verification**

Run:

```powershell
npm run test:electron:build
node --test dist-test/test/electron/bundled-imagegen-skill.test.js dist-test/test/electron/runner-image-generation-context.test.js dist-test/test/electron/runtime-efficiency.test.js dist-test/test/electron/slash-commands.test.js dist-test/test/electron/packaged-runtime-dependencies.test.js
npm run transpile:electron
npm run build
```

Expected: all commands exit 0; image prompts keep the image MCP, ordinary prompts do not gain it, and TypeScript/build remain clean.

- [ ] **Step 5: Review the final diff**

Run `git diff --check` and inspect only the task files. Confirm the upstream directory differs from the installed source only at `SKILL.md` frontmatter `description`, excluding generated line-ending differences.

# Canvas Plugin Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic right-rail workspace-plugin host and make full Codex-Canvas available through a `Canvas` tab that sends selected images to the active tech-cc-hub chat.

**Architecture:** The Electron main process scans local plugin manifests, launches the plugin per active session, owns a token-protected loopback bridge, and invokes the existing `session.continue` handler. The renderer adds manifest-driven Activity Rail tabs and displays plugin localhost pages in a bounded BrowserView. Codex-Canvas is vendored unchanged except for an isolated chat-transport selection module.

**Tech Stack:** Electron main process, React/TypeScript renderer, Node `http`, existing `BrowserWorkbenchManager`, existing `handleClientEvent`, Node built-in tests, Git subtree.

---

### Task 1: Define the workspace-plugin contract

**Files:**
- Create: `src/shared/workspace-plugins.ts`
- Create: `test/electron/workspace-plugins.test.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
test("normalizes a local browser-view workspace plugin manifest", () => {
  assert.deepEqual(normalizeWorkspacePluginManifest({
    id: "codex-canvas", label: "Canvas", surface: "browser-view",
    start: { command: "node", args: ["bin/codex-canvas.mjs", "start"] },
    permissions: ["session.snapshot", "session.send"],
  }), {
    id: "codex-canvas", label: "Canvas", surface: "browser-view",
    start: { command: "node", args: ["bin/codex-canvas.mjs", "start"] },
    permissions: ["session.snapshot", "session.send"],
  });
});

test("rejects undeclared permissions and unsafe plugin identifiers", () => {
  assert.equal(normalizeWorkspacePluginManifest({ id: "../bad", permissions: [] }), null);
  assert.equal(normalizeWorkspacePluginManifest({ id: "canvas", permissions: ["session.stop"] }), null);
});
```

- [ ] **Step 2: Run the contract test and verify it fails because the module is absent**

Run: `npm run test:electron:build; $env:CRON_TEST_FILES='dist-test/test/electron/workspace-plugins.test.js'; npx electron --no-sandbox scripts/test-electron.mjs`

Expected: module-resolution failure for `workspace-plugins.js`.

- [ ] **Step 3: Implement the minimal shared contract**

```ts
export const WORKSPACE_PLUGIN_PERMISSIONS = ["session.snapshot", "session.send"] as const;
export type WorkspacePluginPermission = typeof WORKSPACE_PLUGIN_PERMISSIONS[number];
export type WorkspacePluginManifest = {
  id: string; label: string; surface: "browser-view";
  start: { command: string; args: string[] };
  permissions: WorkspacePluginPermission[];
};
export function getWorkspacePluginTabId(id: string): `plugin:${string}` { return `plugin:${id}`; }
export function normalizeWorkspacePluginManifest(value: unknown): WorkspacePluginManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(String(input.id ?? ""))) return null;
  if (typeof input.label !== "string" || !input.label.trim() || input.surface !== "browser-view") return null;
  if (!input.start || typeof input.start !== "object" || Array.isArray(input.start)) return null;
  const start = input.start as Record<string, unknown>;
  if (typeof start.command !== "string" || !Array.isArray(start.args) || !start.args.every((arg) => typeof arg === "string")) return null;
  const permissions = Array.isArray(input.permissions) ? input.permissions : [];
  if (!permissions.every((permission) => WORKSPACE_PLUGIN_PERMISSIONS.includes(permission as WorkspacePluginPermission))) return null;
  return { id: input.id, label: input.label.trim(), surface: "browser-view", start: { command: start.command, args: start.args }, permissions: [...permissions] as WorkspacePluginPermission[] };
}
```

- [ ] **Step 4: Run the contract test and verify it passes**

Run the Step 2 command.

Expected: 2 passing tests.

- [ ] **Step 5: Commit the contract**

Stage only the two Task 1 files and create a Lore-protocol commit explaining the manifest permission boundary.

### Task 2: Add main-process discovery and the token-protected session bridge

**Files:**
- Create: `src/electron/libs/workspace-plugins/workspace-plugin-manager.ts`
- Create: `src/electron/libs/workspace-plugins/workspace-plugin-bridge.ts`
- Modify: `src/electron/main.ts`
- Test: `test/electron/workspace-plugin-bridge.test.ts`

- [ ] **Step 1: Write failing bridge tests**

```ts
async function requestJson(url: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${url}${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test("bridge rejects a request without the launch bearer token", async () => {
  const bridge = await startWorkspacePluginBridge({ sessionStore, dispatch });
  const response = await requestJson(bridge.url, "/v1/session/snapshot");
  assert.equal(response.status, 401);
});

test("bridge converts a selected workspace PNG into session.continue", async () => {
  const bridge = await startWorkspacePluginBridge({ sessionStore, dispatch });
  const response = await requestJson(bridge.url, "/v1/session/send", bridge.token, {
    sessionId: "session-1", prompt: "Canvas note", imagePath: fixturePng,
    source: { pluginId: "codex-canvas", action: "send-to-chat" },
  });
  assert.equal(response.status, 202);
  assert.equal(dispatched[0]?.type, "session.continue");
  assert.equal(dispatched[0]?.payload.attachments?.[0]?.kind, "image");
});
```

- [ ] **Step 2: Run the bridge test and verify it fails because bridge exports are absent**

Run: `npm run test:electron:build; $env:CRON_TEST_FILES='dist-test/test/electron/workspace-plugin-bridge.test.js'; npx electron --no-sandbox scripts/test-electron.mjs`

Expected: module-resolution failure for `workspace-plugin-bridge.js`.

- [ ] **Step 3: Implement discovery, launch records, and bridge validation**

```ts
export class WorkspacePluginManager {
  async list(): Promise<WorkspacePluginDescriptor[]> { return this.manifests; }
  async open(input: { pluginId: string; sessionId: string; cwd: string }): Promise<WorkspacePluginLaunch> { return this.launchPlugin(input); }
  async closeSession(sessionId: string): Promise<void> { await this.stopLaunchesForSession(sessionId); }
}

export async function startWorkspacePluginBridge(input: WorkspacePluginBridgeInput) {
  return createServer(async (request, response) => {
    if (request.socket.remoteAddress !== "127.0.0.1" || request.headers.authorization !== `Bearer ${input.token}`) return writeJson(response, 401, { error: "Unauthorized" });
    if (request.url === "/v1/session/send" && request.method === "POST") return dispatchValidatedPluginContinuation(request, response, input);
    if (request.url === "/v1/session/snapshot" && request.method === "GET") return writeJson(response, 200, buildBoundSessionSnapshot(input));
    return writeJson(response, 404, { error: "Not found" });
  });
}
```

`main.ts` instantiates the manager after the session store is available, registers `workspace-plugins:list`, `workspace-plugins:open`, `workspace-plugins:close`, and stops all launches during app cleanup.

- [ ] **Step 4: Run the bridge test and verify it passes**

Run the Step 2 command.

Expected: token rejection and dispatched image-continuation tests pass.

- [ ] **Step 5: Commit the main-process host**

Stage only Task 2 files and create a Lore-protocol commit documenting loopback-only token validation and workspace containment.

### Task 3: Render manifest-driven plugin tabs in the right rail

**Files:**
- Modify: `src/ui/utils/activity-workspace-tabs.ts`
- Modify: `src/ui/components/ActivityRail.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/electron/preload.cts`
- Modify: `src/ui/dev-electron-shim.ts`
- Create: `src/ui/components/workspace-plugins/WorkspacePluginViewPane.tsx`
- Test: `test/electron/activity-workspace-tabs.test.ts`
- Test: `test/electron/workspace-plugin-pane.test.ts`

- [ ] **Step 1: Write failing dynamic-tab tests**

```ts
test("buildActivityWorkspaceTabs appends manifest workspace plugins", () => {
  const tabs = buildActivityWorkspaceTabs({
    activeTab: "plugin:codex-canvas", showBrowserTab: true,
    workspacePlugins: [{ id: "codex-canvas", label: "Canvas", surface: "browser-view" }],
  });
  assert.deepEqual(tabs.at(-1), {
    id: "plugin:codex-canvas", label: "Canvas", title: "Canvas", visible: true, active: true,
  });
});

test("workspace plugin pane opens a session-scoped plugin surface", () => {
  const source = readFileSync("src/ui/components/workspace-plugins/WorkspacePluginViewPane.tsx", "utf8");
  assert.match(source, /workspacePlugins\.open\(\{ pluginId, sessionId, cwd \}\)/);
  assert.match(source, /setBrowserWorkbenchBounds/);
});
```

- [ ] **Step 2: Run tests and verify they fail because plugin tab support is absent**

Run: `npm run test:electron:build; $env:CRON_TEST_FILES='dist-test/test/electron/activity-workspace-tabs.test.js'; npx electron --no-sandbox scripts/test-electron.mjs`

Expected: missing `workspacePlugins` support and missing pane source.

- [ ] **Step 3: Implement the renderer and preload path**

```ts
export type PluginRailTab = `plugin:${string}`;
export function getWorkspacePluginIdFromTab(tab: string | undefined): string | null {
  const id = tab?.startsWith("plugin:") ? tab.slice("plugin:".length) : "";
  return /^[a-z][a-z0-9-]{1,63}$/.test(id) ? id : null;
}
// buildActivityWorkspaceTabs adds each descriptor after optional tabs.
```

`App.tsx` loads descriptors with `window.electron.workspacePlugins.list()`, passes them to `ActivityRail`, and preserves the selected plugin tab per session. `WorkspacePluginViewPane` opens its session-scoped launch, reuses a dedicated `BrowserWorkbenchManager` key, and sends the content rectangle to `setBrowserWorkbenchBounds`; cleanup sends a zero-sized bounds rectangle and closes the launch on session change. The dev shim exposes the same IPC shape without starting a child process.

- [ ] **Step 4: Run the dynamic-tab tests and verify they pass**

Run the Step 2 command plus the focused pane test command.

Expected: built-in tabs remain stable and `plugin:codex-canvas` is visible.

- [ ] **Step 5: Commit the renderer integration**

Stage only Task 3 files and create a Lore-protocol commit documenting reuse of the existing BrowserView bounds path.

### Task 4: Vendor full Codex-Canvas and record the upstream boundary

**Files:**
- Create: `plugins/codex-canvas/` via Git subtree import
- Create: `plugins/codex-canvas/tech-cc-hub.plugin.json`
- Create: `plugins/codex-canvas/UPSTREAM.md`

- [ ] **Step 1: Verify the upstream baseline before importing it**

Run from the inspected upstream clone: `npm ci; npm run smoke`

Expected: the upstream smoke suite exits successfully before host-specific changes are applied.

- [ ] **Step 2: Import the exact upstream snapshot as normal tracked files**

Run: `git subtree add --prefix=plugins/codex-canvas https://github.com/Xiangyu-CAS/codex-canvas.git main --squash`

Expected: the plugin directory contains the complete upstream application and no nested Git repository.

- [ ] **Step 3: Add the host manifest and upstream record**

```json
{
  "id": "codex-canvas",
  "label": "Canvas",
  "surface": "browser-view",
  "start": { "command": "node", "args": ["bin/codex-canvas.mjs", "start", "--port", "0"] },
  "permissions": ["session.snapshot", "session.send"]
}
```

`UPSTREAM.md` records the source URL, imported Git revision, subtree refresh command, and the three permitted host patch files: `src/codex-chat.mjs`, `src/server.mjs`, and `src/tech-cc-hub-transport.mjs`.

- [ ] **Step 4: Commit the vendored upstream snapshot separately**

Create a Lore-protocol commit with the upstream URL and revision in the commit body. Do not mix host code into this import commit.

### Task 5: Replace only Codex-Canvas chat transport when running inside the host

**Files:**
- Create: `plugins/codex-canvas/src/tech-cc-hub-transport.mjs`
- Modify: `plugins/codex-canvas/src/codex-chat.mjs`
- Modify: `plugins/codex-canvas/src/server.mjs`
- Modify: `plugins/codex-canvas/public/app.js`
- Create: `plugins/codex-canvas/scripts/tech-cc-hub-transport-smoke.mjs`
- Modify: `plugins/codex-canvas/package.json`

- [ ] **Step 1: Write a failing transport smoke test**

```js
async function createLocalBridge(onRequest) {
  const server = createServer(async (request, response) => {
    const body = JSON.parse(await readRequestBody(request));
    onRequest(body);
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "submitted" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, token: "test-token", close: () => server.close() };
}

const received = [];
const bridge = await createLocalBridge((request) => received.push(request));
process.env.TECH_CC_HUB_BRIDGE_URL = bridge.url;
process.env.TECH_CC_HUB_BRIDGE_TOKEN = bridge.token;
const result = await sendImageToBoundChat({ projectDir, threadId: "session-1", imagePath, prompt: "Canvas note" });
assert.equal(result.status, "submitted");
assert.equal(received[0].imagePath, imagePath);
assert.equal(received[0].prompt, "Canvas note");
```

- [ ] **Step 2: Run the smoke test and verify it fails because host transport does not exist**

Run: `node plugins/codex-canvas/scripts/tech-cc-hub-transport-smoke.mjs`

Expected: module-resolution failure for `tech-cc-hub-transport.mjs`.

- [ ] **Step 3: Implement the isolated transport selection**

```js
export function isTechCcHubBridgeConfigured(env = process.env) {
  return Boolean(env.TECH_CC_HUB_BRIDGE_URL && env.TECH_CC_HUB_BRIDGE_TOKEN && env.TECH_CC_HUB_SESSION_ID);
}
export async function submitCanvasAssetToTechCcHub({ imagePath, prompt, action, source }) {
  const response = await fetch(`${process.env.TECH_CC_HUB_BRIDGE_URL}/v1/session/send`, {
    method: "POST", headers: { authorization: `Bearer ${process.env.TECH_CC_HUB_BRIDGE_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ sessionId: process.env.TECH_CC_HUB_SESSION_ID, imagePath, prompt, action, source }),
  });
  if (!response.ok) throw new Error((await response.json()).error || "tech-cc-hub bridge rejected the canvas request");
  return await response.json();
}

export async function sendImageToBoundChat(input) {
  if (isTechCcHubBridgeConfigured()) return submitCanvasAssetToTechCcHub({ ...input, action: "send-to-chat" });
  return sendInputsToBoundChat(input);
}
```

`server.mjs` preserves object lookup and passes the selected object prompt plus the new optional `note` field to the transport. `public/app.js` sends the existing selected object ID and an optional note, then shows the host acceptance result instead of app-server-specific wording.

- [ ] **Step 4: Run upstream and host transport verification**

Run: `node plugins/codex-canvas/scripts/tech-cc-hub-transport-smoke.mjs; npm --prefix plugins/codex-canvas run smoke`

Expected: host request mapping passes and the upstream smoke suite still passes with no host environment variables.

- [ ] **Step 5: Commit the narrow connection patch**

Stage only the Task 5 files and create a Lore-protocol commit explaining that the fallback preserves upstream standalone behavior.

### Task 6: Verify end-to-end in production Electron

**Files:**
- Modify if required by failures: files from Tasks 1-5 only
- Test: `test/electron/workspace-plugin-bridge.test.ts`
- Test: `test/electron/activity-workspace-tabs.test.ts`
- Test: `plugins/codex-canvas/scripts/tech-cc-hub-transport-smoke.mjs`

- [ ] **Step 1: Run focused checks**

Run: `npm run test:electron:build`, focused workspace-plugin bridge and tab tests, `npm run transpile:electron`, `npm run build`, and `git diff --check`.

Expected: every focused test passes and both renderer and Electron output compile.

- [ ] **Step 2: Build and launch production Electron from the feature worktree**

Run: `npm run build; npm run transpile:electron; $env:NODE_ENV='production'; Start-Process -FilePath (Resolve-Path 'node_modules/electron/dist/electron.exe') -ArgumentList @('.') -WorkingDirectory (Get-Location).Path -WindowStyle Normal`

Expected: the right rail has `Canvas`, opening it loads the full local Canvas page.

- [ ] **Step 3: Perform the real interaction proof**

Select or upload an image in Canvas, add a note, activate Send to AI, then verify the active left chat receives a real `session.continue` user turn with the selected image attachment and starts the configured model. Verify the Canvas tab displays accepted/running state and the normal chat result is visible.

- [ ] **Step 4: Commit final integration fixes**

Stage only files changed for verification fixes and create a Lore-protocol commit that records the real production interaction proof.

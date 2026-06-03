import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendBrowserWorkbenchRecordedAction,
  buildBrowserWorkbenchPlaywrightScript,
  buildBrowserWorkbenchRecordingPackage,
  createBrowserWorkbenchRecordingSession,
  finalizeBrowserWorkbenchRecording,
  readBrowserWorkbenchRecordingPackage,
  runBrowserWorkbenchRecordingPackage,
  updateBrowserWorkbenchRecordingArtifact,
  writeBrowserWorkbenchRecordingPackage,
} from "../../src/electron/libs/browser-workbench/browser-workbench-recorder.js";

test("browser workbench recorder coalesces fast fill updates", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/",
    title: "Local App",
  });

  appendBrowserWorkbenchRecordedAction(session, {
    kind: "fill",
    timestamp: 100,
    url: "http://localhost:4173/",
    target: { selector: "input[name=\"q\"]", role: "textbox" },
    value: "hel",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "fill",
    timestamp: 500,
    url: "http://localhost:4173/",
    target: { selector: "input[name=\"q\"]", role: "textbox" },
    value: "hello",
  });

  assert.equal(session.actions.length, 1);
  assert.equal(session.actions[0].value, "hello");
  assert.match(buildBrowserWorkbenchPlaywrightScript(session), /fill\("hello"\)/);
});

test("browser workbench recorder turns post-click navigation into URL expectation", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/",
    title: "Local App",
  });

  appendBrowserWorkbenchRecordedAction(session, {
    kind: "click",
    timestamp: 100,
    url: "http://localhost:4173/",
    target: { selector: "a[href=\"/settings\"]", role: "link", name: "Settings" },
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "navigate",
    timestamp: 200,
    url: "http://localhost:4173/settings",
    source: "navigation",
  });

  const result = finalizeBrowserWorkbenchRecording(session);
  assert.equal(result.success, true);
  assert.equal(result.actionCount, 2);
  assert.match(result.script ?? "", /getByRole\("link", \{ name: "Settings" \}\)\.click\(\)/);
  assert.match(result.script ?? "", /expect\(page\)\.toHaveURL\("http:\/\/localhost:4173\/settings"\)/);
});

test("browser workbench recorder generates visible assertions", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/dashboard",
    title: "Dashboard",
  });

  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertVisible",
    timestamp: 100,
    url: "http://localhost:4173/dashboard",
    target: { selector: "[data-testid=\"welcome\"]", role: "heading", name: "Welcome" },
  });

  const result = finalizeBrowserWorkbenchRecording(session);
  const flow = result.recordingPackage?.artifacts.find((artifact) => artifact.kind === "flow");
  assert.equal(result.recordingPackage?.recording.capabilities.assertions, true);
  assert.match(result.script ?? "", /expect\(page\.getByRole\("heading", \{ name: "Welcome" \}\)\)\.toBeVisible\(\)/);
  assert.match(flow?.content ?? "", /await expect\(recordedPage\.welcomeHeading\)\.toBeVisible\(\)/);
});

test("browser workbench recorder preserves console and network evidence", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/",
    title: "Local App",
  });

  const result = finalizeBrowserWorkbenchRecording(session, {
    evidence: {
      console: [{ id: "console-1", level: "error", message: "boom", timestamp: 100 }],
      network: [{ id: "network-1", url: "http://localhost:4173/api", method: "GET", status: 200, timestamp: 110 }],
      screenshots: [],
      snapshots: [],
    },
  });

  assert.match(result.recordingJson ?? "", /"message": "boom"/);
  assert.match(result.recordingJson ?? "", /"status": 200/);
});

test("browser workbench recorder emits a raw recording package alongside generated spec", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/login",
    title: "Login",
    viewport: { width: 1280, height: 800 },
  });

  appendBrowserWorkbenchRecordedAction(session, {
    kind: "click",
    timestamp: 100,
    url: "http://localhost:4173/login",
    target: { selector: "[data-testid=\"login-submit\"]", role: "button", name: "Login" },
  });

  const result = finalizeBrowserWorkbenchRecording(session);
  assert.equal(result.recordingPackage?.recording.schemaVersion, 1);
  assert.equal(result.recordingPackage?.recording.source.viewport?.width, 1280);
  assert.equal(result.recordingPackage?.artifacts.some((artifact) => artifact.path.endsWith("/recording.json")), true);
  assert.equal(result.recordingPackage?.artifacts.some((artifact) => artifact.path.includes("/generated/specs/")), true);
  assert.match(result.recordingJson ?? "", /"schemaVersion": 1/);
  assert.match(result.recordingJson ?? "", /"locatorCandidates"/);
  assert.deepEqual(
    result.recordingPackage?.recording.locatorCandidates.map((candidate) => candidate.strategy),
    ["testId", "role", "css"],
  );
});

test("browser workbench recording package includes manifest and readme artifacts", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/",
    title: "Local App",
  });

  const recordingPackage = buildBrowserWorkbenchRecordingPackage(session, 12345);
  assert.equal(recordingPackage.rootPathHint, `.tech-cc-hub/browser-recordings/${session.id}`);
  assert.deepEqual(recordingPackage.artifacts.map((artifact) => artifact.kind), [
    "recording",
    "environment",
    "data",
    "page",
    "flow",
    "fixture",
    "spec",
    "suite",
    "diagnostics",
    "manifest",
    "readme",
  ]);
  assert.match(recordingPackage.artifacts.find((artifact) => artifact.kind === "manifest")?.content ?? "", /"generatedSpecPath"/);
  assert.match(recordingPackage.artifacts.find((artifact) => artifact.kind === "readme")?.content ?? "", /Generated assets/);
});

test("browser workbench recording package generates reusable Playwright assets", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/login",
    title: "Login Page",
  });

  appendBrowserWorkbenchRecordedAction(session, {
    kind: "fill",
    timestamp: 100,
    url: "http://localhost:4173/login",
    target: { selector: "input[name=\"username\"]", role: "textbox", name: "Username" },
    value: "demo@example.com",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "click",
    timestamp: 200,
    url: "http://localhost:4173/login",
    target: { selector: "[data-testid=\"login-submit\"]", role: "button", name: "Login" },
  });

  const recordingPackage = buildBrowserWorkbenchRecordingPackage(session, 12345);
  const pageObject = recordingPackage.artifacts.find((artifact) => artifact.kind === "page");
  const flow = recordingPackage.artifacts.find((artifact) => artifact.kind === "flow");
  const fixture = recordingPackage.artifacts.find((artifact) => artifact.kind === "fixture");
  const spec = recordingPackage.artifacts.find((artifact) => artifact.kind === "spec");
  const data = recordingPackage.artifacts.find((artifact) => artifact.kind === "data");
  const environment = recordingPackage.artifacts.find((artifact) => artifact.kind === "environment");
  const suite = recordingPackage.artifacts.find((artifact) => artifact.kind === "suite");
  const diagnostics = recordingPackage.artifacts.find((artifact) => artifact.kind === "diagnostics");

  assert.match(pageObject?.path ?? "", /generated\/pages\/LoginPageRecordedPage\.po\.ts$/);
  assert.match(pageObject?.content ?? "", /export class LoginPageRecordedPage/);
  assert.match(pageObject?.content ?? "", /usernameTextbox/);
  assert.match(flow?.content ?? "", /runRecordedFlow/);
  assert.match(flow?.content ?? "", /recordedPage\.usernameTextbox\.fill\(data\.usernameTextbox\)/);
  assert.match(fixture?.content ?? "", /recordedFlowDataScenarios/);
  assert.match(spec?.content ?? "", /from "\.\.\/fixtures\/login-page\.fixture"/);
  assert.match(spec?.content ?? "", /for \(const scenario of recordedFlowDataScenarios\)/);
  assert.match(data?.content ?? "", /demo@example\.com/);
  assert.match(environment?.content ?? "", /"baseURL": "http:\/\/localhost:4173"/);
  assert.match(environment?.content ?? "", /"browserName": "chromium"/);
  assert.match(suite?.content ?? "", /"tags": \[/);
  assert.match(diagnostics?.content ?? "", /"severity": "warning"/);
  assert.match(recordingPackage.artifacts.find((artifact) => artifact.kind === "manifest")?.content ?? "", /"generatedArtifacts"/);
});

test("browser workbench recorder generates expanded assertions and diagnostics", () => {
  const session = createBrowserWorkbenchRecordingSession({
    url: "http://localhost:4173/dashboard",
    title: "Dashboard",
  });

  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertTitle",
    timestamp: 100,
    url: "http://localhost:4173/dashboard",
    value: "Dashboard",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertUrl",
    timestamp: 110,
    url: "http://localhost:4173/dashboard",
    value: "http://localhost:4173/dashboard",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertCount",
    timestamp: 120,
    url: "http://localhost:4173/dashboard",
    target: { selector: ".metric-card", text: "Revenue" },
    value: "3",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertAttribute",
    timestamp: 130,
    url: "http://localhost:4173/dashboard",
    target: { selector: ".metric-card", text: "Revenue" },
    key: "data-state",
    value: "ready",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertResponse",
    timestamp: 140,
    url: "http://localhost:4173/dashboard",
    value: "/api/dashboard",
  });
  appendBrowserWorkbenchRecordedAction(session, {
    kind: "assertScreenshot",
    timestamp: 150,
    url: "http://localhost:4173/dashboard",
    value: "dashboard-ready",
  });

  const result = finalizeBrowserWorkbenchRecording(session);
  const flow = result.recordingPackage?.artifacts.find((artifact) => artifact.kind === "flow");
  const diagnostics = result.recordingPackage?.artifacts.find((artifact) => artifact.kind === "diagnostics");

  assert.equal(result.recordingPackage?.recording.capabilities.assertions, true);
  assert.match(flow?.content ?? "", /await expect\(page\)\.toHaveTitle\("Dashboard"\)/);
  assert.match(flow?.content ?? "", /await expect\(page\)\.toHaveURL\("http:\/\/localhost:4173\/dashboard"\)/);
  assert.match(flow?.content ?? "", /await expect\(recordedPage\.revenueElement\)\.toHaveCount\(3\)/);
  assert.match(flow?.content ?? "", /await expect\(recordedPage\.revenueElement\)\.toHaveAttribute\("data-state", "ready"\)/);
  assert.match(flow?.content ?? "", /await page\.waitForResponse\(.*\/api\/dashboard/);
  assert.match(flow?.content ?? "", /await expect\(page\)\.toHaveScreenshot\("dashboard-ready\.png"\)/);
  assert.match(diagnostics?.content ?? "", /fragile-selector/);
});

test("browser workbench recording package can be written to a workspace", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-recorder-"));
  try {
    const session = createBrowserWorkbenchRecordingSession({
      url: "http://localhost:4173/login",
      title: "Login Page",
    });
    appendBrowserWorkbenchRecordedAction(session, {
      kind: "click",
      timestamp: 100,
      url: "http://localhost:4173/login",
      target: { selector: "[data-testid=\"login-submit\"]", role: "button", name: "Login" },
    });

    const recordingPackage = buildBrowserWorkbenchRecordingPackage(session, 12345);
    const writeResult = writeBrowserWorkbenchRecordingPackage(recordingPackage, workspaceRoot);
    const recordingPath = join(writeResult.rootPath, "recording.json");
    const pageObjectPath = join(writeResult.rootPath, "generated", "pages", "LoginPageRecordedPage.po.ts");

    assert.equal(existsSync(recordingPath), true);
    assert.equal(existsSync(pageObjectPath), true);
    assert.match(readFileSync(recordingPath, "utf8"), /"schemaVersion": 1/);
    assert.equal(writeResult.files.length, recordingPackage.artifacts.length);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("browser workbench recording history packages can be loaded and edited", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-recorder-edit-"));
  try {
    const session = createBrowserWorkbenchRecordingSession({
      url: "http://localhost:4173/login",
      title: "Login Page",
    });
    appendBrowserWorkbenchRecordedAction(session, {
      kind: "click",
      timestamp: 100,
      url: "http://localhost:4173/login",
      target: { selector: "[data-testid=\"login-submit\"]", role: "button", name: "Login" },
    });

    const recordingPackage = buildBrowserWorkbenchRecordingPackage(session, 12345);
    const writeResult = writeBrowserWorkbenchRecordingPackage(recordingPackage, workspaceRoot);
    const loadedPackage = readBrowserWorkbenchRecordingPackage(workspaceRoot, writeResult.rootPath);
    const spec = loadedPackage.artifacts.find((artifact) => artifact.kind === "spec");

    assert.equal(loadedPackage.id, recordingPackage.id);
    assert.equal(loadedPackage.artifacts.length, recordingPackage.artifacts.length);
    assert.ok(spec);

    const editResult = updateBrowserWorkbenchRecordingArtifact({
      workspaceRoot,
      recordingPackage: loadedPackage,
      artifactPath: spec.path,
      content: `${spec.content}\n// edited in workbench\n`,
    });

    assert.equal(editResult.success, true);
    assert.equal(editResult.recordingPackage.artifacts.find((artifact) => artifact.path === spec.path)?.content.endsWith("// edited in workbench\n"), true);
    assert.match(readFileSync(editResult.filePath ?? "", "utf8"), /edited in workbench/);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

function buildRunnerTestPackage(input: { id: string; specName: string; specContent: string }): BrowserWorkbenchRecordingPackage {
  const rootPathHint = `.tech-cc-hub/browser-recordings/${input.id}`;
  const generatedSpecPath = `${rootPathHint}/generated/specs/${input.specName}`;
  return {
    id: input.id,
    createdAt: 12345,
    rootPathHint,
    recordingPath: `${rootPathHint}/recording.json`,
    generatedSpecPath,
    recording: {
      schemaVersion: 1,
      id: input.id,
      createdAt: 12345,
      startedAt: 100,
      completedAt: 12345,
      source: { url: "about:blank" },
      capabilities: {
        rawActions: true,
        locatorCandidates: false,
        assertions: false,
        replay: false,
        repairLoop: false,
      },
      actions: [],
      locatorCandidates: [],
      evidence: { screenshots: [], snapshots: [], network: [], console: [] },
    },
    artifacts: [
      {
        kind: "spec",
        path: generatedSpecPath,
        content: input.specContent,
        language: "typescript",
      },
    ],
  };
}

test("browser workbench runner executes a generated Playwright package", async () => {
  const workspaceRoot = process.cwd();
  const recordingPackage = buildRunnerTestPackage({
    id: `runner-pass-${Date.now()}`,
    specName: "passing.spec.ts",
    specContent: [
      "import { test, expect } from '@playwright/test';",
      "test('runner pass', async () => {",
      "  expect(1).toBe(1);",
      "});",
      "",
    ].join("\n"),
  });
  const writeResult = writeBrowserWorkbenchRecordingPackage(recordingPackage, workspaceRoot);
  try {
    const runResult = await runBrowserWorkbenchRecordingPackage({
      workspaceRoot,
      recordingPackage,
      savedRootPath: writeResult.rootPath,
      timeoutMs: 20_000,
    });

    assert.equal(runResult.success, true);
    assert.equal(runResult.status, "passed");
    assert.equal(runResult.exitCode, 0);
    assert.match(runResult.stdout, /1 passed/);
    assert.equal(existsSync(runResult.outputDir), true);
  } finally {
    rmSync(writeResult.rootPath, { recursive: true, force: true });
  }
});

test("browser workbench runner streams events and indexes run attachments", async () => {
  const workspaceRoot = process.cwd();
  const events: Array<{ type: string; message?: string }> = [];
  const recordingPackage = buildRunnerTestPackage({
    id: `runner-events-${Date.now()}`,
    specName: "events.spec.ts",
    specContent: [
      "import { writeFileSync } from 'node:fs';",
      "import { test, expect } from '@playwright/test';",
      "test('runner events', async ({}, testInfo) => {",
      "  writeFileSync(testInfo.outputPath('trace.zip'), 'trace');",
      "  writeFileSync(testInfo.outputPath('screenshot.png'), 'png');",
      "  console.log('stream me');",
      "  expect(1).toBe(1);",
      "});",
      "",
    ].join("\n"),
  });
  const writeResult = writeBrowserWorkbenchRecordingPackage(recordingPackage, workspaceRoot);
  try {
    const runResult = await runBrowserWorkbenchRecordingPackage({
      workspaceRoot,
      recordingPackage,
      savedRootPath: writeResult.rootPath,
      timeoutMs: 20_000,
      onEvent: (event) => events.push({ type: event.type, message: event.message }),
    });

    assert.equal(runResult.success, true);
    assert.equal(events.some((event) => event.type === "started"), true);
    assert.equal(events.some((event) => event.type === "stdout" && event.message?.includes("stream me")), true);
    assert.equal(events.at(-1)?.type, "finished");
    assert.equal(runResult.events.some((event) => event.type === "stdout"), true);
    assert.equal(runResult.attachments.traceFiles.length, 1);
    assert.equal(runResult.attachments.screenshotFiles.length, 1);
  } finally {
    rmSync(writeResult.rootPath, { recursive: true, force: true });
  }
});

test("browser workbench runner reports a failed generated Playwright package", async () => {
  const workspaceRoot = process.cwd();
  const recordingPackage = buildRunnerTestPackage({
    id: `runner-fail-${Date.now()}`,
    specName: "failing.spec.ts",
    specContent: [
      "import { test, expect } from '@playwright/test';",
      "test('runner fail', async () => {",
      "  expect(1).toBe(2);",
      "});",
      "",
    ].join("\n"),
  });
  const writeResult = writeBrowserWorkbenchRecordingPackage(recordingPackage, workspaceRoot);
  try {
    const runResult = await runBrowserWorkbenchRecordingPackage({
      workspaceRoot,
      recordingPackage,
      savedRootPath: writeResult.rootPath,
      timeoutMs: 20_000,
    });

    assert.equal(runResult.success, false);
    assert.equal(runResult.status, "failed");
    assert.notEqual(runResult.exitCode, 0);
    assert.match(`${runResult.stdout}\n${runResult.stderr}`, /runner fail/);
  } finally {
    rmSync(writeResult.rootPath, { recursive: true, force: true });
  }
});

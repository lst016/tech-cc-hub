import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { app, safeStorage } from "electron";
import {
  CodexRuntimeLoginManager,
  resolveCodexRuntime,
  sanitizeCodexRuntimeError,
  type CodexRuntimeLoginEvent,
} from "../../src/electron/libs/codex/codex-runtime-login.js";
import { parseCodexOAuthCredential } from "../../src/electron/libs/codex/codex-oauth.js";
import {
  mergeRendererApiConfigSettings,
  loadApiConfigSettings,
  redactApiConfigSettingsForRenderer,
  saveApiConfigSettings,
  type ApiConfigSettings,
} from "../../src/electron/libs/config-store.js";
import { CODEX_OAUTH_STORED_CREDENTIAL } from "../../src/shared/codex-oauth.js";

test("bundled runtime login imports one profile without exposing tokens", async () => {
  const root = join(tmpdir(), `tech-cc-hub-codex-runtime-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  const staleLoginHome = join(root, "codex-login", "stale-attempt");
  mkdirSync(staleLoginHome, { recursive: true });
  writeFileSync(join(staleLoginHome, "auth.json"), "stale-secret");
  writeFileSync(join(staleLoginHome, ".owner.json"), JSON.stringify({
    pid: 2_147_483_647,
    createdAt: Date.now() - 60 * 60_000,
  }));
  const activeLoginHome = join(root, "codex-login", "active-other-instance");
  mkdirSync(activeLoginHome, { recursive: true });
  writeFileSync(join(activeLoginHome, ".owner.json"), JSON.stringify({
    pid: process.pid,
    createdAt: Date.now(),
  }));
  const initial = createSettings();
  let saved = structuredClone(initial);
  const events: CodexRuntimeLoginEvent[] = [];
  let complete!: () => void;
  const completed = new Promise<void>((resolveComplete) => {
    complete = resolveComplete;
  });
  const manager = new CodexRuntimeLoginManager({
    appPath: process.cwd(),
    isPackaged: false,
    resourcesPath: process.cwd(),
    userDataPath: root,
    openExternal: async () => undefined,
    loadSettings: () => structuredClone(saved),
    saveSettings: (settings) => {
      saved = structuredClone(settings);
    },
    emit: (event) => {
      events.push(event);
      if (event.type === "completed" || event.type === "failed") complete();
    },
    resolveRuntime: () => ({
      executable: "node",
      args: [resolve("test/fixtures/fake-codex-app-server.mjs")],
    }),
  });
  assert.equal(existsSync(staleLoginHome), false);
  assert.equal(existsSync(activeLoginHome), true);

  try {
    const result = await manager.start({ profile: initial.profiles[1]!, mode: "browser" });
    assert.equal(result.success, true);
    assert.ok(result.attemptId);
    await completed;

    assert.deepEqual(saved.profiles[0], initial.profiles[0]);
    assert.equal(saved.profiles.length, initial.profiles.length);
    const credential = parseCodexOAuthCredential(saved.profiles[1]!.apiKey);
    assert.equal(credential.accountId, "account-from-runtime");
    assert.equal(credential.email, "runtime@example.com");
    assert.equal(credential.refreshToken, "fake-refresh-token");
    assert.ok(events.some((event) => event.type === "opening-browser"));
    assert.ok(events.some((event) => event.type === "completed"));
    assert.doesNotMatch(JSON.stringify(events), /fake-refresh-token|eyJ/);
    assert.equal(existsSync(join(root, "codex-login", result.attemptId!)), false);
  } finally {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("terminal browser login events restore the packaged app before updating settings", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const focusSource = readFileSync("src/electron/libs/desktop-notifications.ts", "utf8");

  assert.match(
    mainSource,
    /if \(event\.type === "completed" \|\| event\.type === "failed"\) \{\s*focusDesktopWindow\(mainWindow\);\s*\}\s*mainWindow\.webContents\.send\("codex-oauth-runtime-event"/s,
  );
  assert.match(focusSource, /export function focusDesktopWindow/);
  assert.match(focusSource, /window\.isMinimized\(\)[\s\S]*window\.restore\(\)/);
  assert.match(focusSource, /window\.isVisible\(\)[\s\S]*window\.show\(\)/);
  assert.match(focusSource, /window\.focus\(\)/);
  assert.match(focusSource, /app\.focus\(\{ steal: true \}\)/);
});

test("runtime resolver targets the unpacked platform package and never PATH", () => {
  const root = join(tmpdir(), `tech-cc-hub-codex-resolver-${Date.now()}`);
  const executable = join(
    root,
    "app.asar.unpacked",
    "node_modules",
    "@openai",
    "codex",
    "node_modules",
    "@openai",
    "codex",
    "vendor",
    "x86_64-pc-windows-msvc",
    "bin",
    "codex.exe",
  );
  mkdirSync(join(executable, ".."), { recursive: true });
  writeFileSync(executable, "fixture");
  try {
    assert.deepEqual(resolveCodexRuntime({
      appPath: "unused",
      isPackaged: true,
      resourcesPath: root,
      platform: "win32",
      arch: "x64",
    }), { executable });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("completed login does not resurrect a profile deleted during OAuth", async () => {
  const root = join(tmpdir(), `tech-cc-hub-codex-deleted-profile-${Date.now()}`);
  let saved = createSettings();
  let finalEvent!: CodexRuntimeLoginEvent;
  let finish!: () => void;
  const completed = new Promise<void>((resolveComplete) => {
    finish = resolveComplete;
  });
  const manager = new CodexRuntimeLoginManager({
    appPath: process.cwd(),
    isPackaged: false,
    resourcesPath: process.cwd(),
    userDataPath: root,
    openExternal: async () => undefined,
    loadSettings: () => structuredClone(saved),
    saveSettings: (settings) => {
      saved = structuredClone(settings);
    },
    emit: (event) => {
      if (event.type === "completed" || event.type === "failed") {
        finalEvent = event;
        finish();
      }
    },
    resolveRuntime: () => ({
      executable: "node",
      args: [resolve("test/fixtures/fake-codex-app-server.mjs")],
    }),
  });
  try {
    const target = saved.profiles[1]!;
    const result = await manager.start({ profile: target, mode: "browser" });
    assert.equal(result.success, true);
    saved = { profiles: saved.profiles.filter((profile) => profile.id !== target.id) };
    await completed;
    assert.equal(finalEvent.type, "failed");
    assert.match(finalEvent.error ?? "", /已被删除/);
    assert.equal(saved.profiles.some((profile) => profile.id === target.id), false);
  } finally {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime login refuses an unsaved profile instead of appending it", async () => {
  const root = join(tmpdir(), `tech-cc-hub-codex-unsaved-profile-${Date.now()}`);
  const input = createSettings().profiles[1]!;
  let runtimeResolved = false;
  const manager = new CodexRuntimeLoginManager({
    appPath: process.cwd(),
    isPackaged: false,
    resourcesPath: process.cwd(),
    userDataPath: root,
    openExternal: async () => undefined,
    loadSettings: () => ({ profiles: [createSettings().profiles[0]!] }),
    saveSettings: () => assert.fail("unsaved profile must not be persisted by the runtime manager"),
    emit: () => undefined,
    resolveRuntime: () => {
      runtimeResolved = true;
      return { executable: "unused" };
    },
  });
  try {
    const result = await manager.start({ profile: input, mode: "browser" });
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /先保存/);
    assert.equal(runtimeResolved, false);
  } finally {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime resolver also supports the npm development alias layout", () => {
  const root = join(tmpdir(), `tech-cc-hub-codex-resolver-dev-${Date.now()}`);
  const executable = join(
    root,
    "node_modules",
    "@openai",
    "codex-win32-x64",
    "vendor",
    "x86_64-pc-windows-msvc",
    "bin",
    "codex.exe",
  );
  mkdirSync(join(executable, ".."), { recursive: true });
  writeFileSync(executable, "fixture");
  try {
    assert.deepEqual(resolveCodexRuntime({
      appPath: root,
      isPackaged: false,
      resourcesPath: "unused",
      platform: "win32",
      arch: "x64",
    }), { executable });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime errors redact URLs, bearer values, JWTs, and token fields", () => {
  const jwt = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.";
  const sanitized = sanitizeCodexRuntimeError(`Bearer secret-token ${jwt} refresh_token=raw-refresh user_code: ABCD-EFGH {"access_token":"json-access","code":"json-code"} https://example.test/callback?code=secret`);
  assert.doesNotMatch(sanitized, /secret-token|eyJ|raw-refresh|ABCD-EFGH|json-access|json-code|example\.test|code=secret/);
});

test("renderer config redaction preserves the stored Codex credential on save", () => {
  const existing = createSettings();
  existing.profiles[1]!.apiKey = "raw-codex-credential";
  const redacted = redactApiConfigSettingsForRenderer(existing);
  assert.equal(redacted.profiles[1]!.apiKey, CODEX_OAUTH_STORED_CREDENTIAL);
  assert.equal(redacted.profiles[0]!.apiKey, "custom-secret");

  redacted.profiles[1]!.name = "Renamed Codex";
  const merged = mergeRendererApiConfigSettings(redacted, existing);
  assert.equal(merged.profiles[1]!.name, "Renamed Codex");
  assert.equal(merged.profiles[1]!.apiKey, "raw-codex-credential");
  assert.deepEqual(merged.profiles[0], existing.profiles[0]);

  const staleRendererCopy = structuredClone(redacted);
  staleRendererCopy.profiles[1]!.apiKey = "";
  const mergedStaleCopy = mergeRendererApiConfigSettings(staleRendererCopy, existing);
  assert.equal(mergedStaleCopy.profiles[1]!.apiKey, "raw-codex-credential");
});

test("Codex credentials are encrypted at rest with Electron safeStorage", (t) => {
  if (!safeStorage.isEncryptionAvailable()) {
    t.skip("safeStorage is unavailable in this Electron test environment");
    return;
  }
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-codex-storage-${Date.now()}`);
  const settings = createSettings();
  settings.profiles[1]!.apiKey = "sensitive-codex-credential";
  mkdirSync(root, { recursive: true });
  try {
    app.setPath("userData", root);
    saveApiConfigSettings(settings);
    const persisted = readFileSync(join(root, "api-config.json"), "utf8");
    assert.match(persisted, /safe-storage:v1:/);
    assert.doesNotMatch(persisted, /sensitive-codex-credential/);
    assert.equal(loadApiConfigSettings().profiles[1]!.apiKey, "sensitive-codex-credential");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

function createSettings(): ApiConfigSettings {
  return {
    profiles: [
      {
        id: "custom-profile",
        name: "Custom",
        apiKey: "custom-secret",
        baseURL: "https://example.test/v1",
        model: "example-model",
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
        models: [{ name: "example-model" }],
      },
      {
        id: "codex-profile",
        name: "Codex OAuth",
        apiKey: "",
        baseURL: "https://chatgpt.com",
        model: "gpt-5.5",
        enabled: true,
        provider: "codex",
        apiType: "anthropic",
        models: [{ name: "gpt-5.5" }],
      },
    ],
  };
}

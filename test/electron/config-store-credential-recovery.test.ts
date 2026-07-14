import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import {
  loadApiConfigSettings,
  mergeRendererApiConfigSettings,
  redactApiConfigSettingsForRenderer,
  saveApiConfigSettings,
} from "../../src/electron/libs/config-store.js";
import { CODEX_OAUTH_STORED_CREDENTIAL } from "../../src/shared/codex-oauth.js";

test("an unreadable Codex safeStorage value does not hide every API profile", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-credential-recovery-${Date.now()}`);
  const unreadableCredential = "safe-storage:v1:not-valid-ciphertext";
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "codex-profile",
        name: "Codex OAuth",
        apiKey: unreadableCredential,
        baseURL: "https://chatgpt.com",
        model: "gpt-5.5",
        enabled: true,
        provider: "codex",
        apiType: "anthropic",
        models: [{ name: "gpt-5.5" }],
      },
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
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const loaded = loadApiConfigSettings();
    assert.deepEqual(loaded.profiles.map((profile) => profile.id), ["codex-profile", "custom-profile"]);
    assert.equal(loaded.profiles[0]!.apiKey, unreadableCredential);

    const rendererSettings = redactApiConfigSettingsForRenderer(loaded);
    assert.equal(rendererSettings.profiles[0]!.apiKey, CODEX_OAUTH_STORED_CREDENTIAL);

    rendererSettings.profiles[1]!.name = "Renamed Custom";
    saveApiConfigSettings(mergeRendererApiConfigSettings(rendererSettings, loaded));
    const persisted = JSON.parse(readFileSync(join(root, "api-config.json"), "utf8")) as {
      profiles: Array<{ id: string; apiKey: string }>;
    };
    assert.equal(persisted.profiles.find((profile) => profile.id === "codex-profile")?.apiKey, unreadableCredential);
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

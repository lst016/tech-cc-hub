import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("settings save does not rewrite api profiles unless they changed", () => {
  const source = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");

  assert.match(source, /const \[apiConfigDirty, setApiConfigDirty\] = useState\(false\)/);
  assert.match(source, /const \[loading, setLoading\] = useState\(true\)/);
  assert.match(source, /setApiConfigDirty\(false\);/);
  assert.match(source, /setApiConfigDirty\(true\);/);
  assert.match(source, /const profileError = apiConfigDirty \? validateProfiles\(normalizedProfiles\) : null;/);
  assert.match(source, /apiConfigDirty\s+\?\s+window\.electron\.saveApiConfig\(\{ profiles: nextProfiles \}\)/);
  assert.match(source, /if \(apiConfigDirty\) \{\s*setApiConfigSettings\(\{ profiles: nextProfiles \}\);/s);
});

test("claude settings fallback is read-only and does not persist into api config", () => {
  const source = readFileSync("src/electron/libs/claude/claude-settings.ts", "utf8");

  assert.doesNotMatch(source, /saveApiConfigSettings/);
  assert.match(source, /function getFallbackClaudeSettingsConfig\(\): ApiConfig \| null/);
  assert.match(source, /return config;/);
});

test("renderer store does not replace loaded api profiles with transient empty responses", () => {
  const source = readFileSync("src/ui/store/useAppStore.ts", "utf8");

  assert.match(source, /function hasApiProfiles\(settings: ApiConfigSettings\): boolean/);
  assert.match(source, /const nextApiConfigSettings = hasApiProfiles\(apiConfigSettings\) \|\| !hasApiProfiles\(state\.apiConfigSettings\)\s*\?\s*apiConfigSettings\s*:\s*state\.apiConfigSettings;/s);
  assert.match(source, /apiConfigSettings: nextApiConfigSettings/);
});

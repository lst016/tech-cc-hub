import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("settings save does not rewrite api profiles unless they changed", () => {
  const source = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");

  assert.match(source, /const \[apiConfigDirty, setApiConfigDirty\] = useState\(false\)/);
  assert.match(source, /setApiConfigDirty\(false\);/);
  assert.match(source, /setApiConfigDirty\(true\);/);
  assert.match(source, /const profileError = apiConfigDirty \? validateProfiles\(normalizedProfiles\) : null;/);
  assert.match(source, /apiConfigDirty\s+\?\s+window\.electron\.saveApiConfig\(\{ profiles: nextProfiles \}\)/);
  assert.match(source, /if \(apiConfigDirty\) \{\s*setApiConfigSettings\(\{ profiles: nextProfiles \}\);/s);
});

test("claude settings fallback is read-only and does not persist into api config", () => {
  const source = readFileSync("src/electron/libs/claude-settings.ts", "utf8");

  assert.doesNotMatch(source, /saveApiConfigSettings/);
  assert.match(source, /function getFallbackClaudeSettingsConfig\(\): ApiConfig \| null/);
  assert.match(source, /return config;/);
});

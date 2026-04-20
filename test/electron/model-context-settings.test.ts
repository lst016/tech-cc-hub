import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("settings modal and shared types expose per-model context compression fields", () => {
  const settingsModalSource = readFileSync(new URL("../../src/ui/components/SettingsModal.tsx", import.meta.url), "utf8");
  const uiTypesSource = readFileSync(new URL("../../src/ui/types.ts", import.meta.url), "utf8");
  const configStoreSource = readFileSync(new URL("../../src/electron/libs/config-store.ts", import.meta.url), "utf8");

  assert.match(settingsModalSource, /contextWindow/);
  assert.match(settingsModalSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /contextWindow/);
  assert.match(uiTypesSource, /compressionThresholdPercent/);
  assert.match(configStoreSource, /contextWindow/);
  assert.match(configStoreSource, /compressionThresholdPercent/);
});

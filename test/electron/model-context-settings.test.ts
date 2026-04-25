import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("settings modal and shared types expose per-model context compression fields", () => {
  const apiProfilesSettingsSource = readFileSync(new URL("../../src/ui/components/settings/ApiProfilesSettingsPage.tsx", import.meta.url), "utf8");
  const uiTypesSource = readFileSync(new URL("../../src/ui/types.ts", import.meta.url), "utf8");
  const configStoreSource = readFileSync(new URL("../../src/electron/libs/config-store.ts", import.meta.url), "utf8");

  assert.match(apiProfilesSettingsSource, /contextWindow/);
  assert.match(apiProfilesSettingsSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /contextWindow/);
  assert.match(uiTypesSource, /compressionThresholdPercent/);
  assert.match(configStoreSource, /contextWindow/);
  assert.match(configStoreSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /analysisModel/);
  assert.match(configStoreSource, /analysisModel/);
  assert.match(apiProfilesSettingsSource, /Prompt 分析模型/);
});

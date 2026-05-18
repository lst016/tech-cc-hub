import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("agent rules tabs reload documents when switching tabs", () => {
  const pageSource = readFileSync("src/ui/components/settings/AgentRulesSettingsPage.tsx", "utf8");
  const modalSource = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");

  assert.match(pageSource, /onRefreshDocuments\?: \(\) => Promise<void>/);
  assert.match(pageSource, /void onRefreshDocuments\?\.\(\);/);
  assert.match(pageSource, /onClick=\{\(\) => handleTabChange\("user"\)\}/);
  assert.match(pageSource, /onClick=\{\(\) => handleTabChange\("system"\)\}/);

  assert.match(modalSource, /const refreshAgentRuleDocuments = useCallback\(async \(\) =>/);
  assert.match(modalSource, /await electronApi\.getAgentRuleDocuments\(\)/);
  assert.match(modalSource, /setUserAgentMarkdown\(normalizedRuleDocuments\.userAgentsMarkdown\)/);
  assert.match(modalSource, /onRefreshDocuments=\{refreshAgentRuleDocuments\}/);
});

test("browser preview bridge replays agent list responses", () => {
  const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");

  assert.match(devShimSource, /"agent\.list"/);
  assert.match(devShimSource, /const replayEventTypes = new Set<ClientEvent\["type"\]>/);
});

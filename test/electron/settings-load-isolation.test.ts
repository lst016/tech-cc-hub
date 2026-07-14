import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("settings loading keeps API profiles when an optional settings source fails", () => {
  const source = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");

  assert.match(source, /Promise\.allSettled\(\[\s*window\.electron\.getApiConfig\(\)/s);
  assert.match(source, /apiSettingsResult\.status === "fulfilled"/);
  assert.match(source, /globalSettingsResult\.status === "fulfilled"/);
  assert.match(source, /ruleDocumentsResult\.status === "fulfilled"/);
  assert.match(source, /部分设置加载失败/);
});

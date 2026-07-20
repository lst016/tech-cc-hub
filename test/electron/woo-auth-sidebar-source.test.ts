import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("anonymous Woo account click opens the auth panel instead of starting a long browser login", () => {
  const source = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const triggerHandlerMatch = source.match(
    /const handleWooAuthTriggerClick = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/,
  );

  assert.ok(triggerHandlerMatch, "Woo trigger handler should be present");
  assert.match(triggerHandlerMatch[0], /setWooAuthDialogOpen\(true\)/);
  assert.doesNotMatch(triggerHandlerMatch[0], /woo-auth:login-third-party/);
  assert.match(source, /open=\{wooAuthDialogOpen\}/);
  assert.match(source, /onOpenSettings=\{\(\) => openSettings\("global-json"\)\}/);
});

test("Woo auth panel routes missing runtime config to the global JSON settings page", () => {
  const dialogSource = readFileSync("src/ui/components/WooAuthDialog.tsx", "utf8");
  const globalJsonSource = readFileSync("src/ui/components/settings/GlobalJsonSettingsPage.tsx", "utf8");

  assert.match(dialogSource, /function isWooConfigMessage\(message: string\)/);
  assert.match(dialogSource, /打开全局配置/);
  assert.match(dialogSource, /state\.loginMethods\?\.password === true/);
  assert.match(dialogSource, /state\.loginMethods\?\.email === true/);
  assert.match(globalJsonSource, /WOO_BASE_URL/);
  assert.match(globalJsonSource, /WOO_CLIENT_ID/);
});

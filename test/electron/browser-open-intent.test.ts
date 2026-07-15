import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { useAppStore } from "../../src/ui/store/useAppStore.js";

const SESSION_ID = "browser-open-intent-session";

function resetStore(): void {
  useAppStore.setState(useAppStore.getInitialState(), true);
}

test("a non-empty browser URL intent reopens a closed browser tab", (t) => {
  t.after(resetStore);
  resetStore();

  useAppStore.getState().setBrowserWorkbenchHasTab(SESSION_ID, false);
  useAppStore.getState().setBrowserWorkbenchUrl(SESSION_ID, "https://example.com/path");

  assert.deepEqual(useAppStore.getState().browserWorkbenchBySessionId[SESSION_ID], {
    url: "https://example.com/path",
    hasBrowserTab: true,
    annotations: [],
  });
});

test("an empty browser URL update preserves the closed-tab state", (t) => {
  t.after(resetStore);
  resetStore();

  useAppStore.getState().setBrowserWorkbenchHasTab(SESSION_ID, false);
  useAppStore.getState().setBrowserWorkbenchUrl(SESSION_ID, "");

  assert.deepEqual(useAppStore.getState().browserWorkbenchBySessionId[SESSION_ID], {
    url: "",
    hasBrowserTab: false,
    annotations: [],
  });
});

test("external browser intents are consumed even while the address field was editing", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const pageSource = readFileSync("src/ui/components/BrowserWorkbenchPage.tsx", "utf8");

  assert.match(
    appSource,
    /const \[browserOpenRequestVersion, setBrowserOpenRequestVersion\] = useState\(0\);/,
  );
  assert.match(
    appSource,
    /handleOpenBrowserWorkbenchUrl[\s\S]{0,800}setBrowserOpenRequestVersion\(\(version\) => version \+ 1\);/,
  );
  assert.match(appSource, /openRequestVersion=\{browserOpenRequestVersion\}/);
  assert.match(pageSource, /openRequestVersion\?: number;/);
  const versionEffect = pageSource.match(
    /useEffect\(\(\) => \{([\s\S]{0,2400}openRequestVersion[\s\S]{0,2400})\}, \[[^\]]*openRequestVersion[^\]]*\]\);/,
  )?.[1];
  assert.ok(versionEffect, "BrowserWorkbenchPage should react to external open intents");
  assert.match(versionEffect, /openUrl\(initialUrl\)/);
  assert.ok(
    versionEffect.indexOf("openUrl(initialUrl)") < versionEffect.indexOf("isEditingUrlRef.current"),
    "the explicit open intent should be consumed before the address-edit guard",
  );
  assert.match(pageSource, /onBlur=\{\(\) => setUrlEditing\(false\)\}/);
});

test("every external intent has version semantics so the same URL can retry", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const pageSource = readFileSync("src/ui/components/BrowserWorkbenchPage.tsx", "utf8");

  const openHandler = appSource.match(
    /const handleOpenBrowserWorkbenchUrl = \(event: Event\) => \{([\s\S]*?)\r?\n {4}\};/,
  )?.[1];
  assert.ok(openHandler, "App should define the external browser-open intent handler");
  assert.match(openHandler, /if \(!url\) return;/);
  assert.match(openHandler, /setBrowserOpenRequestVersion\(\(version\) => version \+ 1\);/);

  const versionEffect = pageSource.match(
    /useEffect\(\(\) => \{([\s\S]{0,1200}openRequestVersion[\s\S]{0,1200})\}, \[[^\]]*openRequestVersion[^\]]*\]\);/,
  )?.[1];
  assert.ok(versionEffect, "BrowserWorkbenchPage should react to every open-request version");
  assert.match(versionEffect, /openUrl\(initialUrl\)/);
});

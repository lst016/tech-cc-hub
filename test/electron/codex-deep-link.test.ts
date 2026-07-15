import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CODEX_OAUTH_DEEP_LINK_SCHEME,
  buildCodexOAuthDeepLink,
  findCodexOAuthDeepLink,
  parseCodexOAuthDeepLink,
} from "../../src/electron/libs/codex/codex-deep-link.js";

test("Codex OAuth handoff uses the registered tech-cc-hub protocol without credentials", () => {
  assert.equal(CODEX_OAUTH_DEEP_LINK_SCHEME, "tech-cc-hub");
  const value = buildCodexOAuthDeepLink({
    attemptId: "attempt-123",
    profileId: "profile-456",
  });

  assert.equal(
    value,
    "tech-cc-hub://oauth/codex?attempt_id=attempt-123&profile_id=profile-456&result=completed",
  );
  assert.deepEqual(parseCodexOAuthDeepLink(value), {
    attemptId: "attempt-123",
    profileId: "profile-456",
  });
  assert.doesNotMatch(value, /token|credential|code=/i);
});

test("Codex OAuth deep links reject unknown routes and credential parameters", () => {
  assert.equal(parseCodexOAuthDeepLink("codex://oauth/codex?attempt_id=a&profile_id=p&result=completed"), null);
  assert.equal(parseCodexOAuthDeepLink("tech-cc-hub://oauth/other?attempt_id=a&profile_id=p&result=completed"), null);
  assert.equal(parseCodexOAuthDeepLink("tech-cc-hub://oauth/codex?attempt_id=a&profile_id=p&result=failed"), null);
  assert.equal(parseCodexOAuthDeepLink("tech-cc-hub://oauth/codex?attempt_id=a&profile_id=p&result=completed&access_token=secret"), null);
  assert.equal(parseCodexOAuthDeepLink("tech-cc-hub://oauth/codex?attempt_id=&profile_id=p&result=completed"), null);
});

test("Codex OAuth deep links are discovered in packaged Windows argv", () => {
  assert.deepEqual(findCodexOAuthDeepLink([
    "C:\\Program Files\\tech-cc-hub\\tech-cc-hub.exe",
    "--some-electron-flag",
    "tech-cc-hub://oauth/codex?attempt_id=a&profile_id=p&result=completed",
  ]), { attemptId: "a", profileId: "p" });
});

test("Windows and macOS packaging wire the tech-cc-hub protocol handoff", () => {
  const builder = JSON.parse(readFileSync("electron-builder.json", "utf8"));
  const installer = readFileSync("build/installer.nsh", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");

  assert.ok(builder.protocols?.some((entry: { name?: string; schemes?: string[] }) => (
    entry.name === "tech-cc-hub Codex OAuth callback"
      && entry.schemes?.includes(CODEX_OAUTH_DEEP_LINK_SCHEME)
  )));
  assert.deepEqual(builder.mac?.target, ["dmg", "zip"]);
  assert.equal(builder.nsis?.include, "build/installer.nsh");
  assert.match(installer, /WriteRegStr SHELL_CONTEXT "Software\\Classes\\tech-cc-hub" "URL Protocol" ""/);
  assert.match(installer, /Software\\Classes\\tech-cc-hub\\shell\\open\\command/);
  assert.match(installer, /'"\$appExe" "%1"'/);
  assert.match(installer, /DeleteRegKey SHELL_CONTEXT "Software\\Classes\\tech-cc-hub"/);
  assert.doesNotMatch(installer, /token|credential|code=/i);
  assert.match(mainSource, /requestSingleInstanceLock\(\)/);
  assert.match(mainSource, /app\.on\("second-instance"/);
  assert.match(mainSource, /app\.on\("open-url"/);
  const openUrlHandlerIndex = mainSource.indexOf('app.on("open-url"');
  const readyHandlerIndex = mainSource.indexOf('app.on("ready"');
  assert.ok(openUrlHandlerIndex >= 0 && openUrlHandlerIndex < readyHandlerIndex);
  assert.match(mainSource, /app\.setAsDefaultProtocolClient\(CODEX_OAUTH_DEEP_LINK_SCHEME\)/);
  assert.match(
    mainSource,
    /function registerCodexOAuthProtocolClient\(\): void \{\s*if \(!app\.isPackaged \|\| process\.platform !== "darwin"\) return;/,
  );
  assert.match(
    mainSource,
    /const hasSingleInstanceLock = app\.requestSingleInstanceLock\(\);\s*if \(!hasSingleInstanceLock\) \{\s*app\.quit\(\);\s*\} else \{\s*registerCodexOAuthProtocolClient\(\);\s*\}/,
  );
  assert.match(
    mainSource,
    /app\.on\("ready", async \(\) => \{\s*if \(!hasSingleInstanceLock\) return;/,
  );
  assert.match(mainSource, /pendingCodexOAuthDeepLinkActivation = true/);
  assert.match(mainSource, /flushPendingCodexOAuthDeepLinkActivation\(\)/);
  assert.match(mainSource, /shell\.openExternal\(deepLink\)/);
  assert.match(mainSource, /activateCodexOAuthDeepLink\(process\.argv\)/);
});

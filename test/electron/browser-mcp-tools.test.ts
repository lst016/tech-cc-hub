import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiagnosePortPowerShellScript,
  buildPowerShellEncodedCommandArgs,
  classifyHttpPingStatus,
  getBrowserToolNames,
  normalizeBrowserEvalExpression,
} from "../../src/electron/libs/mcp-tools/browser.js";
import {
  getBashBackgroundServiceGuidance,
  normalizeWindowsBashCommand,
} from "../../src/electron/libs/windows-bash-command.js";

test("diagnose_port PowerShell script keeps hashtable syntax intact", () => {
  const script = buildDiagnosePortPowerShellScript(8910);
  const args = buildPowerShellEncodedCommandArgs(script);

  assert.equal(script.includes("@{;"), false);
  assert.match(script, /\[pscustomobject\]@\{/);
  assert.equal(args.includes("-EncodedCommand"), true);
});

test("http_ping classifies Spring Boot readiness 503 as reachable-not-ready", () => {
  assert.equal(classifyHttpPingStatus("http://127.0.0.1:8910/actuator/health", 503), "reachable_not_ready");
  assert.equal(classifyHttpPingStatus("http://127.0.0.1:8910/api", 503), "server_error");
  assert.equal(classifyHttpPingStatus("http://127.0.0.1:8910/actuator/health", 200), "ok");
});

test("Bash command normalization protects Windows taskkill switches", () => {
  const fixed = normalizeWindowsBashCommand("taskkill /F /PID 1234", "win32");

  assert.equal(fixed.changed, true);
  assert.equal(fixed.command, "taskkill //F //PID 1234");
});

test("Bash post-tool guidance warns that background Spring Boot is not ready proof", () => {
  const guidance = getBashBackgroundServiceGuidance(
    "Bash",
    { command: "mvn spring-boot:run" },
    "Process running in background with PID 1234. exit code 0",
  );

  assert.match(guidance ?? "", /not readiness proof/);
});

test("browser eval normalizes bare function expressions into invocations", () => {
  assert.equal(
    normalizeBrowserEvalExpression("() => document.title"),
    "(() => document.title)()",
  );
  assert.equal(
    normalizeBrowserEvalExpression("async () => document.title"),
    "(async () => document.title)()",
  );
  assert.equal(
    normalizeBrowserEvalExpression("function () { return document.title; }"),
    "(function () { return document.title; })()",
  );
});

test("browser eval leaves already executable expressions unchanged", () => {
  assert.equal(normalizeBrowserEvalExpression("document.title"), "document.title");
  assert.equal(normalizeBrowserEvalExpression("(() => document.title)()"), "(() => document.title)()");
});

test("browser MCP exposes generic rendered-surface extraction", () => {
  assert.equal(getBrowserToolNames().includes("browser_extract_canvas"), true);
  assert.equal(getBrowserToolNames().includes("browser_wait_canvas"), true);
  assert.equal(getBrowserToolNames().includes("browser_extract_terminal"), false);
  assert.equal(getBrowserToolNames().includes("browser_wait_terminal"), false);
});

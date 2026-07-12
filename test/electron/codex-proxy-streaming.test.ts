import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("codex proxy relays an upstream stream incrementally and aborts an idle upstream", () => {
  const source = readFileSync("src/electron/libs/codex/codex-anthropic-proxy.ts", "utf8");

  assert.match(source, /const CODEX_UPSTREAM_IDLE_TIMEOUT_MS = 120_000;/);
  assert.match(source, /async function streamCodexResponse\(/);
  assert.match(source, /signal: upstreamWatchdog\.signal/);
  assert.match(source, /await streamCodexResponse\(upstream, response, codexRequest\.model, upstreamWatchdog\.touch\)/);
  assert.doesNotMatch(source, /const upstreamText = await upstream\.text\(\);[\s\S]*if \(wantsStream\)/);
});

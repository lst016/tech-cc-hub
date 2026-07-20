import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("codex proxy relays an upstream stream incrementally and aborts an idle upstream", () => {
  const source = readFileSync("src/electron/libs/codex/codex-anthropic-proxy.ts", "utf8");

  assert.match(source, /const CODEX_UPSTREAM_IDLE_TIMEOUT_MS = 120_000;/);
  assert.match(source, /async function streamCodexResponse\(/);
  assert.match(source, /signal: upstreamWatchdog\.signal/);
  assert.match(source, /await streamCodexResponse\(upstream, response, codexRequest\.model, upstreamWatchdog\.touch\)/);
  assert.equal((source.match(/getUsableCredential\(profile, true\)/g) ?? []).length, 1);
  assert.match(source, /if \(upstream\.status === 401\)/);
  assert.doesNotMatch(source, /upstream\.status === 401 \|\| upstream\.status === 403/);
  assert.doesNotMatch(source, /readCodexCliCredential/);
  assert.match(source, /latestCredential\.accessToken !== staleCredential\.accessToken/);
  assert.equal((source.match(/recoveredCredential\.accessToken !== staleCredential\.accessToken/g) ?? []).length, 1);
  assert.doesNotMatch(source, /const upstreamText = await upstream\.text\(\);[\s\S]*if \(wantsStream\)/);
  assert.doesNotMatch(source, /throw new Error\("Codex upstream completed without assistant output\."\)/);
  assert.doesNotMatch(source, /hasCodexAnthropicOutput/);
  assert.match(source, /if \(!emittedAnyBlock\) emitResponseBlocks\(payload\);[\s\S]*startMessage\(readString\(payload\.model\) \|\| fallbackModel\);/);
});

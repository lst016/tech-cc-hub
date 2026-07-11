import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("main cleanup remains retryable until durable session shutdown completes", () => {
  const source = readFileSync("src/electron/main.ts", "utf8");
  const cleanupStart = source.indexOf("function cleanup(): void");
  const cleanupEnd = source.indexOf("function handleSignal", cleanupStart);
  const cleanup = source.slice(cleanupStart, cleanupEnd);

  assert.match(source, /let cleanupComplete = false;\s*let cleanupRunning = false;/);
  assert.match(cleanup, /if \(cleanupComplete \|\| cleanupRunning\) return;/);
  assert.match(cleanup, /cleanupRunning = true;\s*try \{/);
  assert.ok(cleanup.indexOf("cleanupAllSessions()") >= 0);
  assert.ok(cleanup.indexOf("killViteDevServer()") > cleanup.indexOf("cleanupAllSessions()"));
  assert.ok(cleanup.indexOf("cleanupComplete = true") > cleanup.indexOf("killViteDevServer()"));
  assert.match(cleanup, /finally \{\s*cleanupRunning = false;\s*\}/);
  assert.match(source, /app\.on\("before-quit", cleanup\);/);
  assert.match(source, /app\.on\("will-quit", cleanup\);/);
});

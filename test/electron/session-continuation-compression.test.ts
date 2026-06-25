import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

test("session continue forces app-managed compression before warm runner or remote resume", () => {
  assert.match(ipcHandlersSource, /shouldCompressStatelessContinuation\(/);
  assert.match(ipcHandlersSource, /const shouldForceStatelessCompression = shouldCompressStatelessContinuation\(/);
  assert.match(ipcHandlersSource, /const canUseRemoteResume =\s*!shouldForceStatelessCompression\s*&&/);
  assert.match(
    ipcHandlersSource,
    /isFigmaOAuthCallback \|\| replacingHistoryId \|\| shouldForceStatelessCompression\s*\?\s*null\s*:\s*getReusableRunnerHandle/,
  );
});

test("prompt ledger keeps full history visible when stateless continuation has not compressed", () => {
  assert.match(
    ipcHandlersSource,
    /historyMessages: canUseRemoteResume \|\| !continuationPayload\?\.usedCompression \? historyMessagesForRun : \[\]/,
  );
});

test("session resume is not gated to the official Anthropic host", () => {
  const claudeSettingsSource = readFileSync("src/electron/libs/claude/claude-settings.ts", "utf8");

  assert.doesNotMatch(claudeSettingsSource, /hostname\s*===\s*["']api\.anthropic\.com["']/);
  assert.match(claudeSettingsSource, /supportsRemoteSessionResume[\s\S]*Boolean\(config\.baseURL\?\.trim\(\)\)/);
});

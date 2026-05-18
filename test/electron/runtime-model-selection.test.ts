import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("session model updates do not overwrite the composer runtime model", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const promptInputSource = readFileSync("src/ui/components/PromptInput.tsx", "utf8");

  assert.doesNotMatch(appSource, /runtimeModelSessionSyncRef/);
  assert.doesNotMatch(appSource, /setRuntimeModel\(nextModel\)/);
  assert.match(
    promptInputSource,
    /const selectedModel = runtimeModel\.trim\(\) \|\| activeProfile\?\.model\?\.trim\(\) \|\| resolveSessionRuntimeModel\(\);/,
  );
});

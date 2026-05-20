import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("active session model takes precedence over composer runtime model", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const promptInputSource = readFileSync("src/ui/components/PromptInput.tsx", "utf8");
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");

  assert.doesNotMatch(appSource, /runtimeModelSessionSyncRef/);
  assert.doesNotMatch(appSource, /setRuntimeModel\(nextModel\)/);
  assert.match(
    appSource,
    /const sessionRuntimeModel = resolveSessionRuntimeModel\(\);\s+const selectedModel = sessionRuntimeModel \|\| runtimeModel\.trim\(\) \|\| activeProfile\?\.model\?\.trim\(\);/,
  );
  assert.match(
    promptInputSource,
    /const sessionRuntimeModel = resolveSessionRuntimeModel\(\);\s+const selectedModel = sessionRuntimeModel \|\| runtimeModel\.trim\(\) \|\| routedModelOptions\[0\]\?\.value \|\| activeProfile\?\.model\?\.trim\(\);/,
  );
  assert.match(
    promptInputSource,
    /const selectedRuntimeModel = activeSessionModel \|\| runtimeModel\.trim\(\) \|\| routedModelOptions\[0\]\?\.value \|\| activeProfile\?\.model\?\.trim\(\) \|\| "";/,
  );
  assert.match(promptInputSource, /onChange=\{handleRuntimeModelChange\}/);
  assert.match(promptInputSource, /setSessionModel\(activeSessionId, model\)/);
  assert.match(
    storeSource,
    /setSessionModel: \(sessionId: string \| null \| undefined, model: string\) => void;/,
  );
  assert.match(
    storeSource,
    /setSessionModel: \(sessionId, model\) => \{/,
  );
});

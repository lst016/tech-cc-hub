import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("active session model takes precedence over composer runtime model", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");
  const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const electronTypesSource = readFileSync("src/electron/types.ts", "utf8");
  const uiTypesSource = readFileSync("src/ui/types.ts", "utf8");

  assert.doesNotMatch(appSource, /runtimeModelSessionSyncRef/);
  assert.doesNotMatch(appSource, /setRuntimeModel\(nextModel\)/);
  assert.match(
    appSource,
    /const sessionRuntimeModel = resolveSessionRuntimeModel\(\);\s+const selectedModel = sessionRuntimeModel \|\| runtimeModel\.trim\(\) \|\| activeProfile\?\.model\?\.trim\(\);/,
  );
  assert.match(
    promptInputSource,
    /const explicitRuntimeModel = activeSessionModel \|\| runtimeModel\.trim\(\);\s+const explicitConfigProfileId = activeSessionConfigProfileId \|\| storeRuntimeConfigProfileId\.trim\(\);[\s\S]*const selectedRuntimeModel = resolveAvailableModelName\(\s+routedRuntimeModel \|\| explicitRuntimeModel \|\| fallbackRoutedModelOptions\[0\]\?\.value \|\| activeProfile\?\.model\?\.trim\(\),\s+availableModels,\s+\);/,
  );
  assert.match(promptInputSource, /value: option\.deploymentKey/);
  assert.match(promptInputSource, /onModelChange=\{handleRuntimeModelChange\}/);
  assert.match(promptInputSource, /appSetRuntimeModel\(nextModel, nextConfigProfileId\)/);
  assert.match(promptInputSource, /appSetSessionModel\(activeSessionId, nextModel, nextConfigProfileId\)/);
  assert.match(promptInputSource, /controller\.setModel\(nextModel, nextConfigProfileId\)/);
  assert.match(promptInputSource, /type: "session\.set_model"/);
  assert.match(
    storeSource,
    /setSessionModel: \(sessionId: string \| null \| undefined, model: string, configProfileId\?: string\) => void;/,
  );
  assert.match(
    storeSource,
    /setSessionModel: \(sessionId, model, configProfileId\) => \{/,
  );
  assert.match(
    electronTypesSource,
    /\| \{ type: "session\.set_model"; payload: \{ sessionId: string; model: string; configProfileId\?: string \} \}/,
  );
  assert.match(
    uiTypesSource,
    /\| \{ type: "session\.set_model"; payload: \{ sessionId: string; model: string; configProfileId\?: string \} \}/,
  );
  assert.match(
    ipcHandlersSource,
    /if \(event\.type === "session\.set_model"\) \{[\s\S]*store\.updateSession\(session\.id, \{[\s\S]*model: selectedModel,[\s\S]*configProfileId: selectedConfigProfileId,[\s\S]*\}\);[\s\S]*type: "session\.status"/,
  );
});

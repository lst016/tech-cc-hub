import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("app shell avoids fixed-width caps for the chat surface and prompt dock", () => {
  const appSource = readFileSync(new URL("../../src/ui/App.tsx", import.meta.url), "utf8");
  const promptInputSource = readFileSync(new URL("../../src/ui/components/PromptInput.tsx", import.meta.url), "utf8");

  assert.equal(appSource.includes("max-w-[920px]"), false);
  assert.equal(promptInputSource.includes("lg:max-w-[900px]"), false);
  assert.match(appSource, /clamp\(/);
  assert.match(promptInputSource, /clamp\(/);
});

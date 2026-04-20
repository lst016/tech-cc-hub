import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("app shell avoids fixed-width caps for the chat surface and prompt dock", () => {
  const appSource = readFileSync(new URL("../../src/ui/App.tsx", import.meta.url), "utf8");
  const activityRailSource = readFileSync(new URL("../../src/ui/components/ActivityRail.tsx", import.meta.url), "utf8");
  const promptInputSource = readFileSync(new URL("../../src/ui/components/PromptInput.tsx", import.meta.url), "utf8");

  assert.equal(appSource.includes("max-w-[920px]"), false);
  assert.match(activityRailSource, /对应计划步骤/);
  assert.match(activityRailSource, /标记/);
  assert.match(activityRailSource, /备注/);
  assert.match(activityRailSource, /AI 调优/);
  assert.equal(promptInputSource.includes("lg:max-w-[900px]"), false);
  assert.equal(promptInputSource.includes("max-h-[min(55vh,420px)]"), false);
  assert.match(promptInputSource, /max-h-\[min\(42vh,320px\)\]/);
  assert.match(appSource, /clamp\(/);
  assert.match(promptInputSource, /clamp\(/);
});

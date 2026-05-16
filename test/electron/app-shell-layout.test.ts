import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("app shell avoids fixed-width caps for the chat surface and prompt dock", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");
  const activityRailSource = readFileSync(join(process.cwd(), "src/ui/components/ActivityRail.tsx"), "utf8");
  const promptInputSource = readFileSync(join(process.cwd(), "src/ui/components/PromptInput.tsx"), "utf8");

  assert.equal(appSource.includes("max-w-[920px]"), false);
  assert.match(activityRailSource, /执行计划/);
  assert.match(activityRailSource, /查看对应证据/);
  assert.match(activityRailSource, /打开 Trace Viewer/);
  assert.equal(promptInputSource.includes("lg:max-w-[900px]"), false);
  assert.equal(promptInputSource.includes("max-h-[min(55vh,420px)]"), false);
  assert.match(promptInputSource, /max-h-\[min\(42vh,320px\)\]/);
  assert.match(appSource, /clamp\(/);
  assert.match(promptInputSource, /clamp\(/);
});

test("feedback button opens github issues directly", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");

  assert.match(appSource, /github\.com\/lst016\/tech-cc-hub\/issues\/new/);
  assert.match(appSource, /shell:openExternal/);
  assert.match(appSource, /occluded=\{browserWorkbenchOccluded\}/);
  // FeedbackDialog removed in favor of direct browser link
  assert.doesNotMatch(appSource, /showFeedbackDialog/);
});

test("left sidebar uses a compact default width", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");
  const sidebarSource = readFileSync(join(process.cwd(), "src/ui/components/Sidebar.tsx"), "utf8");

  assert.match(sidebarSource, /DEFAULT_SIDEBAR_WIDTH = 280/);
  assert.match(sidebarSource, /width = DEFAULT_SIDEBAR_WIDTH/);
  assert.match(appSource, /useState\(DEFAULT_SIDEBAR_WIDTH\)/);
});

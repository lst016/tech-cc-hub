import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("current conversation plan is mounted above the prompt composer, not in the sidebar", () => {
  const sidebar = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const promptInput = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const dock = readFileSync("src/ui/components/CurrentSessionPlanDock.tsx", "utf8");

  assert.doesNotMatch(sidebar, /SidebarPlanDock/);
  assert.doesNotMatch(sidebar, /dockSession/);
  assert.match(promptInput, /shouldShowCurrentSessionPlan/);
  assert.match(promptInput, /<CurrentSessionPlanDock/);
  assert.match(promptInput, /data-current-session-plan-surface/);
  assert.doesNotMatch(dock, /createPortal/);
  assert.match(dock, /role="region"/);
  assert.match(dock, /data-current-session-plan-dock/);
  assert.match(dock, /data-plan-summary-trigger/);
  assert.match(dock, /data-current-session-plan-popover/);
  assert.match(dock, /aria-expanded=\{isExpanded\}/);
  assert.match(dock, /\{summary\.completed\}\/\{summary\.total\} 步/);
});

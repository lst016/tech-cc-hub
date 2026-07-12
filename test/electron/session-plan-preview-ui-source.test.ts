import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sidebar plan dock is embedded, persistent, and has no hover portal trigger", () => {
  const sidebar = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const dock = readFileSync("src/ui/components/SidebarPlanDock.tsx", "utf8");

  assert.match(sidebar, /pickSidebarPlanDockSession/);
  assert.match(sidebar, /dockSession && dockSession\.latestPlan/);
  assert.match(sidebar, /<SidebarPlanDock/);
  assert.doesNotMatch(sidebar, /openSessionPlanPreview/);
  assert.doesNotMatch(dock, /createPortal/);
  assert.match(dock, /role="region"/);
  assert.match(dock, /data-sidebar-plan-dock/);
  assert.match(dock, /shrink-0/);
});

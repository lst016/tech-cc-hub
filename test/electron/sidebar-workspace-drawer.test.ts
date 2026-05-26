import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace session drawers stay closed until manually opened", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(sidebarSource, /useState<Record<string, boolean>>\(\{\}\)/);
  assert.match(sidebarSource, /\[group\.key\]: !current\[group\.key\]/);
  assert.match(sidebarSource, /expandedGroups\[group\.key\] \? "" : "hidden"/);
  assert.doesNotMatch(sidebarSource, /current\[group\.key\]\s*\?\?\s*true/);
});

test("expanded workspace lists preview five sessions before showing all", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(sidebarSource, /WORKSPACE_SESSION_PREVIEW_LIMIT = 5/);
  assert.match(sidebarSource, /expandedSessionLists/);
  assert.match(sidebarSource, /group\.sessions\.slice\(0, WORKSPACE_SESSION_PREVIEW_LIMIT\)/);
  assert.match(sidebarSource, /visibleSessions\.map/);
  assert.match(sidebarSource, /aria-expanded=\{sessionListExpanded\}/);
  assert.match(sidebarSource, /展开显示/);
  assert.match(sidebarSource, /折叠/);
});

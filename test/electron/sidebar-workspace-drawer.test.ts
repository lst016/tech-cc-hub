import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace session drawers stay closed until manually opened", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(sidebarSource, /readExpandedWorkspaceGroupsFromStorage/);
  assert.match(sidebarSource, /SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY/);
  assert.match(sidebarSource, /\[group\.key\]: !current\[group\.key\]/);
  assert.match(sidebarSource, /writeExpandedWorkspaceGroupsToStorage\(next\)/);
  assert.match(sidebarSource, /expandedGroups\[group\.key\] \? "" : "hidden"/);
  assert.doesNotMatch(sidebarSource, /current\[group\.key\]\s*\?\?\s*true/);
});

test("workspace session drawer state survives sidebar remounts", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(sidebarSource, /window\.localStorage\.getItem\(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY\)/);
  assert.match(sidebarSource, /window\.localStorage\.setItem\(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY, JSON\.stringify\(expandedOnly\)\)/);
  assert.match(sidebarSource, /window\.localStorage\.removeItem\(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY\)/);
  assert.match(sidebarSource, /useState<Record<string, boolean>>\(\(\) => readExpandedWorkspaceGroupsFromStorage\(\)\)/);
});

test("background sessions show a compact sidebar badge", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(sidebarSource, /const isBackgroundSession = session\.executionMode === "background";/);
  assert.match(sidebarSource, /isBackgroundSession && \(/);
  assert.match(sidebarSource, /title="Background session"/);
  assert.match(sidebarSource, />\s*BG\s*<\/span>/);
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

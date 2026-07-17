import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("sidebar scrollbar stays hidden until the session list is hovered", () => {
  const styles = readFileSync("src/ui/index.css", "utf8");

  assert.match(
    styles,
    /\.sidebar-scroll\s*\{[^}]*scrollbar-color:\s*transparent transparent;[^}]*scrollbar-gutter:\s*stable;/s,
  );
  assert.match(
    styles,
    /\.sidebar-scroll:hover\s*\{[^}]*scrollbar-color:\s*#D1D1CC transparent;/s,
  );
  assert.match(
    styles,
    /\.sidebar-scroll::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*transparent;/s,
  );
  assert.match(
    styles,
    /\.sidebar-scroll:hover::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*#D1D1CC;/s,
  );
});

test("workspace session drawers stay closed until manually opened", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const sessionListSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");

  assert.match(sidebarSource, /readExpandedWorkspaceGroupsFromStorage/);
  assert.match(sidebarSource, /SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY/);
  assert.match(sidebarSource, /\[groupKey\]: !current\[groupKey\]/);
  assert.match(sidebarSource, /writeExpandedWorkspaceGroupsToStorage\(next\)/);
  assert.match(sessionListSource, /onToggleWorkspaceGroup\(group\.key\)/);
  assert.match(sessionListSource, /const workspaceGroupExpanded = Boolean\(expandedGroups\[group\.key\]\)/);
  assert.match(sessionListSource, /workspaceGroupExpanded \? "" : "hidden"/);
});

test("workspace session drawer state survives sidebar remounts", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(sidebarSource, /window\.localStorage\.getItem\(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY\)/);
  assert.match(sidebarSource, /const expandedOnly = Object\.fromEntries/);
  assert.match(sidebarSource, /window\.localStorage\.setItem\(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY, JSON\.stringify\(expandedOnly\)\)/);
  assert.match(sidebarSource, /window\.localStorage\.removeItem\(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY\)/);
  assert.match(sidebarSource, /useState<Record<string, boolean>>\(\(\) => readExpandedWorkspaceGroupsFromStorage\(\)\)/);
});

test("background sessions show a compact sidebar badge", () => {
  const sessionListSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");

  assert.match(sessionListSource, /const isBackgroundSession = session\.executionMode === "background";/);
  assert.match(sessionListSource, /isBackgroundSession && \(/);
  assert.match(sessionListSource, /title="Background session"/);
  assert.match(sessionListSource, />\s*BG\s*<\/span>/);
});

test("workspace lists preview five sessions before showing all", () => {
  const sessionListSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");

  assert.match(sessionListSource, /WORKSPACE_SESSION_PREVIEW_LIMIT = 5/);
  assert.match(sessionListSource, /expandedSessionLists/);
  assert.match(sessionListSource, /const sessionListExpanded = Boolean\(expandedSessionLists\[group\.key\]\)/);
  assert.match(sessionListSource, /\[group\.key\]: !current\[group\.key\]/);
  assert.match(sessionListSource, /group\.sessions\.slice\(0, WORKSPACE_SESSION_PREVIEW_LIMIT\)/);
  assert.match(sessionListSource, /visibleSessions\.map/);
  assert.match(sessionListSource, /aria-expanded=\{sessionListExpanded\}/);
  assert.match(sessionListSource, /展开显示/);
  assert.match(sessionListSource, /折叠/);
});

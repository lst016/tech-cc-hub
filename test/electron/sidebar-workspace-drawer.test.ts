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
  assert.match(sidebarSource, /getWorkspacePathComparisonKey/);
  assert.match(sidebarSource, /groups\.get\(comparisonKey\)/);
  assert.match(sidebarSource, /groups\.set\(comparisonKey,/);
  assert.match(sidebarSource, /\[groupKey\]: !current\[groupKey\]/);
  assert.match(sidebarSource, /writeExpandedWorkspaceGroupsToStorage\(next\)/);
  assert.match(sessionListSource, /onToggleWorkspaceGroup\(group\.key\)/);
  assert.match(sessionListSource, /const workspaceGroupExpanded = Boolean\(expandedGroups\[group\.key\]\)/);
  assert.match(sessionListSource, /workspaceGroupExpanded \? "" : "hidden"/);
  assert.doesNotMatch(sessionListSource, /<path d="m9 6 6 6-6 6" \/>/);
  assert.doesNotMatch(sessionListSource, /<span className="truncate">\{formatWorkspaceName\(group\.cwd\)\}<\/span>/);
  assert.match(
    sessionListSource,
    /<span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-clip">\{displayedWorkspaceName\}<\/span>/,
  );
});

test("Lark channel workspaces use the Feishu icon while local workspaces keep the folder icon", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const sessionListSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");

  assert.match(sidebarSource, /larkWorkspaceRoots=\{new Set\(Object\.keys\(workspaceDisplayNames\)\)\}/);
  assert.doesNotMatch(sessionListSource, /import \{[^}]*\bLark\b[^}]*\} from "@icon-park\/react"/);
  assert.match(sessionListSource, /const isLarkWorkspace = Boolean\(group\.cwd && larkWorkspaceRoots\.has\(group\.cwd\)\)/);
  assert.match(sessionListSource, /isLarkWorkspace \? \(/);
  assert.match(sessionListSource, /data-lark-workspace-icon/);
  assert.match(sessionListSource, /new URL\("\.\.\/\.\.\/assets\/lark-logo\.svg", import\.meta\.url\)\.href/);
  assert.match(sessionListSource, /const workspaceName = formatWorkspaceName\(group\.cwd\);/);
  assert.match(sessionListSource, /workspaceName\.startsWith\("飞书-"\)/);
  assert.match(sessionListSource, /workspaceName\.slice\("飞书-"\.length\)/);
});

test("workspace actions reveal direct session creation on hover beside a compact overflow menu", () => {
  const sessionListSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");
  const directNewSessionButton = sessionListSource.match(
    /<button[\s\S]*?data-workspace-new-session[\s\S]*?<\/button>/,
  )?.[0];

  assert.ok(directNewSessionButton);
  assert.match(directNewSessionButton, /opacity-0/);
  assert.match(directNewSessionButton, /group-hover\/workspace:opacity-100/);
  assert.match(directNewSessionButton, /focus:opacity-100/);
  assert.match(sessionListSource, /data-workspace-new-session/);
  assert.match(sessionListSource, /onClick=\{\(event\) => \{[\s\S]*onNewSession\(group\.cwd\)/);
  assert.match(sessionListSource, /title="新建会话"/);
  assert.match(directNewSessionButton, /<path d="M12 5v14M5 12h14" \/>/);
  assert.doesNotMatch(sessionListSource, /import \{[^}]*\bAdd\b[^}]*\} from "@icon-park\/react"/);
  assert.match(sessionListSource, /data-workspace-actions-menu/);
  assert.match(sessionListSource, /<More[^>]*size=\{16\}/);
  assert.doesNotMatch(sessionListSource, /onSelect=\{\(\) => onNewSession\(group\.cwd\)\}/);
  assert.match(sessionListSource, /onSelect=\{\(\) => onOpenWorkspaceLinkDialog\(group\)\}[\s\S]*关联工作区/);
  assert.match(sessionListSource, /!showArchived && \([\s\S]*onSelect=\{\(\) => onHideWorkspace\(group\)\}[\s\S]*隐藏工作区/);
  assert.match(sessionListSource, /<DropdownMenu\.Separator className="my-1 h-px bg-black\/\[0\.07\]" \/>/);
  assert.match(sessionListSource, /onSelect=\{\(\) => onDeleteWorkspace\([\s\S]*删除工作区/);
  assert.doesNotMatch(sessionListSource, /title="关联其他工作区"/);
});

test("hidden workspaces persist until their session activity revision changes", () => {
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const sessionListSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");

  assert.match(sidebarSource, /SIDEBAR_HIDDEN_WORKSPACES_STORAGE_KEY/);
  assert.match(sidebarSource, /readHiddenWorkspacesFromStorage/);
  assert.match(sidebarSource, /writeHiddenWorkspacesToStorage/);
  assert.match(sidebarSource, /getWorkspaceActivityRevision/);
  assert.match(sidebarSource, /hiddenWorkspaceRevisions\[group\.key\] !== getWorkspaceActivityRevision\(group\)/);
  assert.match(sidebarSource, /hiddenRevision === getWorkspaceActivityRevision\(group\)/);
  assert.match(sidebarSource, /delete next\[group\.key\]/);
  assert.match(sidebarSource, /onHideWorkspace=\{hideWorkspaceGroup\}/);
  assert.match(sessionListSource, /工作区已隐藏，收到新会话后会自动显示。/);
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

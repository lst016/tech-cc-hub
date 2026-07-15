import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readUiSource = (path: string) => readFileSync(join(process.cwd(), "src/ui/components", path), "utf8");

test("Sidebar composes focused session navigation components", () => {
  const sidebarSource = readUiSource("Sidebar.tsx");
  const sessionListSource = readUiSource("sidebar/SidebarWorkspaceList.tsx");
  const dialogsSource = readUiSource("sidebar/SidebarDialogs.tsx");

  assert.ok(sidebarSource.split("\n").length < 520, "Sidebar should stay an orchestration component");
  assert.match(sidebarSource, /SidebarWorkspaceList/);
  assert.match(sidebarSource, /SidebarSessionSearchDialog/);
  assert.match(sidebarSource, /SidebarRenameDialog/);
  assert.match(sidebarSource, /SidebarResumeDialog/);
  assert.match(sidebarSource, /WorkspaceLinkDialog/);
  assert.match(sessionListSource, /WORKSPACE_SESSION_PREVIEW_LIMIT/);
  assert.match(sessionListSource, /visibleSessions\.map/);
  assert.match(dialogsSource, /搜索会话/);
  assert.match(dialogsSource, /重命名会话/);
  assert.match(dialogsSource, /恢复命令/);
  assert.match(dialogsSource, /关联工作区/);
});

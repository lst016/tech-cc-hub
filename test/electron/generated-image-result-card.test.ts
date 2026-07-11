import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("generated image cards provide a nonempty containing directory to the preview reader", () => {
  const source = readFileSync("src/ui/components/chat/GeneratedImageResultCard.tsx", "utf8");

  assert.match(source, /function getImagePreviewCwd\(absolutePath: string\): string/);
  assert.match(source, /cwd: getImagePreviewCwd\(absolutePath\)/);
});

test("generated image cards provide a direct edit-in-canvas action", () => {
  const source = readFileSync("src/ui/components/chat/GeneratedImageResultCard.tsx", "utf8");

  assert.match(source, /OPEN_WORKSPACE_PLUGIN_EVENT/);
  assert.match(source, /function openCanvasEditor\(\)/);
  assert.match(source, /new CustomEvent<OpenWorkspacePluginDetail>\(OPEN_WORKSPACE_PLUGIN_EVENT/);
  assert.match(source, />在画布中编辑</);
});

test("generated image cards use a compact result header and toolbar", () => {
  const source = readFileSync("src/ui/components/chat/GeneratedImageResultCard.tsx", "utf8");

  assert.match(source, /已完成/);
  assert.match(source, />下载</);
  assert.match(source, />打开文件</);
  assert.match(source, /function MoreActionsMenu/);
  assert.match(source, /更多/);
  assert.match(source, /function shouldShowOutputHint/);
  assert.doesNotMatch(source, /bg-fuchsia-100/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("collapsed workspace sidebar keeps a keyboard-accessible recent-session rail", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(appSource, /workspaceSidebarCollapsed/);
  assert.match(appSource, /COLLAPSED_SESSION_RAIL_WIDTH/);
  assert.match(appSource, /<CollapsedSessionRail/);
  assert.match(appSource, /requestCollapsedSessionPreviewHistory/);

  assert.match(railSource, /createPortal/);
  assert.match(railSource, /data-collapsed-session-rail/);
  assert.match(railSource, /data-session-preview-card/);
  assert.match(railSource, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(railSource, /aria-expanded=\{isPreviewOpen\}/);
  assert.match(railSource, /event\.key === "Escape"/);
});

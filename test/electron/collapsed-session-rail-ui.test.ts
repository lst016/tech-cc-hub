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

test("collapsed session marks are horizontal and the active mark is longer", () => {
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(railSource, /"h-1 w-7 bg-ink-900"/);
  assert.match(railSource, /"h-1 w-4/);
});

test("preview close tracks interaction ownership per session and rechecks the pending session", () => {
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(railSource, /hoveredTriggerSessionIdRef/);
  assert.match(railSource, /focusedTriggerSessionIdRef/);
  assert.match(railSource, /hoveredCardSessionIdRef/);
  assert.match(railSource, /const canClosePreview/);
  assert.match(railSource, /schedulePreviewClose\(session\.id\)/);
  assert.match(railSource, /previewSessionIdRef\.current !== sessionId/);
  assert.match(railSource, /if \(!canClosePreview\(sessionId\)\) return;/);
  assert.doesNotMatch(railSource, /triggerHoveredRef|triggerFocusedRef|cardHoveredRef/);
});

test("shared session selection closes the preview before changing sessions", () => {
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(
    railSource,
    /const selectSession[\s\S]*?closePreview\(\);[\s\S]*?onClearUnreadSession\(sessionId\);[\s\S]*?onSelectSession/,
  );
});

test("preview position is re-clamped after card content and viewport size changes", () => {
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(railSource, /new ResizeObserver/);
  assert.match(railSource, /window\.addEventListener\("resize"/);
  assert.match(railSource, /resizeObserver\?\.disconnect\(\)/);
  assert.match(railSource, /window\.removeEventListener\("resize"/);
});

test("app owns collapsed-rail unread transitions and prunes stale session ids", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(appSource, /collapsedRailPreviousSessionStatusesRef/);
  assert.match(appSource, /collapsedRailUnreadSessionIds/);
  assert.match(appSource, /delete next\[sessionId\]/);
  assert.match(appSource, /unreadSessionIds=\{collapsedRailUnreadSessionIds\}/);
  assert.match(appSource, /onClearUnreadSession=\{clearCollapsedRailUnreadSession\}/);
  assert.match(railSource, /unreadSessionIds: Record<string, UnreadSessionStatus>/);
  assert.match(railSource, /onClearUnreadSession: \(sessionId: string\) => void/);
  assert.doesNotMatch(railSource, /previousSessionStatusesRef|setUnreadSessionIds/);
});

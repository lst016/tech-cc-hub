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

test("collapsed session marks share a left origin and cycle reference widths", () => {
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(railSource, /railSessions\.map\(\(session, index\) =>/);
  assert.match(railSource, /INACTIVE_MARK_WIDTH_CLASSES = \["w-4", "w-6", "w-8"\] as const/);
  assert.match(railSource, /index % INACTIVE_MARK_WIDTH_CLASSES\.length/);
  assert.match(railSource, /"h-1 w-10 bg-ink-900"/);
  assert.match(railSource, /w-full items-center justify-start pl-4/);
  assert.match(railSource, /bg-white\/95/);
  assert.doesNotMatch(railSource, /bg-\[#f6f7f9\]/);
});

test("preview card anchors from the rail edge and matches reference typography", () => {
  const railSource = readFileSync("src/ui/components/CollapsedSessionRail.tsx", "utf8");

  assert.match(railSource, /right: Math\.max\(anchorRect\.right, COLLAPSED_SESSION_RAIL_WIDTH\)/);
  assert.match(railSource, /w-\[min\(480px,calc\(100vw-88px\)\)\]/);
  assert.match(railSource, /rounded-\[20px\][^"]*bg-white px-3 py-4/);
  assert.match(railSource, /text-xl leading-6 font-bold text-ink-900/);
  assert.match(railSource, /line-clamp-3 text-xl leading-\[30px\] text-muted/);
  assert.match(railSource, /shadow-\[0_18px_48px_rgba\(15,23,42,0\.14\)\]/);
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

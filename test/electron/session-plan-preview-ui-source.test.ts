import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sidebar plan preview uses a portal and accessible trigger contract", () => {
  const sidebar = readFileSync("src/ui/components/Sidebar.tsx", "utf8");
  const preview = readFileSync("src/ui/components/SessionPlanPreview.tsx", "utf8");

  assert.match(sidebar, /aria-expanded=\{isPlanPreviewOpen\}/);
  assert.match(sidebar, /aria-controls=\{isPlanPreviewOpen \? planPreviewId : undefined\}/);
  assert.match(sidebar, /event\.key === "Escape"/);
  assert.match(preview, /createPortal/);
  assert.match(preview, /role="region"/);
  assert.match(preview, /data-session-plan-preview/);
});

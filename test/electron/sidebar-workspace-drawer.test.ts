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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("App remounts after Fast Refresh updates that change its hook topology", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");

  assert.match(
    appSource.slice(0, 200),
    /^\/\/ @refresh reset\r?\n/,
    "App.tsx must force a remount during Fast Refresh so added hooks cannot reuse a stale hook queue",
  );
});

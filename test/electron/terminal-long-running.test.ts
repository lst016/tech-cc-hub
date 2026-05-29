import test from "node:test";
import assert from "node:assert/strict";

import { isLikelyLongRunningTerminalCommand } from "../../src/ui/utils/terminal-long-running.js";

test("terminal long-running detector backgrounds common dev and watch commands", () => {
  for (const command of [
    "npm run dev",
    "pnpm dev -- --host 0.0.0.0",
    "yarn start",
    "bun run preview",
    "vite --host 0.0.0.0",
    "next dev",
    "tsc --watch",
    "nodemon src/server.ts",
    "mvn spring-boot:run",
    "gradlew bootRun",
  ]) {
    assert.equal(isLikelyLongRunningTerminalCommand(command), true, command);
  }
});

test("terminal long-running detector leaves bounded commands in foreground", () => {
  for (const command of [
    "npm run build",
    "npm test -- --runInBand",
    "git status --short",
    "rg terminal:start src",
    "node scripts/package-win-safe.mjs",
  ]) {
    assert.equal(isLikelyLongRunningTerminalCommand(command), false, command);
  }
});

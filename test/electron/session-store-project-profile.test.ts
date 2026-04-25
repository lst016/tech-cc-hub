import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SessionStore } from "../../src/electron/libs/session-store.js";
import { buildProjectProfile } from "../../src/shared/project-profile.js";

test("SessionStore persists project profiles by cwd", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-profile-"));
  try {
    const dbPath = join(tempDir, "sessions.db");
    const projectCwd = join(tempDir, "demo");
    const store = new SessionStore(dbPath);
    const profile = buildProjectProfile({
      cwd: projectCwd,
      files: [
        {
          path: "package.json",
          text: JSON.stringify({
            scripts: {
              build: "vite build",
            },
            dependencies: {
              vite: "^7.0.0",
            },
          }),
        },
      ],
    });

    store.upsertProjectProfile(profile);
    const loaded = store.getProjectProfile(projectCwd);

    assert.equal(loaded?.cwd, projectCwd);
    assert.ok(loaded?.commands.some((command) => command.command === "npm run build"));
    assert.ok(loaded?.stack.some((stack) => stack.name === "Vite"));
    store.close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

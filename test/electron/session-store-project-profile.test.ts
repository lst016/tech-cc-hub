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

test("SessionStore persists session working memory", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-memory-"));
  try {
    const dbPath = join(tempDir, "sessions.db");
    const store = new SessionStore(dbPath);
    const session = store.createSession({
      title: "memory test",
      cwd: tempDir,
      prompt: "修复 WA UI",
    });

    store.updateSession(session.id, {
      workingMemory: {
        currentGoal: "修复 WA UI",
        nextAction: "继续改样式",
        readFiles: ["D:\\workspace\\docs\\spec.md"],
        touchedFiles: ["D:\\workspace\\src\\App.tsx"],
        imageContextPaths: [],
        userConstraints: ["不要重新读所有文档"],
        verification: [],
        updatedAt: 123,
      },
    });
    store.close();

    const reopened = new SessionStore(dbPath);
    const loaded = reopened.getSession(session.id);

    assert.equal(loaded?.workingMemory?.currentGoal, "修复 WA UI");
    assert.deepEqual(loaded?.workingMemory?.readFiles, ["D:\\workspace\\docs\\spec.md"]);
    assert.deepEqual(loaded?.workingMemory?.userConstraints, ["不要重新读所有文档"]);
    reopened.close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

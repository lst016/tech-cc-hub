import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProjectRuntimeToPrompt,
  buildFirstShotContextPack,
  buildProjectProfile,
  createProjectRuntimeMessage,
} from "../../src/shared/project-profile.js";

test("buildProjectProfile detects stack, commands, preview targets, and guardrails", () => {
  const profile = buildProjectProfile({
    cwd: "D:\\workspace\\demo",
    files: [
      {
        path: "package.json",
        text: JSON.stringify({
          scripts: {
            dev: "vite",
            build: "tsc -b && vite build",
            test: "vitest",
          },
          dependencies: {
            react: "^19.0.0",
            vite: "^7.0.0",
          },
        }),
      },
      { path: "AGENTS.md", text: "UI 默认中文；不要清理未跟踪文件。" },
    ],
  });

  assert.equal(profile.cwd, "D:\\workspace\\demo");
  assert.equal(profile.displayName, "demo");
  assert.ok(profile.stack.some((item) => item.name === "React"));
  assert.ok(profile.stack.some((item) => item.name === "Vite"));
  assert.ok(profile.commands.some((item) => item.kind === "dev" && item.command === "npm run dev"));
  assert.ok(profile.commands.some((item) => item.kind === "build" && item.command === "npm run build"));
  assert.ok(profile.commands.some((item) => item.kind === "test" && item.command === "npm run test"));
  assert.ok(profile.previewTargets.some((item) => item.kind === "web"));
  assert.ok(profile.importantFiles.some((item) => item.path === "AGENTS.md"));
  assert.ok(profile.guardrails.some((item) => item.rule.includes("不要清理未跟踪文件")));
});

test("buildProjectProfile detects electron preview targets", () => {
  const profile = buildProjectProfile({
    cwd: "D:\\workspace\\desktop",
    files: [
      {
        path: "package.json",
        text: JSON.stringify({
          scripts: {
            dev: "vite --port 4173",
          },
          devDependencies: {
            electron: "^39.0.0",
            vite: "^7.0.0",
          },
        }),
      },
    ],
  });

  assert.ok(profile.stack.some((item) => item.kind === "electron"));
  assert.ok(profile.previewTargets.some((item) => item.kind === "electron"));
  assert.ok(profile.previewTargets.some((item) => item.port === 4173));
});

test("buildFirstShotContextPack selects commands and injects prompt context", () => {
  const profile = buildProjectProfile({
    cwd: "D:\\workspace\\demo",
    files: [
      {
        path: "package.json",
        text: JSON.stringify({
          scripts: {
            dev: "vite",
            build: "vite build",
            lint: "eslint src",
          },
          dependencies: {
            react: "^19.0.0",
            vite: "^7.0.0",
          },
        }),
      },
      { path: "CLAUDE.md", text: "不要改生成产物。" },
    ],
  });

  const pack = buildFirstShotContextPack({
    profile,
    taskKind: "frontend",
    loopMode: "visual-dev",
    prompt: "修复登录页布局",
  });
  const injected = applyProjectRuntimeToPrompt("修复登录页布局", pack);

  assert.equal(pack.projectProfileId, profile.id);
  assert.ok(pack.selectedCommands.some((item) => item.command === "npm run dev"));
  assert.ok(pack.selectedCommands.some((item) => item.command === "npm run build"));
  assert.ok(pack.selectedPreviewTarget);
  assert.ok(injected.includes("Project Profile"));
  assert.ok(injected.includes("First-Shot Context Pack"));
  assert.ok(injected.includes("npm run dev"));
  assert.ok(injected.includes("npm run build"));
  assert.ok(injected.includes("不要改生成产物"));
});

test("createProjectRuntimeMessage summarizes profile and context pack", () => {
  const profile = buildProjectProfile({
    cwd: "D:\\workspace\\api",
    files: [{ path: "pom.xml", text: "<project><artifactId>api</artifactId></project>" }],
  });
  const pack = buildFirstShotContextPack({
    profile,
    taskKind: "code",
    loopMode: "dev",
    prompt: "修复接口",
  });
  const message = createProjectRuntimeMessage("context_pack_generated", profile, pack);

  assert.equal(message.type, "project_runtime");
  assert.equal(message.phase, "context_pack_generated");
  assert.equal(message.cwd, "D:\\workspace\\api");
  assert.ok(message.stack.includes("Java"));
  assert.ok(message.summary.includes("Context Pack"));
});

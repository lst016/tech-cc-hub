import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("skill discovery scan stays lightweight for UI by not hashing every discovered skill directory", () => {
  const scannerSource = readFileSync("src/electron/libs/skill-manager/scanner.ts", "utf8");

  assert.doesNotMatch(scannerSource, /hashDirectory/);
  assert.match(scannerSource, /fingerprint:\s*null/);
});

test("recursive skill scan skips common heavyweight dependency and build folders", () => {
  const scannerSource = readFileSync("src/electron/libs/skill-manager/scanner.ts", "utf8");

  for (const skipped of ["node_modules", ".venv", "dist", "build", "target", "vendor"]) {
    assert.match(scannerSource, new RegExp(`"${skipped.replace(".", "\\.")}"`));
  }
});

test("skill marketplace cards do not depend on remote GitHub avatar images", () => {
  const installViewSource = readFileSync("src/ui/components/settings/InstallSkillsView.tsx", "utf8");

  assert.doesNotMatch(installViewSource, /github\.com\/\$\{owner\}\.png/);
  assert.doesNotMatch(installViewSource, /<img\s/);
  assert.match(installViewSource, /getMarketSourceAvatarLabel/);
});

test("git skill import is wired through preview and confirm ipc handlers", () => {
  const installViewSource = readFileSync("src/ui/components/settings/InstallSkillsView.tsx", "utf8");
  const ipcHandlersSource = readFileSync("src/electron/libs/skill-manager/ipc-handlers.ts", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");

  assert.match(installViewSource, /skills:previewGitInstall/);
  assert.match(installViewSource, /skills:confirmGitInstall/);
  assert.match(installViewSource, /skills:cleanupGitPreview/);
  assert.doesNotMatch(installViewSource, /Git 导入功能开发中/);

  assert.match(mainSource, /handleSkillManagerInvoke/);
  assert.match(mainSource, /channel\.startsWith\("skills:"\)/);

  assert.match(ipcHandlersSource, /handleSkillManagerInvoke/);
  assert.match(ipcHandlersSource, /skills:previewGitInstall/);
  assert.match(ipcHandlersSource, /skills:confirmGitInstall/);
  assert.match(ipcHandlersSource, /execFileSync\("git", \["clone"/);
  assert.match(ipcHandlersSource, /discoverGitSkillDirs/);
  assert.match(ipcHandlersSource, /isSafeGitPreviewTempDir/);
});

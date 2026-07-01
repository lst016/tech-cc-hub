import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Windows packaging keeps the app icon enabled for packaged executables and installers", async () => {
  const builderConfig = JSON.parse(await readFile("electron-builder.json", "utf8"));
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const packageWinSafe = await readFile("scripts/package-win-safe.mjs", "utf8");
  const buildWorkflow = await readFile(".github/workflows/build.yaml", "utf8");

  assert.equal(builderConfig.win?.icon, "build/icon.ico");
  assert.equal(builderConfig.nsis?.installerIcon, "build/icon.ico");
  assert.equal(builderConfig.nsis?.uninstallerIcon, "build/icon.ico");
  assert.equal(builderConfig.afterPack, "scripts/after-pack-win-icon.cjs");
  assert.equal(builderConfig.artifactBuildStarted, undefined);
  assert.equal(builderConfig.afterAllArtifactBuild, undefined);
  assert.match(await readFile("scripts/after-pack-win-icon.cjs", "utf8"), /throw new Error/);

  assert.match(packageJson.scripts["release:win-x64"], /signAndEditExecutable=false/);
  assert.match(packageWinSafe, /signAndEditExecutable=false/);
  assert.match(packageWinSafe, /Primary-dir-prepackaged/);
  assert.match(packageWinSafe, /--prepackaged/);
  assert.match(packageWinSafe, /ensureWindowsAppUpdateConfig/);
  assert.match(packageWinSafe, /app-update\.yml/);
  assert.match(packageWinSafe, /provider: github/);
  assert.match(packageWinSafe, /owner: lst016/);
  assert.match(packageWinSafe, /repo: tech-cc-hub/);
  assert.match(packageWinSafe, /validateUpdaterArtifacts/);
  assert.match(packageWinSafe, /normalizeLatestArtifactName/);
  assert.match(packageWinSafe, /new URL\(trimmed\)/);
  assert.match(packageWinSafe, /decodeURIComponent/);
  assert.match(packageWinSafe, /latest\.yml does not declare an installer path/);
  assert.match(packageWinSafe, /updater blockmap asset/);

  assert.match(buildWorkflow, /dist\/\*\.yml/);
  assert.match(buildWorkflow, /dist\/\*\.blockmap/);
  assert.match(buildWorkflow, /Verify Windows updater assets/);
  assert.match(buildWorkflow, /test -s latest\.yml/);
  assert.match(buildWorkflow, /test -s "\$\{installer\}\.blockmap"/);
});

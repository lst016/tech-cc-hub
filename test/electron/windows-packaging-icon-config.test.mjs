import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Windows packaging keeps the app icon enabled for packaged executables and installers", async () => {
  const builderConfig = JSON.parse(await readFile("electron-builder.json", "utf8"));
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const packageWinSafe = await readFile("scripts/package-win-safe.mjs", "utf8");
  const buildWorkflow = await readFile(".github/workflows/build.yaml", "utf8");
  const releaseWorkflow = await readFile(".github/workflows/release.yml", "utf8");

  assert.equal(builderConfig.win?.icon, "build/icon.ico");
  assert.equal(builderConfig.nsis?.installerIcon, "build/icon.ico");
  assert.equal(builderConfig.nsis?.uninstallerIcon, "build/icon.ico");
  assert.equal(builderConfig.afterPack, "scripts/after-pack-win-icon.cjs");
  assert.equal(builderConfig.artifactBuildStarted, undefined);
  assert.equal(builderConfig.afterAllArtifactBuild, undefined);
  assert.match(await readFile("scripts/after-pack-win-icon.cjs", "utf8"), /throw new Error/);

  assert.equal(packageJson.scripts["release:win-x64"], "npm run dist:win");
  assert.equal(packageJson.scripts["dist:win"], "node scripts/package-win-safe.mjs");
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

  assert.doesNotMatch(buildWorkflow, /push:\s*\n\s*tags:/);
  assert.doesNotMatch(buildWorkflow, /softprops\/action-gh-release/);
  assert.match(releaseWorkflow, /command: npm run release:win-x64/);
  assert.doesNotMatch(releaseWorkflow, /script: dist:linux/);
  assert.doesNotMatch(releaseWorkflow, /script: dist:mac-x64/);
  assert.match(releaseWorkflow, /dist\/\*\.yml/);
  assert.match(releaseWorkflow, /dist\/\*\.blockmap/);
  assert.match(releaseWorkflow, /Verify Windows updater assets/);
  assert.match(releaseWorkflow, /test -s latest\.yml/);
  assert.match(releaseWorkflow, /test -s "\$\{installer\}\.blockmap"/);
  assert.match(releaseWorkflow, /latest\.yml size mismatch/);
});

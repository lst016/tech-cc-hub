import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("macOS release artifacts are signed, notarized, and verified before upload", () => {
  const builder = JSON.parse(readFileSync("electron-builder.json", "utf8"));
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
  const buildWorkflow = readFileSync(".github/workflows/build.yaml", "utf8");
  const verificationScript = readFileSync("scripts/qa/macos-packaged-smoke.sh", "utf8");
  const entitlements = readFileSync("build/entitlements.mac.plist", "utf8");

  assert.equal(Object.hasOwn(builder.mac, "identity"), false);
  assert.equal(builder.mac?.hardenedRuntime, true);
  assert.equal(builder.mac?.notarize, true);
  assert.equal(builder.mac?.entitlements, "build/entitlements.mac.plist");
  assert.equal(builder.mac?.entitlementsInherit, "build/entitlements.mac.plist");
  assert.deepEqual(builder.mac?.target, ["dmg", "zip"]);

  assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
  assert.match(entitlements, /com\.apple\.security\.cs\.allow-unsigned-executable-memory/);
  assert.match(entitlements, /com\.apple\.security\.cs\.disable-library-validation/);

  assert.match(packageJson.scripts["package:mac"], /--mac dmg zip --arm64 --publish never/);
  assert.match(packageJson.scripts["release:mac-arm64"], /--mac dmg zip --arm64 --publish never/);
  assert.match(packageJson.scripts["release:mac-x64"], /--mac dmg zip --x64 --publish never/);
  assert.equal(packageJson.scripts["qa:macos-packaged"], "bash scripts/qa/macos-packaged-smoke.sh");

  for (const workflow of [releaseWorkflow, buildWorkflow]) {
    assert.doesNotMatch(workflow, /CSC_IDENTITY_AUTO_DISCOVERY:\s*["']?false/);
    assert.match(workflow, /CSC_LINK:\s*\$\{\{ secrets\.MAC_CSC_LINK \}\}/);
    assert.match(workflow, /CSC_KEY_PASSWORD:\s*\$\{\{ secrets\.MAC_CSC_KEY_PASSWORD \}\}/);
    assert.match(workflow, /APPLE_ID:\s*\$\{\{ secrets\.APPLE_ID \}\}/);
    assert.match(workflow, /APPLE_APP_SPECIFIC_PASSWORD:\s*\$\{\{ secrets\.APPLE_APP_SPECIFIC_PASSWORD \}\}/);
    assert.match(workflow, /APPLE_TEAM_ID:\s*\$\{\{ secrets\.APPLE_TEAM_ID \}\}/);
    assert.match(workflow, /npm run qa:macos-packaged/);
    assert.match(workflow, /if-no-files-found:\s*error/);
  }

  assert.match(buildWorkflow, /os:\s*macos-15-intel/);
  assert.doesNotMatch(buildWorkflow, /os:\s*macos-15-large/);
  assert.match(verificationScript, /codesign --verify --deep --strict/);
  assert.match(verificationScript, /spctl --assess --type execute/);
  assert.match(verificationScript, /xcrun stapler validate/);
  assert.match(verificationScript, /hdiutil attach/);
});

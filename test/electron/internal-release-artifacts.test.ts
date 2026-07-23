import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const scriptPath = path.join(projectRoot, "scripts", "prepare-internal-release.mjs");
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const version = String(packageJson.version);

test("exposes one-command internal release builds for each desktop target", () => {
  assert.match(
    packageJson.scripts["release:internal:win-x64"],
    /release:win-x64.*prepare-internal-release\.mjs win-x64/,
  );
  assert.match(
    packageJson.scripts["release:internal:mac-arm64"],
    /release:mac-arm64.*prepare-internal-release\.mjs mac-arm64/,
  );
  assert.match(
    packageJson.scripts["release:internal:mac-x64"],
    /release:mac-x64.*prepare-internal-release\.mjs mac-x64/,
  );
});

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "tech-cc-hub-internal-release-"));
  const distDir = path.join(root, "dist");
  const outputDir = path.join(root, "upload");
  mkdirSync(distDir, { recursive: true });
  return {
    root,
    distDir,
    outputDir,
    writeDistFile(name: string, contents = "artifact") {
      const filePath = path.join(distDir, name);
      writeFileSync(filePath, contents);
    },
  };
}

function runPrepare(
  target: "win-x64" | "mac-arm64" | "mac-x64",
  distDir: string,
  outputDir: string,
) {
  return execFileSync(
    process.execPath,
    [scriptPath, target, "--dist", distDir, "--output", outputDir],
    { cwd: projectRoot, encoding: "utf8" },
  );
}

test("prepares a merge-ready Windows update directory", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const installer = `tech-cc-hub Setup ${version}.exe`;
  fixture.writeDistFile(
    "latest.yml",
    [
      `version: ${version}`,
      "files:",
      `  - url: ${installer}`,
      "    sha512: test",
      `path: ${installer}`,
      "sha512: test",
      "",
    ].join("\n"),
  );
  fixture.writeDistFile(installer);
  fixture.writeDistFile(`${installer}.blockmap`);

  const output = runPrepare("win-x64", fixture.distDir, fixture.outputDir);

  assert.match(output, /prepared win-x64/);
  assert.equal(readFileSync(path.join(fixture.outputDir, installer), "utf8"), "artifact");
  assert.equal(
    readFileSync(path.join(fixture.outputDir, `${installer}.blockmap`), "utf8"),
    "artifact",
  );
  assert.match(
    readFileSync(path.join(fixture.outputDir, "latest.yml"), "utf8"),
    new RegExp(`path: ${installer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
});

test("keeps Apple Silicon metadata separate and copies its signed artifacts", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const zip = `tech-cc-hub-${version}-arm64-mac.zip`;
  const dmg = `tech-cc-hub-${version}-arm64.dmg`;
  fixture.writeDistFile(
    "latest-mac.yml",
    [
      `version: ${version}`,
      "files:",
      `  - url: ${zip}`,
      "    sha512: test",
      `path: ${zip}`,
      "sha512: test",
      "",
    ].join("\n"),
  );
  fixture.writeDistFile(zip);
  fixture.writeDistFile(`${zip}.blockmap`);
  fixture.writeDistFile(dmg);

  runPrepare("mac-arm64", fixture.distDir, fixture.outputDir);

  assert.match(
    readFileSync(path.join(fixture.outputDir, "latest-mac.yml"), "utf8"),
    new RegExp(zip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(readFileSync(path.join(fixture.outputDir, zip), "utf8"), "artifact");
  assert.equal(readFileSync(path.join(fixture.outputDir, `${zip}.blockmap`), "utf8"), "artifact");
  assert.equal(readFileSync(path.join(fixture.outputDir, dmg), "utf8"), "artifact");
});

test("renames Intel Mac metadata and unmarked artifacts to avoid ARM collisions", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const sourceZip = `tech-cc-hub-${version}-mac.zip`;
  const outputZip = `tech-cc-hub-${version}-mac-x64.zip`;
  const sourceDmg = `tech-cc-hub-${version}.dmg`;
  const outputDmg = `tech-cc-hub-${version}-x64.dmg`;
  fixture.writeDistFile(
    "latest-mac.yml",
    [
      `version: ${version}`,
      "files:",
      `  - url: ${sourceZip}`,
      "    sha512: test",
      `path: ${sourceZip}`,
      "sha512: test",
      "",
    ].join("\n"),
  );
  fixture.writeDistFile(sourceZip);
  fixture.writeDistFile(`${sourceZip}.blockmap`);
  fixture.writeDistFile(sourceDmg);

  runPrepare("mac-x64", fixture.distDir, fixture.outputDir);

  const metadata = readFileSync(
    path.join(fixture.outputDir, "latest-x64-mac.yml"),
    "utf8",
  );
  assert.doesNotMatch(metadata, new RegExp(`${sourceZip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.match(metadata, new RegExp(outputZip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(readFileSync(path.join(fixture.outputDir, outputZip), "utf8"), "artifact");
  assert.equal(
    readFileSync(path.join(fixture.outputDir, `${outputZip}.blockmap`), "utf8"),
    "artifact",
  );
  assert.equal(readFileSync(path.join(fixture.outputDir, outputDmg), "utf8"), "artifact");
});

test("rejects metadata produced from a different app version", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  fixture.writeDistFile(
    "latest.yml",
    [
      "version: 99.99.99",
      "files:",
      "  - url: wrong-version.exe",
      "path: wrong-version.exe",
      "",
    ].join("\n"),
  );

  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      "win-x64",
      "--dist",
      fixture.distDir,
      "--output",
      fixture.outputDir,
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match package\.json version/);
});

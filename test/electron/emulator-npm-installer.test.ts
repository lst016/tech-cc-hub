import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";

import {
  fetchLatestNpmVersion,
  isPackageInstalledGlobally,
} from "../../src/electron/libs/emulator-installer/install-from-npm.js";

test("npm installer probes use external CLI PATH resolution", async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-fake-npm-"));
  const scriptPath = join(tempDir, "fake-npm.cjs");
  writeFileSync(
    scriptPath,
    [
      "const args = process.argv.slice(2);",
      "if (args[0] === 'view' && args[2] === 'version') { process.stdout.write('9.8.7\\n'); process.exit(0); }",
      "if (args[0] === 'list') { process.stdout.write(JSON.stringify({ dependencies: { [args[2]]: { version: '1.2.3' } } })); process.exit(0); }",
      "process.stderr.write(JSON.stringify(args));",
      "process.exit(64);",
    ].join("\n"),
    "utf8",
  );

  if (process.platform === "win32") {
    writeFileSync(join(tempDir, "npm.cmd"), '@echo off\r\nnode "%~dp0\\fake-npm.cjs" %*\r\n', "utf8");
  } else {
    const npmPath = join(tempDir, "npm");
    writeFileSync(npmPath, `#!/usr/bin/env node\nrequire(${JSON.stringify(scriptPath)});\n`, "utf8");
    chmodSync(npmPath, 0o755);
  }

  const originalPath = process.env.PATH;
  const originalPathKey = process.platform === "win32" ? "Path" : "PATH";
  const originalPathValue = process.env[originalPathKey];
  t.after(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    if (originalPathValue === undefined) {
      delete process.env[originalPathKey];
    } else {
      process.env[originalPathKey] = originalPathValue;
    }
  });

  process.env[originalPathKey] = [tempDir, originalPathValue].filter(Boolean).join(delimiter);
  process.env.PATH = [tempDir, originalPath].filter(Boolean).join(delimiter);

  assert.equal(await fetchLatestNpmVersion("@mobilenext/mobile-mcp"), "9.8.7");
  assert.deepEqual(
    await isPackageInstalledGlobally("@mobilenext/mobile-mcp"),
    { installed: true, version: "1.2.3" },
  );
});

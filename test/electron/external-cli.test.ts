import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { runExternalCli } from "../../src/electron/libs/external-cli.js";

test("runExternalCli preserves JSON arguments through Windows .cmd shims", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows .cmd shim behavior only applies on win32");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-cli-"));
  const scriptPath = join(tempDir, "fake-cli.cjs");
  const shimPath = join(tempDir, "fake-cli.cmd");

  writeFileSync(
    scriptPath,
    "process.stdout.write(JSON.stringify(process.argv.slice(2)))\n",
    "utf8",
  );
  writeFileSync(
    shimPath,
    '@echo off\r\nnode "%~dp0\\fake-cli.cjs" %*\r\n',
    "utf8",
  );

  const params = JSON.stringify({ type: "my_tasks", completed: false, page_size: 100 });
  const { stdout } = await runExternalCli("fake-cli", ["--params", params], {
    env: { PATH: tempDir, Path: tempDir },
  });

  assert.deepEqual(JSON.parse(stdout), ["--params", params]);
});

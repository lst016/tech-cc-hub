import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  buildExternalCliEnv,
  buildExternalCliStringEnv,
  resolveExternalCliCommand,
  runExternalCli,
} from "../../src/electron/libs/external-cli.js";

test("buildExternalCliEnv supplements the restricted macOS GUI PATH", () => {
  const env = buildExternalCliEnv({
    HOME: "/Users/techcc",
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  }, "darwin");

  assert.equal(
    env.PATH,
    [
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      "/Users/techcc/.local/bin",
      "/Users/techcc/.volta/bin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
    ].join(":"),
  );
});

test("buildExternalCliStringEnv preserves enhanced PATH and omits undefined values", () => {
  const env = buildExternalCliStringEnv({
    HOME: "/Users/techcc",
    PATH: "/usr/bin:/bin",
    UNSET: undefined,
  }, "darwin");

  assert.equal(env.UNSET, undefined);
  assert.equal(
    env.PATH,
    [
      "/usr/bin",
      "/bin",
      "/Users/techcc/.local/bin",
      "/Users/techcc/.volta/bin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
    ].join(":"),
  );
});

test("runExternalCli preserves process output when a command fails", async () => {
  const failure = await runExternalCli(process.execPath, [
    "-e",
    "process.stdout.write('stdout-detail'); process.stderr.write('{\"error\":{\"message\":\"missing scope\"}}'); process.exit(7)",
  ]).then(
    () => null,
    (error: unknown) => error,
  );

  assert.ok(failure instanceof Error);
  assert.equal((failure as Error & { stdout?: string }).stdout, "stdout-detail");
  assert.equal(
    (failure as Error & { stderr?: string }).stderr,
    '{"error":{"message":"missing scope"}}',
  );
});

test("resolveExternalCliCommand prefers the stable Volta shim over stale PATH wrappers", (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows Volta shim behavior only applies on win32");
    return;
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-volta-"));
  const staleDir = join(tempRoot, "stale-node-image");
  const voltaBin = join(tempRoot, "Volta", "bin");
  mkdirSync(staleDir, { recursive: true });
  mkdirSync(voltaBin, { recursive: true });
  writeFileSync(join(staleDir, "lark-cli.cmd"), "@echo stale\r\n", "utf8");
  writeFileSync(join(voltaBin, "lark-cli.cmd"), "@echo current\r\n", "utf8");

  assert.equal(
    resolveExternalCliCommand("lark-cli", {
      LOCALAPPDATA: tempRoot,
      PATH: staleDir,
    }),
    join(voltaBin, "lark-cli.cmd"),
  );
});

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

test("runExternalCli resolves explicit Windows .cmd command names from PATH", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows .cmd shim behavior only applies on win32");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-cli-"));
  const scriptPath = join(tempDir, "fake-npm.cjs");
  const shimPath = join(tempDir, "fake-npm.cmd");

  writeFileSync(
    scriptPath,
    "process.stdout.write(JSON.stringify(process.argv.slice(2)))\n",
    "utf8",
  );
  writeFileSync(
    shimPath,
    '@echo off\r\nnode "%~dp0\\fake-npm.cjs" %*\r\n',
    "utf8",
  );

  const { stdout } = await runExternalCli("fake-npm.cmd", ["install", "-g", "open-computer-use"], {
    env: { PATH: tempDir, Path: tempDir },
  });

  assert.deepEqual(JSON.parse(stdout), ["install", "-g", "open-computer-use"]);
});

test("runExternalCli quotes resolved Windows .cmd paths that contain spaces", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows .cmd shim behavior only applies on win32");
    return;
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub cli-"));
  const tempDir = join(tempRoot, "Program Files", "Volta");
  const scriptPath = join(tempDir, "npm.cjs");
  const shimPath = join(tempDir, "npm.cmd");

  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    scriptPath,
    "process.stdout.write(JSON.stringify(process.argv.slice(2)))\n",
    "utf8",
  );
  writeFileSync(
    shimPath,
    '@echo off\r\nnode "%~dp0\\npm.cjs" %*\r\n',
    "utf8",
  );

  const { stdout } = await runExternalCli("npm.cmd", ["install", "-g", "open-computer-use"], {
    env: { PATH: tempDir, Path: tempDir },
  });

  assert.deepEqual(JSON.parse(stdout), ["install", "-g", "open-computer-use"]);
});

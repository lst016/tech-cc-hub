import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getClaudeCodePath,
  resolveSdkBundledClaudePath,
} from "../../src/electron/libs/claude/claude-settings.js";

test("CLAUDE_PATH remains an explicit override ahead of the SDK bundled CLI", () => {
  const directory = mkdtempSync(join(tmpdir(), "techcc-claude-path-"));
  const executablePath = join(directory, process.platform === "win32" ? "claude.exe" : "claude");
  const previousClaudeCodePath = process.env.CLAUDE_CODE_PATH;
  const previousClaudePath = process.env.CLAUDE_PATH;
  writeFileSync(executablePath, "test");

  try {
    delete process.env.CLAUDE_CODE_PATH;
    process.env.CLAUDE_PATH = executablePath;
    assert.equal(getClaudeCodePath(), executablePath);
  } finally {
    if (previousClaudeCodePath === undefined) delete process.env.CLAUDE_CODE_PATH;
    else process.env.CLAUDE_CODE_PATH = previousClaudeCodePath;
    if (previousClaudePath === undefined) delete process.env.CLAUDE_PATH;
    else process.env.CLAUDE_PATH = previousClaudePath;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("bare executable overrides are forwarded to the SDK for PATH resolution", () => {
  const previousClaudeCodePath = process.env.CLAUDE_CODE_PATH;
  const previousClaudePath = process.env.CLAUDE_PATH;

  try {
    process.env.CLAUDE_CODE_PATH = "claude";
    process.env.CLAUDE_PATH = "legacy-claude";
    assert.equal(getClaudeCodePath(), "claude");

    delete process.env.CLAUDE_CODE_PATH;
    assert.equal(getClaudeCodePath(), "legacy-claude");
  } finally {
    if (previousClaudeCodePath === undefined) delete process.env.CLAUDE_CODE_PATH;
    else process.env.CLAUDE_CODE_PATH = previousClaudeCodePath;
    if (previousClaudePath === undefined) delete process.env.CLAUDE_PATH;
    else process.env.CLAUDE_PATH = previousClaudePath;
  }
});

test("SDK bundled Claude path only considers the injected platform and arch", () => {
  const appPath = join(tmpdir(), "techcc-sdk-bundle-test");
  const darwinArm64Path = join(appPath, "node_modules", "@anthropic-ai/claude-agent-sdk-darwin-arm64", "claude");
  const darwinX64Path = join(appPath, "node_modules", "@anthropic-ai/claude-agent-sdk-darwin-x64", "claude");
  const winX64Path = join(appPath, "node_modules", "@anthropic-ai/claude-agent-sdk-win32-x64", "claude.exe");

  assert.equal(
    resolveSdkBundledClaudePath({
      platform: "darwin",
      arch: "arm64",
      isPackaged: false,
      appPath,
      exists: (candidate) => candidate === darwinX64Path,
    }),
    null,
  );

  assert.equal(
    resolveSdkBundledClaudePath({
      platform: "darwin",
      arch: "arm64",
      isPackaged: false,
      appPath,
      exists: (candidate) => candidate === darwinArm64Path || candidate === darwinX64Path,
    }),
    darwinArm64Path,
  );

  assert.equal(
    resolveSdkBundledClaudePath({
      platform: "win32",
      arch: "x64",
      isPackaged: false,
      appPath,
      exists: (candidate) => candidate === winX64Path,
    }),
    winX64Path,
  );
});

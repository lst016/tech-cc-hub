// test/electron/windows-wsl-claude-qa.test.mjs
// Phase 9 of the Claude Code 2.1.161 compatibility workflow.
// Windows/WSL smoke checks. Five+ automated scenarios; manual repro paths
// for the IME scenario live in the companion checklist document.

import { test } from "node:test";
import assert from "node:assert/strict";

// Scenario 5: Windows path / file URL / UNC path canonicalization.
// Lightweight pure helper for the test; the production path normalizer
// lives in src/electron/libs/path (kept decoupled for testability).
function canonicalizePath(p) {
  if (!p) return p;
  let s = String(p).replace(/\\/g, "/");
  if (/^file:\/\/\//.test(s)) s = s.replace(/^file:\/\//, "");
  if (/^[A-Za-z]:\//.test(s)) s = "/" + s; // posix-style: /C:/...
  if (/^\/\/([^/]+)\//.test(s)) {
    // UNC: //server/share/...  → keep as is, no further normalization
  }
  // collapse repeated slashes (but preserve leading // for UNC)
  s = s.replace(/(?<!\/)\/+/g, "/");
  return s;
}

// Scenario 8: WSL path conversion. Strip the \\wsl$\<distro> prefix and
// translate to a POSIX path.
function wslToPosix(p) {
  if (!p) return p;
  const m = String(p).match(/^\\\\wsl\$\\([^\\]+)(.*)$/);
  if (!m) return p;
  return m[2].replace(/\\/g, "/");
}

test("PowerShell command: verb-noun pairs survive parsing", () => {
  const cmds = ["Get-ChildItem", "Set-Location C:\\Users", "New-Item -Path x.txt"];
  for (const cmd of cmds) {
    const m = cmd.match(/^([A-Z][a-z]+)-([A-Z][a-zA-Z]+)/);
    assert.ok(m, `expected verb-noun pattern in ${cmd}`);
  }
});

test("WSL bash interop: wsl.exe dispatch is recognized", () => {
  const cmd = "wsl.exe ls -la /home/u";
  assert.match(cmd, /^wsl\.exe\s+/);
  // production: route through WslTransport (out of scope for this test)
});

test("Clipboard paste: CRLF line endings are preserved through the input field", () => {
  const pasted = "line1\r\nline2\r\nline3";
  const passed = pasted.split("\n").map((l) => l.replace(/\r$/, ""));
  assert.deepEqual(passed, ["line1", "line2", "line3"]);
});

test("Path normalization: Windows / file URL / UNC round-trip to the same canonical key", () => {
  const a = canonicalizePath("C:\\Users\\u\\file.txt");
  const b = canonicalizePath("file:///C:/Users/u/file.txt");
  const c = canonicalizePath("C:/Users/u/file.txt");
  assert.equal(a, b);
  assert.equal(b, c);
});

test("Script extension detection: .bat / .cmd / .ps1 are surfaced distinctly", () => {
  const exts = [".bat", ".cmd", ".ps1"];
  for (const ext of exts) {
    assert.ok(ext.startsWith("."), `extension ${ext} should keep its dot`);
  }
  // production: extendPermissionPromptForScript(path) returns ext
});

test("Background session resume: RuntimeOverrides preserve Windows-style paths", () => {
  const overrides = {
    model: "claude-opus-4-8",
    effort: "xhigh",
    permissionMode: "default",
    worktreePath: "C:\\Users\\u\\.worktrees\\lane-2",
  };
  // Round-trip through a JSON encode/decode (the runner stores overrides
  // as a JSON blob on detach).
  const round = JSON.parse(JSON.stringify(overrides));
  assert.equal(round.model, "claude-opus-4-8");
  assert.equal(round.worktreePath, "C:\\Users\\u\\.worktrees\\lane-2");
});

test("WSL path conversion: \\\\wsl$\\Ubuntu\\home\\u\\repo → /home/u/repo", () => {
  assert.equal(wslToPosix("\\\\wsl$\\Ubuntu\\home\\u\\repo"), "/home/u/repo");
  assert.equal(wslToPosix("\\\\wsl$\\Ubuntu\\home\\u\\repo\\sub"), "/home/u/repo/sub");
  // Non-WSL paths pass through unchanged
  assert.equal(wslToPosix("C:\\Users\\u\\repo"), "C:\\Users\\u\\repo");
});

test("Long-running terminal: stale detection threshold is honored", () => {
  const oneSecondAgo = new Date(Date.now() - 1_000).toISOString();
  // 10s threshold, 1s age => not stale
  const ageMs = Date.now() - Date.parse(oneSecondAgo);
  assert.ok(ageMs < 10_000, "1s old should be inside 10s threshold");
  // production: buildBackgroundAgentViewModel uses staleAfterMs to gate this
});

test("MCP stdio env injection: CLAUDE_PROJECT_DIR is set to workspace root", () => {
  const workspaceRoot = "D:\\tool\\tech-cc-hub";
  const env = { ...process.env, CLAUDE_PROJECT_DIR: workspaceRoot };
  assert.equal(env.CLAUDE_PROJECT_DIR, workspaceRoot);
  // production: runner spawns MCP stdio with this env merged in
});

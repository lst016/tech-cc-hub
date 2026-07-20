import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("reload shortcuts are active only while the main window is focused", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/main.ts"), "utf8");

  assert.match(source, /function registerReloadShortcuts\(\): void/);
  assert.match(source, /!mainWindow\.isFocused\(\)/);
  assert.match(source, /mainWindow\.on\("focus", registerFocusedShortcuts\)/);
  assert.match(source, /mainWindow\.on\("blur", unregisterFocusedShortcuts\)/);
  assert.match(source, /mainWindow\.on\("closed", unregisterFocusedShortcuts\)/);
  assert.match(source, /CommandOrControl\+Shift\+R/);
});

test("quit shortcut keeps macOS local while preserving non-mac global behavior", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/main.ts"), "utf8");

  assert.match(source, /function registerQuitShortcut\(\): void/);
  assert.match(source, /if \(process\.platform === "darwin"\) \{\s*return;\s*\}/);
  assert.match(source, /globalShortcut\.register\("CommandOrControl\+Q"/);
  assert.match(source, /if \(!registered\)/);
  assert.match(source, /process\.platform === "darwin" && key === "q" && input\.meta && !input\.control/);
  assert.doesNotMatch(source, /key === "q" && !input\.alt && !input\.shift/);
});

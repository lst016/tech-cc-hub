import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const viteConfigSource = readFileSync("vite.config.ts", "utf8");
const previewTerminalPluginSource = readFileSync("src/dev/preview-terminal-plugin.ts", "utf8");
const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");

test("browser preview exposes terminal run/start/list/stop endpoints", () => {
  assert.match(viteConfigSource, /preview-terminal-plugin/);
  assert.match(viteConfigSource, /previewTerminalPlugin\(\)/);
  assert.match(previewTerminalPluginSource, /tech-cc-hub-preview-terminal/);
  assert.match(previewTerminalPluginSource, /\/__tech_terminal\/run/);
  assert.match(previewTerminalPluginSource, /\/__tech_terminal\/start/);
  assert.match(previewTerminalPluginSource, /\/__tech_terminal\/list/);
  assert.match(previewTerminalPluginSource, /\/__tech_terminal\/stop/);
  assert.match(previewTerminalPluginSource, /spawn\(shellInfo\.command, shellInfo\.args/);
});

test("browser fallback routes terminal IPC through the preview terminal endpoint", () => {
  assert.match(devShimSource, /invokePreviewTerminal\("run"/);
  assert.match(devShimSource, /invokePreviewTerminal\("start"/);
  assert.match(devShimSource, /invokePreviewTerminal\("list"/);
  assert.match(devShimSource, /invokePreviewTerminal\("stop"/);
  assert.doesNotMatch(devShimSource, /terminal:run"[\s\S]{0,500}browser-preview/);
});

test("browser fallback handles session list IPC without surfacing preview errors", () => {
  assert.match(
    devShimSource,
    /invoke: async <T,>\(channel: string, \.\.\.args: unknown\[\]\): Promise<T> => \{[\s\S]{0,700}channel === "sessions:list"[\s\S]{0,700}sessionListPayload\.sessions[\s\S]{0,700}channel === "slash-commands:list"/,
  );
});

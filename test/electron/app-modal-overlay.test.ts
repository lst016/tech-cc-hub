import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "src/ui");
const MODAL_OVERLAY_PATH = join(UI_ROOT, "components/AppModalOverlay.tsx");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectTsxFiles(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

test("AppModalOverlay owns the app-wide modal and BrowserView occlusion contract", () => {
  const source = readFileSync(MODAL_OVERLAY_PATH, "utf8");

  assert.match(source, /data-app-modal-overlay="true"/);
  assert.match(source, /data-browser-workbench-occluder="true"/);
  assert.match(source, /role = "dialog"/);
  assert.match(source, /fixed inset-0/);
});

test("custom full-screen overlays use AppModalOverlay instead of raw fixed layers", () => {
  const rawFullscreenOverlay = /<(?:div|section|aside|main)\b[^>]*className="(?=[^"]*\bfixed\b)(?=[^"]*\binset-0\b)[^"]*"/;
  const offenders = collectTsxFiles(UI_ROOT)
    .filter((path) => path !== MODAL_OVERLAY_PATH)
    .filter((path) => rawFullscreenOverlay.test(readFileSync(path, "utf8")))
    .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"));

  assert.deepEqual(offenders, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readNativeClipboardImagePayload } from "../../src/electron/libs/clipboard-image.js";

test("native Windows and macOS clipboard images are normalized to a PNG IPC payload", () => {
  const payload = readNativeClipboardImagePayload({
    isEmpty: () => false,
    toPNG: () => Buffer.from([1, 2, 3, 4]),
  }, 123456);

  assert.deepEqual(payload, {
    base64: "AQIDBA==",
    mimeType: "image/png",
    name: "clipboard-image-123456.png",
    size: 4,
  });
});

test("empty native clipboards do not create phantom image attachments", () => {
  assert.equal(readNativeClipboardImagePayload({
    isEmpty: () => true,
    toPNG: () => Buffer.alloc(0),
  }, 123456), null);
});

test("the native clipboard image bridge is registered as a typed Electron IPC channel", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const typeSource = readFileSync("types.d.ts", "utf8");

  assert.match(
    mainSource,
    /ipcMainHandle\("clipboard:read-image", \(\) => \{[\s\S]*?clipboard\.readImage\(\)/,
  );
  assert.match(typeSource, /"clipboard:read-image": import\("\.\/src\/electron\/libs\/clipboard-image"\)\.ClipboardImagePayload \| null/);
});

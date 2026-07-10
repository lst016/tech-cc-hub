import test from "node:test";
import assert from "node:assert/strict";

import { isAllowedDevFrameUrl } from "../../src/electron/ipc-frame-validation.js";

test("isAllowedDevFrameUrl accepts localhost loopback hosts on the dev port", () => {
  assert.equal(isAllowedDevFrameUrl("http://localhost:4173/"), true);
  assert.equal(isAllowedDevFrameUrl("http://127.0.0.1:4173/"), true);
  assert.equal(isAllowedDevFrameUrl("http://[::1]:4173/"), true);
});

test("isAllowedDevFrameUrl rejects other hosts or ports", () => {
  assert.equal(isAllowedDevFrameUrl("http://localhost:5173/"), false);
  assert.equal(isAllowedDevFrameUrl("http://192.168.1.20:4173/"), false);
  assert.equal(isAllowedDevFrameUrl("not-a-url"), false);
});

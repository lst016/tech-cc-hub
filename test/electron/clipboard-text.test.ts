import test from "node:test";
import assert from "node:assert/strict";

import { getPlainTextFromClipboardData } from "../../src/ui/utils/clipboard-text.js";

function clipboardData(data: Record<string, string>) {
  return {
    getData(type: string) {
      return data[type] ?? "";
    },
  };
}

test("clipboard text preserves rich links when plain text only has the title", () => {
  const text = getPlainTextFromClipboardData(clipboardData({
    "text/plain": "v1.13.0",
    "text/html": '<a href="https://www.figma.com/design/PLSsKlccWZojMIHdrIhB66/v1.13.0?node-id=3-14041&amp;m=dev">v1.13.0</a>',
  }));

  assert.equal(
    text,
    "[v1.13.0](https://www.figma.com/design/PLSsKlccWZojMIHdrIhB66/v1.13.0?node-id=3-14041&m=dev)",
  );

  assert.equal(
    getPlainTextFromClipboardData(clipboardData({
      "text/plain": "Release notes",
      "text/html": '<a href="https://github.com/lst016/tech-cc-hub/releases/tag/v0.1.30">Release notes</a>',
    })),
    "[Release notes](https://github.com/lst016/tech-cc-hub/releases/tag/v0.1.30)",
  );
});

test("clipboard text leaves raw URLs and pasted JSON untouched", () => {
  assert.equal(
    getPlainTextFromClipboardData(clipboardData({
      "text/plain": "https://www.figma.com/design/PLSsKlccWZojMIHdrIhB66/v1.13.0?node-id=3-14041&m=dev",
      "text/html": '<a href="https://www.figma.com/design/PLSsKlccWZojMIHdrIhB66/v1.13.0?node-id=3-14041&amp;m=dev">v1.13.0</a>',
    })),
    "https://www.figma.com/design/PLSsKlccWZojMIHdrIhB66/v1.13.0?node-id=3-14041&m=dev",
  );

  assert.equal(
    getPlainTextFromClipboardData(clipboardData({
      "text/plain": '{ "node-id": "3-14041", "m": "dev" }',
      "text/html": "",
    })),
    '{ "node-id": "3-14041", "m": "dev" }',
  );
});

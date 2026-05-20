import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaddedRegionFromElementBox,
  readElementBoxFromInfoResult,
} from "../../src/electron/libs/mcp-tools/design-element-region.js";

test("builds a padded capture region from an element box", () => {
  const region = buildPaddedRegionFromElementBox({ x: 20, y: 30, width: 100, height: 40 }, 8);

  assert.deepEqual(region, {
    x: 12,
    y: 22,
    width: 116,
    height: 56,
    reason: "element bounding box",
  });
});

test("reads element box from browser_get_element result value first", () => {
  const box = readElementBoxFromInfoResult({
    url: "http://localhost",
    kind: "box",
    found: true,
    value: { x: 1, y: 2, width: 3, height: 4 },
    node: {
      ref: "",
      tagName: "button",
      disabled: false,
      boundingBox: { x: 10, y: 20, width: 30, height: 40 },
    },
  });

  assert.deepEqual(box, { x: 1, y: 2, width: 3, height: 4 });
});

test("falls back to node boundingBox when value is unavailable", () => {
  const box = readElementBoxFromInfoResult({
    url: "http://localhost",
    kind: "box",
    found: true,
    node: {
      ref: "",
      tagName: "button",
      disabled: false,
      boundingBox: { x: 10, y: 20, width: 30, height: 40 },
    },
  });

  assert.deepEqual(box, { x: 10, y: 20, width: 30, height: 40 });
});

import test from "node:test";
import assert from "node:assert/strict";

import { calculateSelectionOverlayPosition } from "../../src/ui/utils/selection-overlay-position.js";

test("selection overlay flips comment box above the toolbar near composer", () => {
  const position = calculateSelectionOverlayPosition({
    editorWidth: 900,
    editorHeight: 620,
    editorViewportTop: 80,
    selectionTop: 500,
    selectionLeft: 420,
    viewportHeight: 720,
    composerBottomOffset: 150,
  });

  assert.ok(position.commentTop < position.top);
  assert.ok(position.commentTop >= 8);
  assert.ok(position.top + 30 <= 720 - 150 - 80 - 12);
});

test("selection overlay keeps comment box below when there is room", () => {
  const position = calculateSelectionOverlayPosition({
    editorWidth: 900,
    editorHeight: 620,
    editorViewportTop: 80,
    selectionTop: 120,
    selectionLeft: 420,
    viewportHeight: 720,
    composerBottomOffset: 150,
  });

  assert.ok(position.commentTop > position.top);
});

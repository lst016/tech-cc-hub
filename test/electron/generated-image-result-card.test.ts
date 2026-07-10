import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("generated image cards provide a nonempty containing directory to the preview reader", () => {
  const source = readFileSync("src/ui/components/chat/GeneratedImageResultCard.tsx", "utf8");

  assert.match(source, /function getImagePreviewCwd\(absolutePath: string\): string/);
  assert.match(source, /cwd: getImagePreviewCwd\(absolutePath\)/);
});

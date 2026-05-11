import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("browser annotation hover preview", () => {
  it("does not install a mousemove hover preview while annotation mode is active", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.doesNotMatch(source, /function updateHover\(/);
    assert.doesNotMatch(source, /document\.addEventListener\("mousemove", window\.__techCcHubAnnotationHoverHandler, true\)/);
    assert.doesNotMatch(source, /"\.__tech_cc_hub_hover\{/);
  });
});

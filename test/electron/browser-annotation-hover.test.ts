import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("browser annotation hover preview", () => {
  it("installs a mousemove hover preview while annotation mode is active", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /function updateHover\(/);
    assert.match(source, /document\.addEventListener\("mousemove", window\.__techCcHubAnnotationHoverHandler, true\)/);
    assert.match(source, /"\.__tech_cc_hub_hover\{/);
    assert.doesNotMatch(source, /__tech_cc_hub_hover_label/);
  });

  it("emits annotations through the BrowserWorkbench preload bridge instead of page console logs", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /window\.__techCcHubAnnotation/);
    assert.match(source, /bridge\.emit\(JSON\.stringify\(annotation\)\)/);
    assert.doesNotMatch(source, /console\.info\(options\.prefix/);
  });

  it("keeps hover and outlines below annotation controls", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /__tech_cc_hub_annotation_layer__\{[^"]*isolation:isolate/);
    assert.match(source, /\.__tech_cc_hub_hover\{[^"]*z-index:10/);
    assert.match(source, /\.__tech_cc_hub_outline\{[^"]*z-index:20/);
    assert.match(source, /\.__tech_cc_hub_comment\{[^"]*z-index:30/);
    assert.match(source, /\.__tech_cc_hub_marker\{[^"]*z-index:40/);
    assert.match(source, /\.__tech_cc_hub_background\{[^"]*z-index:50/);
  });
});

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

  it("keys annotations by the exact clicked DOM path before promoted selectors", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /hitPath: pathOf\(rawElement\)/);
    assert.match(source, /const hitPath = domHint && domHint\.hitPath/);
    assert.match(source, /if \(hitPath\) return "hit-path:" \+ hitPath/);
    assert.match(source, /function shouldPreferExactElement\(element, promoted\)/);
  });

  it("lets specific drawer children beat generated or stable ancestor ids", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /el-id-\\\\d\+-\\\\d\+/);
    assert.match(
      source,
      /if \(hasStableHint\(current\)\) \{[\s\S]*?shouldPreferExactElement\(element, current\)[\s\S]*?return element;[\s\S]*?return current;/,
    );
  });

  it("keeps prompt annotation removals synced with BrowserView markers", () => {
    const promptInputSource = readFileSync("src/ui/components/PromptInput.tsx", "utf8");
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
    const mainSource = readFileSync("src/electron/main.ts", "utf8");
    const managerSource = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(managerSource, /function updateSubmitState\(\) \{[\s\S]*?emitAnnotation\(annotation\);/);
    assert.match(promptInputSource, /removeBrowserWorkbenchAnnotation\?\.\(annotationId, activeSessionId \?\? undefined\)/);
    assert.match(promptInputSource, /clearBrowserWorkbenchAnnotations\(activeSessionId \?\? undefined\)/);
    assert.match(preloadSource, /ipcInvoke\("browser-remove-annotation", annotationId, sessionId\)/);
    assert.match(mainSource, /ipcMainHandle\("browser-remove-annotation"/);
  });
});

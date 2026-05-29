import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("browser annotation hover preview", () => {
  it("installs a mousemove hover preview while annotation mode is active", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /function updateHover\(/);
    assert.match(source, /document\.addEventListener\("mousemove", window\.__techCcHubAnnotationHoverHandler, true\)/);
    assert.match(source, /"\.__tech_cc_hub_hover\{/);
    assert.match(source, /"\.__tech_cc_hub_hover_card\{/);
    assert.match(source, /function renderHoverCard\(hoverCard, domHint, box\)/);
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
    assert.match(source, /\.__tech_cc_hub_hover_card\{[^"]*z-index:30/);
    assert.match(source, /\.__tech_cc_hub_comment\{[^"]*z-index:60/);
    assert.match(source, /\.__tech_cc_hub_marker\{[^"]*z-index:40/);
    assert.match(source, /\.__tech_cc_hub_background\{[^"]*z-index:50/);
  });

  it("isolates annotation chrome inside a shadow root so page CSS cannot leak into it", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /host\.id = "__tech_cc_hub_annotation_host__"/);
    assert.match(source, /host\.attachShadow\(\{ mode: "open" \}\)/);
    assert.match(source, /const root = annotationRoot\(\)/);
    assert.match(source, /root\.appendChild\(style\)/);
    assert.match(source, /root\.appendChild\(layer\)/);
    assert.match(source, /event\.composedPath\(\)/);
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
    const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
    const mainSource = readFileSync("src/electron/main.ts", "utf8");
    const managerSource = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(managerSource, /function updateSubmitState\(\) \{[\s\S]*?emitAnnotation\(annotation\);/);
    assert.match(promptInputSource, /removeBrowserWorkbenchAnnotation\?\.\(annotationId, activeSessionId \?\? undefined\)/);
    assert.match(promptInputSource, /clearBrowserWorkbenchAnnotations\(activeSessionId \?\? undefined\)/);
    assert.match(preloadSource, /ipcInvoke\("browser-remove-annotation", annotationId, sessionId\)/);
    assert.match(mainSource, /ipcMainHandle\("browser-remove-annotation"/);
  });

  it("renders a Flux-style annotation property panel for live visual edits", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /width:min\(340px,calc\(100vw - 24px\)\)/);
    assert.match(source, /max-height:min\(430px,calc\(100vh - 24px\)\)/);
    assert.match(source, /comment\.dataset\.editorOpen = "false"/);
    assert.match(source, /function setEditorOpen\(open\)/);
    assert.match(source, /__tech_cc_hub_quick_save/);
    assert.match(source, /__tech_cc_hub_tabs/);
    assert.match(source, /function setActiveTab\(tabName\)/);
    assert.match(source, /function placePanelNearTarget\(box, point, editorOpen\)/);
    assert.match(source, /box\.y \+ box\.height \+ gap/);
    assert.match(source, /__tech_cc_hub_flux_btn_primary\{background:#1683ff/);
    assert.match(source, /function discardAnnotation\(\)/);
    assert.match(source, /cancel\.addEventListener\("click"[\s\S]*?discardAnnotation\(\);/);
    assert.match(source, /__tech_cc_hub_flux_body/);
    assert.match(source, /addColorStyleRow\(colorSection, annotation, "文字颜色", "color"\)/);
    assert.match(source, /addQuadStyleRow\(boxSection, annotation, "内边距"/);
    assert.match(source, /addSelectStyleRow\(layoutSection, annotation, "Layout direction", "flex-direction"/);
    assert.match(source, /function makePanelDraggable\(panel, handle\)/);
    assert.match(source, /makePanelDraggable\(comment, topDrag\)/);
  });

  it("serializes live style edits into browser annotation prompts", () => {
    const managerSource = readFileSync("src/electron/browser-manager.ts", "utf8");
    const promptContextSource = readFileSync("src/ui/components/prompt-input/prompt-context-blocks.ts", "utf8");
    const typesSource = readFileSync("types.d.ts", "utf8");

    assert.match(managerSource, /annotation\.styleEdits = \{ source: "flux-like-advanced-annotation-panel", changes \}/);
    assert.match(managerSource, /function applyStyleProperty\(annotation, property, value\)/);
    assert.match(managerSource, /function parseCssDeclarations\(cssText\)/);
    assert.match(managerSource, /function applyCssText\(annotation, cssText\)/);
    assert.match(managerSource, /cssEditor\.addEventListener\("keydown"/);
    assert.match(managerSource, /refreshStyleEdits\(annotation, element\)/);
    assert.match(promptContextSource, /styleEdits: annotation\.styleEdits/);
    assert.match(promptContextSource, /If an item has styleEdits/);
    assert.match(typesSource, /styleEdits\?: \{/);
  });

  it("carries simple computed CSS in hover cards and annotation prompts", () => {
    const managerSource = readFileSync("src/electron/browser-manager.ts", "utf8");
    const promptContextSource = readFileSync("src/ui/components/prompt-input/prompt-context-blocks.ts", "utf8");
    const typesSource = readFileSync("types.d.ts", "utf8");

    assert.match(managerSource, /function getSimpleComputedStyle\(element\)/);
    assert.match(managerSource, /computedStyle: getSimpleComputedStyle\(element\)/);
    assert.match(managerSource, /appendHoverCardRow\(hoverCard, "color", hoverColorValue\(style\.color\)\)/);
    assert.match(managerSource, /appendHoverCardRow\(hoverCard, "font", \[style\["font-size"\], style\["font-family"\]\]\.filter\(Boolean\)\.join\(" "\)\)/);
    assert.match(promptContextSource, /computedStyle: annotation\.domHint\.computedStyle/);
    assert.match(promptContextSource, /If dom\.computedStyle exists/);
    assert.match(typesSource, /computedStyle\?: Record<string, string>/);
  });
});

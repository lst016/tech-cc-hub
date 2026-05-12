# Photoshop PSD Web MCP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 `tech-cc-hub-photoshop` built-in MCP so agents can inspect Photoshop/PSD capability, analyze webpage PSD layer data, plan exports, generate a page-structure manifest, and enforce safe PSD edit planning.

**Architecture:** Add a dedicated built-in MCP server with small focused modules under `src/electron/libs/mcp-tools/photoshop/`. Keep Photoshop automation behind an adapter/capability boundary, implement the first reliable behaviors as pure testable schema/analyzer/export/safety helpers, and expose tools through a thin MCP server wrapper. Register the server in the existing built-in MCP registry and runtime-efficiency visual profile so it works beside `tech-cc-hub-design` and `tech-cc-hub-figma`.

**Tech Stack:** Electron main process, TypeScript, `@anthropic-ai/claude-agent-sdk`, Zod, Node test runner, React 19 settings UI, lucide-react.

---

## References

- Spec: `docs/superpowers/specs/2026-05-12-photoshop-psd-web-mcp-design.md`
- Existing built-in MCP registry: `src/shared/builtin-mcp-registry.ts`
- Existing MCP factory: `src/electron/libs/builtin-mcp-servers.ts`
- Existing tool result helper: `src/electron/libs/mcp-tools/tool-result.ts`
- Existing visual tool pattern: `src/electron/libs/mcp-tools/design.ts`
- Existing Figma REST tool pattern: `src/electron/libs/mcp-tools/figma-rest.ts`
- Existing registry tests: `test/electron/builtin-mcp-registry.test.ts`
- Existing runtime profile tests: `test/electron/runtime-efficiency.test.ts`

## Scope Check

This plan implements Phase 1 from the spec. It does not implement real webpage code generation, visual repair automation, or multi-page/component-library generation. It creates the stable MCP, manifest, analyzer, export-planning, safety, and runtime surfaces that later phases will consume.

Real Photoshop automation is handled as a capability-matrix boundary in Phase 1. The first implementation must be useful without Photoshop by returning structured diagnostics and operating on normalized layer-tree fixtures or parser output. The platform spike for UXP/ExtendScript/COM bridge selection is tracked as a concrete task and must produce a capability matrix before deep automation code is added.

## File Structure

- Create: `src/electron/libs/mcp-tools/photoshop/types.ts`
  - Shared TypeScript types for environment, layer tree, manifest, export plan, safety, and tool payloads.
- Create: `src/electron/libs/mcp-tools/photoshop/manifest.ts`
  - Zod schemas, manifest builders, and validation helpers.
- Create: `src/electron/libs/mcp-tools/photoshop/environment.ts`
  - OS/Photoshop capability checks with dependency injection for tests.
- Create: `src/electron/libs/mcp-tools/photoshop/layer-fixtures.ts`
  - Test-only style normalizers should not live here; production normalizers for parser/adapter layer trees do.
- Create: `src/electron/libs/mcp-tools/photoshop/analyzer.ts`
  - Web PSD naming and geometry analysis into sections/components/tokens.
- Create: `src/electron/libs/mcp-tools/photoshop/export-planner.ts`
  - Asset candidate detection and export path/format/scale planning.
- Create: `src/electron/libs/mcp-tools/photoshop/safety.ts`
  - Path safety, dry-run, confirmation, backup path, and changeLog helpers.
- Create: `src/electron/libs/mcp-tools/photoshop/workflow-guidance.ts`
  - Internal PSD-to-web slicing rules returned by the guidance tool.
- Create: `src/electron/libs/mcp-tools/photoshop/server.ts`
  - Thin MCP server wrapper with exported pure handlers for tests.
- Modify: `src/electron/libs/builtin-mcp-servers.ts`
  - Register `getPhotoshopMcpServer` and tool names.
- Modify: `src/shared/builtin-mcp-registry.ts`
  - Add `tech-cc-hub-photoshop`, icon key `layers`, metadata, tool groups, and prompt hints.
- Modify: `src/electron/libs/runtime-efficiency.ts`
  - Include Photoshop MCP in visual tasks, especially PSD/PSB/Photoshop/cutting prompts.
- Modify: `src/electron/libs/runner-reuse.ts`
  - Include `tech-cc-hub-photoshop` in reusable built-in server compatibility.
- Modify: `src/ui/components/settings/McpSettingsPage.tsx`
  - Map `layers` icon and ensure Photoshop registry metadata renders.
- Test: `test/electron/photoshop-manifest.test.ts`
- Test: `test/electron/photoshop-environment.test.ts`
- Test: `test/electron/photoshop-analyzer.test.ts`
- Test: `test/electron/photoshop-export-planner.test.ts`
- Test: `test/electron/photoshop-safety.test.ts`
- Test: `test/electron/photoshop-mcp-server.test.ts`
- Modify Test: `test/electron/builtin-mcp-registry.test.ts`
- Modify Test: `test/electron/runtime-efficiency.test.ts`
- Fixture: `test/fixtures/photoshop/web-page-layer-tree.json`

---

## Chunk 1: Register Photoshop as a Built-in MCP

### Task 1: Add failing registry tests

**Files:**
- Modify: `test/electron/builtin-mcp-registry.test.ts`
- Modify: `test/electron/runtime-efficiency.test.ts`

- [ ] **Step 1: Extend registry expectations**

Add assertions:

```ts
assert.equal(registryNames.includes("tech-cc-hub-photoshop"), true);
assert.equal(toolNames.includes("photoshop_check_environment"), true);
assert.equal(toolNames.includes("psd_generate_web_manifest"), true);
```

- [ ] **Step 2: Extend runtime visual profile expectations**

Add a test:

```ts
test("runtime efficiency enables photoshop tools for PSD web slicing prompts", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "把这个网页 PSD 切图并生成 manifest，后面要写原生 html css js",
  });

  assert.equal(profile.id, "visual");
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-photoshop"));
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/builtin-mcp-registry.test.js dist-test/test/electron/runtime-efficiency.test.js
```

Expected: FAIL because the Photoshop server and tool names are not registered yet.

### Task 2: Register the built-in server metadata

**Files:**
- Modify: `src/shared/builtin-mcp-registry.ts`
- Modify: `src/ui/components/settings/McpSettingsPage.tsx`

- [ ] **Step 1: Add type names**

Add `tech-cc-hub-photoshop` to `BuiltinMcpServerName`.

Add `layers` to `BuiltinMcpIconKey`.

- [ ] **Step 2: Add registry definition**

Add a `BUILTIN_MCP_SERVERS` entry:

```ts
{
  name: "tech-cc-hub-photoshop",
  type: "builtin",
  command: "builtin",
  args: [],
  envKeys: [],
  enabled: true,
  iconKey: "layers",
  description: "Photoshop/PSD tooling for webpage slicing, controlled PSD edits, asset export planning, and page-structure manifests.",
  iconClassName: "border-fuchsia-500/15 bg-fuchsia-50 text-fuchsia-700",
  highlights: ["PSD", "Photoshop", "Web manifest"],
  workflow: [
    { label: "Check", description: "environment" },
    { label: "Analyze", description: "layers" },
    { label: "Export", description: "assets" },
    { label: "Manifest", description: "web" },
  ],
  toolGroups: [
    {
      title: "Environment and documents",
      tools: [
        { name: "photoshop_check_environment", description: "Inspect OS, Photoshop availability, automation channels, and parser fallback capability." },
        { name: "photoshop_open_document", description: "Open or register a PSD/PSB document and return normalized document metadata." },
        { name: "photoshop_list_layers", description: "Read a normalized Photoshop/PSD layer tree." },
      ],
    },
    {
      title: "Layers and export",
      tools: [
        { name: "photoshop_select_layer", description: "Select a layer for inspection or manual review." },
        { name: "photoshop_set_layer_visibility", description: "Temporarily change layer visibility without saving the PSD." },
        { name: "photoshop_measure_layer", description: "Measure layer bounds, text, style, and render-relevant metadata." },
        { name: "photoshop_export_layer", description: "Export a layer or group as a frontend asset." },
        { name: "photoshop_export_document_preview", description: "Export a document/artboard preview for visual comparison." },
      ],
    },
    {
      title: "Web PSD workflow",
      tools: [
        { name: "psd_analyze_web_page", description: "Analyze a webpage PSD into sections, component candidates, tokens, and review warnings." },
        { name: "psd_plan_asset_exports", description: "Plan asset formats, scales, paths, naming, and conflicts." },
        { name: "psd_export_web_assets", description: "Execute planned web asset exports and return a report." },
        { name: "psd_generate_web_manifest", description: "Generate the page-structure manifest consumed by later code generators." },
        { name: "psd_validate_web_manifest", description: "Validate missing assets, low-confidence regions, naming conflicts, and code target readiness." },
        { name: "psd_read_workflow_guidance", description: "Read built-in PSD-to-web slicing rules, naming conventions, and safe editing guidance." },
      ],
    },
    {
      title: "Safe editing",
      tools: [
        { name: "photoshop_apply_controlled_change", description: "Plan or apply allowlisted PSD edits with dry-run, confirmation, backup, and changeLog." },
      ],
    },
  ],
  promptHints: [
    "Photoshop PSD rule: for PSD/PSB webpage slicing tasks, first call `mcp__tech-cc-hub-photoshop__photoshop_check_environment`, then analyze layers before exporting assets.",
    "Photoshop safety rule: any PSD mutation must use `photoshop_apply_controlled_change` with dry-run first, then explicit confirmation and backup.",
    "PSD-to-code rule: Phase 1 outputs a manifest with `codeTargets` including `html-css-js` and `react-tailwind`; code generation happens in later phases.",
  ],
}
```

- [ ] **Step 3: Map the icon in UI**

In `src/ui/components/settings/McpSettingsPage.tsx`, import `Layers3` from `lucide-react` and add:

```ts
layers: Layers3,
```

to `BUILTIN_ICON_MAP`.

- [ ] **Step 4: Run registry tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/builtin-mcp-registry.test.js
```

Expected: still FAIL until the factory/tool names are wired in Chunk 2.

- [ ] **Step 5: Commit**

```bash
git add src/shared/builtin-mcp-registry.ts src/ui/components/settings/McpSettingsPage.tsx test/electron/builtin-mcp-registry.test.ts test/electron/runtime-efficiency.test.ts
git commit -m "feat: register photoshop mcp metadata"
```

---

## Chunk 2: Add Server Shell and Runtime Enablement

### Task 3: Create server shell and tool name exports

**Files:**
- Create: `src/electron/libs/mcp-tools/photoshop/server.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/types.ts`
- Modify: `src/electron/libs/builtin-mcp-servers.ts`

- [ ] **Step 1: Create tool name list**

In `server.ts`:

```ts
export const PHOTOSHOP_TOOL_NAMES = [
  "photoshop_check_environment",
  "photoshop_open_document",
  "photoshop_list_layers",
  "photoshop_select_layer",
  "photoshop_set_layer_visibility",
  "photoshop_measure_layer",
  "photoshop_export_layer",
  "photoshop_export_document_preview",
  "photoshop_apply_controlled_change",
  "psd_analyze_web_page",
  "psd_plan_asset_exports",
  "psd_export_web_assets",
  "psd_generate_web_manifest",
  "psd_validate_web_manifest",
  "psd_read_workflow_guidance",
] as const;
```

- [ ] **Step 2: Create a minimal MCP server**

Use `createSdkMcpServer` and `tool` like existing MCP tools. Initially implement only `photoshop_check_environment` and `psd_read_workflow_guidance`; other tools can return a structured `not-implemented` error until their chunks land.

```ts
const PHOTOSHOP_SERVER_NAME = "tech-cc-hub-photoshop";
const PHOTOSHOP_SERVER_VERSION = "0.1.0";
```

Tool results must use `toTextToolResult`.

- [ ] **Step 3: Wire factory**

In `src/electron/libs/builtin-mcp-servers.ts`, import:

```ts
import { PHOTOSHOP_TOOL_NAMES, getPhotoshopMcpServer } from "./mcp-tools/photoshop/server.js";
```

Add to factory and tool maps:

```ts
"tech-cc-hub-photoshop": () => getPhotoshopMcpServer(),
```

```ts
"tech-cc-hub-photoshop": PHOTOSHOP_TOOL_NAMES,
```

- [ ] **Step 4: Run registry tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/builtin-mcp-registry.test.js
```

Expected: PASS for registry tests.

### Task 4: Enable runtime profile and runner reuse

**Files:**
- Modify: `src/electron/libs/runtime-efficiency.ts`
- Modify: `src/electron/libs/runner-reuse.ts`
- Modify: `test/electron/runtime-efficiency.test.ts`

- [ ] **Step 1: Add Photoshop to visual servers**

Add `tech-cc-hub-photoshop` to `VISUAL_SERVERS` and `ALL_SERVERS`.

- [ ] **Step 2: Extend visual prompt pattern**

Add PSD/Photoshop terms to the visual task pattern:

```ts
psd|psb|photoshop|切图|图层|网页设计稿|manifest
```

- [ ] **Step 3: Update runner reuse compatibility**

In `runner-reuse.ts`, include `tech-cc-hub-photoshop` in the built-in server name parser/check.

- [ ] **Step 4: Run runtime tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/runtime-efficiency.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop src/electron/libs/builtin-mcp-servers.ts src/electron/libs/runtime-efficiency.ts src/electron/libs/runner-reuse.ts test/electron/runtime-efficiency.test.ts
git commit -m "feat: add photoshop mcp server shell"
```

---

## Chunk 3: Manifest Schema and Validation

### Task 5: Write manifest schema tests

**Files:**
- Create: `test/electron/photoshop-manifest.test.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/manifest.ts`
- Modify: `src/electron/libs/mcp-tools/photoshop/types.ts`

- [ ] **Step 1: Add failing tests**

Test valid manifest:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { validatePhotoshopWebManifest } from "../../src/electron/libs/mcp-tools/photoshop/manifest.js";

test("validates a page-structure photoshop web manifest", () => {
  const result = validatePhotoshopWebManifest({
    schemaVersion: "1.0",
    source: {
      filePath: "/workspace/design/home.psd",
      platform: "macos",
      automationChannel: "parser",
      fallbackUsed: true,
      createdAt: "2026-05-12T10:20:00.000Z",
    },
    page: {
      name: "Home",
      width: 1440,
      height: 3200,
      artboards: [],
      sections: [{
        id: "hero",
        name: "Hero",
        bounds: { x: 0, y: 0, width: 1440, height: 720 },
        confidence: 0.8,
        source: ["layer-name"],
        needsReview: false,
        components: [],
      }],
    },
    tokens: { colors: [], typography: [], spacing: [], radii: [], effects: [] },
    assets: [],
    codeTargets: ["html-css-js", "react-tailwind"],
    warnings: [],
    changeLog: [],
  });

  assert.equal(result.success, true);
});
```

Test missing confidence/source/needsReview fails.

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-manifest.test.js
```

Expected: FAIL because schema does not exist yet.

### Task 6: Implement manifest schema helpers

**Files:**
- Modify: `src/electron/libs/mcp-tools/photoshop/types.ts`
- Modify: `src/electron/libs/mcp-tools/photoshop/manifest.ts`

- [ ] **Step 1: Define shared types**

Include:

```ts
export type PhotoshopPlatform = "macos" | "windows" | "linux" | "unknown";
export type PhotoshopAutomationChannel = "uxp" | "script" | "com" | "applescript-bridge" | "parser" | "unavailable";
export type PhotoshopCodeTarget = "html-css-js" | "react-tailwind";
export type PhotoshopInferenceSource = "layer-name" | "geometry" | "text" | "style" | "manual" | "parser";
```

- [ ] **Step 2: Implement Zod schemas**

Use `z.object` and require `confidence`, `source`, and `needsReview` for sections/components.

- [ ] **Step 3: Export helpers**

```ts
export function validatePhotoshopWebManifest(value: unknown) {
  return photoshopWebManifestSchema.safeParse(value);
}
```

Add `createEmptyPhotoshopWebManifest` with `codeTargets: ["html-css-js", "react-tailwind"]`.

- [ ] **Step 4: Run manifest tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-manifest.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop/types.ts src/electron/libs/mcp-tools/photoshop/manifest.ts test/electron/photoshop-manifest.test.ts
git commit -m "feat: define photoshop web manifest schema"
```

---

## Chunk 4: Environment and Capability Matrix

### Task 7: Test environment diagnostics with injected host

**Files:**
- Create: `test/electron/photoshop-environment.test.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/environment.ts`

- [ ] **Step 1: Write failing tests**

Test no Photoshop:

```ts
test("reports parser fallback when Photoshop is unavailable", async () => {
  const result = await checkPhotoshopEnvironment({
    platform: "darwin",
    findPhotoshop: async () => null,
    canUseParserFallback: async () => true,
  });

  assert.equal(result.platform, "macos");
  assert.equal(result.photoshop.available, false);
  assert.equal(result.parserFallback.available, true);
  assert.equal(result.recommendedMode, "parser");
});
```

Test Windows available channel returns capability matrix.

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-environment.test.js
```

Expected: FAIL because implementation is missing.

### Task 8: Implement environment diagnostics

**Files:**
- Modify: `src/electron/libs/mcp-tools/photoshop/environment.ts`
- Modify: `src/electron/libs/mcp-tools/photoshop/server.ts`

- [ ] **Step 1: Implement injected host**

Define:

```ts
export type PhotoshopEnvironmentHost = {
  platform?: NodeJS.Platform;
  findPhotoshop: () => Promise<{ version?: string; executablePath?: string; channel?: string } | null>;
  canUseParserFallback: () => Promise<boolean>;
};
```

Default host should use `process.platform`, avoid expensive scans, and return conservative diagnostics if Photoshop detection is not implemented.

- [ ] **Step 2: Return capability matrix**

Return capabilities:

```json
{
  "openDocument": "unavailable|available",
  "listLayers": "unavailable|available|fallback",
  "exportLayer": "unavailable|available",
  "controlledChange": "unavailable|available"
}
```

- [ ] **Step 3: Wire `photoshop_check_environment`**

The MCP tool should return the environment result and never throw for a missing Photoshop install.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-environment.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop/environment.ts src/electron/libs/mcp-tools/photoshop/server.ts test/electron/photoshop-environment.test.ts
git commit -m "feat: add photoshop environment diagnostics"
```

---

## Chunk 5: Web PSD Analyzer and Export Planner

### Task 9: Add layer-tree fixture and analyzer tests

**Files:**
- Create: `test/fixtures/photoshop/web-page-layer-tree.json`
- Create: `test/electron/photoshop-analyzer.test.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/analyzer.ts`

- [ ] **Step 1: Create fixture**

Use a compact normalized layer tree:

```json
{
  "document": { "name": "Home", "width": 1440, "height": 2200 },
  "layers": [
    { "id": "group-header", "name": "header", "kind": "group", "bounds": { "x": 0, "y": 0, "width": 1440, "height": 96 }, "children": [] },
    { "id": "group-hero", "name": "Hero Section", "kind": "group", "bounds": { "x": 0, "y": 96, "width": 1440, "height": 640 }, "children": [
      { "id": "text-title", "name": "Hero / H1", "kind": "text", "text": "Launch faster", "bounds": { "x": 120, "y": 180, "width": 520, "height": 72 } },
      { "id": "btn-primary", "name": "component/button/primary", "kind": "shape", "bounds": { "x": 120, "y": 320, "width": 180, "height": 48 } }
    ] }
  ]
}
```

- [ ] **Step 2: Test section inference**

Assert that `analyzeWebPsdLayerTree` returns sections with `confidence`, `source`, and `needsReview`.

- [ ] **Step 3: Run failing tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-analyzer.test.js
```

Expected: FAIL because analyzer is not implemented.

### Task 10: Implement analyzer

**Files:**
- Modify: `src/electron/libs/mcp-tools/photoshop/analyzer.ts`
- Modify: `src/electron/libs/mcp-tools/photoshop/types.ts`

- [ ] **Step 1: Normalize layer records**

Implement a small `isNormalizedLayerTree` guard and layer traversal helper.

- [ ] **Step 2: Implement naming-first inference**

Recognize names containing:

- `header`
- `nav`
- `hero`
- `section`
- `footer`
- `component/`
- `asset/`

- [ ] **Step 3: Implement geometry fallback**

For large top-level groups without known names, infer a section from bounds and mark:

```json
{
  "confidence": 0.55,
  "source": ["geometry"],
  "needsReview": true
}
```

- [ ] **Step 4: Run analyzer tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-analyzer.test.js
```

Expected: PASS.

### Task 11: Add export planner tests and implementation

**Files:**
- Create: `test/electron/photoshop-export-planner.test.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/export-planner.ts`

- [ ] **Step 1: Write failing tests**

Test that icons/shapes prefer PNG for Phase 1 unless vector export is explicitly available, photos/backgrounds prefer WebP, and output paths are sanitized under `design-assets/<psd-name>/exports/`.

- [ ] **Step 2: Implement `planPhotoshopAssetExports`**

Return:

```ts
{
  exportRoot: "design-assets/home/exports",
  assets: [{
    id: "btn-primary",
    sourceLayerId: "btn-primary",
    path: "design-assets/home/exports/btn-primary.png",
    format: "png",
    scale: [1, 2],
    usage: "background",
    confidence: 0.75,
  }],
  warnings: []
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-analyzer.test.js dist-test/test/electron/photoshop-export-planner.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop/analyzer.ts src/electron/libs/mcp-tools/photoshop/export-planner.ts src/electron/libs/mcp-tools/photoshop/types.ts test/electron/photoshop-analyzer.test.ts test/electron/photoshop-export-planner.test.ts test/fixtures/photoshop/web-page-layer-tree.json
git commit -m "feat: analyze webpage psd layer trees"
```

---

## Chunk 6: Safety Layer

### Task 12: Test safe edit planning

**Files:**
- Create: `test/electron/photoshop-safety.test.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/safety.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- `dryRun: true` produces a change plan and no backup.
- `confirmed: false` rejects mutation.
- backup path is inside `.tech-cc-hub/photoshop/backups/`.
- paths outside workspace are rejected unless explicitly allowed.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-safety.test.js
```

Expected: FAIL because safety helpers do not exist yet.

### Task 13: Implement safety helpers

**Files:**
- Modify: `src/electron/libs/mcp-tools/photoshop/safety.ts`
- Modify: `src/electron/libs/mcp-tools/photoshop/types.ts`

- [ ] **Step 1: Implement path guard**

Use `path.resolve` and require target paths to live under workspace root, PSD directory, or explicit allowed roots.

- [ ] **Step 2: Implement dry-run plan**

Return:

```ts
{
  mode: "dry-run",
  requiresConfirmation: true,
  operations: [],
  warnings: []
}
```

- [ ] **Step 3: Implement confirmed plan result**

Build backup path and changeLog entry. Do not call Photoshop here; this helper only prepares safe execution metadata.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-safety.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop/safety.ts src/electron/libs/mcp-tools/photoshop/types.ts test/electron/photoshop-safety.test.ts
git commit -m "feat: add photoshop safe edit planning"
```

---

## Chunk 7: MCP Tool Handlers

### Task 14: Test pure tool handlers

**Files:**
- Create: `test/electron/photoshop-mcp-server.test.ts`
- Modify: `src/electron/libs/mcp-tools/photoshop/server.ts`

- [ ] **Step 1: Export pure handlers from server**

Add named exports:

- `handlePhotoshopCheckEnvironment`
- `handlePsdAnalyzeWebPage`
- `handlePsdPlanAssetExports`
- `handlePsdGenerateWebManifest`
- `handlePsdValidateWebManifest`
- `handlePsdReadWorkflowGuidance`
- `handlePhotoshopApplyControlledChange`

- [ ] **Step 2: Write tests for handlers**

Use fixture layer tree. Assert:

- guidance mentions `html-css-js` and safe editing.
- manifest generation includes `codeTargets`.
- validation flags low-confidence sections.
- environment handler does not throw when Photoshop is unavailable.

- [ ] **Step 3: Run failing tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-mcp-server.test.js
```

Expected: FAIL until handlers are implemented.

### Task 15: Implement handlers and server wrappers

**Files:**
- Modify: `src/electron/libs/mcp-tools/photoshop/server.ts`
- Create: `src/electron/libs/mcp-tools/photoshop/workflow-guidance.ts`

- [ ] **Step 1: Implement guidance**

Include:

- naming conventions
- export strategy
- safe edit rules
- manifest contract
- later code targets: `html-css-js`, `react-tailwind`

- [ ] **Step 2: Implement data-only workflow handlers**

`psd_analyze_web_page`, `psd_plan_asset_exports`, and `psd_generate_web_manifest` should accept normalized layer tree JSON input first. Real document IDs can be wired later after Photoshop adapter work.

- [ ] **Step 3: Implement validation handler**

Use manifest schema and add semantic warnings for low confidence, missing assets, empty sections, and absent code targets.

- [ ] **Step 4: Wrap handlers in MCP tools**

Each tool uses Zod input schema and `toTextToolResult`.

- [ ] **Step 5: Run handler tests**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/photoshop-mcp-server.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop/server.ts src/electron/libs/mcp-tools/photoshop/workflow-guidance.ts test/electron/photoshop-mcp-server.test.ts
git commit -m "feat: expose photoshop psd workflow tools"
```

---

## Chunk 8: Platform Automation Spike and Adapter Contract

### Task 16: Add adapter contract and spike notes

**Files:**
- Create: `src/electron/libs/mcp-tools/photoshop/adapter.ts`
- Create: `docs/superpowers/research/2026-05-12-photoshop-automation-spike.md`

- [ ] **Step 1: Define adapter interface**

Use the spec's `PhotoshopControlAdapter` shape. Each method may return `unavailable` until platform implementation lands.

- [ ] **Step 2: Document spike questions**

The research note must record:

- macOS candidate channels: UXP, ExtendScript/script, AppleScript bridge.
- Windows candidate channels: UXP, ExtendScript/script, COM, command bridge.
- capabilities needed by Phase 1.
- decision matrix fields: availability, install friction, script permissions, document access, layer access, export access, safe-edit support.

- [ ] **Step 3: Add implementation decision gate**

Add a short section: "No platform-specific automation implementation should be added before this spike is filled with findings from at least one macOS and one Windows check."

- [ ] **Step 4: Commit**

```bash
git add src/electron/libs/mcp-tools/photoshop/adapter.ts docs/superpowers/research/2026-05-12-photoshop-automation-spike.md
git commit -m "docs: define photoshop automation spike"
```

---

## Chunk 9: Final Validation

### Task 17: Run focused test suite

**Files:**
- No code changes expected.

- [ ] **Step 1: Run Electron transpile and Photoshop tests**

Run:

```bash
npm run transpile:electron && node --test \
  dist-test/test/electron/builtin-mcp-registry.test.js \
  dist-test/test/electron/runtime-efficiency.test.js \
  dist-test/test/electron/photoshop-manifest.test.js \
  dist-test/test/electron/photoshop-environment.test.js \
  dist-test/test/electron/photoshop-analyzer.test.js \
  dist-test/test/electron/photoshop-export-planner.test.js \
  dist-test/test/electron/photoshop-safety.test.js \
  dist-test/test/electron/photoshop-mcp-server.test.js
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Inspect MCP list in app**

Run dev app:

```bash
npm run dev
```

Then open Settings -> MCP and verify `tech-cc-hub-photoshop` appears with tool groups and `layers` icon.

- [ ] **Step 4: Commit any final fixes**

```bash
git status --short
git add src/electron/libs/mcp-tools/photoshop src/electron/libs/builtin-mcp-servers.ts src/electron/libs/runtime-efficiency.ts src/electron/libs/runner-reuse.ts src/shared/builtin-mcp-registry.ts src/ui/components/settings/McpSettingsPage.tsx test/electron test/fixtures/photoshop docs/superpowers/research/2026-05-12-photoshop-automation-spike.md
git commit -m "test: validate photoshop mcp phase one"
```

## Manual QA Checklist

- [ ] Prompt containing `PSD` or `切图` selects the visual runtime profile.
- [ ] `tech-cc-hub-photoshop` appears in built-in MCP settings.
- [ ] `photoshop_check_environment` returns structured diagnostics on a machine without Photoshop.
- [ ] `psd_read_workflow_guidance` mentions safe editing, manifest, `html-css-js`, and `react-tailwind`.
- [ ] `psd_generate_web_manifest` can consume the test layer tree and return a valid manifest.
- [ ] `psd_validate_web_manifest` flags low-confidence and missing-asset issues.
- [ ] No PSD mutation tool can execute without dry-run and explicit confirmation.

## Execution Notes

- Keep each chunk committed separately.
- Do not add real Photoshop platform automation until the spike note records the capability matrix.
- Do not add code generation in this plan; Phase 2/3 plans should consume the manifest produced here.
- Keep large layer trees and generated manifests as artifacts/paths in tool results, not large inline model payloads.

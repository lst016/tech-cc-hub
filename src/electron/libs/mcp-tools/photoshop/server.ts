import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { analyzeWebPsdLayerTree } from "./analyzer.js";
import { generateNativeWebProject, generateReactTailwindProject } from "./codegen.js";
import { checkPhotoshopEnvironment } from "./environment.js";
import { planPhotoshopAssetExports } from "./export-planner.js";
import { createEmptyPhotoshopWebManifest, validatePhotoshopWebManifest } from "./manifest.js";
import { generatePhotoshopProjectManifest } from "./project-manifest.js";
import { preparePhotoshopControlledChange } from "./safety.js";
import type { NormalizedPhotoshopLayerTree, PhotoshopControlledChangeInput, PhotoshopWebManifest } from "./types.js";
import { planPhotoshopVisualRepairLoop } from "./visual-loop.js";
import { getPhotoshopWorkflowGuidance } from "./workflow-guidance.js";
import { toTextToolResult } from "../tool-result.js";

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
  "psd_generate_native_web_code",
  "psd_generate_react_tailwind_code",
  "psd_plan_visual_repair_loop",
  "psd_generate_project_manifest",
  "psd_read_workflow_guidance",
] as const;

const PHOTOSHOP_SERVER_NAME = "tech-cc-hub-photoshop";
const PHOTOSHOP_SERVER_VERSION = "0.1.0";

let photoshopMcpServer: McpSdkServerConfigWithInstance | null = null;

const BOUNDS_SCHEMA = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

const LAYER_SCHEMA: z.ZodType<unknown> = z.lazy(() => z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["group", "text", "shape", "image", "smart-object", "artboard", "unknown"]),
  bounds: BOUNDS_SCHEMA.optional(),
  visible: z.boolean().optional(),
  text: z.string().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
  children: z.array(LAYER_SCHEMA).optional(),
}));

const LAYER_TREE_SCHEMA = z.object({
  document: z.object({
    name: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  layers: z.array(LAYER_SCHEMA),
});

const LAYER_TREE_INPUT_SCHEMA = {
  layerTree: LAYER_TREE_SCHEMA.describe("Normalized Photoshop/PSD layer tree."),
  filePath: z.string().optional().describe("Optional source PSD/PSB path."),
};

const MANIFEST_INPUT_SCHEMA = {
  manifest: z.unknown().describe("Photoshop web manifest."),
};

const VISUAL_REPAIR_INPUT_SCHEMA = {
  manifest: z.unknown().describe("Photoshop web manifest."),
  referenceImagePath: z.string().optional().describe("Optional PSD preview/reference image path."),
  candidateUrl: z.string().optional().describe("Optional local preview URL to open in BrowserView."),
};

const PROJECT_MANIFEST_INPUT_SCHEMA = {
  manifests: z.array(z.unknown()).min(1).describe("One or more Photoshop web manifests."),
};

const CONTROL_OPERATION_SCHEMA = z.union([
  z.object({ type: z.literal("rename-layer"), layerId: z.string(), nextName: z.string() }),
  z.object({ type: z.literal("write-metadata"), layerId: z.string(), key: z.string(), value: z.string() }),
  z.object({ type: z.literal("create-slice-marker"), layerId: z.string(), markerName: z.string() }),
]);

export async function handlePhotoshopCheckEnvironment() {
  return checkPhotoshopEnvironment();
}

export function handlePsdAnalyzeWebPage(input: { layerTree: NormalizedPhotoshopLayerTree }) {
  return analyzeWebPsdLayerTree(input.layerTree);
}

export function handlePsdPlanAssetExports(input: { layerTree: NormalizedPhotoshopLayerTree; filePath?: string }) {
  return planPhotoshopAssetExports({
    layerTree: input.layerTree,
    psdFilePath: input.filePath,
  });
}

export function handlePsdGenerateWebManifest(input: { layerTree: NormalizedPhotoshopLayerTree; filePath?: string }) {
  const analysis = analyzeWebPsdLayerTree(input.layerTree);
  const exportPlan = planPhotoshopAssetExports({
    layerTree: input.layerTree,
    psdFilePath: input.filePath,
  });
  const manifest = createEmptyPhotoshopWebManifest({
    filePath: input.filePath ?? input.layerTree.document.name,
    pageName: analysis.page.name,
    width: analysis.page.width,
    height: analysis.page.height,
  });

  manifest.page.sections = analysis.page.sections;
  manifest.tokens = analysis.tokens;
  manifest.assets = exportPlan.assets;
  manifest.warnings = [...analysis.warnings, ...exportPlan.warnings];
  return manifest;
}

export function handlePsdValidateWebManifest(input: { manifest: unknown }) {
  const parsed = validatePhotoshopWebManifest(input.manifest);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      warnings: [],
    };
  }

  const manifest = parsed.data;
  const warnings = [
    ...manifest.warnings,
    ...manifest.page.sections
      .filter((section) => section.needsReview || section.confidence < 0.7)
      .map((section) => `Section "${section.name}" has low confidence and needs review.`),
    ...(manifest.assets.length === 0 ? ["Manifest has no exported assets."] : []),
    ...(!manifest.codeTargets.includes("html-css-js") ? ["Manifest is missing html-css-js code target."] : []),
  ];

  return {
    valid: true,
    sectionCount: manifest.page.sections.length,
    assetCount: manifest.assets.length,
    warnings,
  };
}

function parseManifestOrThrow(value: unknown): PhotoshopWebManifest {
  const parsed = validatePhotoshopWebManifest(value);
  if (!parsed.success) {
    throw new Error(`Invalid Photoshop web manifest: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  return parsed.data;
}

export function handlePsdGenerateNativeWebCode(input: { manifest: unknown }) {
  return generateNativeWebProject(parseManifestOrThrow(input.manifest));
}

export function handlePsdGenerateReactTailwindCode(input: { manifest: unknown }) {
  return generateReactTailwindProject(parseManifestOrThrow(input.manifest));
}

export function handlePsdPlanVisualRepairLoop(input: {
  manifest: unknown;
  referenceImagePath?: string;
  candidateUrl?: string;
}) {
  return planPhotoshopVisualRepairLoop({
    manifest: parseManifestOrThrow(input.manifest),
    referenceImagePath: input.referenceImagePath,
    candidateUrl: input.candidateUrl,
  });
}

export function handlePsdGenerateProjectManifest(input: { manifests: unknown[] }) {
  return generatePhotoshopProjectManifest(input.manifests.map(parseManifestOrThrow));
}

export function handlePsdReadWorkflowGuidance() {
  return getPhotoshopWorkflowGuidance();
}

export function handlePhotoshopApplyControlledChange(input: PhotoshopControlledChangeInput) {
  return preparePhotoshopControlledChange(input);
}

function notImplemented(action: string) {
  return {
    action,
    success: false,
    status: "not-implemented",
    message: "This Phase 1 shell exposes the tool contract; platform Photoshop automation requires the capability-matrix spike first.",
  };
}

export function getPhotoshopMcpServer(): McpSdkServerConfigWithInstance {
  if (photoshopMcpServer) {
    return photoshopMcpServer;
  }

  const checkEnvironment = tool(
    "photoshop_check_environment",
    "Inspect OS, Photoshop availability, automation channels, and parser fallback capability.",
    {},
    async () => toTextToolResult(await handlePhotoshopCheckEnvironment()),
  );

  const guidance = tool(
    "psd_read_workflow_guidance",
    "Read built-in PSD-to-web slicing rules, naming conventions, and safe editing guidance.",
    {},
    async () => toTextToolResult(handlePsdReadWorkflowGuidance()),
  );

  const analyze = tool(
    "psd_analyze_web_page",
    "Analyze a normalized webpage PSD layer tree into sections, component candidates, tokens, and review warnings.",
    LAYER_TREE_INPUT_SCHEMA,
    async (input) => toTextToolResult(handlePsdAnalyzeWebPage({ layerTree: input.layerTree as NormalizedPhotoshopLayerTree })),
  );

  const planExports = tool(
    "psd_plan_asset_exports",
    "Plan asset formats, scales, paths, naming, and conflicts from a normalized PSD layer tree.",
    LAYER_TREE_INPUT_SCHEMA,
    async (input) => toTextToolResult(handlePsdPlanAssetExports({
      layerTree: input.layerTree as NormalizedPhotoshopLayerTree,
      filePath: input.filePath,
    })),
  );

  const generateManifest = tool(
    "psd_generate_web_manifest",
    "Generate a page-structure manifest consumed by later HTML/CSS/JS and React/Tailwind generators.",
    LAYER_TREE_INPUT_SCHEMA,
    async (input) => toTextToolResult(handlePsdGenerateWebManifest({
      layerTree: input.layerTree as NormalizedPhotoshopLayerTree,
      filePath: input.filePath,
    })),
  );

  const validateManifest = tool(
    "psd_validate_web_manifest",
    "Validate missing assets, low-confidence regions, naming conflicts, and code target readiness.",
    { manifest: z.unknown() },
    async (input) => toTextToolResult(handlePsdValidateWebManifest({ manifest: input.manifest })),
  );

  const controlledChange = tool(
    "photoshop_apply_controlled_change",
    "Plan or apply allowlisted PSD edits with dry-run, confirmation, backup, and changeLog metadata.",
    {
      workspaceRoot: z.string(),
      filePath: z.string(),
      dryRun: z.boolean().optional(),
      confirmed: z.boolean().optional(),
      operations: z.array(CONTROL_OPERATION_SCHEMA).min(1),
      allowedRoots: z.array(z.string()).optional(),
    },
    async (input) => toTextToolResult(handlePhotoshopApplyControlledChange(input as PhotoshopControlledChangeInput)),
  );

  const shellTools = PHOTOSHOP_TOOL_NAMES
    .filter((name) => ![
      "photoshop_check_environment",
      "photoshop_apply_controlled_change",
      "psd_analyze_web_page",
      "psd_plan_asset_exports",
      "psd_generate_web_manifest",
      "psd_validate_web_manifest",
      "psd_generate_native_web_code",
      "psd_generate_react_tailwind_code",
      "psd_plan_visual_repair_loop",
      "psd_generate_project_manifest",
      "psd_read_workflow_guidance",
    ].includes(name))
    .map((name) => tool(
      name,
      "Photoshop platform automation shell. Returns structured not-implemented diagnostics until the platform spike selects the implementation channel.",
      {},
      async () => toTextToolResult(notImplemented(name), true),
    ));

  photoshopMcpServer = createSdkMcpServer({
    name: PHOTOSHOP_SERVER_NAME,
    version: PHOTOSHOP_SERVER_VERSION,
    tools: [
      checkEnvironment,
      ...shellTools,
      controlledChange,
      analyze,
      planExports,
      tool(
        "psd_export_web_assets",
        "Execute planned web asset exports. Phase 1 shell returns a structured not-implemented diagnostic until Photoshop export automation lands.",
        {},
        async () => toTextToolResult(notImplemented("psd_export_web_assets"), true),
      ),
      generateManifest,
      validateManifest,
      tool(
        "psd_generate_native_web_code",
        "Generate a native HTML/CSS/JS draft from a Photoshop web manifest.",
        MANIFEST_INPUT_SCHEMA,
        async (input) => toTextToolResult(handlePsdGenerateNativeWebCode({ manifest: input.manifest })),
      ),
      tool(
        "psd_generate_react_tailwind_code",
        "Generate a React/Tailwind draft from a Photoshop web manifest.",
        MANIFEST_INPUT_SCHEMA,
        async (input) => toTextToolResult(handlePsdGenerateReactTailwindCode({ manifest: input.manifest })),
      ),
      tool(
        "psd_plan_visual_repair_loop",
        "Plan how to connect a Photoshop manifest, PSD preview, BrowserView, and design diff repair loop.",
        VISUAL_REPAIR_INPUT_SCHEMA,
        async (input) => toTextToolResult(handlePsdPlanVisualRepairLoop({
          manifest: input.manifest,
          referenceImagePath: input.referenceImagePath,
          candidateUrl: input.candidateUrl,
        })),
      ),
      tool(
        "psd_generate_project_manifest",
        "Aggregate multiple Photoshop page manifests into a project-level manifest with shared assets/components.",
        PROJECT_MANIFEST_INPUT_SCHEMA,
        async (input) => toTextToolResult(handlePsdGenerateProjectManifest({ manifests: input.manifests })),
      ),
      guidance,
    ],
  });

  return photoshopMcpServer;
}

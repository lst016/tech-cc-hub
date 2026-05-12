import type { PhotoshopVisualRepairPlan, PhotoshopWebManifest } from "./types.js";

export function planPhotoshopVisualRepairLoop(input: {
  manifest: PhotoshopWebManifest;
  referenceImagePath?: string;
  candidateUrl?: string;
}): PhotoshopVisualRepairPlan {
  const warnings = [
    ...(input.manifest.page.sections.some((section) => section.needsReview)
      ? ["Manifest contains low-confidence sections; verify them before pixel comparison."]
      : []),
    ...(!input.referenceImagePath ? ["No reference image path provided; export a PSD preview before running visual diff."] : []),
    ...(!input.candidateUrl ? ["No candidate URL provided; start a local preview before BrowserView capture."] : []),
  ];

  return {
    referenceImagePath: input.referenceImagePath,
    candidateUrl: input.candidateUrl,
    manifestSummary: {
      pageName: input.manifest.page.name,
      sectionCount: input.manifest.page.sections.length,
      assetCount: input.manifest.assets.length,
    },
    steps: [
      {
        order: 1,
        tool: "mcp__tech-cc-hub-photoshop__photoshop_export_document_preview",
        purpose: "Export a PSD or artboard preview to use as the visual reference.",
      },
      {
        order: 2,
        tool: "mcp__tech-cc-hub-browser__browser_open_page",
        purpose: "Open the generated page or local preview in BrowserView.",
      },
      {
        order: 3,
        tool: "mcp__tech-cc-hub-design__design_compare_current_view",
        purpose: "Compare the BrowserView screenshot with the PSD reference image.",
      },
      {
        order: 4,
        tool: "mcp__tech-cc-hub-design__design_read_comparison_report",
        purpose: "Read hotspot and ratio details, then repair CSS/layout/assets.",
      },
    ],
    warnings,
  };
}

export function getPhotoshopWorkflowGuidance() {
  return {
    name: "psd-to-web-slicing",
    phase: "phase-1",
    codeTargets: ["html-css-js", "react-tailwind"],
    sequence: [
      "Call photoshop_check_environment before assuming Photoshop automation is available.",
      "Analyze the PSD layer tree before exporting assets.",
      "Prefer naming conventions such as header, nav, hero, section/*, component/*, asset/*, and state/hover.",
      "Generate a page-structure manifest before asking a code generator to write native HTML/CSS/JS or React/Tailwind.",
      "Use psd_generate_native_web_code for native HTML/CSS/JS drafts when the target is static or framework-free.",
      "Use psd_generate_react_tailwind_code for React/Tailwind drafts when the project already uses React or Tailwind.",
      "Use psd_generate_project_manifest to consolidate multiple page manifests before component-library work.",
      "Use tech-cc-hub-design later for BrowserView screenshot comparison and repair loops.",
    ],
    safeEditing: [
      "Run photoshop_apply_controlled_change with dryRun=true first.",
      "Only run mutations with confirmed=true after the change plan is reviewed.",
      "Create a backup path and changeLog before applying any PSD mutation.",
      "Do not execute arbitrary user-supplied Photoshop scripts.",
    ],
    exportStrategy: [
      "Use PNG for icons and simple shapes in Phase 1 unless vector fidelity is explicitly available.",
      "Use WebP for photos, large backgrounds, image layers, and smart objects.",
      "Export 1x and 2x by default.",
      "Write assets under design-assets/<psd-name>/exports/.",
    ],
  };
}

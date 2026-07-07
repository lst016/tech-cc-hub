export type FigmaDevelopmentWorkflowStep = {
  phase: string;
  goal: string;
  tools: string[];
  doneWhen: string;
};

export type FigmaVisualConstraintCategory =
  | "geometry"
  | "spacing"
  | "alignment"
  | "typography"
  | "color"
  | "state"
  | "content"
  | "asset"
  | "interaction";

export type FigmaVisualConstraintGroup = {
  category: FigmaVisualConstraintCategory;
  examples: string[];
};

export const FIGMA_VISUAL_CONSTRAINT_GROUPS: readonly FigmaVisualConstraintGroup[] = [
  {
    category: "geometry",
    examples: ["component width/height", "x/y position", "fixed columns", "viewport-safe bounds"],
  },
  {
    category: "spacing",
    examples: ["padding", "gap", "row/item height", "section rhythm"],
  },
  {
    category: "alignment",
    examples: ["start/center/end alignment", "baseline", "grid/flex axis behavior"],
  },
  {
    category: "typography",
    examples: ["font size", "weight", "line height", "letter spacing"],
  },
  {
    category: "color",
    examples: ["text color", "background", "border", "state color"],
  },
  {
    category: "state",
    examples: ["active", "hover", "disabled", "empty", "loading", "selected"],
  },
  {
    category: "content",
    examples: ["visible text", "empty rendering", "long text wrapping", "localization"],
  },
  {
    category: "asset",
    examples: ["icons", "avatars", "bitmap crops", "image fill behavior"],
  },
  {
    category: "interaction",
    examples: ["editable affordance", "focus target", "scroll container", "sticky region"],
  },
];

export const FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_STEPS: readonly FigmaDevelopmentWorkflowStep[] = [
  {
    phase: "inventory",
    goal: "Build a component backlog from the provided Figma URL instead of implementing the whole file at once.",
    tools: ["figma_list_node_index"],
    doneWhen: "Exportable positive-bounds frames/components are grouped into page shell, regions, repeated structures, controls, states, content blocks, and visual primitives.",
  },
  {
    phase: "reference-lock",
    goal: "Lock one Figma child node to one local reference image and one DOM target before editing.",
    tools: ["figma_export_node_images", "design_inspect_image", "figma_match_ui_nodes"],
    doneWhen: "The child has nodeId, imagePath, inspect qualityGate.confidence >= 0.75, DOM selector/region, and measurable visual constraints.",
  },
  {
    phase: "constraint-snapshot",
    goal: "Turn the locked reference into a generic visual contract before code changes.",
    tools: ["design_inspect_image", "browser_query_nodes", "browser_inspect_styles"],
    doneWhen: "The current child has a snapshot covering geometry, spacing, alignment, typography, color, state/content variants, and any layout assumptions that need evidence.",
  },
  {
    phase: "child-implementation",
    goal: "Implement or adapt exactly one child component using existing project components and tokens.",
    tools: ["browser_query_nodes", "browser_inspect_styles", "design_compare_element_to_reference", "design_compare_current_view"],
    doneWhen: "The child component's DOM/style evidence matches the locked constraints and the screenshot comparison passes maxDifferenceRatio <= 0.10.",
  },
  {
    phase: "parent-integration",
    goal: "Assemble passed children into the parent screen without rewriting already accepted children.",
    tools: ["design_compare_element_to_reference", "design_compare_current_view"],
    doneWhen: "The parent target passes maxDifferenceRatio <= 0.10 or remaining differences are isolated to named child components.",
  },
];

export const FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_HINTS: readonly string[] = [
  "Figma mode handshake rule: begin every Figma task by checking effective connection mode (`Figma official REST/PAT` or desktop/remote MCP) and reporting the selected mode in one short line before any design edits.",
  "Figma official-flow entry rule: when user explicitly asks for official-article-style behavior (mentions official MCP, figma官方, or official-setup), execute: (1) `figma_get_current_user`, (2) `figma_list_node_index` on provided page when no node id is present, (3) choose the smallest-scoped node, and (4) lock tuple before editing.",
  "Figma PAT mode rule: this workflow assumes the PAT-backed `tech-cc-hub-figma` toolchain only. Before implementation, verify capability by calling `figma_get_current_user`; if authentication or permission fails, stop and request a refreshed token before editing.",
  "Figma page-only-first rule: if the user only gives a Figma page URL and no explicit nodeId, do not ask for manual frame numbers. Immediately call `figma_list_node_index` to produce minimal actionable candidates and continue with the smallest-scoped child that matches the user request text.",
  "Figma no-guess rule: do not infer missing layout/spacing/icon details from prose or previous context. A node is editable only after an image-backed reference is locked (`figma_export_node_images` + `design_inspect_image`) or a DOM-to-Figma tuple exists.",
  "Figma page-ID first rule: when user provides a figma.com page URL without a node-id, do not ask for frame numbers; immediately call figma_list_node_index, rank children by smallest actionable scope, and start with the top candidate that best maps to the user request.",
  "Figma hands-off loop rule: for each target page, execute exactly one child/component at a time. Keep the loop strict: discover candidates -> choose one minimum-impact child -> lock tuple -> patch -> verify -> next child.",
  "Figma no-extra-explanation rule: during implementation turns, do not invent product behavior, interaction copy, or architecture decisions. Only change what the locked Figma tuple and active constraints require, and state just one implementation result.",
  "Figma component workflow rule: when the Figma file/frame is large, never implement the whole screen in one patch. First build a component backlog, then implement one locked child component at a time.",
  "Figma genericity rule: do not turn one task's domain shape into a global concept. A Drawer, table, card, form, chart, toolbar, or list item all use the same reference tuple and visual-constraint workflow; domain-specific components are local implementation choices only.",
  "Figma component inventory rule: start with figma_list_node_index at depth 2-4 and keep exportable=true entries with positive bounds. Group candidates into page shell, layout regions, repeated structures, controls, icons/assets, content blocks, states, and visual primitives.",
  "Figma reference tuple rule: before editing a child, record Figma nodeId, exported reference imagePath, target DOM selector or region, acceptance gate, and visual constraints. Missing tuple fields mean the child is not ready for code changes.",
  "Figma visual constraint snapshot rule: each child contract should capture only generic measurable facts: geometry, spacing, alignment, typography, color, state/content variants, assets, and interaction affordances. Do not rely on common UI experience when a constraint can be measured from Figma or DOM.",
  "Figma SVG asset rule: when implementing icons, vectors, logos, or any SVG from Figma, do not redraw or substitute with local icon libraries. Identify the exact icon/vector node and call figma_get_image_urls with format=\"svg\"; preserve the exported path geometry when adapting it to the project. Never create new SVG files unless the user explicitly asks for brand-new icons.",
  "Figma component plan rule: use update_plan for the backlog. Keep exactly one component in_progress; each item should track Figma nodeId, intended local component/file, DOM selector or region, reference imagePath once exported, visual constraints, and maxDifferenceRatio <= 0.10.",
  "Figma component implementation order: tokens/theme first, then page shell, coarse layout regions, repeated structures, controls/states, content/assets, visual primitives, and only then final assembled-page comparison.",
  "Figma child component loop: for each child, run figma_export_node_images -> design_inspect_image -> lock constraints -> implement/reuse local component -> launch/refresh preview -> browser_inspect_styles/browser_query_nodes for DOM evidence -> design_compare_element_to_reference with the locked selector -> patch until <=0.10 or relock.",
  "Figma visual/function split rule: visual restoration and functional wiring are separate passes. Do not add interactions, API fields, or editing affordances in the same patch that is trying to repair geometry, color, spacing, or typography unless the locked Figma state requires that affordance.",
  "Figma evidence rule: risky layout choices such as distributed/end alignment, auto sizing, placeholder empty states, and hardcoded colors should be judged against the locked Figma constraints and current DOM computed styles, not by a standalone CSS rule list.",
  "Figma difference-cause report rule: when a comparison fails, report expected reference behavior, actual DOM/CSS behavior, cause, and next patch target. Example shape: reference constraint -> current implementation -> difference cause -> repair strategy.",
  "Figma delivery-report rule: every completed child must return a short block with: 1) Figma nodeId, 2) locked reference image path, 3) selector/region, 4) comparison result (maxDifferenceRatio), 5) remaining risks. If still drifting, stop and relock, do not switch to another component.",
  "Figma integration rule: after a child passes, do not rewrite it during later steps unless a later comparison report names that child as regressed. Patch the smallest failing child, then rerun parent comparison.",
  "Figma truncation safety rule: NEVER implement, generate code, or make UI decisions from truncated Figma data. If figma_read_design returns truncated=true, you MUST stop and re-request using the exact nodeId from progressiveDisclosure.nodeIndex with depth=1 or depth=2 in figma_read_design, or call figma_summarize_design with that nodeId.",
  "Figma node-first rule: for implementation work, prefer single-node figma_read_design or figma_summarize_design with a small depth. Use file-level reads only for discovery, and avoid generating plans from broad/truncated trees.",
  "Figma progressive disclosure enforcement: when figma_read_design results contain truncated=true and progressiveDisclosure, follow the recommendedNextTool and recommendedNextInput immediately. Do not proceed with implementation. Do not attempt to work from jsonPreview (it has been removed for safety). The only path forward is to drill into a smaller node with figma_read_design (single node + small depth) or figma_summarize_design.",
];
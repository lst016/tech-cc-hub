import type {
  NormalizedPhotoshopLayer,
  NormalizedPhotoshopLayerTree,
  PhotoshopBounds,
  PhotoshopComponentManifest,
  PhotoshopInferenceSource,
  PhotoshopSectionManifest,
} from "./types.js";

export type WebPsdAnalysisResult = {
  page: {
    name: string;
    width: number;
    height: number;
    sections: PhotoshopSectionManifest[];
  };
  tokens: {
    colors: unknown[];
    typography: unknown[];
    spacing: unknown[];
    radii: unknown[];
    effects: unknown[];
  };
  warnings: string[];
};

const SECTION_KEYWORDS: Array<{ pattern: RegExp; id: string; name: string }> = [
  { pattern: /\bheader\b/i, id: "header", name: "Header" },
  { pattern: /\bnav(igation)?\b/i, id: "nav", name: "Navigation" },
  { pattern: /\bhero\b/i, id: "hero", name: "Hero" },
  { pattern: /\bfooter\b/i, id: "footer", name: "Footer" },
  { pattern: /\bsection[\/\s_-]*([a-z0-9-]+)?/i, id: "section", name: "Section" },
];

function slugify(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function defaultBounds(index: number, width: number): PhotoshopBounds {
  return { x: 0, y: index * 480, width, height: 480 };
}

function findSectionByName(name: string): { id: string; name: string } | null {
  for (const keyword of SECTION_KEYWORDS) {
    const match = keyword.pattern.exec(name);
    if (match) {
      const suffix = match[1] ? `-${slugify(match[1], "")}` : "";
      return { id: `${keyword.id}${suffix}`, name: keyword.name };
    }
  }
  return null;
}

function inferComponentType(layer: NormalizedPhotoshopLayer): string | null {
  const name = layer.name.toLowerCase();
  if (name.includes("component/button") || /\bbutton\b|\bbtn\b/.test(name)) return "button";
  if (layer.kind === "text" || name.includes("/h1") || name.includes("/title")) return "text";
  if (name.includes("card")) return "card";
  if (name.includes("asset/") || name.includes("logo") || name.includes("icon")) return "asset";
  return null;
}

function collectComponents(layer: NormalizedPhotoshopLayer): PhotoshopComponentManifest[] {
  const children = layer.children ?? [];
  const components: PhotoshopComponentManifest[] = [];
  for (const child of children) {
    const componentType = inferComponentType(child);
    if (componentType && child.bounds) {
      const source: PhotoshopInferenceSource[] = [child.kind === "text" ? "text" : "layer-name"];
      if (child.style) source.push("style");
      components.push({
        id: slugify(child.name, child.id),
        type: componentType,
        sourceLayerId: child.id,
        text: child.text,
        bounds: child.bounds,
        confidence: componentType === "asset" ? 0.72 : 0.82,
        source,
        needsReview: false,
      });
    }
    components.push(...collectComponents(child));
  }
  return components;
}

export function analyzeWebPsdLayerTree(tree: NormalizedPhotoshopLayerTree): WebPsdAnalysisResult {
  const warnings: string[] = [];
  const sections = tree.layers
    .filter((layer) => layer.kind === "group" || layer.kind === "artboard")
    .map((layer, index): PhotoshopSectionManifest => {
      const named = findSectionByName(layer.name);
      const bounds = layer.bounds ?? defaultBounds(index, tree.document.width);
      const inferredFromName = Boolean(named);
      if (!inferredFromName) {
        warnings.push(`Layer "${layer.name}" was inferred as a section from geometry and needs review.`);
      }
      return {
        id: named?.id ?? slugify(layer.name, `section-${index + 1}`),
        name: named?.name ?? layer.name,
        sourceLayerId: layer.id,
        bounds,
        confidence: inferredFromName ? 0.86 : 0.55,
        source: inferredFromName ? ["layer-name"] : ["geometry"],
        needsReview: !inferredFromName,
        components: collectComponents(layer),
      };
    });

  return {
    page: {
      name: tree.document.name,
      width: tree.document.width,
      height: tree.document.height,
      sections,
    },
    tokens: {
      colors: [],
      typography: [],
      spacing: [],
      radii: [],
      effects: [],
    },
    warnings,
  };
}

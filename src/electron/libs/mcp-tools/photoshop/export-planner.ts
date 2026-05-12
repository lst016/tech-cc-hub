import { basename, posix } from "path";

import type {
  NormalizedPhotoshopLayer,
  NormalizedPhotoshopLayerTree,
  PhotoshopAssetExportPlan,
  PhotoshopAssetFormat,
  PhotoshopAssetUsage,
} from "./types.js";

function sanitizePathPart(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

function collectLayers(layers: readonly NormalizedPhotoshopLayer[]): NormalizedPhotoshopLayer[] {
  return layers.flatMap((layer) => [layer, ...collectLayers(layer.children ?? [])]);
}

function inferUsage(layer: NormalizedPhotoshopLayer): PhotoshopAssetUsage {
  const name = layer.name.toLowerCase();
  if (name.includes("icon")) return "icon";
  if (name.includes("logo") || name.includes("asset/")) return "img";
  if (name.includes("bg") || name.includes("background") || layer.kind === "image" || layer.kind === "smart-object") return "background";
  if (name.includes("decor")) return "decorative";
  return "unknown";
}

function inferFormat(layer: NormalizedPhotoshopLayer, usage: PhotoshopAssetUsage): PhotoshopAssetFormat {
  if (usage === "background" || layer.kind === "image" || layer.kind === "smart-object") return "webp";
  return "png";
}

function isAssetCandidate(layer: NormalizedPhotoshopLayer): boolean {
  const name = layer.name.toLowerCase();
  return (
    name.includes("asset/") ||
    name.includes("logo") ||
    name.includes("icon") ||
    name.includes("background") ||
    name.includes("bg") ||
    layer.kind === "image" ||
    layer.kind === "smart-object"
  );
}

export function planPhotoshopAssetExports(input: {
  layerTree: NormalizedPhotoshopLayerTree;
  psdFilePath?: string;
  exportRoot?: string;
}): PhotoshopAssetExportPlan {
  const psdName = sanitizePathPart(
    input.psdFilePath ? basename(input.psdFilePath) : input.layerTree.document.name,
    "photoshop-document",
  );
  const exportRoot = input.exportRoot ?? posix.join("design-assets", psdName, "exports");
  const warnings: string[] = [];
  const seen = new Set<string>();
  const assets = collectLayers(input.layerTree.layers)
    .filter(isAssetCandidate)
    .map((layer) => {
      const usage = inferUsage(layer);
      const format = inferFormat(layer, usage);
      const baseId = sanitizePathPart(layer.name.replace(/^asset[\/_-]*/i, ""), layer.id);
      let id = baseId;
      let counter = 2;
      while (seen.has(id)) {
        id = `${baseId}-${counter++}`;
      }
      if (id !== baseId) {
        warnings.push(`Asset name "${baseId}" was duplicated and renamed to "${id}".`);
      }
      seen.add(id);
      return {
        id,
        sourceLayerId: layer.id,
        path: posix.join(exportRoot, `${id}.${format}`),
        format,
        bounds: layer.bounds,
        usage,
        scale: [1, 2],
        confidence: usage === "unknown" ? 0.6 : 0.82,
      };
    });

  if (assets.length === 0) {
    warnings.push("No obvious asset layers were found. Use naming such as asset/logo, icon/search, or background/hero.");
  }

  return { exportRoot, assets, warnings };
}

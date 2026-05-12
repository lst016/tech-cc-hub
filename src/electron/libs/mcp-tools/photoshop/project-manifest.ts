import type {
  PhotoshopComponentManifest,
  PhotoshopProjectManifest,
  PhotoshopWebManifest,
} from "./types.js";

function collectComponents(manifest: PhotoshopWebManifest): PhotoshopComponentManifest[] {
  return manifest.page.sections.flatMap((section) => section.components);
}

export function generatePhotoshopProjectManifest(manifests: readonly PhotoshopWebManifest[]): PhotoshopProjectManifest {
  const componentMap = new Map<string, { type: string; occurrences: number; pages: Set<string> }>();
  const sharedAssets = manifests.flatMap((manifest) => manifest.assets);
  const warnings: string[] = [];

  for (const manifest of manifests) {
    for (const component of collectComponents(manifest)) {
      const key = `${component.type}:${component.id}`;
      const existing = componentMap.get(key) ?? {
        type: component.type,
        occurrences: 0,
        pages: new Set<string>(),
      };
      existing.occurrences += 1;
      existing.pages.add(manifest.page.name);
      componentMap.set(key, existing);
    }
    warnings.push(...manifest.warnings.map((warning) => `${manifest.page.name}: ${warning}`));
  }

  return {
    schemaVersion: "1.0",
    pages: manifests.map((manifest) => ({
      name: manifest.page.name,
      sourceFilePath: manifest.source.filePath,
      width: manifest.page.width,
      height: manifest.page.height,
      sectionCount: manifest.page.sections.length,
      assetCount: manifest.assets.length,
    })),
    sharedAssets,
    sharedComponents: Array.from(componentMap.entries())
      .filter(([, value]) => value.occurrences > 1)
      .map(([id, value]) => ({
        id,
        type: value.type,
        occurrences: value.occurrences,
        pages: Array.from(value.pages).sort(),
      })),
    codeTargets: ["html-css-js", "react-tailwind"],
    warnings,
  };
}

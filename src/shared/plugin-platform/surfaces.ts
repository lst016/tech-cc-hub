import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
} from "./types.js";

export function getPluginActivityRailDescriptor(
  manifest: CanonicalPluginManifest,
): PluginActivityRailDescriptor | null {
  const surface = manifest.contributions.surfaces.find((item) => item.placement === "activity-rail");
  if (surface) {
    return {
      pluginId: manifest.id,
      surfaceId: surface.id,
      label: manifest.displayName,
      source: "enhanced",
      entry: surface.entry,
    };
  }

  if (manifest.legacyWorkspace) {
    return {
      pluginId: manifest.id,
      surfaceId: "workspace",
      label: manifest.displayName,
      source: "legacy-workspace",
    };
  }

  return null;
}

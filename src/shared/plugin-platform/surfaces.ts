import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
  PluginSurfaceDescriptor,
} from "./types.js";

export function getPluginSurfaceDescriptors(
  manifest: CanonicalPluginManifest,
): PluginSurfaceDescriptor[] {
  const descriptors: PluginSurfaceDescriptor[] = manifest.contributions.surfaces.map((surface) => ({
    pluginId: manifest.id,
    surfaceId: surface.id,
    label: manifest.displayName,
    placement: surface.placement,
    source: "enhanced",
    entry: surface.entry,
  }));

  const hasEnhancedActivityRail = descriptors.some((descriptor) => (
    descriptor.placement === "activity-rail"
  ));
  if (manifest.legacyWorkspace && !hasEnhancedActivityRail) {
    descriptors.push({
      pluginId: manifest.id,
      surfaceId: "workspace",
      label: manifest.displayName,
      placement: "activity-rail",
      source: "legacy-workspace",
    });
  }

  return descriptors;
}

export function getPluginActivityRailDescriptor(
  manifest: CanonicalPluginManifest,
): PluginActivityRailDescriptor | null {
  const descriptor = getPluginSurfaceDescriptors(manifest).find((surface) => (
    surface.placement === "activity-rail"
  ));
  if (!descriptor) return null;

  if (descriptor.source === "enhanced") {
    return {
      pluginId: descriptor.pluginId,
      surfaceId: descriptor.surfaceId,
      label: descriptor.label,
      source: "enhanced",
      entry: descriptor.entry,
    };
  }

  return {
    pluginId: descriptor.pluginId,
    surfaceId: descriptor.surfaceId,
    label: descriptor.label,
    source: "legacy-workspace",
  };
}

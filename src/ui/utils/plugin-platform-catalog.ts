import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
  PluginSurfaceDescriptor,
  PluginSurfacePlacement,
} from "../../shared/plugin-platform/types.js";
import type { WorkspacePluginDescriptor } from "../../shared/workspace-plugins.js";

export type PluginCatalogRecordForRenderer = {
  manifest: CanonicalPluginManifest;
  activityRail: PluginActivityRailDescriptor | null;
  surfaces: PluginSurfaceDescriptor[];
};

export type PluginSurfaceCatalogItem =
  | Extract<PluginSurfaceDescriptor, { source: "enhanced" }>
  | (Extract<PluginSurfaceDescriptor, { source: "legacy-workspace" }> & {
      workspace: WorkspacePluginDescriptor;
    });

export type PluginActivityRailCatalogItem =
  | {
      pluginId: string;
      surfaceId: string;
      label: string;
      source: "enhanced";
      entry: string;
    }
  | {
      pluginId: string;
      surfaceId: string;
      label: string;
      source: "legacy-workspace";
      workspace: WorkspacePluginDescriptor;
    };

function matchesEnhancedSurfaceDeclaration(
  manifest: CanonicalPluginManifest,
  descriptor: Extract<PluginSurfaceDescriptor, { source: "enhanced" }>,
): boolean {
  if (descriptor.pluginId !== manifest.id || descriptor.label !== manifest.displayName) return false;
  return manifest.contributions.surfaces.some((surface) => (
    surface.id === descriptor.surfaceId
    && surface.placement === descriptor.placement
    && surface.entry === descriptor.entry
  ));
}

export function projectPluginSurfaceCatalog(
  records: readonly PluginCatalogRecordForRenderer[],
): PluginSurfaceCatalogItem[] {
  const catalog: PluginSurfaceCatalogItem[] = [];

  for (const record of records) {
    for (const descriptor of record.surfaces) {
      if (descriptor.source === "enhanced") {
        if (matchesEnhancedSurfaceDeclaration(record.manifest, descriptor)) {
          catalog.push({ ...descriptor });
        }
        continue;
      }

      const workspace = record.manifest.legacyWorkspace;
      if (
        descriptor.pluginId !== record.manifest.id
        || descriptor.label !== record.manifest.displayName
        || !workspace
        || workspace.id !== descriptor.pluginId
      ) {
        continue;
      }
      catalog.push({
        ...descriptor,
        workspace: {
          id: workspace.id,
          label: descriptor.label,
          surface: workspace.surface,
          permissions: [...workspace.permissions],
        },
      });
    }
  }

  return catalog;
}

export function getPluginSurfaceCatalogByPlacement(
  catalog: readonly PluginSurfaceCatalogItem[],
  placement: PluginSurfacePlacement,
): PluginSurfaceCatalogItem[] {
  return catalog.filter((item) => item.placement === placement);
}

export function projectPluginActivityRailCatalog(
  records: readonly PluginCatalogRecordForRenderer[],
): PluginActivityRailCatalogItem[] {
  const catalog: PluginActivityRailCatalogItem[] = [];

  for (const record of records) {
    const descriptor = record.activityRail;
    if (!descriptor || descriptor.pluginId !== record.manifest.id) continue;

    if (descriptor.source === "enhanced") {
      catalog.push({
        pluginId: descriptor.pluginId,
        surfaceId: descriptor.surfaceId,
        label: descriptor.label,
        source: descriptor.source,
        entry: descriptor.entry,
      });
      continue;
    }

    const workspace = record.manifest.legacyWorkspace;
    if (!workspace || workspace.id !== descriptor.pluginId) continue;
    catalog.push({
      pluginId: descriptor.pluginId,
      surfaceId: descriptor.surfaceId,
      label: descriptor.label,
      source: descriptor.source,
      workspace: {
        id: workspace.id,
        label: descriptor.label,
        surface: workspace.surface,
        permissions: [...workspace.permissions],
      },
    });
  }

  return catalog;
}

export function getLegacyWorkspacePluginsFromCatalog(
  catalog: readonly PluginActivityRailCatalogItem[],
): WorkspacePluginDescriptor[] {
  return catalog
    .filter((item): item is Extract<PluginActivityRailCatalogItem, { source: "legacy-workspace" }> => (
      item.source === "legacy-workspace"
    ))
    .map((item) => item.workspace);
}

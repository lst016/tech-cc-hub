import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
} from "../../shared/plugin-platform/types.js";
import type { WorkspacePluginDescriptor } from "../../shared/workspace-plugins.js";

export type PluginCatalogRecordForRenderer = {
  manifest: CanonicalPluginManifest;
  activityRail: PluginActivityRailDescriptor | null;
};

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

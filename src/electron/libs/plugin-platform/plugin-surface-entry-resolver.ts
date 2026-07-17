import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PluginSurfacePlacement } from "../../../shared/plugin-platform/types.js";
import { isPathInsidePluginPackage } from "./plugin-package-paths.js";
import { discoverPluginPackages } from "./plugin-package-registry.js";

export type ResolveInstalledPluginSurfaceEntryInput = {
  pluginsPath: string;
  pluginId: string;
  surfaceId: string;
};

export type ResolveInstalledPluginSurfaceEntryResult =
  | {
      ok: true;
      pluginId: string;
      surfaceId: string;
      placement: PluginSurfacePlacement;
      packageRoot: string;
      entryPath: string;
      entryUrl: string;
    }
  | {
      ok: false;
      code:
        | "PLUGIN_NOT_INSTALLED"
        | "SURFACE_NOT_DECLARED"
        | "SURFACE_ENTRY_UNAVAILABLE"
        | "SURFACE_PATH_ESCAPE"
        | "SURFACE_ENTRY_UNSAFE";
      pluginId: string;
      surfaceId: string;
    };

function failed(
  input: ResolveInstalledPluginSurfaceEntryInput,
  code: Extract<ResolveInstalledPluginSurfaceEntryResult, { ok: false }>["code"],
): ResolveInstalledPluginSurfaceEntryResult {
  return {
    ok: false,
    code,
    pluginId: input.pluginId,
    surfaceId: input.surfaceId,
  };
}

export async function resolveInstalledPluginSurfaceEntry(
  input: ResolveInstalledPluginSurfaceEntryInput,
): Promise<ResolveInstalledPluginSurfaceEntryResult> {
  const discovery = await discoverPluginPackages(input.pluginsPath);
  const installed = discovery.records.find((record) => (
    record.manifest.id === input.pluginId
  ));
  if (!installed) return failed(input, "PLUGIN_NOT_INSTALLED");

  const surface = installed.manifest.contributions.surfaces.find((item) => (
    item.id === input.surfaceId
  ));
  if (!surface) return failed(input, "SURFACE_NOT_DECLARED");

  let entryPath: string;
  try {
    entryPath = await realpath(resolve(installed.packageRoot, surface.entry));
  } catch {
    return failed(input, "SURFACE_ENTRY_UNAVAILABLE");
  }
  if (!isPathInsidePluginPackage(installed.packageRoot, entryPath)) {
    return failed(input, "SURFACE_PATH_ESCAPE");
  }

  try {
    const entryStat = await stat(entryPath);
    if (!entryStat.isFile()) return failed(input, "SURFACE_ENTRY_UNAVAILABLE");
    if (entryStat.nlink > 1) return failed(input, "SURFACE_ENTRY_UNSAFE");
  } catch {
    return failed(input, "SURFACE_ENTRY_UNAVAILABLE");
  }

  return {
    ok: true,
    pluginId: input.pluginId,
    surfaceId: input.surfaceId,
    placement: surface.placement,
    packageRoot: installed.packageRoot,
    entryPath,
    entryUrl: pathToFileURL(entryPath).toString(),
  };
}

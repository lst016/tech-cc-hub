import { access, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";

import { getPluginActivityRailDescriptor } from "../../../shared/plugin-platform/surfaces.js";
import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
  PluginManifestValidationError,
  PluginManifestWarning,
} from "../../../shared/plugin-platform/types.js";
import { loadPluginPackage } from "./plugin-package-loader.js";

export type PluginPackageRegistryRecord = {
  packageRoot: string;
  manifest: CanonicalPluginManifest;
  warnings: PluginManifestWarning[];
  activityRail: PluginActivityRailDescriptor | null;
};

export type PluginPackageRegistryFailure = {
  packageRoot: string;
  errors: PluginManifestValidationError[];
  warnings: PluginManifestWarning[];
};

export type PluginPackageDiscoveryResult = {
  records: PluginPackageRegistryRecord[];
  failures: PluginPackageRegistryFailure[];
};

function registryError(path: string, message: string): PluginManifestValidationError {
  return { code: "MANIFEST_INVALID", path, message };
}

async function hasCodexManifest(packageRoot: string): Promise<boolean> {
  try {
    await access(join(packageRoot, ".codex-plugin", "plugin.json"));
    return true;
  } catch (error) {
    return !(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
  }
}

export async function discoverPluginPackages(pluginsPath: string): Promise<PluginPackageDiscoveryResult> {
  const pluginsRoot = resolve(pluginsPath);
  let entries;
  try {
    entries = await readdir(pluginsRoot, { withFileTypes: true });
  } catch {
    return {
      records: [],
      failures: [{
        packageRoot: pluginsRoot,
        errors: [registryError("package", "The plugin discovery root is unavailable.")],
        warnings: [],
      }],
    };
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => join(pluginsRoot, entry.name));

  const loadedPackages = await Promise.all(candidates.map(async (candidate) => {
    if (!await hasCodexManifest(candidate)) return null;
    let packageRoot = candidate;
    try {
      packageRoot = await realpath(candidate);
    } catch {
      // The loader will return the structured package error below.
    }
    return { packageRoot, result: await loadPluginPackage(candidate) };
  }));

  const records: PluginPackageRegistryRecord[] = [];
  const failures: PluginPackageRegistryFailure[] = [];
  const packageByPluginId = new Map<string, string>();

  for (const loaded of loadedPackages) {
    if (!loaded) continue;
    if (!loaded.result.ok) {
      failures.push({
        packageRoot: loaded.packageRoot,
        errors: loaded.result.errors,
        warnings: loaded.result.warnings,
      });
      continue;
    }

    const existingPackage = packageByPluginId.get(loaded.result.manifest.id);
    if (existingPackage) {
      failures.push({
        packageRoot: loaded.packageRoot,
        errors: [registryError(
          "codex.name",
          `Duplicate plugin id ${loaded.result.manifest.id}; already loaded from ${existingPackage}.`,
        )],
        warnings: loaded.result.warnings,
      });
      continue;
    }

    packageByPluginId.set(loaded.result.manifest.id, loaded.packageRoot);
    records.push({
      packageRoot: loaded.packageRoot,
      manifest: loaded.result.manifest,
      warnings: loaded.result.warnings,
      activityRail: getPluginActivityRailDescriptor(loaded.result.manifest),
    });
  }

  return { records, failures };
}

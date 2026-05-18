import { existsSync } from "fs";
import { join } from "path";
import { getLoadablePath } from "sqlite-vec";

type SqliteExtensionDb = {
  loadExtension(path: string, entrypoint?: string): void;
};

type ProcessWithResourcesPath = NodeJS.Process & {
  resourcesPath?: string;
};

export function toUnpackedAsarPath(loadablePath: string): string {
  return loadablePath.replace(/([\\/])app\.asar([\\/])/i, "$1app.asar.unpacked$2");
}

function resolveFromResourcesPath(loadablePath: string, resourcesPath?: string): string | null {
  if (!resourcesPath) {
    return null;
  }

  const normalizedPath = loadablePath.replace(/\\/g, "/");
  const nodeModulesMarker = "/node_modules/";
  const nodeModulesIndex = normalizedPath.lastIndexOf(nodeModulesMarker);
  if (nodeModulesIndex < 0) {
    return null;
  }

  const relativeFromAppRoot = normalizedPath.slice(nodeModulesIndex + 1).split("/");
  return join(resourcesPath, "app.asar.unpacked", ...relativeFromAppRoot);
}

export function resolveSqliteVecLoadablePath(
  loadablePath = getLoadablePath(),
  options: {
    resourcesPath?: string;
    pathExists?: (path: string) => boolean;
  } = {},
): string {
  const pathExists = options.pathExists ?? existsSync;
  const unpackedCandidate = toUnpackedAsarPath(loadablePath);
  if (unpackedCandidate !== loadablePath && pathExists(unpackedCandidate)) {
    return unpackedCandidate;
  }

  const resourcesCandidate = resolveFromResourcesPath(
    loadablePath,
    options.resourcesPath ?? (process as ProcessWithResourcesPath).resourcesPath,
  );
  if (resourcesCandidate && pathExists(resourcesCandidate)) {
    return resourcesCandidate;
  }

  return loadablePath;
}

export function loadSqliteVecExtension(db: SqliteExtensionDb): void {
  db.loadExtension(resolveSqliteVecLoadablePath());
}

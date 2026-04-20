import path from "path";

export function resolveAppAssetPath(appPath: string, assetRelativePath: string): string {
  return path.resolve(appPath, assetRelativePath);
}

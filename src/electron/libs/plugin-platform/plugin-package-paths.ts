import { isAbsolute, relative, sep } from "node:path";

export function isPathInsidePluginPackage(
  packageRoot: string,
  targetPath: string,
): boolean {
  const relativePath = relative(packageRoot, targetPath);
  return relativePath === ""
    || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
}

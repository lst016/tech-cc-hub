export function isSafePluginPackageRelativePath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalized)) return false;
  return !normalized.split("/").some((segment) => segment === "..");
}

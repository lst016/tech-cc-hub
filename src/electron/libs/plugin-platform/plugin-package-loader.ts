import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { normalizePluginPackageManifests } from "../../../shared/plugin-platform/manifest.js";
import { isSafePluginPackageRelativePath } from "../../../shared/plugin-platform/paths.js";
import type {
  PluginManifestValidationError,
  PluginManifestValidationResult,
} from "../../../shared/plugin-platform/types.js";

type JsonFileResult =
  | { ok: true; found: false }
  | { ok: true; found: true; value: unknown }
  | { ok: false; error: PluginManifestValidationError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function manifestError(path: string, message: string): PluginManifestValidationError {
  return { code: "MANIFEST_INVALID", path, message };
}

function failed(error: PluginManifestValidationError): PluginManifestValidationResult {
  return { ok: false, errors: [error], warnings: [] };
}

function isInsidePackage(packageRoot: string, targetPath: string): boolean {
  const relativePath = relative(packageRoot, targetPath);
  return relativePath === ""
    || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
}

async function readJsonFile(input: {
  packageRoot: string;
  filePath: string;
  manifestPath: string;
  required: boolean;
}): Promise<JsonFileResult> {
  let resolvedPath: string;
  try {
    resolvedPath = await realpath(input.filePath);
  } catch (error) {
    if (!input.required && isMissingFileError(error)) return { ok: true, found: false };
    return {
      ok: false,
      error: manifestError(input.manifestPath, `Unable to read the ${input.manifestPath} manifest.`),
    };
  }

  if (!isInsidePackage(input.packageRoot, resolvedPath)) {
    return {
      ok: false,
      error: manifestError(input.manifestPath, "Manifest paths must stay inside the plugin package."),
    };
  }

  let source: string;
  try {
    source = await readFile(resolvedPath, "utf8");
  } catch {
    return {
      ok: false,
      error: manifestError(input.manifestPath, `Unable to read the ${input.manifestPath} manifest.`),
    };
  }

  try {
    return { ok: true, found: true, value: JSON.parse(source.replace(/^\uFEFF/, "")) as unknown };
  } catch {
    return {
      ok: false,
      error: manifestError(input.manifestPath, `The ${input.manifestPath} manifest is not valid JSON.`),
    };
  }
}

export async function loadPluginPackage(packagePath: string): Promise<PluginManifestValidationResult> {
  let packageRoot: string;
  try {
    packageRoot = await realpath(resolve(packagePath));
  } catch {
    return failed(manifestError("codex", "The plugin package directory is unavailable."));
  }

  const codex = await readJsonFile({
    packageRoot,
    filePath: join(packageRoot, ".codex-plugin", "plugin.json"),
    manifestPath: "codex",
    required: true,
  });
  if (!codex.ok) return failed(codex.error);
  if (!codex.found) return failed(manifestError("codex", "The Codex plugin manifest is required."));

  const extension = await readJsonFile({
    packageRoot,
    filePath: join(packageRoot, "tech-cc-hub.json"),
    manifestPath: "extension",
    required: false,
  });
  if (!extension.ok) return failed(extension.error);

  const legacyWorkspace = await readJsonFile({
    packageRoot,
    filePath: join(packageRoot, "tech-cc-hub.plugin.json"),
    manifestPath: "legacyWorkspace",
    required: false,
  });
  if (!legacyWorkspace.ok) return failed(legacyWorkspace.error);

  let mcpManifest: unknown;
  if (isRecord(codex.value) && typeof codex.value.mcpServers === "string") {
    const mcpPath = codex.value.mcpServers.trim();
    if (isSafePluginPackageRelativePath(mcpPath)) {
      const mcp = await readJsonFile({
        packageRoot,
        filePath: resolve(packageRoot, mcpPath),
        manifestPath: "mcp",
        required: true,
      });
      if (!mcp.ok) return failed(mcp.error);
      if (!mcp.found) return failed(manifestError("mcp", "The referenced MCP manifest is required."));
      mcpManifest = mcp.value;
    }
  }

  return normalizePluginPackageManifests({
    codexManifest: codex.value,
    ...(mcpManifest !== undefined ? { mcpManifest } : {}),
    ...(extension.found ? { extensionManifest: extension.value } : {}),
    ...(legacyWorkspace.found ? { legacyWorkspaceManifest: legacyWorkspace.value } : {}),
  });
}

import { realpath, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { PluginAtomicCapability } from "../../../shared/plugin-platform/types.js";
import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";
import { isPathInsidePluginPackage } from "./plugin-package-paths.js";

export type AuthorizePluginSurfaceRequestInput = {
  registry: PluginCapabilityGrantRegistry;
  pluginId: string;
  packageRoot: string;
  requestUrl: string;
};

export type PluginSurfaceRequestAuthorizationResult =
  | {
      ok: true;
      access: "package-file" | "embedded";
      requestUrl: string;
    }
  | {
      ok: true;
      access: "network";
      requestUrl: string;
      origin: string;
      grantedBy: PluginAtomicCapability;
    }
  | {
      ok: false;
      code:
        | "PLUGIN_NOT_ACTIVE"
        | "INVALID_URL"
        | "PROTOCOL_NOT_ALLOWED"
        | "PACKAGE_FILE_UNAVAILABLE"
        | "PACKAGE_PATH_ESCAPE"
        | "PACKAGE_FILE_UNSAFE";
    }
  | {
      ok: false;
      code: "NETWORK_NOT_GRANTED";
      origin: string;
    };

async function authorizePackageFile(
  packageRoot: string,
  requestUrl: URL,
): Promise<PluginSurfaceRequestAuthorizationResult> {
  let resolvedRoot: string;
  let resolvedFile: string;
  try {
    [resolvedRoot, resolvedFile] = await Promise.all([
      realpath(packageRoot),
      realpath(fileURLToPath(requestUrl)),
    ]);
  } catch {
    return { ok: false, code: "PACKAGE_FILE_UNAVAILABLE" };
  }
  if (!isPathInsidePluginPackage(resolvedRoot, resolvedFile)) {
    return { ok: false, code: "PACKAGE_PATH_ESCAPE" };
  }

  try {
    const fileStat = await stat(resolvedFile);
    if (!fileStat.isFile()) return { ok: false, code: "PACKAGE_FILE_UNAVAILABLE" };
    if (fileStat.nlink > 1) return { ok: false, code: "PACKAGE_FILE_UNSAFE" };
  } catch {
    return { ok: false, code: "PACKAGE_FILE_UNAVAILABLE" };
  }

  return {
    ok: true,
    access: "package-file",
    requestUrl: pathToFileURL(resolvedFile).toString(),
  };
}

export async function authorizePluginSurfaceRequest(
  input: AuthorizePluginSurfaceRequestInput,
): Promise<PluginSurfaceRequestAuthorizationResult> {
  if (!input.registry.isActive(input.pluginId)) {
    return { ok: false, code: "PLUGIN_NOT_ACTIVE" };
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(input.requestUrl);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }

  if (requestUrl.protocol === "file:") {
    return await authorizePackageFile(input.packageRoot, requestUrl);
  }
  if (
    requestUrl.protocol === "data:"
    || requestUrl.protocol === "blob:"
    || requestUrl.href === "about:blank"
  ) {
    return { ok: true, access: "embedded", requestUrl: input.requestUrl };
  }
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
    return { ok: false, code: "PROTOCOL_NOT_ALLOWED" };
  }

  const origin = requestUrl.origin;
  const capability = `network.connect:${origin}` as PluginAtomicCapability;
  const authorization = input.registry.authorize(input.pluginId, capability);
  if (!authorization.ok) {
    return { ok: false, code: "NETWORK_NOT_GRANTED", origin };
  }
  return {
    ok: true,
    access: "network",
    requestUrl: requestUrl.toString(),
    origin,
    grantedBy: authorization.grantedBy,
  };
}

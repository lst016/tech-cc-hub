import { normalizeWorkspacePluginManifest } from "../workspace-plugins.js";
import {
  PLUGIN_ATOMIC_EXACT_CAPABILITIES,
  PLUGIN_CAPABILITY_BUNDLES,
  type CanonicalPluginManifest,
  type NormalizePluginPackageManifestsInput,
  type PluginCapability,
  type PluginCommandContribution,
  type PluginManifestValidationError,
  type PluginManifestValidationResult,
  type PluginManifestWarning,
  type PluginRuntimeClass,
  type PluginSurfaceContribution,
  type PluginSurfacePlacement,
} from "./types.js";

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const CONTRIBUTION_ID_PATTERN = /^[a-z][a-z0-9.-]{1,127}$/;
const SURFACE_PLACEMENTS = new Set<PluginSurfacePlacement>(["activity-rail", "settings", "composer"]);

const LEGACY_PERMISSION_CAPABILITIES: Record<string, PluginCapability[]> = {
  "session.snapshot": ["session.context.read"],
  "session.send": ["session.main.message.create", "session.main.run.start"],
  "session.images.receive": ["session.attachments.receive"],
  "session.images.generate": ["tools.call:image_generate"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isSafeRelativePluginPath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalized)) return false;
  return !normalized.split("/").some((segment) => segment === "..");
}

function isKnownPluginCapability(value: string): value is PluginCapability {
  if (PLUGIN_ATOMIC_EXACT_CAPABILITIES.includes(value as typeof PLUGIN_ATOMIC_EXACT_CAPABILITIES[number])) return true;
  if (PLUGIN_CAPABILITY_BUNDLES.includes(value as typeof PLUGIN_CAPABILITY_BUNDLES[number])) return true;
  const separator = value.indexOf(":");
  if (separator < 1 || separator === value.length - 1) return false;
  const prefix = value.slice(0, separator);
  const scope = value.slice(separator + 1).trim();
  if (!scope) return false;
  return ["tools.call", "workspace.read", "workspace.write", "network.connect", "secrets.use"].includes(prefix);
}

function pushInvalid(errors: PluginManifestValidationError[], path: string, message: string): void {
  errors.push({ code: "MANIFEST_INVALID", path, message });
}

function normalizeContributionPath(
  value: unknown,
  path: string,
  errors: PluginManifestValidationError[],
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizedString(value);
  if (!normalized || !isSafeRelativePluginPath(normalized)) {
    pushInvalid(errors, path, "Contribution paths must stay inside the plugin package.");
    return undefined;
  }
  return normalized;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.map(normalizedString).filter((item): item is string => Boolean(item)));
}

function normalizeCapabilities(
  value: unknown,
  errors: PluginManifestValidationError[],
  warnings: PluginManifestWarning[],
): { required: PluginCapability[]; optional: PluginCapability[] } {
  if (value === undefined) return { required: [], optional: [] };
  if (!isRecord(value)) {
    pushInvalid(errors, "extension.capabilities", "Capabilities must be an object.");
    return { required: [], optional: [] };
  }

  const required: PluginCapability[] = [];
  const optional: PluginCapability[] = [];
  for (const [kind, target] of [["required", required], ["optional", optional]] as const) {
    const raw = value[kind];
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      pushInvalid(errors, `extension.capabilities.${kind}`, `${kind} capabilities must be an array.`);
      continue;
    }
    raw.forEach((capability, index) => {
      const path = `extension.capabilities.${kind}[${index}]`;
      const normalized = normalizedString(capability);
      if (!normalized || !isKnownPluginCapability(normalized)) {
        if (kind === "required") {
          errors.push({
            code: "UNKNOWN_REQUIRED_CAPABILITY",
            path,
            message: `Unknown required capability: ${String(capability)}`,
          });
        } else {
          warnings.push({
            code: "UNKNOWN_OPTIONAL_CAPABILITY",
            path,
            message: `Unknown optional capability disabled: ${String(capability)}`,
          });
        }
        return;
      }
      if (!target.includes(normalized)) target.push(normalized);
    });
  }

  return {
    required,
    optional: optional.filter((capability) => !required.includes(capability)),
  };
}

function normalizeSurfaces(value: unknown, errors: PluginManifestValidationError[]): PluginSurfaceContribution[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    pushInvalid(errors, "extension.contributes.surfaces", "Surface contributions must be an array.");
    return [];
  }
  const surfaces: PluginSurfaceContribution[] = [];
  value.forEach((surface, index) => {
    const basePath = `extension.contributes.surfaces[${index}]`;
    if (!isRecord(surface)) {
      pushInvalid(errors, basePath, "Surface contributions must be objects.");
      return;
    }
    const id = normalizedString(surface.id);
    const placement = normalizedString(surface.placement) as PluginSurfacePlacement | null;
    const entry = normalizeContributionPath(surface.entry, `${basePath}.entry`, errors);
    if (!id || !CONTRIBUTION_ID_PATTERN.test(id)) pushInvalid(errors, `${basePath}.id`, "Invalid surface id.");
    if (!placement || !SURFACE_PLACEMENTS.has(placement)) pushInvalid(errors, `${basePath}.placement`, "Invalid surface placement.");
    if (id && CONTRIBUTION_ID_PATTERN.test(id) && placement && SURFACE_PLACEMENTS.has(placement) && entry) {
      surfaces.push({ id, placement, entry });
    }
  });
  return surfaces;
}

function normalizeCommands(value: unknown, errors: PluginManifestValidationError[]): PluginCommandContribution[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    pushInvalid(errors, "extension.contributes.commands", "Command contributions must be an array.");
    return [];
  }
  const commands: PluginCommandContribution[] = [];
  value.forEach((command, index) => {
    const basePath = `extension.contributes.commands[${index}]`;
    if (!isRecord(command)) {
      pushInvalid(errors, basePath, "Command contributions must be objects.");
      return;
    }
    const id = normalizedString(command.id);
    const title = normalizedString(command.title);
    if (!id || !CONTRIBUTION_ID_PATTERN.test(id)) pushInvalid(errors, `${basePath}.id`, "Invalid command id.");
    if (!title) pushInvalid(errors, `${basePath}.title`, "Command title is required.");
    if (id && CONTRIBUTION_ID_PATTERN.test(id) && title) commands.push({ id, title });
  });
  return commands;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function classifyMcpRuntime(
  mcpServersPath: string | undefined,
  mcpManifest: unknown,
  errors: PluginManifestValidationError[],
  warnings: PluginManifestWarning[],
): PluginRuntimeClass {
  if (!mcpServersPath) {
    if (mcpManifest !== undefined) {
      pushInvalid(errors, "mcp", "A parsed MCP manifest requires a Codex mcpServers contribution.");
    }
    return "declarative";
  }

  if (mcpManifest === undefined) {
    warnings.push({
      code: "MCP_RUNTIME_UNCLASSIFIED",
      path: "mcp",
      message: "MCP transports were not inspected; using the native-local runtime as a safe fallback.",
    });
    return "native-local";
  }

  if (!isRecord(mcpManifest) || !isRecord(mcpManifest.mcpServers)) {
    pushInvalid(errors, "mcp", "The MCP manifest must contain an mcpServers object.");
    return "native-local";
  }

  let hasLocalServer = false;
  for (const [serverName, value] of Object.entries(mcpManifest.mcpServers)) {
    const path = `mcp.mcpServers.${serverName}`;
    if (!isRecord(value)) {
      pushInvalid(errors, path, "MCP server definitions must be objects.");
      continue;
    }

    const command = normalizedString(value.command);
    const url = normalizedString(value.url);
    const type = value.type === undefined ? null : normalizedString(value.type);
    if ((command && url) || (!command && !url)) {
      pushInvalid(errors, path, "MCP servers must declare exactly one command or URL transport.");
      continue;
    }
    if (value.type !== undefined && !type) {
      pushInvalid(errors, path, "MCP transport type must be stdio, http, or sse.");
      continue;
    }

    if (command) {
      if (type && type !== "stdio") {
        pushInvalid(errors, path, "Command-based MCP servers must use the stdio transport type.");
        continue;
      }
      hasLocalServer = true;
      continue;
    }

    if ((type && type !== "http" && type !== "sse") || !url || !isHttpUrl(url)) {
      pushInvalid(errors, path, "URL-based MCP servers must use an HTTP or SSE transport with an HTTP(S) URL.");
    }
  }

  return hasLocalServer ? "native-local" : "declarative";
}

export function normalizePluginPackageManifests(
  input: NormalizePluginPackageManifestsInput,
): PluginManifestValidationResult {
  const errors: PluginManifestValidationError[] = [];
  const warnings: PluginManifestWarning[] = [];
  if (!isRecord(input.codexManifest)) {
    pushInvalid(errors, "codex", "Codex plugin manifest must be an object.");
    return { ok: false, errors, warnings };
  }

  const name = normalizedString(input.codexManifest.name);
  const version = normalizedString(input.codexManifest.version);
  if (!name || !PLUGIN_ID_PATTERN.test(name)) pushInvalid(errors, "codex.name", "Plugin name is required and must be a safe identifier.");
  if (!version) pushInvalid(errors, "codex.version", "Plugin version is required.");

  const skills = normalizeContributionPath(input.codexManifest.skills, "codex.skills", errors);
  const mcpServers = normalizeContributionPath(input.codexManifest.mcpServers, "codex.mcpServers", errors);
  const apps = normalizeContributionPath(input.codexManifest.apps, "codex.apps", errors);

  let runtimeClass = classifyMcpRuntime(mcpServers, input.mcpManifest, errors, warnings);
  let surfaces: PluginSurfaceContribution[] = [];
  let commands: PluginCommandContribution[] = [];
  let hooks: string[] = [];
  let capabilities: { required: PluginCapability[]; optional: PluginCapability[] } = { required: [], optional: [] };

  if (input.extensionManifest !== undefined) {
    if (!isRecord(input.extensionManifest)) {
      pushInvalid(errors, "extension", "tech-cc-hub manifest must be an object.");
    } else {
      if (input.extensionManifest.schemaVersion !== 1) {
        pushInvalid(errors, "extension.schemaVersion", "Only schemaVersion 1 is supported.");
      }
      const runtime = input.extensionManifest.runtime;
      if (runtime !== undefined) {
        if (!isRecord(runtime) || !["declarative", "native-local"].includes(String(runtime.kind))) {
          pushInvalid(errors, "extension.runtime.kind", "Runtime kind must be declarative or native-local.");
        } else if (runtime.kind === "native-local") {
          runtimeClass = "native-local";
        }
      }
      const contributes = input.extensionManifest.contributes;
      if (contributes !== undefined && !isRecord(contributes)) {
        pushInvalid(errors, "extension.contributes", "Contributions must be an object.");
      } else if (isRecord(contributes)) {
        surfaces = normalizeSurfaces(contributes.surfaces, errors);
        commands = normalizeCommands(contributes.commands, errors);
        if (contributes.hooks !== undefined && !Array.isArray(contributes.hooks)) {
          pushInvalid(errors, "extension.contributes.hooks", "Hook contributions must be an array.");
        } else {
          hooks = normalizeStringList(contributes.hooks);
        }
      }
      capabilities = normalizeCapabilities(input.extensionManifest.capabilities, errors, warnings);
    }
  }

  let legacyWorkspace;
  if (input.legacyWorkspaceManifest !== undefined) {
    legacyWorkspace = normalizeWorkspacePluginManifest(input.legacyWorkspaceManifest);
    if (!legacyWorkspace) {
      pushInvalid(errors, "legacyWorkspace", "Legacy workspace manifest is invalid.");
    } else {
      if (name && legacyWorkspace.id !== name) {
        pushInvalid(errors, "legacyWorkspace.id", "Legacy workspace plugin id must match the Codex plugin name.");
      }
      runtimeClass = "native-local";
      for (const permission of legacyWorkspace.permissions) {
        capabilities.required.push(...(LEGACY_PERMISSION_CAPABILITIES[permission] ?? []));
      }
      capabilities.required = unique(capabilities.required);
      capabilities.optional = capabilities.optional.filter((capability) => !capabilities.required.includes(capability));
    }
  }

  if (errors.length > 0 || !name || !version) return { ok: false, errors, warnings };

  const interfaceRecord = isRecord(input.codexManifest.interface) ? input.codexManifest.interface : null;
  const displayName = normalizedString(interfaceRecord?.displayName) ?? name;
  const description = normalizedString(input.codexManifest.description) ?? undefined;
  const interfaceCapabilities = normalizeStringList(interfaceRecord?.capabilities);

  const contributions: CanonicalPluginManifest["contributions"] = {
    ...(skills ? { skills } : {}),
    ...(mcpServers ? { mcpServers } : {}),
    ...(apps ? { apps } : {}),
    surfaces,
    commands,
    hooks,
  };
  const manifest: CanonicalPluginManifest = {
    id: name,
    version,
    displayName,
    ...(description ? { description } : {}),
    runtimeClass,
    interfaceCapabilities,
    contributions,
    capabilities,
    ...(legacyWorkspace ? { legacyWorkspace } : {}),
  };
  return { ok: true, manifest, warnings };
}

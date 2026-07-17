import type { WorkspacePluginManifest } from "../workspace-plugins.js";

export const PLUGIN_ATOMIC_EXACT_CAPABILITIES = [
  "session.context.read",
  "session.main.message.create",
  "session.main.run.start",
  "session.main.run.cancel",
  "session.main.model.set",
  "session.child.create",
  "session.child.read",
  "session.child.publish",
  "session.attachments.receive",
  "models.list",
  "models.select",
  "models.invoke",
  "tools.list",
  "desktop.observe",
  "desktop.control",
] as const;

export const PLUGIN_CAPABILITY_BUNDLES = ["session.main.control"] as const;

export type PluginAtomicExactCapability = typeof PLUGIN_ATOMIC_EXACT_CAPABILITIES[number];
export type PluginCapabilityBundle = typeof PLUGIN_CAPABILITY_BUNDLES[number];
export type PluginScopedCapability =
  | `tools.call:${string}`
  | `workspace.read:${string}`
  | `workspace.write:${string}`
  | `network.connect:${string}`
  | `secrets.use:${string}`;
export type PluginAtomicCapability = PluginAtomicExactCapability | PluginScopedCapability;
export type PluginCapability = PluginAtomicCapability | PluginCapabilityBundle;

export type PluginGrantProfile = "standard" | "full-trust" | "custom";

export type PluginCapabilityRequestSet = {
  required: readonly PluginCapability[];
  optional: readonly PluginCapability[];
};

export type ResolvePluginCapabilityGrantInput = {
  requested: PluginCapabilityRequestSet;
  profile: PluginGrantProfile;
  customGrants?: readonly PluginCapability[];
};

export type PluginCapabilityGrantResult = {
  effectiveCapabilities: PluginAtomicCapability[];
  missingRequiredCapabilities: PluginAtomicCapability[];
  canActivate: boolean;
};

export type PluginRuntimeClass = "declarative" | "native-local";
export type PluginSurfacePlacement = "activity-rail" | "settings" | "composer";

export type PluginSurfaceContribution = {
  id: string;
  placement: PluginSurfacePlacement;
  entry: string;
};

export type PluginCommandContribution = {
  id: string;
  title: string;
};

export type CanonicalPluginManifest = {
  id: string;
  version: string;
  displayName: string;
  description?: string;
  runtimeClass: PluginRuntimeClass;
  interfaceCapabilities: string[];
  contributions: {
    skills?: string;
    mcpServers?: string;
    apps?: string;
    surfaces: PluginSurfaceContribution[];
    commands: PluginCommandContribution[];
    hooks: string[];
  };
  capabilities: {
    required: PluginCapability[];
    optional: PluginCapability[];
  };
  legacyWorkspace?: WorkspacePluginManifest;
};

export type PluginManifestValidationErrorCode =
  | "MANIFEST_INVALID"
  | "UNKNOWN_REQUIRED_CAPABILITY";

export type PluginManifestValidationError = {
  code: PluginManifestValidationErrorCode;
  path: string;
  message: string;
};

export type PluginManifestWarning = {
  code: "UNKNOWN_OPTIONAL_CAPABILITY" | "MCP_RUNTIME_UNCLASSIFIED";
  path: string;
  message: string;
};

export type PluginManifestValidationResult =
  | {
      ok: true;
      manifest: CanonicalPluginManifest;
      warnings: PluginManifestWarning[];
    }
  | {
      ok: false;
      errors: PluginManifestValidationError[];
      warnings: PluginManifestWarning[];
    };

export type NormalizePluginPackageManifestsInput = {
  codexManifest: unknown;
  mcpManifest?: unknown;
  extensionManifest?: unknown;
  legacyWorkspaceManifest?: unknown;
};

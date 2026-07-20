import type {
  PluginAtomicCapability,
  PluginCapabilityGrantResult,
} from "./types.js";

export type AuthorizePluginCapabilityInput = {
  grant: PluginCapabilityGrantResult;
  capability: PluginAtomicCapability;
};

export type PluginCapabilityAuthorizationResult =
  | {
      ok: true;
      capability: PluginAtomicCapability;
      grantedBy: PluginAtomicCapability;
    }
  | {
      ok: false;
      code: "CAPABILITY_NOT_GRANTED" | "PLUGIN_NOT_ACTIVATABLE";
      capability: PluginAtomicCapability;
    };

function scopedWildcardFor(
  capability: PluginAtomicCapability,
): PluginAtomicCapability | null {
  const separator = capability.indexOf(":");
  if (separator < 1 || capability.endsWith(":*")) return null;
  return `${capability.slice(0, separator)}:*` as PluginAtomicCapability;
}

export function authorizePluginCapability(
  input: AuthorizePluginCapabilityInput,
): PluginCapabilityAuthorizationResult {
  if (!input.grant.canActivate) {
    return {
      ok: false,
      code: "PLUGIN_NOT_ACTIVATABLE",
      capability: input.capability,
    };
  }

  if (input.grant.effectiveCapabilities.includes(input.capability)) {
    return {
      ok: true,
      capability: input.capability,
      grantedBy: input.capability,
    };
  }

  const wildcard = scopedWildcardFor(input.capability);
  if (wildcard && input.grant.effectiveCapabilities.includes(wildcard)) {
    return {
      ok: true,
      capability: input.capability,
      grantedBy: wildcard,
    };
  }

  return {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: input.capability,
  };
}

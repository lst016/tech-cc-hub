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

function isNamedToolCall(capability: PluginAtomicCapability): capability is `tools.call:${string}` {
  return capability.startsWith("tools.call:") && capability !== "tools.call:*";
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

  if (isNamedToolCall(input.capability) && input.grant.effectiveCapabilities.includes("tools.call:*")) {
    return {
      ok: true,
      capability: input.capability,
      grantedBy: "tools.call:*",
    };
  }

  return {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: input.capability,
  };
}

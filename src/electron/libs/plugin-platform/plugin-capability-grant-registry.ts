import {
  authorizePluginCapability,
  resolvePluginCapabilityGrant,
  type PluginCapabilityAuthorizationResult,
} from "../../../shared/plugin-platform/index.js";
import type {
  CanonicalPluginManifest,
  PluginAtomicCapability,
  PluginCapability,
  PluginCapabilityGrantResult,
  PluginGrantProfile,
} from "../../../shared/plugin-platform/types.js";

export type ActivatePluginCapabilityGrantInput = {
  manifest: CanonicalPluginManifest;
  profile: PluginGrantProfile;
  customGrants?: readonly PluginCapability[];
};

export type ActivatePluginCapabilityGrantResult =
  | {
      ok: true;
      grant: PluginCapabilityGrantResult;
    }
  | {
      ok: false;
      code: "MISSING_REQUIRED_CAPABILITIES";
      grant: PluginCapabilityGrantResult;
    };

export type RegisteredPluginCapabilityAuthorizationResult =
  | PluginCapabilityAuthorizationResult
  | {
      ok: false;
      code: "PLUGIN_NOT_ACTIVE";
      capability: PluginAtomicCapability;
    };

function cloneGrant(grant: PluginCapabilityGrantResult): PluginCapabilityGrantResult {
  return {
    effectiveCapabilities: [...grant.effectiveCapabilities],
    missingRequiredCapabilities: [...grant.missingRequiredCapabilities],
    canActivate: grant.canActivate,
  };
}

export class PluginCapabilityGrantRegistry {
  readonly #grants = new Map<string, PluginCapabilityGrantResult>();

  activate(input: ActivatePluginCapabilityGrantInput): ActivatePluginCapabilityGrantResult {
    const grant = resolvePluginCapabilityGrant({
      requested: input.manifest.capabilities,
      profile: input.profile,
      customGrants: input.customGrants,
    });

    if (!grant.canActivate) {
      this.#grants.delete(input.manifest.id);
      return {
        ok: false,
        code: "MISSING_REQUIRED_CAPABILITIES",
        grant: cloneGrant(grant),
      };
    }

    this.#grants.set(input.manifest.id, cloneGrant(grant));
    return { ok: true, grant: cloneGrant(grant) };
  }

  authorize(
    pluginId: string,
    capability: PluginAtomicCapability,
  ): RegisteredPluginCapabilityAuthorizationResult {
    const grant = this.#grants.get(pluginId);
    if (!grant) {
      return { ok: false, code: "PLUGIN_NOT_ACTIVE", capability };
    }
    return authorizePluginCapability({ grant, capability });
  }

  deactivate(pluginId: string): boolean {
    return this.#grants.delete(pluginId);
  }
}

import { resolvePluginCapabilityGrant } from "../../../shared/plugin-platform/permissions.js";
import type {
  PluginAtomicCapability,
  PluginCapability,
  PluginGrantProfile,
} from "../../../shared/plugin-platform/types.js";
import { PluginActivationService } from "./plugin-activation-service.js";
import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";
import {
  createPluginConsentRecord,
  validatePluginConsentRecord,
} from "./plugin-consent.js";
import type { PluginConsentStore } from "./plugin-consent-store.js";
import { discoverPluginPackages } from "./plugin-package-registry.js";

export type PluginConsentConfirmationRequest = {
  pluginId: string;
  displayName: string;
  pluginVersion: string;
  profile: PluginGrantProfile;
  effectiveCapabilities: PluginAtomicCapability[];
};

export type RequestPluginActivationInput = {
  pluginId: string;
  profile: PluginGrantProfile;
  customGrants?: readonly PluginCapability[];
};

export type PluginConsentCoordinatorOptions = {
  pluginsPath: string;
  grants: PluginCapabilityGrantRegistry;
  store: PluginConsentStore;
  confirmConsent: (request: PluginConsentConfirmationRequest) => Promise<boolean>;
  now: () => number;
};

type CoordinatorFailureCode =
  | "PLUGIN_NOT_INSTALLED"
  | "MISSING_REQUIRED_CAPABILITIES"
  | "CONSENT_DENIED"
  | "CONSENT_CONFIRMATION_FAILED"
  | "CONSENT_NOT_FOUND"
  | "CONSENT_INVALID"
  | "PLUGIN_VERSION_CHANGED"
  | "CAPABILITIES_CHANGED"
  | "PACKAGE_CHANGED_DURING_ACTIVATION";

export type PluginConsentCoordinatorResult =
  | {
      ok: true;
      pluginId: string;
      grant: {
        effectiveCapabilities: PluginAtomicCapability[];
        missingRequiredCapabilities: PluginAtomicCapability[];
        canActivate: boolean;
      };
    }
  | {
      ok: false;
      code: CoordinatorFailureCode;
      pluginId: string;
      missingRequiredCapabilities?: PluginAtomicCapability[];
    };

type PluginConsentCoordinatorFailure = Extract<
  PluginConsentCoordinatorResult,
  { ok: false }
>;

export class PluginConsentCoordinator {
  readonly #options: PluginConsentCoordinatorOptions;
  readonly #activation: PluginActivationService;

  constructor(options: PluginConsentCoordinatorOptions) {
    this.#options = options;
    this.#activation = new PluginActivationService({
      pluginsPath: options.pluginsPath,
      grants: options.grants,
    });
  }

  async requestActivation(
    input: RequestPluginActivationInput,
  ): Promise<PluginConsentCoordinatorResult> {
    this.#options.grants.deactivate(input.pluginId);
    await this.#options.store.delete(input.pluginId);

    const installed = await this.#findInstalled(input.pluginId);
    if (!installed) return this.#failed(input.pluginId, "PLUGIN_NOT_INSTALLED");

    const created = createPluginConsentRecord({
      manifest: installed.manifest,
      profile: input.profile,
      customGrants: input.customGrants,
      grantedAt: this.#options.now(),
    });
    if (!created.ok) {
      return {
        ...this.#failed(input.pluginId, created.code),
        missingRequiredCapabilities: created.missingRequiredCapabilities,
      };
    }

    const grant = resolvePluginCapabilityGrant({
      requested: installed.manifest.capabilities,
      profile: input.profile,
      customGrants: input.customGrants,
    });
    let confirmed: boolean;
    try {
      confirmed = await this.#options.confirmConsent({
        pluginId: input.pluginId,
        displayName: installed.manifest.displayName,
        pluginVersion: installed.manifest.version,
        profile: input.profile,
        effectiveCapabilities: [...grant.effectiveCapabilities],
      });
    } catch {
      return this.#failed(input.pluginId, "CONSENT_CONFIRMATION_FAILED");
    }
    if (!confirmed) return this.#failed(input.pluginId, "CONSENT_DENIED");

    await this.#options.store.set(created.record);
    const activated = await this.#activation.activate({
      pluginId: input.pluginId,
      profile: created.record.profile,
      customGrants: created.record.customGrants,
      expectedConsent: created.record,
    });
    if (!activated.ok) {
      await this.#options.store.delete(input.pluginId);
      return activated;
    }
    return activated;
  }

  async restore(pluginId: string): Promise<PluginConsentCoordinatorResult> {
    this.#options.grants.deactivate(pluginId);
    const installed = await this.#findInstalled(pluginId);
    if (!installed) {
      await this.#options.store.delete(pluginId);
      return this.#failed(pluginId, "PLUGIN_NOT_INSTALLED");
    }

    const record = await this.#options.store.get(pluginId);
    if (!record) return this.#failed(pluginId, "CONSENT_NOT_FOUND");
    const validation = validatePluginConsentRecord({
      manifest: installed.manifest,
      record,
    });
    if (!validation.ok) {
      await this.#options.store.delete(pluginId);
      return this.#failed(pluginId, validation.code);
    }

    const activated = await this.#activation.activate({
      pluginId,
      ...validation.activation,
      expectedConsent: record,
    });
    if (!activated.ok) await this.#options.store.delete(pluginId);
    return activated;
  }

  async revoke(pluginId: string): Promise<boolean> {
    this.#options.grants.deactivate(pluginId);
    return await this.#options.store.delete(pluginId);
  }

  async #findInstalled(pluginId: string) {
    const discovery = await discoverPluginPackages(this.#options.pluginsPath);
    return discovery.records.find((record) => record.manifest.id === pluginId) ?? null;
  }

  #failed(pluginId: string, code: CoordinatorFailureCode): PluginConsentCoordinatorFailure {
    return { ok: false, code, pluginId };
  }
}

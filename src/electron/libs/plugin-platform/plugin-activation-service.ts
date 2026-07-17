import type {
  PluginCapability,
  PluginCapabilityGrantResult,
  PluginGrantProfile,
} from "../../../shared/plugin-platform/types.js";
import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";
import { discoverPluginPackages } from "./plugin-package-registry.js";

export type ActivateInstalledPluginInput = {
  pluginId: string;
  profile: PluginGrantProfile;
  customGrants?: readonly PluginCapability[];
};

export type ActivateInstalledPluginResult =
  | {
      ok: true;
      pluginId: string;
      grant: PluginCapabilityGrantResult;
    }
  | {
      ok: false;
      code: "PLUGIN_NOT_INSTALLED";
      pluginId: string;
    }
  | {
      ok: false;
      code: "MISSING_REQUIRED_CAPABILITIES";
      pluginId: string;
      grant: PluginCapabilityGrantResult;
    };

export type PluginActivationServiceOptions = {
  pluginsPath: string;
  grants: PluginCapabilityGrantRegistry;
};

export class PluginActivationService {
  readonly #pluginsPath: string;
  readonly #grants: PluginCapabilityGrantRegistry;

  constructor(options: PluginActivationServiceOptions) {
    this.#pluginsPath = options.pluginsPath;
    this.#grants = options.grants;
  }

  async activate(
    input: ActivateInstalledPluginInput,
  ): Promise<ActivateInstalledPluginResult> {
    this.#grants.deactivate(input.pluginId);

    const discovery = await discoverPluginPackages(this.#pluginsPath);
    const installed = discovery.records.find((record) => (
      record.manifest.id === input.pluginId
    ));
    if (!installed) {
      return {
        ok: false,
        code: "PLUGIN_NOT_INSTALLED",
        pluginId: input.pluginId,
      };
    }

    const activated = this.#grants.activate({
      manifest: installed.manifest,
      profile: input.profile,
      customGrants: input.customGrants,
    });
    if (!activated.ok) {
      return {
        ok: false,
        code: activated.code,
        pluginId: input.pluginId,
        grant: activated.grant,
      };
    }

    return {
      ok: true,
      pluginId: input.pluginId,
      grant: activated.grant,
    };
  }

  deactivate(pluginId: string): boolean {
    return this.#grants.deactivate(pluginId);
  }
}

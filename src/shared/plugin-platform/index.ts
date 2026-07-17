export { normalizePluginPackageManifests } from "./manifest.js";
export {
  authorizePluginCapability,
  type AuthorizePluginCapabilityInput,
  type PluginCapabilityAuthorizationResult,
} from "./capability-broker.js";
export {
  expandPluginCapabilityBundles,
  resolvePluginCapabilityGrant,
  STANDARD_PLUGIN_CAPABILITIES,
} from "./permissions.js";
export { getPluginActivityRailDescriptor } from "./surfaces.js";
export * from "./types.js";

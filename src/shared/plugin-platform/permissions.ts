import type {
  PluginAtomicCapability,
  PluginCapability,
  PluginCapabilityBundle,
  PluginCapabilityGrantResult,
  ResolvePluginCapabilityGrantInput,
} from "./types.js";

export const STANDARD_PLUGIN_CAPABILITIES = [
  "session.context.read",
  "session.child.create",
  "session.child.read",
  "session.attachments.receive",
  "models.list",
  "tools.list",
] as const satisfies readonly PluginAtomicCapability[];

const BUNDLE_EXPANSIONS: Record<PluginCapabilityBundle, readonly PluginAtomicCapability[]> = {
  "session.main.control": [
    "session.main.message.create",
    "session.main.run.start",
    "session.main.run.cancel",
    "session.main.model.set",
  ],
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isBundle(capability: PluginCapability): capability is PluginCapabilityBundle {
  return capability in BUNDLE_EXPANSIONS;
}

function scopedWildcardFor(
  capability: PluginAtomicCapability,
): PluginAtomicCapability | null {
  const separator = capability.indexOf(":");
  if (separator < 1 || capability.endsWith(":*")) return null;
  return `${capability.slice(0, separator)}:*` as PluginAtomicCapability;
}

export function expandPluginCapabilityBundles(
  capabilities: readonly PluginCapability[],
): PluginAtomicCapability[] {
  const expanded: PluginAtomicCapability[] = [];
  for (const capability of capabilities) {
    const next = isBundle(capability) ? BUNDLE_EXPANSIONS[capability] : [capability];
    for (const atomic of next) {
      if (!expanded.includes(atomic)) expanded.push(atomic);
    }
  }
  return expanded;
}

function resolveCustomCapabilities(
  requested: readonly PluginAtomicCapability[],
  customGrants: readonly PluginAtomicCapability[],
): PluginAtomicCapability[] {
  const effective: PluginAtomicCapability[] = [];

  for (const capability of requested) {
    if (customGrants.includes(capability)) {
      effective.push(capability);
    } else {
      const wildcard = scopedWildcardFor(capability);
      if (wildcard && customGrants.includes(wildcard)) effective.push(capability);
    }
  }

  for (const capability of customGrants) {
    const requestedWildcard = scopedWildcardFor(capability);
    if (requestedWildcard && requested.includes(requestedWildcard)) {
      effective.push(capability);
    }
  }
  return unique(effective);
}

export function resolvePluginCapabilityGrant(
  input: ResolvePluginCapabilityGrantInput,
): PluginCapabilityGrantResult {
  const required = expandPluginCapabilityBundles(input.requested.required);
  const optional = expandPluginCapabilityBundles(input.requested.optional)
    .filter((capability) => !required.includes(capability));
  const requested = [...required, ...optional];

  let effectiveCapabilities: PluginAtomicCapability[];
  if (input.profile === "full-trust") {
    effectiveCapabilities = [...requested];
  } else if (input.profile === "standard") {
    effectiveCapabilities = requested.filter((capability) => (
      STANDARD_PLUGIN_CAPABILITIES.includes(capability as typeof STANDARD_PLUGIN_CAPABILITIES[number])
    ));
  } else {
    effectiveCapabilities = resolveCustomCapabilities(
      requested,
      expandPluginCapabilityBundles(input.customGrants ?? []),
    );
  }

  const missingRequiredCapabilities = required.filter((capability) => !effectiveCapabilities.includes(capability));
  return {
    effectiveCapabilities,
    missingRequiredCapabilities,
    canActivate: missingRequiredCapabilities.length === 0,
  };
}

// src/electron/libs/compat-model-provider-capability.ts
// -----------------------------------------------------------------------------
// Phase 8 of the Claude Code 2.1.161 compatibility workflow.
// Provider capability matrix for model/effort compatibility. The full runner
// launch-time validation lives in the runner lane; this module is the
// data-driven helper that surfaces incompatible combinations.
// -----------------------------------------------------------------------------

export type Effort = "low" | "medium" | "high" | "xhigh";

export type ProviderCapability = {
  providerId: string;
  supportsEffort: boolean;
  supportedEfforts: Effort[];
  supportsAutoMode: boolean;
  supportsXHigh: boolean;
  modelAliases: Record<string, string>;
  unsupportedReason?: string;
};

export type ValidationResult = {
  ok: boolean;
  code?: "unsupported-effort" | "unsupported-xhigh" | "unsupported-auto" | "stale-model" | "unknown-model" | "unknown-provider";
  reason?: string;
};

// Last reconciled against the 2.1.154 changelog section. Each entry is
// deliberately narrow so the release-gate (Phase 10) can flag drift.
export const PROVIDER_CAPABILITY_MATRIX: Record<string, ProviderCapability> = {
  anthropic: {
    providerId: "anthropic",
    supportsEffort: true,
    supportedEfforts: ["low", "medium", "high", "xhigh"],
    supportsAutoMode: true,
    supportsXHigh: true,
    modelAliases: {
      "claude-opus-4-6[1m]": "claude-opus-4-6-fast",
    },
  },
  custom: {
    providerId: "custom",
    supportsEffort: false,
    supportedEfforts: ["medium"],
    supportsAutoMode: false,
    supportsXHigh: false,
    modelAliases: {},
    unsupportedReason: "custom providers do not expose the /effort slider",
  },
  deepseek: {
    providerId: "deepseek",
    supportsEffort: false,
    supportedEfforts: ["medium"],
    supportsAutoMode: false,
    supportsXHigh: false,
    modelAliases: {},
    unsupportedReason: "deepseek does not support effort/xhigh at this time",
  },
  codex: {
    providerId: "codex",
    supportsEffort: true,
    supportedEfforts: ["medium", "high"],
    supportsAutoMode: false,
    supportsXHigh: false,
    modelAliases: {},
  },
  minimax: {
    providerId: "minimax",
    supportsEffort: true,
    supportedEfforts: ["low", "medium", "high"],
    supportsAutoMode: false,
    supportsXHigh: false,
    modelAliases: {},
  },
};

export function getProviderCapability(providerId: string): ProviderCapability | null {
  return PROVIDER_CAPABILITY_MATRIX[providerId] ?? null;
}

// Resolve a provider id from a model name when the model name itself
// encodes the provider (claude-opus, deepseek-coder, gpt-*, etc.).
export function resolveProviderIdForModel(model: string): string | null {
  const m = (model || "").toLowerCase();
  if (!m) return null;
  if (m.startsWith("claude-")) return "anthropic";
  if (m.startsWith("deepseek-")) return "deepseek";
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3")) return "codex";
  if (m.startsWith("minimax-")) return "minimax";
  return null;
}

export function resolveModelAlias(providerId: string, model: string): string {
  const cap = getProviderCapability(providerId);
  if (!cap) return model;
  return cap.modelAliases[model] ?? model;
}

export function validateModelEffortProvider(model: string, effort: Effort | undefined, providerId: string, autoMode = false): ValidationResult {
  const cap = getProviderCapability(providerId);
  if (!cap) {
    return { ok: false, code: "unknown-provider", reason: `provider "${providerId}" is not in the capability matrix` };
  }
  if (!model || !model.trim()) {
    return { ok: false, code: "unknown-model", reason: "empty model name" };
  }
  // Effort / auto mode checks come first so we surface the actionable
  // problem (the user can switch effort) before the stale-model signal (the
  // user would have to switch provider or upgrade).
  if (effort) {
    if (!cap.supportsEffort) {
      return { ok: false, code: "unsupported-effort", reason: cap.unsupportedReason ?? `${providerId} does not support /effort` };
    }
    if (!cap.supportedEfforts.includes(effort)) {
      return { ok: false, code: "unsupported-effort", reason: `${providerId} supports efforts ${cap.supportedEfforts.join(", ")} (got ${effort})` };
    }
    if (effort === "xhigh" && !cap.supportsXHigh) {
      return { ok: false, code: "unsupported-xhigh", reason: `${providerId} does not support xhigh` };
    }
  }
  if (autoMode && !cap.supportsAutoMode) {
    return { ok: false, code: "unsupported-auto", reason: `${providerId} does not support auto mode` };
  }
  // Stale-model is the lowest-priority signal: only fire it when the rest is OK.
  const aliased = resolveModelAlias(providerId, model);
  if (aliased === model && !cap.supportsEffort) {
    return { ok: false, code: "stale-model", reason: `provider ${providerId} has no current model guidance for ${model}` };
  }
  return { ok: true };
}

// Downgrade an unsupported effort to the closest supported value (in either
// direction). If the provider doesn't support effort at all, return null
// and the caller should surface the validation result instead of silently
// downgrading.
export function downgradeUnsupportedEffort(providerId: string, effort: Effort): Effort | null {
  const cap = getProviderCapability(providerId);
  if (!cap || !cap.supportsEffort) return null;
  if (cap.supportedEfforts.includes(effort)) return effort;
  const order: Effort[] = ["low", "medium", "high", "xhigh"];
  const requestedIdx = order.indexOf(effort);
  // Search outward from the requested effort to find the closest supported one.
  for (let delta = 0; delta < order.length; delta += 1) {
    const up = order[requestedIdx + delta];
    if (up && cap.supportedEfforts.includes(up)) return up;
    const down = order[requestedIdx - delta];
    if (down && cap.supportedEfforts.includes(down)) return down;
  }
  return null;
}

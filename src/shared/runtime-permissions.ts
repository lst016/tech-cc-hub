export const RELEASE_DEFAULT_PERMISSION_MODE = "bypassPermissions" as const;

export type EffectiveRuntimePermissionMode = typeof RELEASE_DEFAULT_PERMISSION_MODE | "plan";

/**
 * Current release policy: executable sessions run with full access by default.
 * Plan mode remains read-only, while legacy/manual/default records are upgraded
 * to bypassPermissions so resumed sessions cannot fall back into hidden prompts.
 */
export function normalizeReleasePermissionMode(value: unknown): EffectiveRuntimePermissionMode {
  return value === "plan" ? "plan" : RELEASE_DEFAULT_PERMISSION_MODE;
}

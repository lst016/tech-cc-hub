export type PluginUpdateStatus = "unknown" | "up-to-date" | "update-available" | "error";

export type PluginUpdateSummary = {
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable: boolean;
  updateStatus: PluginUpdateStatus;
  updateError?: string;
  updateCheckedAt?: number;
};

const SEMVER_PATTERN = /v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

export function normalizePluginVersion(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  const version = raw.match(SEMVER_PATTERN)?.[1] ?? raw.replace(/^v/i, "");
  const normalized = version.trim().split(/[+-]/)[0];
  return normalized || undefined;
}

export function comparePluginVersions(left: string | null | undefined, right: string | null | undefined): number {
  const leftParts = normalizePluginVersion(left)?.split(".").map((part) => Number.parseInt(part, 10)) ?? [];
  const rightParts = normalizePluginVersion(right)?.split(".").map((part) => Number.parseInt(part, 10)) ?? [];
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function summarizePluginUpdate(input: {
  currentVersion?: string | null;
  latestVersion?: string | null;
  updateError?: string;
  updateCheckedAt?: number;
}): PluginUpdateSummary {
  const currentVersion = normalizePluginVersion(input.currentVersion);
  const latestVersion = normalizePluginVersion(input.latestVersion);

  if (input.updateError) {
    return {
      currentVersion,
      latestVersion,
      updateAvailable: false,
      updateStatus: "error",
      updateError: input.updateError,
      updateCheckedAt: input.updateCheckedAt,
    };
  }

  if (!currentVersion || !latestVersion) {
    return {
      currentVersion,
      latestVersion,
      updateAvailable: false,
      updateStatus: "unknown",
      updateCheckedAt: input.updateCheckedAt,
    };
  }

  const updateAvailable = comparePluginVersions(latestVersion, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    updateStatus: updateAvailable ? "update-available" : "up-to-date",
    updateCheckedAt: input.updateCheckedAt,
  };
}

import {
  compareAppVersions,
  getPlatformUpdateMetadataCandidates,
  normalizeAppVersion,
} from "./auto-updater-fallback.js";

export type AppUpdateProvider = "internal" | "github";
export type AppUpdateMode = "internal-first" | "internal-only" | "github-only";

export type AppUpdateSourcePolicy = {
  mode: AppUpdateMode;
  internalFeedUrl: string;
  internalBootstrapFeedUrl?: string;
  internalProbeTimeoutMs: number;
};

export const DEFAULT_INTERNAL_UPDATE_FEED_URL =
  "http://172.18.56.18/tech-cc-hub/release/";
export const DEFAULT_INTERNAL_BOOTSTRAP_FEED_URL =
  "http://172.18.56.18/tech-cc-hub/release/v0.1.62/";

const DEFAULT_INTERNAL_PROBE_TIMEOUT_MS = 3_000;
const MIN_INTERNAL_PROBE_TIMEOUT_MS = 500;
const MAX_INTERNAL_PROBE_TIMEOUT_MS = 15_000;

function normalizeFeedUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_INTERNAL_UPDATE_FEED_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_INTERNAL_UPDATE_FEED_URL;
    }
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.toString();
  } catch {
    return DEFAULT_INTERNAL_UPDATE_FEED_URL;
  }
}

function normalizeMode(
  modeValue: string | undefined,
  legacyPriorityValue: string | undefined,
): AppUpdateMode {
  const mode = modeValue?.trim().toLowerCase();
  if (mode === "internal-only" || mode === "github-only" || mode === "internal-first") {
    return mode;
  }

  const legacyPriority = legacyPriorityValue
    ?.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .map((entry) => (entry === "intranet" ? "internal" : entry))
    .filter(Boolean);
  if (legacyPriority?.length === 1 && legacyPriority[0] === "internal") {
    return "internal-only";
  }
  if (legacyPriority?.length === 1 && legacyPriority[0] === "github") {
    return "github-only";
  }
  return "internal-first";
}

function normalizeProbeTimeout(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_INTERNAL_PROBE_TIMEOUT_MS;
  return Math.min(Math.max(parsed, MIN_INTERNAL_PROBE_TIMEOUT_MS), MAX_INTERNAL_PROBE_TIMEOUT_MS);
}

export function resolveAppUpdateSourcePolicy(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AppUpdateSourcePolicy {
  const configuredInternalUrl = env.TECH_CC_HUB_INTERNAL_UPDATE_URL?.trim();
  return {
    mode: normalizeMode(
      env.TECH_CC_HUB_UPDATE_MODE,
      env.TECH_CC_HUB_UPDATE_SOURCE_PRIORITY,
    ),
    internalFeedUrl: normalizeFeedUrl(configuredInternalUrl),
    internalBootstrapFeedUrl: configuredInternalUrl
      ? undefined
      : DEFAULT_INTERNAL_BOOTSTRAP_FEED_URL,
    internalProbeTimeoutMs: normalizeProbeTimeout(
      env.TECH_CC_HUB_INTERNAL_UPDATE_PROBE_TIMEOUT_MS,
    ),
  };
}

export function getUpdateSourceOrder(mode: AppUpdateMode): AppUpdateProvider[] {
  if (mode === "internal-only") return ["internal"];
  if (mode === "github-only") return ["github"];
  return ["internal", "github"];
}

export function getInternalUpdateMetadataUrl(
  feedUrl: string,
  platform: NodeJS.Platform,
  arch: string,
): string {
  const metadataFile = getPlatformUpdateMetadataCandidates(platform, arch)[0] ?? "latest.yml";
  return new URL(metadataFile, normalizeFeedUrl(feedUrl)).toString();
}

export function isVersionedInternalUpdateUrl(value: string): boolean {
  try {
    const url = new URL(normalizeFeedUrl(value));
    const lastSegment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    return /^v?\d+\.\d+\.\d+$/.test(lastSegment);
  } catch {
    return false;
  }
}

export type InternalVersionFeed = {
  version: string;
  feedUrl: string;
};

export function discoverInternalVersionFeeds(
  listingUrl: string,
  listingHtml: string,
): InternalVersionFeed[] {
  const baseUrl = new URL(normalizeFeedUrl(listingUrl));
  const basePath = baseUrl.pathname;
  const discovered = new Map<string, InternalVersionFeed>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;

  for (const match of listingHtml.matchAll(hrefPattern)) {
    const href = match[1];
    if (!href) continue;

    let candidateUrl: URL;
    try {
      candidateUrl = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (candidateUrl.origin !== baseUrl.origin || !candidateUrl.pathname.startsWith(basePath)) {
      continue;
    }

    const relativePath = candidateUrl.pathname.slice(basePath.length);
    const versionMatch = relativePath.match(/^(v?\d+\.\d+\.\d+)\/?$/);
    if (!versionMatch?.[1]) continue;

    const version = normalizeAppVersion(versionMatch[1]);
    const feedUrl = new URL(`${versionMatch[1].replace(/^v?/i, "v")}/`, baseUrl).toString();
    discovered.set(version, { version, feedUrl });
  }

  return [...discovered.values()]
    .sort((left, right) => compareAppVersions(right.version, left.version));
}

export type GitHubReleaseAssetLike = {
  name?: unknown;
};

export type GitHubReleaseLike = {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  body?: unknown;
  assets?: unknown;
};

export type ReleaseFallbackInfo = {
  tagName?: string;
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  metadataFile?: string;
  hasCompatibleUpdateMetadata: boolean;
};

export type ReleaseUpdatePlan = {
  selectedRelease: ReleaseFallbackInfo | null;
  currentRelease: ReleaseFallbackInfo | null;
  isMultiReleaseUpdate: boolean;
  previousBlockmapBaseUrl?: string;
};

export function isMissingPlatformUpdateMetadataError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:404|not\s*found|cannot\s+find|no\s+published\s+versions)/i.test(message) &&
    /(?:latest(?:-[\w]+)?\.ya?ml|update\s+info|release\s+artifacts?)/i.test(message);
}

export function normalizeAppVersion(value: string | undefined): string {
  return (value ?? '').trim().replace(/^v/i, '').split(/[+-]/)[0] ?? '';
}

export function compareAppVersions(left: string | undefined, right: string | undefined): number {
  const leftParts = normalizeAppVersion(left).split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = normalizeAppVersion(right).split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function getPlatformUpdateMetadataCandidates(platform: NodeJS.Platform, arch: string): string[] {
  if (platform === 'darwin') return ['latest-mac.yml'];
  if (platform === 'linux') return ['latest-linux.yml'];
  if (platform === 'win32') {
    return arch === 'arm64' ? ['latest-win-arm64.yml', 'latest.yml'] : ['latest.yml'];
  }
  return [];
}

export function summarizeGitHubReleaseForUpdates(
  release: GitHubReleaseLike,
  platform: NodeJS.Platform,
  arch: string,
): ReleaseFallbackInfo {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const assetNames = new Set(
    assets
      .map((asset: unknown) => {
        if (typeof asset !== 'object' || asset === null || Array.isArray(asset)) return '';
        const name = (asset as GitHubReleaseAssetLike).name;
        return typeof name === 'string' ? name : '';
      })
      .filter(Boolean),
  );
  const metadataCandidates = getPlatformUpdateMetadataCandidates(platform, arch);
  const metadataFile = metadataCandidates.find((candidate) => assetNames.has(candidate));

  return {
    tagName: typeof release.tag_name === 'string' ? release.tag_name : undefined,
    version: typeof release.tag_name === 'string' ? normalizeAppVersion(release.tag_name) : undefined,
    releaseName: typeof release.name === 'string' ? release.name : undefined,
    releaseDate: typeof release.published_at === 'string' ? release.published_at : undefined,
    releaseNotes: typeof release.body === 'string' ? release.body : undefined,
    releaseUrl: typeof release.html_url === 'string' ? release.html_url : undefined,
    metadataFile,
    hasCompatibleUpdateMetadata: Boolean(metadataFile),
  };
}

export function selectBestReleaseForUpdate(
  releases: GitHubReleaseLike[],
  currentVersion: string | undefined,
  platform: NodeJS.Platform,
  arch: string,
): ReleaseFallbackInfo | null {
  return releases
    .map((release) => summarizeGitHubReleaseForUpdates(release, platform, arch))
    .filter((release) => release.version && compareAppVersions(release.version, currentVersion) > 0)
    .sort((left, right) => compareAppVersions(right.version, left.version))[0] ?? null;
}

export function buildGitHubReleaseDownloadFeedUrl(owner: string, repo: string, tagName: string): string {
  const safeOwner = owner.trim().replace(/^\/+|\/+$/g, '');
  const safeRepo = repo.trim().replace(/^\/+|\/+$/g, '');
  return `https://github.com/${safeOwner}/${safeRepo}/releases/download/${encodeURIComponent(tagName)}/`;
}

export function createReleaseUpdatePlan(
  releases: GitHubReleaseLike[],
  currentVersion: string | undefined,
  platform: NodeJS.Platform,
  arch: string,
  owner: string,
  repo: string,
): ReleaseUpdatePlan {
  const summaries = releases.map((release) => summarizeGitHubReleaseForUpdates(release, platform, arch));
  const selectedRelease = selectBestReleaseForUpdate(releases, currentVersion, platform, arch);
  const currentRelease = summaries.find((release) => compareAppVersions(release.version, currentVersion) === 0) ?? null;
  const newerReleases = summaries
    .filter((release) => release.version && compareAppVersions(release.version, currentVersion) > 0)
    .sort((left, right) => compareAppVersions(left.version, right.version));
  const firstNewerRelease = newerReleases[0] ?? null;
  const isMultiReleaseUpdate = Boolean(
    selectedRelease?.version &&
    firstNewerRelease?.version &&
    compareAppVersions(selectedRelease.version, firstNewerRelease.version) > 0,
  );
  const previousBlockmapBaseUrl = !isMultiReleaseUpdate && currentRelease?.tagName
    ? buildGitHubReleaseDownloadFeedUrl(owner, repo, currentRelease.tagName)
    : undefined;

  return {
    selectedRelease,
    currentRelease,
    isMultiReleaseUpdate,
    previousBlockmapBaseUrl,
  };
}
